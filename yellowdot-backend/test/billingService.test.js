/**
 * billingService.test.js — Billing & Payments · service behaviour
 *
 * Runs the REAL service against the in-memory fakeFirestore, so the code under
 * test is the code that ships: invoice and receipt numbering go through real
 * transactions, and so does every settlement.
 *
 * What is covered, and why each one is here rather than assumed:
 *   - recording a payment settles its invoice in the same breath. This is the
 *     defect the whole rebuild exists for: the eleven-collection module had no
 *     code path anywhere that marked an invoice paid, so a settled invoice read
 *     Pending forever and the parent app chased families for money they had
 *     already paid.
 *   - invoice and receipt numbers are sequential, gap-free, and scoped per
 *     school. f1796e9 keyed its sequences with no schoolId, so two schools
 *     shared one run of invoice numbers.
 *   - a rejected payment burns NO receipt number.
 *   - itemised invoices total exactly, and a credit note nets against them.
 *   - a reversal is the exact mirror of a payment, and the invoice goes back to
 *     the status it had.
 *   - generation is idempotent on (studentId, period) and puts every matching
 *     plan on ONE invoice rather than raising several.
 *   - every mutation leaves an audit row naming the actor and the amounts.
 *   - cross-school lookups are 404, not 403, so a response never confirms that
 *     another school's record exists. This is the audit's one confirmed
 *     vulnerability, which f1796e9 still carried.
 */

const test   = require("node:test");
const assert = require("node:assert");
const { createFakeFirestore } = require("./helpers/fakeFirestore");
const { db }    = require("../firebaseAdmin");
const billing   = require("../services/billingService");
const audit     = require("../services/billingAuditService");
const { today, periodOf } = require("../services/billingMoney");

const CTX   = { schoolId: "school-a", centerId: "centre-1", actorUserId: "user-admin" };
const OTHER = { schoolId: "school-b", centerId: "centre-9", actorUserId: "user-other" };

const PERIOD = "2026-11";
const DUE    = "2026-11-30";

/** Install a clean in-memory Firestore for one test and restore afterwards. */
function withFakeDb(fn) {
  const saved = {
    collection:     db.collection,
    runTransaction: db.runTransaction,
    batch:          db.batch,
  };
  const fake = createFakeFirestore();
  db.collection     = fake.collection;
  db.runTransaction = fake.runTransaction;
  db.batch          = fake.batch;
  return (async () => {
    try { return await fn(fake); }
    finally { Object.assign(db, saved); }
  })();
}

function seedStudent(fake, id, over = {}) {
  fake.seed("students", id, {
    studentId: id, studentName: `Child ${id}`, class: "Playgroup",
    status: "Active", schoolId: CTX.schoolId, centerId: CTX.centerId, ...over,
  });
}

/** A plan, an active child, and one invoice for that child. */
async function seedBilled(fake, { amount = 5000, studentId = "YD001", lines } = {}) {
  seedStudent(fake, studentId);
  const plan = await billing.createPlan(
    { name: "Monthly Tuition", feeType: "tuition", amount, cadence: "monthly" }, CTX,
  );
  const invoice = await billing.createInvoice({
    studentId, period: PERIOD, dueDate: DUE,
    lines: lines || [{ planId: plan.planId }],
  }, CTX);
  return { plan, invoice };
}

// ── Fee plans ────────────────────────────────────────────────────────────────

test("a plan is created, listed and read back with its own amount", () => withFakeDb(async () => {
  const plan = await billing.createPlan({
    name: "Daycare — full day", feeType: "daycare", amount: "3500.50", cadence: "monthly",
    classes: ["Playgroup", "Nursery"],
  }, CTX);

  assert.equal(plan.name, "Daycare — full day");
  assert.equal(plan.amount, 3500.50);
  assert.equal(plan.feeType, "daycare");
  assert.deepEqual(plan.classes, ["Playgroup", "Nursery"]);
  assert.ok(plan.active);
  assert.ok(plan.planId, "a plan gets an id");

  const plans = await billing.listPlans({ schoolId: CTX.schoolId });
  assert.equal(plans.length, 1);
  assert.equal((await billing.getPlan(plan.planId, CTX)).amount, 3500.50);
}));

test("a plan refuses a bad name, amount, fee type or cadence", () => withFakeDb(async () => {
  const bad = [
    [{ name: "", amount: 100 },                              /needs a name/],
    [{ name: "x".repeat(81), amount: 100 },                  /80 characters/],
    [{ name: "Fee", amount: 0 },                             /greater than zero/],
    [{ name: "Fee", amount: -500 },                          /greater than zero/],
    [{ name: "Fee", amount: 100, feeType: "pocket_money" },  /not a fee type/],
    [{ name: "Fee", amount: 100, cadence: "fortnightly" },   /not a billing cadence/],
    [{ name: "Fee", amount: 100, effectiveFrom: "01-01-26" }, /YYYY-MM-DD/],
    [{ name: "Fee", amount: 100, effectiveFrom: "2026-06-01", effectiveTo: "2026-01-01" },
      /cannot be before/],
  ];
  for (const [payload, pattern] of bad) {
    await assert.rejects(() => billing.createPlan(payload, CTX), pattern,
      `createPlan(${JSON.stringify(payload)}) should be refused`);
  }
}));

test("a plan is deactivated, never deleted — invoice lines reference it", () => withFakeDb(async () => {
  const plan = await billing.createPlan({ name: "Transport", feeType: "transport", amount: 800 }, CTX);
  const off  = await billing.deactivatePlan(plan.planId, CTX);

  assert.equal(off.active, false);
  assert.equal((await billing.listPlans({ schoolId: CTX.schoolId })).length, 1,
    "the plan is still there");
  assert.equal((await billing.listPlans({ schoolId: CTX.schoolId, activeOnly: true })).length, 0);
}));

test("changing a plan's amount does not rewrite invoices already raised", () => withFakeDb(async (fake) => {
  const { plan, invoice } = await seedBilled(fake, { amount: 5000 });
  assert.equal(invoice.totalAmount, 5000);

  await billing.updatePlan(plan.planId, { amount: 6000 }, CTX);

  // An invoice is a historical document. A fee revision applies to the next
  // billing run, which is why a plan carries effective dates rather than
  // retrospectively repricing bills a family may already have paid.
  const reread = await billing.getInvoice(invoice.invoiceId, CTX);
  assert.equal(reread.totalAmount, 5000);
  assert.equal(reread.lines[0].amount, 5000);
}));

// ── Tenant isolation ─────────────────────────────────────────────────────────

test("another school's plan is 404, not 403 — and cannot be edited or deactivated", () => withFakeDb(async () => {
  const mine = await billing.createPlan({ name: "Tuition", feeType: "tuition", amount: 5000 }, CTX);

  // The audit's one confirmed vulnerability: PUT/DELETE on a guessable
  // template id with no schoolId comparison. f1796e9 carried it forward.
  await assert.rejects(() => billing.getPlan(mine.planId, OTHER), /not found/);
  await assert.rejects(() => billing.updatePlan(mine.planId, { amount: 1 }, OTHER), /not found/);
  await assert.rejects(() => billing.deactivatePlan(mine.planId, OTHER), /not found/);

  // 404 rather than 403, so the response does not confirm the record exists.
  await billing.getPlan(mine.planId, CTX).catch(() => assert.fail("own plan should be readable"));
  const err = await billing.getPlan(mine.planId, OTHER).catch(e => e);
  assert.equal(err.status, 404);

  // And nothing was actually changed by the refused write.
  assert.equal((await billing.getPlan(mine.planId, CTX)).amount, 5000);
  assert.ok((await billing.getPlan(mine.planId, CTX)).active);
}));

