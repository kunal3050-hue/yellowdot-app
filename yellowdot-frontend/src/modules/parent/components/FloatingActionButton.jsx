/**
 * FloatingActionButton.jsx — reusable circular FAB with a caption label.
 * Fixed bottom-right, floats ABOVE the parent dock (never overlaps nav icons).
 * Yellow Dot styling, soft shadow. Theme tokens only.
 *
 *   <FloatingActionButton icon="☀️" label="Daily Care" onClick={...} />
 */

import { colors, spacing, radius, shadows, typography, layout } from "../theme";

export default function FloatingActionButton({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      style={{
        position: "fixed",
        right: spacing.lg,
        // Float clear of the floating dock (dock height + its offset + a gap).
        bottom: `calc(${layout.safeBottom} + ${layout.dockHeight + 24}px)`,
        zIndex: 60,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
        background: "none", border: "none", padding: 0, cursor: "pointer",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <span style={{
        width: 56, height: 56, borderRadius: radius.pill,
        background: colors.brand.gradient,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 26,
        boxShadow: shadows.primary,
        border: `2px solid ${colors.surface.card}`,
      }}>{icon}</span>
      <span style={{
        ...typography.meta,
        fontWeight: typography.weight.bold,
        color: colors.yellow700,
        background: colors.surface.backgroundTranslucent,
        borderRadius: radius.pill,
        padding: "1px 8px",
      }}>{label}</span>
    </button>
  );
}
