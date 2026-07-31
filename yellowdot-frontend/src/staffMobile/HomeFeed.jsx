/**
 * HomeFeed.jsx — Staff Home "what is happening" tab
 * ─────────────────────────────────────────────────────────────────────
 * Staff Home — Parent Home visual language, Staff-owned (2026-07-31).
 *
 * Near-literal mobile re-skin of pages/Dashboard.jsx: consumes
 * useVisibleWidgets()/useWidget() UNCHANGED from platform/widgets — same
 * capability/feature-flag gating, same per-widget error isolation, same
 * data. Only the rendering differs: Parent-Home-style feed cards
 * (FeedCard) instead of a desktop stat grid. No role branch of any kind
 * lives here — every card the signed-in user sees, and what's inside it,
 * is decided entirely by the Widget Engine, exactly as it is for
 * desktop.
 *
 * Greeting/identity area and the holiday highlight below are closer
 * visual matches to Parent Home's greeting header and pinned-holiday
 * card, per direct visual comparison against production Parent Home.
 * The holiday card is deliberately simpler than Parent's — Parent's
 * "Smart Highlights" is a multi-type (holiday/event/announcement/
 * emergency/birthday) rotating carousel backed by its own aggregation;
 * reproducing that is out of scope here. This reuses the single,
 * already-existing, general (not parent-only) GET /api/holidays
 * endpoint via communicationService.getHolidays(), gated by the
 * existing "notifications.view" capability — no new permission or
 * role configuration, no new backend surface.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { colors, spacing, radius, shadows, typography } from "../theme/staffMobile";
import { useVisibleWidgets, useWidget } from "../platform/widgets";
import { useAuth } from "../contexts/AuthContext";
import { ROLE_LABELS } from "../config/permissions";
import communicationService from "../services/communicationService";
import FeedCard from "./components/FeedCard";

const todayISO = () => new Date().toISOString().slice(0, 10);

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** "15 Aug 2026" */
function fmtDate(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** "15 days remaining" / "Tomorrow" / "Today" */
function countdown(startDate) {
  const today = new Date(`${todayISO()}T00:00:00`);
  const start = new Date(`${startDate}T00:00:00`);
  const days = Math.round((start - today) / 86400000);
  if (days > 1) return `${days} days remaining`;
  if (days === 1) return "Tomorrow";
  return "Today";
}

function holidayTile(iso) {
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return { mon: "", day: "" };
  return { mon: d.toLocaleDateString("en-US", { month: "short" }).toUpperCase(), day: String(d.getDate()).padStart(2, "0") };
}

/** The single nearest upcoming holiday — never past, never more than one. */
function NextHoliday() {
  const navigate = useNavigate();
  const { can } = useAuth();
  // Gated the same way the desktop Holidays sidebar link/page actually is
  // (routeKey "holidays", sidebarConfig.js) — NOT the Holidays module's
  // declared "notifications.view" capability, which turned out to be
  // unfulfilled for Teacher in the real seeded role matrix even though
  // Teacher genuinely sees Holidays in their sidebar. That mismatch is a
  // pre-existing registry/role-matrix drift, not something to fix here
  // (fixing it would mean touching role permissions, out of scope for
  // this step) — matching real reachability is the correct, in-scope call.
  // Lazy initializer, not an effect setState, so a role without access
  // never triggers a synchronous setState-in-effect.
  const [holiday, setHoliday] = useState(() => (can("holidays") ? undefined : null));

  useEffect(() => {
    if (!can("holidays")) return;
    let cancelled = false;
    communicationService.getHolidays()
      .then(list => {
        if (cancelled) return;
        const today = todayISO();
        const upcoming = (list || [])
          .filter(h => h.startDate >= today)
          .sort((a, b) => a.startDate.localeCompare(b.startDate));
        setHoliday(upcoming[0] || null);
      })
      .catch(() => { if (!cancelled) setHoliday(null); });
    return () => { cancelled = true; };
  }, [can]);

  if (!holiday) return null;
  const tile = holidayTile(holiday.startDate);

  return (
    <div
      onClick={() => navigate("/holidays")}
      role="button" tabIndex={0}
      style={{
        cursor: "pointer", display: "flex", alignItems: "center", gap: spacing.md,
        background: colors.surface.card, borderRadius: radius.card, boxShadow: shadows.card,
        border: `1px solid ${colors.surface.border}`,
        padding: spacing.lg, marginBottom: spacing.lg,
      }}
    >
      <div style={{
        width: 46, height: 46, borderRadius: radius.md, flexShrink: 0,
        background: colors.yellow100, border: `1px solid ${colors.yellow200}`,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", lineHeight: 1,
      }}>
        <span style={{ fontSize: 9, fontWeight: typography.weight.bold, color: colors.yellow700 }}>{tile.mon}</span>
        <span style={{ fontSize: 15, fontWeight: typography.weight.extra, color: colors.yellow700 }}>{tile.day}</span>
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ ...typography.meta, fontWeight: typography.weight.bold, color: colors.yellow700, textTransform: "uppercase", letterSpacing: typography.tracking.wide }}>
          Holiday
        </div>
        <div style={{ ...typography.title, color: colors.text.primary, marginTop: 1 }}>{holiday.title}</div>
        <div style={{ ...typography.caption, color: colors.text.muted, marginTop: 1 }}>
          {fmtDate(holiday.startDate)} · {countdown(holiday.startDate)}
        </div>
      </div>
    </div>
  );
}