test("another school's invoice and payment are 404 for every operation", () => withFakeDb(async (fake) => {
  const { invoice } = await seedBilled(fake);
  const { payment } = await billing.recordPayment(
    { invoiceId: invoice.invoiceId, amount: 1000, paymentMode: "cash" }, CTX,
  );

  await assert.rejects(() => billing.getInvoice(invoice.invoiceId, OTHER), /not found/);
  await assert.rejects(() => billing.getPayment(payment.paymentId, OTHER), /not found/);
  await assert.rejects(() => billing.voidInvoice(invoice.invoiceId, "nope", OTHER), /not found/);
  await assert.rejects(
    () => billing.addCreditNote(invoice.invoiceId, { amount: 100, reason: "nope" }, OTHER), /not found/);
  await assert.rejects(() => billing.reversePayment(payment.paymentId, "nope", OTHER), /not found/);
  await assert.rejects(
    () => billing.recordPayment({ invoiceId: invoice.invoiceId, amount: 10 }, OTHER), /not found/);

  // The invoice is untouched by any of those refusals.
  const after = await billing.getInvoice(invoice.invoiceId, CTX);
  assert.equal(after.paidAmount, 1000);
  assert.equal(after.voided, false);
}));

test("a list never leaks another school's rows", () => withFakeDb(async (fake) => {
  await seedBilled(fake);
  fake.seed("feeInvoices", "foreign-inv", {
    invoiceId: "foreign-inv", studentId: "ZZ1", schoolId: OTHER.schoolId,
    period: PERIOD, lines: [{ amount: 9999 }], totalAmount: 9999, balance: 9999, status: "Pending",
  });
  fake.seed("feePlans", "foreign-plan", { planId: "foreign-plan", name: "Theirs", amount: 1, schoolId: OTHER.schoolId });

  assert.equal((await billing.listInvoices({ schoolId: CTX.schoolId })).length, 1);
  assert.equal((await billing.listPlans({ schoolId: CTX.schoolId })).length, 1);
  assert.equal((await billing.listInvoices({ schoolId: OTHER.schoolId })).length, 1);
}));

test("an invoice cannot be raised for another school's child", () => withFakeDb(async (fake) => {
  seedStudent(fake, "YD001");
  await assert.rejects(
    () => billing.createInvoice({
      studentId: "YD001", period: PERIOD, dueDate: DUE,
      lines: [{ label: "Fees", amount: 100 }],
    }, OTHER),
    /Student not found/,
  );
}));

// ── Itemised invoices ────────────────────────────────────────────────────────

test("an itemised invoice totals its lines exactly", () => withFakeDb(async (fake) => {
  seedStudent(fake, "YD001");
  const invoice = await billing.createInvoice({
    studentId: "YD001", period: PERIOD, dueDate: DUE,
    lines: [
      { label: "Tuition",   feeType: "tuition",   amount: 1041.35 },
      { label: "Daycare",   feeType: "daycare",   amount: 2678.95 },
      { label: "Transport", feeType: "transport", amount: 310.70 },
    ],
  }, CTX);

  assert.equal(invoice.lines.length, 3);
  assert.equal(invoice.subtotal, 4031);
  assert.equal(invoice.totalAmount, 4031);
  assert.equal(invoice.balance, 4031);
  assert.equal(invoice.paidAmount, 0);
  assert.equal(invoice.status, "Pending");
  assert.deepEqual(invoice.lines.map(l => l.lineId), ["L1", "L2", "L3"]);
}));

test("a line takes its label, fee type and amount from its plan", () => withFakeDb(async (fake) => {
  seedStudent(fake, "YD001");
  const plan = await billing.createPlan(
    { name: "Monthly Tuition", feeType: "tuition", amount: 5000 }, CTX);

  const invoice = await billing.createInvoice({
    studentId: "YD001", period: PERIOD, dueDate: DUE, lines: [{ planId: plan.planId }],
  }, CTX);

  assert.equal(invoice.lines[0].label, "Monthly Tuition");
  assert.equal(invoice.lines[0].feeType, "tuition");
  assert.equal(invoice.lines[0].amount, 5000);
  assert.equal(invoice.lines[0].planId, plan.planId);
}));

test("an explicit line amount overrides its plan, for a prorated first month", () => withFakeDb(async (fake) => {
  seedStudent(fake, "YD001");
  const plan = await billing.createPlan(
    { name: "Monthly Tuition", feeType: "tuition", amount: 5000 }, CTX);

  const invoice = await billing.createInvoice({
    studentId: "YD001", period: PERIOD, dueDate: DUE,
    lines: [{ planId: plan.planId, amount: 2500, label: "Tuition (half month)" }],
  }, CTX);

  assert.equal(invoice.totalAmount, 2500);
  assert.equal(invoice.lines[0].label, "Tuition (half month)");
  assert.equal((await billing.getPlan(plan.planId, CTX)).amount, 5000, "the plan is unchanged");
}));

test("an invoice refuses no lines, too many lines, a bad line or a missing plan", () => withFakeDb(async (fake) => {
  seedStudent(fake, "YD001");
  const base = { studentId: "YD001", period: PERIOD, dueDate: DUE };

  const bad = [
    [{ ...base, lines: [] },                                          /at least one line/],
    [{ ...base },                                                     /at least one line/],
    [{ ...base, lines: Array.from({ length: 21 }, () => ({ label: "x", amount: 1 })) },
      /more than 20 lines/],
    [{ ...base, lines: [{ amount: 100 }] },                           /needs a label/],
    [{ ...base, lines: [{ label: "Fee", amount: 0 }] },               /greater than zero/],
    [{ ...base, lines: [{ label: "Fee", amount: 100, feeType: "tip" }] }, /not one of/],
    [{ ...base, lines: [{ planId: "no-such-plan" }] },                /does not exist/],
    [{ ...base, period: "2026-13", lines: [{ label: "Fee", amount: 1 }] }, /YYYY-MM month/],
    [{ ...base, dueDate: "30-11-2026", lines: [{ label: "Fee", amount: 1 }] }, /YYYY-MM-DD/],
    [{ ...base, invoiceDate: "2026-11-20", dueDate: "2026-11-01", lines: [{ label: "Fee", amount: 1 }] },
      /cannot be before invoiceDate/],
  ];
  for (const [payload, pattern] of bad) {
    await assert.rejects(() => billing.createInvoice(payload, CTX), pattern,
      `createInvoice should refuse ${JSON.stringify(payload).slice(0, 90)}`);
  }

  assert.equal((await billing.listInvoices({ schoolId: CTX.schoolId })).length, 0,
    "no refused invoice was written");
}));

test("an invoice defaults its period, dates and number sensibly", () => withFakeDb(async (fake) => {
  seedStudent(fake, "YD001");
  const invoice = await billing.createInvoice({
    studentId: "YD001", lines: [{ label: "Fees", amount: 100 }],
  }, CTX);

  assert.equal(invoice.period, periodOf());
  assert.equal(invoice.invoiceDate, today());
  assert.ok(invoice.dueDate >= invoice.invoiceDate);
  assert.match(invoice.invoiceNumber, /^INV-\d{6}-0001$/);
  assert.equal(invoice.generatedBy, "manual");
}));

test("student name and class are frozen onto the invoice, so a later rename cannot rewrite history",
  () => withFakeDb(async (fake) => {
    seedStudent(fake, "YD001", { studentName: "Aarav", class: "Playgroup" });
    const invoice = await billing.createInvoice({
      studentId: "YD001", period: PERIOD, dueDate: DUE, lines: [{ label: "Fees", amount: 100 }],
    }, CTX);

    fake.seed("students", "YD001", {
      studentId: "YD001", studentName: "Aarav Sharma", class: "Nursery",
      status: "Active", schoolId: CTX.schoolId,
    });

    const reread = await billing.getInvoice(invoice.invoiceId, CTX);
    assert.equal(reread.studentName, "Aarav");
    assert.equal(reread.class, "Playgroup");
  }));

