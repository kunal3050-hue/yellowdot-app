/**
 * defineModule.js — the Module Registry entry contract
 * ─────────────────────────────────────────────────────────────────────
 * PLATFORM ARCHITECTURE §5 — docs/platform-architecture/PLATFORM_ARCHITECTURE.md
 *
 * ONE entry per module. Every other list in the app is intended to become a
 * derived view of these entries: the route table, the sidebar, the Care
 * destination grid, the Ctrl+K index, the Roles & Permissions matrix, and both
 * copies of MODULE_ROUTE_MAP.
 *
 * ── Phase 0 status: DARK ──────────────────────────────────────────────────
 * Nothing in the running app imports this yet. The registry is validated
 * against the four live registries by `npm run verify:registry`, which is the
 * whole point of this phase: prove the data is correct BEFORE anything depends
 * on it. Later phases flip consumers over one at a time (§12 Phases 7-9).
 *
 * ── Deliberate Phase 0 constraint: DATA ONLY, NO IMPORTS ──────────────────
 * Entries carry `icon` as a STRING (e.g. "Users"), not a lucide component, and
 * carry no `component` reference. Two reasons:
 *   1. the drift verifier runs in plain Node with no JSX/bundler involved;
 *   2. a registry that imports every page component would eagerly pull the
 *      entire app into any consumer's bundle.
 * Route components are attached in Phase 7 via a separate lazy component map,
 * keyed by path — the registry stays serialisable.
 *
 * ── Capability format (frozen decision Q1) ────────────────────────────────
 * `<module>.<action>` — e.g. "attendance.view". This is the existing Firestore
 * roleMatrix shape addressed as a string, so no data migration is needed.
 * `routeKey` is retained on every route because it is what the app enforces
 * TODAY (can(routeKey) / ProtectedRoute) and is what the drift verifier
 * compares. Both coexist until §12 Phase 11 retires routeKey.
 */

const VALID_ACTIONS = [
  "view", "create", "edit", "delete", "export",
  "approve", "manage", "mark", "upload", "process",
];

/**
 * Validate and normalise a module registry entry.
 * Throws on a malformed entry — a broken registry must fail loudly at import
 * time, never silently render a half-empty navigation.
 *
 * @param {object} mod
 * @returns {object} the frozen, normalised entry
 */
export function defineModule(mod) {
  const where = `module "${mod?.id ?? "(missing id)"}"`;

  if (!mod?.id)       throw new Error(`Registry: ${where} — 'id' is required`);
  if (!mod.label)     throw new Error(`Registry: ${where} — 'label' is required`);
  if (!mod.category)  throw new Error(`Registry: ${where} — 'category' is required`);
  if (!Array.isArray(mod.routes) || mod.routes.length === 0) {
    throw new Error(`Registry: ${where} — 'routes' must be a non-empty array`);
  }

  const actions = mod.actions ?? ["view"];
  for (const a of actions) {
    if (!VALID_ACTIONS.includes(a)) {
      throw new Error(`Registry: ${where} — unknown action "${a}". Allowed: ${VALID_ACTIONS.join(", ")}`);
    }
  }
  if (!actions.includes("view")) {
    // Mirrors the PERMISSION_DEPS rule already enforced in rbacConfig.js:
    // every non-view action implies view, so view must exist.
    throw new Error(`Registry: ${where} — 'actions' must include "view"`);
  }

  const routes = mod.routes.map((r, i) => {
    if (!r.path) throw new Error(`Registry: ${where} — routes[${i}] missing 'path'`);
    // `public: true` marks the handful of unauthenticated routes (/login,
    // /unauthorized, …) which legitimately have no routeKey in App.jsx.
    if (!r.public && !r.routeKey) {
      throw new Error(`Registry: ${where} — routes[${i}] "${r.path}" needs a 'routeKey' or 'public: true'`);
    }
    return {
      ...r,
      // Default a route's capability to the module's baseline view capability.
      capability: r.capability ?? mod.capability ?? `${mod.id}.view`,
    };
  });

  return Object.freeze({
    ...mod,
    actions,
    routes,
    capability:  mod.capability  ?? `${mod.id}.view`,
    keywords:    mod.keywords    ?? [],
    surfaces:    mod.surfaces    ?? {},
    // Contribution slots — all optional, all empty in Phase 0. Populated from
    // Phase 3 (service) and Phases 8-9 (widgets, taskProvider) onward.
    service:        mod.service        ?? null,   // §5A
    events:         mod.events         ?? [],     // §5B
    notifications:  mod.notifications  ?? null,   // §5C
    widgets:        mod.widgets        ?? [],     // §3
    taskProvider:   mod.taskProvider   ?? null,   // §4
    quickActions:   mod.quickActions   ?? [],
    aiCapabilities: mod.aiCapabilities ?? [],     // §5E — none in v1
  });
}

export { VALID_ACTIONS };
