/**
 * CareFeed.jsx — Staff Home "what needs doing" tab
 * ─────────────────────────────────────────────────────────────────────
 * Staff Home — Parent Home visual language, Staff-owned (2026-07-31).
 *
 * Task feed mirrors Parent Home's activity feed: useTaskFeed() and
 * splitTasksByOwnership() UNCHANGED from platform/tasks — same
 * capability gating, same mine/team ownership split (C1, 2026-07-31).
 * No role branch lives here — splitTasksByOwnership already resolves
 * "mine" vs "team" from the signed-in user's role.
 *
 * Destination grid (added after direct visual comparison against
 * production Parent Home's Daily Care tab, per explicit request) mirrors
 * Parent's ModuleCard exactly — 2-column grid, icon tile, title, "Open ›"
 * — and consumes useCareModules() UNCHANGED from platform/tasks, the
 * same capability-driven destination list the desktop Care.jsx grid
 * already uses. No new data source, no role branching: the module set
 * differs per signed-in user purely because useCareModules() already
 * resolves that from capabilities, exactly as it does on desktop.
 */
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarCheck, Moon, Heart, ClipboardList, BookOpen, Car, AlertTriangle,
  UsersRound, BarChart2, Settings, CreditCard, FileText, Building2, Home as HomeIcon,
  UserCheck, Grid as GridIcon,
} from "lucide-react";
import { colors, spacing, radius, shadows, typography } from "../theme/staffMobile";
import { useTaskFeed, useCareModules, splitTasksByOwnership } from "../platform/tasks";
import { useAuth } from "../contexts/AuthContext";
import FeedCard from "./components/FeedCard";

const PRIORITY_TONE = { critical: "bad", high: "bad", medium: "warn", low: "neutral" };

// Module Registry icons are name strings (desktop Sidebar resolves them the
// same way). GridIcon is the fallback for any icon name not listed here, so
// a future module never renders blank — covers every icon currently used by
// a surfaces.care-enabled module, across every role, not just Teacher's.
const MODULE_ICONS = {
  CalendarCheck, Moon, Heart, ClipboardList, BookOpen, Car, AlertTriangle,
  UsersRound, BarChart2, Settings, CreditCard, FileText, Building2,
  Home: HomeIcon, UserCheck,
};

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

/** Mirrors Parent DailyCare.jsx's ModuleCard exactly (icon tile / title / "Open ›"). */
function ModuleTile({ mod, onOpen }) {
  const Icon = MODULE_ICONS[mod.icon] || GridIcon;
  return (
    <button
      onClick={onOpen}
      style={{
        position: "relative",
        display: "flex", flexDirection: "column", alignItems: "flex-start", gap: spacing.sm,
        minHeight: 132,
        padding: spacing.lg,
        borderRadius: radius.card,
        background: colors.surface.card,
        border: `1px solid ${colors.yellow200}`,
        boxShadow: shadows.card,
        cursor: "pointer",
        textAlign: "left",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <span style={{
        width: 48, height: 48, borderRadius: radius.md,
        background: colors.yellow100,
        border: `1px solid ${colors.yellow200}`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon size={22} strokeWidth={1.8} color={colors.yellow700} />
      </span>

      <span style={{ ...typography.title, color: colors.text.primary }}>{mod.label}</span>

      <span style={{ ...typography.meta, color: colors.yellow700, fontWeight: typography.weight.bold, display: "inline-flex", alignItems: "center", gap: 4 }}>
        Open
        <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke={colors.yellow700} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </span>
    </button>
  );
}

export default function CareFeed() {
  const { loading, tasks } = useTaskFeed();
  const modules = useCareModules();
  const { role } = useAuth();
  const navigate = useNavigate();

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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: spacing.md, marginBottom: spacing.lg }}>
            {modules.map(m => (
              <ModuleTile key={m.id} mod={m} onOpen={() => m.path && navigate(m.path)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