// ── Invoice numbering ────────────────────────────────────────────────────────

test("invoice numbers are sequential and gap-free within a period", () => withFakeDb(async (fake) => {
  for (const n of [1, 2, 3]) seedStudent(fake, `YD00${n}`);

  const numbers = [];
  for (const n of [1, 2, 3]) {
    const inv = await billing.createInvoice({
      studentId: `YD00${n}`, period: PERIOD, dueDate: DUE,
      lines: [{ label: "Fees", amount: 100 }],
    }, CTX);
    numbers.push(inv.invoiceNumber);
  }

  assert.deepEqual(numbers, ["INV-202611-0001", "INV-202611-0002", "INV-202611-0003"]);
}));

test("a refused invoice burns no number", () => withFakeDb(async (fake) => {
  seedStudent(fake, "YD001");
  await billing.createInvoice({
    studentId: "YD001", period: PERIOD, dueDate: DUE, lines: [{ label: "Fees", amount: 100 }],
  }, CTX);

  await assert.rejects(() => billing.createInvoice({
    studentId: "YD001", period: PERIOD, dueDate: DUE, lines: [{ label: "Fees", amount: 0 }],
  }, CTX), /greater than zero/);

  seedStudent(fake, "YD002");
  const next = await billing.createInvoice({
    studentId: "YD002", period: PERIOD, dueDate: DUE, lines: [{ label: "Fees", amount: 100 }],
  }, CTX);
  assert.equal(next.invoiceNumber, "INV-202611-0002", "the sequence has no gap");
}));

test("two schools do not share one run of invoice numbers", () => withFakeDb(async (fake) => {
  seedStudent(fake, "YD001");
  fake.seed("students", "ZZ001", {
    studentId: "ZZ001", studentName: "Other Child", class: "Playgroup",
    status: "Active", schoolId: OTHER.schoolId,
  });

  const mine   = await billing.createInvoice({
    studentId: "YD001", period: PERIOD, dueDate: DUE, lines: [{ label: "Fees", amount: 100 }] }, CTX);
  const theirs = await billing.createInvoice({
    studentId: "ZZ001", period: PERIOD, dueDate: DUE, lines: [{ label: "Fees", amount: 100 }] }, OTHER);

  // f1796e9 keyed its counter `invoices-YYYYMM`, with no schoolId, so the
  // second school's first invoice would have been numbered 0002.
  assert.equal(mine.invoiceNumber,   "INV-202611-0001");
  assert.equal(theirs.invoiceNumber, "INV-202611-0001");
}));

// ── Payment settlement: THE invariant ────────────────────────────────────────

test("recording a payment settles its invoice in the same breath", () => withFakeDb(async (fake) => {
  const { invoice } = await seedBilled(fake, { amount: 5000 });
  assert.equal(invoice.status, "Pending");

  const { payment, invoice: settled } = await billing.recordPayment({
    invoiceId: invoice.invoiceId, amount: 5000, paymentMode: "cash",
  }, CTX);

  // This is the defect the rebuild exists for: in the deleted module no code
  // path anywhere set these, so the invoice stayed Pending with money against it.
  assert.equal(settled.paidAmount, 5000);
  assert.equal(settled.balance, 0);
  assert.equal(settled.status, "Paid");

  // And it is actually on the document, not only in the returned object.
  const reread = await billing.getInvoice(invoice.invoiceId, CTX);
  assert.equal(reread.status, "Paid");
  assert.equal(reread.balance, 0);

  assert.equal(payment.amount, 5000);
  assert.equal(payment.invoiceId, invoice.invoiceId);
  assert.equal(payment.studentId, "YD001");
  assert.match(payment.receiptNumber, /^RCPT-\d{6}-0001$/);
  assert.equal(payment.reversed, false);
}));

test("a partial payment leaves the right balance and the Partial status", () => withFakeDb(async (fake) => {
  const { invoice } = await seedBilled(fake, { amount: 5000 });

  const first = await billing.recordPayment(
    { invoiceId: invoice.invoiceId, amount: 2000, paymentMode: "cash" }, CTX);
  assert.equal(first.invoice.paidAmount, 2000);
  assert.equal(first.invoice.balance, 3000);
  assert.equal(first.invoice.status, "Partial");

  const second = await billing.recordPayment(
    { invoiceId: invoice.invoiceId, amount: 3000, paymentMode: "cash" }, CTX);
  assert.equal(second.invoice.balance, 0);
  assert.equal(second.invoice.status, "Paid");
}));

test("three awkward partial payments land the balance exactly on zero", () => withFakeDb(async (fake) => {
  const { invoice } = await seedBilled(fake, { amount: 1000 });

  for (const amount of [333.33, 333.33, 333.34]) {
    await billing.recordPayment({ invoiceId: invoice.invoiceId, amount, paymentMode: "cash" }, CTX);
  }

  const reread = await billing.getInvoice(invoice.invoiceId, CTX);
  assert.equal(reread.paidAmount, 1000);
  assert.equal(reread.balance, 0, "not 0.00000000001 — this is why sums are in paise");
  assert.equal(reread.status, "Paid");
}));

test("a payment larger than the balance is refused, and settles nothing", () => withFakeDb(async (fake) => {
  const { invoice } = await seedBilled(fake, { amount: 5000 });
  await billing.recordPayment({ invoiceId: invoice.invoiceId, amount: 4000, paymentMode: "cash" }, CTX);

  await assert.rejects(
    () => billing.recordPayment({ invoiceId: invoice.invoiceId, amount: 2000, paymentMode: "cash" }, CTX),
    /exceeds the outstanding balance/,
  );

  const reread = await billing.getInvoice(invoice.invoiceId, CTX);
  assert.equal(reread.paidAmount, 4000, "the refused payment changed nothing");
  assert.equal((await billing.listPayments({ schoolId: CTX.schoolId })).length, 1);
}));

test("a refused payment burns no receipt number", () => withFakeDb(async (fake) => {
  const { invoice } = await seedBilled(fake, { amount: 5000 });

  await assert.rejects(
    () => billing.recordPayment({ invoiceId: invoice.invoiceId, amount: 9999, paymentMode: "cash" }, CTX),
    /exceeds the outstanding balance/,
  );

  const ok = await billing.recordPayment(
    { invoiceId: invoice.invoiceId, amount: 1000, paymentMode: "cash" }, CTX);
  assert.match(ok.payment.receiptNumber, /-0001$/, "the first receipt is still 0001");
}));

test("a payment refuses a bad amount, mode, date or missing reference", () => withFakeDb(async (fake) => {
  const { invoice } = await seedBilled(fake, { amount: 5000 });
  const base = { invoiceId: invoice.invoiceId };

  const bad = [
    [{ ...base, amount: 0 },                                     /greater than zero/],
    [{ ...base, amount: -100 },                                  /greater than zero/],
    [{ ...base, amount: 100, paymentMode: "bitcoin" },           /not a payment mode/],
    [{ ...base, amount: 100, paymentDate: "24-11-2026" },        /YYYY-MM-DD/],
    [{ ...base, amount: 100, paymentDate: "2099-01-01" },        /dated in the future/],
    [{ ...base, amount: 100, paymentMode: "upi" },               /needs a reference/],
    [{ ...base, amount: 100, paymentMode: "cheque" },            /needs a reference/],
    [{ ...base, amount: 100, paymentMode: "bank_transfer" },     /needs a reference/],
    [{ amount: 100 },                                            /invoiceId is required/],
    [{ invoiceId: "no-such-invoice", amount: 100 },               /Invoice not found/],
  ];
  for (const [payload, pattern] of bad) {
    await assert.rejects(() => billing.recordPayment(payload, CTX), pattern,
      `recordPayment should refuse ${JSON.stringify(payload)}`);
  }

  assert.equal((await billing.listPayments({ schoolId: CTX.schoolId })).length, 0);
  assert.equal((await billing.getInvoice(invoice.invoiceId, CTX)).status, "Pending");
}));

