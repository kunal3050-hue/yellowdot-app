/**
 * Finance Foundation (Sprint 1) — Student Ledger, Ledger Entry, Billing Plan,
 * Family Account extension, Finance Settings.
 *
 * Follows the established test convention (see financeAccessControl.test.js,
 * m12TenantIsolation.test.js): pure validation-failure paths are exercised
 * directly against the real service (safe — they throw synchronously before
 * any Firestore call), and controller-level behavior is tested by
 * monkey-patching the *service* module's exported functions so no test in
 * this file ever touches a real Firestore connection, regardless of what
 * credentials are present in the environment running `node --test`.
 */
const test   = require("node:test");
const assert = require("node:assert");

function mockRes() {
  return { _status: 200, status(c) { this._status = c; return this; }, json(b) { this.body = b; return this; } };
}

// ── Validation — safe, no Firestore call ever reached ──────────────────

test("billingPlanService.create: rejects missing studentLedgerId/feeTemplateId before any Firestore call", async () => {
  const svc = require("../services/billingPlanService");
  await assert.rejects(() => svc.create({}), (err) => err.code === "VALIDATION");
});

test("billingPlanService.create: rejects an invalid cadence", async () => {
  const svc = require("../services/billingPlanService");
  await assert.rejects(
    () => svc.create({ studentLedgerId: "YD001", feeTemplateId: "TPL1", cadence: "weekly" }),
    (err) => err.code === "VALIDATION"
  );
});

test("billingPlanService.setStatus: rejects an invalid status value", async () => {
  const svc = require("../services/billingPlanService");
  await assert.rejects(() => svc.setStatus("BPL000001", "cancelled"), (err) => err.code === "VALIDATION");
});

test("ledgerEntryService.createEntry: rejects an unknown entry type", async () => {
  const svc = require("../services/ledgerEntryService");
  await assert.rejects(
    () => svc.createEntry("YD001", { type: "bonus", amount: 100 }),
    (err) => err.code === "VALIDATION"
  );
});

test("ledgerEntryService.createEntry: rejects a zero/negative amount", async () => {
  const svc = require("../services/ledgerEntryService");
  await assert.rejects(
    () => svc.createEntry("YD001", { type: "charge", amount: 0 }),
    (err) => err.code === "VALIDATION"
  );
  await assert.rejects(
    () => svc.createEntry("YD001", { type: "charge", amount: -50 }),
    (err) => err.code === "VALIDATION"
  );
});

test("ledgerEntryService.createEntry: adjustment without signedAmountOverride is rejected", async () => {
  const svc = require("../services/ledgerEntryService");
  await assert.rejects(
    () => svc.createEntry("YD001", { type: "adjustment", amount: 100 }),
    (err) => err.code === "VALIDATION"
  );
});

test("studentLedgerService.createLedger: rejects a missing studentId", async () => {
  const svc = require("../services/studentLedgerService");
  await assert.rejects(() => svc.createLedger(undefined), (err) => err.code === "VALIDATION");
});

test("studentLedgerService.setStatus: rejects an invalid status", async () => {
  const svc = require("../services/studentLedgerService");
  await assert.rejects(() => svc.setStatus("YD001", "deleted"), (err) => err.code === "VALIDATION");
});

test("financeSettingsService.updateSettings: rejects an invalid defaultJoiningDatePolicy", async () => {
  const svc = require("../services/financeSettingsService");
  await assert.rejects(
    () => svc.updateSettings("school-a", { defaultJoiningDatePolicy: "wheneverTheyFeelLikeIt" }),
    (err) => err.code === "VALIDATION"
  );
});

test("financeSettingsService.updateSettings: rejects an invalid defaultAllocationPolicy", async () => {
  const svc = require("../services/financeSettingsService");
  await assert.rejects(
    () => svc.updateSettings("school-a", { defaultAllocationPolicy: "firstComeFirstServed" }),
    (err) => err.code === "VALIDATION"
  );
});

