import { useEffect, useState } from "react";

/**
 * useNow — a wall-clock reading that is stable within a render pass.
 * ─────────────────────────────────────────────────────────────────────
 * Reading `Date.now()` directly in a component body (or in a `useMemo`)
 * breaks the purity rule React 19 enforces via `react-hooks/purity`:
 * the value changes on every render, so the same props can produce
 * different output and memoized results silently go stale-or-fresh
 * depending on when a re-render happens to occur.
 *
 * This hook moves the clock read into an effect — the one place a side
 * effect belongs — and exposes it as state. Render then only ever reads
 * a value, which is pure and idempotent.
 *
 * It also makes elapsed-time UI actually correct. Anything derived from
 * "now" (a countdown, a relative timestamp, an "is this overdue" check)
 * previously only refreshed when something else happened to re-render
 * the component. With a tick interval it refreshes on its own.
 *
 * Usage:
 *   const now = useNow(30_000);          // re-render every 30s
 *   const now = useNow(null);            // read once on mount, never tick
 *
 * Pass the largest interval the UI can tolerate — a one-minute relative
 * timestamp does not need a one-second tick.
 *
 * Added 2026-11-11 to fix the `react-hooks/purity` violations in
 * LiveDashboard, NapTracker and PickupCard.
 */
export function useNow(intervalMs = 30_000) {
  // Initialized lazily inside the initializer, not in the render body:
  // useState only calls this on the first render, so it does not make
  // subsequent renders impure.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!intervalMs) return undefined;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}

export default useNow;
