/**
 * LiveDashboard.jsx — Operational command centre
 * ─────────────────────────────────────────────────────────────────
 * Fetches every card from its real API. Auto-refreshes every 60 s.
 * Shows loading skeletons, then real values (or "—" for truly
 * un-tracked metrics like Staff Present / Transport).
 *
 * Card → API mapping
 * ──────────────────
 * Students
 *   Total Enrolled      GET /students                → array.length
 *   Present Today       GET /api/attendance/summary  → summary.present
 *   Absent Today        totalStudents - presentToday (computed)
 *   Checked In Now      GET /api/attendance/inside   → count
 *   Active Classrooms   GET /api/attendance/inside   → unique class set size
 *
 * Staff
 *   Total Staff         GET /api/users               → non-parent users count
 *   Teachers On Duty    GET /api/users               → teacher-role count
 *   Staff Present       not tracked → "—"
 *   Staff Absent        not tracked → "—"
 *
 * Finance
 *   Fees Collected      GET /api/invoices            → Σ paidAmount
 *   Pending Payments    GET /api/invoices            → count(status Pending|Partial)
 *   Overdue Fees        GET /api/invoices            → Σ balance where status=Overdue
 *   Monthly Collection  GET /api/payments            → Σ amount where paymentDate ≥ month start
 *
 * Operations
 *   Attendance Rate     computed from summary
 *   Pickup Pending      GET /api/pickup-requests?status=pending → count
 *   Meals Served        GET /api/food-consumption?date=today   → unique student count
 *   Transport Active    not configured → "—"
 * ─────────────────────────────────────────────────────────────────
 */

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { api } from "../services/authService";
import { useAuth } from "../contexts/AuthContext";

const get = (url) => api.get(url).then((r) => r.data);
const todayISO   = () => new Date().toISOString().slice(0, 10);
const todayLabel = () =>
  new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
function firstName(name) {
  return (name || "").trim().split(/\s+/)[0] || "";
}

/** Format an Indian-Rupee amount, abbreviated for large numbers. */
function inr(n) {
  const v = Number(n) || 0;
  if (v >= 1_00_000)  return `₹${(v / 1_00_000).toFixed(1)}L`;
  if (v >= 1_000)     return `₹${(v / 1_000).toFixed(1)}k`;
  return `₹${v.toLocaleString("en-IN")}`;
}

/** Start of current calendar month as "YYYY-MM-DD". */
function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/* ── Skeleton ──────────────────────────────────────────────────────── */
const Skel = ({ w = "52%", h = 30 }) => (
  <div className="yd-skeleton" style={{ height: h, width: w, borderRadius: 6 }} />
);

/* ── Single stat card ──────────────────────────────────────────────── */
function Stat({ label, value, sub, loading, accent = "#F5C518", error }) {
  return (
    <div className="ld-stat" style={{ "--ld-accent": error ? "#EF4444" : accent }}>
      <div className="ld-stat-top">
        <span className="ld-stat-label">{label}</span>
        <div className="ld-stat-accent-dot" />
      </div>
      {loading ? (
        <Skel />
      ) : error ? (
        <div className="ld-stat-value unavail" title={error}>⚠</div>
      ) : (
        <div className="ld-stat-value">{value ?? "—"}</div>
      )}
      {sub && <div className="ld-stat-sub">{sub}</div>}
    </div>
  );
}

/* ── Section wrapper ───────────────────────────────────────────────── */
function Section({ title, children, index }) {
  return (
    <div className="ld-section" style={{ animationDelay: `${index * 60}ms` }}>
      <div className="ld-section-header">
        <span className="ld-section-title">{title}</span>
        <div className="ld-section-line" />
      </div>
      <div className="ld-grid">{children}</div>
    </div>
  );
}

/* ── Error banner ──────────────────────────────────────────────────── */
function ErrorBanner({ errors }) {
  if (!errors.length) return null;
  return (
    <div style={{
      background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10,
      padding: "10px 16px", marginBottom: 20,
      fontSize: 12, color: "#B91C1C", display: "flex", gap: 8, alignItems: "flex-start",
    }}>
      <span style={{ flexShrink: 0 }}>⚠</span>
      <div>
        <strong>Some data could not be loaded:</strong>{" "}
        {errors.join(" · ")}
      </div>
    </div>
  );
}

const REFRESH_MS = 60_000; // 60 seconds

