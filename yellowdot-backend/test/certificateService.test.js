/**
 * certificateService.test.js — Certificates Module · service behaviour
 *
 * Runs the REAL service against the in-memory fakeFirestore, so the code under
 * test is the code that ships: serial allocation goes through a real
 * transaction, the bulk issue goes through a real WriteBatch.
 *
 * What is covered, and why each one is here rather than assumed:
 *   - serial numbers are sequential and gap-free (parents quote them)
 *   - a failed payload burns NO serials (a gap in the register is unexplainable)
 *   - graduation is unique per academic year; achievements are not
 *   - one already-graduated child does not fail the other twenty-nine
 *   - revoke is soft and frees the uniqueness slot
 *   - studentName/className are denormalised, so a later rename cannot
 *     rewrite a certificate that has already been handed over
 *   - cross-school reads are 404, not 403
 */

const test   = require("node:test");
const assert = require("node:assert");
const { createFakeFirestore } = require("./helpers/fakeFirestore");
const { db } = require("../firebaseAdmin");
const certSvc = require("../services/certificateService");

const CTX   = { schoolId: "school-a", centerId: "centre-1", actorUserId: "user-admin" };
const OTHER = { schoolId: "school-b", centerId: "centre-9", actorUserId: "user-other" };

/** Install a clean in-memory Firestore for one test and restore afterwards. */
function withFakeDb(fn) {
  const saved = {
    collection:     db.collection,
    runTransaction: db.runTransaction,
    batch:          db.batch,
  };
  const fake = createFakeFirestore();
  db.collection     = fake.collection;
  db.runTransaction = fake.runTransaction;
  db.batch          = fake.batch;
  return (async () => {
    try { return await fn(fake); }
    finally { Object.assign(db, saved); }
  })();
}

function child(n, over = {}) {
  return {
    studentId:   `YD00${n}`,
    studentName: `Child ${n}`,
    classId:     "CLS-PG",
    className:   "Playgroup",
    ...over,
  };
}

const GRAD = {
  type:      "graduation",
  awardDate: "2027-03-28",
  title:     "Certificate of Completion",
  citation:  "has successfully completed Playgroup",
  template:  "classic",
  signatoryName:        "Principal",
  signatoryDesignation: "Principal, KUE BOXS Care",
};

// ── Serial numbers ────────────────────────────────────────────────────────────

test("serial numbers are sequential, gap-free and scoped to the academic year", () =>
  withFakeDb(async () => {
    const a = await certSvc.issueCertificate({ ...GRAD, ...child(1) }, CTX);
    const b = await certSvc.issueCertificate({ ...GRAD, ...child(2) }, CTX);
    const c = await certSvc.issueCertificate({ ...GRAD, ...child(3) }, CTX);

    assert.equal(a.serialNumber, "YD/2026-27/0001");
    assert.equal(b.serialNumber, "YD/2026-27/0002");
    assert.equal(c.serialNumber, "YD/2026-27/0003");
    assert.deepEqual([a.serialSeq, b.serialSeq, c.serialSeq], [1, 2, 3]);
  }));

test("academic year comes from the award date, not from today (June boundary)", () =>
  withFakeDb(async () => {
    const may  = await certSvc.issueCertificate({ ...GRAD, ...child(1), awardDate: "2027-05-31" }, CTX);
    const june = await certSvc.issueCertificate({ ...GRAD, ...child(2), awardDate: "2027-06-01" }, CTX);

    assert.equal(may.academicYear,  "2026-27");
    assert.equal(june.academicYear, "2027-28");
    // Each year numbers from 1 again — the serial is only unique within a year.
    assert.equal(may.serialNumber,  "YD/2026-27/0001");
    assert.equal(june.serialNumber, "YD/2027-28/0001");
  }));

test("a rejected payload burns no serial — the register has no unexplained gap", () =>
  withFakeDb(async () => {
    const first = await certSvc.issueCertificate({ ...GRAD, ...child(1) }, CTX);
    assert.equal(first.serialSeq, 1);

    await assert.rejects(
      () => certSvc.issueCertificate({ ...GRAD, ...child(2), awardDate: "28-03-2027" }, CTX),
      /ISO date/,
    );

    const next = await certSvc.issueCertificate({ ...GRAD, ...child(3) }, CTX);
    assert.equal(next.serialSeq, 2, "the failed issue must not have consumed serial 2");
  }));

