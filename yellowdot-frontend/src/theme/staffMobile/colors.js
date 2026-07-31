/**
 * colors.js — Staff Mobile · color system
 * ─────────────────────────────────────────────────────────────────────
 * Staff mobile feed — Parent-style UX plan (2026-07-31).
 *
 * Values are a deliberate, hand-copied duplicate of
 * `src/modules/parent/theme/colors.ts`, NOT an import. The Parent module
 * is frozen (bug fixes / perf / security only); importing from it would
 * make Staff mobile silently depend on a file nobody is maintaining as a
 * shared surface, and would break the "no file under modules/parent/
 * changed ⇒ Parent is unaffected" verification invariant. Same visual
 * language, zero coupling.
 */

// ── Primary brand ramp — Yellow Dot Yellow ─────────────────────────
export const yellow = {
  yellow50:  "#FFFBEA",
  yellow100: "#FFF4CC",
  yellow200: "#FFEB99",
  yellow300: "#FFE066",
  yellow400: "#FFD42E",
  yellow500: "#F4C400", // ★ PRIMARY
  yellow600: "#D9AE00",
  yellow700: "#B38F00",
};

// ── Neutrals ───────────────────────────────────────────────────────
export const neutral = {
  white:   "#FFFFFF",
  gray50:  "#FAFAF7",
  gray100: "#F4F2EC",
  gray200: "#E8E6DF",
  gray300: "#D4D2CB",
  gray400: "#A8A498",
  gray500: "#78746A",
  gray700: "#3D3A33",
  gray900: "#1F1D18",
  black:   "#111111",
};

// ── Semantic — POSITIVE ─────────────────────────────────────────────
export const success = {
  success:       "#22A06B",
  successStrong: "#15803D",
  successSoft:   "#E8F8EE",
  successBorder: "#A6E2BE",
};

// ── Semantic — DANGER ────────────────────────────────────────────────
export const danger = {
  danger:       "#E5484D",
  dangerStrong: "#B42318",
  dangerSoft:   "#FDECEC",
  dangerBorder: "#F4B5B5",
};

// ── Semantic — WARNING ───────────────────────────────────────────────
export const warning = {
  warning:       "#E8A700",
  warningStrong: "#92400E",
  warningSoft:   "#FFF6DD",
  warningBorder: "#FBE08A",
};

// ── Semantic — INFO ──────────────────────────────────────────────────
export const info = {
  info:       "#2D7FF9",
  infoStrong: "#1D4ED8",
  infoSoft:   "#EAF2FF",
  infoBorder: "#BBD3FF",
};

// ── Surfaces & text ───────────────────────────────────────────────────
export const surface = {
  background:            "#FFFFFF",
  backgroundTranslucent: "rgba(255,255,255,0.92)",
  scrim:                 "rgba(31,29,24,0.92)",
  card:                  neutral.white,
  raised:                neutral.gray50,
  border:                neutral.gray200,
  borderStrong:          neutral.gray300,
};

export const text = {
  primary:   neutral.gray900,
  secondary: neutral.gray700,
  muted:     neutral.gray500,
  faint:     neutral.gray400,
  onYellow:  "#3A2F00",
  onDark:    neutral.white,
};

// ── Brand semantic aliases ────────────────────────────────────────────
export const brand = {
  primary:       yellow.yellow500,
  primaryHover:  yellow.yellow400,
  primaryActive: yellow.yellow600,
  primarySoft:   yellow.yellow100,
  primaryTint:   yellow.yellow50,
  onPrimary:     text.onYellow,
  gradient:      `linear-gradient(135deg, ${yellow.yellow300} 0%, ${yellow.yellow500} 100%)`,
  glow:          "rgba(244,196,0,0.30)",
  glowSoft:      "radial-gradient(ellipse, rgba(244,196,0,0.18) 0%, rgba(244,196,0,0.06) 70%, transparent 100%)",
};

export const colors = {
  ...yellow,
  ...neutral,
  ...success,
  ...danger,
  ...warning,
  ...info,
  surface,
  text,
  brand,
};

export default colors;
