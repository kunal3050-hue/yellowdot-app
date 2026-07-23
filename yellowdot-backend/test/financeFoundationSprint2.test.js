/**
 * Finance Foundation — Sprint 1 review changes (Mandatory Changes 1 & 2,
 * Recommended Improvements 1 & 2) and Sprint 2 (Admission Integration).
 *
 * Same safety discipline as test/financeFoundation.test.js: nothing here
 * ever calls a real Firestore read/write. `financeTransaction`'s test
 * mocks `db.runTransaction` and `financeAuditService.logFinanceAudit`
 * directly (both are whole-module property lookups at call time in
 * financeTransaction.js specifically, so this works); `admissionFinanceService`
 * is tested by mocking its three service dependencies, exactly like the
 * controller tests in the other file mock services.
 */
const test   = require("node:test");
const assert = require("node:assert");

// ── Mandatory Change 2 — Finance Event Publisher ───────────────────────

test("financeEventPublisher: exposes all twelve Finance Foundation event names (four from Mandatory Change 2, plus LedgerEntryCreated, InvoiceGenerated, Sprint 4's PaymentRecorded/PaymentAllocated/RefundProcessed/PaymentReversed, and M3.5's SchedulerRunCompleted/SchedulerRunFailed)", () => {
  const { EVENTS } = require("../services/financeEventPublisher");
  assert.deepEqual(Object.values(EVENTS).sort(), [
    "BillingPlanCreated", "FamilyAccountCreated", "FinanceSettingsChanged",
    "InvoiceGenerated", "LedgerEntryCreated", "PaymentAllocated", "PaymentRecorded",
    "PaymentReversed", "RefundProcessed", "SchedulerRunCompleted", "SchedulerRunFailed",
    "StudentLedgerCreated",
  ].sort());
});

test("ledgerEntryService.createEntry: publishes LedgerEntryCreated after a successful entry (db.runTransaction/audit mocked, never touches real Firestore)", async () => {
  const { db } = require("../firebaseAdmin");
  const auditSvc = require("../services/financeAuditService");
  const ledgerEntrySvc = require("../services/ledgerEntryService");
  const { financeEvents, EVENTS } = require("../services/financeEventPublisher");

  const origRunTransaction = db.runTransaction;
  const origLogAudit = auditSvc.logFinanceAudit;

  db.runTransaction = async (fn) => {
    const fakeTx = {
      get: async () => ({ exists: true, data: () => ({ schoolId: "school-a", status: "active", currentBalance: 0 }) }),
      set: () => {},
      update: () => {},
    };
    return fn(fakeTx);
  };
  auditSvc.logFinanceAudit = async () => {};

  let received = null;
  financeEvents.once(EVENTS.LEDGER_ENTRY_CREATED, (payload) => { received = payload; });

  const { newBalance } = await ledgerEntrySvc.createEntry(
    "YD001", { type: "charge", amount: 500 }, { schoolId: "school-a", actorUserId: "u1" }
  );

  assert.equal(newBalance, 500);
  assert.ok(received, "LedgerEntryCreated must be published");
  assert.equal(received.studentLedgerId, "YD001");
  assert.equal(received.type, "charge");
  assert.equal(received.newBalance, 500);

  db.runTransaction = origRunTransaction;
  auditSvc.logFinanceAudit = origLogAudit;
});

test("financeEventPublisher.publish: delivers the payload (plus schoolId/eventName/emittedAt) to listeners", () => {
  const { financeEvents, EVENTS, publish } = require("../services/financeEventPublisher");
  let received = null;
  const listener = (payload) => { received = payload; };
  financeEvents.once(EVENTS.STUDENT_LEDGER_CREATED, listener);

  publish(EVENTS.STUDENT_LEDGER_CREATED, { schoolId: "school-a", studentId: "YD001" });

  assert.ok(received);
  assert.equal(received.schoolId, "school-a");
  assert.equal(received.studentId, "YD001");
  assert.equal(received.eventName, EVENTS.STUDENT_LEDGER_CREATED);
  assert.ok(received.emittedAt);
});

