/**
 * spacing.js — Staff Mobile · spacing, radius & elevation
 * ─────────────────────────────────────────────────────────────────────
 * Staff mobile feed — Parent-style UX plan (2026-07-31).
 * Hand-copied duplicate of `src/modules/parent/theme/spacing.ts`,
 * NOT an import — see colors.js's header comment for why.
 */

// ── Spacing scale (4pt base) ───────────────────────────────────────
export const spacing = {
  none: 0,
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
  "6xl": 64,
};

// ── Border radius ────────────────────────────────────────────────────
export const radius = {
  none:  0,
  sm:    8,
  md:    12,
  lg:    16,
  card:  20,
  xl:    24,
  "2xl": 28,
  pill:  9999,
};

// ── Soft shadows ──────────────────────────────────────────────────────
export const shadows = {
  none: "none",
  xs:   "0 1px 2px rgba(140,110,30,0.06)",
  sm:   "0 2px 8px rgba(140,110,30,0.08)",
  card: "0 4px 16px rgba(140,110,30,0.10), 0 1px 3px rgba(0,0,0,0.04)",
  md:   "0 8px 24px rgba(140,110,30,0.12), 0 2px 6px rgba(0,0,0,0.05)",
  lg:   "0 16px 44px rgba(140,110,30,0.16), 0 4px 12px rgba(0,0,0,0.06)",
  primary: "0 6px 18px rgba(244,196,0,0.40)",
  inset: "inset 0 1px 3px rgba(0,0,0,0.06)",
};

// ── Touch targets ─────────────────────────────────────────────────────
export const touchTarget = {
  min:         44,
  comfortable: 52,
  large:       60,
};

// ── Layout constants for the staff mobile shell ────────────────────────
export const layout = {
  topbarHeight: 56,
  dockHeight:   62,
  contentMax:   640,
  pagePadding:  spacing.lg,
  safeBottom:   "env(safe-area-inset-bottom, 0px)",
};

export default spacing;
