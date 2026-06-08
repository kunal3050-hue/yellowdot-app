/**
 * ParentProfile.jsx — Parent Module · Phase 1
 * ──────────────────────────────────────────────────────────────────
 * The parent's own profile + their linked children. Tapping a child
 * opens the Child Profile screen.
 *
 * Data: GET /api/parent/me  (via useParentProfile)
 * All visuals use centralized theme tokens — no hardcoded colours.
 */

import { Link } from "react-router-dom";
import { useAuth } from "../../../contexts/AuthContext";
import useParentProfile from "../hooks/useParentProfile";
import { colors, spacing, radius, shadows, typography } from "../theme";

const RELATION_LABEL = { father: "Father", mother: "Mother", guardian: "Guardian" };

export default function ParentProfile() {
  const { logout } = useAuth();
  const { parent, children, loading, error } = useParentProfile();

  return (
    <div style={{ padding: spacing.lg, display: "flex", flexDirection: "column", gap: spacing.lg }}>

      {/* ── Parent header ─────────────────────────────────────────── */}
      <Card>
        {loading ? (
          <SkeletonRow />
        ) : error ? (
          <ErrorNote message={error} />
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: spacing.lg }}>
            <Avatar name={parent?.name} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ ...typography.h1, color: colors.text.primary, margin: 0 }}>
                {parent?.name || "Parent"}
              </h1>
              <p style={{ ...typography.caption, color: colors.text.muted, margin: `${spacing.xs}px 0 0` }}>
                {RELATION_LABEL[parent?.relation] || "Guardian"}
                {parent?.email ? ` · ${parent.email}` : ""}
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* ── Contact details ───────────────────────────────────────── */}
      {!loading && !error && parent && (
        <Card>
          <SectionTitle>Contact</SectionTitle>
          <DetailRow label="Email" value={parent.email || "—"} />
          <DetailRow label="Phone" value={parent.phone || "—"} />
          <DetailRow label="School" value={parent.schoolId || "—"} />
        </Card>
      )}

      {/* ── Children ──────────────────────────────────────────────── */}
      <Card>
        <SectionTitle>{children.length > 1 ? "My Children" : "My Child"}</SectionTitle>
        {loading ? (
          <SkeletonRow />
        ) : children.length === 0 ? (
          <p style={{ ...typography.body, color: colors.text.muted, margin: 0 }}>
            No child is linked to your account yet.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
            {children.map(child => (
              <Link
                key={child.studentId}
                to={`/parent-child/${child.studentId}`}
                style={{
                  display: "flex", alignItems: "center", gap: spacing.md,
                  padding: spacing.md,
                  borderRadius: radius.md,
                  background: colors.surface.raised,
                  textDecoration: "none",
                  border: `1px solid ${colors.surface.border}`,
                }}
              >
                <Avatar name={child.studentName} small image={child.profileImage} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...typography.title, color: colors.text.primary }}>
                    {child.studentName}
                  </div>
                  <div style={{ ...typography.caption, color: colors.text.muted }}>
                    {child.class || "—"}
                  </div>
                </div>
                <Chevron />
              </Link>
            ))}
          </div>
        )}
      </Card>

      {/* ── Sign out ──────────────────────────────────────────────── */}
      <button
        onClick={() => logout()}
        style={{
          ...typography.button,
          width: "100%",
          padding: `${spacing.md}px`,
          borderRadius: radius.md,
          border: `1px solid ${colors.danger}`,
          background: colors.surface.card,
          color: colors.dangerStrong,
          cursor: "pointer",
        }}
      >
        Sign out
      </button>
    </div>
  );
}

// ── Small presentational helpers (theme-only) ──────────────────────
function Card({ children }) {
  return (
    <div style={{
      background: colors.surface.card,
      borderRadius: radius.card,
      boxShadow: shadows.card,
      padding: spacing.lg,
    }}>{children}</div>
  );
}

function SectionTitle({ children }) {
  return (
    <h2 style={{
      ...typography.caption,
      textTransform: "uppercase",
      letterSpacing: typography.tracking.wider,
      color: colors.text.muted,
      margin: `0 0 ${spacing.md}px`,
    }}>{children}</h2>
  );
}

function DetailRow({ label, value }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", gap: spacing.md,
      padding: `${spacing.sm}px 0`,
      borderBottom: `1px solid ${colors.surface.border}`,
    }}>
      <span style={{ ...typography.body, color: colors.text.muted }}>{label}</span>
      <span style={{ ...typography.body, color: colors.text.primary, fontWeight: typography.weight.semibold, textAlign: "right" }}>
        {value}
      </span>
    </div>
  );
}

function Avatar({ name, small, image }) {
  const size = small ? 44 : 60;
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: radius.lg,
      background: image ? `url(${image}) center/cover` : colors.brand.gradient,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: small ? 18 : 24, fontWeight: typography.weight.extra,
      color: colors.text.onYellow, flexShrink: 0,
      boxShadow: shadows.sm,
    }}>
      {image ? "" : initial}
    </div>
  );
}

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none"
      stroke={colors.text.faint} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function SkeletonRow() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: spacing.md }}>
      <div style={{ width: 48, height: 48, borderRadius: radius.lg, background: colors.gray100 }} />
      <div style={{ flex: 1 }}>
        <div style={{ height: 14, width: "55%", borderRadius: radius.sm, background: colors.gray100, marginBottom: spacing.sm }} />
        <div style={{ height: 11, width: "35%", borderRadius: radius.sm, background: colors.gray100 }} />
      </div>
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
      padding: spacing.md,
    }}>
      {message}
    </div>
  );
}
