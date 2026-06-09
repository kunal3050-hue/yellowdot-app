/**
 * Notifications.jsx — Parent Module · Notification Center
 * ─────────────────────────────────────────────────────────
 * Full-screen notification center for parents.
 *
 * Features:
 *   • Unread count badge + "Mark all read" action
 *   • Filter tabs: All | Attendance | Daily Care | Memories | Communication | Billing
 *   • Child filter dropdown (multi-child families)
 *   • Grouped by Today / Yesterday / Earlier
 *   • Tap-to-mark-read + deep-link navigation
 *   • Empty state per filter
 */

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import useNotifications from "../hooks/useNotifications";
import useParentProfile from "../hooks/useParentProfile";
import { colors, spacing, radius, shadows, typography } from "../theme";

// ── Filter tab definitions ────────────────────────────────────────
const FILTER_TABS = [
  { key: "all",           label: "All",           types: null },
  { key: "attendance",    label: "Attendance",     types: ["attendance_checkin","attendance_checkout","attendance_marked"] },
  { key: "daily_care",    label: "Daily Care",     types: ["nap_started","nap_ended","food_consumption"] },
  { key: "memories",      label: "Memories",       types: ["new_memory","new_activity"] },
  { key: "communication", label: "Communication",  types: ["holiday_announced","circular_published","announcement","emergency_closure"] },
  { key: "billing",       label: "Billing",        types: ["fee_reminder","fee_due_today","fee_overdue","payment_received"] },
];

// ── Priority colours ──────────────────────────────────────────────
const PRIORITY_DOT = {
  high:   colors.danger,
  medium: colors.warning,
  low:    colors.gray300,
};

// ── Type icons (emoji-based, no extra dep) ────────────────────────
const TYPE_ICON = {
  attendance_checkin:  "🏫",
  attendance_checkout: "👋",
  attendance_marked:   "✅",
  nap_started:         "😴",
  nap_ended:           "☀️",
  food_consumption:    "🍱",
  new_memory:          "📸",
  new_activity:        "🎨",
  holiday_announced:   "🗓️",
  circular_published:  "📋",
  announcement:        "📢",
  emergency_closure:   "⚠️",
  fee_reminder:        "💰",
  fee_due_today:       "💳",
  fee_overdue:         "🔴",
  payment_received:    "✅",
};

