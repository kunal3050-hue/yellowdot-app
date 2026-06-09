/**
 * DailyCare.jsx — Parent Module · Daily Care Hub (full screen)
 * ──────────────────────────────────────────────────────────────────
 * The central parent hub. Child selector at top (future-ready), then a grid
 * of daily-care modules.
 *
 *   Active:      📅 Attendance  → /parent-attendance
 *   Coming Soon: 😴 Nap Tracker · 🍽️ Food Menu · 🍎 Consumption Log
 *
 * Future modules (Mood / Water / Toilet / Medication) are intentionally NOT
 * shown yet — add them to MODULES when built.
 * Theme tokens only — no hardcoded colours.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import useParentProfile from "../hooks/useParentProfile";
import { colors, spacing, radius, shadows, typography } from "../theme";

const MODULES = [
  // Active
  { emoji: "📅", label: "Attendance",      to: "/parent-attendance", active: true },
  { emoji: "📸", label: "Memories",        to: "/parent-memories",   active: true },
  { emoji: "💳", label: "Fees",            to: "/parent-fees",       active: true },
  { emoji: "🍽️", label: "Food Menu",       to: "/parent-food-menu",   active: true },
  { emoji: "🍎", label: "Consumption Log", to: "/parent-consumption", active: true },
  { emoji: "😴", label: "Nap Tracker",     to: "/parent-nap",         active: true },
  { emoji: "📅", label: "Holidays",        to: "/parent-holidays",    active: true },
];

export default function DailyCare() {
  const { children } = useParentProfile();
  const [activeId, setActiveId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!activeId && children.length) setActiveId(children[0].studentId);
  }, [children, activeId]);

  return (
    <div style={{ padding: spacing.lg, display: "flex", flexDirection: "column", gap: spacing.lg }}>

      <header style={{ padding: `${spacing.xs}px ${spacing.xs}px 0` }}>
        <h1 style={{ ...typography.h1, color: colors.text.primary, margin: 0 }}>Daily Care</h1>
        <p style={{ ...typography.caption, color: colors.text.muted, margin: `${spacing.xs}px 0 0` }}>
          Everything about your child's day ☀️
        </p>
      </header>

      {/* Child selector (future-ready: switcher when multi-child, chip when single) */}
      <ChildSelector children={children} activeId={activeId} onSelect={setActiveId} />

      {/* Module grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: spacing.md }}>
        {MODULES.map(m => (
          <ModuleCard key={m.label} module={m} onOpen={() => m.active && m.to && navigate(m.to)} />
        ))}
      </div>
    </div>
  );
}

// ── Child selector ──────────────────────────────────────────────────
function ChildSelector({ children, activeId, onSelect }) {
  if (!children.length) return null;
  const active = children.find(c => c.studentId === activeId) || children[0];

  // Single child → static chip. Multi-child → pill switcher.
  if (children.length === 1) {
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: spacing.md,
        background: colors.surface.card, borderRadius: radius.card,
        boxShadow: shadows.card, padding: spacing.md,
      }}>
        <Avatar name={active.studentName} image={active.profileImage} />
        <div>
          <div style={{ ...typography.title, color: colors.text.primary }}>{active.studentName}</div>
          <div style={{ ...typography.caption, color: colors.text.muted }}>{active.class || "—"}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: spacing.sm, overflowX: "auto", paddingBottom: spacing.xs }}>
      {children.map(c => {
        const sel = c.studentId === activeId;
        return (
          <button key={c.studentId} onClick={() => onSelect(c.studentId)} style={{
            ...typography.caption, flexShrink: 0,
            padding: `${spacing.sm}px ${spacing.lg}px`, borderRadius: radius.pill, cursor: "pointer",
            fontWeight: typography.weight.bold,
            color: sel ? colors.text.onYellow : colors.text.secondary,
            background: sel ? colors.brand.gradient : colors.surface.card,
            border: `1px solid ${sel ? "transparent" : colors.surface.border}`,
            boxShadow: sel ? shadows.primary : "none",
          }}>
            {(c.studentName || "").split(" ")[0] || c.studentId}
          </button>
        );
      })}
    </div>
  );
}

// ── Module card ─────────────────────────────────────────────────────
function ModuleCard({ module, onOpen }) {
  const { emoji, label, active } = module;
  return (
    <button
      onClick={onOpen}
      disabled={!active}
      style={{
        position: "relative",
        display: "flex", flexDirection: "column", alignItems: "flex-start", gap: spacing.sm,
        minHeight: 132,
        padding: spacing.lg,
        borderRadius: radius.card,
        background: active ? colors.surface.card : colors.surface.raised,
        border: `1px solid ${active ? colors.yellow200 : colors.surface.border}`,
        boxShadow: active ? shadows.card : "none",
        cursor: active ? "pointer" : "default",
        opacity: active ? 1 : 0.7,
        textAlign: "left",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <span style={{
        width: 48, height: 48, borderRadius: radius.md,
        background: active ? colors.yellow100 : colors.gray100,
        border: `1px solid ${active ? colors.yellow200 : colors.surface.border}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 24,
        filter: active ? "none" : "grayscale(0.4)",
      }}>{emoji}</span>

      <span style={{ ...typography.title, color: active ? colors.text.primary : colors.text.secondary }}>
        {label}
      </span>

      {active ? (
        <span style={{ ...typography.meta, color: colors.yellow700, fontWeight: typography.weight.bold, display: "inline-flex", alignItems: "center", gap: 4 }}>
          Open
          <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke={colors.yellow700} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
        </span>
      ) : (
        <span style={{
          ...typography.meta, fontWeight: typography.weight.bold,
          color: colors.text.muted, background: colors.gray100,
          border: `1px solid ${colors.surface.border}`,
          borderRadius: radius.pill, padding: `2px ${spacing.sm}px`,
        }}>Coming Soon</span>
      )}
    </button>
  );
}

function Avatar({ name, image }) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  return (
    <div style={{
      width: 44, height: 44, borderRadius: radius.lg, flexShrink: 0,
      background: image ? `url(${image}) center/cover` : colors.brand.gradient,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 18, fontWeight: typography.weight.extra, color: colors.text.onYellow,
    }}>{image ? "" : initial}</div>
  );
}
