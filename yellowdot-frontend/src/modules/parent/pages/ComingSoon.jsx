/**
 * ComingSoon.jsx — lightweight themed placeholder for not-yet-built phases.
 * Used so V1 dock tabs (e.g. Attendance) never lead to a blank/404 screen.
 */

import { colors, spacing, radius, shadows, typography } from "../theme";

export default function ComingSoon({ title = "Coming soon", emoji = "🌱" }) {
  return (
    <div style={{
      minHeight: "60vh",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: spacing.xl,
      textAlign: "center",
    }}>
      <div style={{
        background: colors.surface.card,
        borderRadius: radius.card,
        boxShadow: shadows.card,
        padding: `${spacing["3xl"]}px ${spacing.xl}px`,
        maxWidth: 360, width: "100%",
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: radius.pill,
          background: colors.brand.gradient,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 30, margin: `0 auto ${spacing.lg}px`,
          boxShadow: shadows.primary,
        }}>{emoji}</div>
        <h2 style={{ ...typography.h2, color: colors.text.primary, margin: `0 0 ${spacing.sm}px` }}>
          {title}
        </h2>
        <p style={{ ...typography.body, color: colors.text.muted, margin: 0 }}>
          This part of the Yellow Dot parent app is on the way. Check back soon!
        </p>
      </div>
    </div>
  );
}
