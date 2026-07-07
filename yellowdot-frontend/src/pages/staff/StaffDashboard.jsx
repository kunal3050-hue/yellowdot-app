/**
 * StaffDashboard.jsx — Staff Management dashboard
 * ──────────────────────────────────────────────────
 * Cards: total / active / inactive / teachers / non-teaching /
 *        new joinings this month / birthdays / anniversaries
 * Quick actions:  Add Employee · Directory · Departments · Designations
 * Recent activity: last 20 events from the employeeTimeline feed.
 */

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import staffService from "../../services/staffService";

// ── Design tokens (matches existing Yellow Dot pages) ──────────────
const T = {
  bg:          "#FFFDF7",
  surface:     "#FFFFFF",
  surfaceWarm: "#FDFAF5",
  border:      "rgba(0,0,0,0.08)",
  borderGold:  "rgba(244,196,0,0.35)",
  shadow:      "0 1px 4px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)",
  shadowMd:    "0 4px 20px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
  text:        "#2A2A2A",
  textMuted:   "#8C8880",
  textSoft:    "#6A6560",
  gold:        "#F4C400",
  goldDark:    "#78350F",
  goldMid:     "#B45309",
  goldLight:   "rgba(244,196,0,0.10)",
  green:       "#059669",
  greenSoft:   "#f0fdf4",
  red:         "#DC2626",
  redLight:    "rgba(220,38,38,0.09)",
  blue:        "#2563eb",
  blueSoft:    "#eff6ff",
};

// ── Tiny reusables ───────────────────────────────────────────────────