test("cash needs no reference; every other mode does and keeps it", () => withFakeDb(async (fake) => {
  const { invoice } = await seedBilled(fake, { amount: 5000 });

  const cash = await billing.recordPayment(
    { invoiceId: invoice.invoiceId, amount: 1000, paymentMode: "cash" }, CTX);
  assert.equal(cash.payment.reference, "");

  const upi = await billing.recordPayment({
    invoiceId: invoice.invoiceId, amount: 1000, paymentMode: "upi", reference: "UTR123456789",
  }, CTX);
  assert.equal(upi.payment.reference, "UTR123456789");
  assert.equal(upi.payment.paymentMode, "upi");
}));

test("a payment mode is normalised to its enum, so reports do not fragment", () => withFakeDb(async (fake) => {
  const { invoice } = await seedBilled(fake, { amount: 5000 });
  const { payment } = await billing.recordPayment(
    { invoiceId: invoice.invoiceId, amount: 100, paymentMode: "CASH" }, CTX);
  assert.equal(payment.paymentMode, "cash");
}));

// ── Reversal ─────────────────────────────────────────────────────────────────

test("reversing a payment is the exact mirror of recording it", () => withFakeDb(async (fake) => {
  const { invoice } = await seedBilled(fake, { amount: 5000 });
  const { payment } = await billing.recordPayment(
    { invoiceId: invoice.invoiceId, amount: 5000, paymentMode: "cash" }, CTX);
  assert.equal((await billing.getInvoice(invoice.invoiceId, CTX)).status, "Paid");

  const reversed = await billing.reversePayment(payment.paymentId, "Cheque bounced", CTX);

  assert.equal(reversed.payment.reversed, true);
  assert.equal(reversed.payment.reversalReason, "Cheque bounced");
  assert.equal(reversed.payment.reversedBy, CTX.actorUserId);
  assert.ok(reversed.payment.reversedAt);

  assert.equal(reversed.invoice.paidAmount, 0);
  assert.equal(reversed.invoice.balance, 5000);
  // Back to exactly the status it held before the payment — derived from the
  // numbers, so it cannot be left stranded on Paid with nothing against it.
  assert.equal(reversed.invoice.status, invoice.status);
  assert.equal(reversed.invoice.status, "Pending");

  // The payment row survives: a parent may already hold the receipt.
  const all = await billing.listPayments({ schoolId: CTX.schoolId });
  assert.equal(all.length, 1);
  assert.equal(all[0].receiptNumber, payment.receiptNumber);

  // But it no longer counts as money received.
  const live = await billing.listPayments({ schoolId: CTX.schoolId, includeReversed: false });
  assert.equal(live.length, 0);
}));

test("reversing a payment on a past-due invoice puts it back to Overdue", () => withFakeDb(async (fake) => {
  seedStudent(fake, "YD001");
  const invoice = await billing.createInvoice({
    studentId: "YD001", period: "2026-01", invoiceDate: "2026-01-01", dueDate: "2026-01-31",
    lines: [{ label: "January tuition", amount: 5000 }],
  }, CTX);
  assert.equal(invoice.status, "Overdue");

  const { payment } = await billing.recordPayment(
    { invoiceId: invoice.invoiceId, amount: 5000, paymentMode: "cash" }, CTX);
  assert.equal((await billing.getInvoice(invoice.invoiceId, CTX)).status, "Paid");

  const after = await billing.reversePayment(payment.paymentId, "Cheque bounced", CTX);
  assert.equal(after.invoice.status, "Overdue");
  assert.equal(after.invoice.balance, 5000);
}));

test("a reversal needs a reason, and cannot be done twice", () => withFakeDb(async (fake) => {
  const { invoice } = await seedBilled(fake, { amount: 5000 });
  const { payment } = await billing.recordPayment(
    { invoiceId: invoice.invoiceId, amount: 1000, paymentMode: "cash" }, CTX);

  await assert.rejects(() => billing.reversePayment(payment.paymentId, "", CTX), /needs a reason/);
  await assert.rejects(() => billing.reversePayment(payment.paymentId, "   ", CTX), /needs a reason/);
  await assert.rejects(
    () => billing.reversePayment(payment.paymentId, "x".repeat(301), CTX), /300 characters/);
  await assert.rejects(() => billing.reversePayment("no-such-payment", "ok", CTX), /not found/);

  assert.equal((await billing.getInvoice(invoice.invoiceId, CTX)).paidAmount, 1000,
    "no refused reversal touched the invoice");

  await billing.reversePayment(payment.paymentId, "Keyed twice", CTX);
  await assert.rejects(
    () => billing.reversePayment(payment.paymentId, "again", CTX), /already been reversed/);

  assert.equal((await billing.getInvoice(invoice.invoiceId, CTX)).paidAmount, 0,
    "the second attempt did not subtract twice");
}));

test("reversing one of two payments leaves the other settled", () => withFakeDb(async (fake) => {
  const { invoice } = await seedBilled(fake, { amount: 5000 });
  const a = await billing.recordPayment(
    { invoiceId: invoice.invoiceId, amount: 2000, paymentMode: "cash" }, CTX);
  await billing.recordPayment(
    { invoiceId: invoice.invoiceId, amount: 3000, paymentMode: "cash" }, CTX);
  assert.equal((await billing.getInvoice(invoice.invoiceId, CTX)).status, "Paid");

  const after = await billing.reversePayment(a.payment.paymentId, "Wrong child", CTX);
  assert.equal(after.invoice.paidAmount, 3000);
  assert.equal(after.invoice.balance, 2000);
}));

// ── Void ─────────────────────────────────────────────────────────────────────

test("voiding an invoice keeps the row and records who and why", () => withFakeDb(async (fake) => {
  const { invoice } = await seedBilled(fake, { amount: 5000 });

  const voided = await billing.voidInvoice(invoice.invoiceId, "Raised against the wrong child", CTX);

  assert.equal(voided.voided, true);
  assert.equal(voided.status, "Void");
  assert.equal(voided.balance, 0);
  assert.equal(voided.voidReason, "Raised against the wrong child");
  assert.equal(voided.voidedBy, CTX.actorUserId);
  assert.ok(voided.voidedAt);

  assert.equal((await billing.listInvoices({ schoolId: CTX.schoolId })).length, 1,
    "the invoice is still in the register");
  assert.equal(
    (await billing.listInvoices({ schoolId: CTX.schoolId, includeVoid: false })).length, 0);
}));

test("voiding needs a reason, and refuses an already-void invoice", () => withFakeDb(async (fake) => {
  const { invoice } = await seedBilled(fake, { amount: 5000 });

  await assert.rejects(() => billing.voidInvoice(invoice.invoiceId, "", CTX), /needs a reason/);
  await assert.rejects(() => billing.voidInvoice(invoice.invoiceId, "  ", CTX), /needs a reason/);
  await assert.rejects(
    () => billing.voidInvoice(invoice.invoiceId, "x".repeat(301), CTX), /300 characters/);

  await billing.voidInvoice(invoice.invoiceId, "Duplicate", CTX);
  await assert.rejects(() => billing.voidInvoice(invoice.invoiceId, "again", CTX), /already void/);
}));

test("an invoice with a live payment cannot be voided — reverse it first", () => withFakeDb(async (fake) => {
  const { invoice } = await seedBilled(fake, { amount: 5000 });
  const { payment } = await billing.recordPayment(
    { invoiceId: invoice.invoiceId, amount: 2000, paymentMode: "cash" }, CTX);

  // Voiding over a payment would strand money a parent holds a receipt for.
  await assert.rejects(
    () => billing.voidInvoice(invoice.invoiceId, "Mistake", CTX),
    /Reverse it before voiding/,
  );

  await billing.reversePayment(payment.paymentId, "Keyed in error", CTX);
  const voided = await billing.voidInvoice(invoice.invoiceId, "Mistake", CTX);
  assert.equal(voided.status, "Void");
}));