// ── Validation ────────────────────────────────────────────────────────────────

test("validation rejects an unknown type, a missing name and a non-ISO date", () =>
  withFakeDb(async () => {
    await assert.rejects(() => certSvc.issueCertificate({ ...GRAD, ...child(1), type: "trophy" }, CTX),
      /Unknown certificate type/);
    await assert.rejects(() => certSvc.issueCertificate({ ...GRAD, ...child(1), studentName: "   " }, CTX),
      /studentName is required/);
    await assert.rejects(() => certSvc.issueCertificate({ ...GRAD, ...child(1), awardDate: "" }, CTX),
      /ISO date/);
    await assert.rejects(() => certSvc.issueCertificate({ ...GRAD, ...child(1), template: "neon" }, CTX),
      /Unknown template/);
  }));

// ── Uniqueness ────────────────────────────────────────────────────────────────

test("a child cannot graduate twice in the same academic year", () =>
  withFakeDb(async () => {
    await certSvc.issueCertificate({ ...GRAD, ...child(1) }, CTX);

    await assert.rejects(
      () => certSvc.issueCertificate({ ...GRAD, ...child(1) }, CTX),
      (err) => {
        assert.equal(err.status, 409);
        assert.equal(err.code, "CERTIFICATE_DUPLICATE");
        assert.match(err.message, /YD\/2026-27\/0001/);
        return true;
      },
    );
  }));

test("the same child CAN graduate in a later academic year", () =>
  withFakeDb(async () => {
    await certSvc.issueCertificate({ ...GRAD, ...child(1), awardDate: "2027-03-28" }, CTX);
    const next = await certSvc.issueCertificate({ ...GRAD, ...child(1), awardDate: "2028-03-28" }, CTX);
    assert.equal(next.academicYear, "2027-28");
  }));

test("achievements are not unique — a child may hold several in one year", () =>
  withFakeDb(async () => {
    const base = { ...GRAD, type: "achievement", ...child(1) };
    const a = await certSvc.issueCertificate({ ...base, title: "Star of the Month" }, CTX);
    const b = await certSvc.issueCertificate({ ...base, title: "Best Reader" }, CTX);
    assert.notEqual(a.certificateId, b.certificateId);
    assert.equal(a.type, "achievement");
    assert.equal(b.title, "Best Reader");
  }));

test("revoking a graduation frees the slot for a corrected replacement", () =>
  withFakeDb(async () => {
    const wrong = await certSvc.issueCertificate({ ...GRAD, ...child(1), studentName: "Chidl 1" }, CTX);
    await certSvc.revokeCertificate(wrong.certificateId, "name misspelt", CTX);

    const fixed = await certSvc.issueCertificate({ ...GRAD, ...child(1) }, CTX);
    assert.equal(fixed.studentName, "Child 1");
    assert.equal(fixed.status, "issued");
  }));

// ── Bulk issue ────────────────────────────────────────────────────────────────

test("bulk issue numbers a whole class in one contiguous block", () =>
  withFakeDb(async () => {
    const students = [1, 2, 3, 4, 5].map(n => child(n));
    const { issued, skipped, batchId } = await certSvc.issueBulk({ ...GRAD, students }, CTX);

    assert.equal(issued.length, 5);
    assert.equal(skipped.length, 0);
    assert.deepEqual(issued.map(c => c.serialSeq), [1, 2, 3, 4, 5]);
    assert.ok(batchId, "a bulk issue is grouped by batchId so the set can be reprinted together");
    assert.ok(issued.every(c => c.batchId === batchId));
    assert.ok(issued.every(c => c.status === "issued" && c.issuedBy === "user-admin"));
  }));

test("bulk issue skips the child who already has one and still issues the rest", () =>
  withFakeDb(async () => {
    await certSvc.issueCertificate({ ...GRAD, ...child(3) }, CTX);

    const students = [1, 2, 3, 4].map(n => child(n));
    const { issued, skipped } = await certSvc.issueBulk({ ...GRAD, students }, CTX);

    assert.equal(issued.length, 3, "one child already had a certificate; the other three must go through");
    assert.equal(skipped.length, 1);
    assert.equal(skipped[0].studentId, "YD003");
    assert.equal(skipped[0].reason, "already_issued");
    assert.equal(skipped[0].serialNumber, "YD/2026-27/0001");
    assert.ok(!issued.some(c => c.studentId === "YD003"));
  }));