test("familyAccountService.adjustCreditBalance: rejects a zero delta", async () => {
  const svc = require("../services/familyAccountService");
  await assert.rejects(() => svc.adjustCreditBalance("FAM001", 0), (err) => err.code === "VALIDATION");
});

test("familyAccountService.adjustCreditBalance: rejects a non-numeric delta", async () => {
  const svc = require("../services/familyAccountService");
  await assert.rejects(() => svc.adjustCreditBalance("FAM001", "a lot"), (err) => err.code === "VALIDATION");
});

// ── Enum surface sanity (guards against a silent typo breaking a status/type) ──

test("Enum sets export exactly the statuses/types the design doc specifies", () => {
  const ledgerSvc = require("../services/studentLedgerService");
  const planSvc   = require("../services/billingPlanService");
  const entrySvc  = require("../services/ledgerEntryService");

  assert.deepEqual([...ledgerSvc.STATUSES].sort(), ["active", "archived", "frozen"]);
  assert.deepEqual([...planSvc.STATUSES].sort(), ["active", "draft", "ended", "paused"]);
  assert.deepEqual(
    [...entrySvc.ENTRY_TYPES].sort(),
    ["adjustment", "charge", "creditApplied", "discount", "lateFee", "payment", "refund", "scholarship"]
  );
});

// ── Controller-level tests — service fully monkey-patched, zero Firestore reached ──

test("studentLedgerController.getLedger: 404 when the service returns null (tenant-hidden or absent)", async () => {
  const ctrl = require("../controllers/studentLedgerController");
  const svc  = require("../services/studentLedgerService");
  const orig = svc.getLedger;
  svc.getLedger = async () => null;

  const req = { params: { studentId: "YD999" }, user: { schoolId: "school-a", userId: "u1" } };
  const res = mockRes();
  await ctrl.getLedger(req, res);

  assert.equal(res._status, 404);
  svc.getLedger = orig;
});

test("studentLedgerController.getLedger: 200 with the ledger when the service resolves one", async () => {
  const ctrl = require("../controllers/studentLedgerController");
  const svc  = require("../services/studentLedgerService");
  const orig = svc.getLedger;
  const fake = { studentId: "YD001", schoolId: "school-a", currentBalance: 1500, status: "active" };
  svc.getLedger = async () => fake;

  const req = { params: { studentId: "YD001" }, user: { schoolId: "school-a", userId: "u1" } };
  const res = mockRes();
  await ctrl.getLedger(req, res);

  assert.equal(res._status, 200);
  assert.deepEqual(res.body.ledger, fake);
  svc.getLedger = orig;
});

test("studentLedgerController.createEntry: VALIDATION error from service maps to 400", async () => {
  const ctrl = require("../controllers/studentLedgerController");
  const svc  = require("../services/ledgerEntryService");
  const orig = svc.createEntry;
  svc.createEntry = async () => { const e = new Error("amount must be a positive number."); e.code = "VALIDATION"; throw e; };

  const req = { params: { studentId: "YD001" }, body: { type: "charge", amount: -5 }, user: { schoolId: "school-a", userId: "u1" } };
  const res = mockRes();
  await ctrl.createEntry(req, res);

  assert.equal(res._status, 400);
  assert.equal(res.body.success, false);
  svc.createEntry = orig;
});

test("billingPlanController.create: 200 on success, passes resolved schoolId/actorUserId through", async () => {
  const ctrl = require("../controllers/billingPlanController");
  const svc  = require("../services/billingPlanService");
  const orig = svc.create;
  let capturedCtx = null;
  svc.create = async (data, ctx) => { capturedCtx = ctx; return { planId: "BPL000001", ...data, status: "draft" }; };

  const req = {
    body: { studentLedgerId: "YD001", feeTemplateId: "TPL1" },
    user: { schoolId: "school-a", userId: "staff1" },
  };
  const res = mockRes();
  await ctrl.create(req, res);

  assert.equal(res._status, 200);
  assert.equal(res.body.plan.planId, "BPL000001");
  assert.equal(capturedCtx.schoolId, "school-a");
  assert.equal(capturedCtx.actorUserId, "staff1");
  svc.create = orig;
});

