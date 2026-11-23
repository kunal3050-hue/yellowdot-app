/**
 * certificateService.js — Certificates Module · Core Data Service
 *
 * Collection: certificates/{certificateId}
 * Counter:    counters/certificates-{schoolId}-{academicYear}
 *
 * Certificates issued to children: graduation / term completion, achievement,
 * participation and attendance awards. Staff-only — there is no parent-facing
 * read in this module by design, so nothing here filters on visibility.
 *
 * ── Why a stored record, and not render-on-demand ─────────────────────────────
 * The issuance log IS the product. "Did this child get her graduation
 * certificate?" and "reprint the one we handed over in March" are the two
 * questions the module exists to answer, and neither can be answered by a
 * template that regenerates from live data.
 *
 * ── Why studentName / className are denormalised ──────────────────────────────
 * A certificate is a historical document. If the child moves to another class,
 * or the class is renamed next academic year, the reprint must still read what
 * it read on the day it was handed over. Resolving the name through a join at
 * print time would silently rewrite history. journeyEntries denormalises the
 * same two fields for the same reason.
 *
 * ── Serial numbers ────────────────────────────────────────────────────────────
 * Human-quotable and sequential per academic year: "YD/2026-27/0042". Parents
 * ring up quoting the serial, so it has to be short, ordered and gap-free.
 * Allocation runs in a Firestore transaction; a bulk issue reserves its whole
 * block in ONE transaction rather than looping, which is both faster for a
 * 30-child graduation and the only way two concurrent bulk issues cannot
 * interleave onto the same numbers.
 */

const { db } = require("../firebaseAdmin");
const { getAcademicYear } = require("../utils/academicYear");

const SCHOOL_ID     = process.env.SCHOOL_ID || "yd-main";
const SERIAL_PREFIX = process.env.CERT_SERIAL_PREFIX || "YD";

const col        = () => db.collection("certificates");
const counterCol = () => db.collection("counters");
const nowISO     = () => new Date().toISOString();

const VALID_TYPES = new Set([
  "graduation",     // end of term / academic year completion
  "achievement",    // Star of the Month, Best Reader, custom citation
  "participation",  // Sports Day, Annual Day, competitions
  "attendance",     // 100% / 95% attendance award
]);

const VALID_TEMPLATES = new Set(["classic", "playful"]);
const VALID_STATUSES  = new Set(["draft", "issued", "revoked"]);

/**
 * Types a child may only hold ONE non-revoked certificate of per academic
 * year. A child cannot graduate from the same year twice, but can certainly
 * collect two achievements or take part in three events.
 */
const UNIQUE_PER_YEAR = new Set(["graduation"]);

/** Default headline per type — staff may override with their own title. */
const DEFAULT_TITLES = {
  graduation:    "Certificate of Completion",
  achievement:   "Certificate of Achievement",
  participation: "Certificate of Participation",
  attendance:    "Certificate of Attendance",
};

const MAX_BULK = 200;

// ── Shaping ───────────────────────────────────────────────────────────────────

function toCertificate(snap) {
  const d  = snap.data ? snap.data() : snap;
  const id = snap.id || d.certificateId || "";
  return {
    certificateId: id,
    schoolId:      d.schoolId      || "",
    centerId:      d.centerId      || "",
    academicYear:  d.academicYear  || "",
    serialNumber:  d.serialNumber   || "",
    serialSeq:     d.serialSeq      || 0,
    studentId:     d.studentId      || "",
    studentName:   d.studentName    || "",
    classId:       d.classId        || "",
    className:     d.className      || "",
    type:          d.type           || "achievement",
    title:         d.title          || "",
    citation:      d.citation       || "",
    awardDate:     d.awardDate      || "",
    template:      d.template       || "classic",
    signatoryName:        d.signatoryName        || "",
    signatoryDesignation: d.signatoryDesignation || "",
    eventRef:      d.eventRef       || "",
    status:        d.status         || "issued",
    batchId:       d.batchId        || "",
    issuedBy:      d.issuedBy       || "",
    issuedAt:      d.issuedAt       || "",
    revokedBy:     d.revokedBy      || "",
    revokedAt:     d.revokedAt      || "",
    revokeReason:  d.revokeReason   || "",
    createdAt:     d.createdAt      || "",
    updatedAt:     d.updatedAt      || "",
  };
}