// ── Date grouping helpers ─────────────────────────────────────────
function getGroupLabel(isoDate) {
  if (!isoDate) return "Earlier";
  const d    = new Date(isoDate);
  const now  = new Date();
  const diff = Math.floor((now - d) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return "Earlier";
}

function groupNotifications(list) {
  const groups = { Today: [], Yesterday: [], Earlier: [] };
  list.forEach(n => {
    const label = getGroupLabel(n.createdAt);
    groups[label].push(n);
  });
  return ["Today", "Yesterday", "Earlier"].filter(g => groups[g].length > 0).map(g => ({
    label: g,
    items: groups[g],
  }));
}

function formatTime(isoDate) {
  if (!isoDate) return "";
  const d = new Date(isoDate);
  if (isNaN(d)) return "";
  const now  = new Date();
  const diff = now - d;
  if (diff < 60_000)   return "Just now";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// ── Tokens ────────────────────────────────────────────────────────
const T = {
  bg:      colors.surface.background,
  card:    colors.surface.card,
  border:  colors.surface.border,
  text:    colors.text.primary,
  text2:   colors.text.secondary,
  text3:   colors.text.muted,
  text4:   colors.text.faint,
  gold:    colors.yellow500,
  goldSoft:colors.yellow100,
};

export default function Notifications() {
  const navigate                    = useNavigate();
  const { children: linkedChildren } = useParentProfile();
  const [activeTab, setActiveTab]   = useState("all");
  const [childFilter, setChildFilter] = useState(null);

  const activeTypes = FILTER_TABS.find(t => t.key === activeTab)?.types ?? null;

  const { notifications, unreadCount, loading, error, refresh, markRead, markAllRead } =
    useNotifications({
      autoLoad: true,
    });

  // Apply tab type filter + child filter in memory
  const filtered = useMemo(() => {
    let list = notifications;
    if (activeTypes) list = list.filter(n => activeTypes.includes(n.type));
    if (childFilter) list = list.filter(n => !n.childId || n.childId === childFilter);
    return list;
  }, [notifications, activeTypes, childFilter]);

  const groups = useMemo(() => groupNotifications(filtered), [filtered]);

  const children = linkedChildren || [];

  function handleTap(n) {
    if (!n.read) markRead(n.id);
    if (n.deepLink) navigate(n.deepLink);
  }

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: typography.fontFamily.base }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={{
        padding: `${spacing.lg}px ${spacing.lg}px ${spacing.sm}px`,
        position: "sticky", top: 0, zIndex: 10,
        background: colors.surface.backgroundTranslucent,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: `1px solid ${T.border}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm }}>
          <div style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
            <span style={{ fontSize: 22 }}>🔔</span>
            <span style={{ fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: T.text }}>
              Notifications
            </span>
            {unreadCount > 0 && (
              <span style={{
                background: colors.danger,
                color: colors.white,
                fontSize: typography.size.xs,
                fontWeight: typography.weight.bold,
                borderRadius: radius.pill,
                padding: "2px 7px",
                minWidth: 20,
                textAlign: "center",
              }}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: colors.yellow700, fontSize: typography.size.sm,
                fontWeight: typography.weight.semibold, padding: `${spacing.xs}px ${spacing.sm}px`,
                borderRadius: radius.sm,
              }}
            >
              Mark all read
            </button>
          )}
        </div>

        {/* Child filter (only for multi-child families) */}
        {children.length > 1 && (
          <div style={{ display: "flex", gap: spacing.xs, marginBottom: spacing.sm, overflowX: "auto", paddingBottom: 2 }}>
            <ChildChip label="All children" selected={!childFilter} onClick={() => setChildFilter(null)} />
            {children.map(c => (
              <ChildChip
                key={c.studentId}
                label={c.studentName?.split(" ")[0] || c.studentId}
                selected={childFilter === c.studentId}
                onClick={() => setChildFilter(childFilter === c.studentId ? null : c.studentId)}
              />
            ))}
          </div>
        )}

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: spacing.xs, overflowX: "auto", paddingBottom: 2 }}>
          {FILTER_TABS.map(tab => (
            <TabChip
              key={tab.key}
              label={tab.label}
              active={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
            />
          ))}
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────── */}
      <div style={{ padding: `${spacing.md}px ${spacing.lg}px` }}>

        {loading && !notifications.length && (
          <div style={{ textAlign: "center", padding: `${spacing["4xl"]}px 0`, color: T.text3 }}>
            <div style={{ fontSize: 36, marginBottom: spacing.sm }}>🔔</div>
            <div style={{ fontSize: typography.size.sm }}>Loading notifications…</div>
          </div>
        )}

        {!loading && error && (
          <div style={{
            margin: `${spacing.lg}px 0`,
            padding: `${spacing.md}px ${spacing.lg}px`,
            borderRadius: radius.card,
            background: "#FFF1F0",
            border: "1px solid #FFCCC7",
            color: "#CF1322",
          }}>
            <div style={{ fontWeight: typography.weight.bold, marginBottom: spacing.xs, fontSize: typography.size.sm }}>
              ⚠️ Could not load notifications
            </div>
            <div style={{ fontSize: typography.size.xs, marginBottom: spacing.sm, opacity: 0.85 }}>
              {error}
            </div>
            <button
              onClick={refresh}
              style={{
                fontSize: typography.size.xs,
                fontWeight: typography.weight.semibold,
                color: "#CF1322",
                background: "none",
                border: "1px solid #FFCCC7",
                borderRadius: radius.sm,
                padding: `${spacing.xs}px ${spacing.sm}px`,
                cursor: "pointer",
              }}
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <EmptyState tab={activeTab} />
        )}

        {groups.map(group => (
          <div key={group.label} style={{ marginBottom: spacing.lg }}>
            <div style={{
              fontSize: typography.size.xs,
              fontWeight: typography.weight.bold,
              color: T.text3,
              letterSpacing: typography.tracking.wider,
              textTransform: "uppercase",
              marginBottom: spacing.sm,
              paddingLeft: 2,
            }}>
              {group.label}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
              {group.items.map(n => (
                <NotificationCard key={n.id} n={n} onTap={handleTap} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── NotificationCard ──────────────────────────────────────────────
function NotificationCard({ n, onTap }) {
  const [pressed, setPressed] = useState(false);

  return (
    <div
      onClick={() => onTap(n)}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      style={{
        display: "flex", alignItems: "flex-start", gap: spacing.md,
        padding: `${spacing.md}px ${spacing.md}px`,
        borderRadius: radius.card,
        background: n.read ? colors.surface.card : colors.yellow50,
        border: `1px solid ${n.read ? colors.surface.border : colors.yellow200}`,
        boxShadow: pressed ? shadows.inset : (n.read ? shadows.xs : shadows.sm),
        cursor: n.deepLink ? "pointer" : "default",
        transition: "box-shadow 0.12s, transform 0.12s",
        transform: pressed ? "scale(0.985)" : "scale(1)",
        WebkitTapHighlightColor: "transparent",
        position: "relative",
      }}
    >
      {/* Unread indicator */}
      {!n.read && (
        <div style={{
          position: "absolute", top: spacing.md, right: spacing.md,
          width: 8, height: 8, borderRadius: radius.pill,
          background: PRIORITY_DOT[n.priority] || colors.yellow500,
        }} />
      )}

      {/* Icon */}
      <div style={{
        width: 42, height: 42, borderRadius: radius.md,
        background: n.read ? colors.gray100 : colors.yellow100,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 22, flexShrink: 0,
      }}>
        {TYPE_ICON[n.type] || "📣"}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: typography.size.sm,
          fontWeight: n.read ? typography.weight.medium : typography.weight.bold,
          color: colors.text.primary,
          marginBottom: 3,
          paddingRight: n.read ? 0 : spacing.lg,
        }}>
          {n.title}
        </div>
        <div style={{
          fontSize: typography.size.sm,
          color: colors.text.secondary,
          lineHeight: typography.lineHeight.normal,
          marginBottom: spacing.xs,
        }}>
          {n.message}
        </div>
        <div style={{
          fontSize: typography.size.xs,
          color: colors.text.faint,
          display: "flex", alignItems: "center", gap: spacing.xs,
        }}>
          <span>{formatTime(n.createdAt)}</span>
          {n.deepLink && (
            <>
              <span>·</span>
              <span style={{ color: colors.yellow700 }}>Tap to view →</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── TabChip ───────────────────────────────────────────────────────
function TabChip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0,
        padding: `${spacing.xs}px ${spacing.md}px`,
        borderRadius: radius.pill,
        border: active ? "none" : `1px solid ${colors.surface.border}`,
        background: active ? colors.yellow500 : colors.surface.card,
        color: active ? colors.text.onYellow : colors.text.secondary,
        fontSize: typography.size.xs,
        fontWeight: active ? typography.weight.bold : typography.weight.medium,
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "all 0.15s",
        boxShadow: active ? shadows.primary : shadows.xs,
      }}
    >
      {label}
    </button>
  );
}

// ── ChildChip ─────────────────────────────────────────────────────
function ChildChip({ label, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0,
        padding: `${spacing.xs}px ${spacing.sm}px`,
        borderRadius: radius.pill,
        border: selected ? "none" : `1px solid ${colors.surface.border}`,
        background: selected ? colors.brand.gradient : colors.surface.card,
        color: selected ? colors.text.onYellow : colors.text.secondary,
        fontSize: typography.size.xs,
        fontWeight: selected ? typography.weight.bold : typography.weight.medium,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

// ── EmptyState ────────────────────────────────────────────────────
const EMPTY_ICONS = {
  all:           "🔔",
  attendance:    "🏫",
  daily_care:    "☀️",
  memories:      "📸",
  communication: "📢",
  billing:       "💰",
};
const EMPTY_MSG = {
  all:           "No notifications yet. You'll be notified when there are updates for your child.",
  attendance:    "No attendance notifications yet.",
  daily_care:    "No daily care updates yet.",
  memories:      "No new memories yet.",
  communication: "No school communications yet.",
  billing:       "No billing notifications yet.",
};

function EmptyState({ tab }) {
  return (
    <div style={{
      textAlign: "center",
      padding: `${spacing["5xl"]}px ${spacing.xl}px`,
      color: colors.text.muted,
    }}>
      <div style={{ fontSize: 48, marginBottom: spacing.md }}>{EMPTY_ICONS[tab] || "🔔"}</div>
      <div style={{ fontSize: typography.size.sm, lineHeight: typography.lineHeight.relaxed, maxWidth: 280, margin: "0 auto" }}>
        {EMPTY_MSG[tab] || "No notifications here."}
      </div>
    </div>
  );
}