test("a void invoice takes no further payment and no credit note", () => withFakeDb(async (fake) => {
  const { invoice } = await seedBilled(fake, { amount: 5000 });
  await billing.voidInvoice(invoice.invoiceId, "Withdrawn", CTX);

  await assert.rejects(
    () => billing.recordPayment({ invoiceId: invoice.invoiceId, amount: 100, paymentMode: "cash" }, CTX),
    /void invoice cannot take a payment/,
  );
  await assert.rejects(
    () => billing.addCreditNote(invoice.invoiceId, { amount: 100, reason: "x" }, CTX),
    /void invoice cannot be credited/,
  );
}));

// ── Credit notes ─────────────────────────────────────────────────────────────

test("a credit note reduces the total and the balance, and keeps its reason", () => withFakeDb(async (fake) => {
  const { invoice } = await seedBilled(fake, { amount: 5000 });

  const credited = await billing.addCreditNote(
    invoice.invoiceId, { amount: 1500, reason: "Sibling discount applied late" }, CTX);

  assert.equal(credited.subtotal, 5000, "the lines are untouched");
  assert.equal(credited.adjustmentTotal, -1500);
  assert.equal(credited.totalAmount, 3500);
  assert.equal(credited.balance, 3500);
  assert.equal(credited.adjustments.length, 1);
  assert.equal(credited.adjustments[0].amount, -1500);
  assert.equal(credited.adjustments[0].reason, "Sibling discount applied late");
  assert.equal(credited.adjustments[0].createdBy, CTX.actorUserId);
}));

test("a credit note is stored negative however the caller signs it", () => withFakeDb(async (fake) => {
  const { invoice } = await seedBilled(fake, { amount: 5000 });
  const credited = await billing.addCreditNote(
    invoice.invoiceId, { amount: -1000, reason: "Correction" }, CTX);
  assert.equal(credited.adjustments[0].amount, -1000);
  assert.equal(credited.totalAmount, 4000);
}));

test("crediting the whole balance settles the invoice without any payment", () => withFakeDb(async (fake) => {
  const { invoice } = await seedBilled(fake, { amount: 5000 });

  const credited = await billing.addCreditNote(
    invoice.invoiceId, { amount: 5000, reason: "Full scholarship for the term" }, CTX);

  assert.equal(credited.totalAmount, 0);
  assert.equal(credited.balance, 0);
  // The regression guarded in billingMoney.test.js, through the real service:
  // under the deleted rebuild's `total > 0 &&` condition this read Overdue.
  assert.equal(credited.status, "Paid");
}));

test("a credit note cannot exceed the outstanding balance — that would be a refund", () => withFakeDb(async (fake) => {
  const { invoice } = await seedBilled(fake, { amount: 5000 });
  await billing.recordPayment({ invoiceId: invoice.invoiceId, amount: 4000, paymentMode: "cash" }, CTX);

  await assert.rejects(
    () => billing.addCreditNote(invoice.invoiceId, { amount: 2000, reason: "Too much" }, CTX),
    /more than the outstanding balance/,
  );

  const reread = await billing.getInvoice(invoice.invoiceId, CTX);
  assert.equal(reread.totalAmount, 5000, "the refused credit note changed nothing");
  assert.equal(reread.balance, 1000);
}));

test("a credit note needs a reason and a non-zero amount", () => withFakeDb(async (fake) => {
  const { invoice } = await seedBilled(fake, { amount: 5000 });
  for (const [payload, pattern] of [
    [{ amount: 100, reason: "" },             /needs a reason/],
    [{ amount: 100, reason: "  " },           /needs a reason/],
    [{ amount: 100, reason: "x".repeat(301) }, /300 characters/],
    [{ amount: 0, reason: "ok" },             /greater than zero/],
    [{ reason: "ok" },                        /greater than zero/],
  ]) {
    await assert.rejects(() => billing.addCreditNote(invoice.invoiceId, payload, CTX), pattern);
  }
}));

test("two credit notes stack, and a payment settles what is left", () => withFakeDb(async (fake) => {
  const { invoice } = await seedBilled(fake, { amount: 5000 });

  await billing.addCreditNote(invoice.invoiceId, { amount: 1000, reason: "Sibling" }, CTX);
  const twice = await billing.addCreditNote(invoice.invoiceId, { amount: 500, reason: "Goodwill" }, CTX);

  assert.equal(twice.adjustments.length, 2);
  assert.equal(twice.totalAmount, 3500);
  assert.deepEqual(twice.adjustments.map(a => a.adjustmentId), ["ADJ1", "ADJ2"]);

  const paid = await billing.recordPayment(
    { invoiceId: invoice.invoiceId, amount: 3500, paymentMode: "cash" }, CTX);
  assert.equal(paid.invoice.status, "Paid");
  assert.equal(paid.invoice.balance, 0);
}));

// ── Monthly generation ───────────────────────────────────────────────────────

test("generation puts every matching plan on ONE invoice", () => withFakeDb(async (fake) => {
  seedStudent(fake, "YD001", { class: "Playgroup" });

  await billing.createPlan({ name: "Tuition",   feeType: "tuition",   amount: 5000, classes: ["Playgroup"] }, CTX);
  await billing.createPlan({ name: "Daycare",   feeType: "daycare",   amount: 3000, classes: ["Playgroup"] }, CTX);
  await billing.createPlan({ name: "Transport", feeType: "transport", amount: 800 }, CTX);

  const run = await billing.generateForPeriod({ ...CTX, period: PERIOD, dueDate: DUE });

  assert.equal(run.createdCount, 1, "one invoice, not three");
  const invoices = await billing.listInvoices({ schoolId: CTX.schoolId });
  assert.equal(invoices.length, 1);
  assert.equal(invoices[0].lines.length, 3, "tuition + daycare + transport on one bill");
  assert.equal(invoices[0].totalAmount, 8800);
  assert.equal(invoices[0].generatedBy, "plan");
}));

test("a dry run writes nothing and reports exactly what a real run would do", () => withFakeDb(async (fake) => {
  seedStudent(fake, "YD001", { class: "Playgroup" });
  seedStudent(fake, "YD002", { class: "Nursery" });
  seedStudent(fake, "YD003", { class: "Playgroup", status: "Inactive" });
  await billing.createPlan(
    { name: "Tuition", feeType: "tuition", amount: 5000, classes: ["Playgroup"] }, CTX);

  const dry = await billing.generateForPeriod({ ...CTX, period: PERIOD, dueDate: DUE, dryRun: true });

  assert.equal(dry.dryRun, true);
  assert.equal(dry.plannedCount, 1);
  assert.equal(dry.totalAmount, 5000);
  assert.equal(dry.planned[0].studentId, "YD001");
  assert.equal(dry.createdCount, 0);
  assert.deepEqual(dry.skipped.map(s => s.reason), ["inactive"]);
  assert.deepEqual(dry.unmatched.map(u => u.studentId), ["YD002"]);

  assert.equal((await billing.listInvoices({ schoolId: CTX.schoolId })).length, 0,
    "a dry run writes nothing");

  const real = await billing.generateForPeriod({ ...CTX, period: PERIOD, dueDate: DUE });
  assert.equal(real.createdCount, dry.plannedCount, "the real run matches the preview");
}));

test("generation is idempotent — running it twice does not double-bill", () => withFakeDb(async (fake) => {
  seedStudent(fake, "YD001");
  seedStudent(fake, "YD002");
  await billing.createPlan({ name: "Tuition", feeType: "tuition", amount: 5000 }, CTX);

  const first = await billing.generateForPeriod({ ...CTX, period: PERIOD, dueDate: DUE });
  assert.equal(first.createdCount, 2);

  const second = await billing.generateForPeriod({ ...CTX, period: PERIOD, dueDate: DUE });
  assert.equal(second.createdCount, 0);
  assert.equal(second.skippedCount, 2);
  assert.ok(second.skipped.every(s => s.reason === "already_invoiced"));

  assert.equal((await billing.listInvoices({ schoolId: CTX.schoolId })).length, 2);
}));

