/**
 * index.js — the Module Registry
 * ─────────────────────────────────────────────────────────────────────
 * PLATFORM ARCHITECTURE §5 — docs/platform-architecture/PLATFORM_ARCHITECTURE.md
 *
 * ⚠️ PHASE 0: DARK. Nothing in the running application imports this file.
 * It is validated against the four live registries by `npm run verify:registry`.
 * Consumers are flipped over one at a time in §12 Phases 7-9.
 *
 * The selectors below are the derived views that will replace, in order:
 *   selectRoutes()      → App.jsx's ~106 hand-written <Route> declarations
 *   selectNavGroups()   → config/sidebarConfig.js SIDEBAR_GROUPS
 *   selectGridSections()→ pages/quickNavigation/modules.js SECTIONS
 *   selectSearchIndex() → the Ctrl+K palette index
 *   selectRouteKeyMap() → BOTH copies of MODULE_ROUTE_MAP (frontend + backend)
 *
 * Every selector is a pure function of MODULES. None performs a permission
 * check — filtering by capability, feature flag and scope is the Permission
 * Engine's job (§2c), applied by the consumer, so this file stays testable in
 * plain Node with no auth context.
 */
import { CATEGORIES, CATEGORIES_BY_ID } from "./categories.js";

import coreModules          from "./modules/core.js";
import peopleModules        from "./modules/people.js";
import dailyCareModules     from "./modules/dailyCare.js";
import learningModules      from "./modules/learning.js";
import financeModules       from "./modules/finance.js";
import communicationModules from "./modules/communication.js";
import safetyModules        from "./modules/safety.js";
import staffHrModules       from "./modules/staffHr.js";
import platformModules      from "./modules/platform.js";

export { CATEGORIES, CATEGORIES_BY_ID };
export {
  KNOWN_ORPHANS, KNOWN_ORPHAN_PATHS, KNOWN_ORPHAN_ROUTEKEYS,
  UNMAPPED_PERMISSION_MODULES, ACTION_ONLY_ROUTEKEYS,
  UNREACHABLE_ROUTEKEYS, UNREACHABLE_WITH_IMPACT,
} from "./knownGaps.js";

/** Every registered module, in no particular order. */
export const MODULES = [
  ...coreModules,
  ...peopleModules,
  ...dailyCareModules,
  ...learningModules,
  ...financeModules,
  ...communicationModules,
  ...safetyModules,
  ...staffHrModules,
  ...platformModules,
];

export const MODULES_BY_ID = Object.fromEntries(MODULES.map(m => [m.id, m]));

// ── Integrity checks — a broken registry must fail loudly at import ──────────
{
  const seenIds = new Set();
  const seenPaths = new Map();
  for (const m of MODULES) {
    if (seenIds.has(m.id)) throw new Error(`Registry: duplicate module id "${m.id}"`);
    seenIds.add(m.id);

    if (!CATEGORIES_BY_ID[m.category]) {
      throw new Error(`Registry: module "${m.id}" references unknown category "${m.category}"`);
    }
    for (const r of m.routes) {
      if (seenPaths.has(r.path)) {
        throw new Error(
          `Registry: path "${r.path}" is claimed by both "${seenPaths.get(r.path)}" and "${m.id}". ` +
          `A route may belong to exactly one module.`
        );
      }
      seenPaths.set(r.path, m.id);
      for (const nav of r.nav ?? []) {
        if (!CATEGORIES_BY_ID[nav.category]) {
          throw new Error(`Registry: route "${r.path}" places nav in unknown category "${nav.category}"`);
        }
      }
    }
  }
}

// ── Derived views ────────────────────────────────────────────────────────────

/** Flat list of every route, each carrying its owning module. */
export function selectRoutes() {
  return MODULES.flatMap(m =>
    m.routes.map(r => ({ ...r, moduleId: m.id, moduleLabel: m.label, category: m.category }))
  );
}

