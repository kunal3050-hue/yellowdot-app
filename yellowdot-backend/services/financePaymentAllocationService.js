/**
 * financePaymentAllocationService.js — Finance Foundation: Payment
 * Allocation Engine (Sprint 4, M4.2)
 * ────────────────────────────────────────────────────────────────────
 * Allocates a recorded Payment across its Family Account's outstanding
 * Student Ledgers, using the strategy registry in
 * `financeAllocationStrategies.js` (Sprint 4 Review, Recommendation 1) —
 * this engine picks a strategy by name and calls it; it never branches
 * on strategy name itself.
 *
 * Partial payments and overpayments are not separate code paths — they
 * fall out of the same allocation call:
 *   - `oldestDueFirst` always fully disposes of the amount being
 *     allocated (settles ledgers, then any leftover becomes Family
 *     Account credit via the already-existing `adjustCreditBalance()`)
 *     — it is a self-resolving strategy by design, so a payment
 *     allocated this way always reaches `Allocated` in one call.
 *   - `manual` may deliberately leave a remainder unresolved (a staff
 *     member allocating part of a payment now, finishing the rest in a
 *     later call once more information is available) — that remainder
 *     is NOT auto-routed to credit unless the caller explicitly passes
 *     `applyLeftoverToCredit: true`. A payment allocated this way can
 *     land in `PartiallyAllocated` and be resumed by calling
 *     `allocatePayment` again for the same `paymentId`.
 *
 * Every settled ledger gets one `type: "payment"` Ledger Entry via the
 * already-idempotent `ledgerEntryService.createEntry()` (M3.1), keyed
 * `sourceType: "payment", sourceId: paymentId` — the studentLedgerId is
 * already part of that dedup key, so the same paymentId is safe to use
 * as sourceId across every ledger a single payment settles.
 */
const auditSvc        = require("./financeAuditService");
const eventPublisher   = require("./financeEventPublisher");
const paymentSvc       = require("./financePaymentService");
const stateMachine     = require("./financePaymentStateMachine");
const strategies       = require("./financeAllocationStrategies");
const studentLedgerSvc = require("./studentLedgerService");
const ledgerEntrySvc   = require("./ledgerEntryService");
const familyAccountSvc = require("./familyAccountService");

const SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";

function _round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

async function _outstandingLedgersForFamily(studentIds, schoolId) {
  const ledgers = await Promise.all(
    studentIds.map((studentId) => studentLedgerSvc.getLedger(studentId, { schoolId }))
  );
  return ledgers
    .filter((l) => l && l.status === "active" && l.currentBalance > 0)
    .map((l) => ({ studentId: l.studentId, currentBalance: l.currentBalance, createdAt: l.createdAt }));
}

/**
 * allocatePayment — the single entry point for M4.2. May be called more
 * than once for the same Payment (to resume a `PartiallyAllocated`
 * payment) — each call only allocates whatever is still unresolved.
 */
async function allocatePayment(paymentId, {
  schoolId = SCHOOL_ID, centerId = "", actorUserId = "system",
  strategyOverride, manualAllocations, applyLeftoverToCredit = false,
} = {}) {
  if (!paymentId) { const e = new Error("paymentId is required."); e.code = "VALIDATION"; throw e; }

  const payment = await paymentSvc.getPayment(paymentId, { schoolId });
  if (!payment) { const e = new Error("Payment not found."); e.code = "NOT_FOUND"; throw e; }

  const allowedStatuses = new Set([stateMachine.STATES.RECORDED, stateMachine.STATES.PARTIALLY_ALLOCATED]);
  if (!allowedStatuses.has(payment.status)) {
    const e = new Error(`Payment is ${payment.status} — cannot be allocated.`); e.code = "VALIDATION"; throw e;
  }

  const alreadyResolved = _round2(
    payment.allocations.reduce((s, a) => s + a.amount, 0) + (payment.creditAppliedAmount || 0)
  );
  const remainingToAllocate = _round2(payment.amount - alreadyResolved);
  if (remainingToAllocate <= 0) {
    const e = new Error("Payment has nothing left to allocate."); e.code = "VALIDATION"; throw e;
  }

  const familyAccount = await familyAccountSvc.getFinanceAccount(payment.familyId, { schoolId });
  if (!familyAccount) { const e = new Error("Family account not found for this payment."); e.code = "VALIDATION"; throw e; }

  const strategyName = strategyOverride || familyAccount.paymentAllocationPreference || "oldestDueFirst";
  const strategy     = strategies.resolveStrategy(strategyName);

  const outstandingLedgers = await _outstandingLedgersForFamily(familyAccount.studentIds, schoolId);

  const { allocations: newAllocations, leftoverAmount } = strategy({
    paymentAmount: remainingToAllocate, outstandingLedgers, manualAllocations,
  });

  // Post one idempotent Ledger Entry per newly-settled ledger.
  for (const alloc of newAllocations) {
    await ledgerEntrySvc.createEntry(alloc.studentLedgerId, {
      type: "payment",
      amount: alloc.amount,
      description: `Payment ${paymentId}`,
      sourceType: "payment",
      sourceId: paymentId,
    }, { schoolId, centerId, actorUserId });
  }

  // oldestDueFirst always fully disposes of the amount (self-resolving);
  // manual only routes leftover to credit when explicitly asked to.
  let creditApplied = 0;
  if (leftoverAmount > 0 && (strategyName === "oldestDueFirst" || applyLeftoverToCredit)) {
    await familyAccountSvc.adjustCreditBalance(payment.familyId, leftoverAmount, {
      schoolId, actorUserId, reason: `Overpayment credit from payment ${paymentId}`,
    });
    creditApplied = leftoverAmount;
  }

  const updatedPayment = await paymentSvc.appendAllocations(paymentId, newAllocations, creditApplied, { schoolId, actorUserId });

  const totalResolved = _round2(
    updatedPayment.allocations.reduce((s, a) => s + a.amount, 0) + (updatedPayment.creditAppliedAmount || 0)
  );
  const newStatus = totalResolved >= _round2(payment.amount)
    ? stateMachine.STATES.ALLOCATED
    : stateMachine.STATES.PARTIALLY_ALLOCATED;

  let finalPayment = updatedPayment;
  if (newStatus !== payment.status) {
    finalPayment = await paymentSvc.transitionStatus(paymentId, newStatus, {
      schoolId, actorUserId, meta: { allocatedThisCall: newAllocations.length, creditApplied },
    });
  }

  await auditSvc.logFinanceAudit({
    schoolId, actorUserId,
    action: "financePayment.allocate", entityType: "payment", entityId: paymentId,
    meta: { strategy: strategyName, allocatedThisCall: newAllocations, creditApplied, newStatus },
  });

  eventPublisher.publish(eventPublisher.EVENTS.PAYMENT_ALLOCATED, {
    schoolId, centerId, paymentId, familyId: payment.familyId,
    allocations: newAllocations, creditApplied, status: finalPayment.status, actorUserId,
  });

  return { payment: finalPayment, allocations: newAllocations, creditApplied, leftoverAmount: leftoverAmount - creditApplied };
}

module.exports = { allocatePayment };
