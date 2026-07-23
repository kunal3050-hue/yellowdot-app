/**
 * seedFinanceDemoData.js — Realistic Finance Platform demo dataset
 * ────────────────────────────────────────────────────────────────────
 * Populates billing plans, invoices, payments, credits, refunds, ledger
 * entries, and (as a natural side effect of every write already going
 * through financeAuditService) audit log entries — spanning several
 * synthetic families/students created BY THIS SCRIPT — so every Finance UI
 * screen can be reviewed in a realistic state during development.
 *
 * IMPORTANT — why a dedicated schoolId, not the real "ydseawoods" tenant:
 * this project has only one Firestore project, shared by local dev AND the
 * real, currently-live production school (ydseawoods). Two legacy services
 * that power the REAL, currently-in-use Invoice/Collections/Fees pages —
 * invoiceService.js's getAllInvoices()/getAllPayments() — query the exact
 * same `invoices`/`payments` collections Finance Foundation writes to, with
 * NO filter on `source`. Seeding demo Finance records against real
 * ydseawoods families/students would make fake "Demo" invoices/payments
 * visible in the real, live legacy pages real staff use today. Using a
 * dedicated, wholly-synthetic schoolId ("finance-demo") avoids this
 * entirely — every legacy read is schoolId-scoped, so nothing created here
 * can ever surface anywhere real staff or parents actually look.
 *
 * Calls Finance Foundation SERVICES directly, not HTTP routes — the
 * FINANCE_FOUNDATION_ENABLED flag only gates route registration and
 * request-time middleware (see middleware/financeFoundationFlag.js), never
 * the services themselves, so this script works whether the flag is on or
 * off.
 *
 * DEV/TEST ONLY. Run explicitly:
 *   node yellowdot-backend/scripts/seedFinanceDemoData.js
 *
 * Idempotent-ish: families/students are only created if they don't already
 * exist (checked via a marker doc). Re-running after that point creates
 * additional payments/refunds/invoices each time — intentional ("more
 * history" is a fine outcome for a dev fixture) but worth knowing before
 * running it repeatedly.
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { db } = require("../firebaseAdmin");

const studentService    = require("../services/studentService");
const familyService     = require("../services/familyService");
const ledgerSvc         = require("../services/studentLedgerService");
const billingPlanSvc    = require("../services/billingPlanService");
const billingEngineSvc  = require("../services/financeBillingEngineService");
const familyAccountSvc  = require("../services/familyAccountService");
const paymentSvc        = require("../services/financePaymentService");
const allocationSvc     = require("../services/financePaymentAllocationService");
const creditConsumeSvc  = require("../services/financeCreditConsumptionService");
const refundSvc         = require("../services/financeRefundReversalService");
const settingsSvc       = require("../services/financeSettingsService");

const SCHOOL_ID    = "finance-demo";   // deliberately NOT process.env.SCHOOL_ID — see note above
const ACTOR        = "demo-seed-script";
const FEE_TEMPLATE_ID = "FEE-DEMO-TUITION";
const REFUND_APPROVAL_THRESHOLD = 1000;

const ctx = { schoolId: SCHOOL_ID, centerId: "", actorUserId: ACTOR };

const DEMO_FAMILIES = [
  { guardian1Name: "Demo Guardian — Sharma",   studentName: "Aarav Sharma",   scenario: "fullyPaid" },
  { guardian1Name: "Demo Guardian — Iyer",     studentName: "Diya Iyer",      scenario: "partialPayment" },
  { guardian1Name: "Demo Guardian — Khan",     studentName: "Zoya Khan",      scenario: "overpaymentCredit" },
  { guardian1Name: "Demo Guardian — Fernandes",studentName: "Leo Fernandes",  scenario: "refundBoth" },
];

function currentPeriod() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
  return { periodStart: `${y}-${m}-01`, periodEnd: `${y}-${m}-${lastDay}` };
}

async function ensureFeeTemplate() {
  const ref = db.collection("feeTemplates").doc(FEE_TEMPLATE_ID);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      schoolId: SCHOOL_ID,
      templateName: "Monthly Tuition (Demo)",
      amount: 5000,
      createdAt: new Date().toISOString(),
    });
    console.log(`✓ Created demo fee template ${FEE_TEMPLATE_ID} (₹5000/month)`);
  } else {
    console.log(`✓ Demo fee template ${FEE_TEMPLATE_ID} already exists`);
  }
}

async function ensureRefundThreshold() {
  const settings = await settingsSvc.getSettings(SCHOOL_ID);
  if (Number(settings.refundApprovalThreshold) !== REFUND_APPROVAL_THRESHOLD) {
    await settingsSvc.updateSettings(SCHOOL_ID, {
      ...settings,
      refundApprovalThreshold: REFUND_APPROVAL_THRESHOLD,
    }, { actorUserId: ACTOR });
    console.log(`✓ Set refundApprovalThreshold to ₹${REFUND_APPROVAL_THRESHOLD} (so some demo refunds require approval, some auto-process)`);
  }
}

/**
 * Creates (or reuses, if already present from a prior run) the synthetic
 * families + students this demo dataset needs, entirely under the isolated
 * "finance-demo" schoolId. Never touches the real "ydseawoods" tenant.
 */
