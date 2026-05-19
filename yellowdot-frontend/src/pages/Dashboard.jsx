/**
 * Dashboard.jsx — Yellow Dot CRM Home
 * ─────────────────────────────────────────────────────────────────
 * Compact operational dashboard using yd design system.
 * Fetches live data from: /students, /api/invoices
 * ─────────────────────────────────────────────────────────────────
 */

import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { INR, sumAmounts } from "../utils/currency";
import { api } from "../services/authService";

const get = url => api.get(url).then(r => r.data);

function todayLabel() {
  return new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

// ── Quick-nav shortcuts ────────────────────────────────────────────
const QUICK_NAV = [
  { label: "Students",       path: "/students",            icon: "🎓", desc: "Manage student profiles" },
  { label: "Attendance",     path: "/attendance",          icon: "📅", desc: "Mark & track attendance" },
  { label: "Invoices",       path: "/invoice",             icon: "📄", desc: "Fee invoices & payments" },
  { label: "Fees",           path: "/fees",                icon: "💳", desc: "Fee collection overview" },
  { label: "Nap Tracker",    path: "/nap-tracker",         icon: "😴", desc: "Today's nap sessions" },
  { label: "Food",           path: "/food-consumption",    icon: "🥣", desc: "Meal tracking & menu" },
  { label: "Pickup Auth",    path: "/pickup-authorization",icon: "🚗", desc: "Authorized pickup persons" },
  { label: "Live CCTV",      path: "/live-cctv",           icon: "📹", desc: "Camera monitoring" },
];

export default function Dashboard() {
  const [students,  setStudents]  = useState([]);
  const [invoices,  setInvoices]  = useState([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    Promise.allSettled([
      get("/students"),
      get("/api/invoices"),
    ]).then(([stuRes, invRes]) => {
      if (stuRes.status === "fulfilled") {
        const data = stuRes.value;
        setStudents(Array.isArray(data) ? data : data?.students || []);
      }
      if (invRes.status === "fulfilled" && invRes.value.success) {
        setInvoices(invRes.value.invoices || []);
      }
    }).finally(() => setLoading(false));
  }, []);

  // ── Derived stats ──────────────────────────────────────────────
  const stats = useMemo(() => {
    const active    = students.filter(s => (s.Status || "").toLowerCase() === "active").length;
    const collected   = sumAmounts(invoices, "paidAmount");
    const outstanding = sumAmounts(invoices, "balance");
    const overdue   = invoices.filter(i => i.status === "Overdue").length;
    const pending   = invoices.filter(i => i.status === "Pending").length;
    const paid      = invoices.filter(i => i.status === "Paid").length;

    // Class breakdown
    const classCounts = {};
    students.forEach(s => {
      const c = s.Class || "Unknown";
      classCounts[c] = (classCounts[c] || 0) + 1;
    });

    return { active, collected, outstanding, overdue, pending, paid, total: students.length, classCounts };
  }, [students, invoices]);

  const topClasses = useMemo(() =>
    Object.entries(stats.classCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5),
    [stats.classCounts]
  );

  const recentInvoices = useMemo(() =>
    [...invoices].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")).slice(0, 6),
    [invoices]
  );

  const STATUS_BADGE = {
    Paid:      "badge badge-success",
    Pending:   "badge badge-warn",
    Partial:   "badge badge-info",
    Overdue:   "badge badge-danger",
    Cancelled: "badge badge-neutral",
  };

  return (
    <div className="max-w-[1100px] mx-auto">
      {/* ── Page header ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="yd-title-page" style={{ fontSize: 32 }}>Dashboard</h1>
          <p className="yd-text-secondary mt-1">{todayLabel()}</p>
        </div>
        <Link to="/students" className="btn btn-primary btn-sm">
          + Add Student
        </Link>
      </div>

      {/* ── KPI stat bar ────────────────────────────────────────── */}
      <div className="grid grid-cols-6 gap-3 mb-6">
        {[
          { label: "Total Students", value: loading ? "—" : stats.total,       sub: `${stats.active} active`,        color: "text-yd-navy"    },
          { label: "Collected",      value: loading ? "—" : INR(stats.collected), sub: `${stats.paid} invoices paid`, color: "text-yd-success" },
          { label: "Outstanding",    value: loading ? "—" : INR(stats.outstanding), sub: "balance due",              color: "text-yd-danger"  },
          { label: "Overdue",        value: loading ? "—" : stats.overdue,     sub: "past due date",                 color: "text-yd-danger"  },
          { label: "Pending",        value: loading ? "—" : stats.pending,     sub: "awaiting payment",              color: "text-yd-warn"    },
          { label: "Total Invoices", value: loading ? "—" : invoices.length,   sub: `${stats.paid} paid`,            color: "text-yd-navy"    },
        ].map(s => (
          <div key={s.label} className="yd-stat">
            <div className="yd-stat-label">{s.label}</div>
            <div className={`yd-stat-value text-lg ${s.color}`}>{s.value}</div>
            <div className="yd-stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-5 mb-6">
        {/* ── Recent invoices ──────────────────────────────────── */}
        <div className="col-span-2 yd-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="yd-title-card">Recent Invoices</h2>
            <Link to="/invoice" className="text-xs font-semibold text-yd-text-2 hover:text-yd-navy transition-colors">
              View all →
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-10 yd-skeleton rounded-yd" />
              ))}
            </div>
          ) : recentInvoices.length === 0 ? (
            <div className="yd-empty py-8">
              <div className="yd-empty-icon">📄</div>
              <div className="yd-empty-title">No invoices yet</div>
              <Link to="/invoice" className="btn btn-primary btn-xs mt-3">Create Invoice</Link>
            </div>
          ) : (
            <div className="space-y-1">
              {recentInvoices.map((inv, i) => (
                <div key={inv.invoiceNumber || i}
                  className="flex items-center gap-3 px-3 py-2 rounded-yd hover:bg-yd-yellow-pale transition-colors cursor-default">
                  <div className="w-7 h-7 rounded-yd-sm bg-yd-yellow-soft flex items-center justify-center text-xs font-black text-yd-navy flex-shrink-0">
                    {(inv.studentName || "?")[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-yd-text truncate">{inv.studentName || "—"}</div>
                    <div className="text-[10px] text-yd-text-3">{inv.invoiceNumber} · {inv.feeType}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs font-bold text-yd-navy">{INR(inv.totalAmount)}</div>
                    <span className={STATUS_BADGE[inv.status] || "badge badge-neutral"}>{inv.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Class breakdown ──────────────────────────────────── */}
        <div className="yd-card p-4">
          <h2 className="yd-title-card mb-3">Students by Class</h2>
          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-8 yd-skeleton rounded-yd" />
              ))}
            </div>
          ) : topClasses.length === 0 ? (
            <div className="yd-empty py-4">
              <div className="yd-empty-title">No students yet</div>
            </div>
          ) : (
            <div className="space-y-2">
              {topClasses.map(([cls, count]) => {
                const pct = stats.total ? Math.round((count / stats.total) * 100) : 0;
                return (
                  <div key={cls}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-yd-text-2">{cls}</span>
                      <span className="text-xs font-bold text-yd-navy">{count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-yd-border-light overflow-hidden">
                      <div className="h-full rounded-full bg-yd-yellow transition-all"
                        style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Finance summary ─────────────────────────────────── */}
          <div className="mt-4 pt-4 border-t border-yd-border-light space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-yd-text-3">Total billed</span>
              <span className="font-bold text-yd-navy">{INR(sumAmounts(invoices, "totalAmount"))}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-yd-text-3">Collected</span>
              <span className="font-bold text-green-600">{INR(stats.collected)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-yd-text-3">Outstanding</span>
              <span className="font-bold text-red-600">{INR(stats.outstanding)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick navigation grid ────────────────────────────────── */}
      <div className="yd-card p-4">
        <h2 className="yd-title-card mb-3">Quick Navigation</h2>
        <div className="grid grid-cols-4 gap-2">
          {QUICK_NAV.map(nav => (
            <Link key={nav.path} to={nav.path}
              className="flex items-start gap-2.5 p-3 rounded-yd border border-yd-border-light hover:border-yd-yellow hover:bg-yd-yellow-pale transition-all group">
              <span className="text-xl mt-0.5 flex-shrink-0">{nav.icon}</span>
              <div>
                <div className="text-xs font-bold text-yd-navy group-hover:text-yd-navy">{nav.label}</div>
                <div className="text-[10px] text-yd-text-3 mt-0.5">{nav.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
