/**
 * Admission → Automatic Recurring Billing Integration (M3.6)
 * ────────────────────────────────────────────────────────────────────
 * "A completed admission automatically prepares the student for
 * recurring billing with no additional staff actions." Same discipline
 * as financeBillingSchedulerValidation.test.js: runs the REAL, unmodified
 * service code end to end (studentService, admissionFinanceService,
 * studentLedgerService, billingPlanService, financeBillingEngineService,
 * financeAuditService, and the scheduler service itself) against one
 * shared in-memory fake Firestore — never each function mocked
 * individually. Real Firestore is never touched.
 *
 * Scenarios, matching the requested checklist exactly:
 *   1. Admission with Fee Template → Active Billing Plan created automatically.
 *   2. Admission without Fee Template → No Billing Plan created.
 *   3. Duplicate admission retries do not create duplicate Billing Plans.
 *   4. Scheduler picks up the new Billing Plan correctly.
 */
const test   = require("node:test");
const assert = require("node:assert");

const { db }           = require("../firebaseAdmin");
const { createFakeFirestore } = require("./helpers/fakeFirestore");

const fake = createFakeFirestore();
db.collection     = fake.collection;
db.runTransaction = fake.runTransaction;

const studentSvc       = require("../services/studentService");
const admissionSvc     = require("../services/admissionFinanceService");
const studentLedgerSvc = require("../services/studentLedgerService");
const billingPlanSvc   = require("../services/billingPlanService");
const auditSvc         = require("../services/financeAuditService");
const schedulerSvc     = require("../services/financeBillingSchedulerService");

const SCHOOL_ID = "admit-sched-school";
const FEE_TEMPLATE_ID = "FEE-ADMIT-001";

fake.seed("tenants", SCHOOL_ID, { tenantId: SCHOOL_ID, schoolName: "Admission Test School", status: "active", timezone: "Asia/Kolkata", createdAt: "2026-01-01T00:00:00Z" });
fake.seed("feeTemplates", FEE_TEMPLATE_ID, { schoolId: SCHOOL_ID, templateName: "Full Day Programme", amount: 6000 });

let studentSeq = 0;
function nextName() { studentSeq += 1; return `Admission Test Student ${studentSeq}`; }

/** Mirrors exactly what server.js's POST /add-student handler does: create
 * the student record, then fire the Finance Foundation admission hook —
 * the same two calls, same field mapping, just without the HTTP/Express
 * layer in between. */
async function admitStudent({ feeTemplateId, admissionDate = "2024-03-16" } = {}) {
  const created = await studentSvc.create(
    { student_name: nextName(), dob: "2020-01-01", class: "Nursery", gender: "Male", join_date: admissionDate },
    { schoolId: SCHOOL_ID, centerId: "main", actorUserId: "staff-1" }
  );
  const studentId = created.studentId;
  const outcome = await admissionSvc.onStudentAdmitted({
    studentId, schoolId: SCHOOL_ID, centerId: "main",
    feeTemplateId: feeTemplateId || "", admissionDate, actorUserId: "staff-1",
  });
  return { studentId, outcome };
}

async function waitForRunCompletion(runId, { timeoutMs = 5000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const detail = await schedulerSvc.getRunDetail(runId);
    if (detail && detail.status !== "running") return detail;
    await new Promise(r => setTimeout(r, 20));
  }
  throw new Error(`Run ${runId} did not complete within ${timeoutMs}ms`);
}

// ── Scenario 1 ───────────────────────────────────────────────────────────

test("Admission with Fee Template → an Active Billing Plan is created automatically, no staff action needed", async () => {
  const { studentId, outcome } = await admitStudent({ feeTemplateId: FEE_TEMPLATE_ID });

  assert.ok(outcome.ledger, "the Student Ledger step must still run, unchanged");
  assert.ok(outcome.billingPlan, "a Billing Plan must be created");
  assert.equal(outcome.billingPlan.status, "active", "the plan must be ACTIVE, not left in draft — the whole point of M3.6");
  assert.equal(outcome.billingPlan.feeTemplateId, FEE_TEMPLATE_ID);
  assert.equal(outcome.billingPlan.cadence, "monthly");
  assert.equal(outcome.billingPlan.joiningDatePolicy, "prorated", "a mid-cycle admission should prorate, not charge a full period");
  assert.equal(outcome.billingPlan.startDate, "2024-03-16", "the plan's startDate should reflect the real admission date");

  const plans = await billingPlanSvc.listForStudent(studentId, { schoolId: SCHOOL_ID });
  assert.equal(plans.length, 1);
  assert.equal(plans[0].status, "active");

  // Requirement #5 — audit logging preserved: both the create and the
  // activate step are independently audited via billingPlanService's own,
  // unmodified logFinanceAudit() calls — nothing bypassed.
  const audit = await auditSvc.listForEntity({ schoolId: SCHOOL_ID, entityType: "billingPlan", entityId: outcome.billingPlan.planId });
  assert.ok(audit.some(a => a.action === "billingPlan.create"));
  assert.ok(audit.some(a => a.action === "billingPlan.active"));
});

