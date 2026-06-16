/**
 * ParentLedger.jsx — Parent Ledger V1
 * ─────────────────────────────────────────────────────────────────
 * A per-student financial statement mounted inside the Billing tab
 * (Students → select student → Billing). Reuses the existing
 * invoice/payment REST APIs via financeService — no new endpoints.
 *
 * Sub-tabs:
 *   1. Summary   — totals (billed / paid / outstanding) + status mix
 *   2. Ledger    — Date · Type · Reference · Description · Debit · Credit · Running Balance
 *   3. Invoices  — Status · Due Date · Amount
 *   4. Payments  — Receipt No · Date · Mode · Transaction ID · Amount
 *
 * Actions: Export CSV · Print Statement
 * ─────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { INR, sumAmounts } from "../utils/currency";
import {
  fetchStudentInvoices,
  fetchStudentPayments,
  buildLedger,
  ledgerToCSV,
  downloadFile,
} from "../services/financeService";

const SUB_TABS = [
  { id: "summary",  label: "Summary",  icon: "📊" },
  { id: "ledger",   label: "Ledger",   icon: "📒" },
  { id: "invoices", label: "Invoices", icon: "🧾" },
  { id: "payments", label: "Payments", icon: "💵" },
];

const fmtDate = d => (d ? String(d).slice(0, 10) : "—");

export default function ParentLedger({ student }) {
  const studentId = student?.Student_ID || "";
  const [sub,      setSub]      = useState("summary");
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (!studentId) { setLoading(false); return; }
    setLoading(true);
    setError("");
    Promise.all([
      fetchStudentInvoices(studentId),
      fetchStudentPayments(studentId),
    ])
      .then(([inv, pay]) => {
        if (!mountedRef.current) return;
        setInvoices(inv);
        setPayments(pay);
      })
      .catch(e => { if (mountedRef.current) setError(e?.message || "Failed to load ledger"); })
      .finally(() => { if (mountedRef.current) setLoading(false); });
    return () => { mountedRef.current = false; };
  }, [studentId]);

  const ledger = useMemo(() => buildLedger(invoices, payments), [invoices, payments]);

  const totals = useMemo(() => {
    const billed   = sumAmounts(invoices, "totalAmount");
    const paid     = sumAmounts(payments, "amount");
    const balance  = ledger.length ? ledger[ledger.length - 1].runningBalance : (billed - paid);
    return {
      billed,
      paid,
      balance,
      invoiceCount: invoices.length,
      paymentCount: payments.length,
      overdue: invoices.filter(i => (i.status || i.Payment_Status) === "Overdue").length,
    };
  }, [invoices, payments, ledger]);

  // ── Actions ──────────────────────────────────────────────────────
  const handleExportCSV = useCallback(() => {
    const csv = ledgerToCSV(ledger);
    const safe = (student?.Student_Name || studentId || "student").replace(/[^\w.-]+/g, "_");
    downloadFile(`ledger_${safe}_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }, [ledger, student, studentId]);

  const handlePrint = useCallback(() => {
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    const rows = ledger.map(r => `
      <tr>
        <td>${fmtDate(r.date)}</td>
        <td>${r.type}</td>
        <td>${r.reference || ""}</td>
        <td>${r.description || ""}</td>
        <td class="num">${r.debit ? INR(r.debit) : ""}</td>
        <td class="num">${r.credit ? INR(r.credit) : ""}</td>
        <td class="num">${INR(r.runningBalance)}</td>
      </tr>`).join("");
    win.document.write(`
      <html>
        <head>
          <title>Statement — ${student?.Student_Name || studentId}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 32px; color: #1f1f1f; }
            h1 { font-size: 20px; margin: 0 0 4px; }
            .meta { color: #555; font-size: 12px; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
            th { background: #FFD60A; }
            .num { text-align: right; font-variant-numeric: tabular-nums; }
            .totals { margin-top: 16px; font-size: 13px; }
            .totals strong { display: inline-block; min-width: 140px; }
          </style>
        </head>
        <body>
          <h1>Account Statement</h1>
          <div class="meta">
            ${student?.Student_Name || ""} &nbsp;·&nbsp; ${studentId} &nbsp;·&nbsp; ${student?.Class || ""}<br/>
            Guardian: ${student?.Father_Name || "—"} &nbsp;·&nbsp; Generated ${new Date().toLocaleString("en-IN")}
          </div>
          <table>
            <thead>
              <tr><th>Date</th><th>Type</th><th>Reference</th><th>Description</th>
                  <th class="num">Debit</th><th class="num">Credit</th><th class="num">Running Balance</th></tr>
            </thead>
            <tbody>${rows || `<tr><td colspan="7">No transactions.</td></tr>`}</tbody>
          </table>
          <div class="totals">
            <div><strong>Total Billed:</strong> ${INR(totals.billed)}</div>
            <div><strong>Total Paid:</strong> ${INR(totals.paid)}</div>
            <div><strong>Outstanding:</strong> ${INR(totals.balance)}</div>
          </div>
        </body>
      </html>`);
    win.document.close();
    win.focus();
    win.print();
  }, [ledger, totals, student, studentId]);

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div className="mt-4 border-t border-gray-100 pt-3" data-testid="parent-ledger">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <h3 className="text-sm font-black text-gray-900 flex items-center gap-1">📒 Parent Ledger</h3>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={handleExportCSV} disabled={loading || !ledger.length}
            className="px-2.5 py-1 rounded-lg text-[11px] font-bold border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
            ⤓ Export CSV
          </button>
          <button type="button" onClick={handlePrint} disabled={loading || !ledger.length}
            className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-yd-yellow text-[#1f1f1f] hover:bg-yd-yellow-dark shadow-sm disabled:opacity-40">
            🖨 Print Statement
          </button>
        </div>
      </div>

      {/* Sub-tab bar */}
      <div className="flex gap-1 mb-3 bg-gray-100 rounded-xl p-1 w-fit">
        {SUB_TABS.map(t => (
          <button key={t.id} type="button" onClick={() => setSub(t.id)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
              sub === t.id ? "bg-white text-[#1f1f1f] shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            <span className="mr-0.5">{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-1">{[...Array(4)].map((_, i) => <div key={i} className="h-9 rounded-lg bg-gray-100 animate-pulse" />)}</div>
      ) : error ? (
        <div className="text-center py-6 text-rose-500 text-xs font-semibold">{error}</div>
      ) : (
        <>
          {sub === "summary"  && <SummaryView  totals={totals} />}
          {sub === "ledger"   && <LedgerView   rows={ledger} />}
          {sub === "invoices" && <InvoicesView invoices={invoices} />}
          {sub === "payments" && <PaymentsView payments={payments} />}
        </>
      )}
    </div>
  );
}

