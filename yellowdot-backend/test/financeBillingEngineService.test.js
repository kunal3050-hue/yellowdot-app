/**
 * Finance Foundation — Sprint 3, M3.4: Manual Billing Engine.
 *
 * Never touches real Firestore. Every collaborator
 * (billingPlanService/financeInvoiceService/ledgerEntryService/
 * financeSettingsService/familyService/financeAuditService) is required
 * as a whole module by financeBillingEngineService.js, so each is
 * mockable here by reassigning its exported function directly — the same
 * pattern already proven in financeInvoiceService.test.js and
 * financeFoundationSprint2.test.js. The two direct `db.collection` reads
 * (feeTemplates, students) are mocked the same way financeInvoiceService's
 * own test mocks `db.collection("invoices")`, with a bound fallback for
 * every other collection name.
 */
const test   = require("node:test");
const assert = require("node:assert");

function withMocks(overrides, fn) {
  return async () => {
    const { db }        = require("../firebaseAdmin");
    const billingPlanSvc = require("../services/billingPlanService");
    const invoiceSvc     = require("../services/financeInvoiceService");
    const ledgerEntrySvc = require("../services/ledgerEntryService");
    const settingsSvc     = require("../services/financeSettingsService");
    const familyService   = require("../services/familyService");
    const auditSvc         = require("../services/financeAuditService");
    const engine            = require("../services/financeBillingEngineService");

    const originals = {
      getPlan:            billingPlanSvc.getPlan,
      findByPlanAndPeriod: invoiceSvc.findByPlanAndPeriod,
      createInvoice:       invoiceSvc.createInvoice,
      createEntry:         ledgerEntrySvc.createEntry,
      getSettings:         settingsSvc.getSettings,
      getDiscountRules:    familyService.getDiscountRules,
      logFinanceAudit:     auditSvc.logFinanceAudit,
      collection:          db.collection,
    };
    const collectionBound = db.collection.bind(db);

    billingPlanSvc.getPlan             = overrides.getPlan             || (async () => null);
    invoiceSvc.findByPlanAndPeriod      = overrides.findByPlanAndPeriod  || (async () => null);
    invoiceSvc.createInvoice            = overrides.createInvoice       || (async () => { throw new Error("createInvoice should not be called in this test"); });
    ledgerEntrySvc.createEntry          = overrides.createEntry         || (async () => { throw new Error("createEntry should not be called in this test"); });
    settingsSvc.getSettings             = overrides.getSettings         || (async () => ({ defaultJoiningDatePolicy: "fullMonth", discountApprovalThreshold: 0 }));
    familyService.getDiscountRules      = overrides.getDiscountRules    || (async () => ({ rules: [] }));
    auditSvc.logFinanceAudit            = overrides.logFinanceAudit     || (async () => {});
    db.collection = overrides.collection || collectionBound;

    try {
      await fn({ engine, mocks: { billingPlanSvc, invoiceSvc, ledgerEntrySvc, settingsSvc, familyService, auditSvc, db } });
    } finally {
      billingPlanSvc.getPlan        = originals.getPlan;
      invoiceSvc.findByPlanAndPeriod = originals.findByPlanAndPeriod;
      invoiceSvc.createInvoice       = originals.createInvoice;
      ledgerEntrySvc.createEntry     = originals.createEntry;
      settingsSvc.getSettings        = originals.getSettings;
      familyService.getDiscountRules = originals.getDiscountRules;
      auditSvc.logFinanceAudit       = originals.logFinanceAudit;
      db.collection = originals.collection;
    }
  };
}

test("generateInvoiceForPlan: rejects a missing planId before any lookup", withMocks({}, async ({ engine }) => {
  await assert.rejects(() => engine.generateInvoiceForPlan(undefined, { periodStart: "2026-07-01", periodEnd: "2026-07-31" }), (err) => err.code === "VALIDATION");
}));

test("generateInvoiceForPlan: rejects missing periodStart/periodEnd", withMocks({}, async ({ engine }) => {
  await assert.rejects(() => engine.generateInvoiceForPlan("BPL000001", {}), (err) => err.code === "VALIDATION");
}));

test("generateInvoiceForPlan: plan not found -> NOT_FOUND", withMocks({
  getPlan: async () => null,
}, async ({ engine }) => {
  await assert.rejects(
    () => engine.generateInvoiceForPlan("BPL000001", { periodStart: "2026-07-01", periodEnd: "2026-07-31" }),
    (err) => err.code === "NOT_FOUND"
  );
}));

