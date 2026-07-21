/**
 * financeCreditConsumptionService.js — Finance Foundation: Credit Balance
 * Consumption (Sprint 4, M4.4)
 * ────────────────────────────────────────────────────────────────────
 * The *spend* side of the credit balance M4.2 starts *crediting* —
 * before a new charge requires a fresh payment, auto-apply available
 * Family Account credit as a `type: "creditApplied"` Ledger Entry
 * (already a valid, correctly-signed entry type since Sprint 1, never
 * posted by any caller until now).
 *
 * Natural integration point for both a future Sprint 4+ payment-flow
 * caller and M3.4's invoice generation (a family with existing credit
 * shouldn't need a fresh payment for a small new charge) — this
 * milestone builds the reusable function; wiring it into M3.4 itself is
 * a small follow-up once this exists, not bundled into this milestone,
 * per the Sprint 4 plan's own note (keeps every milestone independently
 * deployable).
 *
 * No new Firestore collection or field — reuses `familyAccountService`'s
 * existing, already-transactional `adjustCreditBalance()` (which already
 * rejects a negative result) and `ledgerEntryService`'s existing
 * `creditApplied` entry type verbatim.
 */
const auditSvc         = require("./financeAuditService");
const familyAccountSvc = require("./familyAccountService");
const ledgerEntrySvc   = require("./ledgerEntryService");

const SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";

function _round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/**
 * applyAvailableCredit — applies up to `amount` of a family's available
 * credit balance against a specific student's outstanding charge.
 * Applies at most `min(available credit, amount)` — never more than
 * either bound — and returns how much of `amount` still needs to be
 * covered by a fresh payment.
 *
 * `sourceId` (typically the Invoice or charge being covered) makes this
 * call idempotent via `ledgerEntryService`'s existing M3.1 machinery —
 * a retried call with the same `sourceId` never double-applies credit.
 */
async function applyAvailableCredit(studentId, amount, {
  schoolId = SCHOOL_ID, centerId = "", actorUserId = "system", familyId, sourceId,
} = {}) {
  if (!studentId) { const e = new Error("studentId is required."); e.code = "VALIDATION"; throw e; }
  if (!familyId)  { const e = new Error("familyId is required."); e.code = "VALIDATION"; throw e; }
  const roundedAmount = _round2(amount);
  if (!isFinite(roundedAmount) || roundedAmount <= 0) {
    const e = new Error("amount must be a positive number."); e.code = "VALIDATION"; throw e;
  }
  if (!sourceId) { const e = new Error("sourceId is required for idempotent credit application."); e.code = "VALIDATION"; throw e; }

  const financeAccount = await familyAccountSvc.getFinanceAccount(familyId, { schoolId });
  if (!financeAccount) { const e = new Error("Family account not found."); e.code = "VALIDATION"; throw e; }

  const creditApplied = Math.min(financeAccount.creditBalance, roundedAmount);

  if (creditApplied <= 0) {
    return { creditApplied: 0, remainingAmount: roundedAmount, newBalance: null };
  }

  // Ledger Entry posted BEFORE the credit balance is decremented, so a
  // retry with the same sourceId is detected via createEntry()'s own
  // M3.1 dedup and safely skips re-decrementing credit. Honest tradeoff:
  // if the credit-balance decrement itself fails right after a
  // successful (non-duplicate) entry post, a retry sees `duplicate: true`
  // and will not retry the decrement either — a rare, known gap, not a
  // silently-claimed guarantee. A full fix would need a cross-service
  // transaction spanning ledgerEntries and families, out of scope here.
  const { newBalance, duplicate } = await ledgerEntrySvc.createEntry(studentId, {
    type: "creditApplied",
    amount: creditApplied,
    description: `Credit applied from Family Account ${familyId}`,
    sourceType: "creditApplication",
    sourceId,
  }, { schoolId, centerId, actorUserId });

  // A duplicate call (same sourceId) means the credit was already spent
  // on a prior attempt — do not deduct it from the Family Account twice.
  if (!duplicate) {
    await familyAccountSvc.adjustCreditBalance(familyId, -creditApplied, {
      schoolId, actorUserId, reason: `Credit applied to student ${studentId}, source ${sourceId}`,
    });
  }

  await auditSvc.logFinanceAudit({
    schoolId, actorUserId,
    action: "financeCredit.apply", entityType: "familyAccount", entityId: familyId,
    meta: { studentId, sourceId, creditApplied, duplicate },
  });

  return { creditApplied, remainingAmount: _round2(roundedAmount - creditApplied), newBalance, duplicate };
}

module.exports = { applyAvailableCredit };
