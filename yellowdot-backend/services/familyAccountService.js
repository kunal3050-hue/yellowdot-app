/**
 * familyAccountService.js — Finance Foundation: Family Account (extension)
 * ────────────────────────────────────────────────────────────────────
 * Extends the EXISTING `families/{familyId}` document — does not create a
 * parallel collection. Adds a `financeAccount` sub-object:
 *   { creditBalance, paymentAllocationPreference, createdAt, updatedAt }
 *
 * Sprint 1 scope: get/initialize the finance facet and adjust its credit
 * balance. Does NOT compute a consolidated outstanding balance across
 * student ledgers yet — that aggregation depends on real invoice/ledger
 * data flowing through Billing Plans (Sprint 2+), and is explicitly out
 * of scope ("do not migrate production data", "do not enable recurring
 * billing").
 *
 * Deliberately does not import or modify familyService.js — this file
 * talks to the `families` collection directly for just the finance
 * facet, so the existing family module's own code path is untouched.
 */
const { db }              = require("../firebaseAdmin");
const { logFinanceAudit } = require("./financeAuditService");
const { publish, EVENTS } = require("./financeEventPublisher");

const SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";
const col       = () => db.collection("families");
const nowISO    = () => new Date().toISOString();

const ALLOCATION_PREFS = new Set(["oldestDueFirst", "manual"]);

function _defaultFinanceAccount() {
  return {
    creditBalance:               0,
    paymentAllocationPreference: "oldestDueFirst",
    createdAt:                   nowISO(),
    updatedAt:                   nowISO(),
  };
}

function _toFinanceAccount(family) {
  const fa = family?.financeAccount;
  return {
    creditBalance:               Number(fa?.creditBalance || 0),
    paymentAllocationPreference: ALLOCATION_PREFS.has(fa?.paymentAllocationPreference)
      ? fa.paymentAllocationPreference
      : "oldestDueFirst",
    createdAt: fa?.createdAt || "",
    updatedAt: fa?.updatedAt || "",
  };
}

/** Fetch the family's finance facet, or null if the family itself doesn't exist / isn't in this tenant. */
async function getFinanceAccount(familyId, { schoolId = SCHOOL_ID } = {}) {
  const snap = await col().doc(familyId).get();
  if (!snap.exists) return null;
  const family = snap.data();
  if (family.schoolId !== schoolId) return null; // hide, don't reveal
  return { familyId, ...( _toFinanceAccount(family) ), studentIds: family.studentIds || [] };
}

/**
 * listWithCredit — school-wide browse of every family that has an
 * initialized finance facet, for the Dashboard's "Family Credits" KPI and
 * the Family Account screen. Additive: does not touch getFinanceAccount's
 * frozen single-family contract. Single-field equality query on schoolId
 * (the one index Firestore creates automatically); families with no
 * financeAccount sub-object at all are filtered out in-memory.
 */
async function listWithCredit({ schoolId = SCHOOL_ID } = {}) {
  const snap = await col().where("schoolId", "==", schoolId).get();
  return snap.docs
    .map(d => ({ familyId: d.id, family: d.data() }))
    .filter(({ family }) => Boolean(family.financeAccount))
    .map(({ familyId, family }) => ({ familyId, ..._toFinanceAccount(family), studentIds: family.studentIds || [] }));
}

/**
 * ensureFinanceAccount — idempotent: adds the financeAccount sub-object
 * to an existing family doc if it doesn't have one yet. Never overwrites
 * an existing financeAccount (matches StudentAdmitted's "reuse, never
 * duplicate" rule for the family as a whole).
 */
async function ensureFinanceAccount(familyId, { schoolId = SCHOOL_ID, actorUserId = "system" } = {}) {
  const ref  = col().doc(familyId);
  const snap = await ref.get();
  if (!snap.exists) { const e = new Error("Family not found."); e.code = "VALIDATION"; throw e; }

  const family = snap.data();
  if (family.schoolId !== schoolId) { const e = new Error("Not found."); e.code = "NOT_FOUND"; throw e; }

  if (family.financeAccount) {
    return { familyId, ..._toFinanceAccount(family), studentIds: family.studentIds || [] };
  }

  const financeAccount = _defaultFinanceAccount();
  await ref.update({ financeAccount });

  await logFinanceAudit({
    schoolId, actorUserId,
    action: "familyAccount.create", entityType: "familyAccount", entityId: familyId,
  });

  publish(EVENTS.FAMILY_ACCOUNT_CREATED, { schoolId, familyId, actorUserId });

  return { familyId, ...financeAccount, studentIds: family.studentIds || [] };
}

/**
 * adjustCreditBalance — the only way the family-level shared credit/wallet
 * balance changes. delta may be positive (credit issued) or negative
 * (credit consumed against an invoice) — always via a Firestore
 * transaction to avoid a lost-update race between two concurrent
 * adjustments (e.g. a refund and a payment landing at the same time).
 */
async function adjustCreditBalance(familyId, delta, { schoolId = SCHOOL_ID, actorUserId = "system", reason = "" } = {}) {
  const amount = Number(delta);
  if (!isFinite(amount) || amount === 0) {
    const e = new Error("delta must be a non-zero number."); e.code = "VALIDATION"; throw e;
  }

  const ref = col().doc(familyId);
  let newBalance = null;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) { const e = new Error("Family not found."); e.code = "VALIDATION"; throw e; }
    const family = snap.data();
    if (family.schoolId !== schoolId) { const e = new Error("Not found."); e.code = "NOT_FOUND"; throw e; }

    const current  = Number(family.financeAccount?.creditBalance || 0);
    newBalance     = current + amount;
    if (newBalance < 0) { const e = new Error("Credit balance cannot go negative."); e.code = "VALIDATION"; throw e; }

    tx.update(ref, {
      "financeAccount.creditBalance": newBalance,
      "financeAccount.updatedAt":     nowISO(),
    });
  });

  await logFinanceAudit({
    schoolId, actorUserId,
    action: "familyAccount.adjustCredit", entityType: "familyAccount", entityId: familyId,
    meta: { delta: amount, newBalance, reason },
  });

  return { familyId, creditBalance: newBalance };
}

module.exports = { getFinanceAccount, listWithCredit, ensureFinanceAccount, adjustCreditBalance, ALLOCATION_PREFS };
