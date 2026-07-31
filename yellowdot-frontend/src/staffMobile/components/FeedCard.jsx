/**
 * FeedCard.jsx — shared feed-row anatomy for the Staff mobile experience
 * ─────────────────────────────────────────────────────────────────────
 * Staff mobile feed — Parent-style UX plan (2026-07-31).
 *
 * Purely presentational — a render helper local to `staffMobile/`, not a
 * new architectural layer. Mirrors the card anatomy Parent's HomeFeed.jsx
 * uses inline (icon tile + title + subtitle + meta), built from the
 * Staff-owned `theme/staffMobile` tokens so it's visually identical to
 * Parent without importing anything from `modules/parent/`.
 */
import { colors, spacing, radius, shadows, typography } from "../../theme/staffMobile";

const TONE_BG = {
  neutral: colors.surface.raised,
  good:    colors.successSoft,
  warn:    colors.warningSoft,
  bad:     colors.dangerSoft,
};
const TONE_FG = {
  neutral: colors.text.secondary,
  good:    colors.successStrong,
  warn:    colors.warningStrong,
  bad:     colors.dangerStrong,
};

export default function FeedCard({ icon: Icon, tone = "neutral", title, subtitle, meta, onClick }) {
  const clickable = typeof onClick === "function";

  return (
    <div
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={e => { if (clickable && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onClick(); } }}
      style={{
        display: "flex", alignItems: "center", gap: spacing.md,
        background: colors.surface.card,
        borderRadius: radius.card,
        boxShadow: shadows.card,
        padding: spacing.lg,
        cursor: clickable ? "pointer" : "default",
      }}
    >
      {Icon && (
        <span style={{
          flexShrink: 0,
          width: 44, height: 44, borderRadius: radius.md,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: TONE_BG[tone] || TONE_BG.neutral,
          color: TONE_FG[tone] || TONE_FG.neutral,
        }}>
          <Icon size={20} strokeWidth={1.8} />
        </span>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...typography.title, color: colors.text.primary }}>{title}</div>
        {subtitle && (
          <div style={{
            ...typography.caption, color: colors.text.muted,
            marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {subtitle}
          </div>
        )}
      </div>

      {meta && (
        <span style={{ ...typography.meta, color: colors.text.faint, flexShrink: 0, textAlign: "right" }}>
          {meta}
        </span>
      )}

      {clickable && (
        <span style={{ color: colors.text.faint, fontSize: 16, flexShrink: 0 }}>›</span>
      )}
    </div>
  );
}
