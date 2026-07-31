/**
 * Care.jsx — "What work needs to be done?"
 * ─────────────────────────────────────────────────────────────────────
 * PLATFORM ARCHITECTURE §7 — docs/platform-architecture/PLATFORM_ARCHITECTURE.md
 *
 *   Dashboard = See what's happening.  Care = Do the work.  Profile = Manage yourself.
 *
 * Two regions, both registry-driven:
 *   1. the priority-sorted task feed (Task Engine, §4)
 *   2. the role-personalised destination grid (Module Registry `surfaces.care`)
 *
 * Care READS, LINKS and COUNTS. It never mutates. A task leaves the queue
 * because its state changed in the module that owns it — which is the single
 * rule that keeps business logic out of this screen.
 *
 * Like Dashboard, this file holds no task list, no module list, and no role
 * branch. If a role name or a task id appears here, the architecture has been
 * bypassed.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader, Skeleton } from "../components/ui";
import { useTaskFeed, useCareModules, splitTasksByOwnership } from "../platform/tasks";
import { CATEGORIES_BY_ID } from "../platform/registry";
import { useAuth } from "../contexts/AuthContext";

const PRIORITY_STYLE = {
  critical: { label: "Critical", color: "#DC2626", bg: "#FEF2F2", border: "#FECACA" },
  high:     { label: "High",     color: "#EA580C", bg: "#FFF7ED", border: "#FED7AA" },
  medium:   { label: "Medium",   color: "#D97706", bg: "#FFFBEB", border: "#FDE68A" },
  low:      { label: "Low",      color: "#6B7280", bg: "#F8FAFC", border: "#E2E8F0" },
};

const STATUS_LABEL = { pending: "Pending", in_progress: "In progress", completed: "Done" };

function relativeDue(dueAt) {
  if (!dueAt) return null;
  const d = new Date(dueAt);
  if (isNaN(d)) return null;
  const mins = Math.round((d.getTime() - Date.now()) / 60000);
  if (mins < -1440) return `${Math.round(-mins / 1440)}d overdue`;
  if (mins < -60)   return `${Math.round(-mins / 60)}h overdue`;
  if (mins < 0)     return `${-mins}m overdue`;
  if (mins < 60)    return `due in ${mins}m`;
  if (mins < 1440)  return `due in ${Math.round(mins / 60)}h`;
  return null;
}

function TaskRow({ task }) {
  const navigate = useNavigate();
  const p = PRIORITY_STYLE[task.priority] || PRIORITY_STYLE.medium;
  const due = relativeDue(task.dueAt);
  const open = () => task.deepLink && navigate(task.deepLink);

  return (
    <div
      onClick={open}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "13px 16px",
        background: "var(--yd-surface, #fff)",
        border: "1px solid var(--yd-border-light, #EFE7D2)",
        borderLeft: `3px solid ${p.color}`,
        borderRadius: 12, cursor: task.deepLink ? "pointer" : "default",
      }}
    >
      <span style={{
        fontSize: 11, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase",
        color: p.color, background: p.bg, border: `1px solid ${p.border}`,
        padding: "3px 8px", borderRadius: 999, whiteSpace: "nowrap",
      }}>
        {p.label}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--yd-charcoal, #1F1F1F)" }}>
          {task.title}
        </div>
        <div style={{
          fontSize: 12.5, color: "var(--yd-text-muted, #6B7280)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {task.context}
          {task.escalationReason && ` · ${task.escalationReason}`}
          {due && ` · ${due}`}
        </div>
      </div>

      {task.owner?.label && (
        <span style={{ fontSize: 11.5, color: "var(--yd-text-muted, #6B7280)", whiteSpace: "nowrap" }}>
          {task.owner.label}
        </span>
      )}
      {task.status === "in_progress" && (
        <span style={{ fontSize: 11, color: "var(--yd-text-muted, #6B7280)" }}>
          {STATUS_LABEL[task.status]}
        </span>
      )}
      <span style={{ color: "var(--yd-text-muted, #9CA3AF)", fontSize: 16 }}>›</span>
    </div>
  );
}

export default function Care() {
  const { loading, tasks, degraded, providerCount } = useTaskFeed();
  const modules = useCareModules();
  const navigate = useNavigate();
  const { role } = useAuth();
  const [filter, setFilter] = useState("all");

  // C1, Care experience review (2026-07-31): the feed used to be shown
  // whole — capability-gated but not ownership-filtered, so a Teacher's
  // "Needs attention" was mostly Principal's and Reception's tasks with
  // only the owner caption to tell them apart. `mine` is what "Needs
  // attention" actually means from here; `team` keeps the rest visible,
  // just not counted as this viewer's workload.
  const { mine, team } = useMemo(() => splitTasksByOwnership(tasks, role), [tasks, role]);

  // Filter chips are DERIVED from the categories of the modules that actually
  // contributed tasks — never a hand-maintained enum (§4, domain→moduleId).
  const chips = useMemo(() => {
    const byCategory = new Map();
    for (const t of mine) {
      const cat = t.category ?? "other";
      byCategory.set(cat, (byCategory.get(cat) || 0) + 1);
    }
    return [...byCategory.entries()].map(([id, count]) => ({
      id, count, label: CATEGORIES_BY_ID[id]?.label ?? "Other",
    }));
  }, [mine]);

  const visible = filter === "all" ? mine : mine.filter(t => (t.category ?? "other") === filter);

  // Every source failed: the feed is unknown, not empty. These are different
  // states and must not share a message.
  const allSourcesDown = !loading && providerCount > 0 && degraded.length === providerCount;

  return (
    <div style={{ padding: "8px 4px 32px" }}>
      <PageHeader title="Care" subtitle="What needs doing right now" />

      {/* ── Needs attention ─────────────────────────────────────────── */}
      <section style={{ marginTop: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Needs attention</h2>
          {!loading && mine.length > 0 && (
            <span style={{ fontSize: 12, color: "var(--yd-text-muted, #6B7280)" }}>
              {mine.length} item{mine.length === 1 ? "" : "s"}
            </span>
          )}
        </div>

        {chips.length > 1 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {[{ id: "all", label: "All", count: mine.length }, ...chips].map(c => (
              <button
                key={c.id}
                onClick={() => setFilter(c.id)}
                style={{
                  fontSize: 12, padding: "5px 11px", borderRadius: 999, cursor: "pointer",
                  border: `1px solid ${filter === c.id ? "var(--yd-charcoal, #1F1F1F)" : "var(--yd-border-light, #EFE7D2)"}`,
                  background: filter === c.id ? "var(--yd-charcoal, #1F1F1F)" : "transparent",
                  color: filter === c.id ? "#fff" : "var(--yd-text-muted, #6B7280)",
                }}
              >
                {c.label} {c.count}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Skeleton height={54} /><Skeleton height={54} /><Skeleton height={54} />
          </div>
        ) : visible.length === 0 ? (
          <div style={{
            padding: "28px 24px", textAlign: "center", borderRadius: 14,
            border: `1px dashed ${allSourcesDown ? "#FECACA" : "var(--yd-border-light, #EFE7D2)"}`,
            background: allSourcesDown ? "#FEF2F2" : "transparent",
            color: allSourcesDown ? "#991B1B" : "var(--yd-text-muted, #6B7280)",
          }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              {providerCount === 0   ? "Nothing assigned to you here"
                : allSourcesDown     ? "Can’t load your tasks right now"
                :                      "You’re all caught up"}
            </div>
            <div style={{ fontSize: 13 }}>
              {providerCount === 0   ? "Your account doesn’t have access to any task sources."
                // NEVER say "caught up" when every source failed. In this app the
                // sources are pickup approvals and incident reports — telling
                // staff there is nothing waiting when we simply cannot tell is
                // the one wrong answer.
                : allSourcesDown     ? "None of your task sources responded, so this list is not trustworthy. Try again shortly."
                :                      "No pending items right now."}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {visible.map(t => <TaskRow key={t.id} task={t} />)}
          </div>
        )}

        {degraded.length > 0 && !allSourcesDown && (
          // Partial failure: say so rather than silently showing a short list.
          // Suppressed when everything is down, since the empty state above
          // already says it more clearly.
          <div style={{ marginTop: 10, fontSize: 12, color: "var(--yd-text-muted, #9CA3AF)" }}>
            Some sources couldn’t be reached ({degraded.join(", ")}). This list may be incomplete.
          </div>
        )}
      </section>

      {/* ── Team activity ────────────────────────────────────────────
          Everything the viewer can see but that isn't theirs to action —
          kept visible for context (owner caption already names whose it
          is) but out of the primary count and never mixed into the chips
          above, which is what C1 was actually about. */}
      {!loading && team.length > 0 && (
        <section style={{ marginTop: 26 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, margin: 0, color: "var(--yd-text-muted, #6B7280)" }}>
              Team activity
            </h2>
            <span style={{ fontSize: 12, color: "var(--yd-text-muted, #9CA3AF)" }}>
              {team.length} item{team.length === 1 ? "" : "s"} — visible for context, not yours to action
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, opacity: 0.75 }}>
            {team.map(t => <TaskRow key={t.id} task={t} />)}
          </div>
        </section>
      )}

      {/* ── Modules ─────────────────────────────────────────────────── */}
      <section style={{ marginTop: 30 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 10px" }}>Modules</h2>
        {modules.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--yd-text-muted, #6B7280)" }}>
            No modules available for your role.
          </div>
        ) : (
          <div style={{
            display: "grid", gap: 10,
            gridTemplateColumns: "repeat(auto-fill, minmax(168px, 1fr))",
          }}>
            {modules.map(m => (
              <button
                key={m.id}
                onClick={() => m.path && navigate(m.path)}
                style={{
                  textAlign: "left", cursor: "pointer",
                  background: "var(--yd-surface, #fff)",
                  border: "1px solid var(--yd-border-light, #EFE7D2)",
                  borderRadius: 14, padding: "14px 15px",
                  display: "flex", flexDirection: "column", gap: 4,
                }}
              >
                <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--yd-charcoal, #1F1F1F)" }}>
                  {m.label}
                </span>
                <span style={{ fontSize: 11.5, color: "var(--yd-text-muted, #9CA3AF)" }}>
                  {CATEGORIES_BY_ID[m.category]?.label ?? ""}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
