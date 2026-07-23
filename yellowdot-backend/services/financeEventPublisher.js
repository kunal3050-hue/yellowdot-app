/**
 * financeEventPublisher.js — Finance domain event contract (Sprint 1 review,
 * Mandatory Change 2).
 * ────────────────────────────────────────────────────────────────────
 * Establishes the event contract now, even though no listener consumes it
 * yet — per the Domain Architecture's Part 2 design and the Sprint 1 review
 * instruction: "No listeners required yet. No automation required. No
 * message broker required. Internal event publisher or placeholder
 * abstraction is sufficient."
 *
 * Implementation: a plain Node `EventEmitter`, in-process, no persistence,
 * no broker. This is deliberately the simplest thing that satisfies the
 * requirement — the platform has no existing message-queue infrastructure
 * (confirmed during the Domain Architecture research), so introducing one
 * here would violate "reuse, extend, never rebuild" for a need that doesn't
 * exist yet. When a real consumer (Billing Automation, Collections, Parent
 * Portal, Reports, Notifications, AI Finance) needs to react to these
 * events, it calls `financeEvents.on(EVENTS.X, handler)` — nothing about
 * the publishing side needs to change to support that.
 *
 * A publish failure (a bad listener throwing) must never break the
 * financial write that triggered it — publish() catches and logs, never
 * rethrows, so an event-consumer bug can never cascade into a Finance
 * service failure.
 */
const { EventEmitter } = require("events");

const financeEvents = new EventEmitter();

const EVENTS = Object.freeze({
  STUDENT_LEDGER_CREATED:   "StudentLedgerCreated",
  LEDGER_ENTRY_CREATED:     "LedgerEntryCreated",
  BILLING_PLAN_CREATED:     "BillingPlanCreated",
  FAMILY_ACCOUNT_CREATED:   "FamilyAccountCreated",
  FINANCE_SETTINGS_CHANGED: "FinanceSettingsChanged",
  INVOICE_GENERATED:        "InvoiceGenerated",
  PAYMENT_RECORDED:         "PaymentRecorded",
  PAYMENT_ALLOCATED:        "PaymentAllocated",
  REFUND_PROCESSED:         "RefundProcessed",
  PAYMENT_REVERSED:         "PaymentReversed",
  SCHEDULER_RUN_COMPLETED:  "SchedulerRunCompleted",
  SCHEDULER_RUN_FAILED:     "SchedulerRunFailed",
});

/** publish(eventName, payload) — payload should always include schoolId. */
function publish(eventName, payload = {}) {
  try {
    financeEvents.emit(eventName, { ...payload, eventName, emittedAt: new Date().toISOString() });
  } catch (err) {
    // A listener threw — this must never surface as a failure of the
    // financial write that triggered the event.
    console.error(`[financeEventPublisher] listener error for "${eventName}":`, err.message);
  }
}

module.exports = { financeEvents, EVENTS, publish };