async function ensureDemoFamiliesAndStudents() {
  const existingFamilies = await familyService.getAll({ schoolId: SCHOOL_ID });
  if (existingFamilies.length >= DEMO_FAMILIES.length) {
    console.log(`✓ ${existingFamilies.length} demo families already exist for schoolId="${SCHOOL_ID}" — reusing them.`);
    return existingFamilies.map((f, i) => ({
      family: f,
      studentId: f.studentIds[0],
      scenario: DEMO_FAMILIES[i % DEMO_FAMILIES.length].scenario,
    }));
  }

  const cases = [];
  for (const def of DEMO_FAMILIES) {
    const studentResult = await studentService.create({
      studentName: def.studentName,
      dob:         "2021-06-15",
      class:       "Toddler",
      admissionDate: new Date().toISOString().slice(0, 10),
      fatherName:  def.guardian1Name,
    }, { schoolId: SCHOOL_ID, actorUserId: ACTOR });

    const familyResult = await familyService.create({
      guardian1Name: def.guardian1Name,
      email:         `${def.guardian1Name.split(" — ")[1].toLowerCase()}.demo@example.invalid`,
      studentIds:    [studentResult.studentId],
    }, { schoolId: SCHOOL_ID, actorUserId: ACTOR });

    cases.push({
      family: { familyId: familyResult.familyId, studentIds: [studentResult.studentId] },
      studentId: studentResult.studentId,
      scenario: def.scenario,
    });
    console.log(`✓ Created demo family ${familyResult.familyId} (${def.guardian1Name}) + student ${studentResult.studentId} (${def.studentName})`);
  }
  return cases;
}

/** Case 1: full-month billing plan, invoice generated, paid in full, allocated. */
async function seedFullyPaid(caseData) {
  const { family, studentId } = caseData;
  const { periodStart, periodEnd } = currentPeriod();

  await ledgerSvc.createLedger(studentId, { ...ctx, familyId: family.familyId });
  const plan = await billingPlanSvc.create({
    studentLedgerId: studentId, feeTemplateId: FEE_TEMPLATE_ID,
    cadence: "monthly", joiningDatePolicy: "fullMonth", startDate: periodStart,
  }, ctx);
  await billingPlanSvc.setStatus(plan.planId, "active", ctx);
  const genResult = await billingEngineSvc.generateInvoiceForPlan(plan.planId, { ...ctx, periodStart, periodEnd });

  const payment = await paymentSvc.recordPayment({
    familyId: family.familyId, studentId, studentName: "",
    amount: 5000, paymentMode: "UPI", notes: "Demo: full payment, on time",
  }, ctx);
  await allocationSvc.allocatePayment(payment.paymentId, { ...ctx, strategyOverride: "oldestDueFirst" });

  console.log(`✓ [Fully Paid] family=${family.familyId} student=${studentId} plan=${plan.planId} invoice=${genResult.invoice?.invoiceId} payment=${payment.paymentId}`);
}

/** Case 2: invoice generated, only partially paid (payment left PartiallyAllocated / balance remains owed). */
async function seedPartialPayment(caseData) {
  const { family, studentId } = caseData;
  const { periodStart, periodEnd } = currentPeriod();

  await ledgerSvc.createLedger(studentId, { ...ctx, familyId: family.familyId });
  const plan = await billingPlanSvc.create({
    studentLedgerId: studentId, feeTemplateId: FEE_TEMPLATE_ID,
    cadence: "monthly", joiningDatePolicy: "fullMonth", startDate: periodStart,
  }, ctx);
  await billingPlanSvc.setStatus(plan.planId, "active", ctx);
  const genResult = await billingEngineSvc.generateInvoiceForPlan(plan.planId, { ...ctx, periodStart, periodEnd });

  const payment = await paymentSvc.recordPayment({
    familyId: family.familyId, studentId, studentName: "",
    amount: 2000, paymentMode: "Cash", notes: "Demo: partial payment",
  }, ctx);
  await allocationSvc.allocatePayment(payment.paymentId, { ...ctx, strategyOverride: "oldestDueFirst" });

  console.log(`✓ [Partial Payment] family=${family.familyId} student=${studentId} plan=${plan.planId} invoice=${genResult.invoice?.invoiceId} payment=${payment.paymentId} (₹2000 of ₹5000 — ₹3000 still owed)`);
}

