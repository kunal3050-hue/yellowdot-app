/**
 * Finance Foundation — Sprint 4, M4.1: Payment Domain Foundation.
 *
 * Same safety discipline as every other Finance Foundation test file:
 * never touches real Firestore. `db.runTransaction` (used here for the
 * FPAY###### counter and for transitionStatus's own transaction) and
 * `db.collection("payments")` are mocked directly.
 */
const test   = require("node:test");
const assert = require("node:assert");

test("financePaymentService.recordPayment: rejects a missing familyId before any Firestore access", async () => {
  const svc = require("../services/financePaymentService");
  await assert.rejects(() => svc.recordPayment({ amount: 100 }), (err) => err.code === "VALIDATION");
});

test("financePaymentService.recordPayment: rejects missing/non-positive amount", async () => {
  const svc = require("../services/financePaymentService");
  await assert.rejects(() => svc.recordPayment({ familyId: "FAM-1" }), (err) => err.code === "VALIDATION");
  await assert.rejects(() => svc.recordPayment({ familyId: "FAM-1", amount: 0 }), (err) => err.code === "VALIDATION");
  await assert.rejects(() => svc.recordPayment({ familyId: "FAM-1", amount: -5 }), (err) => err.code === "VALIDATION");
});

test("financePaymentService.recordPayment: rejects an invalid paymentMode", async () => {
  const svc = require("../services/financePaymentService");
  await assert.rejects(
    () => svc.recordPayment({ familyId: "FAM-1", amount: 100, paymentMode: "Bitcoin" }),
    (err) => err.code === "VALIDATION"
  );
});

test("financePaymentService.recordPayment: creates a Payment in 'Recorded' status with an FPAY###### id, audits the write", async () => {
  const { db }   = require("../firebaseAdmin");
  const auditSvc = require("../services/financeAuditService");
  const svc      = require("../services/financePaymentService");

  const origRunTransaction  = db.runTransaction;
  const origCollectionRaw   = db.collection;
  const origCollectionBound = db.collection.bind(db);
  const origLogAudit        = auditSvc.logFinanceAudit;

  db.runTransaction = async (fn) => {
    const fakeTx = { get: async () => ({ exists: false, data: () => ({}) }), set: () => {} };
    return fn(fakeTx);
  };

  const saved = [];
  db.collection = (name) => {
    if (name === "payments") {
      return { doc: () => ({ set: async (doc) => { saved.push(doc); } }) };
    }
    return origCollectionBound(name);
  };

  let auditArgs = null;
  auditSvc.logFinanceAudit = async (args) => { auditArgs = args; };

  const payment = await svc.recordPayment(
    { familyId: "FAM-1", studentId: "YD001", amount: 5000, paymentMode: "UPI" },
    { schoolId: "school-a", centerId: "seawoods", actorUserId: "u1" }
  );

  assert.match(payment.paymentId, /^FPAY\d{6}$/);
  assert.equal(payment.status, "Recorded");
  assert.equal(payment.receiptNumber, "");
  assert.equal(payment.familyId, "FAM-1");
  assert.equal(payment.amount, 5000);
  assert.deepEqual(payment.allocations, []);
  assert.equal(payment.source, "financeFoundation");

  assert.equal(saved.length, 1);
  assert.equal(auditArgs.action, "financePayment.record");
  assert.equal(auditArgs.meta.amount, 5000);

  db.runTransaction = origRunTransaction;
  db.collection     = origCollectionRaw;
  auditSvc.logFinanceAudit = origLogAudit;
});

test("financePaymentService.getPayment: hides a cross-tenant payment as 'not found'", async () => {
  const { db } = require("../firebaseAdmin");
  const svc    = require("../services/financePaymentService");
  const origCollection = db.collection;

  db.collection = (name) => {
    if (name === "payments") {
      return {
        doc: () => ({
          get: async () => ({ exists: true, id: "FPAY000001", data: () => ({ schoolId: "school-B", familyId: "FAM-9" }) }),
        }),
      };
    }
    return origCollection(name);
  };

  const payment = await svc.getPayment("FPAY000001", { schoolId: "school-A" });
  assert.equal(payment, null);

  db.collection = origCollection;
});

test("financePaymentService.transitionStatus: rejects an invalid transition and leaves status untouched", async () => {
  const { db } = require("../firebaseAdmin");
  const svc    = require("../services/financePaymentService");
  const origRunTransaction = db.runTransaction;

  db.runTransaction = async (fn) => {
    const fakeTx = {
      get: async () => ({ exists: true, data: () => ({ schoolId: "school-a", status: "Refunded" }) }),
      update: () => { throw new Error("must not write on an invalid transition"); },
    };
    return fn(fakeTx);
  };

  await assert.rejects(
    () => svc.transitionStatus("FPAY000001", "Reversed", { schoolId: "school-a" }),
    (err) => err.code === "VALIDATION"
  );

  db.runTransaction = origRunTransaction;
});

test("financePaymentService.transitionStatus: applies a valid transition and audits it", async () => {
  const { db }   = require("../firebaseAdmin");
  const auditSvc = require("../services/financeAuditService");
  const svc      = require("../services/financePaymentService");
  const origRunTransaction = db.runTransaction;
  const origLogAudit       = auditSvc.logFinanceAudit;

  let updateArgs = null;
  db.runTransaction = async (fn) => {
    const fakeTx = {
      get: async () => ({ exists: true, data: () => ({ paymentId: "FPAY000002", schoolId: "school-a", status: "Recorded", amount: 500 }) }),
      update: (ref, data) => { updateArgs = data; },
    };
    return fn(fakeTx);
  };
  let auditArgs = null;
  auditSvc.logFinanceAudit = async (args) => { auditArgs = args; };

  const result = await svc.transitionStatus("FPAY000002", "Allocated", { schoolId: "school-a", actorUserId: "u1" });

  assert.equal(result.status, "Allocated");
  assert.equal(updateArgs.status, "Allocated");
  assert.equal(auditArgs.action, "financePayment.transition.Allocated");

  db.runTransaction = origRunTransaction;
  auditSvc.logFinanceAudit = origLogAudit;
});
