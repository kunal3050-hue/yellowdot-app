/**
 * HomeFeed.jsx — Staff mobile "what is happening" feed
 * ─────────────────────────────────────────────────────────────────────
 * Staff mobile feed — Parent-style UX plan (2026-07-31).
 *
 * Near-literal mobile re-skin of pages/Dashboard.jsx: consumes
 * useVisibleWidgets()/useWidget() UNCHANGED from platform/widgets — same
 * capability/feature-flag gating, same per-widget error isolation, same
 * data. Only the rendering differs: Parent-style feed cards (FeedCard)
 * instead of a desktop stat grid. No role branch of any kind lives here
 * — every card the signed-in user sees, and what's inside it, is decided
 * entirely by the Widget Engine, exactly as it is for desktop.
 */
import { useNavigate } from "react-router-dom";
import { colors, spacing, typography } from "../theme/staffMobile";
import { useVisibleWidgets, useWidget } from "../platform/widgets";
import { useAuth } from "../contexts/AuthContext";
import FeedCard from "./components/FeedCard";

const todayLabel = () =>
  new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
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
  const { user } = useAuth();
  const firstName = (user?.name || "").split(" ")[0];

  return (
    <div style={{ padding: `${spacing.lg}px ${spacing.lg}px 0` }}>
      <div style={{ marginBottom: spacing.lg }}>
        <div style={{ ...typography.h1, color: colors.text.primary }}>
          {greeting()}{firstName ? `, ${firstName}` : ""}
        </div>
        <div style={{ ...typography.caption, color: colors.text.muted, marginTop: 2 }}>
          {todayLabel()}
        </div>
      </div>

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