/** Routes that require authentication (everything except `public: true`). */
export function selectProtectedRoutes() {
  return selectRoutes().filter(r => !r.public);
}

/**
 * Sidebar structure: categories in order, each with its nav items in order.
 * Replaces SIDEBAR_GROUPS. Categories with no items are omitted, which is what
 * makes permission filtering by the consumer collapse empty groups for free.
 */
export function selectNavGroups() {
  const byCategory = new Map();

  for (const m of MODULES) {
    for (const r of m.routes) {
      for (const nav of r.nav ?? []) {
        if (!byCategory.has(nav.category)) byCategory.set(nav.category, []);
        byCategory.get(nav.category).push({
          moduleId:   m.id,
          path:       r.path,
          routeKey:   r.routeKey,
          capability: r.capability,
          label:      nav.label ?? r.label ?? m.label,
          icon:       nav.icon  ?? r.icon  ?? m.icon,
          order:      nav.order ?? 999,
          exact:      nav.exact ?? false,
          matchPaths: nav.matchPaths ?? [],
        });
      }
    }
  }

  return CATEGORIES
    .filter(c => byCategory.has(c.id))
    .sort((a, b) => a.order - b.order)
    .map(c => ({
      id: c.id,
      label: c.label,
      accent: c.accent,
      ...c.sidebar,
      items: byCategory.get(c.id).sort((a, b) => a.order - b.order),
    }));
}

/** Control Center grid sections. Replaces modules.js SECTIONS. */
export function selectGridSections() {
  const bySection = new Map();

  for (const m of MODULES) {
    for (const r of m.routes) {
      if (!r.grid) continue;
      const sec = r.grid.section;
      if (!bySection.has(sec)) bySection.set(sec, []);
      bySection.get(sec).push({
        moduleId:    m.id,
        path:        r.path,
        routeKey:    r.routeKey,
        capability:  r.capability,
        label:       r.grid.label ?? r.label ?? m.label,
        icon:        r.grid.icon  ?? r.icon  ?? m.icon,
        description: r.grid.description,
      });
    }
  }

  return [...bySection.entries()].map(([id, items]) => ({ id, items }));
}

/** Ctrl+K index — one entry per navigable route. */
export function selectSearchIndex() {
  return selectRoutes()
    .filter(r => r.label && !r.public)
    .map(r => ({
      path: r.path,
      label: r.label,
      moduleId: r.moduleId,
      capability: r.capability,
      routeKey: r.routeKey,
      keywords: MODULES_BY_ID[r.moduleId].keywords,
    }));
}

/**
 * capability → routeKeys. Replaces MODULE_ROUTE_MAP in BOTH repos
 * (rbacConfig.js and roleService.js), which are hand-maintained duplicates
 * today — PLATFORM_ARCHITECTURE §0.3 gap 5.
 */
export function selectRouteKeyMap() {
  const map = {};
  for (const m of MODULES) {
    for (const r of m.routes) {
      if (!r.routeKey) continue;
      const permModule = (r.capability ?? m.capability).split(".")[0];
      (map[permModule] ??= new Set()).add(r.routeKey);
    }
  }
  return Object.fromEntries(Object.entries(map).map(([k, v]) => [k, [...v]]));
}

/** Permission matrix source. Replaces rbacConfig PERMISSION_CATEGORIES. */
export function selectPermissionModules() {
  const byPermModule = new Map();
  for (const m of MODULES) {
    const permModule = m.capability.split(".")[0];
    const existing = byPermModule.get(permModule);
    if (existing) {
      for (const a of m.actions) existing.actions.add(a);
      existing.contributedBy.push(m.id);
    } else {
      byPermModule.set(permModule, {
        id: permModule,
        label: m.label,
        category: m.category,
        actions: new Set(m.actions),
        contributedBy: [m.id],
      });
    }
  }
  return [...byPermModule.values()].map(p => ({ ...p, actions: [...p.actions] }));
}
