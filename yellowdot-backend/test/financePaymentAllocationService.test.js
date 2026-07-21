/**
 * Finance Foundation — Sprint 4, M4.2: Payment Allocation Engine.
 *
 * Never touches real Firestore. Every collaborator
 * (financePaymentService/studentLedgerService/ledgerEntryService/
 * familyAccountService/financeAuditService) is required as a whole
 * module by financePaymentAllocationService.js, so each is mockable by
 * reassigning its exported function directly — the same pattern already
 * proven in financeBillingEngineService.test.js.
 */
const test   = require("node:test");
const assert = require("node:assert");

function withMocks(overrides, fn) {
  return async () => {
    const paymentSvc       = require("../services/financePaymentService");
    const studentLedgerSvc = require("../services/studentLedgerService");
    const ledgerEntrySvc   = require("../services/ledgerEntryService");
    const familyAccountSvc = require("../services/familyAccountService");
    const auditSvc         = require("../services/financeAuditService");
    const engine           = require("../services/financePaymentAllocationService");

    const originals = {
      getPayment:        paymentSvc.getPayment,
      appendAllocations: paymentSvc.appendAllocations,
      transitionStatus:  paymentSvc.transitionStatus,
      getLedger:         studentLedgerSvc.getLedger,
      createEntry:       ledgerEntrySvc.createEntry,
      getFinanceAccount:  familyAccountSvc.getFinanceAccount,
      adjustCreditBalance: familyAccountSvc.adjustCreditBalance,
      logFinanceAudit:    auditSvc.logFinanceAudit,
    };

    paymentSvc.getPayment        = overrides.getPayment        || (async () => null);
    paymentSvc.appendAllocations = overrides.appendAllocations || (async (id, allocs, credit, opts) => {
      throw new Error("appendAllocations should not be called in this test");
    });
    paymentSvc.transitionStatus  = overrides.transitionStatus  || (async (id, status) => ({ paymentId: id, status }));
    studentLedgerSvc.getLedger   = overrides.getLedger         || (async () => null);
    ledgerEntrySvc.createEntry   = overrides.createEntry       || (async () => { throw new Error("createEntry should not be called in this test"); });
    familyAccountSvc.getFinanceAccount   = overrides.getFinanceAccount   || (async () => null);
    familyAccountSvc.adjustCreditBalance = overrides.adjustCreditBalance || (async () => { throw new Error("adjustCreditBalance should not be called in this test"); });
    auditSvc.logFinanceAudit     = overrides.logFinanceAudit    || (async () => {});

    try {
      await fn({ engine, mocks: { paymentSvc, studentLedgerSvc, ledgerEntrySvc, familyAccountSvc, auditSvc } });
    } finally {
      paymentSvc.getPayment        = originals.getPayment;
      paymentSvc.appendAllocations = originals.appendAllocations;
      paymentSvc.transitionStatus  = originals.transitionStatus;
      studentLedgerSvc.getLedger   = originals.getLedger;
      ledgerEntrySvc.createEntry   = originals.createEntry;
      familyAccountSvc.getFinanceAccount   = originals.getFinanceAccount;
      familyAccountSvc.adjustCreditBalance = originals.adjustCreditBalance;
      auditSvc.logFinanceAudit     = originals.logFinanceAudit;
    }
  };
}

test("allocatePayment: rejects a missing paymentId", withMocks({}, async ({ engine }) => {
  await assert.rejects(() => engine.allocatePayment(undefined, {}), (err) => err.code === "VALIDATION");
}));

test("allocatePayment: payment not found -> NOT_FOUND", withMocks({
  getPayment: async () => null,
}, async ({ engine }) => {
  await assert.rejects(() => engine.allocatePayment("FPAY000001", {}), (err) => err.code === "NOT_FOUND");
}));

test("allocatePayment: a payment already fully Allocated cannot be allocated again", withMocks({
  getPayment: async () => ({ paymentId: "FPAY000001", status: "Allocated", amount: 500, allocations: [], creditAppliedAmount: 500, familyId: "FAM-1" }),
}, async ({ engine }) => {
  await assert.rejects(() => engine.allocatePayment("FPAY000001", {}), (err) => err.code === "VALIDATION");
}));

test("allocatePayment: happy path — oldestDueFirst exact match settles the single outstanding ledger, reaches Allocated, no credit applied", withMocks({
  getPayment: async () => ({ paymentId: "FPAY000010", status: "Recorded", amount: 3100, allocations: [], creditAppliedAmount: 0, familyId: "FAM-1" }),
  getFinanceAccount: async () => ({ familyId: "FAM-1", paymentAllocationPreference: "oldestDueFirst", studentIds: ["YD-A"] }),
  getLedger: async (studentId) => (studentId === "YD-A" ? { studentId: "YD-A", status: "active", currentBalance: 3100, createdAt: "2026-06-01" } : null),
  createEntry: async (studentId, data) => {
    assert.equal(studentId, "YD-A");
    assert.equal(data.type, "payment");
    assert.equal(data.amount, 3100);
    assert.equal(data.sourceType, "payment");
    assert.equal(data.sourceId, "FPAY000010");
    return { entry: { entryId: "LDG-1" }, newBalance: 0, duplicate: false };
  },
  appendAllocations: async (id, allocs, credit) => ({
    paymentId: id, status: "Recorded", amount: 3100,
    allocations: allocs, creditAppliedAmount: credit,
  }),
  transitionStatus: async (id, status) => ({ paymentId: id, status, amount: 3100 }),
}, async ({ engine }) => {
  const result = await engine.allocatePayment("FPAY000010", { schoolId: "school-a", actorUserId: "u1" });
  assert.equal(result.payment.status, "Allocated");
  assert.equal(result.allocations.length, 1);
  assert.equal(result.creditApplied, 0);
  assert.equal(result.leftoverAmount, 0);
}));

