/**
 * financeAllocationStrategies.js — Finance Foundation: Payment Allocation
 * Strategies (Sprint 4, M4.2 — incorporates the user's Sprint 4 Review
 * Recommendation 1: Allocation Strategy Abstraction)
 * ────────────────────────────────────────────────────────────────────
 * A registry of pure allocation strategies, each with the identical
 * signature:
 *
 *   strategy({ paymentAmount, outstandingLedgers, manualAllocations })
 *     -> { allocations: [{ studentLedgerId, amount }], leftoverAmount }
 *
 * `financePaymentAllocationService.js` picks a strategy by name (from
 * the Family Account's existing `paymentAllocationPreference`, or an
 * explicit per-call override) and calls it — the engine itself never
 * branches on strategy name beyond that one lookup. Adding a future
 * strategy (`highestAmountFirst`, `tuitionBeforeDaycare`, a
 * school-specific custom policy) means adding a new function and one
 * registry entry here, never touching the allocation engine.
 *
 * No Firestore access, no side effects — deterministic pure functions,
 * matching the `financeRulesEngine.js` precedent from Sprint 3, M3.3.
 */

function _round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/**
 * oldestDueFirst — deterministic auto-allocation. Orders a family's
 * outstanding Student Ledgers by `createdAt` ascending (the ledger open
 * longest is settled first) and sweeps the payment amount across them in
 * that order until either the payment is exhausted or every outstanding
 * ledger is settled. Documented honestly as ledger-granularity ordering
 * ("the obligation open longest"), not true per-invoice due-date FIFO —
 * per-invoice aging isn't surfaced at the family level yet.
 */
function oldestDueFirst({ paymentAmount, outstandingLedgers }) {
  let remaining = _round2(paymentAmount);
  const sorted = [...(outstandingLedgers || [])].sort(
    (a, b) => (a.createdAt || "").localeCompare(b.createdAt || "")
  );

  const allocations = [];
  for (const ledger of sorted) {
    if (remaining <= 0) break;
    const owed = _round2(ledger.currentBalance);
    if (owed <= 0) continue;
    const amount = Math.min(remaining, owed);
    allocations.push({ studentLedgerId: ledger.studentId, amount });
    remaining = _round2(remaining - amount);
  }

  return { allocations, leftoverAmount: Math.max(0, remaining) };
}

/**
 * manual — staff-specified explicit split. Validates that every entry
 * names a ledger and a positive amount, and that the total never exceeds
 * the payment amount being allocated. Whatever isn't explicitly
 * allocated is returned as `leftoverAmount` — the allocation *engine*
 * (not this pure function) decides what happens to it, since that
 * decision depends on caller intent, not on the strategy itself.
 */
function manual({ paymentAmount, manualAllocations }) {
  if (!Array.isArray(manualAllocations) || manualAllocations.length === 0) {
    const e = new Error("Manual allocation requires at least one { studentLedgerId, amount } entry.");
    e.code = "VALIDATION"; throw e;
  }

  let total = 0;
  const allocations = manualAllocations.map((a) => {
    const amount = Number(a.amount);
    if (!a.studentLedgerId || !isFinite(amount) || amount <= 0) {
      const e = new Error("Each manual allocation requires a studentLedgerId and a positive amount.");
      e.code = "VALIDATION"; throw e;
    }
    total = _round2(total + amount);
    return { studentLedgerId: a.studentLedgerId, amount: _round2(amount) };
  });

  const roundedPaymentAmount = _round2(paymentAmount);
  if (total > roundedPaymentAmount) {
    const e = new Error("Manual allocations cannot exceed the amount being allocated.");
    e.code = "VALIDATION"; throw e;
  }

  return { allocations, leftoverAmount: _round2(roundedPaymentAmount - total) };
}

const STRATEGIES = Object.freeze({ oldestDueFirst, manual });

function resolveStrategy(name) {
  const strategy = STRATEGIES[name];
  if (!strategy) {
    const e = new Error(`Unknown allocation strategy "${name}".`); e.code = "VALIDATION"; throw e;
  }
  return strategy;
}

module.exports = { STRATEGIES, resolveStrategy, oldestDueFirst, manual };