function WidgetCard({ widget }) {
  const navigate = useNavigate();
  const { loading, error, view } = useWidget(widget);

  if (loading) {
    return (
      <div style={{
        height: 76, borderRadius: 20, background: colors.surface.raised,
        opacity: 0.6,
      }} />
    );
  }

  const subtitle = error ? "Couldn't load right now" : (view?.sub || widget.description);
  const meta = error ? "—" : (view?.value ?? "—");
  const tone = error ? "neutral" : (view?.tone || "neutral");

  return (
    <FeedCard
      icon={widget.icon}
      tone={tone}
      title={widget.title}
      subtitle={subtitle}
      meta={meta}
      onClick={widget.destination ? () => navigate(widget.destination) : undefined}
    />
  );
}

export default function HomeFeed() {
  const widgets = useVisibleWidgets();
  const { user, role } = useAuth();
  const firstName = (user?.name || "").split(" ")[0];
  const roleLabel = ROLE_LABELS[role] || role;

  return (
    <div style={{ padding: `${spacing.lg}px ${spacing.lg}px 0` }}>
      <div style={{ marginBottom: spacing.lg }}>
        <div style={{ ...typography.caption, color: colors.text.muted }}>
          {greeting()}{firstName ? `, ${firstName}` : ""} 👋
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
          <div style={{ ...typography.hero, color: colors.text.primary }}>Your day</div>
          {roleLabel && (
            <span style={{
              ...typography.meta, fontWeight: typography.weight.bold,
              color: colors.yellow700, background: colors.brand.primaryTint,
              border: `1px solid ${colors.brand.primarySoft}`,
              borderRadius: radius.pill, padding: "3px 10px",
            }}>
              {roleLabel}
            </span>
          )}
        </div>
      </div>

      <NextHoliday />

      {widgets.length === 0 ? (
        <div style={{
          padding: spacing["2xl"], textAlign: "center",
          border: `1px dashed ${colors.surface.border}`, borderRadius: 20,
          color: colors.text.muted,
        }}>
          <div style={{ ...typography.title, marginBottom: 4 }}>Nothing to show here yet</div>
          <div style={{ ...typography.caption }}>Your account doesn't have access to any dashboard insights.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
          {widgets.map(w => <WidgetCard key={w.id} widget={w} />)}
        </div>
      )}
    </div>
  );
}
