/**
 * Analytics.jsx — Financial Analytics Dashboard
 * ─────────────────────────────────────────────────────────────────
 * Uses yd design system. Fetches from new /api/invoices + /api/payments.
 * Wrapped in MainLayout (provides sidebar).
 * ─────────────────────────────────────────────────────────────────
 */

import { useEffect, useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { api } from "../services/authService";

const get = url => api.get(url).then(r => r.data);
const INR = n => `₹${(Number(n) || 0).toLocaleString("en-IN")}`;

// Brand-consistent chart palette
const CHART_COLORS = ["#F4C400", "#04114B", "#6B7280", "#D4A800", "#1A2E6B"];

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="yd-stat">
      <div className="yd-stat-label">{label}</div>
      <div className={`yd-stat-value ${accent || "text-yd-navy"}`}>{value}</div>
      {sub && <div className="yd-stat-sub">{sub}</div>}
    </div>
  );
}

// Custom chart tooltip
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="yd-card px-3 py-2 text-xs">
      <div className="font-bold text-yd-navy mb-1">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.fill || p.color }} />
          <span className="text-yd-text-2">{p.name}:</span>
          <span className="font-semibold text-yd-navy">
            {typeof p.value === "number" && p.value > 999 ? INR(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function Analytics() {
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    Promise.allSettled([
      get("/api/invoices"),
      get("/api/payments"),
    ]).then(([invRes, payRes]) => {
      if (invRes.status === "fulfilled" && invRes.value.success) setInvoices(invRes.value.invoices || []);
      if (payRes.status === "fulfilled" && payRes.value.success) setPayments(payRes.value.payments || []);
    }).finally(() => setLoading(false));
  }, []);

  // ── Derived analytics ──────────────────────────────────────────
  const stats = useMemo(() => {
    const totalBilled   = invoices.reduce((s, i) => s + (Number(i.totalAmount) || 0), 0);
    const totalCollected= invoices.reduce((s, i) => s + (Number(i.paidAmount)  || 0), 0);
    const totalPending  = invoices.reduce((s, i) => s + (Number(i.balance)     || 0), 0);
    const paid          = invoices.filter(i => i.status === "Paid").length;
    const overdue       = invoices.filter(i => i.status === "Overdue").length;
    const partial       = invoices.filter(i => i.status === "Partial").length;
    const pending       = invoices.filter(i => i.status === "Pending").length;
    const collectionRate= totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;
    return { totalBilled, totalCollected, totalPending, paid, overdue, partial, pending, collectionRate };
  }, [invoices]);

  // ── Monthly revenue chart ──────────────────────────────────────
  const monthlyData = useMemo(() => {
    const buckets = {};
    payments.forEach(p => {
      const d = p.paymentDate || p.createdAt || "";
      // Try to parse date
      let month = "Unknown";
      const m = d.match(/(\d{4})[\/\-](\d{2})/);
      if (m) {
        const date = new Date(`${m[1]}-${m[2]}-01`);
        month = date.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
      } else {
        const parts = d.split(/[\/\-]/);
        if (parts.length >= 3) {
          const [dd, mm, yyyy] = parts;
          const date = new Date(`${yyyy?.length === 4 ? yyyy : "20"+yyyy}-${mm}-01`);
          if (!isNaN(date)) month = date.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
        }
      }
      buckets[month] = (buckets[month] || 0) + (Number(p.amount) || 0);
    });
    return Object.entries(buckets)
      .map(([month, revenue]) => ({ month, revenue }))
      .slice(-8);
  }, [payments]);

  // ── Invoice status distribution ────────────────────────────────
  const statusData = useMemo(() => [
    { name: "Paid",      value: stats.paid,    fill: "#b09830" },
    { name: "Pending",   value: stats.pending, fill: "#B45309" },
    { name: "Partial",   value: stats.partial, fill: "#d4a828" },
    { name: "Overdue",   value: stats.overdue, fill: "#c0402a" },
  ].filter(d => d.value > 0), [stats]);

  // ── Payment mode breakdown ─────────────────────────────────────
  const payModeData = useMemo(() => {
    const modes = {};
    payments.forEach(p => {
      const m = p.paymentMode || "Unknown";
      modes[m] = (modes[m] || 0) + 1;
    });
    return Object.entries(modes).map(([name, value], i) => ({
      name, value, fill: CHART_COLORS[i % CHART_COLORS.length],
    }));
  }, [payments]);

  // ── Fee type breakdown ─────────────────────────────────────────
  const feeTypeData = useMemo(() => {
    const types = {};
    invoices.forEach(inv => {
      const t = inv.feeType || "Other";
      if (!types[t]) types[t] = { billed: 0, collected: 0 };
      types[t].billed    += Number(inv.totalAmount) || 0;
      types[t].collected += Number(inv.paidAmount)  || 0;
    });
    return Object.entries(types)
      .map(([feeType, d]) => ({ feeType: feeType.replace(" Fees",""), ...d }))
      .sort((a, b) => b.billed - a.billed)
      .slice(0, 6);
  }, [invoices]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-yd-text-3">
        <div className="yd-spinner" />
        <span className="text-sm font-semibold">Loading analytics…</span>
      </div>
    );
  }

  return (
    <div className="max-w-[1100px] mx-auto">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="mb-6">
        <h1 className="yd-title-page" style={{ fontSize: 32 }}>Analytics</h1>
        <p className="yd-text-secondary mt-1">Financial performance overview — {invoices.length} invoices · {payments.length} payments</p>
      </div>

      {/* ── KPI stats ───────────────────────────────────────────── */}
      <div className="grid grid-cols-7 gap-3 mb-6">
        <StatCard label="Total Billed"    value={INR(stats.totalBilled)}    />
        <StatCard label="Collected"       value={INR(stats.totalCollected)} accent="text-yd-success" />
        <StatCard label="Outstanding"     value={INR(stats.totalPending)}   accent="text-yd-danger"  />
        <StatCard label="Collection Rate" value={`${stats.collectionRate}%`} sub="of billed" />
        <StatCard label="Paid"            value={stats.paid}    accent="text-yd-success" sub="invoices" />
        <StatCard label="Overdue"         value={stats.overdue} accent="text-yd-danger"  sub="invoices" />
        <StatCard label="Partial"         value={stats.partial} accent="text-yd-info"    sub="invoices" />
      </div>

      {/* ── Charts row 1 ────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        {/* Revenue trend bar chart */}
        <div className="col-span-2 yd-card p-4">
          <h2 className="yd-title-card mb-4">Revenue Trend</h2>
          {monthlyData.length === 0 ? (
            <div className="yd-empty py-8">
              <div className="yd-empty-icon">📊</div>
              <div className="yd-empty-title">No payment data yet</div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyData} barSize={28} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1000 ? `₹${(v/1000).toFixed(0)}k` : `₹${v}`} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(244,196,0,0.08)" }} />
                <Bar dataKey="revenue" name="Revenue" fill="#F4C400" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Invoice status pie chart */}
        <div className="yd-card p-4">
          <h2 className="yd-title-card mb-4">Invoice Status</h2>
          {statusData.length === 0 ? (
            <div className="yd-empty py-8">
              <div className="yd-empty-icon">📄</div>
              <div className="yd-empty-title">No invoices yet</div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                  dataKey="value" nameKey="name" paddingAngle={2}>
                  {statusData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend iconSize={8} iconType="circle"
                  formatter={v => <span style={{ fontSize: 11, color: "#6B7280" }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Charts row 2 ────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        {/* Fee type billed vs collected */}
        <div className="col-span-2 yd-card p-4">
          <h2 className="yd-title-card mb-4">Fee Type Breakdown</h2>
          {feeTypeData.length === 0 ? (
            <div className="yd-empty py-8">
              <div className="yd-empty-icon">💳</div>
              <div className="yd-empty-title">No fee data</div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={feeTypeData} barSize={14} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                <XAxis dataKey="feeType" tick={{ fontSize: 10, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#6B7280" }} axisLine={false} tickLine={false}
                  tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(244,196,0,0.08)" }} />
                <Bar dataKey="billed"    name="Billed"    fill="#04114B" radius={[3,3,0,0]} />
                <Bar dataKey="collected" name="Collected" fill="#F4C400" radius={[3,3,0,0]} />
                <Legend iconSize={8} iconType="circle"
                  formatter={v => <span style={{ fontSize: 11, color: "#6B7280" }}>{v}</span>} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Payment mode pie */}
        <div className="yd-card p-4">
          <h2 className="yd-title-card mb-4">Payment Modes</h2>
          {payModeData.length === 0 ? (
            <div className="yd-empty py-8">
              <div className="yd-empty-icon">💳</div>
              <div className="yd-empty-title">No payments recorded</div>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={payModeData} cx="50%" cy="50%" outerRadius={65}
                    dataKey="value" nameKey="name" paddingAngle={2}>
                    {payModeData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1">
                {payModeData.map((m, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: m.fill }} />
                      <span className="text-yd-text-2">{m.name}</span>
                    </div>
                    <span className="font-bold text-yd-navy">{m.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Recent overdue summary ───────────────────────────────── */}
      {stats.overdue > 0 && (
        <div className="mt-4 yd-card p-4 border-l-4 border-yd-danger">
          <h2 className="yd-title-card mb-2 text-yd-danger">⚠️ Overdue Invoices ({stats.overdue})</h2>
          <div className="space-y-1">
            {invoices.filter(i => i.status === "Overdue").slice(0, 5).map((inv, i) => (
              <div key={inv.invoiceNumber || i}
                className="flex items-center justify-between text-xs px-2 py-1.5 bg-yd-danger-soft rounded-yd-sm">
                <span className="font-semibold text-yd-text">{inv.studentName}</span>
                <span className="text-yd-text-2">{inv.invoiceNumber}</span>
                <span className="font-bold text-yd-danger">{INR(inv.balance)} due</span>
              </div>
            ))}
            {stats.overdue > 5 && (
              <div className="text-xs text-yd-text-3 text-center pt-1">
                + {stats.overdue - 5} more overdue invoices
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