// ── Scenario 2 ───────────────────────────────────────────────────────────

test("Admission without a Fee Template → no Billing Plan is created, student is admitted normally", async () => {
  const { studentId, outcome } = await admitStudent({ feeTemplateId: "" });

  assert.ok(outcome.ledger, "the Student Ledger must still be created — admission itself is unaffected");
  assert.equal(outcome.billingPlan, null);

  const plans = await billingPlanSvc.listForStudent(studentId, { schoolId: SCHOOL_ID });
  assert.equal(plans.length, 0);

  const ledger = await studentLedgerSvc.getLedger(studentId, { schoolId: SCHOOL_ID });
  assert.equal(ledger.currentBalance, 0);
});

// ── Scenario 3 ───────────────────────────────────────────────────────────

test("Duplicate admission retries never create duplicate Billing Plans", async () => {
  const created = await studentSvc.create(
    { student_name: nextName(), dob: "2020-01-01", class: "Nursery", gender: "Female", join_date: "2024-03-16" },
    { schoolId: SCHOOL_ID, centerId: "main", actorUserId: "staff-1" }
  );
  const studentId = created.studentId;
  const params = { studentId, schoolId: SCHOOL_ID, centerId: "main", feeTemplateId: FEE_TEMPLATE_ID, admissionDate: "2024-03-16", actorUserId: "staff-1" };

  // Simulates a retried fire-and-forget call — e.g. the server.js hook's
  // own .catch()-swallowed error path being invoked again, or a genuine
  // duplicate webhook/replay for the exact same admission event.
  const first  = await admissionSvc.onStudentAdmitted(params);
  const second = await admissionSvc.onStudentAdmitted(params);
  const third  = await admissionSvc.onStudentAdmitted(params);

  assert.equal(first.billingPlan.planId, second.billingPlan.planId);
  assert.equal(second.billingPlan.planId, third.billingPlan.planId);
  assert.equal(first.billingPlan.status, "active");
  assert.equal(third.billingPlan.status, "active");

  const plans = await billingPlanSvc.listForStudent(studentId, { schoolId: SCHOOL_ID });
  assert.equal(plans.length, 1, "three admission calls for the same student must still result in exactly one Billing Plan");

  // Only ONE "billingPlan.create" audit entry despite three calls — proves
  // the second/third calls truly took the "reuse existing" path, not a
  // fresh create that happened to collide on ID.
  const audit = await auditSvc.listForEntity({ schoolId: SCHOOL_ID, entityType: "billingPlan", entityId: plans[0].planId });
  const createEntries = audit.filter(a => a.action === "billingPlan.create");
  assert.equal(createEntries.length, 1);
});

// ── Scenario 4 ───────────────────────────────────────────────────────────

test("The Recurring Billing Engine immediately recognizes a newly-admitted student's active Billing Plan", async () => {
  const { studentId, outcome } = await admitStudent({ feeTemplateId: FEE_TEMPLATE_ID });
  const newPlanId = outcome.billingPlan.planId;

  const { runId } = await schedulerSvc.runSchedulerOnce({ triggeredBy: "manual", mode: "manual", actorUserId: "scheduler-test" });
  const detail = await waitForRunCompletion(runId);

  assert.equal(detail.status, "completed");
  const result = detail.planResults.find(r => r.planId === newPlanId);
  assert.ok(result, "the newly-admitted student's plan must be evaluated by the very next scheduler run — no separate activation window or delay");
  assert.equal(result.outcome, "generated");

  const ledger = await studentLedgerSvc.getLedger(studentId, { schoolId: SCHOOL_ID });
  assert.ok(ledger.currentBalance > 0 && ledger.currentBalance <= 6000, `expected a positive, prorated (non-full) charge, got ${ledger.currentBalance}`);

  // Re-running immediately must recognize the duplicate, not double-charge —
  // proves the auto-created plan participates in the exact same,
  // already-proven idempotency the scheduler applies to every other plan.
  const balanceAfterFirstRun = ledger.currentBalance;
  const second = await schedulerSvc.runSchedulerOnce({ triggeredBy: "manual", mode: "manual", actorUserId: "scheduler-test" });
  const secondDetail = await waitForRunCompletion(second.runId);
  const secondResult = secondDetail.planResults.find(r => r.planId === newPlanId);
  assert.equal(secondResult.outcome, "duplicate");
  const ledgerAfter = await studentLedgerSvc.getLedger(studentId, { schoolId: SCHOOL_ID });
  assert.equal(ledgerAfter.currentBalance, balanceAfterFirstRun);
});
