/**
 * billingMoney.test.js — Billing & Payments · the arithmetic
 *
 * This file is where the module can be wrong about money, so every rule in
 * billingMoney.js gets a test, and each one is here for a named reason rather
 * than for coverage.
 *
 * The two defects these guard against are both real history:
 *   - The pre-deletion module summed invoice amounts with a plain float
 *     reduce, which is how a fully-paid invoice ends up with a balance of
 *     0.009999999999990905 and reads Partial forever.
 *   - It also derived status with `total > 0 && paid >= total`, so an invoice
 *     credited down to zero fell through to Overdue and chased a family for ₹0.
 */

const test   = require("node:test");
const assert = require("node:assert");
const M      = require("../services/billingMoney");

// ── money() ──────────────────────────────────────────────────────────────────

test("money() rounds to paise and refuses anything that is not a number", () => {
  assert.equal(M.money(1200), 1200);
  assert.equal(M.money(1200.456), 1200.46);
  assert.equal(M.money(1200.454), 1200.45);

  // Form fields arrive as strings; legacy rows carried formatted rupees.
  assert.equal(M.money("1200"), 1200);
  assert.equal(M.money("1,200.50"), 1200.50);
  assert.equal(M.money("₹1200"), 1200);

  for (const junk of [null, undefined, "", "abc", NaN, Infinity, -Infinity, {}, []]) {
    assert.equal(M.money(junk), 0, `money(${JSON.stringify(junk)}) should be 0`);
  }
});

test("money() keeps a negative amount negative — credit notes depend on it", () => {
  assert.equal(M.money(-500), -500);
  assert.equal(M.money("-500.75"), -500.75);
});

// ── sumMoney() ───────────────────────────────────────────────────────────────

test("sumMoney() is exact where a float reduce is not", () => {
  const amounts = [1041.35, 2678.95, 310.70];

  // The bug this exists to prevent, demonstrated rather than asserted about:
  const naive = amounts.reduce((t, n) => t + n, 0);
  assert.notEqual(naive, 4031, "float addition is expected to drift here");

  assert.equal(M.sumMoney(amounts), 4031);
});

test("sumMoney() stays exact across thirty lines, where rounding once does not", () => {
  // Thirty children at 0.07 is 2.10 exactly. Summing as floats and rounding at
  // the end happens to work here; summing as floats and rounding per step does
  // not, and neither survives arbitrary line counts. Integer paise always do.
  const lines = Array.from({ length: 30 }, () => ({ amount: 0.07 }));
  assert.equal(M.sumMoney(lines, "amount"), 2.10);

  const awkward = Array.from({ length: 100 }, () => ({ amount: 33.33 }));
  assert.equal(M.sumMoney(awkward, "amount"), 3333);
});

test("sumMoney() reads a named field, and handles the empty and junk cases", () => {
  assert.equal(M.sumMoney([{ amount: 10.1 }, { amount: 20.2 }], "amount"), 30.3);
  assert.equal(M.sumMoney([], "amount"), 0);
  assert.equal(M.sumMoney(null, "amount"), 0);
  assert.equal(M.sumMoney([{ amount: "500" }, { amount: null }], "amount"), 500);
});

test("sumMoney() nets a credit note against its lines", () => {
  const lines       = [{ amount: 4500 }, { amount: 2000 }];
  const adjustments = [{ amount: -1500 }];
  assert.equal(M.addMoney(M.sumMoney(lines, "amount"), M.sumMoney(adjustments, "amount")), 5000);
});

// ── add / subtract / equal ───────────────────────────────────────────────────

test("addMoney and subtractMoney are exact at the paise", () => {
  assert.equal(M.addMoney(0.1, 0.2), 0.3);
  assert.notEqual(0.1 + 0.2, 0.3, "plain float addition is expected to drift here");

  assert.equal(M.subtractMoney(4500, 4499.99), 0.01);
  assert.equal(M.subtractMoney(1000, 1000), 0);
  assert.equal(M.subtractMoney(100, 250), -150);
});

test("a balance driven to zero by repeated partial payments lands exactly on zero", () => {
  // Three payments of a third of 1000 each. This is the case that leaves a
  // float balance at a fraction of a paise and an invoice stuck on Partial.
  let balance = 1000;
  for (const paid of [333.33, 333.33, 333.34]) {
    balance = M.subtractMoney(balance, paid);
  }
  assert.equal(balance, 0);
  assert.equal(M.statusFor({ totalAmount: 1000, paidAmount: 1000, dueDate: "2020-01-01" }), "Paid");
});

test("equalMoney compares to the paise, not by identity", () => {
  assert.ok(M.equalMoney(0.1 + 0.2, 0.3));
  assert.ok(M.equalMoney("1200.00", 1200));
  assert.ok(!M.equalMoney(1200, 1200.01));
});

// ── Dates ────────────────────────────────────────────────────────────────────

test("localDate formats in local time, not UTC", () => {
  // 31 August at 00:30 local. toISOString() in any positive-offset zone
  // (IST is +05:30) resolves this to the 30th, which is the bug.
  const d = new Date(2026, 7, 31, 0, 30, 0);
  assert.equal(M.localDate(d), "2026-08-31");
});

test("localDate pads single-digit months and days", () => {
  assert.equal(M.localDate(new Date(2026, 0, 5)), "2026-01-05");
  assert.equal(M.localDate(new Date(2026, 10, 9)), "2026-11-09");
});

