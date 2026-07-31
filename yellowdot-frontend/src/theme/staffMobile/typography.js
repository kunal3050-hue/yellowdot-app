/**
 * typography.js — Staff Mobile · typography
 * ─────────────────────────────────────────────────────────────────────
 * Staff mobile feed — Parent-style UX plan (2026-07-31).
 * Hand-copied duplicate of `src/modules/parent/theme/typography.ts`,
 * NOT an import — see colors.js's header comment for why.
 */

export const fontFamily = {
  base: "'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
  mono: "ui-monospace, 'Cascadia Code', 'Courier New', monospace",
};

export const size = {
  xs:   11,
  sm:   13,
  base: 15,
  md:   17,
  lg:   20,
  xl:   24,
  "2xl": 30,
  "3xl": 38,
};

export const weight = {
  regular:  400,
  medium:   500,
  semibold: 600,
  bold:     700,
  extra:    800,
};

export const lineHeight = {
  tight:   1.15,
  snug:    1.3,
  normal:  1.5,
  relaxed: 1.65,
};

export const tracking = {
  tighter: "-0.04em",
  tight:   "-0.02em",
  normal:  "0",
  wide:    "0.02em",
  wider:   "0.06em",
};

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
  button: {
    fontFamily: fontFamily.base,
    fontSize: size.base,
    fontWeight: weight.bold,
    lineHeight: lineHeight.tight,
    letterSpacing: tracking.wide,
  },
};

export const typography = {
  fontFamily,
  size,
  weight,
  lineHeight,
  tracking,
  ...textStyle,
};

export default typography;
