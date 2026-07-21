/**
 * Finance Foundation — Sprint 4, M4.5: Refund & Reversal Workflow.
 *
 * Never touches real Firestore. `financePaymentService`/`ledgerEntryService`/
 * `financeSettingsService`/`familyAccountService`/`financeAuditService`
 * are required as whole modules by financeRefundReversalService.js, so
 * each is mockable directly. `db.collection("financeRefunds")` and
 * `db.runTransaction` (for the FREF###### counter) are mocked the same
 * way financeInvoiceService.test.js's own test mocks `db.collection("invoices")`.
 */
const test   = require("node:test");
const assert = require("node:assert");

function withMocks(overrides, fn) {
  return async () => {
    const { db }       = require("../firebaseAdmin");
    const paymentSvc   = require("../services/financePaymentService");
    const ledgerEntrySvc   = require("../services/ledgerEntryService");
    const settingsSvc      = require("../services/financeSettingsService");
    const familyAccountSvc = require("../services/familyAccountService");
    const auditSvc         = require("../services/financeAuditService");
    const svc               = require("../services/financeRefundReversalService");

    const originals = {
      getPayment:       paymentSvc.getPayment,
      appendRefund:     paymentSvc.appendRefund,
      transitionStatus: paymentSvc.transitionStatus,
      createEntry:      ledgerEntrySvc.createEntry,
      getSettings:      settingsSvc.getSettings,
      adjustCreditBalance: familyAccountSvc.adjustCreditBalance,
      logFinanceAudit:  auditSvc.logFinanceAudit,
      collection:       db.collection,
      runTransaction:   db.runTransaction,
    };
    const collectionBound = db.collection.bind(db);

    paymentSvc.getPayment       = overrides.getPayment       || (async () => null);
    paymentSvc.appendRefund     = overrides.appendRefund     || (async (id, amt) => { throw new Error("appendRefund should not be called in this test"); });
    paymentSvc.transitionStatus = overrides.transitionStatus || (async (id, status) => ({ paymentId: id, status }));
    ledgerEntrySvc.createEntry  = overrides.createEntry      || (async () => { throw new Error("createEntry should not be called in this test"); });
    settingsSvc.getSettings     = overrides.getSettings      || (async () => ({ refundApprovalThreshold: 0 }));
    familyAccountSvc.adjustCreditBalance = overrides.adjustCreditBalance || (async () => { throw new Error("adjustCreditBalance should not be called in this test"); });
    auditSvc.logFinanceAudit    = overrides.logFinanceAudit  || (async () => {});

    const refundStore = new Map();
    db.runTransaction = async (txFn) => {
      const fakeTx = { get: async () => ({ exists: false, data: () => ({}) }), set: () => {} };
      return txFn(fakeTx);
    };
    db.collection = (name) => {
      if (name === "financeRefunds") {
        return {
          doc: (id) => ({
            set: async (data) => { refundStore.set(id, data); },
            get: async () => (refundStore.has(id) ? { exists: true, id, data: () => refundStore.get(id) } : { exists: false }),
            update: async (data) => { refundStore.set(id, { ...(refundStore.get(id) || {}), ...data }); },
          }),
        };
      }
      return overrides.collection ? overrides.collection(name, collectionBound) : collectionBound(name);
    };

    try {
      await fn({ svc, refundStore, mocks: { paymentSvc, ledgerEntrySvc, settingsSvc, familyAccountSvc, auditSvc } });
    } finally {
      paymentSvc.getPayment       = originals.getPayment;
      paymentSvc.appendRefund     = originals.appendRefund;
      paymentSvc.transitionStatus = originals.transitionStatus;
      ledgerEntrySvc.createEntry  = originals.createEntry;
      settingsSvc.getSettings     = originals.getSettings;
      familyAccountSvc.adjustCreditBalance = originals.adjustCreditBalance;
      auditSvc.logFinanceAudit    = originals.logFinanceAudit;
      db.collection     = originals.collection;
      db.runTransaction = originals.runTransaction;
    }
  };
}

// ── requestRefund ────────────────────────────────────────────────────

test("requestRefund: rejects a missing paymentId or non-positive amount", withMocks({}, async ({ svc }) => {
  await assert.rejects(() => svc.requestRefund(undefined, 100, {}), (err) => err.code === "VALIDATION");
  await assert.rejects(() => svc.requestRefund("FPAY000001", 0, {}), (err) => err.code === "VALIDATION");
  await assert.rejects(() => svc.requestRefund("FPAY000001", -5, {}), (err) => err.code === "VALIDATION");
}));

test("requestRefund: payment not found -> NOT_FOUND", withMocks({ getPayment: async () => null }, async ({ svc }) => {
  await assert.rejects(() => svc.requestRefund("FPAY000001", 100, {}), (err) => err.code === "NOT_FOUND");
}));

