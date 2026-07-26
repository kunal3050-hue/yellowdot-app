/**
 * index.js — the Widget Engine
 * ─────────────────────────────────────────────────────────────────────
 * PLATFORM ARCHITECTURE §3 — docs/platform-architecture/PLATFORM_ARCHITECTURE.md
 *
 *   registry → featureFlag gate → capability gate → sort → fetch → select → render
 *
 * The engine is generic. It never references a widget by id, and everything it
 * enforces is enforced once, here, so widgets stay declarations:
 *
 *   - failure is PER WIDGET (Promise.allSettled) — one dead endpoint degrades
 *     one tile, the page still renders. Same resilience as useDashboardStats.
 *   - reads go through the Service Registry, so two widgets needing the same
 *     read issue one request (attendance and birthdays share the student list).
 *   - refresh pauses when the tab is hidden and refetches on focus. With the
 *     Event Bus deferred (rev 1.3 / §5B.5), focus-refetch is what makes a
 *     deep-link-and-back journey show fresh numbers.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { usePermissions } from "../permissions/usePermissions.js";
import { callRead } from "../services/index.js";
import WIDGETS from "./widgets.js";

export const WIDGETS_BY_ID = Object.fromEntries(WIDGETS.map(w => [w.id, w]));

{
  const seen = new Set();
  for (const w of WIDGETS) {
    if (seen.has(w.id)) throw new Error(`Widget registry: duplicate widget id "${w.id}"`);
    seen.add(w.id);
  }
}

/**
 * Which widgets this user may see, in order.
 * Pure — no fetching — so it can be unit-checked without a network.
 */
export function resolveWidgets({ can, isEnabled, role }) {
  return WIDGETS
    .filter(w => (w.featureFlag ? isEnabled(w.featureFlag) : true))
    .filter(w => can(w.capability))
    .sort((a, b) => {
      const ao = a.displayOrder?.[role] ?? a.priority;
      const bo = b.displayOrder?.[role] ?? b.priority;
      return ao - bo || a.id.localeCompare(b.id);
    });
}

/** Resolve a widget's declared reads → { key: payload }, failures isolated. */
async function fetchWidget(widget, scope) {
  const entries = Object.entries(widget.reads);
  if (!entries.length) return { data: {}, failed: [] };

  const settled = await Promise.allSettled(
    entries.map(([, r]) =>
      callRead(r.service, r.read, typeof r.args === "function" ? r.args() : (r.args ?? {}), scope),
    ),
  );

  const data = {};
  const failed = [];
  settled.forEach((res, i) => {
    const [key] = entries[i];
    if (res.status === "fulfilled") data[key] = res.value;
    else failed.push({ key, error: res.reason });
  });
  return { data, failed };
}

/**
 * Fetch + select for one widget. PURE async — computes the next view state and
 * returns it, touching no React state, so it can be called from an effect, a
 * timer or a test without any of them needing to know the others exist.
 *
 * A widget whose reads ALL fail yields an error state; partial failure is passed
 * to select(), which is written to degrade to "—" on the missing pieces.
 */
async function computeView(widget, scope) {
  const { data, failed } = await fetchWidget(widget, scope);
  const total = Object.keys(widget.reads).length;

  if (total > 0 && failed.length === total) {
    return { loading: false, error: failed[0].error, view: null };
  }
  try {
    return { loading: false, error: null, view: widget.select(data) };
  } catch (err) {
    // A select() that throws is a widget bug, not a data problem — surface it
    // as this tile's error rather than taking the Dashboard down with it.
    return { loading: false, error: err, view: null };
  }
}

/** Drive one widget: fetch, select, refresh. */
export function useWidget(widget) {
  const { scope } = usePermissions();
  const [state, setState] = useState({ loading: true, error: null, view: null });
  const mounted = useRef(true);
  // Monotonic guard: overlapping polls must not apply an older result over a
  // newer one. Without it a slow first request can clobber a fast second.
  const seq = useRef(0);

  const apply = useCallback(next => {
    setState(next);
  }, []);

  const load = useCallback(async () => {
    const ticket = ++seq.current;
    const next = await computeView(widget, scope);
    if (mounted.current && ticket === seq.current) apply(next);
  }, [widget, scope, apply]);

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    // setState happens after an await, never synchronously in the effect body.
    (async () => {
      const ticket = ++seq.current;
      const next = await computeView(widget, scope);
      if (!cancelled && mounted.current && ticket === seq.current) apply(next);
    })();
    return () => { cancelled = true; mounted.current = false; };
  }, [widget, scope, apply]);

  // Poll + refetch on focus. Hidden tabs do not poll: a backgrounded dashboard
  // must not keep hitting the API all day.
  useEffect(() => {
    if (!widget.refreshInterval) return undefined;
    let timer = null;

    const start = () => {
      stop();
      timer = setInterval(() => {
        if (document.visibilityState === "visible") load();
      }, widget.refreshInterval);
    };
    const stop = () => { if (timer) clearInterval(timer); timer = null; };

    const onVisibility = () => {
      if (document.visibilityState === "visible") { load(); start(); }
      else stop();
    };

    start();
    window.addEventListener("focus", load);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      window.removeEventListener("focus", load);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [widget.refreshInterval, load]);

  return { ...state, reload: load };
}

/**
 * The ordered widget list for the current user.
 *
 * `role` is read only for displayOrder overrides — resolveWidgets() itself
 * stays a pure function so it can be checked without React or a network.
 */
export function useVisibleWidgets() {
  const { can, isEnabled } = usePermissions();
  const { role } = useAuth();
  return useMemo(
    () => resolveWidgets({ can, isEnabled, role }),
    [can, isEnabled, role],
  );
}

export { WIDGETS };