function StatCard({ label, value, sub, accent = T.gold, onClick, loading }) {
  return (
    <div
      onClick={onClick}
      style={{
        background:    T.surface,
        border:        `1px solid ${T.border}`,
        borderRadius:  14,
        padding:       "18px 20px",
        cursor:        onClick ? "pointer" : "default",
        boxShadow:     T.shadow,
        position:      "relative",
        overflow:      "hidden",
        transition:    "transform 120ms ease, box-shadow 120ms ease",
      }}
      onMouseEnter={(e) => {
        if (!onClick) return;
        e.currentTarget.style.transform = "translateY(-1px)";
        e.currentTarget.style.boxShadow = T.shadowMd;
      }}
      onMouseLeave={(e) => {
        if (!onClick) return;
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = T.shadow;
      }}
    >
      <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 3, background: accent }} />
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: T.textMuted }}>
        {label}
      </div>
      <div style={{ marginTop: 8, fontSize: 28, fontWeight: 700, color: T.text, letterSpacing: "-0.02em" }}>
        {loading ? <span style={{ color: T.textMuted }}>—</span> : value}
      </div>
      {sub && (
        <div style={{ marginTop: 4, fontSize: 12, color: T.textSoft }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function QuickAction({ title, description, icon, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background:    T.surface,
        border:        `1px solid ${T.border}`,
        borderRadius:  14,
        padding:       "16px 18px",
        display:       "flex",
        alignItems:    "center",
        gap:           14,
        cursor:        "pointer",
        boxShadow:     T.shadow,
        textAlign:     "left",
        width:         "100%",
        transition:    "transform 120ms ease, box-shadow 120ms ease, border-color 120ms",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform   = "translateY(-1px)";
        e.currentTarget.style.boxShadow   = T.shadowMd;
        e.currentTarget.style.borderColor = T.borderGold;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform   = "translateY(0)";
        e.currentTarget.style.boxShadow   = T.shadow;
        e.currentTarget.style.borderColor = T.border;
      }}
    >
      <div style={{
        width: 42, height: 42, borderRadius: 12,
        background: T.goldLight,
        border: `1px solid ${T.borderGold}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 18, flexShrink: 0,
      }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{title}</div>
        <div style={{ fontSize: 12, color: T.textSoft, marginTop: 2 }}>{description}</div>
      </div>
    </button>
  );
}

function PeopleStrip({ title, people, emptyText, icon }) {
  return (
    <div style={{
      background:    T.surface,
      border:        `1px solid ${T.border}`,
      borderRadius:  14,
      padding:       "18px 20px",
      boxShadow:     T.shadow,
      minHeight:     150,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{title}</div>
        <div style={{ marginLeft: "auto", fontSize: 11, color: T.textMuted }}>
          {people.length}
        </div>
      </div>
      {people.length === 0 ? (
        <div style={{ fontSize: 12, color: T.textMuted, padding: "16px 4px" }}>
          {emptyText}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {people.slice(0, 6).map((p) => (
            <div key={p.staffId} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 30, height: 30, borderRadius: 8,
                background: T.goldLight,
                border: `1px solid ${T.borderGold}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: 12, color: T.goldMid,
                overflow: "hidden",
              }}>
                {p.photoUrl
                  ? <img src={p.photoUrl} alt={p.displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : (p.displayName || "?").charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, color: T.text, fontWeight: 500,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>{p.displayName}</div>
              </div>
              <div style={{ fontSize: 11, color: T.textMuted }}>
                {p.years != null ? `${p.years} yr${p.years === 1 ? "" : "s"}` : `Day ${p.day}`}
              </div>
            </div>
          ))}
          {people.length > 6 && (
            <div style={{ fontSize: 11, color: T.textMuted, paddingTop: 4 }}>
              + {people.length - 6} more
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function fmtRelative(iso) {
  if (!iso) return "—";
  try {
    const now    = Date.now();
    const t      = new Date(iso).getTime();
    const diff   = Math.max(0, now - t);
    const mins   = Math.floor(diff / 60000);
    if (mins < 1)    return "Just now";
    if (mins < 60)   return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)    return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7)    return `${days}d ago`;
    return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  } catch { return "—"; }
}

const EVENT_LABEL = {
  STAFF_CREATED:    { label: "New staff joined",     dot: T.green },
  STAFF_UPDATED:    { label: "Staff updated",        dot: T.blue  },
  DEPARTMENT_CHANGED: { label: "Department changed", dot: T.gold  },
  DESIGNATION_CHANGED:{ label: "Designation changed",dot: T.gold  },
  STAFF_STATUS_CHANGED:{label: "Status changed",     dot: T.red   },
  DOCUMENT_UPLOADED:{ label: "Documents uploaded",   dot: T.blue  },
};

// ── Page ─────────────────────────────────────────────────────────────

export default function StaffDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats,    setStats]    = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [s, a] = await Promise.all([
        staffService.dashboard(),
        staffService.recentActivity(20),
      ]);
      if (s?.success) setStats(s);
      if (a?.success) setActivity(a.events || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const s = stats || {};

  return (
    <div style={{ background: T.bg, minHeight: "100%", padding: "24px 28px 48px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: T.goldMid }}>
            Staff Management
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: T.text, letterSpacing: "-0.02em", margin: "4px 0 0" }}>
            Dashboard
          </h1>
          <div style={{ fontSize: 13, color: T.textSoft, marginTop: 4 }}>
            Snapshot of your school's people. Welcome back, {user?.name?.split(" ")[0] || "there"}.
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => navigate("/staff/employees/new")}
            style={{
              background: T.gold, color: "#1E1E1E",
              border: "none", borderRadius: 10,
              padding: "10px 18px", fontWeight: 600, fontSize: 13,
              cursor: "pointer", boxShadow: T.shadow,
            }}
          >+ Add Employee</button>
          <button
            onClick={() => navigate("/staff/employees")}
            style={{
              background: T.surface, color: T.text,
              border: `1px solid ${T.border}`, borderRadius: 10,
              padding: "10px 18px", fontWeight: 600, fontSize: 13,
              cursor: "pointer",
            }}
          >View Directory</button>
        </div>
      </div>

      {error && (
        <div style={{
          background: T.redLight, color: T.red,
          border: `1px solid ${T.red}33`,
          borderRadius: 10, padding: "10px 14px", marginBottom: 16,
          fontSize: 13,
        }}>{error}</div>
      )}

      {/* Stats grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
        gap: 14,
        marginBottom: 24,
      }}>
        <StatCard label="Total Staff"      value={s.total ?? 0}      sub="All employees"               loading={loading} />
        <StatCard label="Active"           value={s.active ?? 0}     sub="Currently working"           accent={T.green}  loading={loading} />
        <StatCard label="Inactive"         value={s.inactive ?? 0}   sub="On leave / exited"           accent={T.textMuted} loading={loading} />
        <StatCard label="Teachers"         value={s.teachers ?? 0}   sub="Academic staff"              accent={T.blue}   loading={loading} />
        <StatCard label="Non-Teaching"     value={s.nonTeaching ?? 0}sub="Support / admin"             accent={T.goldMid} loading={loading} />
        <StatCard label="New This Month"   value={s.newJoiningsThisMonth ?? 0} sub="Joined since the 1st" accent={T.green} loading={loading} />
        <StatCard label="Birthdays"        value={(s.birthdaysThisMonth || []).length} sub="This month" accent={T.gold} loading={loading} />
        <StatCard label="Anniversaries"    value={(s.workAnniversariesThisMonth || []).length} sub="This month" accent={T.gold} loading={loading} />
      </div>

      {/* Quick actions */}
      <div style={{ fontSize: 13, fontWeight: 600, color: T.text, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
        Quick Actions
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: 12,
        marginBottom: 24,
      }}>
        <QuickAction
          title="Add Employee"
          description="Create a new staff record"
          icon="➕"
          onClick={() => navigate("/staff/employees/new")}
        />
        <QuickAction
          title="Employee Directory"
          description="Browse, search & manage staff"
          icon="👥"
          onClick={() => navigate("/staff/employees")}
        />
        <QuickAction
          title="Departments"
          description="Manage org structure"
          icon="🏢"
          onClick={() => navigate("/staff/departments")}
        />
        <QuickAction
          title="Designations"
          description="Manage job titles & levels"
          icon="🎓"
          onClick={() => navigate("/staff/designations")}
        />
      </div>

      {/* Birthdays + Anniversaries strip */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: 14,
        marginBottom: 24,
      }}>
        <PeopleStrip
          title="Birthdays This Month"
          icon="🎂"
          people={s.birthdaysThisMonth || []}
          emptyText="No birthdays this month."
        />
        <PeopleStrip
          title="Work Anniversaries"
          icon="🏆"
          people={s.workAnniversariesThisMonth || []}
          emptyText="No anniversaries this month."
        />
      </div>

      {/* Recent activity */}
      <div style={{ fontSize: 13, fontWeight: 600, color: T.text, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
        Recent Activity
      </div>
      <div style={{
        background:   T.surface,
        border:       `1px solid ${T.border}`,
        borderRadius: 14,
        boxShadow:    T.shadow,
        overflow:     "hidden",
      }}>
        {loading && activity.length === 0 && (
          <div style={{ padding: "24px", color: T.textMuted, fontSize: 13 }}>Loading…</div>
        )}
        {!loading && activity.length === 0 && (
          <div style={{ padding: "24px", color: T.textMuted, fontSize: 13 }}>
            No activity yet. Create your first employee to see events here.
          </div>
        )}
        {activity.map((ev) => {
          const meta = EVENT_LABEL[ev.type] || { label: ev.type || "Event", dot: T.textMuted };
          return (
            <div key={ev.eventId || `${ev.staffId}-${ev.createdAt}`} style={{
              display: "grid",
              gridTemplateColumns: "12px 1fr auto",
              alignItems: "center",
              gap: 12,
              padding: "12px 18px",
              borderBottom: `1px solid ${T.border}`,
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: "50%",
                background: meta.dot, display: "inline-block",
              }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{meta.label}</div>
                <div style={{ fontSize: 12, color: T.textSoft }}>{ev.description || ""}</div>
              </div>
              <div style={{ fontSize: 11, color: T.textMuted, whiteSpace: "nowrap" }}>
                {fmtRelative(ev.createdAt)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