test("requestRefund: a payment not Allocated/PartiallyRefunded cannot be refunded", withMocks({
  getPayment: async () => ({ paymentId: "FPAY000001", status: "Recorded", amount: 1000, refundedAmount: 0, familyId: "FAM-1", studentId: "YD-A" }),
}, async ({ svc }) => {
  await assert.rejects(() => svc.requestRefund("FPAY000001", 100, {}), (err) => err.code === "VALIDATION");
}));

test("requestRefund: rejects an amount exceeding the refundable remainder", withMocks({
  getPayment: async () => ({ paymentId: "FPAY000001", status: "Allocated", amount: 1000, refundedAmount: 700, familyId: "FAM-1", studentId: "YD-A" }),
}, async ({ svc }) => {
  await assert.rejects(() => svc.requestRefund("FPAY000001", 500, {}), (err) => err.code === "VALIDATION"); // only 300 refundable
}));

test("requestRefund: below the approval threshold auto-approves and processes immediately", withMocks({
  getPayment: async () => ({ paymentId: "FPAY000001", status: "Allocated", amount: 1000, refundedAmount: 0, creditAppliedAmount: 0, familyId: "FAM-1", studentId: "YD-A" }),
  getSettings: async () => ({ refundApprovalThreshold: 500 }),
  createEntry: async (studentId, data) => {
    assert.equal(studentId, "YD-A");
    assert.equal(data.type, "refund");
    assert.equal(data.amount, 200);
    assert.equal(data.sourceType, "refund");
    return { entry: { entryId: "LDG-1" }, newBalance: 800, duplicate: false };
  },
  appendRefund: async (paymentId, amount) => ({ paymentId, status: "Allocated", amount: 1000, refundedAmount: amount }),
  transitionStatus: async (id, status) => ({ paymentId: id, status }),
}, async ({ svc }) => {
  const result = await svc.requestRefund("FPAY000001", 200, { schoolId: "school-a", actorUserId: "u1" });
  assert.equal(result.processed, true);
  assert.equal(result.refund.status, "Processed");
  assert.equal(result.payment.status, "PartiallyRefunded");
}));

test("requestRefund: at/above the approval threshold stays Requested, never touches the ledger", withMocks({
  getPayment: async () => ({ paymentId: "FPAY000002", status: "Allocated", amount: 1000, refundedAmount: 0, familyId: "FAM-1", studentId: "YD-B" }),
  getSettings: async () => ({ refundApprovalThreshold: 500 }),
}, async ({ svc }) => {
  const result = await svc.requestRefund("FPAY000002", 600, { schoolId: "school-a", actorUserId: "u1" });
  assert.equal(result.processed, false);
  assert.equal(result.refund.status, "Requested");
}));

// ── approveRefund / rejectRefund ────────────────────────────────────

test("approveRefund: not found -> NOT_FOUND", withMocks({}, async ({ svc }) => {
  await assert.rejects(() => svc.approveRefund("FREF000001", {}), (err) => err.code === "NOT_FOUND");
}));

test("approveRefund: processes a Requested refund, fully resolving the payment to Refunded", withMocks({
  createEntry: async () => ({ entry: { entryId: "LDG-2" }, newBalance: 0, duplicate: false }),
  appendRefund: async (paymentId, amount) => ({ paymentId, status: "Allocated", amount: 1000, refundedAmount: 1000 }),
  transitionStatus: async (id, status) => ({ paymentId: id, status }),
}, async ({ svc, refundStore }) => {
  refundStore.set("FREF000001", {
    refundId: "FREF000001", paymentId: "FPAY000003", familyId: "FAM-1", studentId: "YD-C",
    amount: 1000, status: "Requested", requestedBy: "u1", approvedBy: "", schoolId: "school-a", centerId: "",
    createdAt: "x", updatedAt: "x",
  });

  const result = await svc.approveRefund("FREF000001", { schoolId: "school-a", actorUserId: "approver1" });

  assert.equal(result.refund.status, "Processed");
  assert.equal(result.payment.status, "Refunded");
  assert.equal(refundStore.get("FREF000001").approvedBy, "approver1");
}));

test("approveRefund: a non-Requested refund cannot be approved again", withMocks({}, async ({ svc, refundStore }) => {
  refundStore.set("FREF000002", {
    refundId: "FREF000002", paymentId: "FPAY000004", status: "Processed", schoolId: "school-a",
  });
  await assert.rejects(() => svc.approveRefund("FREF000002", { schoolId: "school-a" }), (err) => err.code === "VALIDATION");
}));

test("rejectRefund: marks a Requested refund Rejected without touching the ledger", withMocks({}, async ({ svc, refundStore }) => {
  refundStore.set("FREF000003", {
    refundId: "FREF000003", paymentId: "FPAY000005", status: "Requested", schoolId: "school-a",
  });
  const result = await svc.rejectRefund("FREF000003", { schoolId: "school-a", actorUserId: "u1", reason: "not eligible" });
  assert.equal(result.status, "Rejected");
  assert.equal(refundStore.get("FREF000003").status, "Rejected");
}));