test("financeEventPublisher.publish: a throwing listener never propagates out of publish()", () => {
  const { financeEvents, EVENTS, publish } = require("../services/financeEventPublisher");
  const badListener = () => { throw new Error("listener exploded"); };
  financeEvents.once(EVENTS.FINANCE_SETTINGS_CHANGED, badListener);

  assert.doesNotThrow(() => publish(EVENTS.FINANCE_SETTINGS_CHANGED, { schoolId: "school-a" }));
});

// ── Recommended Improvement 2 — Domain Value Objects ───────────────────

test("Money: add/subtract stay within the same currency, reject mixed currencies", () => {
  const { Money } = require("../domain/valueObjects");
  const a = new Money(100, "INR");
  const b = new Money(50, "INR");
  assert.equal(a.add(b).toNumber(), 150);
  assert.equal(a.subtract(b).toNumber(), 50);

  const usd = new Money(10, "USD");
  assert.throws(() => a.add(usd), (err) => err.code === "VALIDATION");
});

test("Money: rejects non-finite amounts, rounds to 2 decimal places", () => {
  const { Money } = require("../domain/valueObjects");
  assert.throws(() => new Money(NaN), (err) => err.code === "VALIDATION");
  assert.throws(() => new Money(Infinity), (err) => err.code === "VALIDATION");
  assert.equal(new Money(19.995).toNumber(), 20); // rounds
});

test("Money: is immutable — add()/subtract() never mutate the original instance", () => {
  const { Money } = require("../domain/valueObjects");
  const original = new Money(100);
  original.add(new Money(50));
  assert.equal(original.toNumber(), 100); // unchanged

  original.amount = 999; // frozen — a sloppy-mode assignment silently no-ops rather than throwing
  assert.equal(original.amount, 100);
  assert.ok(Object.isFrozen(original));
});

test("Percentage: .of(Money) computes the correct share, rejects out-of-range values", () => {
  const { Money, Percentage } = require("../domain/valueObjects");
  const tenPercent = new Percentage(10);
  const result = tenPercent.of(new Money(1000));
  assert.equal(result.toNumber(), 100);

  assert.throws(() => new Percentage(-1), (err) => err.code === "VALIDATION");
  assert.throws(() => new Percentage(101), (err) => err.code === "VALIDATION");
});

test("BillingPeriod: includes() respects an open-ended vs. closed window", () => {
  const { BillingPeriod } = require("../domain/valueObjects");
  const openEnded = new BillingPeriod("monthly", "2026-02-01");
  assert.equal(openEnded.isOpenEnded(), true);
  assert.equal(openEnded.includes("2027-01-01"), true); // still running, no end

  const closed = new BillingPeriod("termly", "2026-02-01", "2026-05-01");
  assert.equal(closed.includes("2026-03-01"), true);
  assert.equal(closed.includes("2026-06-01"), false);
  assert.equal(closed.includes("2026-01-01"), false);

  assert.throws(() => new BillingPeriod("weekly", "2026-02-01"), (err) => err.code === "VALIDATION");
});

test("LedgerBalance: classifies owed / settled / credit correctly", () => {
  const { LedgerBalance } = require("../domain/valueObjects");
  assert.equal(new LedgerBalance(500).status, "owed");
  assert.equal(new LedgerBalance(0).status, "settled");
  assert.equal(new LedgerBalance(-200).status, "credit");
});

test("FeeAmount: requires a real Money instance and a feeComponentId", () => {
  const { Money, FeeAmount } = require("../domain/valueObjects");
  const fee = new FeeAmount("TPL1", "Tuition", new Money(5000));
  assert.equal(fee.toString(), "Tuition: INR 5000.00");

  assert.throws(() => new FeeAmount("", "Tuition", new Money(5000)), (err) => err.code === "VALIDATION");
  assert.throws(() => new FeeAmount("TPL1", "Tuition", 5000), (err) => err.code === "VALIDATION");
});

// ── Recommended Improvement 1 — FinanceTransaction abstraction ─────────

