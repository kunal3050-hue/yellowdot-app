/**
 * StaffDashboard.jsx — Staff Management dashboard
 * ──────────────────────────────────────────────────
 * Design System v2 / Platform Layout Standard (KUE_BOXS_LAYOUT_STANDARD.md):
 * PageShell -> PageHeader -> KpiRow -> Quick Actions (QuickActionCard) ->
 * Birthdays/Anniversaries -> Recent Activity (ActivityFeed). Same data
 * (staffService.dashboard/recentActivity), same events -- presentation only.
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserPlus, Users, Building2, GraduationCap, Cake, Trophy } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import staffService from "../../services/staffService";
import { PageShell, PageHeader, KpiRow, KpiCard, QuickActionCard, ActivityFeed, Card, Avatar } from "../../components/ui";

const EVENT_META = {
  STAFF_CREATED:        { label: "New staff joined",      category: "created" },
  STAFF_UPDATED:        { label: "Staff updated",         category: "updated" },
  DEPARTMENT_CHANGED:   { label: "Department changed",    category: "org" },
  DESIGNATION_CHANGED:  { label: "Designation changed",   category: "org" },
  STAFF_STATUS_CHANGED: { label: "Status changed",        category: "status" },
  DOCUMENT_UPLOADED:    { label: "Documents uploaded",    category: "docs" },
};

const ACTIVITY_CATEGORIES = [
  { key: "created", label: "Joined",       color: "var(--yd-success)",    bg: "var(--yd-success-soft)" },
  { key: "updated", label: "Updated",      color: "var(--yd-info)",       bg: "var(--yd-info-soft)" },
  { key: "org",     label: "Org changes",  color: "var(--yd-yellow-dark)",bg: "var(--yd-yellow-light, #FFF9E0)" },
  { key: "status",  label: "Status",       color: "var(--yd-danger)",     bg: "var(--yd-danger-soft)" },
  { key: "docs",    label: "Documents",    color: "var(--yd-info)",       bg: "var(--yd-info-soft)" },
];

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--yd-charcoal)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
      {children}
    </div>
  );
}

function PeopleStrip({ title, icon, people, emptyText }) {
  return (
    <Card padding="18px 20px">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span style={{ display: "flex", color: "var(--yd-yellow-dark)" }}>{icon}</span>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--yd-charcoal)" }}>{title}</div>
        <div style={{ marginLeft: "auto", fontSize: 11, color: "var(--yd-text-muted)" }}>{people.length}</div>
      </div>
      {people.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--yd-text-muted)", padding: "16px 4px" }}>{emptyText}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {people.slice(0, 6).map((p) => (
            <div key={p.staffId} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Avatar name={p.displayName} photoUrl={p.photoUrl} size={30} shape="square" />
              <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: "var(--yd-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {p.displayName}
              </div>
              <div style={{ fontSize: 11, color: "var(--yd-text-muted)" }}>
                {p.years != null ? `${p.years} yr${p.years === 1 ? "" : "s"}` : `Day ${p.day}`}
              </div>
            </div>
          ))}
          {people.length > 6 && (
            <div style={{ fontSize: 11, color: "var(--yd-text-muted)", paddingTop: 4 }}>+ {people.length - 6} more</div>
          )}
        </div>
      )}
    </Card>
  );
}

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

  const feedItems = activity.map((ev) => {
    const meta = EVENT_META[ev.type] || { label: ev.type || "Event" };
    return {
      id: ev.eventId || `${ev.staffId}-${ev.createdAt}`,
      title: meta.label,
      body: ev.description || "",
      timestamp: ev.createdAt,
      category: meta.category,
    };
  });

  return (
    <PageShell
      header={
        <PageHeader
          title="Dashboard"
          tag="Staff Management"
          subtitle={`Snapshot of your school's people. Welcome back, ${user?.name?.split(" ")[0] || "there"}.`}
          primaryAction={{ label: "Add Employee", icon: <UserPlus size={14} strokeWidth={2} />, onClick: () => navigate("/staff/employees/new") }}
          secondaryActions={[{ key: "directory", label: "View Directory", onClick: () => navigate("/staff/employees") }]}
        />
      }
      kpis={
        <KpiRow>
          <KpiCard label="Total Staff"    value={s.total ?? 0}    trendLabel="All employees"        loading={loading} />
          <KpiCard label="Active"         value={s.active ?? 0}   trendLabel="Currently working"    loading={loading} />
          <KpiCard label="Inactive"       value={s.inactive ?? 0} trendLabel="On leave / exited"    loading={loading} />
          <KpiCard label="Teachers"       value={s.teachers ?? 0} trendLabel="Academic staff"        loading={loading} />
          <KpiCard label="Non-Teaching"   value={s.nonTeaching ?? 0} trendLabel="Support / admin"    loading={loading} />
          <KpiCard label="New This Month" value={s.newJoiningsThisMonth ?? 0} trendLabel="Joined since the 1st" loading={loading} />
          <KpiCard label="Birthdays"      value={(s.birthdaysThisMonth || []).length} trendLabel="This month" loading={loading} />
          <KpiCard label="Anniversaries"  value={(s.workAnniversariesThisMonth || []).length} trendLabel="This month" loading={loading} />
        </KpiRow>
      }
    >
      {error && (
        <div style={{ background: "var(--yd-danger-soft)", color: "var(--yd-danger)", border: "1px solid var(--yd-danger-border)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      <SectionLabel>Quick Actions</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12, marginBottom: 24 }}>
        <QuickActionCard icon={<UserPlus size={20} />} title="Add Employee" description="Create a new staff record" onClick={() => navigate("/staff/employees/new")} />
        <QuickActionCard icon={<Users size={20} />} title="Employee Directory" description="Browse, search & manage staff" onClick={() => navigate("/staff/employees")} />
        <QuickActionCard icon={<Building2 size={20} />} title="Departments" description="Manage org structure" onClick={() => navigate("/staff/departments")} />
        <QuickActionCard icon={<GraduationCap size={20} />} title="Designations" description="Manage job titles & levels" onClick={() => navigate("/staff/designations")} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, marginBottom: 24 }}>
        <PeopleStrip title="Birthdays This Month" icon={<Cake size={16} strokeWidth={2} />} people={s.birthdaysThisMonth || []} emptyText="No birthdays this month." />
        <PeopleStrip title="Work Anniversaries"   icon={<Trophy size={16} strokeWidth={2} />} people={s.workAnniversariesThisMonth || []} emptyText="No anniversaries this month." />
      </div>

      <SectionLabel>Recent Activity</SectionLabel>
      <Card padding="0">
        <ActivityFeed
          items={feedItems}
          loading={loading && activity.length === 0}
          categories={ACTIVITY_CATEGORIES}
          searchable={false}
          filterable={false}
          empty={{ description: "Create your first employee to see events here." }}
        />
      </Card>
    </PageShell>
  );
}