// ── Validation ────────────────────────────────────────────────────────────────

function isISODate(v) {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

class CertificateError extends Error {
  constructor(message, { status = 400, code = "CERTIFICATE_INVALID" } = {}) {
    super(message);
    this.name   = "CertificateError";
    this.status = status;
    this.code   = code;
  }
}

function assertIssuable(input) {
  if (!input || typeof input !== "object") {
    throw new CertificateError("A certificate payload is required.");
  }
  if (!VALID_TYPES.has(input.type)) {
    throw new CertificateError(
      `Unknown certificate type "${input.type}". Expected one of: ${[...VALID_TYPES].join(", ")}.`,
    );
  }
  if (!input.studentId) {
    throw new CertificateError("studentId is required.");
  }
  if (!String(input.studentName || "").trim()) {
    // The name is printed on the document and denormalised forever; an empty
    // one produces a blank certificate that looks valid.
    throw new CertificateError("studentName is required — it is printed on the certificate.");
  }
  if (!isISODate(input.awardDate)) {
    throw new CertificateError("awardDate must be an ISO date (YYYY-MM-DD).");
  }
  if (input.template && !VALID_TEMPLATES.has(input.template)) {
    throw new CertificateError(
      `Unknown template "${input.template}". Expected one of: ${[...VALID_TEMPLATES].join(", ")}.`,
    );
  }
  if (input.status && !VALID_STATUSES.has(input.status)) {
    throw new CertificateError(`Unknown status "${input.status}".`);
  }
}

// ── Serial allocation ─────────────────────────────────────────────────────────

function counterId(schoolId, academicYear) {
  return `certificates-${schoolId}-${academicYear}`;
}

function formatSerial(academicYear, seq) {
  return `${SERIAL_PREFIX}/${academicYear}/${String(seq).padStart(4, "0")}`;
}

/**
 * Reserve `count` consecutive serial numbers in a single transaction.
 * Returns the first sequence number of the reserved block.
 */
async function reserveSerials(schoolId, academicYear, count) {
  const n = Math.max(1, Number(count) || 1);
  const ref = counterCol().doc(counterId(schoolId, academicYear));

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const last = snap.exists ? Number(snap.data().lastSeq) || 0 : 0;
    const start = last + 1;
    tx.set(ref, {
      counterId:    counterId(schoolId, academicYear),
      schoolId,
      academicYear,
      lastSeq:      last + n,
      updatedAt:    nowISO(),
    }, { merge: true });
    return start;
  });
}

/**
 * Readable, deterministic document id.
 *
 * schoolId is part of the id, not decoration. Serial counters are scoped per
 * school per academic year, so two schools both issue seq 1 for 2026-27 — an
 * id built from year+seq alone collides across tenants and the second school's
 * write silently overwrites the first school's certificate. Caught by
 * "the register never includes another school's certificates".
 */
function certificateDocId(schoolId, academicYear, seq) {
  const slug = String(schoolId || "unknown").replace(/[^A-Za-z0-9_-]/g, "-");
  return `CERT-${slug}-${academicYear}-${String(seq).padStart(4, "0")}`;
}

// ── Duplicate guard ───────────────────────────────────────────────────────────

/**
 * For the types in UNIQUE_PER_YEAR, find the student's existing non-revoked
 * certificate of that type in that academic year.
 *
 * Deliberately filtered with equality only, then narrowed in JS: it keeps the
 * query on single-field indexes, which is the same choice studentService makes
 * for its sort.
 */
async function findExisting({ schoolId, studentId, type, academicYear }) {
  const snap = await col()
    .where("schoolId",     "==", schoolId)
    .where("studentId",    "==", studentId)
    .where("academicYear", "==", academicYear)
    .get();

  return snap.docs
    .map(toCertificate)
    .find(c => c.type === type && c.status !== "revoked") || null;
}

// ── Write ─────────────────────────────────────────────────────────────────────

