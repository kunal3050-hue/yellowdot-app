/**
 * financeService.js — Parent Ledger data layer
 * ─────────────────────────────────────────────────────────────────
 * Thin wrapper over the existing invoice/payment REST APIs that
 * assembles a double-entry style ledger for a single student.
 *
 *   GET /api/invoices?studentId=  → { success, invoices }
 *   GET /api/payments?studentId=  → { success, payments }
 *
 * No new backend endpoints — reuses what server.js already exposes.
 * All money is run through parseCurrency() so Sheet/Firestore strings
 * never trigger string-concatenation bugs.
 * ─────────────────────────────────────────────────────────────────
 */

import { api } from "./authService";
import { parseCurrency } from "../utils/currency";

const unwrap = (res, key) =>
  res?.success ? (res[key] || []) : (Array.isArray(res) ? res : []);

/** Fetch all invoices for one student. */
export async function fetchStudentInvoices(studentId) {
  const res = await api.get(`/api/invoices?studentId=${encodeURIComponent(studentId)}`).then(r => r.data);
  const all = unwrap(res, "invoices");
  // Server filtering is best-effort; enforce it client-side too.
  return all.filter(i => (i.studentId || i.Student_ID || "") === studentId);
}

/** Fetch all payments for one student. */
export async function fetchStudentPayments(studentId) {
  const res = await api.get(`/api/payments?studentId=${encodeURIComponent(studentId)}`).then(r => r.data);
  const all = unwrap(res, "payments");
  return all.filter(p => (p.studentId || p.Student_ID || "") === studentId);
}

/** Best-effort date extraction → "YYYY-MM-DD" (sortable). */
function isoDate(raw) {
  if (!raw) return "";
  const s = String(raw).slice(0, 10);
  return s;
}

/**
 * Build a chronological ledger from invoices (debits) and payments (credits).
 * Each invoice raises the balance owed; each payment reduces it.
 * Returns rows sorted oldest→newest with a cumulative runningBalance.
 *
 * Row shape: { date, type, reference, description, debit, credit, runningBalance }
 */
export function buildLedger(invoices = [], payments = []) {
  const debits = invoices.map(inv => ({
    date:        isoDate(inv.invoiceDate || inv.createdAt || inv.dueDate),
    type:        "Invoice",
    reference:   inv.invoiceNumber || inv.Invoice_Number || "",
    description: inv.feeType || inv.Fees_Type || "Fee",
    debit:       parseCurrency(inv.totalAmount ?? inv.Total_Amount),
    credit:      0,
  }));

  const credits = payments.map(pay => ({
    date:        isoDate(pay.paymentDate || pay.createdAt),
    type:        "Payment",
    reference:   pay.receiptNumber || pay.receiptNo || pay.paymentId || "",
    description: `${pay.paymentMode || "Payment"}${pay.invoiceNumber ? ` · ${pay.invoiceNumber}` : ""}`,
    debit:       0,
    credit:      parseCurrency(pay.amount ?? pay.Amount),
  }));

  const rows = [...debits, ...credits].sort((a, b) => {
    // Undated rows sink to the bottom but keep a stable order.
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date.localeCompare(b.date);
  });

  let balance = 0;
  for (const row of rows) {
    balance += row.debit - row.credit;
    row.runningBalance = balance;
  }
  return rows;
}

/** Convert ledger rows to a CSV string (with header). */
export function ledgerToCSV(rows = []) {
  const esc = v => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ["Date", "Type", "Reference", "Description", "Debit", "Credit", "Running Balance"];
  const lines = rows.map(r => [
    r.date, r.type, r.reference, r.description,
    r.debit ? r.debit.toFixed(2) : "",
    r.credit ? r.credit.toFixed(2) : "",
    r.runningBalance.toFixed(2),
  ].map(esc).join(","));
  return [header.join(","), ...lines].join("\n");
}

