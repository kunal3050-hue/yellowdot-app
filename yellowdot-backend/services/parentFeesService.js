/**
 * parentFeesService.js — Parent Module · Fees (read-only)
 * ──────────────────────────────────────────────────────────────────
 * Parent-facing fees view. Reads the `invoices` and `payments`
 * collections directly.
 *
 * Previously this composed the legacy `invoiceService`. That service was
 * removed with the finance module rebuild, so the two small queries it
 * needed now live here. This keeps the parent contract stable across the
 * rebuild: the route, hook and page are untouched, and the moment the new
 * finance module starts writing invoices/payments in the same core shape
 * ({ studentId, totalAmount, paidAmount, balance, status }), parents see
 * their data again with no further change.
 *
 * Parents see only their linked children's records (ownership enforced by
 * the route against parents.studentIds).
 *
 * Returns: { summary, invoices[], payments[] } with parent-safe projections.
 * No payment gateway, no receipt PDFs, no editing.
 */

const { db } = require("../firebaseAdmin");

const DEFAULT_SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";

/** Firestore/legacy rows sometimes carry amounts as strings. */
function num(v) {
  if (typeof v === "number") return isFinite(v) ? v : 0;
  const n = parseFloat(String(v == null ? "" : v).replace(/[^0-9.-]/g, ""));
  return isFinite(n) ? n : 0;
}

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
    totalAmount:   num(i.totalAmount),
    paidAmount:    num(i.paidAmount),
    balance:       num(i.balance),
    status:        i.status,
  };
}

function toPaymentSafe(p) {
  return {
    receiptNumber: p.receiptNumber,
    invoiceNumber: p.invoiceNumber,
    studentId:     p.studentId,
    studentName:   p.studentName,
    amount:        num(p.amount),
    paymentMode:   p.paymentMode,
    paymentDate:   p.paymentDate || p.createdAt || "",
  };
}

/**
 * Single equality query per collection, then filter in memory — the same
 * approach the previous implementation used, so no composite index is
 * required. Both collections are small (one document per child per month).
 */
async function _readScoped(collection, schoolId, ids) {
  const snap = await db.collection(collection).where("schoolId", "==", schoolId).get();
  const wanted = new Set(ids);
  return snap.docs.map(d => d.data()).filter(d => wanted.has(d.studentId));
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

  const [rawInvoices, rawPayments] = await Promise.all([
    _readScoped("invoices", schoolId, ids),
    _readScoped("payments", schoolId, ids),
  ]);

  const invoices = rawInvoices.map(toInvoiceSafe)
    .sort((a, b) => (b.invoiceDate || "").localeCompare(a.invoiceDate || ""));
  const payments = rawPayments.map(toPaymentSafe)
    .sort((a, b) => (b.paymentDate || "").localeCompare(a.paymentDate || ""));

  return { summary: summarize(invoices), invoices, payments };
}

module.exports = { getFees };
