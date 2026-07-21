/**
 * Finance Foundation — Sprint 4, M4.2: Allocation Strategies.
 * Pure functions only — no Firestore, no mocking needed.
 */
const test   = require("node:test");
const assert = require("node:assert");

const strategies = require("../services/financeAllocationStrategies");

test("oldestDueFirst: exact match against a single outstanding ledger settles it fully, no leftover", () => {
  const result = strategies.oldestDueFirst({
    paymentAmount: 3100,
    outstandingLedgers: [{ studentId: "YD-A", currentBalance: 3100, createdAt: "2026-06-01" }],
  });
  assert.deepEqual(result.allocations, [{ studentLedgerId: "YD-A", amount: 3100 }]);
  assert.equal(result.leftoverAmount, 0);
});

test("oldestDueFirst: a partial payment settles only the oldest ledger up to what's owed", () => {
  const result = strategies.oldestDueFirst({
    paymentAmount: 1000,
    outstandingLedgers: [
      { studentId: "YD-A", currentBalance: 3100, createdAt: "2026-06-01" },
      { studentId: "YD-B", currentBalance: 1440, createdAt: "2026-07-01" },
    ],
  });
  assert.deepEqual(result.allocations, [{ studentLedgerId: "YD-A", amount: 1000 }]);
  assert.equal(result.leftoverAmount, 0);
});

test("oldestDueFirst: sweeps across multiple ledgers in oldest-first order, splitting across both", () => {
  const result = strategies.oldestDueFirst({
    paymentAmount: 4000,
    outstandingLedgers: [
      { studentId: "YD-B", currentBalance: 1440, createdAt: "2026-07-16" }, // newer, listed first on purpose
      { studentId: "YD-A", currentBalance: 3100, createdAt: "2026-06-01" }, // older
    ],
  });
  // Oldest (YD-A) settled first for its full 3100, remaining 900 goes to YD-B.
  assert.deepEqual(result.allocations, [
    { studentLedgerId: "YD-A", amount: 3100 },
    { studentLedgerId: "YD-B", amount: 900 },
  ]);
  assert.equal(result.leftoverAmount, 0);
});

test("oldestDueFirst: an overpayment beyond every outstanding ledger becomes leftover", () => {
  const result = strategies.oldestDueFirst({
    paymentAmount: 5000,
    outstandingLedgers: [{ studentId: "YD-A", currentBalance: 3100, createdAt: "2026-06-01" }],
  });
  assert.deepEqual(result.allocations, [{ studentLedgerId: "YD-A", amount: 3100 }]);
  assert.equal(result.leftoverAmount, 1900);
});

test("oldestDueFirst: no outstanding ledgers at all -> the entire amount is leftover", () => {
  const result = strategies.oldestDueFirst({ paymentAmount: 500, outstandingLedgers: [] });
  assert.deepEqual(result.allocations, []);
  assert.equal(result.leftoverAmount, 500);
});

test("manual: accepts an explicit split that exactly matches the payment amount", () => {
  const result = strategies.manual({
    paymentAmount: 1500,
    manualAllocations: [{ studentLedgerId: "YD-A", amount: 1000 }, { studentLedgerId: "YD-B", amount: 500 }],
  });
  assert.equal(result.allocations.length, 2);
  assert.equal(result.leftoverAmount, 0);
});

test("manual: a deliberately partial split leaves an explicit, un-auto-resolved leftover", () => {
  const result = strategies.manual({
    paymentAmount: 1500,
    manualAllocations: [{ studentLedgerId: "YD-A", amount: 1000 }],
  });
  assert.equal(result.leftoverAmount, 500);
});

test("manual: rejects allocations exceeding the payment amount", () => {
  assert.throws(
    () => strategies.manual({ paymentAmount: 100, manualAllocations: [{ studentLedgerId: "YD-A", amount: 200 }] }),
    (err) => err.code === "VALIDATION"
  );
});

test("manual: rejects an empty or missing allocation list", () => {
  assert.throws(() => strategies.manual({ paymentAmount: 100, manualAllocations: [] }), (err) => err.code === "VALIDATION");
  assert.throws(() => strategies.manual({ paymentAmount: 100 }), (err) => err.code === "VALIDATION");
});

test("manual: rejects an entry missing studentLedgerId or with a non-positive amount", () => {
  assert.throws(
    () => strategies.manual({ paymentAmount: 100, manualAllocations: [{ amount: 50 }] }),
    (err) => err.code === "VALIDATION"
  );
  assert.throws(
    () => strategies.manual({ paymentAmount: 100, manualAllocations: [{ studentLedgerId: "YD-A", amount: -5 }] }),
    (err) => err.code === "VALIDATION"
  );
});

test("resolveStrategy: returns the correctly-named function, throws for an unknown name", () => {
  assert.strictEqual(strategies.resolveStrategy("oldestDueFirst"), strategies.oldestDueFirst);
  assert.strictEqual(strategies.resolveStrategy("manual"), strategies.manual);
  assert.throws(() => strategies.resolveStrategy("highestAmountFirst"), (err) => err.code === "VALIDATION");
});