test("a voided invoice lets generation raise that child's invoice again", () => withFakeDb(async (fake) => {
  seedStudent(fake, "YD001");
  await billing.createPlan({ name: "Tuition", feeType: "tuition", amount: 5000 }, CTX);

  const first = await billing.generateForPeriod({ ...CTX, period: PERIOD, dueDate: DUE });
  const raised = (await billing.listInvoices({ schoolId: CTX.schoolId }))[0];
  await billing.voidInvoice(raised.invoiceId, "Wrong amount on the plan", CTX);

  const again = await billing.generateForPeriod({ ...CTX, period: PERIOD, dueDate: DUE });
  assert.equal(first.createdCount, 1);
  assert.equal(again.createdCount, 1, "voiding is how you ask for a re-raise");
  assert.equal((await billing.listInvoices({ schoolId: CTX.schoolId, includeVoid: false })).length, 1);
}));

test("generation skips inactive children and only uses monthly, in-date, active plans",
  () => withFakeDb(async (fake) => {
    seedStudent(fake, "YD001", { class: "Playgroup" });

    await billing.createPlan({ name: "Monthly",  feeType: "tuition", amount: 5000 }, CTX);
    await billing.createPlan({ name: "One-off",  feeType: "admission", amount: 9000, cadence: "one_time" }, CTX);
    await billing.createPlan({ name: "Termly",   feeType: "activity",  amount: 1200, cadence: "termly" }, CTX);
    const stale = await billing.createPlan(
      { name: "Expired", feeType: "other", amount: 400, effectiveTo: "2026-01-31" }, CTX);
    const future = await billing.createPlan(
      { name: "Next year", feeType: "other", amount: 400, effectiveFrom: "2027-04-01" }, CTX);
    const off = await billing.createPlan({ name: "Retired", feeType: "other", amount: 400 }, CTX);
    await billing.deactivatePlan(off.planId, CTX);
    void stale; void future;

    await billing.generateForPeriod({ ...CTX, period: PERIOD, dueDate: DUE });
    const invoice = (await billing.listInvoices({ schoolId: CTX.schoolId }))[0];

    assert.deepEqual(invoice.lines.map(l => l.label), ["Monthly"]);
    assert.equal(invoice.totalAmount, 5000);
  }));

test("generation reports a child whose class matches no plan rather than silently skipping",
  () => withFakeDb(async (fake) => {
    seedStudent(fake, "YD001", { class: "Playgroup" });
    seedStudent(fake, "YD002", { class: "Toddler" });
    await billing.createPlan(
      { name: "Tuition", feeType: "tuition", amount: 5000, classes: ["Playgroup"] }, CTX);

    const run = await billing.generateForPeriod({ ...CTX, period: PERIOD, dueDate: DUE });
    assert.equal(run.createdCount, 1);
    assert.equal(run.unmatchedCount, 1);
    assert.equal(run.unmatched[0].studentId, "YD002");
    assert.equal(run.unmatched[0].class, "Toddler");
  }));

test("generation refuses a malformed period or due date", () => withFakeDb(async () => {
  await assert.rejects(() => billing.generateForPeriod({ ...CTX, period: "2026-13" }), /YYYY-MM month/);
  await assert.rejects(
    () => billing.generateForPeriod({ ...CTX, period: PERIOD, dueDate: "30-11-2026" }), /YYYY-MM-DD/);
}));

test("generation never crosses into another school's children", () => withFakeDb(async (fake) => {
  seedStudent(fake, "YD001");
  fake.seed("students", "ZZ001", {
    studentId: "ZZ001", studentName: "Other Child", class: "Playgroup",
    status: "Active", schoolId: OTHER.schoolId,
  });
  await billing.createPlan({ name: "Tuition", feeType: "tuition", amount: 5000 }, CTX);

  const run = await billing.generateForPeriod({ ...CTX, period: PERIOD, dueDate: DUE });
  assert.equal(run.createdCount, 1);
  assert.equal((await billing.listInvoices({ schoolId: CTX.schoolId }))[0].studentId, "YD001");
}));

// ── Audit trail ──────────────────────────────────────────────────────────────

test("every mutation leaves an audit row naming the actor and the amounts", () => withFakeDb(async (fake) => {
  const { plan, invoice } = await seedBilled(fake, { amount: 5000 });
  const { payment } = await billing.recordPayment(
    { invoiceId: invoice.invoiceId, amount: 2000, paymentMode: "cash" }, CTX);
  await billing.reversePayment(payment.paymentId, "Keyed twice", CTX);
  await billing.addCreditNote(invoice.invoiceId, { amount: 500, reason: "Sibling" }, CTX);
  await billing.updatePlan(plan.planId, { amount: 5500 }, CTX);
  await billing.deactivatePlan(plan.planId, CTX);
  await billing.voidInvoice(invoice.invoiceId, "Start again", CTX);

  const trail = await audit.listForSchool({ schoolId: CTX.schoolId });
  const actions = trail.map(r => r.action);

  for (const expected of [
    "plan.create", "plan.update", "plan.deactivate",
    "invoice.create", "invoice.creditNote", "invoice.void",
    "payment.record", "payment.reverse",
  ]) {
    assert.ok(actions.includes(expected), `${expected} should be in the audit trail`);
  }

  assert.ok(trail.every(r => r.actorUserId === CTX.actorUserId), "every row names the actor");
  assert.ok(trail.every(r => r.schoolId === CTX.schoolId));
  assert.ok(trail.every(r => r.createdAt), "every row is timestamped");
}));

test("a money audit row carries the before and after balances", () => withFakeDb(async (fake) => {
  const { invoice } = await seedBilled(fake, { amount: 5000 });
  await billing.recordPayment({ invoiceId: invoice.invoiceId, amount: 2000, paymentMode: "cash" }, CTX);

  const rows = await audit.listForSchool({ schoolId: CTX.schoolId, action: "payment.record" });
  assert.equal(rows.length, 1);

  const row = rows[0];
  assert.equal(row.amount, 2000);
  assert.deepEqual(row.before, { paidAmount: 0, balance: 5000, status: "Pending" });
  assert.deepEqual(row.after,  { paidAmount: 2000, balance: 3000, status: "Partial" });
  assert.equal(row.meta.invoiceNumber, invoice.invoiceNumber);
  assert.match(row.meta.receiptNumber, /^RCPT-/);
}));

test("a reversal audit row records the negative amount and the reason", () => withFakeDb(async (fake) => {
  const { invoice } = await seedBilled(fake, { amount: 5000 });
  const { payment } = await billing.recordPayment(
    { invoiceId: invoice.invoiceId, amount: 2000, paymentMode: "cash" }, CTX);
  await billing.reversePayment(payment.paymentId, "Cheque bounced", CTX);

  const [row] = await audit.listForSchool({ schoolId: CTX.schoolId, action: "payment.reverse" });
  assert.equal(row.amount, -2000);
  assert.equal(row.reason, "Cheque bounced");
  assert.equal(row.after.reversed, true);
  assert.equal(row.before.paidAmount, 2000);
  assert.equal(row.after.paidAmount, 0);
}));

test("the audit trail filters to one entity, and never crosses schools", () => withFakeDb(async (fake) => {
  const { invoice } = await seedBilled(fake, { amount: 5000 });
  await billing.recordPayment({ invoiceId: invoice.invoiceId, amount: 100, paymentMode: "cash" }, CTX);

  const forInvoice = await audit.listForEntity({
    schoolId: CTX.schoolId, entityType: "feeInvoice", entityId: invoice.invoiceId,
  });
  assert.equal(forInvoice.length, 1);
  assert.equal(forInvoice[0].action, "invoice.create");

  assert.equal((await audit.listForSchool({ schoolId: OTHER.schoolId })).length, 0);
}));

