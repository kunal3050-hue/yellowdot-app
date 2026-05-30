import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/authService";

const get = url => api.get(url).then(r => r.data);

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function todayLabel() {
  return new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

// ── Icons ────────────────────────────────────────────────────────────────────
const Ico = ({ path, size = 18 }) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor"
    strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
    width={size} height={size}>{path}</svg>
);

const StudentIcon   = () => <Ico path={<><circle cx="10" cy="7" r="3"/><path d="M3 18a7 7 0 0114 0"/></>} />;
const AttendIcon    = () => <Ico path={<><rect x="3" y="4" width="14" height="14" rx="2"/><path d="M13 2v4M7 2v4M3 8h14"/><path d="M7 12l2 2 4-4"/></>} />;
const StaffIcon     = () => <Ico path={<><circle cx="7" cy="6" r="2.5"/><path d="M1 17a6 6 0 0112 0"/><circle cx="15" cy="6" r="2"/><path d="M15 11c2 .5 3 2 3 4.5"/></>} />;
const FeesIcon      = () => <Ico path={<><rect x="2" y="5" width="16" height="12" rx="2"/><path d="M8 5V3h4v2"/><path d="M10 10v4M8 12h4"/></>} />;
const InvIcon       = () => <Ico path={<><path d="M4 3h12a1 1 0 011 1v13l-2-1.5L13 17l-2-1.5L9 17l-2-1.5L5 17l-2-1.5V4a1 1 0 011-1z"/><path d="M7 7h6M7 10h6M7 13h3"/></>} />;
const QRIcon        = () => <Ico path={<><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="11" y="3" width="6" height="6" rx="1"/><rect x="3" y="11" width="6" height="6" rx="1"/><path d="M11 14h2M14 11h3v3M14 17h3"/></>} />;
const CamIcon       = () => <Ico path={<><path d="M2 6a2 2 0 012-2h12a2 2 0 012 2v9a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/><circle cx="10" cy="11" r="3"/></>} />;
const ChartIcon     = () => <Ico path={<><path d="M2 16l4-6 3 4 3-7 4 9"/></>} />;

const QUICK_NAV = [
  { label: "Students",   path: "/students",          Icon: StudentIcon, bg: "#EFF6FF", fg: "#2563EB", desc: "Profiles & records"  },
  { label: "Attendance", path: "/attendance",         Icon: AttendIcon,  bg: "#F0FDF4", fg: "#16A34A", desc: "Mark & track"        },
  { label: "Staff",      path: "/staff",              Icon: StaffIcon,   bg: "#F5F3FF", fg: "#7C3AED", desc: "Staff management"    },
  { label: "Fees",       path: "/fees",               Icon: FeesIcon,    bg: "#FFFBEB", fg: "#D97706", desc: "Collection overview" },
  { label: "Invoices",   path: "/invoice",            Icon: InvIcon,     bg: "#FFF9E0", fg: "#CA8A04", desc: "Billing & payments"  },
  { label: "QR Mgmt",   path: "/qr-management",      Icon: QRIcon,      bg: "#F0FDF4", fg: "#059669", desc: "Generate & print QR" },
  { label: "Live CCTV", path: "/live-cctv",           Icon: CamIcon,     bg: "#FEF2F2", fg: "#DC2626", desc: "Camera monitoring"   },
  { label: "Analytics", path: "/analytics",           Icon: ChartIcon,   bg: "#EFF6FF", fg: "#0284C7", desc: "Reports & trends"    },
];

// ── Skeleton ──────────────────────────────────────────────────────────────────
const Skel = ({ w = "60%", h = 26 }) => (
  <div className="yd-skeleton" style={{ height: h, width: w, borderRadius: 6 }} />
);

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent, iconBg, iconFg, IconEl, loading, to }) {
  const body = (
    <div
      style={{
        background: "#fff", border: "1px solid #F1F1F1", borderRadius: 16,
        padding: "15px 16px", display: "flex", flexDirection: "column", gap: 9,
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)", height: "100%",
        position: "relative", overflow: "hidden",
        transition: "box-shadow .15s, border-color .15s",
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "#F1F1F1"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)"; }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: accent, borderRadius: "16px 16px 0 0" }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 3 }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94A3B8" }}>{label}</span>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: iconBg, color: iconFg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <IconEl />
        </div>
      </div>
      {loading ? <Skel /> : <div style={{ fontSize: 28, fontWeight: 800, color: "#0F172A", lineHeight: 1, letterSpacing: "-0.03em" }}>{value}</div>}
      <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 500 }}>{sub}</div>
    </div>
  );
  return to
    ? <Link to={to} style={{ textDecoration: "none", display: "block", height: "100%" }}>{body}</Link>
    : body;
}

