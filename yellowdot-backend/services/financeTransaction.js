/**
 * financeTransaction.js — Finance Transaction abstraction (Sprint 1 review,
 * Recommended Improvement 1).
 * ────────────────────────────────────────────────────────────────────
 * A shared orchestration helper for "do a Firestore write, then audit-log
 * it" — the exact shape already hand-written inside ledgerEntryService's
 * createEntry(). Per the review: "This does not need to be fully adopted
 * immediately, but the abstraction should exist before the Finance domain
 * becomes more complex."
 *
 * Existing Sprint 1 services (studentLedgerService, ledgerEntryService,
 * billingPlanService, familyAccountService, financeSettingsService) are
 * NOT refactored to use this in this pass — they are already implemented,
 * tested, and verified with zero regressions; rewiring working, tested
 * code to a new abstraction without being asked carries real risk for no
 * immediate benefit. New Finance code (starting with
 * admissionFinanceService.js, Sprint 2) uses it directly, which both
 * proves the abstraction is real and usable, and gives future refactors
 * of the Sprint 1 services a concrete, exercised target to move toward.
 */
const { db }         = require("../firebaseAdmin");
const auditSvc       = require("./financeAuditService");
const eventPublisher = require("./financeEventPublisher");

// Whole-module requires (not destructured) so the calls below go through a
// property lookup at call time — this is what makes them mockable in tests
// via `auditSvc.logFinanceAudit = fakeFn`, the same convention every
// controller in this codebase already relies on (see staffController.js,
// or test/m12TenantIsolation.test.js's monkey-patched service functions).

/**
 * runFinanceTransaction(descriptor, work)
 *
 * descriptor: { schoolId, actorUserId, action, entityType, entityId, meta,
 *               event: { name, payload } } — event is optional.
 * work(tx): async (tx) => result — your Firestore reads/writes, using the
 *           transaction handle `tx` for every get/set/update inside it.
 *
 * Runs `work` inside a single Firestore transaction, then — only once the
 * transaction has actually committed — writes the audit log entry and
 * publishes the domain event (if provided). Returns whatever `work`
 * returned.
 */
async function runFinanceTransaction(descriptor, work) {
  const { schoolId, actorUserId, action, entityType, entityId, meta = {}, event } = descriptor;

  let result;
  await db.runTransaction(async (tx) => {
    result = await work(tx);
  });

  await auditSvc.logFinanceAudit({ schoolId, actorUserId, action, entityType, entityId, meta });

  if (event?.name) {
    eventPublisher.publish(event.name, { schoolId, actorUserId, entityId, ...(event.payload || {}) });
  }

  return result;
}

module.exports = { runFinanceTransaction };