test("bulk issue collapses a student listed twice in the same request", () =>
  withFakeDb(async () => {
    const students = [child(1), child(2), child(1)];
    const { issued, skipped } = await certSvc.issueBulk({ ...GRAD, students }, CTX);

    assert.equal(issued.length, 2);
    assert.equal(skipped.length, 1);
    assert.equal(skipped[0].reason, "duplicate_in_request");
  }));

test("bulk issue validates every row before reserving any serial", () =>
  withFakeDb(async () => {
    const students = [child(1), child(2, { studentName: "" }), child(3)];
    await assert.rejects(() => certSvc.issueBulk({ ...GRAD, students }, CTX), /studentName is required/);

    // Nothing was written and no serial was consumed.
    const rows = await certSvc.listCertificates({}, CTX);
    assert.equal(rows.length, 0);
    const after = await certSvc.issueCertificate({ ...GRAD, ...child(9) }, CTX);
    assert.equal(after.serialSeq, 1);
  }));

test("bulk issue refuses an empty list and an oversized one", () =>
  withFakeDb(async () => {
    await assert.rejects(() => certSvc.issueBulk({ ...GRAD, students: [] }, CTX), /non-empty array/);
    const tooMany = Array.from({ length: certSvc.MAX_BULK + 1 }, (_, i) => child(i));
    await assert.rejects(() => certSvc.issueBulk({ ...GRAD, students: tooMany }, CTX), /more than/);
  }));

// ── The historical-document guarantee ─────────────────────────────────────────

test("studentName and className are frozen onto the certificate at issue time", () =>
  withFakeDb(async (fake) => {
    const cert = await certSvc.issueCertificate({ ...GRAD, ...child(1) }, CTX);

    // The child moves class and the class itself is renamed for the new year.
    fake.seed("students", "YD001", { studentName: "Child One (Nursery)", classId: "CLS-NUR" });
    fake.seed("classes", "CLS-PG", { className: "Pre-Primary 1" });

    const reread = await certSvc.getCertificate(cert.certificateId, CTX);
    assert.equal(reread.studentName, "Child 1", "the reprint must read what it read on the day");
    assert.equal(reread.className,   "Playgroup");
  }));

// ── Editing and revoking ──────────────────────────────────────────────────────

test("an issued certificate can no longer be edited", () =>
  withFakeDb(async () => {
    const cert = await certSvc.issueCertificate({ ...GRAD, ...child(1) }, CTX);
    await assert.rejects(
      () => certSvc.updateCertificate(cert.certificateId, { title: "Oops" }, CTX),
      (err) => {
        assert.equal(err.status, 409);
        assert.equal(err.code, "CERTIFICATE_NOT_EDITABLE");
        return true;
      },
    );
  }));

test("a draft can be reworded and then promoted to issued", () =>
  withFakeDb(async () => {
    const draft = await certSvc.issueCertificate({ ...GRAD, ...child(1), status: "draft" }, CTX);
    assert.equal(draft.status, "draft");
    assert.equal(draft.issuedBy, "", "a draft has not been issued by anyone yet");

    const edited = await certSvc.updateCertificate(
      draft.certificateId, { citation: "has completed Playgroup with distinction" }, CTX,
    );
    assert.equal(edited.citation, "has completed Playgroup with distinction");

    const issued = await certSvc.updateCertificate(draft.certificateId, { status: "issued" }, CTX);
    assert.equal(issued.status, "issued");
    assert.equal(issued.issuedBy, "user-admin");
  }));

test("revoke is soft — the row stays in the register, stamped with who and why", () =>
  withFakeDb(async (fake) => {
    const cert = await certSvc.issueCertificate({ ...GRAD, ...child(1) }, CTX);
    const revoked = await certSvc.revokeCertificate(cert.certificateId, "issued to the wrong child", CTX);

    assert.equal(revoked.status, "revoked");
    assert.equal(revoked.revokedBy, "user-admin");
    assert.equal(revoked.revokeReason, "issued to the wrong child");
    assert.ok(revoked.revokedAt);
    assert.ok(fake.peek("certificates", cert.certificateId), "the document must not be deleted");

    const rows = await certSvc.listCertificates({}, CTX);
    assert.equal(rows.length, 1, "a revoked certificate still appears in the register");
  }));

