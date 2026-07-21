/**
 * financePaymentStateMachine.js — Finance Foundation: Payment Lifecycle
 * (Sprint 4, M4.1 — incorporates the user's Sprint 4 Review Recommendation 2)
 * ────────────────────────────────────────────────────────────────────
 * Defines the Payment lifecycle explicitly, as a real state machine,
 * rather than treating `payment.status` as a free-form string every
 * caller is trusted to set correctly. Deliberately pure — no Firestore,
 * no side effects, matching the `financeRulesEngine.js` precedent — so
 * every service that mutates a Payment's status (this file's own
 * `financePaymentService.transitionStatus`, and every later milestone:
 * Allocation, Refund, Reversal) can call `assertTransition()` once,
 * synchronously, before writing, and reject an invalid transition in the
 * service layer itself rather than leaving it to the caller to remember.
 *
 * `Pending` is reserved for a future gateway-confirmed payment flow
 * (per `02_DOMAIN_ARCHITECTURE.md`'s original "Pending (gateway) →
 * Confirmed" note) — no Sprint 4 caller ever creates a Payment in this
 * state; `financePaymentService.recordPayment()` always creates directly
 * in `Recorded`, since every Sprint 4 payment method (cash, UPI
 * instruction, cheque, bank transfer) is staff-confirmed at the moment
 * it's recorded, not asynchronously confirmed later. The state and its
 * one outgoing transition are specified now so a future gateway
 * integration doesn't require reshaping this contract, only using more
 * of it.
 */

const STATES = Object.freeze({
  PENDING:             "Pending",
  RECORDED:            "Recorded",
  ALLOCATED:           "Allocated",
  PARTIALLY_ALLOCATED: "PartiallyAllocated",
  REFUNDED:            "Refunded",
  PARTIALLY_REFUNDED:  "PartiallyRefunded",
  REVERSED:            "Reversed",
});

const VALID_STATES = new Set(Object.values(STATES));

// Terminal states (Refunded, Reversed) intentionally have no outgoing
// transitions — once reached, a Payment's lifecycle is closed. Reversing
// an already (Partially)Refunded Payment is an explicit non-goal for
// Sprint 4 (money has already moved back out via the refund; safely
// coordinating a reversal on top of that is a harder edge case than
// "catch a bad payment early," which is what Reversed models) — not
// silently allowed, flagged here rather than hidden.
const TRANSITIONS = Object.freeze({
  [STATES.PENDING]:             [STATES.RECORDED],
  [STATES.RECORDED]:            [STATES.ALLOCATED, STATES.PARTIALLY_ALLOCATED, STATES.REVERSED],
  [STATES.PARTIALLY_ALLOCATED]: [STATES.ALLOCATED, STATES.REVERSED],
  [STATES.ALLOCATED]:           [STATES.PARTIALLY_REFUNDED, STATES.REFUNDED, STATES.REVERSED],
  [STATES.PARTIALLY_REFUNDED]:  [STATES.REFUNDED],
  [STATES.REFUNDED]:            [],
  [STATES.REVERSED]:            [],
});

function canTransition(from, to) {
  return Array.isArray(TRANSITIONS[from]) && TRANSITIONS[from].includes(to);
}

/** Throws { code: "VALIDATION" } for an unknown state or a transition not
 * present in TRANSITIONS above; returns true otherwise. Callers should
 * call this before persisting a new status, never after. */
function assertTransition(from, to) {
  if (!VALID_STATES.has(from)) {
    const e = new Error(`Unknown Payment state "${from}".`); e.code = "VALIDATION"; throw e;
  }
  if (!VALID_STATES.has(to)) {
    const e = new Error(`Unknown Payment state "${to}".`); e.code = "VALIDATION"; throw e;
  }
  if (!canTransition(from, to)) {
    const e = new Error(`Invalid Payment status transition: "${from}" -> "${to}".`); e.code = "VALIDATION"; throw e;
  }
  return true;
}

module.exports = { STATES, TRANSITIONS, canTransition, assertTransition };