test("familyAccountController.adjustCredit: DUPLICATE-shaped errors are not swallowed as 500 silently — VALIDATION maps to 400", async () => {
  const ctrl = require("../controllers/familyAccountController");
  const svc  = require("../services/familyAccountService");
  const orig = svc.adjustCreditBalance;
  svc.adjustCreditBalance = async () => { const e = new Error("Credit balance cannot go negative."); e.code = "VALIDATION"; throw e; };

  const req = { params: { familyId: "FAM001" }, body: { delta: -999999 }, user: { schoolId: "school-a", userId: "u1" } };
  const res = mockRes();
  await ctrl.adjustCredit(req, res);

  assert.equal(res._status, 400);
  svc.adjustCreditBalance = orig;
});

test("financeSettingsController.getSettings: returns defaults transparently through the controller", async () => {
  const ctrl = require("../controllers/financeSettingsController");
  const svc  = require("../services/financeSettingsService");
  const orig = svc.getSettings;
  svc.getSettings = async (schoolId) => ({ schoolId, defaultJoiningDatePolicy: "fullMonth", lateFeeEnabled: false });

  const req = { user: { schoolId: "school-a", userId: "u1" } };
  const res = mockRes();
  await ctrl.getSettings(req, res);

  assert.equal(res._status, 200);
  assert.equal(res.body.settings.lateFeeEnabled, false);
  svc.getSettings = orig;
});

// ── Feature flag — the module is a no-op unless explicitly enabled ─────────

test("requireFinanceFoundationFlag: 404s (not 403) when the flag is unset, hiding the module entirely", () => {
  const { requireFinanceFoundationFlag } = require("../middleware/financeFoundationFlag");
  const originalEnv = process.env.FINANCE_FOUNDATION_ENABLED;
  delete process.env.FINANCE_FOUNDATION_ENABLED;

  const res = mockRes();
  let nextCalled = false;
  requireFinanceFoundationFlag({}, res, () => { nextCalled = true; });

  assert.equal(res._status, 404);
  assert.equal(nextCalled, false);
  if (originalEnv !== undefined) process.env.FINANCE_FOUNDATION_ENABLED = originalEnv;
});

test("requireFinanceFoundationFlag: passes through when explicitly enabled", () => {
  const { requireFinanceFoundationFlag } = require("../middleware/financeFoundationFlag");
  const originalEnv = process.env.FINANCE_FOUNDATION_ENABLED;
  process.env.FINANCE_FOUNDATION_ENABLED = "true";

  const res = mockRes();
  let nextCalled = false;
  requireFinanceFoundationFlag({}, res, () => { nextCalled = true; });

  assert.equal(nextCalled, true);
  if (originalEnv === undefined) delete process.env.FINANCE_FOUNDATION_ENABLED;
  else process.env.FINANCE_FOUNDATION_ENABLED = originalEnv;
});

// ── Migration stub safety — must refuse to run without explicit confirmation ──

test("financeFoundationMigration: every export refuses to run without the confirmation token", async () => {
  const migration = require("../scripts/financeFoundationMigration");
  await assert.rejects(() => migration.backfillStudentLedger("YD001"), /Refusing to run/);
  await assert.rejects(() => migration.backfillFamilyAccount("FAM001"), /Refusing to run/);
  await assert.rejects(() => migration.backfillSchool("school-a"), /Refusing to run/);
});

test("financeFoundationMigration: even with the token, functions are unimplemented stubs (Sprint 1)", async () => {
  const migration = require("../scripts/financeFoundationMigration");
  const confirm = { confirm: "I_UNDERSTAND_THIS_WILL_WRITE_DATA" };
  await assert.rejects(() => migration.backfillStudentLedger("YD001", confirm), /Not implemented/);
});