test("runFinanceTransaction: runs work with the tx handle, audit-logs after commit, publishes the event", async () => {
  const { db } = require("../firebaseAdmin");
  const auditSvc = require("../services/financeAuditService");
  const { runFinanceTransaction } = require("../services/financeTransaction");
  const { financeEvents, EVENTS } = require("../services/financeEventPublisher");

  const origRunTransaction = db.runTransaction;
  const origLogAudit       = auditSvc.logFinanceAudit;
  let auditArgs = null;
  let eventReceived = null;

  db.runTransaction = async (fn) => fn({ fakeTx: true });
  auditSvc.logFinanceAudit = async (args) => { auditArgs = args; return args; };
  financeEvents.once(EVENTS.STUDENT_LEDGER_CREATED, (payload) => { eventReceived = payload; });

  const result = await runFinanceTransaction(
    {
      schoolId: "school-a", actorUserId: "u1",
      action: "test.action", entityType: "test", entityId: "T1",
      event: { name: EVENTS.STUDENT_LEDGER_CREATED, payload: { studentId: "YD001" } },
    },
    async (tx) => {
      assert.equal(tx.fakeTx, true);
      return "work-result";
    }
  );

  assert.equal(result, "work-result");
  assert.ok(auditArgs, "audit log must be written");
  assert.equal(auditArgs.action, "test.action");
  assert.ok(eventReceived, "event must be published");
  assert.equal(eventReceived.studentId, "YD001");

  db.runTransaction = origRunTransaction;
  auditSvc.logFinanceAudit = origLogAudit;
});

test("runFinanceTransaction: with no `event` in the descriptor, nothing is published", async () => {
  const { db } = require("../firebaseAdmin");
  const auditSvc = require("../services/financeAuditService");
  const { runFinanceTransaction } = require("../services/financeTransaction");

  const origRunTransaction = db.runTransaction;
  const origLogAudit       = auditSvc.logFinanceAudit;
  db.runTransaction = async (fn) => fn({});
  auditSvc.logFinanceAudit = async () => {};

  const result = await runFinanceTransaction(
    { schoolId: "school-a", actorUserId: "u1", action: "test.action2", entityType: "test", entityId: "T2" },
    async () => "ok"
  );
  assert.equal(result, "ok");

  db.runTransaction = origRunTransaction;
  auditSvc.logFinanceAudit = origLogAudit;
});

// ── Mandatory Change 1 — Route registration is conditional, not just middleware ──

test("Route registration: the four Finance Foundation routers are only mounted when the flag is 'true'", () => {
  const express = require("express");
  const ledgerRoutes = require("../routes/ledgerRoutes");

  function buildApp(flagValue) {
    const originalEnv = process.env.FINANCE_FOUNDATION_ENABLED;
    if (flagValue === undefined) delete process.env.FINANCE_FOUNDATION_ENABLED;
    else process.env.FINANCE_FOUNDATION_ENABLED = flagValue;

    const app = express();
    if (process.env.FINANCE_FOUNDATION_ENABLED === "true") {
      app.use(ledgerRoutes);
    }

    if (originalEnv === undefined) delete process.env.FINANCE_FOUNDATION_ENABLED;
    else process.env.FINANCE_FOUNDATION_ENABLED = originalEnv;

    return app;
  }

  const disabledApp = buildApp(undefined);
  const enabledApp  = buildApp("true");

  // With the flag off, no layer in the routing stack should be the ledgerRoutes
  // router instance at all — checked by identity (l.handle === ledgerRoutes),
  // not by layer name, since that's an Express-internal-version detail.
  function hasLedgerRouterMounted(app) {
    const stack = app.router?.stack || app._router?.stack || [];
    return stack.some(l => l.handle === ledgerRoutes);
  }

  assert.equal(hasLedgerRouterMounted(disabledApp), false, "disabled app must not register the ledger router at all");
  assert.equal(hasLedgerRouterMounted(enabledApp), true, "enabled app must register the ledger router");
});

// ── Sprint 2 — Admission Integration ────────────────────────────────────

