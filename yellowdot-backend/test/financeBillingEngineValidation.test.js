/**
 * Finance Foundation — Sprint 3 Wrap-Up: Manual Billing Engine Validation.
 *
 * Requested by the user before Sprint 4 (Payments) begins: "validate the
 * Manual Billing Engine with realistic scenarios... prove that invoices,
 * ledger entries, balances, and audit logs remain perfectly consistent
 * under normal operational use."
 *
 * Unlike every other Finance Foundation test file, this one does NOT mock
 * each service's functions individually — it runs the REAL, unmodified
 * service code (studentLedgerService, billingPlanService,
 * ledgerEntryService, financeInvoiceService, financeRulesEngine,
 * financeBillingEngineService, financeSettingsService,
 * financeAuditService, familyService.getDiscountRules) against one
 * shared in-memory fake Firestore (test/helpers/fakeFirestore.js), so a
 * genuine cross-service integration bug would actually surface. This is
 * deliberately a different (heavier, more realistic) validation style
 * than the per-milestone unit tests already covering error paths and
 * edge cases in isolation — those remain the source of truth for
 * exhaustive error-behavior coverage; this file's job is end-to-end
 * consistency under realistic, ordinary use.
 *
 * Real Firestore is never touched: db.collection/db.runTransaction are
 * redirected to the fake for this file's entire run and restored after.
 *
 * Scenarios covered, matching the user's exact validation checklist:
 *   1. New admission, full-month billing
 *   2. Mid-month admission, prorated billing
 *   3. Sibling discount
 *   4. Manual invoice regeneration (idempotency)
 *   5. Multiple students within the same family
 *   6. Ledger balance reconciliation
 *   7. Audit log verification
 *   8. Cross-tenant isolation
 *   9. Permission / RBAC verification
 */
const test   = require("node:test");
const assert = require("node:assert");

const { db }           = require("../firebaseAdmin");
const { createFakeFirestore } = require("./helpers/fakeFirestore");

const fake = createFakeFirestore();
const originalCollection    = db.collection;
const originalRunTransaction = db.runTransaction;
db.collection     = fake.collection;
db.runTransaction = fake.runTransaction;

const studentLedgerSvc = require("../services/studentLedgerService");
const billingPlanSvc   = require("../services/billingPlanService");
const ledgerEntrySvc   = require("../services/ledgerEntryService");
const invoiceSvc       = require("../services/financeInvoiceService");
const auditSvc         = require("../services/financeAuditService");
const billingEngine    = require("../services/financeBillingEngineService");

const SCHOOL = "school-validate";
const JULY   = { periodStart: "2026-07-01", periodEnd: "2026-07-31" };
const AUGUST = { periodStart: "2026-08-01", periodEnd: "2026-08-31" };

// One tuition fee template, shared by both students in the family below.
fake.seed("feeTemplates", "TPL-TUITION", { templateName: "Tuition", amount: 3100, schoolId: SCHOOL });

// ── Scenario fixtures: two siblings in the same family ─────────────────
// Child A: admitted well before July — full month owed, first child, no discount.
fake.seed("students", "YD-CHILD-A", {
  name: "Child A", admissionDate: "2026-06-01", siblingOrder: 1, schoolId: SCHOOL,
});
// Child B: admitted mid-July — prorated, second child, sibling discount applies.
fake.seed("students", "YD-CHILD-B", {
  name: "Child B", admissionDate: "2026-07-16", siblingOrder: 2, schoolId: SCHOOL,
});

let planA, planB;