test("allocatePayment: overpayment via oldestDueFirst auto-routes the remainder to Family Account credit", withMocks({
  getPayment: async () => ({ paymentId: "FPAY000011", status: "Recorded", amount: 5000, allocations: [], creditAppliedAmount: 0, familyId: "FAM-2" }),
  getFinanceAccount: async () => ({ familyId: "FAM-2", paymentAllocationPreference: "oldestDueFirst", studentIds: ["YD-B"] }),
  getLedger: async () => ({ studentId: "YD-B", status: "active", currentBalance: 3100, createdAt: "2026-06-01" }),
  createEntry: async () => ({ entry: { entryId: "LDG-2" }, newBalance: 0, duplicate: false }),
  appendAllocations: async (id, allocs, credit) => ({ paymentId: id, status: "Recorded", amount: 5000, allocations: allocs, creditAppliedAmount: credit }),
  transitionStatus: async (id, status) => ({ paymentId: id, status, amount: 5000 }),
}, async ({ engine, mocks }) => {
  let creditArgs = null;
  mocks.familyAccountSvc.adjustCreditBalance = async (familyId, delta, opts) => {
    creditArgs = { familyId, delta, opts };
    return { familyId, creditBalance: delta };
  };

  const result = await engine.allocatePayment("FPAY000011", { schoolId: "school-a", actorUserId: "u1" });

  assert.equal(result.creditApplied, 1900);
  assert.ok(creditArgs, "adjustCreditBalance must be called for the overpayment remainder");
  assert.equal(creditArgs.familyId, "FAM-2");
  assert.equal(creditArgs.delta, 1900);
  assert.equal(result.payment.status, "Allocated");
}));

test("allocatePayment: a deliberately partial manual allocation lands PartiallyAllocated and does not touch credit", withMocks({
  getPayment: async () => ({ paymentId: "FPAY000012", status: "Recorded", amount: 1500, allocations: [], creditAppliedAmount: 0, familyId: "FAM-3" }),
  getFinanceAccount: async () => ({ familyId: "FAM-3", paymentAllocationPreference: "manual", studentIds: ["YD-C", "YD-D"] }),
  getLedger: async (studentId) => ({ studentId, status: "active", currentBalance: 2000, createdAt: "2026-06-01" }),
  createEntry: async (studentId, data) => ({ entry: { entryId: "LDG-3" }, newBalance: 1000, duplicate: false }),
  appendAllocations: async (id, allocs, credit) => ({ paymentId: id, status: "Recorded", amount: 1500, allocations: allocs, creditAppliedAmount: credit }),
}, async ({ engine, mocks }) => {
  let transitionedTo = null;
  mocks.paymentSvc.transitionStatus = async (id, status) => { transitionedTo = status; return { paymentId: id, status, amount: 1500 }; };

  const result = await engine.allocatePayment("FPAY000012", {
    schoolId: "school-a", actorUserId: "u1", strategyOverride: "manual",
    manualAllocations: [{ studentLedgerId: "YD-C", amount: 1000 }],
  });

  assert.equal(transitionedTo, "PartiallyAllocated");
  assert.equal(result.payment.status, "PartiallyAllocated");
  assert.equal(result.creditApplied, 0);
  assert.equal(result.leftoverAmount, 500);
}));

test("allocatePayment: resuming a PartiallyAllocated payment with a second manual call completes it to Allocated", withMocks({
  getPayment: async () => ({
    paymentId: "FPAY000013", status: "PartiallyAllocated", amount: 1500,
    allocations: [{ studentLedgerId: "YD-C", amount: 1000 }], creditAppliedAmount: 0, familyId: "FAM-3",
  }),
  getFinanceAccount: async () => ({ familyId: "FAM-3", paymentAllocationPreference: "manual", studentIds: ["YD-C", "YD-D"] }),
  getLedger: async (studentId) => ({ studentId, status: "active", currentBalance: 800, createdAt: "2026-06-01" }),
  createEntry: async () => ({ entry: { entryId: "LDG-4" }, newBalance: 300, duplicate: false }),
  appendAllocations: async (id, allocs, credit) => ({
    paymentId: id, status: "PartiallyAllocated", amount: 1500,
    allocations: [{ studentLedgerId: "YD-C", amount: 1000 }, ...allocs], creditAppliedAmount: credit,
  }),
  transitionStatus: async (id, status) => ({ paymentId: id, status, amount: 1500 }),
}, async ({ engine }) => {
  // Only 500 remains unresolved (1500 - 1000 already allocated) — the second call allocates exactly that.
  const result = await engine.allocatePayment("FPAY000013", {
    schoolId: "school-a", actorUserId: "u1", strategyOverride: "manual",
    manualAllocations: [{ studentLedgerId: "YD-D", amount: 500 }],
  });

  assert.equal(result.payment.status, "Allocated");
  assert.equal(result.allocations[0].amount, 500);
}));