/** Trigger a client-side file download of arbitrary text. */
export function downloadFile(filename, text, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Generic tabular export helpers ───────────────────────────────────────────
// Shared by the Collection Dashboard (and reusable elsewhere). A "column" is
// { key, label, format?(value, row) }. These avoid every screen re-inventing
// CSV/Excel serialization.

const csvEsc = v => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const htmlEsc = v =>
  String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Serialize rows to CSV text (with header) given column definitions. */
export function rowsToCSV(columns, rows = []) {
  const header = columns.map(c => csvEsc(c.label)).join(",");
  const body = rows.map(r =>
    columns.map(c => csvEsc(c.format ? c.format(r[c.key], r) : r[c.key])).join(",")
  );
  return [header, ...body].join("\n");
}

/**
 * Build a single-sheet Excel file as an HTML table (.xls). Excel opens this
 * natively, so we get an "Export Excel" with zero extra dependencies.
 */
export function rowsToExcelHTML(columns, rows = [], sheetName = "Sheet1") {
  const head = columns.map(c => `<th>${htmlEsc(c.label)}</th>`).join("");
  const body = rows.map(r =>
    `<tr>${columns.map(c => `<td>${htmlEsc(c.format ? c.format(r[c.key], r) : r[c.key])}</td>`).join("")}</tr>`
  ).join("");
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">` +
    `<head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>` +
    `<x:Name>${htmlEsc(sheetName)}</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>` +
    `</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>` +
    `<body><table border="1"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
}

/** Download rows as a .csv file. */
export function downloadCSV(filename, columns, rows) {
  downloadFile(filename, rowsToCSV(columns, rows), "text/csv;charset=utf-8");
}

/** Download rows as an Excel-openable .xls file. */
export function downloadExcel(filename, columns, rows, sheetName) {
  downloadFile(filename, rowsToExcelHTML(columns, rows, sheetName), "application/vnd.ms-excel");
}

// ── Functions required by components/finance/ParentLedger.jsx ────────────────
// These power the StudentProfile → Finance tab (per-student view).

/**
 * Fetch both invoices and payments for a single student.
 * Returns { invoices, payments } — no new backend routes needed.
 */
export async function fetchStudentFinanceData(studentId) {
  const [invoices, payments] = await Promise.all([
    fetchStudentInvoices(studentId),
    fetchStudentPayments(studentId),
  ]);
  return { invoices, payments };
}

/**
 * Build a running-balance ledger from a student's invoices + payments.
 * Row shape matches what components/finance/ParentLedger.jsx expects:
 *   { date, type, docNumber, description, debit, credit, balance, meta }
 */
export function buildLedgerEntries(invoices = [], payments = []) {
  const rows = [
    ...invoices.map(inv => ({
      date:        isoDate(inv.invoiceDate || inv.createdAt || inv.dueDate),
      type:        "Invoice",
      docNumber:   inv.invoiceNumber || inv.Invoice_Number || "",
      description: inv.feeType || inv.Fees_Type || "Fee",
      debit:       parseCurrency(inv.totalAmount ?? inv.Total_Amount),
      credit:      0,
      meta:        { dueDate: inv.dueDate || "", status: inv.status || "" },
    })),
    ...payments.map(pay => ({
      date:        isoDate(pay.paymentDate || pay.createdAt),
      type:        "Payment",
      docNumber:   pay.receiptNumber || pay.receiptNo || pay.paymentId || "",
      description: [pay.paymentMode, pay.invoiceNumber].filter(Boolean).join(" · ") || "Payment",
      debit:       0,
      credit:      parseCurrency(pay.amount ?? pay.Amount),
      meta:        {},
    })),
  ].sort((a, b) => {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date.localeCompare(b.date);
  });

  let balance = 0;
  for (const row of rows) {
    balance += row.debit - row.credit;
    row.balance = balance;
  }
  return rows;
}

/**
 * Compute summary totals from a student's invoice array.
 * Returns { totalBilled, totalPaid, outstanding, overdue }.
 */
export function computeLedgerSummary(invoices = []) {
  let totalBilled = 0, totalPaid = 0, outstanding = 0, overdue = 0;
  for (const inv of invoices) {
    totalBilled  += parseCurrency(inv.totalAmount ?? inv.Total_Amount);
    totalPaid    += parseCurrency(inv.paidAmount  ?? inv.Paid_Amount);
    outstanding  += parseCurrency(inv.balance     ?? inv.Balance);
    if ((inv.status || inv.Payment_Status) === "Overdue")
      overdue += parseCurrency(inv.balance ?? inv.Balance);
  }
  return { totalBilled, totalPaid, outstanding, overdue };
}

/**
 * Derive the list of unique academic year strings (e.g. "2025-26")
 * from an invoice array, sorted newest-first.
 * Indian academic year runs April → March.
 */
export function getAcademicYears(invoices = []) {
  const set = new Set();
  for (const inv of invoices) {
    const raw = inv.invoiceDate || inv.createdAt || "";
    if (!raw) continue;
    const d = new Date(String(raw).slice(0, 10));
    if (isNaN(d.getTime())) continue;
    const y = d.getFullYear();
    const m = d.getMonth(); // 0-based; April = 3
    const start = m < 3 ? y - 1 : y;
    set.add(`${start}-${String(start + 1).slice(2)}`);
  }
  return [...set].sort((a, b) => b.localeCompare(a));
}

/**
 * Filter ledger entries by optional fromDate / toDate / academicYear.
 * academicYear is a string like "2025-26".
 */
export function filterLedgerEntries(entries = [], { fromDate = "", toDate = "", academicYear = "" } = {}) {
  return entries.filter(e => {
    const d = e.date;
    if (!d) return true; // undated rows pass through
    if (fromDate && d < fromDate) return false;
    if (toDate   && d > toDate)   return false;
    if (academicYear) {
      const [startY] = academicYear.split("-").map(Number);
      const endY = startY + 1;
      // AY start = April 1 of startY, end = March 31 of endY
      const ayStart = `${startY}-04-01`;
      const ayEnd   = `${endY}-03-31`;
      if (d < ayStart || d > ayEnd) return false;
    }
    return true;
  });
}
