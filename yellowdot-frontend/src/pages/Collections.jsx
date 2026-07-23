/**
 * Collections.jsx — Collection Dashboard V1
 * ─────────────────────────────────────────────────────────────────
 * Finance → Collections. School-wide fee-collection command center.
 *
 * Consolidation note: this screen is unchanged (same route, same data
 * fetching, same charts/tables) — it is now ALSO reachable from the
 * consolidated Finance Platform nav (sidebarConfig.js's "finance_collections"
 * item, shown once FINANCE_FOUNDATION_ENABLED is on). `<FinanceSubNav
 * active="collections" />` is rendered ONLY while the flag is on
 * (useFinancePlatformStatus) — the legacy, flag-off experience stays
 * byte-for-byte unchanged, since RBAC alone (can(routeKey)) is NOT
 * flag-aware and would otherwise leak Finance Platform tabs into this
 * page even with the module disabled.
 *
 *   Cards   : Today · This Week · This Month · Academic Year ·
 *             Outstanding · Overdue
 *   Charts  : Monthly Collection Trend · Class-wise Collection ·
 *             Fee Type Collection
 *   Tables  : Recent Payments · Outstanding Invoices
 *   Filters : Academic Year · Class · Fee Type · Date Range
 *   Actions : Export CSV · Export Excel · Print
 *
 * Data sources (reused, no new backend):
 *   invoiceService.fetchAllInvoices()  → GET /api/invoices
 *   paymentService.fetchAllPayments()  → GET /api/payments
 *   financeService                     → CSV / Excel export helpers
 *
 * Scales to 1000+ students: one fetch per collection, all aggregation
 * memoized, tables virtually capped (sorted + sliced) so the DOM never
 * renders thousands of rows.
 * ─────────────────────────────────────────────────────────────────
 */

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import Sidebar from "../components/Sidebar";
import { INR, parseCurrency, sumAmounts } from "../utils/currency";
import { fetchAllInvoices } from "../services/invoiceService";
import { fetchAllPayments } from "../services/paymentService";
import { downloadCSV, downloadExcel } from "../services/financeService";
import FinanceSubNav from "./finance/components/FinanceSubNav";
import useFinancePlatformStatus from "./finance/hooks/useFinancePlatformStatus";

const CLASSES = ["All", "Daycare", "Playgroup", "Nursery", "LKG", "UKG",
                 "Class 1", "Class 2", "Class 3", "Class 4", "Class 5"];

const TABLE_LIMIT = 50;   // cap rendered rows; full set still flows to exports

// ── Date helpers ────────────────────────────────────────────────────
function toDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);              // ISO
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})/);        // dd/mm/yyyy
  if (m) { const y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; return new Date(y, +m[2] - 1, +m[1]); }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
const iso = d => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : "");
const fmtDate = raw => { const d = toDate(raw); return d ? iso(d) : (raw || "—"); };

/** Indian academic year (Apr–Mar) label, e.g. 2026-06 → "2026-27". */
function academicYear(d) {
  if (!d) return "Unknown";
  const y = d.getFullYear(), m = d.getMonth();
  const start = m < 3 ? y - 1 : y;            // Jan–Mar belong to prior AY
  return `${start}-${String(start + 1).slice(2)}`;
}
function startOfWeek(d) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;           // Monday = 0
  x.setDate(x.getDate() - day); x.setHours(0, 0, 0, 0);
  return x;
}

