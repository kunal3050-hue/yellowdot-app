/**
 * Fees retrieval: summary totals/counts, multi-child merge, single-child scope.
 */
const test = require("node:test");
const assert = require("node:assert");
const { makeFakeFirestore } = require("../test-helpers/_fakeFirestore");

const fake = makeFakeFirestore();
const fbPath = require.resolve("../firebaseAdmin");
require.cache[fbPath] = { id: fbPath, filename: fbPath, loaded: true, exports: { db: fake.db, auth: {} } };

const invoiceService = require("../services/invoiceService");
const feesSvc = require("../services/parentFeesService");

const inv = (o) => ({ invoiceNumber: "INV", studentId: "YD001", feeType: "Tuition",
  invoiceDate: "2026-06-01", dueDate: "2026-06-10", totalAmount: 0, paidAmount: 0, balance: 0, status: "Pending", ...o });

test("summary totals + status counts", async () => {
  invoiceService.getAllInvoices = async ({ studentId }) => [
    inv({ studentId, totalAmount: 1000, paidAmount: 1000, balance: 0, status: "Paid" }),
    inv({ studentId, totalAmount: 1000, paidAmount: 0, balance: 1000, status: "Overdue" }),
  ];
  invoiceService.getAllPayments = async (_n, { studentId }) => [
    { receiptNumber: "R1", studentId, amount: 1000, paymentMode: "Cash", paymentDate: "2026-06-05" },
  ];
  const r = await feesSvc.getFees({ schoolId: "s", studentIds: ["YD001"] });
  assert.equal(r.summary.totalInvoiced, 2000);
  assert.equal(r.summary.totalPaid, 1000);
  assert.equal(r.summary.totalDue, 1000);
  assert.equal(r.summary.counts.paid, 1);
  assert.equal(r.summary.counts.overdue, 1);
  assert.equal(r.invoices.length, 2);
  assert.equal(r.payments.length, 1);
});

test("multi-child merge across linked children", async () => {
  invoiceService.getAllInvoices = async ({ studentId }) =>
    [inv({ studentId, totalAmount: 500, balance: 500, status: "Pending" })];
  invoiceService.getAllPayments = async () => [];
  const r = await feesSvc.getFees({ schoolId: "s", studentIds: ["YD001", "YD002"] });
  assert.equal(r.invoices.length, 2);
  assert.equal(r.summary.totalDue, 1000);
  assert.equal(r.summary.invoiceCount, 2);
});

test("single-child scope only queries that child", async () => {
  const seen = [];
  invoiceService.getAllInvoices = async ({ studentId }) => { seen.push(studentId); return []; };
  invoiceService.getAllPayments = async () => [];
  await feesSvc.getFees({ schoolId: "s", studentIds: ["YD001", "YD002"], studentId: "YD002" });
  assert.deepEqual(seen, ["YD002"]);
});

test("no linked children → empty result", async () => {
  const r = await feesSvc.getFees({ schoolId: "s", studentIds: [] });
  assert.equal(r.invoices.length, 0);
  assert.equal(r.summary.totalDue, 0);
});