// ── reversePayment ────────────────────────────────────────────────────

test("reversePayment: rejects a missing paymentId", withMocks({}, async ({ svc }) => {
  await assert.rejects(() => svc.reversePayment(undefined, {}), (err) => err.code === "VALIDATION");
}));

test("reversePayment: payment not found -> NOT_FOUND", withMocks({ getPayment: async () => null }, async ({ svc }) => {
  await assert.rejects(() => svc.reversePayment("FPAY000001", {}), (err) => err.code === "NOT_FOUND");
}));

test("reversePayment: a Refunded payment cannot be reversed (explicit non-goal)", withMocks({
  getPayment: async () => ({ paymentId: "FPAY000006", status: "Refunded", amount: 1000, allocations: [], creditAppliedAmount: 0, familyId: "FAM-1" }),
}, async ({ svc }) => {
  await assert.rejects(() => svc.reversePayment("FPAY000006", { schoolId: "school-a" }), (err) => err.code === "VALIDATION");
}));

test("reversePayment: posts one offsetting adjustment entry per allocation, claws back any applied credit, transitions to Reversed", withMocks({
  getPayment: async () => ({
    paymentId: "FPAY000007", status: "Allocated", amount: 1500,
    allocations: [{ studentLedgerId: "YD-D", amount: 1000 }, { studentLedgerId: "YD-E", amount: 300 }],
    creditAppliedAmount: 200, familyId: "FAM-2",
  }),
  transitionStatus: async (id, status) => ({ paymentId: id, status }),
}, async ({ svc, mocks }) => {
  const createdEntries = [];
  mocks.ledgerEntrySvc.createEntry = async (studentId, data) => {
    createdEntries.push({ studentId, ...data });
    return { entry: { entryId: `LDG-${studentId}` }, newBalance: 0, duplicate: false };
  };
  let creditArgs = null;
  mocks.familyAccountSvc.adjustCreditBalance = async (familyId, delta) => { creditArgs = { familyId, delta }; return { familyId, creditBalance: 0 }; };

  const result = await svc.reversePayment("FPAY000007", { schoolId: "school-a", actorUserId: "u1", reason: "bounced cheque" });

  assert.equal(createdEntries.length, 2);
  assert.equal(createdEntries[0].type, "adjustment");
  assert.equal(createdEntries[0].signedAmountOverride, 1000);
  assert.equal(createdEntries[1].signedAmountOverride, 300);
  assert.equal(creditArgs.delta, -200);
  assert.equal(result.status, "Reversed");
}));

test("reversePayment: a payment with no credit applied never calls adjustCreditBalance", withMocks({
  getPayment: async () => ({
    paymentId: "FPAY000008", status: "Recorded", amount: 500,
    allocations: [], creditAppliedAmount: 0, familyId: "FAM-3",
  }),
  transitionStatus: async (id, status) => ({ paymentId: id, status }),
}, async ({ svc }) => {
  const result = await svc.reversePayment("FPAY000008", { schoolId: "school-a" });
  assert.equal(result.status, "Reversed");
}));

// ── Approval authority: server-side role/permission separation ─────────

test("finance-refund-approval permission: only admin/center_owner/accountant have it — center_admin and teacher do not", () => {
  const { ROLE_PERMISSIONS } = require("../config/permissionsBackend");
  assert.ok(ROLE_PERMISSIONS.admin.includes("finance-refund-approval"));
  assert.ok(ROLE_PERMISSIONS.center_owner.includes("finance-refund-approval"));
  assert.ok(ROLE_PERMISSIONS.accountant.includes("finance-refund-approval"));
  assert.equal(ROLE_PERMISSIONS.center_admin.includes("finance-refund-approval"), false);
  assert.equal(ROLE_PERMISSIONS.teacher.includes("finance-refund-approval"), false);
});

test("authorizeRoute('finance-refund-approval'): rejects a caller with only the general finance-foundation permission", () => {
  const { authorizeRoute } = require("../middleware/authMiddleware");
  const guard = authorizeRoute("finance-refund-approval");

  function mockRes() {
    return { _status: 200, status(c) { this._status = c; return this; }, json(b) { this.body = b; return this; } };
  }

  // center_admin-shaped request: has finance-foundation (can request/reject refunds) but not the approval key.
  let res = mockRes(); let nextCalled = false;
  guard({ user: { role: "center_admin", permissions: ["finance-foundation"] } }, res, () => { nextCalled = true; });
  assert.equal(res._status, 403);
  assert.equal(nextCalled, false);

  // accountant-shaped request: has the approval key -> proceeds.
  res = mockRes(); nextCalled = false;
  guard({ user: { role: "accountant", permissions: ["finance-foundation", "finance-refund-approval"] } }, res, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});
