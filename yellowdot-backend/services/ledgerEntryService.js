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
 *
 * Idempotency (Sprint 3, M3.1): a caller MAY supply data.sourceType +
 * data.sourceId (both already-existing fields, not a new concept) as a
 * natural idempotency key. When both are present, createEntry() checks —
 * inside the same Firestore transaction that would otherwise write the
 * entry — whether an entry already exists for
 * (schoolId, studentLedgerId, sourceType, sourceId), and if so, returns
 * that existing entry and the ledger's current balance unchanged rather
 * than posting a duplicate. This is a hard prerequisite for any
 * retry-capable producer (invoice generation, a payment gateway webhook,
 * the future billing scheduler) per the Sprint 3 plan.
 *
 * When sourceType/sourceId are NOT both supplied — every Sprint 1/2
 * caller today — behavior is exactly as before this change: always
 * creates a new entry. This preserves the existing 41 Finance Foundation
 * tests' expectations without requiring any of them to change.
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
//
// "refund" is +1, not -1 — per ADR-0002 (docs/finance-design/adr/0002-
// refund-ledger-entry-sign-convention.md). The Student Ledger is an
// outstanding-balance ledger, not a cash-flow ledger: a refund gives
// money back that a payment had already reduced the balance by, so it
// must move the balance the same direction as a charge, not a payment.
const FIXED_SIGN = {
  charge:         +1,
  lateFee:        +1,
  refund:         +1,
  payment:        -1,
  discount:       -1,
  scholarship:    -1,
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

  const hasIdempotencyKey = Boolean(data.sourceType && data.sourceId);

  let newBalance    = null;
  let duplicateOf    = null; // set if an idempotency check finds an existing entry

  await db.runTransaction(async (tx) => {
    if (hasIdempotencyKey) {
      const dupQuery = entriesCol()
        .where("schoolId",        "==", schoolId)
        .where("studentLedgerId", "==", studentId)
        .where("sourceType",      "==", data.sourceType)
        .where("sourceId",        "==", data.sourceId)
        .limit(1);
      const dupSnap = await tx.get(dupQuery);
      if (!dupSnap.empty) {
        duplicateOf = docToEntry(dupSnap.docs[0]);
        const ledgerSnap = await tx.get(ledgerRef);
        newBalance = ledgerSnap.exists ? Number(ledgerSnap.data().currentBalance || 0) : null;
        return; // short-circuit — do not post a second entry or touch the balance
      }
    }

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

  if (duplicateOf) {
    // Idempotent no-op: log that a duplicate was detected (useful for ops/
    // retry visibility) but do NOT publish LedgerEntryCreated again — no
    // new financial fact occurred, so no new event should claim one did.
    await auditSvc.logFinanceAudit({
      schoolId, actorUserId,
      action: `ledgerEntry.duplicate.${data.type}`, entityType: "ledgerEntry", entityId: duplicateOf.entryId,
      meta: { studentId, sourceType: data.sourceType, sourceId: data.sourceId, newBalance },
    });
    return { entry: duplicateOf, newBalance, duplicate: true };
  }

  await auditSvc.logFinanceAudit({
    schoolId, actorUserId,
    action: `ledgerEntry.create.${data.type}`, entityType: "ledgerEntry", entityId: entryId,
    meta: { studentId, amount, signedAmount, newBalance },
  });

  eventPublisher.publish(eventPublisher.EVENTS.LEDGER_ENTRY_CREATED, {
    schoolId, centerId, studentLedgerId: studentId, entryId,
    type: data.type, amount, signedAmount, newBalance, actorUserId,
  });

  return { entry: entryDoc, newBalance, duplicate: false };
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
