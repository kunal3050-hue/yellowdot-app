import { useEffect, useState, useMemo } from "react";
import { api } from "../services/authService";
import { useAuth } from "../contexts/AuthContext";

const get = url => api.get(url).then(r => r.data);

const todayISO   = () => new Date().toISOString().slice(0, 10);
const todayLabel = () => new Date().toLocaleDateString("en-IN", {
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

/* ── Skeleton ──────────────────────────────────────────────────────── */
const Skel = ({ w = "52%", h = 30 }) => (
  <div className="yd-skeleton" style={{ height: h, width: w, borderRadius: 6 }} />
);

/* ── Single stat card ──────────────────────────────────────────────── */
function Stat({ label, value, sub, loading, accent = "#F5C518", wide }) {
  return (
    <div className="ld-stat" style={{ "--ld-accent": accent, gridColumn: wide ? "span 2" : undefined }}>
      <div className="ld-stat-top">
        <span className="ld-stat-label">{label}</span>
        <div className="ld-stat-accent-dot" />
      </div>
      {loading
        ? <Skel />
        : <div className="ld-stat-value">{value ?? "—"}</div>
      }
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

/* ── Main ──────────────────────────────────────────────────────────── */
export default function LiveDashboard() {
  const { user } = useAuth();

  const [summary,    setSummary]    = useState(null);
  const [inside,     setInside]     = useState(null);
  const [users,      setUsers]      = useState(null);
  const [pickup,     setPickup]     = useState(null);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    const d = todayISO();
    Promise.allSettled([
      get(`/api/attendance/summary?date=${d}`),
      get(`/api/attendance/inside?date=${d}`),
      get("/api/users"),
      get(`/api/pickup-history?date=${d}`),
    ]).then(([s, ins, u, ph]) => {
      if (s.status   === "fulfilled" && s.value?.success)   setSummary(s.value.summary);
      if (ins.status === "fulfilled" && ins.value?.success) setInside(ins.value);
      if (u.status   === "fulfilled") {
        const list = Array.isArray(u.value) ? u.value : (u.value?.users || []);
        setUsers(list);
      }
      if (ph.status  === "fulfilled") setPickup(ph.value);
    }).finally(() => setLoading(false));
  }, []);

  /* derived values */
  const totalStudents  = summary?.total    ?? null;
  const presentToday   = summary?.present  ?? null;
  const absentToday    = (totalStudents != null && presentToday != null)
    ? totalStudents - presentToday : null;
  const checkedInNow   = inside?.count     ?? null;

  const activeRooms = useMemo(() => {
    if (!inside?.students) return null;
    return new Set(inside.students.map(s => s.class || s.Class).filter(Boolean)).size;
  }, [inside]);

  const attendancePct = useMemo(() => {
    if (totalStudents == null || presentToday == null || totalStudents === 0) return null;
    return Math.round((presentToday / totalStudents) * 100) + "%";
  }, [totalStudents, presentToday]);

  const staffMembers = useMemo(() => {
    if (!users) return null;
    return users.filter(x => !["parent", "unknown"].includes(x.role || ""));
  }, [users]);
  const totalStaff   = staffMembers?.length ?? null;
  const teacherCount = useMemo(() => {
    if (!staffMembers) return null;
    return staffMembers.filter(x => (x.role || "").toLowerCase().includes("teacher")).length || null;
  }, [staffMembers]);

  const pickupPending = useMemo(() => {
    if (!pickup) return null;
    const list = Array.isArray(pickup) ? pickup : (pickup?.records || pickup?.history || []);
    return list.filter(p => !p.completedAt && !p.checkedOut).length;
  }, [pickup]);

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

        .ld-header {
          margin-bottom: 36px;
          animation: ld-fade-up 360ms ease both;
        }

        .ld-greeting {
          font-size: 13px;
          font-weight: 500;
          color: #A8A29E;
          margin: 0 0 4px;
          letter-spacing: 0.01em;
        }
        .ld-title {
          font-size: clamp(22px, 4vw, 30px);
          font-weight: 700;
          color: #1C1917;
          letter-spacing: -0.025em;
          margin: 0 0 10px;
          line-height: 1.15;
        }
        .ld-meta {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .ld-date {
          font-size: 12.5px;
          color: #A8A29E;
          font-weight: 400;
        }
        .ld-live-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #F0FDF4;
          border: 1px solid #BBF7D0;
          border-radius: 20px;
          padding: 3px 10px 3px 7px;
        }
        .ld-live-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #22C55E;
          flex-shrink: 0;
          animation: ld-live-pulse 2s infinite;
        }
        .ld-live-text {
          font-size: 10.5px;
          font-weight: 700;
          color: #16A34A;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        /* Section */
        .ld-section {
          margin-bottom: 32px;
          animation: ld-fade-up 380ms ease both;
        }
        .ld-section-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
        }
        .ld-section-title {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.10em;
          color: #C4B5A5;
          white-space: nowrap;
        }
        .ld-section-line {
          flex: 1;
          height: 1px;
          background: #F0EDE8;
        }

        /* Card grid */
        .ld-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
          gap: 10px;
        }

        /* Stat card */
        .ld-stat {
          background: #FFFFFF;
          border: 1px solid #F0EDE8;
          border-radius: 14px;
          padding: 16px 16px 14px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          position: relative;
          overflow: hidden;
          transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
          cursor: default;
        }
        .ld-stat::before {
          content: "";
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 2.5px;
          background: var(--ld-accent, #F5C518);
          border-radius: 14px 14px 0 0;
          opacity: 0.55;
          transition: opacity 180ms ease;
        }
        .ld-stat:hover {
          border-color: #E8E0D6;
          box-shadow: 0 4px 16px rgba(0,0,0,0.06);
          transform: translateY(-1px);
        }
        .ld-stat:hover::before {
          opacity: 0.9;
        }

        .ld-stat-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .ld-stat-label {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.09em;
          color: #B8A99A;
        }
        .ld-stat-accent-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--ld-accent, #F5C518);
          opacity: 0.4;
          flex-shrink: 0;
        }
        .ld-stat-value {
          font-size: 28px;
          font-weight: 700;
          color: #1C1917;
          letter-spacing: -0.04em;
          line-height: 1;
        }
        .ld-stat-sub {
          font-size: 11px;
          color: #B8A99A;
          font-weight: 400;
          letter-spacing: 0;
        }

        /* Unavailable state */
        .ld-stat-value.unavail {
          font-size: 20px;
          color: #D4C9BE;
          letter-spacing: 0;
        }

        @media (max-width: 560px) {
          .ld-grid { grid-template-columns: 1fr 1fr; }
        }
      `}</style>

      <div style={{ maxWidth: 1060, margin: "0 auto" }}>

        {/* ── Header ──────────────────────────────────────────────────── */}
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
          </div>
        </div>

        {/* ── STUDENTS ────────────────────────────────────────────────── */}
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
            sub={attendancePct ? `${attendancePct} attendance` : "of enrolled"}
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
        </Section>

        {/* ── STAFF ───────────────────────────────────────────────────── */}
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
            sub="active teachers"
            loading={loading}
            accent="#10B981"
          />
          <Stat
            label="Staff Present"
            value={null}
            sub="attendance not tracked"
            loading={false}
            accent="#94A3B8"
          />
          <Stat
            label="Staff Absent"
            value={null}
            sub="attendance not tracked"
            loading={false}
            accent="#94A3B8"
          />
        </Section>

        {/* ── FINANCE ─────────────────────────────────────────────────── */}
        <Section title="Finance" index={2}>
          <Stat
            label="Fees Collected"
            value={null}
            sub="view in Finance module"
            loading={false}
            accent="#F5C518"
          />
          <Stat
            label="Pending Payments"
            value={null}
            sub="view in Finance module"
            loading={false}
            accent="#F97316"
          />
          <Stat
            label="Overdue Fees"
            value={null}
            sub="view in Finance module"
            loading={false}
            accent="#EF4444"
          />
          <Stat
            label="Monthly Collection"
            value={null}
            sub="view in Finance module"
            loading={false}
            accent="#10B981"
          />
        </Section>

        {/* ── OPERATIONS ──────────────────────────────────────────────── */}
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
            value={pickupPending}
            sub="awaiting collection"
            loading={loading}
            accent="#F97316"
          />
          <Stat
            label="Meals Served"
            value={null}
            sub="view in Daily Ops"
            loading={false}
            accent="#10B981"
          />
          <Stat
            label="Transport Active"
            value={null}
            sub="not configured"
            loading={false}
            accent="#94A3B8"
          />
        </Section>

      </div>
    </>
  );
}
