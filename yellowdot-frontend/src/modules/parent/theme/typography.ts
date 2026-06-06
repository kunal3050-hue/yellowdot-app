/**
 * ═══════════════════════════════════════════════════════════════════
 * YELLOW DOT — PARENT MODULE · TYPOGRAPHY
 * ═══════════════════════════════════════════════════════════════════
 *
 * Friendly, rounded, highly legible type for a warm parent experience.
 * Components MUST reference these tokens instead of hardcoding fonts,
 * sizes or weights.
 *
 *   import { typography } from "@/theme";
 *   <h1 style={{ ...typography.h1 }}>Hello</h1>
 *   <span style={{ fontSize: typography.size.sm }}>meta</span>
 *
 * "Plus Jakarta Sans" is already loaded by the app and has a soft,
 * friendly character that suits a child-focused product.
 * ═══════════════════════════════════════════════════════════════════
 */

// ── Font families ──────────────────────────────────────────────────
export const fontFamily = {
  base: "'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
  mono: "ui-monospace, 'Cascadia Code', 'Courier New', monospace",
} as const;

// ── Type scale (px) — mobile-first, larger base for readability ────
export const size = {
  xs:   11, // tiny meta, timestamps
  sm:   13, // captions, secondary
  base: 15, // body default
  md:   17, // emphasised body
  lg:   20, // section titles
  xl:   24, // screen titles
  "2xl": 30, // hero / child name
  "3xl": 38, // splash / big numbers
} as const;

// ── Weights ────────────────────────────────────────────────────────
export const weight = {
  regular:  400,
  medium:   500,
  semibold: 600,
  bold:     700,
  extra:    800,
} as const;

// ── Line heights ───────────────────────────────────────────────────
export const lineHeight = {
  tight:   1.15,
  snug:    1.3,
  normal:  1.5,
  relaxed: 1.65,
} as const;

// ── Letter spacing ─────────────────────────────────────────────────
export const tracking = {
  tighter: "-0.04em",
  tight:   "-0.02em",
  normal:  "0",
  wide:    "0.02em",
  wider:   "0.06em",
} as const;

// ── Ready-made text styles (spread straight into style props) ──────
export const textStyle = {
  hero: {
    fontFamily: fontFamily.base,
    fontSize: size["2xl"],
    fontWeight: weight.extra,
    lineHeight: lineHeight.tight,
    letterSpacing: tracking.tighter,
  },
  h1: {
    fontFamily: fontFamily.base,
    fontSize: size.xl,
    fontWeight: weight.bold,
    lineHeight: lineHeight.tight,
    letterSpacing: tracking.tight,
  },
  h2: {
    fontFamily: fontFamily.base,
    fontSize: size.lg,
    fontWeight: weight.bold,
    lineHeight: lineHeight.snug,
    letterSpacing: tracking.tight,
  },
  title: {
    fontFamily: fontFamily.base,
    fontSize: size.md,
    fontWeight: weight.semibold,
    lineHeight: lineHeight.snug,
  },
  body: {
    fontFamily: fontFamily.base,
    fontSize: size.base,
    fontWeight: weight.regular,
    lineHeight: lineHeight.normal,
  },
  caption: {
    fontFamily: fontFamily.base,
    fontSize: size.sm,
    fontWeight: weight.medium,
    lineHeight: lineHeight.normal,
  },
  meta: {
    fontFamily: fontFamily.base,
    fontSize: size.xs,
    fontWeight: weight.regular,
    lineHeight: lineHeight.normal,
  },
  /** For text/labels on a primary (yellow) button. */
  button: {
    fontFamily: fontFamily.base,
    fontSize: size.base,
    fontWeight: weight.bold,
    lineHeight: lineHeight.tight,
    letterSpacing: tracking.wide,
  },
} as const;

// ── Aggregate export ───────────────────────────────────────────────
export const typography = {
  fontFamily,
  size,
  weight,
  lineHeight,
  tracking,
  ...textStyle, // typography.h1, typography.body, …
} as const;

export type Typography = typeof typography;
export default typography;
