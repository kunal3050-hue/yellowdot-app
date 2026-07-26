/**
 * index.js — the Task Engine
 * ─────────────────────────────────────────────────────────────────────
 * PLATFORM ARCHITECTURE §4 — docs/platform-architecture/PLATFORM_ARCHITECTURE.md
 *
 *   providers → featureFlag gate → capability gate → fetch → toTasks
 *             → computePriority → sort → one flat feed
 *
 * The core is two pure functions (computePriority, compareTasks) applied to
 * every task from every provider. Everything else is provider-contributed, so
 * a new domain never edits this file.
 *
 * Reads go through the Service Registry, the same one the Dashboard's widgets
 * use — Care and Dashboard share a service layer rather than each maintaining
 * their own copy of how to fetch and interpret a module's data.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { usePermissions } from "../permissions/usePermissions.js";
import { callRead } from "../services/index.js";
import { MODULES_BY_ID } from "../registry/index.js";
import PROVIDERS from "./providers.js";
import { computePriority, compareTasks, normalizeTask } from "./defineTaskProvider.js";

export * from "./defineTaskProvider.js";

// ── Integrity: a provider must belong to a registered module ─────────────────
// This is what keeps §4's "providers are part of module registration" true even
// though the functions live outside the serialisable registry.
{
  const seen = new Set();
  for (const p of PROVIDERS) {
    if (seen.has(p.id)) throw new Error(`Task registry: duplicate provider id "${p.id}"`);
    seen.add(p.id);
    if (!MODULES_BY_ID[p.moduleId]) {
      throw new Error(
        `Task registry: provider "${p.id}" references moduleId "${p.moduleId}", ` +
        `which is not in the Module Registry.`,
      );
    }
  }
}

/** Providers this user may see. Pure — checkable without a network. */
export function resolveProviders({ can, isEnabled }) {
  return PROVIDERS
    .filter(p => (p.featureFlag ? isEnabled(p.featureFlag) : true))
    .filter(p => can(p.capability));
}

/** Run one provider: fetch its reads, map to tasks. Never throws. */
async function runProvider(provider, scope) {
  const entries = Object.entries(provider.reads);
  const settled = await Promise.allSettled(
    entries.map(([, r]) =>
      callRead(r.service, r.read, typeof r.args === "function" ? r.args() : (r.args ?? {}), scope),
    ),
  );

  const data = {};
  let failures = 0;
  settled.forEach((res, i) => {
    if (res.status === "fulfilled") data[entries[i][0]] = res.value;
    else failures++;
  });

  // All reads failed → this provider contributes nothing. It must NOT take the
  // rest of the feed down: a dead Finance endpoint cannot hide a pickup request.
  if (entries.length > 0 && failures === entries.length) {
    return { tasks: [], failed: true };
  }

  try {
    const raw = provider.toTasks(data) ?? [];
    // `category` is DERIVED from the owning module's registry entry, never
    // declared by the provider — which is what replaced the old hand-maintained
    // `domain` enum (§4). Care's filter chips fall out of this for free.
    const category = MODULES_BY_ID[provider.moduleId]?.category ?? "other";
    return {
      tasks: raw.map(t => ({ ...normalizeTask(t, provider), category })),
      failed: false,
    };
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error(`[TaskEngine] provider "${provider.id}" threw in toTasks():`, err);
    }
    return { tasks: [], failed: true };
  }
}

/**
 * Apply the escalation ladder and sort. Pure, so a simulated `now` produces a
 * deterministic feed — which is how the escalation rules are tested.
 */
export function buildFeed(tasks, now = new Date()) {
  return tasks
    .map(t => {
      const { priority, reason } = computePriority(t, now);
      return { ...t, priority, escalationReason: reason };
    })
    .sort(compareTasks);
}

const REFRESH_MS = 60_000;

/**
 * The Care feed.
 *
 * Refreshes on mount, on window focus and on a poll — the §3f freshness model.
 * With the Event Bus deferred (rev 1.3), focus-refetch is what makes acting in
 * a module and coming back show an updated queue.
 */
export function useTaskFeed() {
  const { can, isEnabled, scope } = usePermissions();
  const [state, setState] = useState({ loading: true, tasks: [], degraded: [] });
  const mounted = useRef(true);
  const seq = useRef(0);

  const providers = useMemo(() => resolveProviders({ can, isEnabled }), [can, isEnabled]);

  const collect = useCallback(async () => {
    const results = await Promise.all(providers.map(p => runProvider(p, scope)));
    return {
      loading: false,
      tasks: results.flatMap(r => r.tasks),
      degraded: providers.filter((_, i) => results[i].failed).map(p => p.moduleId),
    };
  }, [providers, scope]);

  const reload = useCallback(async () => {
    const ticket = ++seq.current;
    const next = await collect();
    if (mounted.current && ticket === seq.current) setState(next);
  }, [collect]);

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    (async () => {
      const ticket = ++seq.current;
      const next = await collect();
      if (!cancelled && mounted.current && ticket === seq.current) setState(next);
    })();
    return () => { cancelled = true; mounted.current = false; };
  }, [collect]);

  useEffect(() => {
    const tick = () => { if (document.visibilityState === "visible") reload(); };
    const timer = setInterval(tick, REFRESH_MS);
    window.addEventListener("focus", reload);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", reload);
    };
  }, [reload]);

  const feed = useMemo(() => buildFeed(state.tasks), [state.tasks]);

  return { ...state, tasks: feed, reload, providerCount: providers.length };
}

/**
 * The Care destination grid — modules the user can reach, from the Module
 * Registry's `surfaces.care`. Ordering prefers the role's own list; capability
 * is the real gate, so granting a Teacher Finance access makes Finance appear.
 */
export function useCareModules() {
  const { can, isEnabled } = usePermissions();
  const { role } = useAuth();

  return useMemo(() => {
    return Object.values(MODULES_BY_ID)
      .filter(m => m.surfaces?.care)
      .filter(m => (m.featureFlag ? isEnabled(m.featureFlag) : true))
      .filter(m => can(m.capability))
      .map(m => ({
        id: m.id,
        label: m.label,
        icon: m.icon,
        category: m.category,
        path: m.routes.find(r => r.nav?.length)?.path ?? m.routes[0]?.path,
        order: m.surfaces.care.roles?.[role] ?? m.surfaces.care.order ?? 500,
      }))
      .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
  }, [can, isEnabled, role]);
}

export { PROVIDERS };
