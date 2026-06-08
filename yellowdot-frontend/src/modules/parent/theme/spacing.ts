/**
 * ═══════════════════════════════════════════════════════════════════
 * YELLOW DOT — PARENT MODULE · SPACING, RADIUS & ELEVATION
 * ═══════════════════════════════════════════════════════════════════
 *
 * Mobile-first sizing tokens. Components MUST use these instead of
 * magic numbers so spacing stays consistent across every screen.
 *
 *   import { spacing, radius, shadows, touchTarget } from "@/theme";
 *
 * All values are in pixels (numbers) so they drop straight into inline
 * styles: { padding: spacing.md, borderRadius: radius.card }.
 * ═══════════════════════════════════════════════════════════════════
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
} as const;

// ── Border radius — generous, friendly, "rounded cards" ────────────
export const radius = {
  none:  0,
  sm:    8,
  md:    12,
  lg:    16,
  card:  20,  // default card corner — soft & child-friendly
  xl:    24,
  "2xl": 28,
  pill:  9999, // fully rounded — chips, FAB, avatars
} as const;

// ── Soft shadows — warm, low-contrast, never harsh ─────────────────
// Tinted with the brand yellow so elevation feels cohesive.
export const shadows = {
  none: "none",
  /** Subtle lift — chips, list rows. */
  xs:   "0 1px 2px rgba(140,110,30,0.06)",
  /** Resting cards. */
  sm:   "0 2px 8px rgba(140,110,30,0.08)",
  /** Default elevated card — the everyday surface. */
  card: "0 4px 16px rgba(140,110,30,0.10), 0 1px 3px rgba(0,0,0,0.04)",
  /** Raised / hovered cards, sheets. */
  md:   "0 8px 24px rgba(140,110,30,0.12), 0 2px 6px rgba(0,0,0,0.05)",
  /** Floating elements — bottom dock, FAB, modals. */
  lg:   "0 16px 44px rgba(140,110,30,0.16), 0 4px 12px rgba(0,0,0,0.06)",
  /** Glow under primary (yellow) buttons. */
  primary: "0 6px 18px rgba(244,196,0,0.40)",
  /** Inset for pressed / wells. */
  inset: "inset 0 1px 3px rgba(0,0,0,0.06)",
} as const;

// ── Touch targets — large, thumb-friendly (mobile-first) ───────────
export const touchTarget = {
  /** Apple/Material minimum — never go below this for tappables. */
  min:        44,
  /** Comfortable default for primary actions. */
  comfortable: 52,
  /** Hero CTAs. */
  large:      60,
} as const;

// ── Layout constants for the parent shell ──────────────────────────
export const layout = {
  topbarHeight: 56,
  dockHeight:   62,
  contentMax:   640, // mobile-first reading width on larger screens
  pagePadding:  spacing.lg,
  safeBottom:   "env(safe-area-inset-bottom, 0px)",
} as const;

export type Spacing = typeof spacing;
export type Radius = typeof radius;
export type Shadows = typeof shadows;
export default spacing;
