/**
 * Finance Foundation — Sprint 3, M3.3: Rules Engine.
 *
 * Every function under test here is a pure function (no Firestore, no
 * side effects), so unlike every other Finance Foundation test file this
 * one needs no mocking at all — it's the safest test file in the module
 * by construction.
 */
const test   = require("node:test");
const assert = require("node:assert");

const rules = require("../services/financeRulesEngine");

// ── resolveJoiningDateFactor: scenario matrix (policy × timing) ────────

test("resolveJoiningDateFactor: joined before the period started -> full factor (1), regardless of policy", () => {
  for (const policy of ["fullMonth", "prorated", "nextCycle"]) {
    const factor = rules.resolveJoiningDateFactor({
      policy, joiningDate: "2026-06-15", periodStart: "2026-07-01", periodEnd: "2026-07-31",
    });
    assert.equal(factor, 1, `policy ${policy}`);
  }
});

test("resolveJoiningDateFactor: joins after the period already ended -> zero factor (0), regardless of policy", () => {
  for (const policy of ["fullMonth", "prorated", "nextCycle"]) {
    const factor = rules.resolveJoiningDateFactor({
      policy, joiningDate: "2026-08-05", periodStart: "2026-07-01", periodEnd: "2026-07-31",
    });
    assert.equal(factor, 0, `policy ${policy}`);
  }
});

test("resolveJoiningDateFactor: mid-period join, fullMonth policy -> full factor (1)", () => {
  const factor = rules.resolveJoiningDateFactor({
    policy: "fullMonth", joiningDate: "2026-07-15", periodStart: "2026-07-01", periodEnd: "2026-07-31",
  });
  assert.equal(factor, 1);
});

test("resolveJoiningDateFactor: mid-period join, nextCycle policy -> zero factor (0) for this period", () => {
  const factor = rules.resolveJoiningDateFactor({
    policy: "nextCycle", joiningDate: "2026-07-15", periodStart: "2026-07-01", periodEnd: "2026-07-31",
  });
  assert.equal(factor, 0);
});

test("resolveJoiningDateFactor: mid-period join, prorated policy -> exact days-based fraction", () => {
  // July has 31 days. Joining on the 16th means 16 days attended (16th..31st inclusive) out of 31.
  const factor = rules.resolveJoiningDateFactor({
    policy: "prorated", joiningDate: "2026-07-16", periodStart: "2026-07-01", periodEnd: "2026-07-31",
  });
  assert.equal(factor, 16 / 31);
});

test("resolveJoiningDateFactor: prorated, joining exactly on periodStart -> full factor (1)", () => {
  const factor = rules.resolveJoiningDateFactor({
    policy: "prorated", joiningDate: "2026-07-01", periodStart: "2026-07-01", periodEnd: "2026-07-31",
  });
  assert.equal(factor, 1);
});

test("resolveJoiningDateFactor: prorated, joining exactly on periodEnd -> smallest nonzero fraction (1 day)", () => {
  const factor = rules.resolveJoiningDateFactor({
    policy: "prorated", joiningDate: "2026-07-31", periodStart: "2026-07-01", periodEnd: "2026-07-31",
  });
  assert.equal(factor, 1 / 31);
});

test("resolveJoiningDateFactor: rejects an unrecognized policy", () => {
  assert.throws(
    () => rules.resolveJoiningDateFactor({ policy: "biweekly", joiningDate: "2026-07-15", periodStart: "2026-07-01", periodEnd: "2026-07-31" }),
    (err) => err.code === "VALIDATION"
  );
});

test("resolveJoiningDateFactor: rejects periodEnd before periodStart", () => {
  assert.throws(
    () => rules.resolveJoiningDateFactor({ policy: "fullMonth", joiningDate: "2026-07-15", periodStart: "2026-07-31", periodEnd: "2026-07-01" }),
    (err) => err.code === "VALIDATION"
  );
});

test("resolveJoiningDateFactor: rejects an invalid date", () => {
  assert.throws(
    () => rules.resolveJoiningDateFactor({ policy: "fullMonth", joiningDate: "not-a-date", periodStart: "2026-07-01", periodEnd: "2026-07-31" }),
    (err) => err.code === "VALIDATION"
  );
});

// ── resolveSiblingDiscountPercent / applySiblingDiscount ────────────────

const DEFAULT_RULES = [
  { siblingOrder: 2, discountPercent: 10, label: "2nd Child" },
  { siblingOrder: 3, discountPercent: 15, label: "3rd Child" },
  { siblingOrder: 4, discountPercent: 20, label: "4th Child+" },
];

test("resolveSiblingDiscountPercent: first child (order 1 or unset) gets no discount", () => {
  assert.equal(rules.resolveSiblingDiscountPercent({ siblingOrder: 1, discountRules: DEFAULT_RULES }), 0);
  assert.equal(rules.resolveSiblingDiscountPercent({ siblingOrder: undefined, discountRules: DEFAULT_RULES }), 0);
});

test("resolveSiblingDiscountPercent: exact-order matches (2nd, 3rd child)", () => {
  assert.equal(rules.resolveSiblingDiscountPercent({ siblingOrder: 2, discountRules: DEFAULT_RULES }), 10);
  assert.equal(rules.resolveSiblingDiscountPercent({ siblingOrder: 3, discountRules: DEFAULT_RULES }), 15);
});

test("resolveSiblingDiscountPercent: a 5th child falls through to the highest defined rule ('4th Child+')", () => {
  assert.equal(rules.resolveSiblingDiscountPercent({ siblingOrder: 5, discountRules: DEFAULT_RULES }), 20);
});

