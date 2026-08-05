import { useEffect, useState } from "react";

/**
 * useIsMobile — viewport-width mobile detection.
 * ─────────────────────────────────────────────────────────────────────
 * Same `matchMedia` pattern as `components/ui/motion.js`'s
 * `usePrefersReducedMotion` — SSR-safe initial value, live-updates on
 * resize/orientation change via the media query's own change event
 * rather than a resize listener.
 *
 * Breakpoint (768px) is the standard phone/tablet boundary, not tied to
 * any Staff or Parent layout constant — this hook only answers "is the
 * viewport mobile-sized", callers decide what to do with that.
 *
 * Reintroduced for Staff Home Phase 2 (2026-08-05) to make /attendance
 * and /care-hygiene viewport-aware (mobile-native screen vs. existing
 * desktop page) — same need as Phase 1's since-removed mobile-only
 * RootRedirect gate.
 */
const MOBILE_QUERY = "(max-width: 768px)";

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  return isMobile;
}

export default useIsMobile;