function buildDoc({ input, ctx, academicYear, serialSeq, batchId }) {
  const stamp = nowISO();
  const status = input.status === "draft" ? "draft" : "issued";

  return {
    certificateId: certificateDocId(ctx.schoolId, academicYear, serialSeq),
    schoolId:      ctx.schoolId,
    centerId:      input.centerId || ctx.centerId || "",
    academicYear,
    serialNumber:  formatSerial(academicYear, serialSeq),
    serialSeq,
    studentId:     input.studentId,
    studentName:   String(input.studentName).trim(),
    classId:       input.classId   || "",
    className:     input.className || "",
    type:          input.type,
    title:         String(input.title || DEFAULT_TITLES[input.type] || "").trim(),
    citation:      String(input.citation || "").trim(),
    awardDate:     input.awardDate,
    template:      input.template || "classic",
    signatoryName:        String(input.signatoryName        || "").trim(),
    signatoryDesignation: String(input.signatoryDesignation || "").trim(),
    eventRef:      input.eventRef || "",
    status,
    batchId:       batchId || "",
    issuedBy:      status === "issued" ? ctx.actorUserId : "",
    issuedAt:      status === "issued" ? stamp : "",
    revokedBy:     "",
    revokedAt:     "",
    revokeReason:  "",
    createdAt:     stamp,
    updatedAt:     stamp,
  };
}

/** Issue a single certificate. */
async function issueCertificate(input, ctx) {
  assertIssuable(input);

  const schoolId     = ctx.schoolId || SCHOOL_ID;
  const academicYear = input.academicYear || getAcademicYear(input.awardDate);

  if (UNIQUE_PER_YEAR.has(input.type)) {
    const existing = await findExisting({
      schoolId, studentId: input.studentId, type: input.type, academicYear,
    });
    if (existing) {
      throw new CertificateError(
        `${input.studentName} already holds a ${input.type} certificate for ${academicYear} ` +
        `(${existing.serialNumber}). Revoke it before issuing a replacement.`,
        { status: 409, code: "CERTIFICATE_DUPLICATE" },
      );
    }
  }

  const seq = await reserveSerials(schoolId, academicYear, 1);
  const doc = buildDoc({ input, ctx: { ...ctx, schoolId }, academicYear, serialSeq: seq });

  await col().doc(doc.certificateId).set(doc);
  return toCertificate({ id: doc.certificateId, data: () => doc });
}

/**
 * Issue one certificate per student in `students`, sharing the same type,
 * title, citation, date, template and signatory.
 *
 * Graduation day is thirty certificates at once, not one, so this is the
 * primary path rather than a convenience wrapper. Students that fail the
 * duplicate guard are reported in `skipped` and do NOT fail the whole batch —
 * one child who already has last term's certificate must not block the other
 * twenty-nine.
 */