test("admissionFinanceService.onStudentAdmitted: always creates the ledger; family/plan steps are conditional; a plan is auto-created AND auto-activated", async () => {
  const admissionSvc  = require("../services/admissionFinanceService");
  const ledgerSvc     = require("../services/studentLedgerService");
  const familyAcctSvc = require("../services/familyAccountService");
  const planSvc       = require("../services/billingPlanService");

  const origCreateLedger  = ledgerSvc.createLedger;
  const origEnsure        = familyAcctSvc.ensureFinanceAccount;
  const origPlanCreate    = planSvc.create;
  const origListForStudent = planSvc.listForStudent;
  const origSetStatus     = planSvc.setStatus;

  let ledgerCalled = false, familyCalled = false, planCalled = false, activateCalled = false;
  ledgerSvc.createLedger   = async () => { ledgerCalled = true; return { studentId: "YD001" }; };
  familyAcctSvc.ensureFinanceAccount = async () => { familyCalled = true; return { familyId: "FAM001" }; };
  planSvc.listForStudent   = async () => []; // no pre-existing plan — M3.6 idempotency check
  planSvc.create           = async () => { planCalled = true; return { planId: "BPL000001", status: "draft" }; };
  planSvc.setStatus        = async (planId, status) => { activateCalled = true; return { planId, status }; };

  // No familyId, no feeTemplateId — only the ledger step should run.
  await admissionSvc.onStudentAdmitted({ studentId: "YD001", schoolId: "school-a" });
  assert.equal(ledgerCalled, true);
  assert.equal(familyCalled, false);
  assert.equal(planCalled, false);
  assert.equal(activateCalled, false);

  ledgerCalled = familyCalled = planCalled = activateCalled = false;

  // Both provided — all steps should run, including auto-activation (M3.6).
  const outcome = await admissionSvc.onStudentAdmitted({
    studentId: "YD002", schoolId: "school-a", familyId: "FAM001", feeTemplateId: "TPL1", admissionDate: "2026-07-15",
  });
  assert.equal(ledgerCalled, true);
  assert.equal(familyCalled, true);
  assert.equal(planCalled, true);
  assert.equal(activateCalled, true, "a newly-created plan must be auto-activated — no additional staff action required");
  assert.equal(outcome.billingPlan.status, "active");

  ledgerSvc.createLedger = origCreateLedger;
  familyAcctSvc.ensureFinanceAccount = origEnsure;
  planSvc.create = origPlanCreate;
  planSvc.listForStudent = origListForStudent;
  planSvc.setStatus = origSetStatus;
});

test("admissionFinanceService.onStudentAdmitted: a family-account failure never throws, and does not block the billing-plan step", async () => {
  const admissionSvc  = require("../services/admissionFinanceService");
  const ledgerSvc     = require("../services/studentLedgerService");
  const familyAcctSvc = require("../services/familyAccountService");
  const planSvc       = require("../services/billingPlanService");

  const origCreateLedger  = ledgerSvc.createLedger;
  const origEnsure        = familyAcctSvc.ensureFinanceAccount;
  const origPlanCreate    = planSvc.create;
  const origListForStudent = planSvc.listForStudent;
  const origSetStatus     = planSvc.setStatus;

  ledgerSvc.createLedger = async () => ({ studentId: "YD003" });
  familyAcctSvc.ensureFinanceAccount = async () => { throw new Error("boom"); };
  let planCalled = false;
  planSvc.listForStudent = async () => [];
  planSvc.create = async () => { planCalled = true; return { planId: "BPL000002", status: "draft" }; };
  planSvc.setStatus = async (planId, status) => ({ planId, status });

  const outcome = await admissionSvc.onStudentAdmitted({
    studentId: "YD003", schoolId: "school-a", familyId: "FAM002", feeTemplateId: "TPL1",
  });

  assert.equal(outcome.ledger.studentId, "YD003");
  assert.equal(outcome.familyAccount, null); // failed, but caught
  assert.equal(planCalled, true);            // unaffected by the family-account failure
  assert.equal(outcome.billingPlan.status, "active");

  ledgerSvc.createLedger = origCreateLedger;
  familyAcctSvc.ensureFinanceAccount = origEnsure;
  planSvc.create = origPlanCreate;
  planSvc.listForStudent = origListForStudent;
  planSvc.setStatus = origSetStatus;
});

