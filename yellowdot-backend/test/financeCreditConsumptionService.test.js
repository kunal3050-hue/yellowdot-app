/**
 * Finance Foundation — Sprint 4, M4.4: Credit Balance Consumption.
 *
 * Never touches real Firestore. `familyAccountService`/`ledgerEntryService`/
 * `financeAuditService` are required as whole modules by
 * financeCreditConsumptionService.js, so each is mockable directly.
 */
const test   = require("node:test");
const assert = require("node:assert");

function withMocks(overrides, fn) {
  return async () => {
    const familyAccountSvc = require("../services/familyAccountService");
    const ledgerEntrySvc   = require("../services/ledgerEntryService");
    const auditSvc         = require("../services/financeAuditService");
    const svc              = require("../services/financeCreditConsumptionService");

    const originals = {
      getFinanceAccount:   familyAccountSvc.getFinanceAccount,
      adjustCreditBalance: familyAccountSvc.adjustCreditBalance,
      createEntry:         ledgerEntrySvc.createEntry,
      logFinanceAudit:     auditSvc.logFinanceAudit,
    };

    familyAccountSvc.getFinanceAccount   = overrides.getFinanceAccount   || (async () => null);
    familyAccountSvc.adjustCreditBalance = overrides.adjustCreditBalance || (async () => { throw new Error("adjustCreditBalance should not be called in this test"); });
    ledgerEntrySvc.createEntry           = overrides.createEntry         || (async () => { throw new Error("createEntry should not be called in this test"); });
    auditSvc.logFinanceAudit             = overrides.logFinanceAudit     || (async () => {});

    try {
      await fn({ svc, mocks: { familyAccountSvc, ledgerEntrySvc, auditSvc } });
    } finally {
      familyAccountSvc.getFinanceAccount   = originals.getFinanceAccount;
      familyAccountSvc.adjustCreditBalance = originals.adjustCreditBalance;
      ledgerEntrySvc.createEntry           = originals.createEntry;
      auditSvc.logFinanceAudit             = originals.logFinanceAudit;
    }
  };
}

test("applyAvailableCredit: rejects missing studentId/familyId/sourceId before any Firestore access", withMocks({}, async ({ svc }) => {
  await assert.rejects(() => svc.applyAvailableCredit(undefined, 100, { familyId: "FAM-1", sourceId: "INV-1" }), (err) => err.code === "VALIDATION");
  await assert.rejects(() => svc.applyAvailableCredit("YD-A", 100, { sourceId: "INV-1" }), (err) => err.code === "VALIDATION");
  await assert.rejects(() => svc.applyAvailableCredit("YD-A", 100, { familyId: "FAM-1" }), (err) => err.code === "VALIDATION");
}));

test("applyAvailableCredit: rejects a non-positive amount", withMocks({}, async ({ svc }) => {
  await assert.rejects(() => svc.applyAvailableCredit("YD-A", 0, { familyId: "FAM-1", sourceId: "INV-1" }), (err) => err.code === "VALIDATION");
  await assert.rejects(() => svc.applyAvailableCredit("YD-A", -10, { familyId: "FAM-1", sourceId: "INV-1" }), (err) => err.code === "VALIDATION");
}));

test("applyAvailableCredit: no family account -> VALIDATION", withMocks({
  getFinanceAccount: async () => null,
}, async ({ svc }) => {
  await assert.rejects(() => svc.applyAvailableCredit("YD-A", 100, { familyId: "FAM-1", sourceId: "INV-1" }), (err) => err.code === "VALIDATION");
}));

test("applyAvailableCredit: zero available credit applies nothing, never touches the ledger", withMocks({
  getFinanceAccount: async () => ({ familyId: "FAM-1", creditBalance: 0 }),
}, async ({ svc }) => {
  const result = await svc.applyAvailableCredit("YD-A", 500, { familyId: "FAM-1", sourceId: "INV-1" });
  assert.equal(result.creditApplied, 0);
  assert.equal(result.remainingAmount, 500);
}));

test("applyAvailableCredit: applies the full amount when credit fully covers it, decrements the Family Account", withMocks({
  getFinanceAccount: async () => ({ familyId: "FAM-1", creditBalance: 1000 }),
  createEntry: async (studentId, data) => {
    assert.equal(data.type, "creditApplied");
    assert.equal(data.amount, 300);
    assert.equal(data.sourceType, "creditApplication");
    assert.equal(data.sourceId, "INV-1");
    return { entry: { entryId: "LDG-1" }, newBalance: 0, duplicate: false };
  },
}, async ({ svc, mocks }) => {
  let creditArgs = null;
  mocks.familyAccountSvc.adjustCreditBalance = async (familyId, delta, opts) => { creditArgs = { familyId, delta }; return { familyId, creditBalance: 700 }; };

  const result = await svc.applyAvailableCredit("YD-A", 300, { familyId: "FAM-1", sourceId: "INV-1" });

  assert.equal(result.creditApplied, 300);
  assert.equal(result.remainingAmount, 0);
  assert.equal(creditArgs.delta, -300);
}));

test("applyAvailableCredit: partial coverage applies only what's available, leaves the rest as remainingAmount", withMocks({
  getFinanceAccount: async () => ({ familyId: "FAM-1", creditBalance: 200 }),
  createEntry: async (studentId, data) => {
    assert.equal(data.amount, 200);
    return { entry: { entryId: "LDG-2" }, newBalance: 100, duplicate: false };
  },
}, async ({ svc, mocks }) => {
  mocks.familyAccountSvc.adjustCreditBalance = async () => ({ familyId: "FAM-1", creditBalance: 0 });

  const result = await svc.applyAvailableCredit("YD-A", 500, { familyId: "FAM-1", sourceId: "INV-2" });

  assert.equal(result.creditApplied, 200);
  assert.equal(result.remainingAmount, 300);
}));

test("applyAvailableCredit: a duplicate call (same sourceId) does not decrement the Family Account a second time", withMocks({
  getFinanceAccount: async () => ({ familyId: "FAM-1", creditBalance: 700 }),
  createEntry: async () => ({ entry: { entryId: "LDG-EXISTING" }, newBalance: 700, duplicate: true }),
}, async ({ svc, mocks }) => {
  mocks.familyAccountSvc.adjustCreditBalance = async () => { throw new Error("must not be called on a duplicate"); };

  const result = await svc.applyAvailableCredit("YD-A", 300, { familyId: "FAM-1", sourceId: "INV-1" });

  assert.equal(result.duplicate, true);
  assert.equal(result.creditApplied, 300);
}));