// ── Tenant isolation ──────────────────────────────────────────────────────────

test("a certificate from another school reads as 404, never 403", () =>
  withFakeDb(async () => {
    const mine = await certSvc.issueCertificate({ ...GRAD, ...child(1) }, CTX);

    await assert.rejects(
      () => certSvc.getCertificate(mine.certificateId, OTHER),
      (err) => {
        assert.equal(err.status, 404, "403 would confirm the certificate exists");
        assert.equal(err.code, "CERTIFICATE_NOT_FOUND");
        return true;
      },
    );
  }));

test("the register never includes another school's certificates", () =>
  withFakeDb(async () => {
    await certSvc.issueCertificate({ ...GRAD, ...child(1) }, CTX);
    await certSvc.issueCertificate({ ...GRAD, ...child(2) }, OTHER);

    const mine   = await certSvc.listCertificates({}, CTX);
    const theirs = await certSvc.listCertificates({}, OTHER);

    assert.equal(mine.length, 1);
    assert.equal(theirs.length, 1);
    assert.equal(mine[0].studentId,   "YD001");
    assert.equal(theirs[0].studentId, "YD002");
  }));

test("two schools issuing the same serial land on different documents", () =>
  withFakeDb(async (fake) => {
    // Counters are per school per year, so both of these are seq 1 for 2026-27.
    // A document id built from year+seq alone would make the second write
    // overwrite the first school's certificate.
    const a = await certSvc.issueCertificate({ ...GRAD, ...child(1) }, CTX);
    const b = await certSvc.issueCertificate({ ...GRAD, ...child(2) }, OTHER);

    assert.equal(a.serialNumber, b.serialNumber, "the serials are genuinely the same string");
    assert.notEqual(a.certificateId, b.certificateId, "but the documents must not collide");
    assert.equal(fake.all("certificates").length, 2);
  }));

test("revoking across the school boundary is refused as not-found", () =>
  withFakeDb(async () => {
    const mine = await certSvc.issueCertificate({ ...GRAD, ...child(1) }, CTX);
    await assert.rejects(() => certSvc.revokeCertificate(mine.certificateId, "nope", OTHER), /not found/i);

    const still = await certSvc.getCertificate(mine.certificateId, CTX);
    assert.equal(still.status, "issued", "the other school's attempt must not have changed anything");
  }));

// ── Filtering and summary ─────────────────────────────────────────────────────

test("the register filters by type, status, class and date range", () =>
  withFakeDb(async () => {
    await certSvc.issueCertificate({ ...GRAD, ...child(1) }, CTX);
    await certSvc.issueCertificate({ ...GRAD, type: "achievement", ...child(2), awardDate: "2026-09-10" }, CTX);
    const third = await certSvc.issueCertificate({ ...GRAD, type: "participation", ...child(3, { classId: "CLS-NUR" }) }, CTX);
    await certSvc.revokeCertificate(third.certificateId, "event cancelled", CTX);

    assert.equal((await certSvc.listCertificates({ type: "achievement" }, CTX)).length, 1);
    assert.equal((await certSvc.listCertificates({ status: "revoked" }, CTX)).length, 1);
    assert.equal((await certSvc.listCertificates({ classId: "CLS-PG" }, CTX)).length, 2);
    assert.equal((await certSvc.listCertificates({ from: "2027-01-01" }, CTX)).length, 2);
    assert.equal((await certSvc.listCertificates({ to: "2026-12-31" }, CTX)).length, 1);
  }));

test("the register is sorted newest award first", () =>
  withFakeDb(async () => {
    await certSvc.issueCertificate({ ...GRAD, ...child(1), awardDate: "2026-09-10" }, CTX);
    await certSvc.issueCertificate({ ...GRAD, ...child(2), awardDate: "2027-03-28" }, CTX);
    await certSvc.issueCertificate({ ...GRAD, ...child(3), awardDate: "2026-12-01" }, CTX);

    const rows = await certSvc.listCertificates({}, CTX);
    assert.deepEqual(rows.map(r => r.awardDate), ["2027-03-28", "2026-12-01", "2026-09-10"]);
  }));