test("Setup: create Student Ledgers and active Billing Plans for both siblings", async () => {
  await studentLedgerSvc.createLedger("YD-CHILD-A", { schoolId: SCHOOL, centerId: "seawoods", familyId: "FAM-1", actorUserId: "staff-1" });
  await studentLedgerSvc.createLedger("YD-CHILD-B", { schoolId: SCHOOL, centerId: "seawoods", familyId: "FAM-1", actorUserId: "staff-1" });

  planA = await billingPlanSvc.create(
    { studentLedgerId: "YD-CHILD-A", feeTemplateId: "TPL-TUITION", joiningDatePolicy: "fullMonth" },
    { schoolId: SCHOOL, centerId: "seawoods", actorUserId: "staff-1" }
  );
  planB = await billingPlanSvc.create(
    { studentLedgerId: "YD-CHILD-B", feeTemplateId: "TPL-TUITION", joiningDatePolicy: "prorated" },
    { schoolId: SCHOOL, centerId: "seawoods", actorUserId: "staff-1" }
  );
  await billingPlanSvc.setStatus(planA.planId, "active", { schoolId: SCHOOL, actorUserId: "staff-1" });
  await billingPlanSvc.setStatus(planB.planId, "active", { schoolId: SCHOOL, actorUserId: "staff-1" });

  assert.ok(planA.planId && planB.planId);
});

// ── Scenario 1: new admission, full-month billing ──────────────────────
let invoiceA1;
test("Scenario 1 — new admission, full-month billing: invoice equals the full fee template amount", async () => {
  const result = await billingEngine.generateInvoiceForPlan(planA.planId, { schoolId: SCHOOL, centerId: "seawoods", actorUserId: "staff-1", ...JULY });
  invoiceA1 = result.invoice;

  assert.equal(result.invoice.totalAmount, 3100); // full month, no proration, no discount
  assert.equal(result.duplicate, false);
  assert.ok(result.ledgerEntry, "a Ledger Entry must be posted for a nonzero invoice");
  assert.equal(result.ledgerEntry.amount, 3100);
  assert.equal(result.newBalance, 3100);

  const ledger = await studentLedgerSvc.getLedger("YD-CHILD-A", { schoolId: SCHOOL });
  assert.equal(ledger.currentBalance, 3100);
});

// ── Scenarios 2 & 3: mid-month admission (prorated) + sibling discount ─
let invoiceB1;
test("Scenarios 2+3 — mid-month admission is prorated, then the sibling discount is applied on top", async () => {
  const result = await billingEngine.generateInvoiceForPlan(planB.planId, { schoolId: SCHOOL, centerId: "seawoods", actorUserId: "staff-1", ...JULY });
  invoiceB1 = result.invoice;

  // Joined 2026-07-16: 16 of 31 days attended -> 3100 * 16/31 = 1600 prorated.
  // 2nd child (siblingOrder 2) -> the built-in default sibling-discount
  // rules give 10% off -> 1600 * 0.9 = 1440.
  assert.equal(result.invoice.lines[0].amount, 1600); // prorated amount, pre-discount
  assert.equal(result.invoice.lines[0].discount, 160); // 10% of the prorated amount
  assert.equal(result.invoice.totalAmount, 1440);
  assert.equal(result.ledgerEntry.amount, 1440);

  const ledger = await studentLedgerSvc.getLedger("YD-CHILD-B", { schoolId: SCHOOL });
  assert.equal(ledger.currentBalance, 1440);
});

// ── Scenario 4: manual invoice regeneration (idempotency) ──────────────
test("Scenario 4 — regenerating the same plan+period is idempotent: no duplicate invoice, no double charge", async () => {
  const before = await studentLedgerSvc.getLedger("YD-CHILD-A", { schoolId: SCHOOL });

  const result = await billingEngine.generateInvoiceForPlan(planA.planId, { schoolId: SCHOOL, centerId: "seawoods", actorUserId: "staff-1", ...JULY });

  assert.equal(result.duplicate, true);
  assert.equal(result.invoice.invoiceId, invoiceA1.invoiceId, "must return the SAME invoice, not a new one");

  const after = await studentLedgerSvc.getLedger("YD-CHILD-A", { schoolId: SCHOOL });
  assert.equal(after.currentBalance, before.currentBalance, "balance must not change on a duplicate regeneration");

  // Confirm there is truly only one invoice document for this plan+period.
  const invoicesForPlanA = fake.all("invoices").filter((d) => d.billingPlanId === planA.planId && d.periodStart === JULY.periodStart);
  assert.equal(invoicesForPlanA.length, 1);
});