test("generateInvoiceForPlan: a non-active plan is rejected", withMocks({
  getPlan: async () => ({ planId: "BPL000001", status: "draft", studentLedgerId: "YD001", feeTemplateId: "TPL1", joiningDatePolicy: "fullMonth", centerId: "seawoods" }),
}, async ({ engine }) => {
  await assert.rejects(
    () => engine.generateInvoiceForPlan("BPL000001", { periodStart: "2026-07-01", periodEnd: "2026-07-31" }),
    (err) => err.code === "VALIDATION"
  );
}));

test("generateInvoiceForPlan: missing fee template is rejected", withMocks({
  getPlan: async () => ({ planId: "BPL000001", status: "active", studentLedgerId: "YD001", feeTemplateId: "TPL-MISSING", joiningDatePolicy: "fullMonth", centerId: "seawoods" }),
  collection: (name) => {
    if (name === "feeTemplates") return { doc: () => ({ get: async () => ({ exists: false }) }) };
    return require("../firebaseAdmin").db.collection.bind(require("../firebaseAdmin").db)(name);
  },
}, async ({ engine }) => {
  await assert.rejects(
    () => engine.generateInvoiceForPlan("BPL000001", { periodStart: "2026-07-01", periodEnd: "2026-07-31" }),
    (err) => err.code === "VALIDATION"
  );
}));

test("generateInvoiceForPlan: happy path — creates Invoice + Ledger Entry, applies proration + sibling discount, audits, non-duplicate", withMocks({
  getPlan: async () => ({
    planId: "BPL000001", status: "active", studentLedgerId: "YD020",
    feeTemplateId: "TPL-TUITION", joiningDatePolicy: "prorated", centerId: "seawoods",
  }),
  findByPlanAndPeriod: async () => null,
  getSettings: async () => ({ defaultJoiningDatePolicy: "prorated", discountApprovalThreshold: 0 }),
  getDiscountRules: async () => ({ rules: [{ siblingOrder: 2, discountPercent: 10, label: "2nd Child" }] }),
  collection: (name) => {
    if (name === "feeTemplates") {
      return { doc: () => ({ get: async () => ({ exists: true, data: () => ({ templateName: "Tuition", amount: 3100, schoolId: "school-a" }) }) }) };
    }
    if (name === "students") {
      return { doc: () => ({ get: async () => ({ exists: true, data: () => ({ name: "Test Student", admissionDate: "2026-07-16", siblingOrder: 2, schoolId: "school-a" }) }) }) };
    }
    return require("../firebaseAdmin").db.collection.bind(require("../firebaseAdmin").db)(name);
  },
  createInvoice: async (data) => ({
    invoiceId: "FINV000009", invoiceNumber: "BINV-202607-00009",
    studentId: data.studentId, totalAmount: data.lines.reduce((s, l) => s + l.amount - (l.discount || 0), 0),
    lines: data.lines,
  }),
  createEntry: async (studentId, data) => {
    assert.equal(studentId, "YD020");
    assert.equal(data.type, "charge");
    assert.equal(data.sourceType, "invoice");
    assert.equal(data.sourceId, "FINV000009");
    return { entry: { entryId: "LDG-1", ...data }, newBalance: data.amount, duplicate: false };
  },
}, async ({ engine, mocks }) => {
  let auditActions = [];
  mocks.auditSvc.logFinanceAudit = async (args) => { auditActions.push(args.action); };

  const result = await engine.generateInvoiceForPlan("BPL000001", {
    schoolId: "school-a", centerId: "seawoods", actorUserId: "u1",
    periodStart: "2026-07-01", periodEnd: "2026-07-31",
  });

  // 3100 * 16/31 = 1600; 10% discount = 160 -> total 1440
  assert.equal(result.invoice.totalAmount, 1440);
  assert.equal(result.ledgerEntry.amount, 1440);
  assert.equal(result.newBalance, 1440);
  assert.equal(result.duplicate, false);
  assert.ok(auditActions.includes("billingEngine.generateInvoice"));
}));