async function issueBulk({ students, ...common }, ctx) {
  if (!Array.isArray(students) || students.length === 0) {
    throw new CertificateError("students must be a non-empty array.");
  }
  if (students.length > MAX_BULK) {
    throw new CertificateError(`Cannot issue more than ${MAX_BULK} certificates in one request.`);
  }

  const schoolId     = ctx.schoolId || SCHOOL_ID;
  const academicYear = common.academicYear || getAcademicYear(common.awardDate);

  // Validate every row BEFORE reserving any serial, so a bad payload cannot
  // burn numbers and leave a gap in the register.
  const candidates = students.map(s => ({ ...common, ...s }));
  candidates.forEach(assertIssuable);

  const seen = new Set();
  const accepted = [];
  const skipped  = [];

  for (const input of candidates) {
    if (seen.has(input.studentId)) {
      skipped.push({ studentId: input.studentId, studentName: input.studentName, reason: "duplicate_in_request" });
      continue;
    }
    seen.add(input.studentId);

    if (UNIQUE_PER_YEAR.has(input.type)) {
      const existing = await findExisting({
        schoolId, studentId: input.studentId, type: input.type, academicYear,
      });
      if (existing) {
        skipped.push({
          studentId:   input.studentId,
          studentName: input.studentName,
          reason:      "already_issued",
          serialNumber: existing.serialNumber,
        });
        continue;
      }
    }
    accepted.push(input);
  }

  if (accepted.length === 0) {
    return { issued: [], skipped, batchId: "" };
  }

  const batchId = `BATCH-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const start   = await reserveSerials(schoolId, academicYear, accepted.length);

  const docs = accepted.map((input, i) => buildDoc({
    input, ctx: { ...ctx, schoolId }, academicYear, serialSeq: start + i, batchId,
  }));

  const batch = db.batch ? db.batch() : null;
  if (batch) {
    docs.forEach(d => batch.set(col().doc(d.certificateId), d));
    await batch.commit();
  } else {
    // fakeFirestore (and any stub without batch()) — write sequentially.
    for (const d of docs) await col().doc(d.certificateId).set(d);
  }

  return {
    issued:  docs.map(d => toCertificate({ id: d.certificateId, data: () => d })),
    skipped,
    batchId,
  };
}

/** Edit the printed wording of a DRAFT certificate. */
async function updateCertificate(certificateId, patch, ctx) {
  const current = await getCertificate(certificateId, ctx);

  if (current.status !== "draft") {
    throw new CertificateError(
      `Certificate ${current.serialNumber} is ${current.status} and can no longer be edited. ` +
      `Revoke it and issue a replacement instead.`,
      { status: 409, code: "CERTIFICATE_NOT_EDITABLE" },
    );
  }

  const EDITABLE = [
    "title", "citation", "awardDate", "template",
    "signatoryName", "signatoryDesignation", "className", "eventRef",
  ];
  const updates = { updatedAt: nowISO() };
  for (const field of EDITABLE) {
    if (patch[field] !== undefined) updates[field] = patch[field];
  }
  if (updates.awardDate !== undefined && !isISODate(updates.awardDate)) {
    throw new CertificateError("awardDate must be an ISO date (YYYY-MM-DD).");
  }
  if (updates.template !== undefined && !VALID_TEMPLATES.has(updates.template)) {
    throw new CertificateError(`Unknown template "${updates.template}".`);
  }

  // Promote a draft to issued in the same call, stamping who did it.
  if (patch.status === "issued") {
    updates.status   = "issued";
    updates.issuedBy = ctx.actorUserId;
    updates.issuedAt = nowISO();
  }

  await col().doc(certificateId).update(updates);
  return getCertificate(certificateId, ctx);
}

/**
 * Revoke a certificate. Soft only — an issued document never leaves the
 * register, because the register is the record of what was handed to a parent.
 */
async function revokeCertificate(certificateId, reason, ctx) {
  const current = await getCertificate(certificateId, ctx);
  if (current.status === "revoked") return current;

  await col().doc(certificateId).update({
    status:       "revoked",
    revokedBy:    ctx.actorUserId,
    revokedAt:    nowISO(),
    revokeReason: String(reason || "").trim(),
    updatedAt:    nowISO(),
  });
  return getCertificate(certificateId, ctx);
}

// ── Read ──────────────────────────────────────────────────────────────────────

/** Fetch one certificate, enforcing school isolation. */
async function getCertificate(certificateId, ctx) {
  if (!certificateId) throw new CertificateError("certificateId is required.");

  const snap = await col().doc(certificateId).get();
  if (!snap.exists) {
    throw new CertificateError("Certificate not found.", { status: 404, code: "CERTIFICATE_NOT_FOUND" });
  }
  const cert = toCertificate(snap);

  // Tenant isolation: a certificate from another school is a 404, not a 403 —
  // confirming existence would itself leak across the boundary.
  if (cert.schoolId !== (ctx.schoolId || SCHOOL_ID)) {
    throw new CertificateError("Certificate not found.", { status: 404, code: "CERTIFICATE_NOT_FOUND" });
  }
  return cert;
}

/**
 * List certificates for a school, newest award first.
 *
 * Only schoolId goes to Firestore; every other filter is applied in JS. The
 * register is one document per child per award — a few hundred rows a year —
 * so this stays cheap, and it keeps the module off composite indexes entirely.
 */
async function listCertificates(filters = {}, ctx = {}) {
  const schoolId = ctx.schoolId || SCHOOL_ID;
  const snap = await col().where("schoolId", "==", schoolId).get();

  let rows = snap.docs.map(toCertificate);

  if (filters.type)         rows = rows.filter(c => c.type === filters.type);
  if (filters.status)       rows = rows.filter(c => c.status === filters.status);
  if (filters.studentId)    rows = rows.filter(c => c.studentId === filters.studentId);
  if (filters.classId)      rows = rows.filter(c => c.classId === filters.classId);
  if (filters.academicYear) rows = rows.filter(c => c.academicYear === filters.academicYear);
  if (filters.batchId)      rows = rows.filter(c => c.batchId === filters.batchId);
  if (filters.centerId)     rows = rows.filter(c => c.centerId === filters.centerId);
  if (filters.from)         rows = rows.filter(c => c.awardDate >= filters.from);
  if (filters.to)           rows = rows.filter(c => c.awardDate <= filters.to);

  rows.sort((a, b) => (b.awardDate || "").localeCompare(a.awardDate || "")
                   || b.serialSeq - a.serialSeq);
  return rows;
}

/** Counts for the module's KPI row. */
async function getSummary(filters = {}, ctx = {}) {
  const rows = await listCertificates(filters, ctx);
  const byType = {};
  for (const t of VALID_TYPES) byType[t] = 0;
  for (const r of rows) {
    if (r.status === "revoked") continue;
    byType[r.type] = (byType[r.type] || 0) + 1;
  }
  return {
    total:   rows.length,
    issued:  rows.filter(r => r.status === "issued").length,
    drafts:  rows.filter(r => r.status === "draft").length,
    revoked: rows.filter(r => r.status === "revoked").length,
    byType,
  };
}

// ── Attendance-award eligibility ──────────────────────────────────────────────

/**
 * Children whose attendance over [from, to] meets `threshold` percent.
 *
 * The data is already in the attendance collection, so staff should never have
 * to work out who qualifies by hand — that is the whole reason the attendance
 * award is worth having as its own type.
 *
 * "Present" and "Late" both count as attended: a late child was in school that
 * day, and an attendance award that punishes the parent's traffic is not the
 * award anyone means to give.
 */
async function getAttendanceEligibility({ from, to, classId, threshold = 100, minDays = 1 } = {}, ctx = {}) {
  if (!isISODate(from) || !isISODate(to)) {
    throw new CertificateError("from and to must be ISO dates (YYYY-MM-DD).");
  }
  if (from > to) {
    throw new CertificateError("`from` must not be after `to`.");
  }

  const pct = Number(threshold);
  if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
    throw new CertificateError("threshold must be a percentage between 1 and 100.");
  }

  const schoolId = ctx.schoolId || SCHOOL_ID;
  const snap = await db.collection("attendance")
    .where("schoolId", "==", schoolId)
    .where("date", ">=", from)
    .where("date", "<=", to)
    .get();

  const byStudent = new Map();
  for (const doc of snap.docs) {
    const r = doc.data ? doc.data() : doc;
    if (ctx.centerId && r.centerId && r.centerId !== ctx.centerId) continue;
    if (classId && r.class !== classId) continue;

    const key = r.studentId;
    if (!key) continue;
    if (!byStudent.has(key)) {
      byStudent.set(key, { studentId: key, studentName: r.studentName || "", className: r.class || "", marked: 0, attended: 0 });
    }
    const agg = byStudent.get(key);
    agg.marked += 1;
    if (r.status === "Present" || r.status === "Late") agg.attended += 1;
    if (!agg.studentName && r.studentName) agg.studentName = r.studentName;
    if (!agg.className  && r.class)        agg.className  = r.class;
  }

  const rows = [...byStudent.values()].map(a => ({
    ...a,
    percent: a.marked ? Math.round((a.attended / a.marked) * 1000) / 10 : 0,
  }));

  const eligible = rows
    .filter(r => r.marked >= Number(minDays) && r.percent >= pct)
    .sort((a, b) => b.percent - a.percent || a.studentName.localeCompare(b.studentName));

  return { from, to, threshold: pct, considered: rows.length, eligible };
}

module.exports = {
  issueCertificate,
  issueBulk,
  updateCertificate,
  revokeCertificate,
  getCertificate,
  listCertificates,
  getSummary,
  getAttendanceEligibility,
  // exported for the route layer and the tests
  reserveSerials,
  formatSerial,
  certificateDocId,
  CertificateError,
  VALID_TYPES,
  VALID_TEMPLATES,
  VALID_STATUSES,
  UNIQUE_PER_YEAR,
  DEFAULT_TITLES,
  MAX_BULK,
};
