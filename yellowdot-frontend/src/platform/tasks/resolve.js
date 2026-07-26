/**
 * resolve.js — pure Care resolution (task providers + destination grid)
 * ─────────────────────────────────────────────────────────────────────
 * PLATFORM ARCHITECTURE §4 / §7
 *
 * Split out of index.js for the same reason as the widget resolver: these are
 * the rules that decide what each role sees, and they must be verifiable
 * without React, a browser or a network. index.js re-exports them, so there is
 * one implementation.
 */
import { MODULES_BY_ID } from "../registry/index.js";
import PROVIDERS from "./providers.js";

/** Task providers this user may see. */
export function resolveProviders({ can, isEnabled }) {
  return PROVIDERS
    .filter(p => (p.featureFlag ? isEnabled(p.featureFlag) : true))
    .filter(p => can(p.capability));
}

/**
 * The Care destination grid.
 *
 * Capability is the real gate; the per-role `order` only sorts what the user
 * may already reach. So granting a Teacher Finance access makes Finance appear
 * in their grid without any change here — which is the §7 requirement.
 */
export function resolveCareModules({ can, isEnabled, role }) {
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
}

export { PROVIDERS };
