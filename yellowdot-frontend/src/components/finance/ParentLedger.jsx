/**
 * ParentLedger.jsx — Yellow Dot Finance Tab V1
 * ─────────────────────────────────────────────
 * Comprehensive finance view for Student Profile → Finance Tab.
 * Contains: Summary Cards · Ledger · Invoice History · Payment History · Export
 *
 * Props:
 *   studentId    {string}  required
 *   studentName  {string}  for export headers
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  fetchStudentFinanceData,
  buildLedgerEntries,
  computeLedgerSummary,
  getAcademicYears,
  filterLedgerEntries,
} from "../../services/financeService";
import { INR } from "../../utils/currency";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch { return iso; }
}

function overdueDays(dueDate) {
  if (!dueDate) return 0;
  const due = new Date(dueDate);
  if (isNaN(due)) return 0;
  const today = new Date(); today.setHours(0,0,0,0); due.setHours(0,0,0,0);
  return Math.max(0, Math.floor((today - due) / 86400000));
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SummaryCard({ label, amount, sub, colorScheme, icon }) {
  const schemes = {
    blue:   { wrap: "bg-blue-50 border-blue-100",   val: "text-blue-700",   sub: "text-blue-400"   },
    green:  { wrap: "bg-green-50 border-green-100",  val: "text-green-700",  sub: "text-green-400"  },
    amber:  { wrap: "bg-amber-50 border-amber-200",  val: "text-amber-700",  sub: "text-amber-400"  },
    red:    { wrap: "bg-red-50 border-red-100",      val: "text-red-600",    sub: "text-red-300"    },
  };
  const s = schemes[colorScheme] || schemes.blue;
  return (
    <div className={`rounded-[22px] p-5 border ${s.wrap} flex flex-col gap-1.5`}>
      <div className="flex items-center gap-2">
        <span className="text-base">{icon}</span>
        <p className={`text-[10px] font-bold uppercase tracking-widest ${s.sub}`}>{label}</p>
      </div>
      <p className={`text-[22px] font-black leading-tight ${s.val}`}>{INR(amount)}</p>
      {sub && <p className={`text-[10px] font-medium ${s.sub}`}>{sub}</p>}
    </div>
  );
}

// Status badge
const STATUS_COLORS = {
  Paid:      "bg-green-100 text-green-700",
  Pending:   "bg-amber-100 text-amber-700",
  Partial:   "bg-blue-100 text-blue-700",
  Overdue:   "bg-red-100 text-red-600",
  Cancelled: "bg-gray-100 text-gray-500",
};
function StatusBadge({ status }) {
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COLORS[status] || STATUS_COLORS.Pending}`}>
      {status || "Pending"}
    </span>
  );
}

// Document type badge
const TYPE_COLORS = {
  Invoice: "bg-blue-50 text-blue-700",
  Payment: "bg-green-50 text-green-700",
  Refund:  "bg-orange-50 text-orange-700",
};
function TypeBadge({ type }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${TYPE_COLORS[type] || TYPE_COLORS.Invoice}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${type === "Invoice" ? "bg-blue-400" : type === "Payment" ? "bg-green-400" : "bg-orange-400"}`} />
      {type}
    </span>
  );
}

// Inner tab bar
function InnerTabs({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 border-b border-gray-100 mb-6">
      {tabs.map(t => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
            active === t.key
              ? "border-yellow-400 text-yellow-600 bg-yellow-50"
              : "border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50"
          }`}
        >
          {t.label}
          {t.count != null && (
            <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] ${active === t.key ? "bg-yellow-200 text-yellow-700" : "bg-gray-100 text-gray-500"}`}>
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// Skeleton loading
function Skeleton({ rows = 5 }) {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-[22px]" />)}
      </div>
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="h-10 bg-gray-100 rounded-xl" />
      ))}
    </div>
  );
}

// Empty state
function Empty({ message = "No entries found.", sub }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="w-14 h-14 rounded-2xl bg-yellow-50 border border-yellow-200 flex items-center justify-center text-2xl mb-4">📒</div>
      <p className="font-black text-gray-700">{message}</p>
      {sub && <p className="text-sm text-gray-400 mt-1 max-w-xs">{sub}</p>}
    </div>
  );
}

// ── Export helpers ────────────────────────────────────────────────────────────

function exportCSV(entries, studentName) {
  const headers = ["Date","Type","Document #","Description","Debit (₹)","Credit (₹)","Balance (₹)"];
  const rows = entries.map(e => [
    e.date, e.type, e.docNumber,
    `"${(e.description||"").replace(/"/g,'""')}"`,
    e.debit  > 0 ? e.debit.toFixed(2)  : "",
    e.credit > 0 ? e.credit.toFixed(2) : "",
    e.balance.toFixed(2),
  ]);
  const csv  = [headers, ...rows].map(r => r.join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement("a"), {
    href: url,
    download: `Statement_${(studentName||"student").replace(/\s+/g,"_")}_${new Date().toISOString().slice(0,10)}.csv`,
  });
  a.click();
  URL.revokeObjectURL(url);
}

function printStatement(entries, summary, studentName, filterDesc) {
  const p = n => `₹${Number(n||0).toLocaleString("en-IN")}`;
  const rows = entries.map((e,i) => `
    <tr style="background:${i%2===0?"#fff":"#fafaf8"}">
      <td>${fmtDate(e.date)}</td>
      <td><span class="badge badge-${e.type.toLowerCase()}">${e.type}</span></td>
      <td style="font-family:monospace;font-size:10px">${e.docNumber||"—"}</td>
      <td>${e.description||"—"}</td>
      <td align="right" style="color:#dc2626">${e.debit>0?p(e.debit):""}</td>
      <td align="right" style="color:#16a34a">${e.credit>0?p(e.credit):""}</td>
      <td align="right" style="font-weight:700;color:${e.balance>0?"#b45309":"#16a34a"}">${p(e.balance)}</td>
    </tr>`).join("");

  const w = window.open("","_blank");
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Statement – ${studentName}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:12px;color:#1f1f1f;padding:32px}
    .logo{font-size:20px;font-weight:900;color:#eab308}.hdr{display:flex;justify-content:space-between;margin-bottom:20px;padding-bottom:14px;border-bottom:2px solid #eab308}
    .title{font-size:17px;font-weight:900}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0}
    .sc{border:1px solid #ece7d8;border-radius:8px;padding:10px;background:#fffdf7}
    .sc label{display:block;font-size:9px;color:#888;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px}
    .sc span{font-size:14px;font-weight:900}
    table{width:100%;border-collapse:collapse;margin:10px 0}
    th{background:linear-gradient(135deg,#facc15,#eab308);color:#1f1f1f;padding:7px 10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em}
    td{padding:6px 10px;border-bottom:1px solid #eee;font-size:11px}
    .badge{display:inline-block;padding:2px 7px;border-radius:4px;font-size:9px;font-weight:700}
    .badge-invoice{background:#dbeafe;color:#1d4ed8}.badge-payment{background:#d1fae5;color:#065f46}
    .footer{margin-top:20px;padding-top:12px;border-top:1px solid #eee;font-size:10px;color:#888;text-align:center}
    @media print{button{display:none!important}}
  </style></head><body>
  <div class="hdr">
    <div><div class="logo">Yellow Dot</div><div style="font-size:10px;color:#888;margin-top:2px">Premium Preschool CRM</div></div>
    <div style="text-align:right">
      <div class="title">Parent Ledger Statement</div>
      <div style="font-size:11px;color:#555;margin-top:3px">${studentName||"Student"}</div>
      ${filterDesc?`<div style="font-size:10px;color:#888;margin-top:2px">${filterDesc}</div>`:""}
      <div style="font-size:10px;color:#888;margin-top:2px">Generated: ${new Date().toLocaleDateString("en-IN",{dateStyle:"long"})}</div>
    </div>
  </div>
  <div class="summary">
    <div class="sc"><label>Total Billed</label><span>${p(summary.totalBilled)}</span></div>
    <div class="sc"><label>Total Paid</label><span style="color:#16a34a">${p(summary.totalPaid)}</span></div>
    <div class="sc"><label>Outstanding</label><span style="color:#b45309">${p(summary.outstanding)}</span></div>
    <div class="sc"><label>Overdue</label><span style="color:#dc2626">${p(summary.overdue)}</span></div>
  </div>
  <table><thead><tr><th>Date</th><th>Type</th><th>Document #</th><th>Description</th>
    <th align="right">Debit</th><th align="right">Credit</th><th align="right">Balance</th></tr></thead>
  <tbody>${rows||'<tr><td colspan="7" align="center" style="color:#888;padding:20px">No entries</td></tr>'}</tbody>
  </table>
  <div class="footer">Computer-generated statement · No signature required</div>
  <button onclick="window.print()" style="margin-top:14px;padding:7px 18px;background:linear-gradient(135deg,#facc15,#eab308);color:#1f1f1f;border:none;border-radius:6px;cursor:pointer;font-weight:700">Print / Save PDF</button>
  </body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 500);
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ParentLedger({ studentId, studentName }) {
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");

  // Inner sub-tab
  const [subTab, setSubTab] = useState("ledger");

  // Filters (apply to Ledger view)
  const [fromDate,     setFromDate]     = useState("");
  const [toDate,       setToDate]       = useState("");
  const [academicYear, setAcademicYear] = useState("");

  // ── Load ─────────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!studentId) return;
    setLoading(true); setError("");
    try {
      const { invoices: inv, payments: pay } = await fetchStudentFinanceData(studentId);
      setInvoices(inv);
      setPayments(pay);
    } catch (e) {
      setError(e?.message || "Failed to load finance data.");
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => { load(); }, [load]);

  // ── Derived ──────────────────────────────────────────────────────────────────
  const allEntries = useMemo(() => buildLedgerEntries(invoices, payments), [invoices, payments]);
  const summary    = useMemo(() => computeLedgerSummary(invoices), [invoices]);
  const ayOptions  = useMemo(() => getAcademicYears(invoices), [invoices]);

  const filteredEntries = useMemo(
    () => filterLedgerEntries(allEntries, { fromDate, toDate, academicYear }),
    [allEntries, fromDate, toDate, academicYear]
  );

  const activeInvoices = useMemo(
    () => invoices.filter(i => i.status !== "Cancelled" && i.status !== "Void")
                  .sort((a, b) => new Date(b.invoiceDate) - new Date(a.invoiceDate)),
    [invoices]
  );

  const sortedPayments = useMemo(
    () => [...payments].sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate)),
    [payments]
  );

  const hasFilters = !!(fromDate || toDate || academicYear);
  const closingBalance = filteredEntries.length
    ? filteredEntries[filteredEntries.length - 1].balance
    : 0;

  const filterDesc = [
    academicYear ? `AY ${academicYear}` : "",
    fromDate     ? `From ${fromDate}`   : "",
    toDate       ? `To ${toDate}`       : "",
  ].filter(Boolean).join("  ·  ");

  // ── Sub-tabs ─────────────────────────────────────────────────────────────────
  const SUB_TABS = [
    { key: "ledger",   label: "Ledger",           count: filteredEntries.length },
    { key: "invoices", label: "Invoice History",   count: activeInvoices.length  },
    { key: "payments", label: "Payment History",   count: sortedPayments.length  },
    { key: "balance",  label: "Outstanding Balance" },
  ];

  if (loading) return <Skeleton />;

  if (error) return (
    <div className="bg-red-50 border border-red-200 text-red-600 font-bold rounded-2xl px-5 py-4 text-sm">
      {error} — <button onClick={load} className="underline">Retry</button>
    </div>
  );

  return (
    <div className="space-y-5">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-black text-[#0F172A]">Finance</h2>
          <p className="text-gray-400 text-sm mt-0.5">
            Billing history &amp; ledger for {studentName || "this student"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => exportCSV(filteredEntries, studentName)}
            disabled={filteredEntries.length === 0}
            className="flex items-center gap-1.5 bg-green-50 hover:bg-green-100 disabled:opacity-40 text-green-700 font-bold text-xs px-4 py-2 rounded-xl border border-green-200 transition-all"
          >
            {/* Download icon */}
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 2v8M4 7l4 4 4-4"/><path d="M2 13h12"/>
            </svg>
            Export Excel
          </button>
          <button
            onClick={() => printStatement(filteredEntries, summary, studentName, filterDesc)}
            disabled={filteredEntries.length === 0}
            className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 disabled:opacity-40 text-blue-700 font-bold text-xs px-4 py-2 rounded-xl border border-blue-200 transition-all"
          >
            {/* Print icon */}
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="10" width="10" height="5" rx="1"/>
              <path d="M3 10V4a1 1 0 011-1h8a1 1 0 011 1v6"/>
              <path d="M5 3V1h6v2"/><circle cx="12.5" cy="7" r=".5" fill="currentColor"/>
            </svg>
            Print / PDF
          </button>
          <button
            onClick={load}
            className="flex items-center gap-1.5 bg-gray-50 hover:bg-gray-100 text-gray-500 font-bold text-xs px-3 py-2 rounded-xl border border-gray-200 transition-all"
          >
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 8A6 6 0 112 8"/><path d="M14 2v6h-6"/>
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard
          label="Total Billed" amount={summary.totalBilled} colorScheme="blue" icon="📄"
          sub={`${activeInvoices.length} invoice${activeInvoices.length !== 1 ? "s" : ""}`}
        />
        <SummaryCard
          label="Total Paid" amount={summary.totalPaid} colorScheme="green" icon="✅"
          sub={`${sortedPayments.length} payment${sortedPayments.length !== 1 ? "s" : ""}`}
        />
        <SummaryCard
          label="Outstanding" amount={summary.outstanding} colorScheme="amber" icon="⏳"
          sub={summary.outstanding > 0 ? "Balance due" : "Fully settled"}
        />
        <SummaryCard
          label="Overdue" amount={summary.overdue} colorScheme="red" icon="⚠️"
          sub={summary.overdue > 0 ? "Past due date" : "Nothing overdue"}
        />
      </div>

      {/* ── Main card ── */}
      <div className="bg-white rounded-[28px] shadow-sm border border-gray-100 p-6">

        {/* Inner sub-tabs */}
        <InnerTabs tabs={SUB_TABS} active={subTab} onChange={setSubTab} />

        {/* ══════════════ LEDGER ══════════════ */}
        {subTab === "ledger" && (
          <>
            {/* Filter bar */}
            <div className="flex flex-wrap items-end gap-3 mb-5 p-4 bg-gray-50 rounded-2xl">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Academic Year</label>
                <select
                  value={academicYear}
                  onChange={e => setAcademicYear(e.target.value)}
                  className="bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-semibold outline-none focus:border-yellow-400 min-w-[130px]"
                >
                  <option value="">All Years</option>
                  {ayOptions.map(ay => <option key={ay} value={ay}>{ay}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">From</label>
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                  className="bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-semibold outline-none focus:border-yellow-400" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">To</label>
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                  className="bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-semibold outline-none focus:border-yellow-400" />
              </div>
              {hasFilters && (
                <button
                  onClick={() => { setFromDate(""); setToDate(""); setAcademicYear(""); }}
                  className="text-[10px] font-bold text-red-400 hover:text-red-600 px-3 py-1.5 bg-white rounded-xl border border-gray-200 self-end transition-all"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Running balance info */}
            {filteredEntries.length > 0 && (
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                  {filteredEntries.length} entries{hasFilters ? " (filtered)" : ""}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400">Closing balance:</span>
                  <span className={`text-sm font-black ${closingBalance > 0 ? "text-amber-600" : "text-green-600"}`}>
                    {INR(Math.abs(closingBalance))}
                    <span className="text-[9px] font-bold ml-1 opacity-70">
                      {closingBalance > 0 ? "due" : closingBalance < 0 ? "advance" : "settled"}
                    </span>
                  </span>
                </div>
              </div>
            )}

            {/* Ledger table */}
            {filteredEntries.length === 0
              ? <Empty
                  message={allEntries.length === 0 ? "No financial transactions yet." : "No entries match your filters."}
                  sub={allEntries.length === 0 ? "Create an invoice from the Invoices page to get started." : undefined}
                />
              : (
                <div className="overflow-x-auto rounded-2xl border border-gray-100">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        {["Date","Type","Document #","Description","Debit","Credit","Balance"].map((h, i) => (
                          <th key={h} className={`px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 whitespace-nowrap ${i >= 4 ? "text-right" : "text-left"}`}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEntries.map((e, idx) => (
                        <tr key={`${e.type}-${e.docNumber}-${idx}`}
                          className={`border-b border-gray-50 hover:bg-yellow-50/30 transition-colors ${idx % 2 === 0 ? "" : "bg-gray-50/20"}`}>
                          <td className="px-4 py-3 whitespace-nowrap text-xs font-semibold text-gray-500">{fmtDate(e.date)}</td>
                          <td className="px-4 py-3"><TypeBadge type={e.type} /></td>
                          <td className="px-4 py-3 font-mono text-[11px] text-gray-500 whitespace-nowrap">{e.docNumber || "—"}</td>
                          <td className="px-4 py-3">
                            <p className="text-xs text-gray-700 font-medium leading-tight">{e.description || "—"}</p>
                            {e.meta?.dueDate && e.type === "Invoice" && (
                              <p className="text-[10px] text-gray-400 mt-0.5">
                                Due {fmtDate(e.meta.dueDate)}
                                {e.meta.status && e.meta.status !== "Paid" && (
                                  <span className={`ml-1.5 font-bold ${e.meta.status === "Overdue" ? "text-red-500" : "text-amber-500"}`}>
                                    · {e.meta.status}
                                  </span>
                                )}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {e.debit > 0
                              ? <span className="text-xs font-bold text-red-500">{INR(e.debit)}</span>
                              : <span className="text-gray-200 text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {e.credit > 0
                              ? <span className="text-xs font-bold text-green-600">{INR(e.credit)}</span>
                              : <span className="text-gray-200 text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <span className={`text-sm font-black ${e.balance > 0 ? "text-amber-600" : e.balance < 0 ? "text-green-600" : "text-gray-400"}`}>
                              {e.balance === 0 ? "—" : INR(Math.abs(e.balance))}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 border-t-2 border-gray-200">
                        <td colSpan={4} className="px-4 py-2.5">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-wide">Total</span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className="text-xs font-black text-red-500">
                            {INR(filteredEntries.reduce((s, e) => s + e.debit, 0))}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className="text-xs font-black text-green-600">
                            {INR(filteredEntries.reduce((s, e) => s + e.credit, 0))}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className={`text-sm font-black ${closingBalance > 0 ? "text-amber-600" : "text-green-600"}`}>
                            {INR(Math.abs(closingBalance))}
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )
            }
          </>
        )}

        {/* ══════════════ INVOICE HISTORY ══════════════ */}
        {subTab === "invoices" && (
          <>
            {activeInvoices.length === 0
              ? <Empty message="No invoices yet." sub="Invoices created for this student will appear here." />
              : (
                <div className="overflow-x-auto rounded-2xl border border-gray-100">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        {["Invoice #","Date","Due Date","Fee Type","Total","Paid","Balance","Status"].map((h, i) => (
                          <th key={h} className={`px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 whitespace-nowrap ${i >= 4 ? "text-right" : "text-left"}`}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {activeInvoices.map((inv, idx) => {
                        const od = overdueDays(inv.dueDate);
                        return (
                          <tr key={inv.invoiceNumber || idx}
                            className={`border-b border-gray-50 hover:bg-yellow-50/30 transition-colors ${idx % 2 === 0 ? "" : "bg-gray-50/20"}`}>
                            <td className="px-4 py-3 font-mono text-[11px] font-bold text-gray-700 whitespace-nowrap">
                              {inv.invoiceNumber || "—"}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDate(inv.invoiceDate)}</td>
                            <td className="px-4 py-3 text-xs whitespace-nowrap">
                              <span className={od > 0 && inv.status !== "Paid" ? "text-red-500 font-bold" : "text-gray-500"}>
                                {fmtDate(inv.dueDate)}
                              </span>
                              {od > 0 && inv.status !== "Paid" && (
                                <span className="ml-1 text-[9px] text-red-400">{od}d overdue</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-600">{inv.feeType || "—"}</td>
                            <td className="px-4 py-3 text-right text-xs font-bold text-gray-700 whitespace-nowrap">{INR(inv.totalAmount)}</td>
                            <td className="px-4 py-3 text-right text-xs font-bold text-green-600 whitespace-nowrap">{INR(inv.paidAmount)}</td>
                            <td className="px-4 py-3 text-right text-xs font-bold whitespace-nowrap">
                              <span className={Number(inv.balance) > 0 ? "text-amber-600" : "text-gray-400"}>
                                {INR(inv.balance)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <StatusBadge status={inv.status} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 border-t-2 border-gray-200">
                        <td colSpan={4} className="px-4 py-2.5 text-[10px] font-black text-gray-400 uppercase tracking-wide">Total</td>
                        <td className="px-4 py-2.5 text-right text-xs font-black text-gray-700">{INR(summary.totalBilled)}</td>
                        <td className="px-4 py-2.5 text-right text-xs font-black text-green-600">{INR(summary.totalPaid)}</td>
                        <td className="px-4 py-2.5 text-right text-xs font-black text-amber-600">{INR(summary.outstanding)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )
            }
          </>
        )}

        {/* ══════════════ PAYMENT HISTORY ══════════════ */}
        {subTab === "payments" && (
          <>
            {sortedPayments.length === 0
              ? <Empty message="No payments recorded yet." sub="Payments will appear here once collected." />
              : (
                <div className="overflow-x-auto rounded-2xl border border-gray-100">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        {["Date","Amount","Mode","Invoice #","Transaction ID","Staff","Notes"].map((h, i) => (
                          <th key={h} className={`px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 whitespace-nowrap ${i === 1 ? "text-right" : "text-left"}`}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedPayments.map((pay, idx) => (
                        <tr key={pay.paymentId || idx}
                          className={`border-b border-gray-50 hover:bg-yellow-50/30 transition-colors ${idx % 2 === 0 ? "" : "bg-gray-50/20"}`}>
                          <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDate(pay.paymentDate)}</td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-sm font-black text-green-600">{INR(pay.amount)}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-block bg-gray-100 text-gray-600 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                              {pay.paymentMode || "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-gray-500 whitespace-nowrap">
                            {pay.invoiceNumber || "—"}
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-gray-400">
                            {pay.transactionId || "—"}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">{pay.staffName || "—"}</td>
                          <td className="px-4 py-3 text-xs text-gray-400">{pay.notes || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 border-t-2 border-gray-200">
                        <td className="px-4 py-2.5 text-[10px] font-black text-gray-400 uppercase tracking-wide">Total Collected</td>
                        <td className="px-4 py-2.5 text-right text-sm font-black text-green-600">{INR(summary.totalPaid)}</td>
                        <td colSpan={5} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )
            }
          </>
        )}

        {/* ══════════════ OUTSTANDING BALANCE ══════════════ */}
        {subTab === "balance" && (
          <div className="space-y-4">
            {/* Balance hero */}
            <div className={`rounded-2xl p-6 flex items-center justify-between ${
              summary.outstanding <= 0
                ? "bg-green-50 border border-green-200"
                : summary.overdue > 0
                  ? "bg-red-50 border border-red-200"
                  : "bg-amber-50 border border-amber-200"
            }`}>
              <div>
                <p className={`text-xs font-bold uppercase tracking-wide mb-1 ${
                  summary.outstanding <= 0 ? "text-green-500" : summary.overdue > 0 ? "text-red-400" : "text-amber-500"
                }`}>
                  {summary.outstanding <= 0 ? "Account Settled" : summary.overdue > 0 ? "Overdue Balance" : "Outstanding Balance"}
                </p>
                <p className={`text-3xl font-black ${
                  summary.outstanding <= 0 ? "text-green-700" : summary.overdue > 0 ? "text-red-600" : "text-amber-700"
                }`}>
                  {INR(summary.outstanding)}
                </p>
                {summary.outstanding > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    {summary.overdue > 0
                      ? `₹${summary.overdue.toLocaleString("en-IN")} is overdue`
                      : "No overdue amount"}
                  </p>
                )}
              </div>
              <div className="text-5xl">
                {summary.outstanding <= 0 ? "✅" : summary.overdue > 0 ? "⚠️" : "⏳"}
              </div>
            </div>

            {/* Per-invoice breakdown */}
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest pt-1">Per Invoice Breakdown</h3>
            {activeInvoices.filter(i => Number(i.balance) > 0).length === 0 ? (
              <div className="rounded-2xl bg-green-50 border border-green-100 p-5 text-center text-sm font-bold text-green-700">
                All invoices are fully paid.
              </div>
            ) : (
              <div className="space-y-2">
                {activeInvoices.filter(i => Number(i.balance) > 0).map(inv => {
                  const od = overdueDays(inv.dueDate);
                  const pct = inv.totalAmount > 0
                    ? Math.min(100, Math.round((inv.paidAmount / inv.totalAmount) * 100))
                    : 0;
                  return (
                    <div key={inv.invoiceNumber} className={`rounded-2xl border p-4 ${od > 0 ? "bg-red-50 border-red-100" : "bg-white border-gray-100"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-[11px] font-bold text-gray-600">{inv.invoiceNumber}</span>
                            <StatusBadge status={inv.status} />
                            {od > 0 && (
                              <span className="text-[9px] font-bold text-red-500 bg-red-100 px-2 py-0.5 rounded-full">
                                {od}d overdue
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">{inv.feeType} · Due {fmtDate(inv.dueDate)}</p>
                          <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-green-400 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <p className="text-[10px] text-gray-400 mt-1">{pct}% paid</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-[10px] text-gray-400">Balance Due</p>
                          <p className={`text-lg font-black ${od > 0 ? "text-red-600" : "text-amber-600"}`}>
                            {INR(inv.balance)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>{/* end main card */}
    </div>
  );
}