test("a refused mutation writes no audit row", () => withFakeDb(async (fake) => {
  const { invoice } = await seedBilled(fake, { amount: 5000 });
  const before = (await audit.listForSchool({ schoolId: CTX.schoolId })).length;

  await assert.rejects(
    () => billing.recordPayment({ invoiceId: invoice.invoiceId, amount: 99999, paymentMode: "cash" }, CTX),
    /exceeds/);
  await assert.rejects(() => billing.voidInvoice(invoice.invoiceId, "", CTX), /needs a reason/);

  assert.equal((await audit.listForSchool({ schoolId: CTX.schoolId })).length, before);
}));

test("the audit service refuses an unknown action rather than inventing a category", () => {
  assert.throws(
    () => audit.buildEntry({ schoolId: "s", action: "payment.vaporise", entityType: "feePayment" }),
    /Unknown billing audit action/,
  );
  assert.throws(
    () => audit.buildEntry({ action: "payment.record", entityType: "feePayment" }),
    /requires a schoolId/,
  );
});

// ── Rollups ──────────────────────────────────────────────────────────────────

test("outstanding rolls a family's children into one balance", () => withFakeDb(async (fake) => {
  seedStudent(fake, "YD001", { familyId: "FAM1", studentName: "Aarav" });
  seedStudent(fake, "YD002", { familyId: "FAM1", studentName: "Anaya" });
  seedStudent(fake, "YD003", { familyId: "",     studentName: "Solo" });

  await billing.createPlan({ name: "Tuition", feeType: "tuition", amount: 5000 }, CTX);
  await billing.generateForPeriod({ ...CTX, period: PERIOD, dueDate: DUE });

  const invoices = await billing.listInvoices({ schoolId: CTX.schoolId, studentId: "YD001" });
  await billing.recordPayment(
    { invoiceId: invoices[0].invoiceId, amount: 2000, paymentMode: "cash" }, CTX);

  const out = await billing.getOutstanding({ schoolId: CTX.schoolId });

  assert.equal(out.totals.billed, 15000);
  assert.equal(out.totals.collected, 2000);
  assert.equal(out.totals.outstanding, 13000);
  assert.equal(out.totals.students, 3);
  assert.equal(out.totals.families, 2, "one linked family plus one solo child");
  assert.equal(out.totals.collectionRate, 13.3);

  const fam = out.families.find(f => f.familyId === "FAM1");
  assert.equal(fam.childCount, 2);
  assert.equal(fam.billed, 10000);
  assert.equal(fam.paid, 2000);
  assert.equal(fam.balance, 8000);

  const solo = out.families.find(f => f.groupKey === "solo:YD003");
  assert.equal(solo.balance, 5000, "an unlinked child appears exactly once");
}));

test("outstanding excludes void invoices from every total", () => withFakeDb(async (fake) => {
  seedStudent(fake, "YD001");
  seedStudent(fake, "YD002");
  await billing.createPlan({ name: "Tuition", feeType: "tuition", amount: 5000 }, CTX);
  await billing.generateForPeriod({ ...CTX, period: PERIOD, dueDate: DUE });

  const all = await billing.listInvoices({ schoolId: CTX.schoolId });
  await billing.voidInvoice(all[0].invoiceId, "Duplicate", CTX);

  const out = await billing.getOutstanding({ schoolId: CTX.schoolId });
  assert.equal(out.totals.billed, 5000, "a withdrawn bill is not money anybody owes");
  assert.equal(out.totals.outstanding, 5000);
  assert.equal(out.totals.invoices, 1);
}));

test("a child with no invoices reads No Invoices, not a zero balance that looks settled",
  () => withFakeDb(async (fake) => {
    seedStudent(fake, "YD001");
    const out = await billing.getOutstanding({ schoolId: CTX.schoolId });
    assert.equal(out.students[0].status, "No Invoices");
    assert.equal(out.students[0].balance, 0);
    assert.equal(out.students[0].invoiceCount, 0);
  }));

test("the summary and the outstanding rollup agree on what is owed", () => withFakeDb(async (fake) => {
  seedStudent(fake, "YD001");
  seedStudent(fake, "YD002");
  await billing.createPlan({ name: "Tuition", feeType: "tuition", amount: 5000 }, CTX);
  await billing.generateForPeriod({ ...CTX, period: PERIOD, dueDate: DUE });

  const invoices = await billing.listInvoices({ schoolId: CTX.schoolId });
  await billing.recordPayment(
    { invoiceId: invoices[0].invoiceId, amount: 5000, paymentMode: "cash" }, CTX);

  const [summary, out] = await Promise.all([
    billing.getSummary({ schoolId: CTX.schoolId, period: PERIOD }),
    billing.getOutstanding({ schoolId: CTX.schoolId }),
  ]);

  // The audit's third finding was three screens computing their own version of
  // this number. Both of these read the same service functions, so they cannot
  // disagree — asserted rather than assumed.
  assert.equal(summary.outstanding, out.totals.outstanding);
  assert.equal(summary.billedThisMonth, out.totals.billed);
}));

test("the summary excludes reversed payments from what was collected", () => withFakeDb(async (fake) => {
  const { invoice } = await seedBilled(fake, { amount: 5000 });
  const { payment } = await billing.recordPayment(
    { invoiceId: invoice.invoiceId, amount: 5000, paymentMode: "cash" }, CTX);

  let summary = await billing.getSummary({ schoolId: CTX.schoolId, period: PERIOD });
  assert.equal(summary.collectedToday, 5000);

  await billing.reversePayment(payment.paymentId, "Bounced", CTX);
  summary = await billing.getSummary({ schoolId: CTX.schoolId, period: PERIOD });
  assert.equal(summary.collectedToday, 0, "that money went back");
  assert.equal(summary.outstanding, 5000);
}));

test("the summary reports what share of invoices the plans raised", () => withFakeDb(async (fake) => {
  seedStudent(fake, "YD001");
  seedStudent(fake, "YD002");
  await billing.createPlan({ name: "Tuition", feeType: "tuition", amount: 5000 }, CTX);
  await billing.generateForPeriod({ ...CTX, period: PERIOD, dueDate: DUE });

  let summary = await billing.getSummary({ schoolId: CTX.schoolId, period: PERIOD });
  assert.equal(summary.automationRate, 100);

  await billing.createInvoice({
    studentId: "YD001", period: PERIOD, dueDate: DUE,
    lines: [{ label: "Field trip", feeType: "activity", amount: 500 }],
  }, CTX);

  summary = await billing.getSummary({ schoolId: CTX.schoolId, period: PERIOD });
  assert.equal(summary.automationRate, 66.7, "2 of 3 invoices came from a plan");
}));

test("the summary buckets unpaid balances by how far past due they are", () => withFakeDb(async (fake) => {
  seedStudent(fake, "YD001");
  seedStudent(fake, "YD002");

  await billing.createInvoice({
    studentId: "YD001", period: "2026-01", invoiceDate: "2026-01-01", dueDate: "2026-01-31",
    lines: [{ label: "Old", amount: 1000 }],
  }, CTX);
  await billing.createInvoice({
    studentId: "YD002", period: "2099-01", invoiceDate: "2026-11-01", dueDate: "2099-01-31",
    lines: [{ label: "Future", amount: 2000 }],
  }, CTX);

  const summary = await billing.getSummary({ schoolId: CTX.schoolId, asOf: "2026-11-24" });
  assert.equal(summary.aging["90+"], 1000);
  assert.equal(summary.aging.current, 2000);
  assert.equal(summary.outstanding, 3000);
}));