// ── Attendance-award eligibility ──────────────────────────────────────────────

/**
 * fakeFirestore only implements "==" filters, and the eligibility query uses a
 * date RANGE (which is the right query for production — it keeps the read off
 * a full-collection scan). So this one path gets a purpose-built stub that
 * honours >= and <=, and asserts the range is actually applied rather than
 * filtered in JS afterwards.
 */
function withAttendance(records, fn) {
  const saved = db.collection;
  const applied = [];

  function makeQuery(filters) {
    return {
      where: (field, op, value) => makeQuery([...filters, [field, op, value]]),
      get: async () => {
        applied.push(...filters);
        const docs = records.filter(r => filters.every(([f, op, v]) => {
          if (op === "==") return r[f] === v;
          if (op === ">=") return r[f] >= v;
          if (op === "<=") return r[f] <= v;
          throw new Error(`unexpected operator ${op}`);
        })).map(r => ({ id: r.entryId || "x", data: () => ({ ...r }) }));
        return { empty: docs.length === 0, docs };
      },
    };
  }

  db.collection = (name) => {
    assert.equal(name, "attendance", "eligibility must read the attendance collection");
    return { where: (f, op, v) => makeQuery([[f, op, v]]) };
  };

  return (async () => {
    try { return await fn(applied); }
    finally { db.collection = saved; }
  })();
}

function att(studentId, date, status, over = {}) {
  return {
    entryId: `ATT-${date}-${studentId}`,
    schoolId: "school-a", studentId, studentName: `Child ${studentId.slice(-1)}`,
    class: "CLS-PG", date, status, centerId: "centre-1", ...over,
  };
}

test("attendance eligibility finds the children at 100% and leaves out the rest", () => {
  const records = [
    att("YD001", "2026-11-02", "Present"), att("YD001", "2026-11-03", "Present"),
    att("YD001", "2026-11-04", "Present"), att("YD001", "2026-11-05", "Present"),
    att("YD002", "2026-11-02", "Present"), att("YD002", "2026-11-03", "Absent"),
    att("YD002", "2026-11-04", "Present"), att("YD002", "2026-11-05", "Present"),
  ];

  return withAttendance(records, async () => {
    const { eligible, considered, threshold } = await certSvc.getAttendanceEligibility(
      { from: "2026-11-01", to: "2026-11-30" }, CTX,
    );

    assert.equal(threshold, 100);
    assert.equal(considered, 2);
    assert.equal(eligible.length, 1);
    assert.equal(eligible[0].studentId, "YD001");
    assert.equal(eligible[0].percent, 100);
  });
});

test("a late child still counts as having attended", () =>
  withAttendance([
    att("YD001", "2026-11-02", "Late"), att("YD001", "2026-11-03", "Present"),
  ], async () => {
    const { eligible } = await certSvc.getAttendanceEligibility({ from: "2026-11-01", to: "2026-11-30" }, CTX);
    assert.equal(eligible.length, 1, "an award that punishes the parent's traffic is not the award anyone means");
    assert.equal(eligible[0].percent, 100);
  }));

test("a lower threshold lets a 75% child through, and the percentage is reported", () =>
  withAttendance([
    att("YD002", "2026-11-02", "Present"), att("YD002", "2026-11-03", "Absent"),
    att("YD002", "2026-11-04", "Present"), att("YD002", "2026-11-05", "Present"),
  ], async () => {
    const strict = await certSvc.getAttendanceEligibility({ from: "2026-11-01", to: "2026-11-30" }, CTX);
    assert.equal(strict.eligible.length, 0);

    const relaxed = await certSvc.getAttendanceEligibility(
      { from: "2026-11-01", to: "2026-11-30", threshold: 75 }, CTX,
    );
    assert.equal(relaxed.eligible.length, 1);
    assert.equal(relaxed.eligible[0].percent, 75);
  }));