test("admissionFinanceService.onStudentAdmitted: idempotent — a retried call for the same student never creates a second plan, and self-heals a prior create-without-activate", async () => {
  const admissionSvc  = require("../services/admissionFinanceService");
  const ledgerSvc     = require("../services/studentLedgerService");
  const planSvc       = require("../services/billingPlanService");

  const origCreateLedger  = ledgerSvc.createLedger;
  const origPlanCreate    = planSvc.create;
  const origListForStudent = planSvc.listForStudent;
  const origSetStatus     = planSvc.setStatus;

  ledgerSvc.createLedger = async () => ({ studentId: "YD006" });

  // Simulates a prior call that created the plan but crashed before activating.
  let createCalls = 0, activateCalls = 0;
  planSvc.listForStudent = async () => [{ planId: "BPL-EXISTING", status: "draft" }];
  planSvc.create    = async () => { createCalls += 1; return { planId: "BPL-SHOULD-NOT-EXIST", status: "draft" }; };
  planSvc.setStatus = async (planId, status) => { activateCalls += 1; return { planId, status }; };

  const outcome = await admissionSvc.onStudentAdmitted({
    studentId: "YD006", schoolId: "school-a", feeTemplateId: "TPL1",
  });

  assert.equal(createCalls, 0, "an existing plan must never be re-created");
  assert.equal(activateCalls, 1, "the existing draft plan must still be activated (self-heals the prior partial failure)");
  assert.equal(outcome.billingPlan.planId, "BPL-EXISTING");
  assert.equal(outcome.billingPlan.status, "active");

  // A second retry, now that the plan is already active — must be a pure no-op.
  planSvc.listForStudent = async () => [{ planId: "BPL-EXISTING", status: "active" }];
  activateCalls = 0;
  const outcome2 = await admissionSvc.onStudentAdmitted({
    studentId: "YD006", schoolId: "school-a", feeTemplateId: "TPL1",
  });
  assert.equal(activateCalls, 0, "an already-active plan must never be re-activated");
  assert.equal(outcome2.billingPlan.planId, "BPL-EXISTING");

  ledgerSvc.createLedger = origCreateLedger;
  planSvc.create = origPlanCreate;
  planSvc.listForStudent = origListForStudent;
  planSvc.setStatus = origSetStatus;
});

test("admissionFinanceService.onStudentAdmitted: a ledger-creation failure short-circuits (no ledger to attach anything to), never throws", async () => {
  const admissionSvc = require("../services/admissionFinanceService");
  const ledgerSvc    = require("../services/studentLedgerService");
  const origCreateLedger = ledgerSvc.createLedger;
  ledgerSvc.createLedger = async () => { throw new Error("Firestore unavailable"); };

  const outcome = await admissionSvc.onStudentAdmitted({ studentId: "YD004", schoolId: "school-a" });
  assert.equal(outcome.ledger, null);

  ledgerSvc.createLedger = origCreateLedger;
});

test("admissionFinanceService.onStudentLinkedToFamily: ensures the finance account, never throws on failure", async () => {
  const admissionSvc  = require("../services/admissionFinanceService");
  const familyAcctSvc = require("../services/familyAccountService");
  const origEnsure = familyAcctSvc.ensureFinanceAccount;

  familyAcctSvc.ensureFinanceAccount = async (familyId) => ({ familyId, creditBalance: 0 });
  const ok = await admissionSvc.onStudentLinkedToFamily({ familyId: "FAM003", studentId: "YD005", schoolId: "school-a" });
  assert.equal(ok.familyId, "FAM003");

  familyAcctSvc.ensureFinanceAccount = async () => { throw new Error("boom"); };
  const failed = await admissionSvc.onStudentLinkedToFamily({ familyId: "FAM003", studentId: "YD005", schoolId: "school-a" });
  assert.equal(failed, null);

  familyAcctSvc.ensureFinanceAccount = origEnsure;
});
