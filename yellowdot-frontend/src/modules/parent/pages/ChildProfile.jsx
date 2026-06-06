/**
 * ChildProfile.jsx — Parent Module · Phase 1
 * ──────────────────────────────────────────────────────────────────
 * Read-only profile of a single linked child.
 *
 * Data: GET /api/parent/child/:studentId  (ownership enforced server-side)
 * All visuals use centralized theme tokens — no hardcoded colours.
 */

import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import parentService from "../services/parentService";
import { colors, spacing, radius, shadows, typography } from "../theme";

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function ChildProfile() {
  const { studentId } = useParams();
  const [child,   setChild]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    parentService.getChild(studentId)
      .then(data => { if (active) setChild(data.child || null); })
      .catch(e => { if (active) setError(e?.response?.data?.error || "Could not load this child's profile."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [studentId]);

  return (
    <div style={{ padding: spacing.lg, display: "flex", flexDirection: "column", gap: spacing.lg }}>

      {/* Back link */}
      <Link to="/parent-profile" style={{
        ...typography.caption,
        color: colors.yellow700,
        textDecoration: "none",
        display: "inline-flex", alignItems: "center", gap: spacing.xs,
      }}>
        ← Back to profile
      </Link>

      {loading ? (
        <Card><Skeleton /></Card>
      ) : error ? (
        <Card>
          <div style={{
            ...typography.body, color: colors.dangerStrong,
            background: colors.dangerSoft, border: `1px solid ${colors.dangerBorder}`,
            borderRadius: radius.md, padding: spacing.md,
          }}>{error}</div>
        </Card>
      ) : !child ? (
        <Card>
          <p style={{ ...typography.body, color: colors.text.muted, margin: 0 }}>Child not found.</p>
        </Card>
      ) : (
        <>
          {/* Hero */}
          <Card>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: spacing.md }}>
              <div style={{
                width: 88, height: 88, borderRadius: radius.xl,
                background: child.profileImage ? `url(${child.profileImage}) center/cover` : colors.brand.gradient,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 36, fontWeight: typography.weight.extra,
                color: colors.text.onYellow,
                boxShadow: shadows.primary,
              }}>
                {child.profileImage ? "" : (child.studentName || "?").charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 style={{ ...typography.hero, color: colors.text.primary, margin: 0 }}>
                  {child.studentName}
                </h1>
                <p style={{ ...typography.caption, color: colors.text.muted, margin: `${spacing.xs}px 0 0` }}>
                  {child.class || "—"} · Yellow Dot
                </p>
              </div>
              <StatusPill status={child.status} />
            </div>
          </Card>

          {/* Details */}
          <Card>
            <SectionTitle>Details</SectionTitle>
            <DetailRow label="Student ID"     value={child.studentId} />
            <DetailRow label="Class"          value={child.class || "—"} />
            <DetailRow label="Date of birth"  value={fmtDate(child.dob)} />
            <DetailRow label="Gender"         value={child.gender || "—"} />
            <DetailRow label="Admission date" value={fmtDate(child.admissionDate)} />
          </Card>

          {/* Guardians */}
          <Card>
            <SectionTitle>Guardians</SectionTitle>
            <DetailRow label="Father" value={child.fatherName || "—"} />
            <DetailRow label="Mother" value={child.motherName || "—"} />
          </Card>

          {/* Quick link to this child's memories */}
          <Link to={`/parent-memories?child=${child.studentId}`} style={{
            ...typography.button,
            display: "flex", alignItems: "center", justifyContent: "center", gap: spacing.sm,
            padding: spacing.md,
            borderRadius: radius.md,
            background: colors.brand.gradient,
            color: colors.text.onYellow,
            textDecoration: "none",
            boxShadow: shadows.primary,
          }}>
            📸 View memories
          </Link>
        </>
      )}
    </div>
  );
}

// ── Helpers (theme-only) ───────────────────────────────────────────
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

// Positive status uses the ONLY-permitted green; everything else stays neutral.
function StatusPill({ status }) {
  const isActive = String(status).toLowerCase() === "active";
  const fg = isActive ? colors.successStrong : colors.text.secondary;
  const bg = isActive ? colors.successSoft   : colors.gray100;
  const bd = isActive ? colors.successBorder : colors.surface.border;
  return (
    <span style={{
      ...typography.caption,
      color: fg, background: bg, border: `1px solid ${bd}`,
      borderRadius: radius.pill,
      padding: `${spacing.xs}px ${spacing.md}px`,
      fontWeight: typography.weight.bold,
    }}>
      {status || "—"}
    </span>
  );
}

function Skeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: spacing.md }}>
      <div style={{ width: 88, height: 88, borderRadius: radius.xl, background: colors.gray100 }} />
      <div style={{ height: 18, width: "50%", borderRadius: radius.sm, background: colors.gray100 }} />
      <div style={{ height: 12, width: "30%", borderRadius: radius.sm, background: colors.gray100 }} />
    </div>
  );
}
