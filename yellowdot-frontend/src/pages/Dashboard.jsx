/**
 * Dashboard.jsx — "What is happening?"
 * ─────────────────────────────────────────────────────────────────────
 * PLATFORM ARCHITECTURE §6 — docs/platform-architecture/PLATFORM_ARCHITECTURE.md
 *
 * Insights only. No mutations. Every tile deep-links into the module that owns
 * the data (§8: Dashboard = see, Care = do).
 *
 * This file holds NO list of widgets and no per-role logic. It renders whatever
 * the Widget Engine resolves for the current user, which is what makes adding a
 * widget a one-entry change in platform/widgets/widgets.js. If a role check or
 * a widget id ever appears in this file, the architecture has been bypassed.
 */
import { useNavigate } from "react-router-dom";
import { PageHeader, Skeleton } from "../components/ui";
import { useVisibleWidgets, useWidget } from "../platform/widgets";
import { usePermissions } from "../platform/permissions/usePermissions";
import { useAuth } from "../contexts/AuthContext";

const todayLabel = () =>
  new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

function greeting() {
  const h = new Date().getHours();
  if (h < 12)  return "Good morning";
  if (h < 17)  return "Good afternoon";
  return "Good evening";
}

const TONE_COLOR = {
  good:    "var(--yd-success, #059669)",
  warn:    "var(--yd-warning, #D97706)",
  bad:     "var(--yd-danger,  #DC2626)",
  neutral: "var(--yd-charcoal, #1F1F1F)",
};

/** One tile. Layout comes from the descriptor, never from this component. */
function WidgetTile({ widget }) {
  const navigate = useNavigate();
  const { loading, error, view } = useWidget(widget);
  const Icon = widget.icon;

  const clickable = Boolean(widget.destination);
  const open = () => { if (clickable) navigate(widget.destination); };

  return (
    <div
      onClick={open}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={e => { if (clickable && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); open(); } }}
      style={{
        background: "var(--yd-surface, #fff)",
        border: "1px solid var(--yd-border-light, #EFE7D2)",
        borderRadius: 16,
        padding: "18px 20px",
        cursor: clickable ? "pointer" : "default",
        display: "flex", flexDirection: "column", gap: 10, minHeight: 128,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {Icon && (
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 32, height: 32, borderRadius: 10,
            background: "var(--yd-bg, #FFFDF7)", color: "var(--yd-charcoal, #1F1F1F)",
          }}>
            <Icon size={17} />
          </span>
        )}
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--yd-text-muted, #6B7280)" }}>
          {widget.title}
        </span>
      </div>

      {loading ? (
        <Skeleton width="60%" height={30} />
      ) : error ? (
        // Per-widget failure: this tile degrades, the page does not.
        <>
          <div style={{ fontSize: 26, fontWeight: 700, color: "var(--yd-text-muted, #6B7280)" }}>—</div>
          <div style={{ fontSize: 12, color: "var(--yd-text-muted, #6B7280)" }}>Couldn’t load right now</div>
        </>
      ) : (
        <>
          <div style={{
            fontSize: 28, fontWeight: 700, lineHeight: 1.1,
            color: TONE_COLOR[view?.tone] || TONE_COLOR.neutral,
          }}>
            {view?.value ?? "—"}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--yd-text-muted, #6B7280)" }}>
            {view?.sub || widget.description}
          </div>
        </>
      )}
    </div>
  );
}

export default function Dashboard() {
  const widgets = useVisibleWidgets();
  const { user } = useAuth();
  const { featuresFromServer } = usePermissions();

  const firstName = (user?.name || "").split(" ")[0];

  return (
    <div style={{ padding: "8px 4px 32px" }}>
      <PageHeader
        title={`${greeting()}${firstName ? `, ${firstName}` : ""}`}
        subtitle={todayLabel()}
      />

      {widgets.length === 0 ? (
        // A real empty state, not a spinner that never resolves. Reaching this
        // means every widget was filtered out by capability or feature flag.
        <div style={{
          marginTop: 24, padding: "32px 24px", textAlign: "center",
          border: "1px dashed var(--yd-border-light, #EFE7D2)", borderRadius: 16,
          color: "var(--yd-text-muted, #6B7280)",
        }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Nothing to show here yet</div>
          <div style={{ fontSize: 13 }}>
            Your account doesn’t have access to any dashboard insights.
          </div>
        </div>
      ) : (
        <div style={{
          marginTop: 20,
          display: "grid",
          gap: 14,
          gridTemplateColumns: "repeat(auto-fill, minmax(232px, 1fr))",
        }}>
          {widgets.map(w => <WidgetTile key={w.id} widget={w} />)}
        </div>
      )}

      {import.meta.env.DEV && (
        <div style={{ marginTop: 20, fontSize: 11, color: "var(--yd-text-muted, #9CA3AF)" }}>
          {widgets.length} widget(s) · flags {featuresFromServer ? "from server" : "from bundle"}
        </div>
      )}
    </div>
  );
}