// ── Small UI atoms ──────────────────────────────────────────────────
function StatCard({ label, value, accent, sub }) {
  return (
    <div className="yd-stat">
      <div className="yd-stat-label">{label}</div>
      <div className={`yd-stat-value text-lg ${accent || "text-yd-navy"}`}>{value}</div>
      {sub && <div className="yd-stat-sub">{sub}</div>}
    </div>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="yd-card px-3 py-2 text-xs">
      <div className="font-bold text-yd-navy mb-1">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.fill || p.color }} />
          <span className="text-yd-text-2">{p.name}:</span>
          <span className="font-semibold text-yd-navy">{INR(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

function ChartCard({ title, children, empty }) {
  return (
    <div className="yd-card p-4">
      <h2 className="yd-title-card mb-4">{title}</h2>
      {empty
        ? <div className="yd-empty py-8"><div className="yd-empty-icon">📊</div><div className="yd-empty-title">{empty}</div></div>
        : children}
    </div>
  );
}

const STATUS_BADGE = {
  Paid:    "badge badge-success",
  Partial: "badge badge-info",
  Pending: "badge badge-warn",
  Overdue: "badge badge-danger",
};

// ════════════════════════════════════════════════════════════════════
export default function Collections() {
  const { enabled: financeEnabled } = useFinancePlatformStatus();
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");

  // Filters
  const [ay,        setAy]        = useState("All");
  const [cls,       setCls]       = useState("All");
  const [feeType,   setFeeType]   = useState("All");
  const [from,      setFrom]      = useState("");
  const [to,        setTo]        = useState("");

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    Promise.all([fetchAllInvoices(), fetchAllPayments()])
      .then(([inv, pay]) => {
        if (!mountedRef.current) return;
        setInvoices(inv);
        setPayments(pay);
      })
      .catch(e => { if (mountedRef.current) setError(e?.message || "Failed to load collections"); })
      .finally(() => { if (mountedRef.current) setLoading(false); });
    return () => { mountedRef.current = false; };
  }, []);

  // Join payments → their invoice so each payment carries class + feeType.
  const invByNumber = useMemo(() => {
    const map = new Map();
    for (const i of invoices) map.set(i.invoiceNumber || i.Invoice_Number, i);
    return map;
  }, [invoices]);

  const enrichedPayments = useMemo(() => payments.map(p => {
    const inv = invByNumber.get(p.invoiceNumber) || {};
    const d   = toDate(p.paymentDate || p.createdAt);
    return {
      ...p,
      _date:    d,
      _class:   inv.class || p.class || "—",
      _feeType: inv.feeType || "—",
      _amount:  parseCurrency(p.amount ?? p.Amount),
      _ay:      academicYear(d),
    };
  }), [payments, invByNumber]);

  const enrichedInvoices = useMemo(() => invoices.map(i => {
    const d = toDate(i.invoiceDate || i.createdAt || i.dueDate);
    return {
      ...i,
      _date:    d,
      _class:   i.class || "—",
      _feeType: i.feeType || "—",
      _balance: parseCurrency(i.balance ?? i.Balance),
      _paid:    parseCurrency(i.paidAmount ?? i.Paid_Amount),
      _total:   parseCurrency(i.totalAmount ?? i.Total_Amount),
      _ay:      academicYear(d),
    };
  }), [invoices]);

  // Filter option lists derived from data
  const ayOptions = useMemo(() => {
    const set = new Set();
    enrichedPayments.forEach(p => p._ay && p._ay !== "Unknown" && set.add(p._ay));
    enrichedInvoices.forEach(i => i._ay && i._ay !== "Unknown" && set.add(i._ay));
    set.add(academicYear(new Date()));
    return ["All", ...[...set].sort((a, b) => b.localeCompare(a))];
  }, [enrichedPayments, enrichedInvoices]);

  const feeTypeOptions = useMemo(() => {
    const set = new Set();
    enrichedInvoices.forEach(i => i.feeType && set.add(i.feeType));
    return ["All", ...[...set].sort()];
  }, [enrichedInvoices]);

  // Apply Academic Year + Class + Fee Type (NOT date range) → "scoped" sets
  const scopeMatch = (row) =>
    (ay      === "All" || row._ay      === ay)  &&
    (cls     === "All" || row._class   === cls) &&
    (feeType === "All" || row._feeType === feeType);

  const scopedPayments = useMemo(() => enrichedPayments.filter(scopeMatch), [enrichedPayments, ay, cls, feeType]);
  const scopedInvoices = useMemo(() => enrichedInvoices.filter(scopeMatch), [enrichedInvoices, ay, cls, feeType]);

  // Date-range overlay (applies to tables + range total)
  const fromD = useMemo(() => toDate(from), [from]);
  const toD   = useMemo(() => { const d = toDate(to); if (d) d.setHours(23, 59, 59, 999); return d; }, [to]);
  const inRange = (d) => !!d && (!fromD || d >= fromD) && (!toD || d <= toD);

  const rangePayments = useMemo(
    () => (fromD || toD ? scopedPayments.filter(p => inRange(p._date)) : scopedPayments),
    [scopedPayments, fromD, toD]
  );

  // ── KPI cards ──────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const now = new Date();
    const todayISO = iso(now);
    const weekStart = startOfWeek(now);
    const sameMonth = d => d && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();

    const sumP = arr => arr.reduce((s, p) => s + p._amount, 0);
    return {
      today:     sumP(scopedPayments.filter(p => p._date && iso(p._date) === todayISO)),
      week:      sumP(scopedPayments.filter(p => p._date && p._date >= weekStart)),
      month:     sumP(scopedPayments.filter(p => sameMonth(p._date))),
      ayTotal:   sumP(scopedPayments),
      outstanding: scopedInvoices.reduce((s, i) => s + Math.max(0, i._balance), 0),
      overdue:   scopedInvoices.filter(i => (i.status || i.Payment_Status) === "Overdue")
                                .reduce((s, i) => s + Math.max(0, i._balance), 0),
    };
  }, [scopedPayments, scopedInvoices]);

  // ── Charts ─────────────────────────────────────────────────────────
  const monthlyTrend = useMemo(() => {
    const buckets = {};
    scopedPayments.forEach(p => {
      if (!p._date) return;
      const key = `${p._date.getFullYear()}-${String(p._date.getMonth() + 1).padStart(2, "0")}`;
      buckets[key] = (buckets[key] || 0) + p._amount;
    });
    return Object.entries(buckets)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([key, amount]) => {
        const [y, m] = key.split("-");
        return { month: new Date(+y, +m - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "2-digit" }), amount };
      });
  }, [scopedPayments]);

  const classWise = useMemo(() => {
    const buckets = {};
    scopedInvoices.forEach(i => { buckets[i._class] = (buckets[i._class] || 0) + i._paid; });
    return Object.entries(buckets)
      .map(([cls, collected]) => ({ cls, collected }))
      .filter(d => d.collected > 0)
      .sort((a, b) => b.collected - a.collected);
  }, [scopedInvoices]);

  const feeTypeWise = useMemo(() => {
    const buckets = {};
    scopedInvoices.forEach(i => { buckets[i._feeType] = (buckets[i._feeType] || 0) + i._paid; });
    return Object.entries(buckets)
      .map(([feeType, collected]) => ({ feeType: feeType.replace(/\s*Fees?$/i, ""), collected }))
      .filter(d => d.collected > 0)
      .sort((a, b) => b.collected - a.collected)
      .slice(0, 8);
  }, [scopedInvoices]);

  // ── Tables (sorted; full set for export, sliced for render) ─────────
  const recentPaymentsAll = useMemo(
    () => [...rangePayments].sort((a, b) => (b._date?.getTime() || 0) - (a._date?.getTime() || 0)),
    [rangePayments]
  );
  const outstandingAll = useMemo(
    () => scopedInvoices
      .filter(i => i._balance > 0 && (!fromD && !toD ? true : inRange(i._date)))
      .sort((a, b) => b._balance - a._balance),
    [scopedInvoices, fromD, toD]
  );

  // ── Exports ─────────────────────────────────────────────────────────
  const paymentColumns = [
    { key: "receiptNumber", label: "Receipt No", format: (v, r) => v || r.paymentId || "" },
    { key: "_date",         label: "Date",       format: v => (v ? iso(v) : "") },
    { key: "studentName",   label: "Student" },
    { key: "_class",        label: "Class" },
    { key: "paymentMode",   label: "Mode" },
    { key: "transactionId", label: "Transaction ID" },
    { key: "invoiceNumber", label: "Invoice No" },
    { key: "_amount",       label: "Amount", format: v => Number(v || 0).toFixed(2) },
  ];

  const stamp = () => new Date().toISOString().slice(0, 10);
  const exportCSV   = useCallback(() => downloadCSV(`collections_${stamp()}.csv`, paymentColumns, recentPaymentsAll), [recentPaymentsAll]);
  const exportExcel = useCallback(() => downloadExcel(`collections_${stamp()}.xls`, paymentColumns, recentPaymentsAll, "Collections"), [recentPaymentsAll]);

  const printDashboard = useCallback(() => {
    const win = window.open("", "_blank", "width=1000,height=760");
    if (!win) return;
    const card = (l, v) => `<div class="kpi"><div class="kl">${l}</div><div class="kv">${v}</div></div>`;
    const payRows = recentPaymentsAll.slice(0, 200).map(p => `<tr>
      <td>${p.receiptNumber || p.paymentId || ""}</td><td>${p._date ? iso(p._date) : "—"}</td>
      <td>${p.studentName || ""}</td><td>${p._class}</td><td>${p.paymentMode || ""}</td>
      <td>${p.transactionId || ""}</td><td class="num">${INR(p._amount)}</td></tr>`).join("");
    const outRows = outstandingAll.slice(0, 200).map(i => `<tr>
      <td>${i.invoiceNumber || ""}</td><td>${i.studentName || ""}</td><td>${i._class}</td>
      <td>${i._feeType}</td><td>${i.dueDate ? fmtDate(i.dueDate) : "—"}</td>
      <td>${i.status || ""}</td><td class="num">${INR(i._balance)}</td></tr>`).join("");
    win.document.write(`<html><head><title>Collection Dashboard — ${stamp()}</title><style>
      body{font-family:Arial,sans-serif;padding:28px;color:#1f1f1f}
      h1{font-size:20px;margin:0 0 2px}.meta{color:#555;font-size:12px;margin-bottom:14px}
      .kpis{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:18px}
      .kpi{border:1px solid #ddd;border-radius:8px;padding:8px 12px;min-width:150px}
      .kl{font-size:11px;color:#666}.kv{font-size:16px;font-weight:800}
      h2{font-size:14px;margin:18px 0 6px}table{width:100%;border-collapse:collapse;font-size:11px}
      th,td{border:1px solid #ddd;padding:5px 7px;text-align:left}th{background:#F4C400}
      .num{text-align:right}</style></head><body>
      <h1>Collection Dashboard</h1>
      <div class="meta">Academic Year: ${ay} · Class: ${cls} · Fee Type: ${feeType}${from || to ? ` · Range: ${from || "…"} → ${to || "…"}` : ""} · Generated ${new Date().toLocaleString("en-IN")}</div>
      <div class="kpis">
        ${card("Today's Collection", INR(kpis.today))}${card("This Week", INR(kpis.week))}
        ${card("This Month", INR(kpis.month))}${card("Academic Year", INR(kpis.ayTotal))}
        ${card("Outstanding", INR(kpis.outstanding))}${card("Overdue", INR(kpis.overdue))}
      </div>
      <h2>Recent Payments (${recentPaymentsAll.length})</h2>
      <table><thead><tr><th>Receipt No</th><th>Date</th><th>Student</th><th>Class</th><th>Mode</th><th>Transaction ID</th><th class="num">Amount</th></tr></thead><tbody>${payRows || `<tr><td colspan="7">No payments.</td></tr>`}</tbody></table>
      <h2>Outstanding Invoices (${outstandingAll.length})</h2>
      <table><thead><tr><th>Invoice No</th><th>Student</th><th>Class</th><th>Fee Type</th><th>Due Date</th><th>Status</th><th class="num">Balance</th></tr></thead><tbody>${outRows || `<tr><td colspan="7">None.</td></tr>`}</tbody></table>
    </body></html>`);
    win.document.close(); win.focus(); win.print();
  }, [recentPaymentsAll, outstandingAll, kpis, ay, cls, feeType, from, to]);

  const resetFilters = () => { setAy("All"); setCls("All"); setFeeType("All"); setFrom(""); setTo(""); };
  const hasFilters = ay !== "All" || cls !== "All" || feeType !== "All" || from || to;

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div className="yd-page">
      <Sidebar />
      <div className="yd-content">

        {/* Header */}
        <div className="yd-page-header">
          <div className="flex items-center gap-3">
            <span className="text-lg">📈</span>
            <div>
              <h1>Collection Dashboard</h1>
              <p>{invoices.length} invoices · {payments.length} payments · {INR(kpis.ayTotal)} collected (scope)</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportCSV}   className="btn btn-ghost btn-sm" disabled={loading || !recentPaymentsAll.length}>⤓ CSV</button>
            <button onClick={exportExcel} className="btn btn-ghost btn-sm" disabled={loading || !recentPaymentsAll.length}>⤓ Excel</button>
            <button onClick={printDashboard} className="btn btn-primary btn-sm" disabled={loading}>🖨 Print</button>
          </div>
        </div>

        {/* Finance Platform tab strip — only once the module is consolidated */}
        {financeEnabled === true && (
          <div style={{ padding: "0 16px" }}>
            <FinanceSubNav active="collections" />
          </div>
        )}

        {/* KPI cards */}
        <div className="flex-shrink-0 px-4 pt-3 pb-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <StatCard label="Today's Collection"      value={INR(kpis.today)}       accent="text-yd-success" />
          <StatCard label="This Week"               value={INR(kpis.week)}        accent="text-yd-success" />
          <StatCard label="This Month"              value={INR(kpis.month)}       accent="text-yd-success" />
          <StatCard label="Academic Year"           value={INR(kpis.ayTotal)}     accent="text-yd-navy"    sub={ay === "All" ? "all years" : ay} />
          <StatCard label="Outstanding Amount"      value={INR(kpis.outstanding)} accent="text-yd-danger"  />
          <StatCard label="Overdue Amount"          value={INR(kpis.overdue)}     accent="text-yd-danger"  />
        </div>

        {/* Filters */}
        <div className="flex-shrink-0 px-4 py-2 flex items-center gap-2 flex-wrap">
          <FilterSelect label="Academic Year" value={ay}      onChange={setAy}      options={ayOptions} />
          <FilterSelect label="Class"         value={cls}     onChange={setCls}     options={CLASSES} />
          <FilterSelect label="Fee Type"      value={feeType} onChange={setFeeType} options={feeTypeOptions} />
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-semibold text-yd-text-3">From</span>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="yd-input" style={{ width: "auto", padding: "5px 8px", fontSize: 12 }} />
            <span className="text-[10px] font-semibold text-yd-text-3">To</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="yd-input" style={{ width: "auto", padding: "5px 8px", fontSize: 12 }} />
          </div>
          {hasFilters && (
            <button onClick={resetFilters} className="px-3 py-1 text-xs font-semibold rounded-yd-sm bg-white border border-yd-border text-yd-text-2 hover:border-yd-navy hover:text-yd-navy">
              Reset
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-4 pb-6">
          {loading ? (
            <div className="flex items-center justify-center h-40 gap-3 text-yd-text-3">
              <div className="yd-spinner" /><span className="text-sm font-semibold">Loading collections…</span>
            </div>
          ) : error ? (
            <div className="yd-empty"><div className="yd-empty-icon">⚠️</div><div className="yd-empty-title">{error}</div></div>
          ) : (
            <>
              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                <div className="lg:col-span-1">
                  <ChartCard title="Monthly Collection Trend" empty={monthlyTrend.length === 0 ? "No payments yet" : null}>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={monthlyTrend} barSize={22} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                        <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(244,196,0,0.08)" }} />
                        <Bar dataKey="amount" name="Collected" fill="#F4C400" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </div>
                <div className="lg:col-span-1">
                  <ChartCard title="Class-wise Collection" empty={classWise.length === 0 ? "No collection yet" : null}>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={classWise} barSize={18} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                        <XAxis dataKey="cls" tick={{ fontSize: 10, fill: "#6B7280" }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={48} />
                        <YAxis tick={{ fontSize: 10, fill: "#6B7280" }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                        <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(4,17,75,0.06)" }} />
                        <Bar dataKey="collected" name="Collected" fill="#04114B" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </div>
                <div className="lg:col-span-1">
                  <ChartCard title="Fee Type Collection" empty={feeTypeWise.length === 0 ? "No collection yet" : null}>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={feeTypeWise} barSize={18} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                        <XAxis dataKey="feeType" tick={{ fontSize: 10, fill: "#6B7280" }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={48} />
                        <YAxis tick={{ fontSize: 10, fill: "#6B7280" }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                        <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(212,168,0,0.10)" }} />
                        <Bar dataKey="collected" name="Collected" fill="#D4A800" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </div>
              </div>

              {/* Tables */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {/* Recent Payments */}
                <div className="yd-card p-0 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-yd-border">
                    <h2 className="yd-title-card">Recent Payments</h2>
                    <span className="text-[10px] font-semibold text-yd-text-3">{recentPaymentsAll.length} total · showing {Math.min(TABLE_LIMIT, recentPaymentsAll.length)}</span>
                  </div>
                  <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                    {recentPaymentsAll.length === 0 ? (
                      <div className="yd-empty py-8"><div className="yd-empty-icon">💵</div><div className="yd-empty-title">No payments in scope</div></div>
                    ) : (
                      <table className="yd-table min-w-[640px]">
                        <thead><tr>
                          <th style={{ paddingLeft: 16 }}>Receipt No</th><th>Date</th><th>Student</th>
                          <th>Mode</th><th>Transaction ID</th><th className="text-right" style={{ paddingRight: 16 }}>Amount</th>
                        </tr></thead>
                        <tbody>
                          {recentPaymentsAll.slice(0, TABLE_LIMIT).map((p, i) => (
                            <tr key={p.paymentId || i}>
                              <td style={{ paddingLeft: 16 }} className="font-mono text-[11px] text-yd-text-2">{p.receiptNumber || p.paymentId || "—"}</td>
                              <td className="text-xs text-yd-text-2">{p._date ? iso(p._date) : "—"}</td>
                              <td className="text-xs">
                                <div className="font-semibold text-yd-text">{p.studentName || "—"}</div>
                                <div className="text-[10px] text-yd-text-3">{p._class}</div>
                              </td>
                              <td><span className="badge badge-neutral">{p.paymentMode || "—"}</span></td>
                              <td className="font-mono text-[11px] text-yd-text-3">{p.transactionId || "—"}</td>
                              <td className="text-right font-bold text-green-600 text-xs" style={{ paddingRight: 16 }}>{INR(p._amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                {/* Outstanding Invoices */}
                <div className="yd-card p-0 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-yd-border">
                    <h2 className="yd-title-card">Outstanding Invoices</h2>
                    <span className="text-[10px] font-semibold text-yd-text-3">{outstandingAll.length} total · showing {Math.min(TABLE_LIMIT, outstandingAll.length)}</span>
                  </div>
                  <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                    {outstandingAll.length === 0 ? (
                      <div className="yd-empty py-8"><div className="yd-empty-icon">✅</div><div className="yd-empty-title">No outstanding invoices</div></div>
                    ) : (
                      <table className="yd-table min-w-[640px]">
                        <thead><tr>
                          <th style={{ paddingLeft: 16 }}>Invoice No</th><th>Student</th><th>Fee Type</th>
                          <th>Due Date</th><th>Status</th><th className="text-right" style={{ paddingRight: 16 }}>Balance</th>
                        </tr></thead>
                        <tbody>
                          {outstandingAll.slice(0, TABLE_LIMIT).map((inv, i) => {
                            const status = inv.status || inv.Payment_Status || "Pending";
                            return (
                              <tr key={inv.invoiceNumber || i}>
                                <td style={{ paddingLeft: 16 }} className="font-mono text-[11px] text-yd-text-2">{inv.invoiceNumber || "—"}</td>
                                <td className="text-xs">
                                  <div className="font-semibold text-yd-text">{inv.studentName || "—"}</div>
                                  <div className="text-[10px] text-yd-text-3">{inv._class}</div>
                                </td>
                                <td className="text-xs text-yd-text-2">{inv._feeType}</td>
                                <td className="text-xs text-yd-text-2">{inv.dueDate ? fmtDate(inv.dueDate) : "—"}</td>
                                <td><span className={STATUS_BADGE[status] || "badge badge-neutral"}>{status}</span></td>
                                <td className="text-right font-bold text-red-600 text-xs" style={{ paddingRight: 16 }}>{INR(inv._balance)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Filter select ───────────────────────────────────────────────────
function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="flex items-center gap-1">
      <span className="text-[10px] font-semibold text-yd-text-3">{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)} className="yd-input" style={{ width: "auto", padding: "5px 10px", fontSize: 12 }}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