test("periodOf is the local YYYY-MM", () => {
  assert.equal(M.periodOf(new Date(2026, 7, 31, 0, 30)), "2026-08");
  assert.equal(M.periodOf(new Date(2026, 0, 1)), "2026-01");
});

test("periodEnd lands on the real last day, February and leap years included", () => {
  assert.equal(M.periodEnd("2026-08"), "2026-08-31");
  assert.equal(M.periodEnd("2026-09"), "2026-09-30");
  assert.equal(M.periodEnd("2026-02"), "2026-02-28");
  assert.equal(M.periodEnd("2028-02"), "2028-02-29");
  assert.equal(M.periodEnd("2026-12"), "2026-12-31");
});

test("periodEnd refuses a malformed period rather than guessing", () => {
  for (const bad of ["2026-13", "2026", "26-08", "", null, "2026-00"]) {
    assert.throws(() => M.periodEnd(bad), /not a YYYY-MM period/,
      `periodEnd(${JSON.stringify(bad)}) should throw`);
  }
});

test("isPeriod and isISODate accept only well-formed values", () => {
  assert.ok(M.isPeriod("2026-08"));
  assert.ok(!M.isPeriod("2026-8"));
  assert.ok(!M.isPeriod("2026-08-01"));

  assert.ok(M.isISODate("2026-08-31"));
  assert.ok(!M.isISODate("31-08-2026"));
  assert.ok(!M.isISODate("2026-08"));
  assert.ok(!M.isISODate(20260831));
});

// ── statusFor() ──────────────────────────────────────────────────────────────

test("statusFor derives every state from the numbers", () => {
  const due = "2026-11-30";
  const asOf = "2026-11-24";

  assert.equal(M.statusFor({ totalAmount: 5000, paidAmount: 0,    dueDate: due, asOf }), "Pending");
  assert.equal(M.statusFor({ totalAmount: 5000, paidAmount: 2000, dueDate: due, asOf }), "Partial");
  assert.equal(M.statusFor({ totalAmount: 5000, paidAmount: 5000, dueDate: due, asOf }), "Paid");
});

test("statusFor reads Overdue only once the due date has actually passed", () => {
  const asOf = "2026-11-24";
  assert.equal(M.statusFor({ totalAmount: 5000, paidAmount: 0, dueDate: "2026-11-23", asOf }), "Overdue");
  assert.equal(M.statusFor({ totalAmount: 5000, paidAmount: 0, dueDate: "2026-11-24", asOf }), "Pending",
    "an invoice due today is not yet overdue");
  assert.equal(M.statusFor({ totalAmount: 5000, paidAmount: 0, dueDate: "", asOf }), "Pending",
    "no due date cannot be overdue");
});

test("a paid invoice stays Paid after its due date passes", () => {
  assert.equal(
    M.statusFor({ totalAmount: 5000, paidAmount: 5000, dueDate: "2020-01-01", asOf: "2026-11-24" }),
    "Paid",
  );
});

test("an invoice credited down to zero reads Paid, not Overdue", () => {
  // The regression: the deleted rebuild guarded this with
  // `total > 0 && paid >= total`, so a fully credited invoice fell through to
  // the Overdue branch and chased a family for nothing.
  assert.equal(
    M.statusFor({ totalAmount: 0, paidAmount: 0, dueDate: "2020-01-01", asOf: "2026-11-24" }),
    "Paid",
  );
});

test("statusFor treats an overpayment as Paid rather than inventing a state", () => {
  assert.equal(M.statusFor({ totalAmount: 5000, paidAmount: 5500, dueDate: "2026-11-30" }), "Paid");
});

test("voided beats every other signal", () => {
  assert.equal(
    M.statusFor({ totalAmount: 5000, paidAmount: 0, dueDate: "2020-01-01", voided: true }),
    "Void",
  );
  assert.ok(M.INVOICE_STATUSES.includes("Void"));
});

// ── agingBucket() ────────────────────────────────────────────────────────────

test("agingBucket puts an unpaid invoice in the right bucket", () => {
  const asOf = "2026-11-24";
  assert.equal(M.agingBucket("2026-12-01", asOf), "current");
  assert.equal(M.agingBucket("2026-11-24", asOf), "current", "due today is current");
  assert.equal(M.agingBucket("2026-11-23", asOf), "1-30");
  assert.equal(M.agingBucket("2026-10-25", asOf), "1-30");
  assert.equal(M.agingBucket("2026-10-24", asOf), "31-60");
  assert.equal(M.agingBucket("2026-09-25", asOf), "31-60");
  assert.equal(M.agingBucket("2026-08-26", asOf), "61-90");
  assert.equal(M.agingBucket("2026-08-25", asOf), "90+");
  assert.equal(M.agingBucket("", asOf), "current");
});

// ── collectionRate() ─────────────────────────────────────────────────────────

test("collectionRate is collected over billed, to one decimal", () => {
  assert.equal(M.collectionRate(1200, 900), 75);
  assert.equal(M.collectionRate(3000, 1000), 33.3);
  assert.equal(M.collectionRate(5000, 5000), 100);
});

test("collectionRate is 0 when nothing is billed, rather than dividing by zero", () => {
  assert.equal(M.collectionRate(0, 0), 0);
  assert.equal(M.collectionRate(0, 500), 0);
});
