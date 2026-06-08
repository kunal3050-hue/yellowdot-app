/**
 * parentFeesService.js — Parent Module · Phase 5 (Fees)
 * ──────────────────────────────────────────────────────────────────
 * Read-only, parent-facing fees view. Composes existing finance data —
 * it does NOT touch staff finance screens or create a parallel system.
 *
 *   invoices/{id}  via invoiceService.getAllInvoices()   (equality-only query)
 *   payments/{id}  via invoiceService.getAllPayments()   (equality-only query)
 *
 * Parents see only their linked children's invoices/payments (ownership
 * enforced by the route against parents.studentIds).
 *
 * Returns: { summary, invoices[], payments[] } with parent-safe projections.
 * No payment gateway, no receipts PDF, no editing.
 */

const invoiceService = require("./invoiceService");

const DEFAULT_SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";

function summarize(invoices) {
  let totalDue = 0, totalInvoiced = 0, totalPaid = 0;
  const counts = { paid: 0, pending: 0, partial: 0, overdue: 0 };
  for (const i of invoices) {
    totalInvoiced += i.totalAmount || 0;
    totalPaid     += i.paidAmount  || 0;
    if ((i.balance || 0) > 0) totalDue += i.balance;
    const s = String(i.status || "").toLowerCase();
    if (s === "paid")         counts.paid++;
    else if (s === "overdue") counts.overdue++;
    else if (s === "partial") counts.partial++;
    else                      counts.pending++;
  }
  return { totalDue, totalInvoiced, totalPaid, invoiceCount: invoices.length, counts };
}

function toInvoiceSafe(i) {
  return {
    invoiceNumber: i.invoiceNumber,
    studentId:     i.studentId,
    studentName:   i.studentName,
    feeType:       i.feeType,
    invoiceDate:   i.invoiceDate,
    dueDate:       i.dueDate,
    totalAmount:   i.totalAmount,
    paidAmount:    i.paidAmount,
    balance:       i.balance,
    status:        i.status,
  };
}

function toPaymentSafe(p) {
  return {
    receiptNumber: p.receiptNumber,
    invoiceNumber: p.invoiceNumber,
    studentId:     p.studentId,
    studentName:   p.studentName,
    amount:        p.amount,
    paymentMode:   p.paymentMode,
    paymentDate:   p.paymentDate || p.createdAt || "",
  };
}

/**
 * @param {Object} opts
 * @param {string}   opts.schoolId
 * @param {string[]} opts.studentIds  — all linked children
 * @param {string}  [opts.studentId]  — restrict to one child (must be linked)
 */
async function getFees({ schoolId = DEFAULT_SCHOOL_ID, studentIds = [], studentId } = {}) {
  const ids = studentId ? [studentId] : studentIds;
  if (!ids.length) return { summary: summarize([]), invoices: [], payments: [] };

  const [invArrays, payArrays] = await Promise.all([
    Promise.all(ids.map(id => invoiceService.getAllInvoices({ schoolId, studentId: id }))),
    Promise.all(ids.map(id => invoiceService.getAllPayments(null, { schoolId, studentId: id }))),
  ]);

  const invoices = invArrays.flat().map(toInvoiceSafe)
    .sort((a, b) => (b.invoiceDate || "").localeCompare(a.invoiceDate || ""));
  const payments = payArrays.flat().map(toPaymentSafe)
    .sort((a, b) => (b.paymentDate || "").localeCompare(a.paymentDate || ""));

  return { summary: summarize(invoices), invoices, payments };
}

module.exports = { getFees };
