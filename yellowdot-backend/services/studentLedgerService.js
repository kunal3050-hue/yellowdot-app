/**
 * studentLedgerService.js — Finance Foundation: Student Ledger
 * ────────────────────────────────────────────────────────────────────
 * Collection: studentLedgers/{studentId}  — doc ID IS the studentId (1:1,
 * so "does this student have a ledger" is a single get(), never a query).
 *
 * Sprint 1 scope: the ledger itself, its status lifecycle, and its
 * running balance. Ledger Entries are owned by ledgerEntryService.js —
 * this file never writes an entry, only reads them back for listing.
 *
 * Tenant-safe: every document carries schoolId, centerId. Every write
 * goes through financeAuditService.logFinanceAudit().
 *
 * NOT wired to admission yet (Sprint 2) — createLedger() is exposed via
 * a manual, staff-triggered endpoint for this sprint only.
 */
const { db }               = require("../firebaseAdmin");
const { logFinanceAudit }  = require("./financeAuditService");
const ledgerEntrySvc       = require("./ledgerEntryService");
const { publish, EVENTS }  = require("./financeEventPublisher");

const SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";
const col       = () => db.collection("studentLedgers");
const nowISO    = () => new Date().toISOString();

const STATUSES = new Set(["active", "frozen", "archived"]);

function docToLedger(snap) {
  const d  = snap.data ? snap.data() : snap;
  const id = snap.id   || d.studentId || "";
  return {
    studentId:      d.studentId      || id,
    schoolId:        d.schoolId       || SCHOOL_ID,
    centerId:        d.centerId       || "",
    familyId:        d.familyId       || "",
    status:          STATUSES.has(d.status) ? d.status : "active",
    currentBalance:  Number(d.currentBalance || 0),
    createdAt:       d.createdAt      || "",
    updatedAt:       d.updatedAt      || "",
    createdBy:       d.createdBy      || "",
    updatedBy:       d.updatedBy      || "",
  };
}

/** Fetch, or null if none exists yet. */
async function getLedger(studentId, { schoolId = SCHOOL_ID } = {}) {
  const snap = await col().doc(studentId).get();
  if (!snap.exists) return null;
  const ledger = docToLedger(snap);
  if (ledger.schoolId !== schoolId) return null; // tenant check — hide, don't reveal
  return ledger;
}

/**
 * Create a ledger for a student. Idempotent: if one already exists for
 * this student, it is returned unchanged rather than overwritten — a
 * student can only ever have one ledger, ever (Domain Architecture Part 1).
 */
async function createLedger(studentId, { schoolId = SCHOOL_ID, centerId = "", familyId = "", actorUserId = "system" } = {}) {
  if (!studentId) {
    const err = new Error("studentId is required."); err.code = "VALIDATION"; throw err;
  }

  const existing = await col().doc(studentId).get();
  if (existing.exists) {
    return docToLedger(existing); // already created — no-op, matches StudentAdmitted idempotency key (studentId)
  }

  const doc = {
    studentId,
    schoolId,
    centerId,
    familyId,
    status:         "active",
    currentBalance: 0,
    createdAt:      nowISO(),
    updatedAt:      nowISO(),
    createdBy:      actorUserId,
  };
  await col().doc(studentId).set(doc);

  await logFinanceAudit({
    schoolId, actorUserId,
    action: "studentLedger.create", entityType: "studentLedger", entityId: studentId,
  });

  publish(EVENTS.STUDENT_LEDGER_CREATED, { schoolId, centerId, studentId, familyId, actorUserId });

  return doc;
}

/** Status transitions only — freeze (settlement in progress) / archive (permanent). */
async function setStatus(studentId, status, { schoolId = SCHOOL_ID, actorUserId = "system" } = {}) {
  if (!STATUSES.has(status)) {
    const err = new Error(`Invalid ledger status "${status}".`); err.code = "VALIDATION"; throw err;
  }
  const ledger = await getLedger(studentId, { schoolId });
  if (!ledger) return null;

  await col().doc(studentId).update({ status, updatedAt: nowISO(), updatedBy: actorUserId });

  await logFinanceAudit({
    schoolId, actorUserId,
    action: `studentLedger.${status}`, entityType: "studentLedger", entityId: studentId,
  });

  return { ...ledger, status };
}

/** List entries for a ledger (delegates storage to ledgerEntryService). */
async function listEntries(studentId, { schoolId = SCHOOL_ID, limit = 100 } = {}) {
  const ledger = await getLedger(studentId, { schoolId });
  if (!ledger) return [];
  return ledgerEntrySvc.listForLedger(studentId, { schoolId, limit });
}

module.exports = { getLedger, createLedger, setStatus, listEntries, STATUSES };