test("eligibility pushes the date range into the query and scopes it by school", () =>
  withAttendance([att("YD001", "2026-11-02", "Present")], async (applied) => {
    await certSvc.getAttendanceEligibility({ from: "2026-11-01", to: "2026-11-30" }, CTX);

    const ops = applied.map(([f, op]) => `${f}${op}`);
    assert.ok(ops.includes("schoolId=="), "the read must be scoped to the caller's school");
    assert.ok(ops.includes("date>="), "the date range belongs in the query, not in a post-filter");
    assert.ok(ops.includes("date<="));
    const school = applied.find(([f]) => f === "schoolId");
    assert.equal(school[2], "school-a");
  }));

test("eligibility can be narrowed to one class", () =>
  withAttendance([
    att("YD001", "2026-11-02", "Present"),
    att("YD003", "2026-11-02", "Present", { class: "CLS-NUR" }),
  ], async () => {
    const all = await certSvc.getAttendanceEligibility({ from: "2026-11-01", to: "2026-11-30" }, CTX);
    assert.equal(all.eligible.length, 2);

    const pg = await certSvc.getAttendanceEligibility(
      { from: "2026-11-01", to: "2026-11-30", classId: "CLS-PG" }, CTX,
    );
    assert.equal(pg.eligible.length, 1);
    assert.equal(pg.eligible[0].studentId, "YD001");
  }));

test("eligibility ignores another centre's attendance when the caller is centre-scoped", () =>
  withAttendance([
    att("YD001", "2026-11-02", "Present"),
    att("YD004", "2026-11-02", "Present", { centerId: "centre-2" }),
  ], async () => {
    const { eligible } = await certSvc.getAttendanceEligibility({ from: "2026-11-01", to: "2026-11-30" }, CTX);
    assert.deepEqual(eligible.map(e => e.studentId), ["YD001"]);
  }));

test("eligibility rejects a missing, malformed or reversed date range", () =>
  withAttendance([], async () => {
    await assert.rejects(() => certSvc.getAttendanceEligibility({ from: "2026-11-01" }, CTX), /ISO dates/);
    await assert.rejects(() => certSvc.getAttendanceEligibility({ from: "01-11-2026", to: "2026-11-30" }, CTX), /ISO dates/);
    await assert.rejects(() => certSvc.getAttendanceEligibility({ from: "2026-11-30", to: "2026-11-01" }, CTX), /must not be after/);
    await assert.rejects(
      () => certSvc.getAttendanceEligibility({ from: "2026-11-01", to: "2026-11-30", threshold: 0 }, CTX),
      /percentage between 1 and 100/,
    );
  }));

test("minDays keeps a child with one lucky day out of a 100% award", () =>
  withAttendance([
    att("YD001", "2026-11-02", "Present"), att("YD001", "2026-11-03", "Present"),
    att("YD001", "2026-11-04", "Present"), att("YD001", "2026-11-05", "Present"),
    att("YD005", "2026-11-05", "Present"),   // joined on the last day
  ], async () => {
    const loose = await certSvc.getAttendanceEligibility({ from: "2026-11-01", to: "2026-11-30" }, CTX);
    assert.equal(loose.eligible.length, 2, "both are at 100% of the days they were marked for");

    const fair = await certSvc.getAttendanceEligibility(
      { from: "2026-11-01", to: "2026-11-30", minDays: 4 }, CTX,
    );
    assert.deepEqual(fair.eligible.map(e => e.studentId), ["YD001"]);
  }));

test("summary counts exclude revoked rows from the per-type totals", () =>
  withFakeDb(async () => {
    await certSvc.issueCertificate({ ...GRAD, ...child(1) }, CTX);
    await certSvc.issueCertificate({ ...GRAD, type: "achievement", ...child(2) }, CTX);
    const gone = await certSvc.issueCertificate({ ...GRAD, type: "achievement", ...child(3) }, CTX);
    await certSvc.revokeCertificate(gone.certificateId, "duplicate", CTX);
    await certSvc.issueCertificate({ ...GRAD, type: "attendance", ...child(4), status: "draft" }, CTX);

    const s = await certSvc.getSummary({}, CTX);
    assert.equal(s.total, 4);
    assert.equal(s.issued, 2, "two issued, one revoked, one still a draft");
    assert.equal(s.drafts, 1);
    assert.equal(s.revoked, 1);
    assert.equal(s.byType.graduation, 1);
    assert.equal(s.byType.achievement, 1, "the revoked achievement must not be counted");
    assert.equal(s.byType.attendance, 1);
    assert.equal(s.byType.participation, 0);
  }));
