/**
 * ═══════════════════════════════════════════════════════════════════
 * YELLOW DOT — PARENT MODULE · COLOR SYSTEM
 * ═══════════════════════════════════════════════════════════════════
 *
 * Single source of truth for every colour used in the Parent App.
 * Components MUST import from here — never hardcode hex values.
 *
 *   import { colors } from "@/theme";          // via barrel
 *   import { colors } from "../theme/colors";  // direct
 *
 * Brand direction
 * ───────────────
 *   • Primary identity  : Yellow Dot Yellow (yellow500)
 *   • Secondary         : lighter / darker shades of the SAME yellow
 *   • Neutrals          : white, light gray, dark gray (text)
 *   • Green is NOT a primary UI colour. It is reserved exclusively for
 *     positive semantics — success, "Present", payment success, etc.
 *
 * The palette is intentionally warm and cheerful so the app feels like
 * Yellow Dot the instant it opens.
 * ═══════════════════════════════════════════════════════════════════
 */

// ── Primary brand ramp — Yellow Dot Yellow ─────────────────────────
// yellow500 is THE brand colour (matches design-system/theme.js #F4C400).
// Lighter shades (50–400) for tints, backgrounds, highlights.
// Darker shades (600–700) for pressed states, text-on-yellow, depth.
export const yellow = {
  yellow50:  "#FFFBEA", // faint wash — page accents, hover tints
  yellow100: "#FFF4CC", // soft fill — chips, subtle cards
  yellow200: "#FFEB99", // light fill — badges, story rings
  yellow300: "#FFE066", // highlight — gradients, glows
  yellow400: "#FFD42E", // bright — gradient partner to primary
  yellow500: "#F4C400", // ★ PRIMARY — Yellow Dot Yellow
  yellow600: "#D9AE00", // darker — pressed / active
  yellow700: "#B38F00", // deepest — text on light yellow, emphasis
} as const;

// ── Neutrals ───────────────────────────────────────────────────────
// Warm-leaning grays so neutrals never feel cold next to the yellow.
export const neutral = {
  white:   "#FFFFFF",
  gray50:  "#FAFAF7", // warm off-white — app background tint
  gray100: "#F4F2EC", // light gray — surfaces, skeletons
  gray200: "#E8E6DF", // borders, dividers
  gray300: "#D4D2CB", // strong borders, disabled fills
  gray400: "#A8A498", // placeholder, muted icons
  gray500: "#78746A", // muted / tertiary text
  gray700: "#3D3A33", // secondary text
  gray900: "#1F1D18", // dark gray — primary text
  black:   "#111111",
} as const;

// ── Semantic — POSITIVE (green allowed here ONLY) ──────────────────
// Use for success states, Attendance "Present", payment success,
// and other positive indicators. Do NOT use green for primary UI.
export const success = {
  success:       "#22A06B", // primary positive
  successStrong: "#15803D", // text on light success bg
  successSoft:   "#E8F8EE", // success background fill
  successBorder: "#A6E2BE", // success border
} as const;

// ── Semantic — DANGER ──────────────────────────────────────────────
export const danger = {
  danger:       "#E5484D",
  dangerStrong: "#B42318",
  dangerSoft:   "#FDECEC",
  dangerBorder: "#F4B5B5",
} as const;

// ── Semantic — WARNING (warm amber, sits in the yellow family) ─────
export const warning = {
  warning:       "#E8A700",
  warningStrong: "#92400E",
  warningSoft:   "#FFF6DD",
  warningBorder: "#FBE08A",
} as const;

// ── Semantic — INFO (calm blue; for informational highlights only) ─
// Not a primary brand colour — used sparingly to distinguish announcement
// cards in the Smart Highlights carousel from the warm yellow family.
export const info = {
  info:       "#2D7FF9",
  infoStrong: "#1D4ED8",
  infoSoft:   "#EAF2FF",
  infoBorder: "#BBD3FF",
} as const;

// ── Surfaces & text (semantic aliases over the ramps above) ────────
// Prefer these role-based tokens in components for clarity.
export const surface = {
  /** App canvas — pure white for a clean, bright, modern look. */
  background:    "#FFFFFF",
  /** Frosted white for blurred bars (top bar / bottom dock). */
  backgroundTranslucent: "rgba(255,255,255,0.92)",
  /** Dark scrim behind fullscreen overlays (lightbox/modals). */
  scrim:         "rgba(31,29,24,0.92)",
  /** Cards, sheets, bars. */
  card:          neutral.white,
  /** Elevated / nested surfaces. */
  raised:        neutral.gray50,
  /** Hairline borders & dividers. */
  border:        neutral.gray200,
  borderStrong:  neutral.gray300,
} as const;

export const text = {
  primary:   neutral.gray900, // headings, key values
  secondary: neutral.gray700, // body
  muted:     neutral.gray500, // captions, meta
  faint:     neutral.gray400, // placeholders
  onYellow:  "#3A2F00",       // text/icons placed on a yellow fill
  onDark:    neutral.white,   // text on dark surfaces
} as const;

// ── Brand semantic aliases ─────────────────────────────────────────
export const brand = {
  primary:      yellow.yellow500,
  primaryHover: yellow.yellow400,
  primaryActive:yellow.yellow600,
  primarySoft:  yellow.yellow100,
  primaryTint:  yellow.yellow50,
  onPrimary:    text.onYellow,
  /** Signature gradient — used on logo, primary buttons, active states. */
  gradient:     `linear-gradient(135deg, ${yellow.yellow300} 0%, ${yellow.yellow500} 100%)`,
  /** Soft translucent glow for focus rings / haloes. */
  glow:         "rgba(244,196,0,0.30)",
  /** Soft radial halo behind active elements (e.g. active nav tab). */
  glowSoft:     "radial-gradient(ellipse, rgba(244,196,0,0.18) 0%, rgba(244,196,0,0.06) 70%, transparent 100%)",
} as const;

// ── Flat aggregate export ──────────────────────────────────────────
// Everything in one object for ergonomic access: colors.yellow500,
// colors.success, colors.text.primary, colors.brand.gradient, …
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
} as const;

export type Colors = typeof colors;
export default colors;
