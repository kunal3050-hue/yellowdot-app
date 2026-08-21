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
 *   Staff Present        not tracked → "—"
 *   Staff Absent         not tracked → "—"
 *
 * Finance
 *
 * Operations
 *   Attendance Rate     computed from summary
 *   Pickup Pending      GET /api/pickup-requests?status=pending → count
 *   Meals Served        GET /api/food-consumption?date=today   → unique student count
 *   Transport Active    not configured → "—"
 *
 * derived client-side from the same fetched arrays above — no new API
 * calls were added for the Design System v2 Phase 2.1 redesign.
 * ─────────────────────────────────────────────────────────────────
 */

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  UserPlus, ClipboardCheck, Megaphone, Car, RefreshCw, Bell,
} from "lucide-react";
import { api } from "../services/authService";
import { useAuth } from "../contexts/AuthContext";
import { PageHeader, KpiCard, QuickActionCard, Timeline } from "../components/ui";

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

const REFRESH_MS = 60_000; // 60 seconds

/* ── Quiet section label (kept lightweight — not every grouping needs
   the heavier SectionHeader primitive) ─────────────────────────────── */
function SectionLabel({ title }) {
  return (
    <div className="ld-section-header">
      <span className="ld-section-title">{title}</span>
      <div className="ld-section-line" />
    </div>
  );
}

