/**
 * CareFeed.jsx — Staff mobile "what needs doing" feed
 * ─────────────────────────────────────────────────────────────────────
 * Staff mobile feed — Parent-style UX plan (2026-07-31).
 *
 * Near-literal mobile re-skin of pages/Care.jsx: consumes useTaskFeed(),
 * splitTasksByOwnership() and useCareModules() UNCHANGED from
 * platform/tasks — same capability gating, same mine/team ownership
 * split (C1, 2026-07-31), same destination grid. Only the rendering
 * differs: Parent-style feed cards instead of desktop rows/grid tiles.
 * No role branch lives here — splitTasksByOwnership already resolves
 * "mine" vs "team" from the signed-in user's role.
 */
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { colors, spacing, typography } from "../theme/staffMobile";
import { useTaskFeed, useCareModules, splitTasksByOwnership } from "../platform/tasks";
import { useAuth } from "../contexts/AuthContext";
import FeedCard from "./components/FeedCard";

const PRIORITY_TONE = { critical: "bad", high: "bad", medium: "warn", low: "neutral" };

function relativeDue(dueAt) {
  if (!dueAt) return null;
  const d = new Date(dueAt);
  if (isNaN(d)) return null;
  const mins = Math.round((d.getTime() - Date.now()) / 60000);
  if (mins < -1440) return `${Math.round(-mins / 1440)}d overdue`;
  if (mins < -60)   return `${Math.round(-mins / 60)}h overdue`;
  if (mins < 0)     return `${-mins}m overdue`;
  if (mins < 60)    return `${mins}m left`;
  if (mins < 1440)  return `${Math.round(mins / 60)}h left`;
  return null;
}

function TaskCard({ task, muted }) {
  const navigate = useNavigate();
  const due = relativeDue(task.dueAt);
  const subtitle = [task.context, task.escalationReason, task.owner?.label && !muted ? null : task.owner?.label]
    .filter(Boolean).join(" · ");

  return (
    <div style={{ opacity: muted ? 0.75 : 1 }}>
      <FeedCard
        tone={PRIORITY_TONE[task.priority] || "neutral"}
        title={task.title}
        subtitle={subtitle}
        meta={due}
        onClick={task.deepLink ? () => navigate(task.deepLink) : undefined}
      />
    </div>
  );
}

function ModuleTile({ mod }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => mod.path && navigate(mod.path)}
      style={{
        textAlign: "left", cursor: "pointer",
        background: colors.surface.card,
        border: `1px solid ${colors.surface.border}`,
        borderRadius: 16, padding: "12px 14px",
        display: "flex", flexDirection: "column", gap: 2,
      }}
    >
      <span style={{ ...typography.caption, fontWeight: typography.weight.semibold, color: colors.text.primary }}>
        {mod.label}
      </span>
    </button>
  );
}

export default function CareFeed() {
  const { loading, tasks } = useTaskFeed();
  const modules = useCareModules();
  const { role } = useAuth();

  const { mine, team } = useMemo(() => splitTasksByOwnership(tasks, role), [tasks, role]);

  return (
    <div style={{ padding: `${spacing.lg}px ${spacing.lg}px 0` }}>
      <div style={{ ...typography.h1, color: colors.text.primary, marginBottom: spacing.lg }}>
        Care
      </div>

      <div style={{ ...typography.caption, fontWeight: typography.weight.semibold, color: colors.text.muted, marginBottom: spacing.sm }}>
        NEEDS ATTENTION
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
          {[0, 1].map(i => (
            <div key={i} style={{ height: 76, borderRadius: 20, background: colors.surface.raised, opacity: 0.6 }} />
          ))}
        </div>
      ) : mine.length === 0 ? (
        <div style={{
          padding: spacing.xl, textAlign: "center",
          border: `1px dashed ${colors.surface.border}`, borderRadius: 20,
          color: colors.text.muted, marginBottom: spacing.lg,
        }}>
          <div style={{ ...typography.caption }}>You're all caught up.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm, marginBottom: spacing.lg }}>
          {mine.map(t => <TaskCard key={t.id} task={t} />)}
        </div>
      )}

      {team.length > 0 && (
        <>
          <div style={{ ...typography.caption, fontWeight: typography.weight.semibold, color: colors.text.faint, marginBottom: spacing.sm }}>
            TEAM ACTIVITY
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm, marginBottom: spacing.lg }}>
            {team.map(t => <TaskCard key={t.id} task={t} muted />)}
          </div>
        </>
      )}

      {modules.length > 0 && (
        <>
          <div style={{ ...typography.caption, fontWeight: typography.weight.semibold, color: colors.text.muted, marginBottom: spacing.sm }}>
            MODULES
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: spacing.sm, marginBottom: spacing.lg }}>
            {modules.map(m => <ModuleTile key={m.id} mod={m} />)}
          </div>
        </>
      )}
    </div>
  );
}