// ── CCTV dark card ────────────────────────────────────────────────────────────
function CCTVCard() {
  return (
    <Link to="/live-cctv" style={{ textDecoration: "none", display: "block", height: "100%" }}>
      <div
        style={{
          background: "#0F172A", border: "1px solid #1E293B", borderRadius: 16,
          padding: "15px 16px", display: "flex", flexDirection: "column", gap: 10,
          boxShadow: "0 1px 4px rgba(0,0,0,0.15)", height: "100%",
          transition: "box-shadow .15s",
        }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.28)"; }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.15)"; }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#EF4444", flexShrink: 0, animation: "yd-pulse 2s infinite" }} />
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#64748B" }}>Live CCTV</span>
        </div>
        <div style={{ display: "flex", justifyContent: "center", padding: "4px 0" }}>
          <svg viewBox="0 0 44 36" fill="none" width="44" height="36">
            <rect x="1" y="4" width="28" height="20" rx="4" fill="#1E293B" stroke="#334155" strokeWidth="1.5"/>
            <path d="M29 13l12-6v22l-12-6V13z" fill="#1E293B" stroke="#334155" strokeWidth="1.5"/>
            <circle cx="15" cy="14" r="5" fill="#334155"/>
            <circle cx="15" cy="14" r="2.5" fill="#475569"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#F1F5F9" }}>Open Camera Feed</div>
          <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>View live surveillance</div>
        </div>
      </div>
    </Link>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [summary,    setSummary]    = useState(null);
  const [inside,     setInside]     = useState(null);
  const [staffCount, setStaffCount] = useState(null);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    const d = todayISO();
    Promise.allSettled([
      get(`/api/attendance/summary?date=${d}`),
      get(`/api/attendance/inside?date=${d}`),
      get("/api/users"),
    ]).then(([s, ins, u]) => {
      if (s.status   === "fulfilled" && s.value?.success)   setSummary(s.value.summary);
      if (ins.status === "fulfilled" && ins.value?.success) setInside(ins.value);
      if (u.status   === "fulfilled") {
        const list = Array.isArray(u.value) ? u.value : (u.value?.users || []);
        setStaffCount(list.filter(x => !["parent","unknown"].includes(x.role || "")).length);
      }
    }).finally(() => setLoading(false));
  }, []);

  const activeRooms = useMemo(() => {
    if (!inside?.students) return 0;
    return new Set(inside.students.map(s => s.class || s.Class).filter(Boolean)).size;
  }, [inside]);

  return (
    <>
      <style>{`@keyframes yd-pulse{0%{box-shadow:0 0 0 0 rgba(239,68,68,.5)}70%{box-shadow:0 0 0 7px rgba(239,68,68,0)}100%{box-shadow:0 0 0 0 rgba(239,68,68,0)}}`}</style>

      <div style={{ maxWidth: 1060, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: "clamp(20px,4vw,26px)", fontWeight: 800, color: "#0F172A", letterSpacing: "-0.02em", margin: 0 }}>
              Dashboard
            </h1>
            <p style={{ fontSize: 13, color: "#94A3B8", fontWeight: 500, margin: "4px 0 0" }}>{todayLabel()}</p>
          </div>
          <Link to="/students" className="btn btn-primary btn-sm">+ Add Student</Link>
        </div>

        {/* ── SECTION 1: LIVE ──────────────────────────────────────────────── */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22C55E", flexShrink: 0, animation: "yd-pulse 2s infinite", boxShadow: "0 0 0 0 rgba(34,197,94,.4)" }} />
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#64748B" }}>
              Live · {todayISO()}
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(175px,1fr))", gap: 12 }}>
            <StatCard label="Checked In Now"    value={inside?.count  ?? 0}          sub="students inside"          accent="#22C55E" iconBg="#F0FDF4" iconFg="#16A34A" IconEl={StudentIcon} loading={loading} to="/attendance" />
            <StatCard label="Present Today"     value={summary?.present ?? 0}         sub={`of ${summary?.total ?? 0} enrolled`} accent="#3B82F6" iconBg="#EFF6FF" iconFg="#2563EB" IconEl={AttendIcon}  loading={loading} to="/attendance" />
            <StatCard label="Active Classrooms" value={activeRooms}                   sub="with students inside"     accent="#8B5CF6" iconBg="#F5F3FF" iconFg="#7C3AED" IconEl={StaffIcon}   loading={loading} to="/attendance" />
            <StatCard label="Staff on Record"   value={staffCount ?? "—"}             sub="registered staff"         accent="#F59E0B" iconBg="#FFFBEB" iconFg="#D97706" IconEl={StaffIcon}   loading={loading} to={null} />
            <CCTVCard />
          </div>
        </div>

        {/* ── SECTION 2: QUICK NAVIGATION ──────────────────────────────────── */}
        <div style={{ background: "#fff", border: "1px solid #F1F1F1", borderRadius: 20, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#64748B", marginBottom: 12 }}>
            Quick Navigation
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(155px,1fr))", gap: 8 }}>
            {QUICK_NAV.map(n => (
              <Link key={n.path} to={n.path} style={{ textDecoration: "none" }}>
                <div
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, border: "1px solid #F1F1F1", background: "#fff", transition: "all .12s ease" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.background = "#FAFAFA"; e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 3px 10px rgba(0,0,0,0.06)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#F1F1F1"; e.currentTarget.style.background = "#fff";    e.currentTarget.style.transform = "none";             e.currentTarget.style.boxShadow = "none"; }}
                >
                  <div style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, background: n.bg, color: n.fg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <n.Icon />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n.label}</div>
                    <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n.desc}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </>
  );
}