// ── Scenario 5: multiple students within the same family ───────────────
test("Scenario 5 — both siblings' ledgers and invoices are computed independently and correctly", async () => {
  const ledgerA = await studentLedgerSvc.getLedger("YD-CHILD-A", { schoolId: SCHOOL });
  const ledgerB = await studentLedgerSvc.getLedger("YD-CHILD-B", { schoolId: SCHOOL });

  assert.equal(ledgerA.currentBalance, 3100); // first child, full month, no discount
  assert.equal(ledgerB.currentBalance, 1440); // second child, prorated + 10% discount
  assert.notEqual(ledgerA.studentId, ledgerB.studentId);
  assert.equal(ledgerA.familyId, ledgerB.familyId, "both siblings share the same family for this scenario");
});

// ── Scenario 6: ledger balance reconciliation ───────────────────────────
test("Scenario 6 — ledger balance always equals the sum of its Ledger Entries' signed amounts", async () => {
  // Add a second month's charge for Child A so there is more than one entry to reconcile.
  const result = await billingEngine.generateInvoiceForPlan(planA.planId, { schoolId: SCHOOL, centerId: "seawoods", actorUserId: "staff-1", ...AUGUST });
  assert.equal(result.duplicate, false);
  assert.equal(result.invoice.totalAmount, 3100);

  const ledger  = await studentLedgerSvc.getLedger("YD-CHILD-A", { schoolId: SCHOOL });
  const entries = await ledgerEntrySvc.listForLedger("YD-CHILD-A", { schoolId: SCHOOL });

  assert.equal(entries.length, 2); // July charge + August charge (the duplicate regeneration posted no third entry)
  const reconciledTotal = entries.reduce((sum, e) => sum + e.signedAmount, 0);
  assert.equal(reconciledTotal, ledger.currentBalance);
  assert.equal(ledger.currentBalance, 6200); // 3100 (July) + 3100 (August)
});

// ── Scenario 7: audit log verification ──────────────────────────────────
test("Scenario 7 — every step of the flow left a matching, retrievable audit log entry", async () => {
  const ledgerLogs = await auditSvc.listForEntity({ schoolId: SCHOOL, entityType: "studentLedger", entityId: "YD-CHILD-A" });
  assert.ok(ledgerLogs.some((l) => l.action === "studentLedger.create"));

  const planLogs = await auditSvc.listForEntity({ schoolId: SCHOOL, entityType: "billingPlan", entityId: planA.planId });
  assert.ok(planLogs.some((l) => l.action === "billingPlan.create"));
  assert.ok(planLogs.some((l) => l.action === "billingPlan.active"));
  assert.ok(planLogs.some((l) => l.action === "billingEngine.generateInvoice"));
  assert.ok(planLogs.some((l) => l.action === "billingEngine.duplicate"), "the regeneration in Scenario 4 must be independently auditable");

  const invoiceLogs = await auditSvc.listForEntity({ schoolId: SCHOOL, entityType: "invoice", entityId: invoiceA1.invoiceId });
  assert.ok(invoiceLogs.some((l) => l.action === "financeInvoice.create"));

  const entryLogsCandidates = fake.all("financeAuditLogs").filter((l) => l.schoolId === SCHOOL && l.entityType === "ledgerEntry");
  assert.ok(entryLogsCandidates.some((l) => l.action === "ledgerEntry.create.charge"));
});

// ── Scenario 8: cross-tenant isolation ──────────────────────────────────
test("Scenario 8 — a different school can never read or act on this school's Billing Plan or Ledger", async () => {
  const OTHER_SCHOOL = "school-other";

  const crossTenantPlan = await billingPlanSvc.getPlan(planA.planId, { schoolId: OTHER_SCHOOL });
  assert.equal(crossTenantPlan, null, "hide, don't reveal — cross-tenant plan lookup must return null, not the real plan");

  const crossTenantLedger = await studentLedgerSvc.getLedger("YD-CHILD-A", { schoolId: OTHER_SCHOOL });
  assert.equal(crossTenantLedger, null);

  await assert.rejects(
    () => billingEngine.generateInvoiceForPlan(planA.planId, { schoolId: OTHER_SCHOOL, actorUserId: "intruder", ...JULY }),
    (err) => err.code === "NOT_FOUND",
    "generating an invoice against another school's plan ID must fail as NOT_FOUND, never succeed or leak data"
  );

  // The real school's data must be completely unaffected by the attempt.
  const ledgerAfterAttempt = await studentLedgerSvc.getLedger("YD-CHILD-A", { schoolId: SCHOOL });
  assert.equal(ledgerAfterAttempt.currentBalance, 6200);
});

