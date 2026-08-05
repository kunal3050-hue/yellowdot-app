/**
 * ProfileTab.jsx — Staff mobile profile screen
 * ─────────────────────────────────────────────────────────────────────
 * Staff mobile feed — Parent-style UX plan (2026-07-31).
 * Phase 2 (2026-08-05): enriched to Parent ParentProfile.jsx's own depth —
 * which is itself fully read-only, so this isn't a lower bar than Parent,
 * it's the same one. No edit form: desktop's own Profile.jsx/
 * SecuritySettings.jsx save handlers are unwired stubs today, so building
 * real self-edit here would mean shipping a new backend endpoint just for
 * mobile — out of scope. Contact/Centers use only fields useAuth() already
 * exposes (zero new fetches); "Account & Security" deep-links to the
 * existing desktop /profile page — same "tap → existing desktop screen"
 * pattern every Care tile already uses.
 *
 * Deliberately NOT /settings/security: live-tested as Teacher and found
 * Access Restricted there (routeKey "settings" isn't granted below
 * admin/center_owner tiers — a real, pre-existing gap between what
 * Profile.jsx links to and what its own routeKey allows, out of scope to
 * fix since it means touching role permissions). /profile itself is
 * reachable for every role, shows the same account fields, and carries
 * its own Password & Security link from there.
 */
import { useNavigate } from "react-router-dom";
import { ShieldCheck, Phone, Mail, Building2 } from "lucide-react";
import { colors, spacing, radius, shadows, typography } from "../theme/staffMobile";
import { useAuth } from "../contexts/AuthContext";
import { ROLE_LABELS } from "../config/permissions";
import { PLATFORM_NAME } from "../config/environment";

function Row({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: spacing.md, padding: `${spacing.md}px 0` }}>
      <span style={{
        width: 34, height: 34, borderRadius: radius.md, flexShrink: 0,
        background: colors.yellow100, border: `1px solid ${colors.yellow200}`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon size={16} strokeWidth={1.8} color={colors.yellow700} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ ...typography.meta, color: colors.text.faint }}>{label}</div>
        <div style={{ ...typography.caption, fontWeight: typography.weight.semibold, color: colors.text.primary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {value}
        </div>
      </div>
    </div>
  );
}

export default function ProfileTab() {
  const navigate = useNavigate();
  const { user, role, logout } = useAuth();
  const name = user?.name || "Staff";
  const initial = name.charAt(0).toUpperCase();
  const roleLabel = ROLE_LABELS[role] || role;
  const centers = Array.isArray(user?.centers) ? user.centers : [];
  const centerNames = centers.map(c => (typeof c === "string" ? c : c?.name || c?.label)).filter(Boolean);

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

      <div style={{
        background: colors.surface.card, borderRadius: radius.card,
        boxShadow: shadows.card, padding: `0 ${spacing.lg}px`, marginBottom: spacing.lg,
      }}>
        <Row icon={Phone} label="Mobile" value={user?.mobile} />
        <Row icon={Mail} label="Email" value={user?.email} />
        <Row icon={Building2} label="Active Center" value={user?.activeCenter} />
        {centerNames.length > 1 && (
          <Row icon={Building2} label="Assigned Centers" value={centerNames.join(", ")} />
        )}
      </div>

      <button
        onClick={() => navigate("/profile")}
        style={{
          width: "100%",
          display: "flex", alignItems: "center", gap: spacing.md,
          background: colors.surface.card,
          border: `1px solid ${colors.surface.border}`,
          borderRadius: radius.card,
          padding: spacing.lg,
          textAlign: "left",
          cursor: "pointer",
          marginBottom: spacing.sm,
        }}
      >
        <span style={{
          width: 34, height: 34, borderRadius: radius.md, flexShrink: 0,
          background: colors.yellow100, border: `1px solid ${colors.yellow200}`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <ShieldCheck size={16} strokeWidth={1.8} color={colors.yellow700} />
        </span>
        <span style={{ ...typography.title, color: colors.text.primary, flex: 1 }}>Account & Security</span>
        <span style={{ color: colors.text.faint, fontSize: 16 }}>›</span>
      </button>

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
