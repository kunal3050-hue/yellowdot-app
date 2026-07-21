/**
 * Finance Foundation — Sprint 3, M3.2: Invoice & Invoice Line entities.
 *
 * Same safety discipline as every other Finance Foundation test file:
 * never touches real Firestore. `db.runTransaction` (used here only for
 * the two atomic counters) and `db.collection("invoices").doc(id).set()`
 * are both mocked via a fake `db.collection` override, and
 * `financeAuditService.logFinanceAudit` is mocked directly (whole-module
 * import in financeInvoiceService.js, so this works).
 */
const test   = require("node:test");
const assert = require("node:assert");

test("financeInvoiceService.createInvoice: rejects a missing studentId before any Firestore access", async () => {
  const svc = require("../services/financeInvoiceService");
  await assert.rejects(() => svc.createInvoice({ lines: [{ feeComponentId: "TPL1", amount: 100 }] }), (err) => err.code === "VALIDATION");
});

test("financeInvoiceService.createInvoice: rejects empty/missing lines", async () => {
  const svc = require("../services/financeInvoiceService");
  await assert.rejects(() => svc.createInvoice({ studentId: "YD001", lines: [] }), (err) => err.code === "VALIDATION");
  await assert.rejects(() => svc.createInvoice({ studentId: "YD001" }), (err) => err.code === "VALIDATION");
});

test("financeInvoiceService.createInvoice: rejects a line missing feeComponentId or with a negative amount", async () => {
  const svc = require("../services/financeInvoiceService");
  await assert.rejects(
    () => svc.createInvoice({ studentId: "YD001", lines: [{ amount: 100 }] }),
    (err) => err.code === "VALIDATION"
  );
  await assert.rejects(
    () => svc.createInvoice({ studentId: "YD001", lines: [{ feeComponentId: "TPL1", amount: -5 }] }),
    (err) => err.code === "VALIDATION"
  );
});

test("financeInvoiceService.createInvoice: aggregates lines into legacy-compatible totals, publishes InvoiceGenerated, uses distinct FINV/BINV prefixes", async () => {
  const { db } = require("../firebaseAdmin");
  const auditSvc = require("../services/financeAuditService");
  const invoiceSvc = require("../services/financeInvoiceService");
  const { financeEvents, EVENTS } = require("../services/financeEventPublisher");

  const origRunTransaction  = db.runTransaction;
  const origCollectionRaw   = db.collection;         // for restoration at the end
  const origCollectionBound = db.collection.bind(db); // for the fallback inside the mock — a bare reference loses `this`
  const origLogAudit        = auditSvc.logFinanceAudit;

  let counterCalls = 0;
  db.runTransaction = async (fn) => {
    counterCalls++;
    const fakeTx = {
      get: async () => ({ exists: false, data: () => ({}) }), // first-ever counter value each time
      set: () => {},
    };
    return fn(fakeTx);
  };

  const savedInvoices = [];
  db.collection = (name) => {
    if (name === "invoices") {
      return {
        doc: (id) => ({
          set: async (doc) => { savedInvoices.push({ id, doc }); },
        }),
      };
    }
    return origCollectionBound(name);
  };

  let auditArgs = null;
  auditSvc.logFinanceAudit = async (args) => { auditArgs = args; };

  let received = null;
  financeEvents.once(EVENTS.INVOICE_GENERATED, (payload) => { received = payload; });

  const invoice = await invoiceSvc.createInvoice(
    {
      studentId: "YD020", studentName: "Test Student", billingPlanId: "BPL000001",
      lines: [
        { feeComponentId: "TPL-TUITION", label: "Tuition", amount: 5000 },
        { feeComponentId: "TPL-DAYCARE", label: "Daycare", amount: 2000, gst: 360 },
      ],
    },
    { schoolId: "school-a", centerId: "seawoods", actorUserId: "u1" }
  );

  // Legacy-compatible aggregate fields
  assert.equal(invoice.amount, 7000);
  assert.equal(invoice.gst, 360);
  assert.equal(invoice.discount, 0);
  assert.equal(invoice.totalAmount, 7360);
  assert.equal(invoice.paidAmount, 0);
  assert.equal(invoice.balance, 7360);
  assert.equal(invoice.status, "Pending");

  // Distinct ID/number prefixes, never colliding with legacy INV-* format
  assert.match(invoice.invoiceId, /^FINV\d{6}$/);
  assert.match(invoice.invoiceNumber, /^BINV-\d{6}-\d{5}$/);

  // Lines preserved with computed per-line totals
  assert.equal(invoice.lines.length, 2);
  assert.equal(invoice.lines[1].total, 2000 + 360 - 0);

  // Source/billingPlanId tracked
  assert.equal(invoice.source, "billingPlan");
  assert.equal(invoice.billingPlanId, "BPL000001");

  // Audit + event
  assert.equal(auditArgs.action, "financeInvoice.create");
  assert.equal(auditArgs.meta.lineCount, 2);
  assert.ok(received, "InvoiceGenerated must be published");
  assert.equal(received.totalAmount, 7360);

  assert.equal(savedInvoices.length, 1);

  db.runTransaction = origRunTransaction;
  db.collection     = origCollectionRaw;
  auditSvc.logFinanceAudit = origLogAudit;
});

test("financeInvoiceService.getInvoice: hides a cross-tenant invoice as 'not found'", async () => {
  const { db } = require("../firebaseAdmin");
  const invoiceSvc = require("../services/financeInvoiceService");
  const origCollection = db.collection;

  db.collection = (name) => {
    if (name === "invoices") {
      return {
        doc: () => ({
          get: async () => ({
            exists: true,
            id: "FINV000001",
            data: () => ({ schoolId: "school-B", studentId: "YD099", lines: [], status: "Pending" }),
          }),
        }),
      };
    }
    return origCollection(name);
  };

  const invoice = await invoiceSvc.getInvoice("FINV000001", { schoolId: "school-A" });
  assert.equal(invoice, null);

  db.collection = origCollection;
});