// ── Scenario 9: permission / RBAC verification ──────────────────────────
function findRoute(stack, path, method) {
  for (const layer of stack) {
    if (layer.route && layer.route.path === path && layer.route.methods[method]) return layer.route;
    if (layer.handle && layer.handle.stack) {
      const found = findRoute(layer.handle.stack, path, method);
      if (found) return found;
    }
  }
  return null;
}

test("Scenario 9 — the Manual Billing Engine route is gated by the same guard chain as every other Finance Foundation route", async () => {
  process.env.FINANCE_FOUNDATION_ENABLED = "true";
  delete require.cache[require.resolve("../server.js")];
  const app = require("../server.js");

  // Finance Foundation routes are express.Router() instances mounted via
  // app.use(router) — they live inside a sub-router's own .stack, not
  // directly on app.router.stack, so this needs a recursive search.
  const billingPlanRoute = findRoute(app.router.stack, "/api/finance/billing-plans/:planId", "get");
  const engineRoute      = findRoute(app.router.stack, "/api/finance/billing-plans/:planId/generate-invoice", "post");

  assert.ok(billingPlanRoute, "sibling Finance Foundation route must be registered when FINANCE_FOUNDATION_ENABLED=true (sanity check on the search itself)");
  assert.ok(engineRoute, "the Manual Billing Engine route must be registered when FINANCE_FOUNDATION_ENABLED=true");
  // 4 guards (requireFinanceFoundationFlag, authenticate, staffOnly, authorizeRoute) + 1 controller handler —
  // must match the already-verified sibling route's own guard-chain depth exactly.
  assert.equal(engineRoute.stack.length, billingPlanRoute.stack.length);
  assert.equal(engineRoute.stack.length, 5);

  delete require.cache[require.resolve("../server.js")];
  delete process.env.FINANCE_FOUNDATION_ENABLED;
});

test("Scenario 9 — authorizeRoute('finance-foundation') actually discriminates by permission, and staffOnly rejects parents", () => {
  const { authorizeRoute, staffOnly } = require("../middleware/authMiddleware");
  const guard = authorizeRoute("finance-foundation");

  function mockRes() {
    return { _status: 200, status(c) { this._status = c; return this; }, json(b) { this.body = b; return this; } };
  }

  // No user at all -> 401.
  let res = mockRes(); let nextCalled = false;
  guard({ user: null }, res, () => { nextCalled = true; });
  assert.equal(res._status, 401);
  assert.equal(nextCalled, false);

  // Authenticated staff WITHOUT the finance-foundation permission -> 403.
  res = mockRes(); nextCalled = false;
  guard({ user: { role: "teacher", permissions: [] } }, res, () => { nextCalled = true; });
  assert.equal(res._status, 403);
  assert.equal(nextCalled, false);

  // Authenticated staff WITH the finance-foundation permission -> proceeds.
  res = mockRes(); nextCalled = false;
  guard({ user: { role: "accountant", permissions: ["finance-foundation"] } }, res, () => { nextCalled = true; });
  assert.equal(nextCalled, true);

  // A parent must never reach a staff-only Finance route, regardless of permissions array.
  res = mockRes(); nextCalled = false;
  staffOnly({ user: { role: "parent", permissions: ["finance-foundation"] } }, res, () => { nextCalled = true; });
  assert.equal(res._status, 403);
  assert.equal(nextCalled, false);
});

test.after(() => {
  db.collection     = originalCollection;
  db.runTransaction = originalRunTransaction;
});