// ── Summary ─────────────────────────────────────────────────────────
function SummaryView({ totals }) {
  const cards = [
    { label: "Total Billed", value: INR(totals.billed),  cls: "bg-gray-50 border-gray-200 text-gray-800" },
    { label: "Total Paid",   value: INR(totals.paid),    cls: "bg-emerald-50 border-emerald-200 text-emerald-700" },
    { label: "Outstanding",  value: INR(totals.balance), cls: "bg-rose-50 border-rose-200 text-rose-700" },
  ];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {cards.map(c => (
          <div key={c.label} className={`border rounded-xl p-3 text-center ${c.cls}`}>
            <p className="text-lg font-black">{c.value}</p>
            <p className="text-[10px] font-bold mt-0.5 opacity-80">{c.label}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-2 text-[11px] font-semibold text-gray-500">
        <span className="px-2 py-1 rounded-lg bg-gray-50 border border-gray-100">🧾 {totals.invoiceCount} invoices</span>
        <span className="px-2 py-1 rounded-lg bg-gray-50 border border-gray-100">💵 {totals.paymentCount} payments</span>
        {totals.overdue > 0 && (
          <span className="px-2 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-600">⚠ {totals.overdue} overdue</span>
        )}
      </div>
    </div>
  );
}

// ── Ledger ──────────────────────────────────────────────────────────
function LedgerView({ rows }) {
  if (!rows.length) return <Empty icon="📒" msg="No ledger entries yet" />;
  return (
    <div className="overflow-x-auto max-h-72 overflow-y-auto rounded-xl border border-gray-100">
      <table className="w-full text-[11px] min-w-[640px]">
        <thead className="sticky top-0 bg-gray-50 text-gray-500">
          <tr>
            {["Date", "Type", "Reference", "Description"].map(h => <th key={h} className="text-left font-bold px-2 py-1.5">{h}</th>)}
            {["Debit", "Credit", "Running Balance"].map(h => <th key={h} className="text-right font-bold px-2 py-1.5">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-gray-50 hover:bg-gray-50/60">
              <td className="px-2 py-1.5 whitespace-nowrap text-gray-600">{fmtDate(r.date)}</td>
              <td className="px-2 py-1.5">
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black border ${
                  r.type === "Payment" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                  {r.type}
                </span>
              </td>
              <td className="px-2 py-1.5 font-mono text-gray-600 whitespace-nowrap">{r.reference || "—"}</td>
              <td className="px-2 py-1.5 text-gray-500 truncate max-w-[180px]">{r.description || "—"}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-rose-600">{r.debit ? INR(r.debit) : ""}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-emerald-600">{r.credit ? INR(r.credit) : ""}</td>
              <td className="px-2 py-1.5 text-right tabular-nums font-black text-gray-900">{INR(r.runningBalance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Invoices ────────────────────────────────────────────────────────
function InvoicesView({ invoices }) {
  if (!invoices.length) return <Empty icon="🧾" msg="No invoices yet" />;
  const badge = status => {
    const s = status || "Pending";
    if (s === "Paid")    return "bg-yd-success-soft text-yd-success border-yd-success-border";
    if (s === "Overdue") return "bg-yd-danger-soft text-yd-danger border-yd-danger-border";
    if (s === "Partial") return "bg-yd-info-soft text-yd-info border-yd-info-border";
    return "bg-amber-100 text-amber-700 border-amber-200";
  };
  return (
    <div className="overflow-x-auto max-h-72 overflow-y-auto rounded-xl border border-gray-100">
      <table className="w-full text-[11px] min-w-[420px]">
        <thead className="sticky top-0 bg-gray-50 text-gray-500">
          <tr>
            <th className="text-left font-bold px-2 py-1.5">Reference</th>
            <th className="text-left font-bold px-2 py-1.5">Status</th>
            <th className="text-left font-bold px-2 py-1.5">Due Date</th>
            <th className="text-right font-bold px-2 py-1.5">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv, i) => {
            const status = inv.status || inv.Payment_Status || "Pending";
            return (
              <tr key={i} className="border-t border-gray-50 hover:bg-gray-50/60">
                <td className="px-2 py-1.5 font-mono text-gray-600 whitespace-nowrap">{inv.invoiceNumber || inv.Invoice_Number || "—"}</td>
                <td className="px-2 py-1.5">
                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black border ${badge(status)}`}>{status}</span>
                </td>
                <td className="px-2 py-1.5 text-gray-600 whitespace-nowrap">{fmtDate(inv.dueDate || inv.Due_Date)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums font-black text-gray-900">{INR(inv.totalAmount ?? inv.Total_Amount)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Payments ────────────────────────────────────────────────────────
function PaymentsView({ payments }) {
  if (!payments.length) return <Empty icon="💵" msg="No payments recorded" />;
  return (
    <div className="overflow-x-auto max-h-72 overflow-y-auto rounded-xl border border-gray-100">
      <table className="w-full text-[11px] min-w-[520px]">
        <thead className="sticky top-0 bg-gray-50 text-gray-500">
          <tr>
            <th className="text-left font-bold px-2 py-1.5">Receipt No</th>
            <th className="text-left font-bold px-2 py-1.5">Date</th>
            <th className="text-left font-bold px-2 py-1.5">Mode</th>
            <th className="text-left font-bold px-2 py-1.5">Transaction ID</th>
            <th className="text-right font-bold px-2 py-1.5">Amount</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((p, i) => (
            <tr key={i} className="border-t border-gray-50 hover:bg-gray-50/60">
              <td className="px-2 py-1.5 font-mono text-gray-600 whitespace-nowrap">{p.receiptNumber || p.receiptNo || p.paymentId || "—"}</td>
              <td className="px-2 py-1.5 text-gray-600 whitespace-nowrap">{fmtDate(p.paymentDate || p.createdAt)}</td>
              <td className="px-2 py-1.5 text-gray-600">{p.paymentMode || "—"}</td>
              <td className="px-2 py-1.5 font-mono text-gray-500 truncate max-w-[160px]">{p.transactionId || "—"}</td>
              <td className="px-2 py-1.5 text-right tabular-nums font-black text-emerald-700">{INR(p.amount ?? p.Amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Empty state ─────────────────────────────────────────────────────
function Empty({ icon, msg }) {
  return (
    <div className="text-center py-8 text-gray-400">
      <div className="text-3xl mb-2">{icon}</div>
      <p className="text-xs font-semibold">{msg}</p>
    </div>
  );
}