/* ══════════════════════════════════════════════════════════════════ */
export default function LiveDashboard() {
  const { user } = useAuth();

  // ── Raw API results ─────────────────────────────────────────────
  const [students,  setStudents]  = useState(null);   // array from /students
  const [summary,   setSummary]   = useState(null);   // attendance summary
  const [inside,    setInside]    = useState(null);   // attendance/inside
  const [users,     setUsers]     = useState(null);   // /api/users
  const [invoices,  setInvoices]  = useState(null);   // /api/invoices
  const [payments,  setPayments]  = useState(null);   // /api/payments
  const [food,      setFood]      = useState(null);   // /api/food-consumption
  const [pickupReq, setPickupReq] = useState(null);   // /api/pickup-requests?status=pending
  const [families,  setFamilies]  = useState(null);   // /api/families/count

  const [loading,   setLoading]   = useState(true);
  const [errors,    setErrors]    = useState([]);
  const [lastAt,    setLastAt]    = useState(null);   // last successful refresh time
  const mountedRef = useRef(true);

  // ── Fetch ───────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    const d  = todayISO();
    const ms = monthStart();
    const errs = [];

    const [
      stuRes, sumRes, insRes, usrRes,
      invRes, payRes, foodRes, pReqRes, famRes,
    ] = await Promise.allSettled([
      get("/students"),
      get(`/api/attendance/summary?date=${d}`),
      get(`/api/attendance/inside?date=${d}`),
      get("/api/users"),
      get("/api/invoices"),
      get(`/api/payments`),
      get(`/api/food-consumption?date=${d}`),
      get(`/api/pickup-requests?status=pending`),
      get("/api/families/count"),
    ]);

    if (!mountedRef.current) return;

    // Students
    if (stuRes.status === "fulfilled") {
      const v = stuRes.value;
      setStudents(Array.isArray(v) ? v : (v?.students || []));
    } else errs.push("Students");

    // Attendance summary
    if (sumRes.status === "fulfilled" && sumRes.value?.success) {
      setSummary(sumRes.value.summary);
    } else errs.push("Attendance summary");

    // Attendance inside
    if (insRes.status === "fulfilled" && insRes.value?.success) {
      setInside(insRes.value);
    } else errs.push("Attendance inside");

    // Users
    if (usrRes.status === "fulfilled") {
      const v = usrRes.value;
      setUsers(Array.isArray(v) ? v : (v?.users || []));
    } else errs.push("Users");

    // Invoices
    if (invRes.status === "fulfilled" && invRes.value?.success) {
      setInvoices(invRes.value.invoices || []);
    } else errs.push("Invoices");

    // Payments
    if (payRes.status === "fulfilled" && payRes.value?.success) {
      setPayments(payRes.value.payments || []);
    } else errs.push("Payments");

    // Food consumption → array of entries
    if (foodRes.status === "fulfilled") {
      const v = foodRes.value;
      setFood(Array.isArray(v) ? v : (v?.entries || []));
    } else errs.push("Meals");

    // Pickup requests (pending)
    if (pReqRes.status === "fulfilled" && pReqRes.value?.success) {
      setPickupReq(pReqRes.value.count ?? (pReqRes.value.requests || []).length);
    } else errs.push("Pickup");

    // Total families
    if (famRes.status === "fulfilled" && famRes.value?.success) {
      setFamilies(famRes.value.total ?? null);
    }
    // Families widget failure is non-critical — no error banner entry

    setErrors(errs);
    setLastAt(new Date());
    setLoading(false);
  }, []);

  // Initial fetch + 60-second interval
  useEffect(() => {
    mountedRef.current = true;
    fetchAll();
    const timer = setInterval(fetchAll, REFRESH_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(timer);
    };
  }, [fetchAll]);

  // ── Derived: Students ───────────────────────────────────────────
  const totalStudents  = students?.length ?? null;
  const presentToday   = summary?.present  ?? null;
  const absentToday    = useMemo(() => {
    if (totalStudents == null || presentToday == null) return null;
    return Math.max(0, totalStudents - presentToday);
  }, [totalStudents, presentToday]);
  const checkedInNow  = inside?.count ?? null;
  const activeRooms   = useMemo(() => {
    if (!inside?.students?.length) return checkedInNow != null ? 0 : null;
    return new Set(inside.students.map((s) => s.class || s.Class).filter(Boolean)).size;
  }, [inside, checkedInNow]);
  const attendancePct = useMemo(() => {
    if (!totalStudents || presentToday == null) return null;
    return Math.round((presentToday / totalStudents) * 100) + "%";
  }, [totalStudents, presentToday]);

  // ── Derived: Staff ──────────────────────────────────────────────
  const staffMembers = useMemo(() => {
    if (!users) return null;
    return users.filter((u) => !["parent", "unknown"].includes((u.role || "").toLowerCase()));
  }, [users]);
  const totalStaff   = staffMembers?.length ?? null;
  const teacherCount = useMemo(() => {
    if (!staffMembers) return null;
    const n = staffMembers.filter((u) => (u.role || "").toLowerCase().includes("teacher")).length;
    return n;   // 0 is a valid value — shows as 0 not —
  }, [staffMembers]);

  // ── Derived: Finance ────────────────────────────────────────────
  const feesCollected  = useMemo(() => {
    if (!invoices) return null;
    return invoices.reduce((s, i) => s + (Number(i.paidAmount) || 0), 0);
  }, [invoices]);
  const pendingCount   = useMemo(() => {
    if (!invoices) return null;
    return invoices.filter((i) => ["Pending", "Partial"].includes(i.status)).length;
  }, [invoices]);
  const overdueAmt     = useMemo(() => {
    if (!invoices) return null;
    return invoices.filter((i) => i.status === "Overdue")
                   .reduce((s, i) => s + (Number(i.balance) || 0), 0);
  }, [invoices]);
  const monthlyCollect = useMemo(() => {
    if (!payments) return null;
    const ms = monthStart();
    return payments
      .filter((p) => (p.paymentDate || "") >= ms)
      .reduce((s, p) => s + (Number(p.amount) || 0), 0);
  }, [payments]);

  // ── Derived: Operations ─────────────────────────────────────────
  const mealsServed = useMemo(() => {
    if (!food) return null;
    // Count unique students who have at least one served/completed meal today
    const served = food.filter((f) => {
      const st = (f.status || "").toLowerCase();
      return !st || st === "served" || st === "completed" || st === "yes" || Number(f.quantity) > 0;
    });
    return new Set(served.map((f) => f.studentId).filter(Boolean)).size;
  }, [food]);

  // ── Refresh button ──────────────────────────────────────────────
  const handleRefresh = useCallback(() => {
    setLoading(true);
    fetchAll();
  }, [fetchAll]);

  const lastAtStr = lastAt
    ? lastAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <>
      <style>{`
        @keyframes ld-fade-up {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ld-live-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(34,197,94,.40); }
          70%  { box-shadow: 0 0 0 7px rgba(34,197,94,0); }
          100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
        }

        .ld-header { margin-bottom: 36px; animation: ld-fade-up 360ms ease both; }
        .ld-greeting { font-size: 13px; font-weight: 500; color: #A8A29E; margin: 0 0 4px; letter-spacing: .01em; }
        .ld-title { font-size: clamp(22px,4vw,30px); font-weight: 700; color: #1C1917; letter-spacing: -.025em; margin: 0 0 10px; line-height: 1.15; }
        .ld-meta { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .ld-date { font-size: 12.5px; color: #A8A29E; font-weight: 400; }

        .ld-live-badge { display:inline-flex;align-items:center;gap:6px;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:20px;padding:3px 10px 3px 7px; }
        .ld-live-dot { width:7px;height:7px;border-radius:50%;background:#22C55E;flex-shrink:0;animation:ld-live-pulse 2s infinite; }
        .ld-live-text { font-size:10.5px;font-weight:700;color:#16A34A;text-transform:uppercase;letter-spacing:.08em; }

        .ld-refresh-btn { background:none;border:1px solid #E8E0D6;border-radius:8px;padding:4px 10px;font-size:11px;font-weight:600;color:#A8A29E;cursor:pointer;transition:border-color 150ms,color 150ms; }
        .ld-refresh-btn:hover { border-color:#F5C518;color:#78350F; }

        .ld-section { margin-bottom:32px;animation:ld-fade-up 380ms ease both; }
        .ld-section-header { display:flex;align-items:center;gap:10px;margin-bottom:12px; }
        .ld-section-title { font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.10em;color:#C4B5A5;white-space:nowrap; }
        .ld-section-line { flex:1;height:1px;background:#F0EDE8; }

        .ld-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:10px; }

        .ld-stat { background:#FFF;border:1px solid #F0EDE8;border-radius:14px;padding:16px 16px 14px;display:flex;flex-direction:column;gap:6px;position:relative;overflow:hidden;transition:border-color 180ms,box-shadow 180ms,transform 180ms;cursor:default; }
        .ld-stat::before { content:"";position:absolute;top:0;left:0;right:0;height:2.5px;background:var(--ld-accent,#F5C518);border-radius:14px 14px 0 0;opacity:.55;transition:opacity 180ms; }
        .ld-stat:hover { border-color:#E8E0D6;box-shadow:0 4px 16px rgba(0,0,0,.06);transform:translateY(-1px); }
        .ld-stat:hover::before { opacity:.9; }
        .ld-stat-top { display:flex;justify-content:space-between;align-items:center; }
        .ld-stat-label { font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:#B8A99A; }
        .ld-stat-accent-dot { width:6px;height:6px;border-radius:50%;background:var(--ld-accent,#F5C518);opacity:.4;flex-shrink:0; }
        .ld-stat-value { font-size:28px;font-weight:700;color:#1C1917;letter-spacing:-.04em;line-height:1; }
        .ld-stat-sub { font-size:11px;color:#B8A99A;font-weight:400; }
        .ld-stat-value.unavail { font-size:20px;color:#D4C9BE;letter-spacing:0; }

        @media(max-width:560px) { .ld-grid { grid-template-columns:1fr 1fr; } }
      `}</style>

      <div style={{ maxWidth: 1060, margin: "0 auto" }}>

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="ld-header">
          <p className="ld-greeting">
            {getGreeting()}{user?.name ? `, ${firstName(user.name)}` : ""}
          </p>
          <h1 className="ld-title">Live Dashboard</h1>
          <div className="ld-meta">
            <span className="ld-date">{todayLabel()}</span>
            <div className="ld-live-badge">
              <div className="ld-live-dot" />
              <span className="ld-live-text">Live</span>
            </div>
            <button className="ld-refresh-btn" onClick={handleRefresh} disabled={loading}>
              ↻ Refresh
            </button>
            {lastAtStr && !loading && (
              <span className="ld-date">Updated {lastAtStr}</span>
            )}
          </div>
        </div>

        {/* ── Error banner (only when partial failures) ────────────── */}
        <ErrorBanner errors={errors} />

        {/* ── STUDENTS ────────────────────────────────────────────── */}
        <Section title="Students" index={0}>
          <Stat
            label="Total Enrolled"
            value={totalStudents}
            sub="active students"
            loading={loading}
            accent="#F5C518"
          />
          <Stat
            label="Present Today"
            value={presentToday}
            sub={attendancePct ? `${attendancePct} rate` : "attendance today"}
            loading={loading}
            accent="#22C55E"
          />
          <Stat
            label="Absent Today"
            value={absentToday}
            sub="not checked in"
            loading={loading}
            accent="#F97316"
          />
          <Stat
            label="Checked In Now"
            value={checkedInNow}
            sub="currently inside"
            loading={loading}
            accent="#3B82F6"
          />
          <Stat
            label="Active Classrooms"
            value={activeRooms}
            sub="rooms with students"
            loading={loading}
            accent="#8B5CF6"
          />
          <Stat
            label="Total Families"
            value={families}
            sub="family units registered"
            loading={loading}
            accent="#F59E0B"
          />
        </Section>

        {/* ── STAFF ───────────────────────────────────────────────── */}
        <Section title="Staff" index={1}>
          <Stat
            label="Total Staff"
            value={totalStaff}
            sub="registered members"
            loading={loading}
            accent="#F5C518"
          />
          <Stat
            label="Teachers on Duty"
            value={teacherCount}
            sub="teacher-role users"
            loading={loading}
            accent="#10B981"
          />
          {/* Staff attendance is not tracked in this system */}
          <Stat
            label="Staff Present"
            value="—"
            sub="not tracked"
            loading={false}
            accent="#94A3B8"
          />
          <Stat
            label="Staff Absent"
            value="—"
            sub="not tracked"
            loading={false}
            accent="#94A3B8"
          />
        </Section>

        {/* ── FINANCE ─────────────────────────────────────────────── */}
        <Section title="Finance" index={2}>
          <Stat
            label="Fees Collected"
            value={feesCollected != null ? inr(feesCollected) : null}
            sub="total paid (all time)"
            loading={loading}
            accent="#F5C518"
          />
          <Stat
            label="Pending Payments"
            value={pendingCount}
            sub="invoices pending/partial"
            loading={loading}
            accent="#F97316"
          />
          <Stat
            label="Overdue Fees"
            value={overdueAmt != null ? inr(overdueAmt) : null}
            sub="overdue balance"
            loading={loading}
            accent="#EF4444"
          />
          <Stat
            label="Monthly Collection"
            value={monthlyCollect != null ? inr(monthlyCollect) : null}
            sub="this calendar month"
            loading={loading}
            accent="#10B981"
          />
        </Section>

        {/* ── OPERATIONS ──────────────────────────────────────────── */}
        <Section title="Operations" index={3}>
          <Stat
            label="Attendance Rate"
            value={attendancePct}
            sub="today's percentage"
            loading={loading}
            accent="#F5C518"
          />
          <Stat
            label="Pickup Pending"
            value={pickupReq}
            sub="awaiting collection"
            loading={loading}
            accent="#F97316"
          />
          <Stat
            label="Meals Served"
            value={mealsServed}
            sub="students fed today"
            loading={loading}
            accent="#10B981"
          />
          {/* No transport module configured */}
          <Stat
            label="Transport Active"
            value="—"
            sub="not configured"
            loading={false}
            accent="#94A3B8"
          />
        </Section>

      </div>
    </>
  );
}