/* ── Error banner ──────────────────────────────────────────────────── */
function ErrorBanner({ errors }) {
  if (!errors.length) return null;
  return (
    <div style={{
      background: "var(--yd-danger-soft)", border: "1px solid var(--yd-danger-border)", borderRadius: 10,
      padding: "10px 16px", marginBottom: 20,
      fontSize: 12, color: "var(--yd-danger)", display: "flex", gap: 8, alignItems: "flex-start",
    }}>
      <span style={{ flexShrink: 0 }}>⚠</span>
      <div>
        <strong>Some data could not be loaded:</strong>{" "}
        {errors.join(" · ")}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════ */
export default function LiveDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // ── Raw API results ─────────────────────────────────────────────
  const [students,  setStudents]  = useState(null);   // array from /students
  const [summary,   setSummary]   = useState(null);   // attendance summary
  const [inside,    setInside]    = useState(null);   // attendance/inside
  const [users,     setUsers]     = useState(null);   // /api/users
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
    const errs = [];

    const [
      stuRes, sumRes, insRes, usrRes,
      foodRes, pReqRes, famRes,
    ] = await Promise.allSettled([
      get("/students"),
      get(`/api/attendance/summary?date=${d}`),
      get(`/api/attendance/inside?date=${d}`),
      get("/api/users"),
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
    return staffMembers.filter((u) => (u.role || "").toLowerCase().includes("teacher")).length;
  }, [staffMembers]);


  // ── Derived: Operations ─────────────────────────────────────────
  const mealsServed = useMemo(() => {
    if (!food) return null;
    const served = food.filter((f) => {
      const st = (f.status || "").toLowerCase();
      return !st || st === "served" || st === "completed" || st === "yes" || Number(f.quantity) > 0;
    });
    return new Set(served.map((f) => f.studentId).filter(Boolean)).size;
  }, [food]);

  // ── Derived: Today's Schedule (Timeline) ─────────────────────────
  // Chronological view of today's already-tracked events — check-ins and
  // meals served — assembled client-side from data already fetched above.
  const todaySchedule = useMemo(() => {
    const items = [];
    (inside?.students || []).forEach((s, i) => {
      if (!s.checkIn) return;
      items.push({
        id: `checkin-${s.studentId || s.id || i}`,
        type: "attendance",
        title: `${s.studentName || s.name || "A student"} checked in`,
        description: s.class || s.Class || undefined,
        timestamp: new Date(`${todayISO()}T${s.checkIn}`).getTime() || Date.now(),
      });
    });
    (food || []).forEach((f, i) => {
      const st = (f.status || "").toLowerCase();
      const served = !st || st === "served" || st === "completed" || st === "yes" || Number(f.quantity) > 0;
      if (!served || !f.lastUpdated) return;
      items.push({
        id: `meal-${f.studentId || i}`,
        type: "communication",
        title: `${f.studentName || "A student"} — meal logged`,
        description: f.mealType || f.category || undefined,
        timestamp: new Date(f.lastUpdated).getTime() || Date.now(),
      });
    });
    return items.sort((a, b) => b.timestamp - a.timestamp).slice(0, 12);
  }, [inside, food]);


  // ── Refresh button ──────────────────────────────────────────────
  const handleRefresh = useCallback(() => {
    setLoading(true);
    fetchAll();
  }, [fetchAll]);

  const lastAtStr = lastAt
    ? lastAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="ld-root">
      <PageHeader
        title="Live Dashboard"
        subtitle={`${getGreeting()}${user?.name ? `, ${firstName(user.name)}` : ""} · ${todayLabel()}`}
        actions={
          <div className="ld-header-actions">
            <div className="ld-live-badge">
              <div className="ld-live-dot" />
              <span className="ld-live-text">Live</span>
            </div>
            <button className="ld-refresh-btn" onClick={handleRefresh} disabled={loading}>
              <RefreshCw size={12} strokeWidth={2.5} />
              Refresh
            </button>
            {lastAtStr && !loading && <span className="ld-updated">Updated {lastAtStr}</span>}
          </div>
        }
      />

      <ErrorBanner errors={errors} />

      {/* ── STUDENTS ────────────────────────────────────────────── */}
      <div className="ld-section">
        <SectionLabel title="Students" />
        <div className="ld-kpi-grid">
          <KpiCard label="Total Enrolled" value={totalStudents ?? "—"} trendLabel="active students" loading={loading} />
          <KpiCard label="Present Today" value={presentToday ?? "—"} trendLabel={attendancePct ? `${attendancePct} rate` : "attendance today"} loading={loading} />
          <KpiCard label="Absent Today" value={absentToday ?? "—"} trendLabel="not checked in" loading={loading} />
          <KpiCard label="Checked In Now" value={checkedInNow ?? "—"} trendLabel="currently inside" loading={loading} />
          <KpiCard label="Active Classrooms" value={activeRooms ?? "—"} trendLabel="rooms with students" loading={loading} />
          <KpiCard label="Total Families" value={families ?? "—"} trendLabel="family units registered" loading={loading} />
        </div>
      </div>

      {/* ── STAFF ───────────────────────────────────────────────── */}
      <div className="ld-section">
        <SectionLabel title="Staff" />
        <div className="ld-kpi-grid">
          <KpiCard label="Total Staff" value={totalStaff ?? "—"} trendLabel="registered members" loading={loading} />
          <KpiCard label="Teachers on Duty" value={teacherCount ?? "—"} trendLabel="teacher-role users" loading={loading} />
          <KpiCard label="Staff Present" value="—" trendLabel="not tracked" loading={false} />
          <KpiCard label="Staff Absent" value="—" trendLabel="not tracked" loading={false} />
        </div>
      </div>


      {/* ── OPERATIONS ──────────────────────────────────────────── */}
      <div className="ld-section">
        <SectionLabel title="Operations" />
        <div className="ld-kpi-grid">
          <KpiCard label="Attendance Rate" value={attendancePct ?? "—"} trendLabel="today's percentage" loading={loading} />
          <KpiCard label="Pickup Pending" value={pickupReq ?? "—"} trendLabel="awaiting collection" loading={loading} />
          <KpiCard label="Meals Served" value={mealsServed ?? "—"} trendLabel="students fed today" loading={loading} />
          <KpiCard label="Transport Active" value="—" trendLabel="not configured" loading={false} />
        </div>
      </div>

      {/* ── QUICK ACTIONS ───────────────────────────────────────── */}
      <div className="ld-section">
        <SectionLabel title="Quick Actions" />
        <div className="ld-qa-grid">
          <QuickActionCard
            icon={<Megaphone size={18} strokeWidth={2} />}
            title="Send Notice"
            description="Post a school notice"
            permission={{ routeKey: "notices" }}
            onClick={() => { navigate("/notices"); }}
          />
          <QuickActionCard
            icon={<Car size={18} strokeWidth={2} />}
            title="Pickup Authorization"
            description="Authorise a pickup"
            count={typeof pickupReq === "number" ? pickupReq : undefined}
            permission={{ routeKey: "pickup-authorization" }}
            onClick={() => { navigate("/pickup-authorization"); }}
          />
        </div>
      </div>

      {/* ── TODAY'S SCHEDULE + RECENT ACTIVITY ───────────────────── */}
      <div className="ld-section">
        <div className="ld-split">
          <div>
            <SectionLabel title="Today's Schedule" />
            <div className="ld-panel ld-panel-scroll">
              <Timeline
                items={todaySchedule}
                loading={loading && todaySchedule.length === 0}
                empty={{ title: "No events yet today", description: "Check-ins and meal logs will appear here as they happen." }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── NOTIFICATIONS ───────────────────────────────────────── */}
      <div className="ld-section">
        <SectionLabel title="Notifications" />
        <div className="ld-panel">
          <div className="ld-notif-placeholder">
            <Bell size={24} strokeWidth={1.5} />
            <span className="ld-notif-badge">Coming soon</span>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--yd-text-soft)", marginTop: 4 }}>
              Staff notifications aren't wired up yet
            </div>
            <div style={{ fontSize: 12, maxWidth: 320 }}>
              Reserved for a future staff notification feed — no backend endpoint exists for it yet.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