test("the summary is all zeroes on a school that has billed nothing", () => withFakeDb(async () => {
  const summary = await billing.getSummary({ schoolId: CTX.schoolId });
  assert.equal(summary.outstanding, 0);
  assert.equal(summary.collectedToday, 0);
  assert.equal(summary.overdueCount, 0);
  assert.equal(summary.collectionRate, 0);
  assert.equal(summary.automationRate, 0);
}));

// ── Receipts ─────────────────────────────────────────────────────────────────

test("receipt numbers are sequential per school and per month", () => withFakeDb(async (fake) => {
  const { invoice } = await seedBilled(fake, { amount: 5000 });

  const a = await billing.recordPayment(
    { invoiceId: invoice.invoiceId, amount: 100, paymentMode: "cash", paymentDate: "2026-11-02" }, CTX);
  const b = await billing.recordPayment(
    { invoiceId: invoice.invoiceId, amount: 100, paymentMode: "cash", paymentDate: "2026-11-03" }, CTX);

  assert.equal(a.payment.receiptNumber, "RCPT-202611-0001");
  assert.equal(b.payment.receiptNumber, "RCPT-202611-0002");
}));

test("a receipt resolves the payment, its invoice and the school's payee details",
  () => withFakeDb(async (fake) => {
    await billing.updateSettings(
      { schoolName: "KUE BOXS Demo Preschool", upiId: "demo@examplebank", upiName: "Demo Preschool" }, CTX);
    const { invoice } = await seedBilled(fake, { amount: 5000 });
    const { payment } = await billing.recordPayment(
      { invoiceId: invoice.invoiceId, amount: 5000, paymentMode: "upi", reference: "UTR999" }, CTX);

    const receipt = await billing.getReceipt(payment.paymentId, CTX);
    assert.equal(receipt.payment.receiptNumber, payment.receiptNumber);
    assert.equal(receipt.invoice.invoiceNumber, invoice.invoiceNumber);
    assert.equal(receipt.invoice.lines.length, 1);
    assert.equal(receipt.settings.upiId, "demo@examplebank");
  }));

// ── Parent view ──────────────────────────────────────────────────────────────

test("a parent sees only their own child's bills, with a usable summary", () => withFakeDb(async (fake) => {
  seedStudent(fake, "YD001", { studentName: "Aarav" });
  seedStudent(fake, "YD002", { studentName: "Someone else" });
  await billing.createPlan({ name: "Tuition", feeType: "tuition", amount: 5000 }, CTX);
  await billing.generateForPeriod({ ...CTX, period: PERIOD, dueDate: DUE });

  const mine = await billing.listInvoices({ schoolId: CTX.schoolId, studentId: "YD001" });
  await billing.recordPayment(
    { invoiceId: mine[0].invoiceId, amount: 2000, paymentMode: "cash" }, CTX);

  const view = await billing.getForStudent({ schoolId: CTX.schoolId, studentId: "YD001" });

  assert.equal(view.invoices.length, 1);
  assert.equal(view.invoices[0].studentId, "YD001");
  assert.equal(view.payments.length, 1);
  assert.equal(view.summary.outstanding, 3000);
  assert.equal(view.summary.paidToDate, 2000);
  assert.equal(view.summary.billedToDate, 5000);
  assert.equal(view.summary.unpaidCount, 1);
  assert.equal(view.summary.nextDueDate, DUE);
}));

test("a parent is never shown a void invoice or a reversed payment", () => withFakeDb(async (fake) => {
  const { invoice } = await seedBilled(fake, { amount: 5000 });
  const { payment } = await billing.recordPayment(
    { invoiceId: invoice.invoiceId, amount: 1000, paymentMode: "cash" }, CTX);
  await billing.reversePayment(payment.paymentId, "Keyed twice", CTX);

  let view = await billing.getForStudent({ schoolId: CTX.schoolId, studentId: "YD001" });
  assert.equal(view.payments.length, 0, "a reversed payment is not a receipt a parent should see");
  assert.equal(view.summary.outstanding, 5000);

  await billing.voidInvoice(invoice.invoiceId, "Raised in error", CTX);
  view = await billing.getForStudent({ schoolId: CTX.schoolId, studentId: "YD001" });
  assert.equal(view.invoices.length, 0, "a withdrawn bill raises a question about nothing");
  assert.equal(view.summary.outstanding, 0);
}));

test("the parent view carries the payee details the QR code is built from", () => withFakeDb(async (fake) => {
  await billing.updateSettings({ upiId: "demo@examplebank", upiName: "Demo Preschool" }, CTX);
  await seedBilled(fake, { amount: 5000 });

  const view = await billing.getForStudent({ schoolId: CTX.schoolId, studentId: "YD001" });
  assert.equal(view.payee.upiId, "demo@examplebank");
  assert.equal(view.payee.upiName, "Demo Preschool");
}));

test("the parent view needs a studentId resolved by the caller", () => withFakeDb(async () => {
  await assert.rejects(
    () => billing.getForStudent({ schoolId: CTX.schoolId }), /studentId is required/);
}));

// ── Settings ─────────────────────────────────────────────────────────────────

test("billing settings round-trip, and default empty rather than undefined", () => withFakeDb(async () => {
  const empty = await billing.getSettings({ schoolId: CTX.schoolId });
  assert.equal(empty.upiId, "");
  assert.equal(empty.dueDayOfMonth, 0);

  const saved = await billing.updateSettings({
    schoolName: "KUE BOXS Demo Preschool", upiId: "demo@examplebank",
    upiName: "Demo Preschool", dueDayOfMonth: 10, receiptFooter: "Thank you.",
  }, CTX);

  assert.equal(saved.upiId, "demo@examplebank");
  assert.equal(saved.dueDayOfMonth, 10);
  assert.equal(saved.receiptFooter, "Thank you.");
  assert.equal(saved.updatedBy, CTX.actorUserId);
}));

test("a malformed UPI ID or due day is refused", () => withFakeDb(async () => {
  for (const [payload, pattern] of [
    [{ upiId: "not-a-vpa" },      /looks like name@bank/],
    [{ upiId: "@bank" },          /looks like name@bank/],
    [{ upiId: "demo@" },          /looks like name@bank/],
    [{ dueDayOfMonth: 31 },       /from 1 to 28/],
    [{ dueDayOfMonth: -1 },       /from 1 to 28/],
    [{ dueDayOfMonth: 10.5 },     /from 1 to 28/],
  ]) {
    await assert.rejects(() => billing.updateSettings(payload, CTX), pattern,
      `updateSettings(${JSON.stringify(payload)}) should be refused`);
  }

  // Clearing it is allowed — a school may not take UPI at all.
  const cleared = await billing.updateSettings({ upiId: "" }, CTX);
  assert.equal(cleared.upiId, "");
}));

test("isUpiId accepts a real VPA shape and rejects an email-ish near-miss", () => {
  assert.ok(billing.isUpiId("demo@examplebank"));
  assert.ok(billing.isUpiId("school.fees@okaxis"));
  assert.ok(billing.isUpiId("9876543210@ybl"));
  assert.ok(!billing.isUpiId("demo@bank.co.in.extra.long.tld.that.keeps.going.on.and.on"));
  assert.ok(!billing.isUpiId("demo"));
  assert.ok(!billing.isUpiId(""));
  assert.ok(!billing.isUpiId(null));
});

// ── The vocabulary is closed ─────────────────────────────────────────────────

test("fee types, cadences and payment modes are frozen enums", () => {
  for (const list of [billing.FEE_TYPES, billing.CADENCES, billing.PAYMENT_MODES]) {
    assert.ok(Object.isFrozen(list));
    assert.ok(list.length > 0);
  }
  assert.ok(billing.PAYMENT_MODES.includes("upi"));
  assert.ok(billing.FEE_TYPES.includes("daycare"));
  assert.ok(billing.CADENCES.includes("monthly"));
});