test("resolveSiblingDiscountPercent: no matching rule at all -> 0, never throws", () => {
  assert.equal(rules.resolveSiblingDiscountPercent({ siblingOrder: 2, discountRules: [] }), 0);
});

test("applySiblingDiscount: no discount applicable -> lines returned unchanged", () => {
  const lines = [{ feeComponentId: "TPL1", amount: 1000 }];
  const result = rules.applySiblingDiscount({ lines, siblingOrder: 1, discountRules: DEFAULT_RULES });
  assert.equal(result.discountPercent, 0);
  assert.equal(result.requiresApproval, false);
  assert.strictEqual(result.lines, lines);
});

test("applySiblingDiscount: applies the resolved percentage as a discount amount per line", () => {
  const lines = [{ feeComponentId: "TPL1", amount: 1000 }, { feeComponentId: "TPL2", amount: 500 }];
  const result = rules.applySiblingDiscount({ lines, siblingOrder: 2, discountRules: DEFAULT_RULES });
  assert.equal(result.discountPercent, 10);
  assert.equal(result.requiresApproval, false);
  assert.equal(result.lines[0].discount, 100);
  assert.equal(result.lines[1].discount, 50);
});

test("applySiblingDiscount: below the approval threshold auto-applies", () => {
  const lines = [{ feeComponentId: "TPL1", amount: 1000 }];
  const result = rules.applySiblingDiscount({ lines, siblingOrder: 2, discountRules: DEFAULT_RULES, discountApprovalThreshold: 12 });
  assert.equal(result.requiresApproval, false);
  assert.equal(result.lines[0].discount, 100);
});

test("applySiblingDiscount: at/above the approval threshold requires approval and leaves lines untouched", () => {
  const lines = [{ feeComponentId: "TPL1", amount: 1000 }];
  const result = rules.applySiblingDiscount({ lines, siblingOrder: 4, discountRules: DEFAULT_RULES, discountApprovalThreshold: 20 });
  assert.equal(result.requiresApproval, true);
  assert.equal(result.discountPercent, 20);
  assert.strictEqual(result.lines, lines); // untouched — no discount silently applied
});

test("applySiblingDiscount: threshold of 0 means no threshold configured -> always auto-applies", () => {
  const lines = [{ feeComponentId: "TPL1", amount: 1000 }];
  const result = rules.applySiblingDiscount({ lines, siblingOrder: 4, discountRules: DEFAULT_RULES, discountApprovalThreshold: 0 });
  assert.equal(result.requiresApproval, false);
  assert.equal(result.lines[0].discount, 200);
});

test("applySiblingDiscount: rejects empty lines", () => {
  assert.throws(
    () => rules.applySiblingDiscount({ lines: [], siblingOrder: 2, discountRules: DEFAULT_RULES }),
    (err) => err.code === "VALIDATION"
  );
});

// ── evaluateBillingPlanInvoice: composition (proration then discount) ──

test("evaluateBillingPlanInvoice: proration is applied before the discount, so discount is off the prorated amount", () => {
  const lines = [{ feeComponentId: "TPL-TUITION", amount: 3100 }]; // divides evenly by 31 for a clean assertion
  const result = rules.evaluateBillingPlanInvoice({
    lines,
    joiningDatePolicy: "prorated",
    joiningDate: "2026-07-16", // 16 of 31 days attended
    periodStart: "2026-07-01",
    periodEnd: "2026-07-31",
    siblingOrder: 2,
    discountRules: DEFAULT_RULES,
  });
  assert.equal(result.joiningDateFactor, 16 / 31);
  assert.equal(result.discountPercent, 10);
  // prorated amount = 3100 * 16/31 = 1600; discount = 10% of 1600 = 160
  assert.equal(result.lines[0].amount, 1600);
  assert.equal(result.lines[0].discount, 160);
});

test("evaluateBillingPlanInvoice: no sibling discount and fullMonth policy -> lines pass through with amounts unchanged, discount 0", () => {
  const lines = [{ feeComponentId: "TPL1", amount: 5000 }];
  const result = rules.evaluateBillingPlanInvoice({
    lines,
    joiningDatePolicy: "fullMonth",
    joiningDate: "2026-06-01",
    periodStart: "2026-07-01",
    periodEnd: "2026-07-31",
    siblingOrder: 1,
    discountRules: DEFAULT_RULES,
  });
  assert.equal(result.joiningDateFactor, 1);
  assert.equal(result.discountPercent, 0);
  assert.equal(result.lines[0].amount, 5000);
  assert.equal(result.lines[0].discount, undefined);
});

test("evaluateBillingPlanInvoice: requiresApproval surfaces and lines' discount stays unset when threshold is hit", () => {
  const lines = [{ feeComponentId: "TPL1", amount: 5000 }];
  const result = rules.evaluateBillingPlanInvoice({
    lines,
    joiningDatePolicy: "fullMonth",
    joiningDate: "2026-06-01",
    periodStart: "2026-07-01",
    periodEnd: "2026-07-31",
    siblingOrder: 4,
    discountRules: DEFAULT_RULES,
    discountApprovalThreshold: 20,
  });
  assert.equal(result.requiresApproval, true);
  assert.equal(result.lines[0].discount, undefined);
});

test("evaluateBillingPlanInvoice: rejects empty lines before any date/discount logic runs", () => {
  assert.throws(
    () => rules.evaluateBillingPlanInvoice({ lines: [], joiningDatePolicy: "fullMonth", joiningDate: "2026-07-01", periodStart: "2026-07-01", periodEnd: "2026-07-31" }),
    (err) => err.code === "VALIDATION"
  );
});
