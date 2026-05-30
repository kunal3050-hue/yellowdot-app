/**
 * Fees.jsx — Fee Collection Overview
 * ─────────────────────────────────────────────────────────────────
 * Shows per-student fee status using live invoice data.
 * Payment management → Invoice module (/invoice)
 * Uses yd design system throughout — no hardcoded colors.
 * ─────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { INR, sumAmounts } from "../utils/currency";
import { api } from "../services/authService";
import { useAuth } from "../contexts/AuthContext";

const get = url => api.get(url).then(r => r.data);

const CLASSES = ["All", "Daycare", "Playgroup", "Nursery", "LKG", "UKG",
                 "Class 1", "Class 2", "Class 3", "Class 4", "Class 5"];

// ── Toast ─────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((type, msg) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, type, msg }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }, []);
  return { toasts, success: m => add("success", m), error: m => add("error", m) };
}

function Toasts({ toasts }) {
  return (
    <div className="fixed bottom-4 right-4 z-[400] flex flex-col gap-1.5 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`yd-toast ${
          t.type === "success" ? "yd-toast-success" : t.type === "error" ? "yd-toast-error" : "yd-toast-info"
        }`}>
          <span>{t.type === "success" ? "✅" : "❌"}</span>
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

export default function Fees() {
  const navigate  = useNavigate();
  const toast     = useToast();
  const { canDo } = useAuth();

  // Action-level permission flags
  const perm = {
    create: canDo("invoices", "create"),
  };

  const [students, setStudents] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading,  setLoading]  = useState(true);

  const [search,       setSearch]       = useState("");
  const [classFilter,  setClassFilter]  = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const mountedRef = useRef(true);
  useEffect(() => { return () => { mountedRef.current = false; }; }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [stuRes, invRes] = await Promise.allSettled([
        get("/students"),
        get("/api/invoices"),
      ]);
      if (!mountedRef.current) return;
      if (stuRes.status === "fulfilled") {
        const d = stuRes.value;
        setStudents(Array.isArray(d) ? d : d?.students || []);
      }
      if (invRes.status === "fulfilled" && invRes.value.success) {
        setInvoices(invRes.value.invoices || []);
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Per-student fee ledger ─────────────────────────────────────
  const studentLedger = useMemo(() => {
    return students.map(s => {
      const sId = s.Student_ID || "";
      const sInv = invoices.filter(i => i.studentId === sId);
      const totalBilled  = sumAmounts(sInv, "totalAmount");
      const totalPaid    = sumAmounts(sInv, "paidAmount");
      const totalBalance = sumAmounts(sInv, "balance");
      const hasOverdue   = sInv.some(i => i.status === "Overdue");
      const hasPending   = sInv.some(i => i.status === "Pending" || i.status === "Partial");

      let feeStatus = "No Invoices";
      if (sInv.length > 0) {
        if (hasOverdue)           feeStatus = "Overdue";
        else if (totalBalance > 0) feeStatus = "Pending";
        else                      feeStatus = "Clear";
      }

      return {
        ...s,
        studentId:    sId,
        totalBilled,
        totalPaid,
        totalBalance,
        feeStatus,
        invoiceCount: sInv.length,
      };
    });
  }, [students, invoices]);

  // ── Summary stats ──────────────────────────────────────────────
  const stats = useMemo(() => ({
    totalStudents: students.length,
    clearCount:    studentLedger.filter(s => s.feeStatus === "Clear").length,
    pendingCount:  studentLedger.filter(s => s.feeStatus === "Pending").length,
    overdueCount:  studentLedger.filter(s => s.feeStatus === "Overdue").length,
    totalBilled:      sumAmounts(studentLedger, "totalBilled"),
    totalCollected:   sumAmounts(studentLedger, "totalPaid"),
    totalOutstanding: sumAmounts(studentLedger, "totalBalance"),
  }), [studentLedger, students.length]);

  // ── Filtered list ──────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = studentLedger;
    if (classFilter !== "All") list = list.filter(s => s.Class === classFilter);
    if (statusFilter !== "All") list = list.filter(s => s.feeStatus === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        (s.Student_Name || "").toLowerCase().includes(q) ||
        (s.Student_ID   || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [studentLedger, classFilter, statusFilter, search]);

  const STATUS_PILL = {
    "Clear":      "badge badge-success",
    "Pending":    "badge badge-warn",
    "Overdue":    "badge badge-danger",
    "No Invoices":"badge badge-neutral",
  };

  return (
    <div className="yd-page">
      <Sidebar />

      <div className="yd-content">
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="yd-page-header">
          <div className="flex items-center gap-3">
            <span className="text-lg">💳</span>
            <div>
              <h1>Fees Overview</h1>
              <p>{students.length} students · {INR(stats.totalCollected)} collected · {INR(stats.totalOutstanding)} outstanding</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/invoice" className="btn btn-ghost btn-sm">View Invoices</Link>
            {perm.create && (
              <Link to="/invoice/new" className="btn btn-primary btn-sm">+ New Invoice</Link>
            )}
          </div>
        </div>

        {/* ── Stat bar ───────────────────────────────────────────── */}
        <div className="flex-shrink-0 px-4 pt-3 pb-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {[
            { label: "Total Students",  value: stats.totalStudents,                       color: "text-yd-navy"    },
            { label: "Fee Clear",       value: stats.clearCount,                           color: "text-yd-success" },
            { label: "Pending",         value: stats.pendingCount,                         color: "text-yd-warn"    },
            { label: "Overdue",         value: stats.overdueCount,                         color: "text-yd-danger"  },
            { label: "Total Billed",    value: INR(stats.totalBilled),                     color: "text-yd-navy"    },
            { label: "Outstanding",     value: INR(stats.totalOutstanding),                color: "text-yd-danger"  },
          ].map(s => (
            <div key={s.label} className="yd-stat">
              <div className="yd-stat-label">{s.label}</div>
              <div className={`yd-stat-value text-lg ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* ── Filter toolbar ─────────────────────────────────────── */}
        <div className="flex-shrink-0 px-4 py-2 flex items-center gap-2 flex-wrap">
          {/* Status filter pills */}
          <div className="flex items-center gap-1">
            {["All", "Clear", "Pending", "Overdue", "No Invoices"].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 text-xs font-semibold rounded-yd-sm transition-colors
                  ${statusFilter === s
                    ? "bg-yd-navy text-white"
                    : "bg-white border border-yd-border text-yd-text-2 hover:border-yd-navy hover:text-yd-navy"
                  }`}>
                {s}
              </button>
            ))}
          </div>

          {/* Class filter */}
          <select value={classFilter} onChange={e => setClassFilter(e.target.value)}
            className="yd-input" style={{ width: "auto", padding: "5px 10px", fontSize: 12 }}>
            {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <div className="flex-1" />

          {/* Search */}
          <div className="flex items-center gap-1.5 border border-yd-border rounded-yd-sm px-2.5 py-1.5 bg-white focus-within:border-yd-yellow transition-colors w-full sm:w-auto sm:min-w-[200px]">
            <span className="text-yd-text-3 text-xs">🔍</span>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search student..."
              className="flex-1 text-xs bg-transparent outline-none text-yd-text placeholder-yd-text-3" />
            {search && <button onClick={() => setSearch("")} className="text-yd-text-3 hover:text-yd-text text-xs">×</button>}
          </div>

          <span className="text-[10px] text-yd-text-3 font-semibold whitespace-nowrap">
            {filtered.length} / {students.length}
          </span>
        </div>

        {/* ── Table ──────────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto px-4 pb-4">
          {loading ? (
            <div className="flex items-center justify-center h-40 gap-3 text-yd-text-3">
              <div className="yd-spinner" />
              <span className="text-sm font-semibold">Loading fee data…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="yd-empty">
              <div className="yd-empty-icon">💳</div>
              <div className="yd-empty-title">No students found</div>
              <div className="yd-empty-sub">Try adjusting filters</div>
            </div>
          ) : (
            <table className="yd-table min-w-[800px]">
              <thead>
                <tr>
                  <th style={{ paddingLeft: 16 }}>Student</th>
                  <th>Class</th>
                  <th>Total Billed</th>
                  <th>Paid</th>
                  <th>Balance</th>
                  <th>Invoices</th>
                  <th>Fee Status</th>
                  <th className="text-right" style={{ paddingRight: 16 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, idx) => (
                  <tr key={s.Student_ID || idx} className="cursor-pointer"
                    onClick={() => navigate("/invoice")}>
                    {/* Student */}
                    <td style={{ paddingLeft: 16 }}>
                      <div className="flex items-center gap-2.5">
                        {s.Profile_Image ? (
                          <img src={s.Profile_Image} alt=""
                            className="w-7 h-7 rounded-yd-sm object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-7 h-7 rounded-yd-sm bg-yd-yellow-soft flex items-center justify-center text-xs font-bold text-yd-navy flex-shrink-0">
                            {(s.Student_Name || "?")[0]}
                          </div>
                        )}
                        <div>
                          <div className="text-xs font-semibold text-yd-text">{s.Student_Name || "—"}</div>
                          <div className="text-[10px] text-yd-text-3">{s.Student_ID}</div>
                        </div>
                      </div>
                    </td>

                    {/* Class */}
                    <td>
                      <span className="badge badge-yellow">{s.Class || "—"}</span>
                    </td>

                    {/* Financials */}
                    <td className="text-xs font-semibold text-yd-navy">{INR(s.totalBilled)}</td>
                    <td className="text-xs font-semibold text-green-600">{INR(s.totalPaid)}</td>
                    <td>
                      <span className={`text-xs font-bold ${s.totalBalance > 0 ? "text-red-600" : "text-green-600"}`}>
                        {INR(s.totalBalance)}
                      </span>
                    </td>

                    {/* Invoice count */}
                    <td className="text-xs text-yd-text-2">{s.invoiceCount} invoice{s.invoiceCount !== 1 ? "s" : ""}</td>

                    {/* Status */}
                    <td>
                      <span className={STATUS_PILL[s.feeStatus] || "badge badge-neutral"}>
                        {s.feeStatus}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="text-right" style={{ paddingRight: 16 }}
                      onClick={e => e.stopPropagation()}>
                      <Link
                        to="/invoice"
                        className="btn btn-primary btn-xs"
                        onClick={e => e.stopPropagation()}>
                        Invoices
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Toasts toasts={toast.toasts} />
    </div>
  );
}
