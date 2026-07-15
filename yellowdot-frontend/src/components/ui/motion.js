/**
 * motion.js — KUE BOXS Design System shared motion tokens (Framer Motion)
 * ─────────────────────────────────────────────────────────────────────────
 * Single source of truth for animation across the app. Mirrors the same
 * easing curves already defined in tokens.css (--yd-ease/-spring/-bounce),
 * so CSS-driven and Framer-Motion-driven animation feel like one language.
 *
 * Rules (per KUE BOXS Design System v2):
 *   - Duration: 120-200ms. Never longer.
 *   - Respect prefers-reduced-motion: reduce -- durations collapse to ~0
 *     and transform-based entrances become simple opacity fades.
 *   - Motion should never distract from productivity -- no bounce/spring
 *     overshoot on anything that appears/disappears frequently (toasts,
 *     dropdowns). Bounce is reserved for rare, delightful moments (a
 *     wizard's final success state), not everyday chrome.
 */

import { useState, useEffect } from "react";

// ── Durations (seconds, Framer Motion's unit) ──────────────────────────────
export const DURATION = {
  fast: 0.12,
  base: 0.16,
  slow: 0.2,
};

// ── Easing — identical curves to tokens.css ────────────────────────────────
export const EASE = {
  standard: [0.4, 0, 0.2, 1],       // --yd-ease
  spring:   [0.22, 1, 0.36, 1],     // --yd-ease-spring
  bounce:   [0.34, 1.56, 0.64, 1],  // --yd-ease-bounce (sparingly)
};

// ── Reduced-motion detection ────────────────────────────────────────────────
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e) => setReduced(e.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);
  return reduced;
}

/**
 * Wraps a set of Framer Motion variants so every "visible"/"animate" state
 * still applies (content must remain fully visible/functional), but all
 * transform-based motion collapses to an instant opacity-only fade when the
 * user prefers reduced motion. Pass the normal variants; get back
 * reduced-motion-safe ones.
 */
export function withReducedMotion(variants, reduced) {
  if (!reduced) return variants;
  const safe = {};
  for (const [key, value] of Object.entries(variants)) {
    safe[key] = { opacity: value.opacity ?? 1, transition: { duration: 0.01 } };
  }
  return safe;
}

// ── Reusable variant presets ────────────────────────────────────────────────

/** Dialogs/modals — scale + fade, centered */
export const dialogVariants = {
  hidden:  { opacity: 0, scale: 0.96, y: 8 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: DURATION.base, ease: EASE.spring } },
  exit:    { opacity: 0, scale: 0.98, y: 4, transition: { duration: DURATION.fast, ease: EASE.standard } },
};

/** Drawers — slide in from the right */
export const drawerVariants = {
  hidden:  { x: "100%" },
  visible: { x: 0, transition: { duration: DURATION.slow, ease: EASE.spring } },
  exit:    { x: "100%", transition: { duration: DURATION.base, ease: EASE.standard } },
};

/** Bottom sheets (mobile modals/drawers) — slide up from the bottom */
export const bottomSheetVariants = {
  hidden:  { y: "100%" },
  visible: { y: 0, transition: { duration: DURATION.slow, ease: EASE.spring } },
  exit:    { y: "100%", transition: { duration: DURATION.base, ease: EASE.standard } },
};

/** Dropdowns/popovers — small scale + fade from the trigger */
export const popoverVariants = {
  hidden:  { opacity: 0, scale: 0.97, y: -4 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: DURATION.fast, ease: EASE.standard } },
  exit:    { opacity: 0, scale: 0.98, y: -2, transition: { duration: DURATION.fast, ease: EASE.standard } },
};

/** Accordions/collapsible sections — height + fade */
export const accordionVariants = {
  collapsed: { height: 0, opacity: 0 },
  expanded:  { height: "auto", opacity: 1, transition: { duration: DURATION.base, ease: EASE.standard } },
};

/** Cards — subtle rise-in, for lists that populate on load */
export const cardVariants = {
  hidden:  { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE.standard } },
};

/** Toasts — slide up + fade */
export const toastVariants = {
  hidden:  { opacity: 0, y: 16, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: DURATION.base, ease: EASE.spring } },
  exit:    { opacity: 0, y: 8, scale: 0.98, transition: { duration: DURATION.fast, ease: EASE.standard } },
};

/** Page transitions — gentle cross-fade, no directional slide (avoids
    disorientation on nav-heavy enterprise apps) */
export const pageVariants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: DURATION.slow, ease: EASE.standard } },
  exit:    { opacity: 0, transition: { duration: DURATION.fast, ease: EASE.standard } },
};

/** Wizard step transitions — horizontal slide matching step direction */
export function wizardStepVariants(direction = 1) {
  return {
    hidden:  { opacity: 0, x: 24 * direction },
    visible: { opacity: 1, x: 0, transition: { duration: DURATION.base, ease: EASE.standard } },
    exit:    { opacity: 0, x: -24 * direction, transition: { duration: DURATION.fast, ease: EASE.standard } },
  };
}

/** Backdrop/overlay fade, used behind dialogs/drawers/bottom sheets */
export const overlayVariants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: DURATION.base } },
  exit:    { opacity: 0, transition: { duration: DURATION.fast } },
};

/** Stagger helper for list-of-cards entrances (Timeline, ActivityFeed, QuickActionCard grids) */
export const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.03 } },
};