/** Case 3: overpayment -> leftover auto-credited to the family account, then partially consumed. */
async function seedOverpaymentCredit(caseData) {
  const { family, studentId } = caseData;
  const { periodStart, periodEnd } = currentPeriod();

  await familyAccountSvc.ensureFinanceAccount(family.familyId, ctx);
  await ledgerSvc.createLedger(studentId, { ...ctx, familyId: family.familyId });
  const plan = await billingPlanSvc.create({
    studentLedgerId: studentId, feeTemplateId: FEE_TEMPLATE_ID,
    cadence: "monthly", joiningDatePolicy: "fullMonth", startDate: periodStart,
  }, ctx);
  await billingPlanSvc.setStatus(plan.planId, "active", ctx);
  const genResult = await billingEngineSvc.generateInvoiceForPlan(plan.planId, { ...ctx, periodStart, periodEnd });

  const payment = await paymentSvc.recordPayment({
    familyId: family.familyId, studentId, studentName: "",
    amount: 6500, paymentMode: "BankTransfer", notes: "Demo: overpayment (₹1500 becomes family credit)",
  }, ctx);
  await allocationSvc.allocatePayment(payment.paymentId, {
    ...ctx, strategyOverride: "oldestDueFirst", applyLeftoverToCredit: true,
  });

  // Spend a bit of that credit back down, so Family Account shows both
  // "credit granted" and "credit consumed" history.
  await creditConsumeSvc.applyAvailableCredit(studentId, 500, {
    ...ctx, familyId: family.familyId, sourceId: `demo-credit-consume-${studentId}`,
  });

  console.log(`✓ [Overpayment → Credit] family=${family.familyId} student=${studentId} plan=${plan.planId} invoice=${genResult.invoice?.invoiceId} payment=${payment.paymentId} (₹1500 credited)`);
}

/** Case 4: two payments, two refund requests — one small (auto-processed), one large (Requested, awaiting approval). */
async function seedRefundBoth(caseData) {
  const { family, studentId } = caseData;
  const { periodStart, periodEnd } = currentPeriod();

  await ledgerSvc.createLedger(studentId, { ...ctx, familyId: family.familyId });
  const plan = await billingPlanSvc.create({
    studentLedgerId: studentId, feeTemplateId: FEE_TEMPLATE_ID,
    cadence: "monthly", joiningDatePolicy: "fullMonth", startDate: periodStart,
  }, ctx);
  await billingPlanSvc.setStatus(plan.planId, "active", ctx);
  const genResult = await billingEngineSvc.generateInvoiceForPlan(plan.planId, { ...ctx, periodStart, periodEnd });

  const payment = await paymentSvc.recordPayment({
    familyId: family.familyId, studentId, studentName: "",
    amount: 5000, paymentMode: "Cheque", transactionId: "CHQ-DEMO-0001",
    notes: "Demo: paid in full, later partially refunded twice",
  }, ctx);
  await allocationSvc.allocatePayment(payment.paymentId, { ...ctx, strategyOverride: "oldestDueFirst" });

  const smallRefund = await refundSvc.requestRefund(payment.paymentId, 300, {
    ...ctx, reason: "Demo: small refund, auto-processed (below approval threshold)",
  });
  const largeRefund = await refundSvc.requestRefund(payment.paymentId, 1500, {
    ...ctx, reason: "Demo: large refund, requires manager approval",
  });

  console.log(`✓ [Refunds] family=${family.familyId} student=${studentId} plan=${plan.planId} invoice=${genResult.invoice?.invoiceId} payment=${payment.paymentId}`);
  console.log(`    small refund ${smallRefund.refund?.refundId} → ${smallRefund.processed ? "Processed (auto)" : smallRefund.refund?.status}`);
  console.log(`    large refund ${largeRefund.refund?.refundId} → ${largeRefund.processed ? "Processed (auto)" : largeRefund.refund?.status} (should be "Requested", awaiting approval)`);
}

const SCENARIOS = {
  fullyPaid:          seedFullyPaid,
  partialPayment:     seedPartialPayment,
  overpaymentCredit:  seedOverpaymentCredit,
  refundBoth:         seedRefundBoth,
};

async function main() {
  console.log(`Seeding Finance Platform demo data for schoolId="${SCHOOL_ID}"...`);
  await ensureFeeTemplate();
  await ensureRefundThreshold();

  const cases = await ensureDemoFamiliesAndStudents();
  console.log(`${cases.length} demo famil${cases.length === 1 ? "y" : "ies"} ready.`);

  for (const c of cases) {
    try {
      await SCENARIOS[c.scenario](c);
    } catch (err) {
      console.error(`✗ Scenario "${c.scenario}" failed for family ${c.family.familyId}:`, err.message);
    }
  }

  console.log("\nDone. Every screen (Dashboard, Ledger, Billing Plans, Invoices, Payments, Family Account, Refunds, Audit Log) should now show realistic data for these families.");
  process.exit(0);
}

main().catch(err => {
  console.error("Seed script failed:", err);
  process.exit(1);
});
