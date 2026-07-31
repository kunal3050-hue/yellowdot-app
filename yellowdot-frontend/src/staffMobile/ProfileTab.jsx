/**
 * ProfileTab.jsx — Staff mobile profile screen
 * ─────────────────────────────────────────────────────────────────────
 * Staff mobile feed — Parent-style UX plan (2026-07-31).
 *
 * Small, mobile-styled profile screen so all three dock tabs feel native
 * (confirmed decision — not a deep-link-through to the desktop profile
 * page). No new data source: reuses whatever useAuth() already exposes.
 */
import { colors, spacing, radius, shadows, typography } from "../theme/staffMobile";
import { useAuth } from "../contexts/AuthContext";
import { ROLE_LABELS } from "../config/permissions";
import { PLATFORM_NAME } from "../config/environment";

export default function ProfileTab() {
  const { user, role, logout } = useAuth();
  const name = user?.name || "Staff";
  const initial = name.charAt(0).toUpperCase();
  const roleLabel = ROLE_LABELS[role] || role;

  return (
    <div style={{ padding: `${spacing.lg}px ${spacing.lg}px 0` }}>
      <div style={{ ...typography.h1, color: colors.text.primary, marginBottom: spacing.lg }}>
        Profile
      </div>

      <div style={{
        display: "flex", alignItems: "center", gap: spacing.md,
        background: colors.surface.card, borderRadius: radius.card,
        boxShadow: shadows.card, padding: spacing.lg, marginBottom: spacing.lg,
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: "50%",
          background: colors.brand.glowSoft,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 22, fontWeight: typography.weight.bold, color: colors.yellow700,
          flexShrink: 0,
        }}>
          {initial}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ ...typography.title, color: colors.text.primary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {name}
          </div>
          <div style={{ ...typography.caption, color: colors.text.muted, marginTop: 2 }}>
            {roleLabel}
          </div>
          {user?.email && (
            <div style={{ ...typography.meta, color: colors.text.faint, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user.email}
            </div>
          )}
        </div>
      </div>

      <button
        onClick={() => logout("user_initiated")}
        style={{
          width: "100%",
          background: colors.surface.card,
          border: `1px solid ${colors.surface.border}`,
          borderRadius: radius.card,
          padding: spacing.lg,
          textAlign: "left",
          cursor: "pointer",
          ...typography.title,
          color: colors.dangerStrong,
        }}
      >
        Sign out
      </button>

      <div style={{ ...typography.meta, color: colors.text.faint, textAlign: "center", marginTop: spacing["2xl"] }}>
        {PLATFORM_NAME}
      </div>
    </div>
  );
}