test("generateInvoiceForPlan: a discount requiring approval throws REQUIRES_APPROVAL and never creates an invoice", withMocks({
  getPlan: async () => ({
    planId: "BPL000002", status: "active", studentLedgerId: "YD030",
    feeTemplateId: "TPL-TUITION", joiningDatePolicy: "fullMonth", centerId: "seawoods",
  }),
  findByPlanAndPeriod: async () => null,
  getSettings: async () => ({ defaultJoiningDatePolicy: "fullMonth", discountApprovalThreshold: 15 }),
  getDiscountRules: async () => ({ rules: [{ siblingOrder: 4, discountPercent: 20, label: "4th Child+" }] }),
  collection: (name) => {
    if (name === "feeTemplates") return { doc: () => ({ get: async () => ({ exists: true, data: () => ({ templateName: "Tuition", amount: 5000, schoolId: "school-a" }) }) }) };
    if (name === "students") return { doc: () => ({ get: async () => ({ exists: true, data: () => ({ name: "Test Student", admissionDate: "2026-01-01", siblingOrder: 4, schoolId: "school-a" }) }) }) };
    return require("../firebaseAdmin").db.collection.bind(require("../firebaseAdmin").db)(name);
  },
}, async ({ engine }) => {
  await assert.rejects(
    () => engine.generateInvoiceForPlan("BPL000002", { schoolId: "school-a", periodStart: "2026-07-01", periodEnd: "2026-07-31" }),
    (err) => err.code === "REQUIRES_APPROVAL"
  );
}));

test("generateInvoiceForPlan: idempotent replay — an already-existing invoice for this period is not recreated, but the ledger entry is still (idempotently) ensured", withMocks({
  getPlan: async () => ({
    planId: "BPL000003", status: "active", studentLedgerId: "YD040",
    feeTemplateId: "TPL-TUITION", joiningDatePolicy: "fullMonth", centerId: "seawoods",
  }),
  findByPlanAndPeriod: async () => ({
    invoiceId: "FINV000010", invoiceNumber: "BINV-202607-00010", studentId: "YD040", totalAmount: 5000,
  }),
  createEntry: async (studentId, data) => {
    assert.equal(data.sourceId, "FINV000010");
    // Simulate ledgerEntryService's own M3.1 idempotency already having a match.
    return { entry: { entryId: "LDG-EXISTING" }, newBalance: 5000, duplicate: true };
  },
}, async ({ engine, mocks }) => {
  // Guard: createInvoice must never be called on this path.
  mocks.invoiceSvc.createInvoice = async () => { throw new Error("must not create a duplicate invoice"); };

  const result = await engine.generateInvoiceForPlan("BPL000003", {
    schoolId: "school-a", periodStart: "2026-07-01", periodEnd: "2026-07-31",
  });

  assert.equal(result.invoice.invoiceId, "FINV000010");
  assert.equal(result.duplicate, true);
}));

test("generateInvoiceForPlan: a fully-discounted (zero-total) invoice creates no Ledger Entry", withMocks({
  getPlan: async () => ({
    planId: "BPL000004", status: "active", studentLedgerId: "YD050",
    feeTemplateId: "TPL-TUITION", joiningDatePolicy: "fullMonth", centerId: "seawoods",
  }),
  findByPlanAndPeriod: async () => null,
  createInvoice: async () => ({ invoiceId: "FINV000011", invoiceNumber: "BINV-202607-00011", studentId: "YD050", totalAmount: 0, lines: [] }),
  createEntry: async () => { throw new Error("must not post a zero-amount ledger entry"); },
  collection: (name) => {
    if (name === "feeTemplates") return { doc: () => ({ get: async () => ({ exists: true, data: () => ({ templateName: "Tuition", amount: 0, schoolId: "school-a" }) }) }) };
    if (name === "students") return { doc: () => ({ get: async () => ({ exists: true, data: () => ({ name: "Test Student", admissionDate: "2026-01-01", siblingOrder: 0, schoolId: "school-a" }) }) }) };
    return require("../firebaseAdmin").db.collection.bind(require("../firebaseAdmin").db)(name);
  },
}, async ({ engine }) => {
  const result = await engine.generateInvoiceForPlan("BPL000004", {
    schoolId: "school-a", periodStart: "2026-07-01", periodEnd: "2026-07-31",
  });
  assert.equal(result.invoice.totalAmount, 0);
  assert.equal(result.ledgerEntry, null);
  assert.equal(result.newBalance, null);
}));
