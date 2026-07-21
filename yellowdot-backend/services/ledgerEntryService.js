/**
 * ledgerEntryService.js — Finance Foundation: Ledger Entry
 * ────────────────────────────────────────────────────────────────────
 * Collection: ledgerEntries/{entryId}
 *
 * Append-only, immutable by design (Domain Architecture Part 1 & 6):
 * there is deliberately NO update or delete function exported here, and
 * none should ever be added — a correction is always a new, offsetting
 * entry. This mirrors and extends the existing platform precedent that
 * `payments` are already immutable-by-rule ("payments are generally
 * immutable — only admins may correct").
 *
 * Every entry atomically updates its Student Ledger's currentBalance in
 * the same Firestore transaction that creates the entry, so the two can
 * never drift out of sync under concurrent writes.
 *
 * NOTE: this service intentionally does NOT require studentLedgerService
 * (which requires this file) — it talks to the studentLedgers collection
 * directly to avoid a circular dependency, and because "update the ledger
 * balance" is really part of this service's own responsibility, not a
 * cross-service call.
 *
 * Publishes LedgerEntryCreated (financeEventPublisher.js) after every
 * successful entry — added when the LedgerEntryService contract was
 * frozen, to match the Audit Requirements every other Finance Foundation
 * contract already specifies. auditSvc/eventPublisher are required as
 * whole modules (not destructured) so their functions stay mockable in
 * tests the same way financeTransaction.js's already are.
 */
const { db }   = require("../firebaseAdmin");
const auditSvc       = require("./financeAuditService");
const eventPublisher = require("./financeEventPublisher");

const SCHOOL_ID   = process.env.SCHOOL_ID || "yd-main";
const entriesCol  = () => db.collection("ledgerEntries");
const ledgersCol  = () => db.collection("studentLedgers");
const nowISO      = () => new Date().toISOString();

const ENTRY_TYPES = new Set([
  "charge", "payment", "discount", "scholarship", "adjustment", "refund", "lateFee", "creditApplied",
]);

// Direction each type contributes to the balance. "adjustment" is the one
// type where the caller supplies the sign explicitly (a manual correction
// can go either way) — every other type has a fixed, non-overridable sign
// so a caller can never accidentally credit a "charge" or vice versa.
const FIXED_SIGN = {
  charge:         +1,
  lateFee:        +1,
  payment:        -1,
  discount:       -1,
  scholarship:    -1,
  refund:         -1,
  creditApplied:  -1,
};

function _nextEntryId() {
  // Time-ordered but not the sole authorization boundary — every read
  // still goes through a schoolId-scoped query, per SECURITY_ARCHITECTURE.md.
  return `LDG-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function docToEntry(snap) {
  const d  = snap.data ? snap.data() : snap;
  const id = snap.id   || d.entryId || "";
  return {
    entryId:         d.entryId         || id,
    schoolId:        d.schoolId        || SCHOOL_ID,
    centerId:        d.centerId        || "",
    studentLedgerId: d.studentLedgerId || "",
    type:            d.type            || "adjustment",
    amount:          Number(d.amount || 0),
    signedAmount:    Number(d.signedAmount || 0),
    feeComponentId:  d.feeComponentId  || "",
    description:     d.description     || "",
    sourceType:      d.sourceType      || "manual",
    sourceId:        d.sourceId        || "",
    createdAt:       d.createdAt       || "",
    createdBy:       d.createdBy       || "",
  };
}

/**
 * createEntry — the ONLY way a Ledger Entry is ever written, and the
 * only way a Student Ledger's currentBalance ever changes.
 *
 * For type === "adjustment", `signedAmountOverride` must be supplied
 * (positive or negative) since an adjustment's direction is a manual
 * decision, not a fixed rule.
 */
async function createEntry(studentId, data, { schoolId = SCHOOL_ID, centerId = "", actorUserId = "system" } = {}) {
  if (!studentId) { const e = new Error("studentId is required.");            e.code = "VALIDATION"; throw e; }
  if (!ENTRY_TYPES.has(data.type)) { const e = new Error(`Invalid entry type "${data.type}".`); e.code = "VALIDATION"; throw e; }

  const amount = Number(data.amount);
  if (!isFinite(amount) || amount <= 0) { const e = new Error("amount must be a positive number."); e.code = "VALIDATION"; throw e; }

  let signedAmount;
  if (data.type === "adjustment") {
    if (data.signedAmountOverride === undefined) {
      const e = new Error("adjustment entries require signedAmountOverride."); e.code = "VALIDATION"; throw e;
    }
    signedAmount = Number(data.signedAmountOverride);
  } else {
    signedAmount = amount * FIXED_SIGN[data.type];
  }

  const ledgerRef = ledgersCol().doc(studentId);
  const entryId   = _nextEntryId();
  const entryRef  = entriesCol().doc(entryId);

  const entryDoc = {
    entryId, schoolId, centerId,
    studentLedgerId: studentId,
    type:            data.type,
    amount,
    signedAmount,
    feeComponentId:  data.feeComponentId || "",
    description:     data.description    || "",
    sourceType:       data.sourceType     || "manual",
    sourceId:         data.sourceId       || "",
    createdAt:        nowISO(),
    createdBy:        actorUserId,
  };

  let newBalance = null;
  await db.runTransaction(async (tx) => {
    const ledgerSnap = await tx.get(ledgerRef);
    if (!ledgerSnap.exists) {
      const e = new Error(`No ledger exists for student ${studentId} — create one first.`);
      e.code = "VALIDATION"; throw e;
    }
    const ledgerData = ledgerSnap.data();
    if (ledgerData.schoolId !== schoolId) {
      const e = new Error("Not found."); e.code = "NOT_FOUND"; throw e; // hide, don't reveal
    }
    if (ledgerData.status !== "active") {
      const e = new Error(`Ledger is ${ledgerData.status} — cannot post new entries.`); e.code = "VALIDATION"; throw e;
    }

    newBalance = Number(ledgerData.currentBalance || 0) + signedAmount;
    tx.set(entryRef, entryDoc);
    tx.update(ledgerRef, { currentBalance: newBalance, updatedAt: nowISO() });
  });

  await auditSvc.logFinanceAudit({
    schoolId, actorUserId,
    action: `ledgerEntry.create.${data.type}`, entityType: "ledgerEntry", entityId: entryId,
    meta: { studentId, amount, signedAmount, newBalance },
  });

  eventPublisher.publish(eventPublisher.EVENTS.LEDGER_ENTRY_CREATED, {
    schoolId, centerId, studentLedgerId: studentId, entryId,
    type: data.type, amount, signedAmount, newBalance, actorUserId,
  });

  return { entry: entryDoc, newBalance };
}

async function listForLedger(studentId, { schoolId = SCHOOL_ID, limit = 100 } = {}) {
  const snap = await entriesCol()
    .where("schoolId",        "==", schoolId)
    .where("studentLedgerId", "==", studentId)
    .get();
  return snap.docs
    .map(docToEntry)
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
    .slice(0, limit);
}

module.exports = { createEntry, listForLedger, ENTRY_TYPES };
