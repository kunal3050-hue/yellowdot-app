/**
 * HomeFeed.jsx — Parent Module · Phase 2
 * ──────────────────────────────────────────────────────────────────
 * An Instagram-style parent feed. Beautiful, simple, Yellow Dot.
 *
 * Three card types only:
 *   • announcement — general school updates
 *   • activity     — what the children did
 *   • event        — dated happenings (holidays, special days)
 *
 * No likes, comments, chat, CCTV, or notifications. Pure content.
 * Data: GET /api/parent/feed (via useParentFeed). Theme tokens only.
 */

import { Link } from "react-router-dom";
import { useAuth } from "../../../contexts/AuthContext";
import useParentFeed from "../hooks/useParentFeed";
import DailyCareLauncher from "../components/DailyCareLauncher";
import { colors, spacing, radius, shadows, typography } from "../theme";

// ── Per-type presentation (all within the Yellow identity) ─────────
const TYPE_META = {
  announcement: { emoji: "📢", label: "Announcement", tint: colors.yellow50  },
  activity:     { emoji: "🎨", label: "Activity",     tint: colors.yellow100 },
  event:        { emoji: "📅", label: "Event",        tint: colors.yellow200 },
};

function fmtWhen(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function HomeFeed() {
  const { user } = useAuth();
  const { feed, loading, error } = useParentFeed();

  const firstName = (user?.name || "").trim().split(" ")[0];

  return (
    <div style={{ padding: spacing.lg, display: "flex", flexDirection: "column", gap: spacing.lg }}>

      {/* ── Greeting header ─────────────────────────────────────────── */}
      <header style={{
        padding: `${spacing.xs}px ${spacing.xs}px 0`,
        display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.md,
      }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ ...typography.caption, color: colors.text.muted, margin: 0 }}>
            {greeting()}{firstName ? `, ${firstName}` : ""} 👋
          </p>
          <h1 style={{ ...typography.h1, color: colors.text.primary, margin: `${spacing.xs}px 0 0` }}>
            Today at Yellow Dot
          </h1>
        </div>
        <Link to="/parent-memories" style={{
          ...typography.caption,
          flexShrink: 0,
          display: "inline-flex", alignItems: "center", gap: spacing.xs,
          padding: `${spacing.sm}px ${spacing.md}px`,
          borderRadius: radius.pill,
          background: colors.surface.card,
          border: `1px solid ${colors.surface.border}`,
          boxShadow: shadows.sm,
          color: colors.yellow700, fontWeight: typography.weight.bold,
          textDecoration: "none",
        }}>📸 Memories</Link>
      </header>

      {/* ── Feed ────────────────────────────────────────────────────── */}
      {loading ? (
        <>{[0, 1, 2].map(i => <CardSkeleton key={i} />)}</>
      ) : error ? (
        <ErrorNote message={error} />
      ) : feed.length === 0 ? (
        <EmptyState />
      ) : (
        feed.map(item => <FeedCard key={`${item.type}-${item.id}`} item={item} />)
      )}

      {/* Floating Daily Care launcher (FAB + bottom sheet) */}
      <DailyCareLauncher />
    </div>
  );
}

// ── Feed card ──────────────────────────────────────────────────────
function FeedCard({ item }) {
  const meta = TYPE_META[item.type] || TYPE_META.announcement;

  return (
    <article style={{
      background: colors.surface.card,
      borderRadius: radius.card,
      boxShadow: shadows.card,
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: spacing.md, padding: spacing.lg }}>
        <div style={{
          width: 44, height: 44, borderRadius: radius.md,
          background: meta.tint,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 22, flexShrink: 0,
          border: `1px solid ${colors.surface.border}`,
        }}>{meta.emoji}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...typography.caption, color: colors.yellow700, fontWeight: typography.weight.bold }}>
            {item.tag || meta.label}
          </div>
          <div style={{ ...typography.meta, color: colors.text.faint }}>
            {fmtWhen(item.date)}
          </div>
        </div>
      </div>

      {/* Image (announcements / activities may carry media) */}
      {item.image ? (
        <img
          src={item.image}
          alt=""
          style={{ width: "100%", maxHeight: 320, objectFit: "cover", display: "block" }}
        />
      ) : null}

      {/* Body */}
      <div style={{ padding: spacing.lg, paddingTop: item.image ? spacing.lg : 0 }}>
        {item.title ? (
          <h2 style={{ ...typography.h2, color: colors.text.primary, margin: `0 0 ${spacing.sm}px` }}>
            {item.title}
          </h2>
        ) : null}
        {item.body ? (
          <p style={{ ...typography.body, color: colors.text.secondary, margin: 0, whiteSpace: "pre-wrap" }}>
            {item.body}
          </p>
        ) : null}
      </div>
    </article>
  );
}

// ── States ─────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div style={{
      background: colors.surface.card,
      borderRadius: radius.card,
      boxShadow: shadows.card,
      padding: `${spacing["3xl"]}px ${spacing.xl}px`,
      textAlign: "center",
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: radius.pill,
        background: colors.brand.gradient,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 30, margin: `0 auto ${spacing.lg}px`,
        boxShadow: shadows.primary,
      }}>🌼</div>
      <h2 style={{ ...typography.h2, color: colors.text.primary, margin: `0 0 ${spacing.sm}px` }}>
        Nothing here yet
      </h2>
      <p style={{ ...typography.body, color: colors.text.muted, margin: 0 }}>
        Announcements, activities and events from school will appear here.
      </p>
    </div>
  );
}

function ErrorNote({ message }) {
  return (
    <div style={{
      ...typography.body,
      color: colors.dangerStrong,
      background: colors.dangerSoft,
      border: `1px solid ${colors.dangerBorder}`,
      borderRadius: radius.md,
      padding: spacing.lg,
    }}>
      {message}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div style={{
      background: colors.surface.card,
      borderRadius: radius.card,
      boxShadow: shadows.card,
      padding: spacing.lg,
    }}>
      <div style={{ display: "flex", gap: spacing.md, marginBottom: spacing.lg }}>
        <div style={{ width: 44, height: 44, borderRadius: radius.md, background: colors.gray100 }} />
        <div style={{ flex: 1 }}>
          <div style={{ height: 12, width: "40%", borderRadius: radius.sm, background: colors.gray100, marginBottom: spacing.sm }} />
          <div style={{ height: 10, width: "25%", borderRadius: radius.sm, background: colors.gray100 }} />
        </div>
      </div>
      <div style={{ height: 14, width: "70%", borderRadius: radius.sm, background: colors.gray100, marginBottom: spacing.sm }} />
      <div style={{ height: 11, width: "95%", borderRadius: radius.sm, background: colors.gray100, marginBottom: spacing.xs }} />
      <div style={{ height: 11, width: "85%", borderRadius: radius.sm, background: colors.gray100 }} />
    </div>
  );
}
