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
import { levelAtLeast } from "../permissions/capabilities.js";

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
 *
 * ── N1 fix (INTEGRATION_VALIDATION.md, 2026-07-29) ─────────────────────────
 * `can()` is boolean — level !== "none" — so a `self`-scoped grant passed the
 * same gate as a school-wide one. A Teacher holding only
 * `staff_management: { view: "self" }` saw a card labelled "Staff Dashboard",
 * which reads as the HR management screen rather than "my own record" — and
 * that destination is not actually self-scoped yet (§2c.1 notes the backend
 * work is still pending), so the card was actively misleading.
 *
 * Fix: each care surface may declare `minLevel` (default "self", i.e. no
 * change from before for the common case). A module whose only realistic
 * destination is a manager-facing screen — Staff Dashboard among them —
 * declares a higher minLevel, so a self-only grant simply doesn't produce a
 * card, rather than producing a mislabelled one. `level` is passed as a
 * function for the same reason `can`/`isEnabled` are: this stays a pure,
 * network-free resolver that verify-roles.mjs can call directly.
 */
export function resolveCareModules({ can, isEnabled, level, role }) {
  return Object.values(MODULES_BY_ID)
    .filter(m => m.surfaces?.care)
    .filter(m => (m.featureFlag ? isEnabled(m.featureFlag) : true))
    .filter(m => can(m.capability))
    .filter(m => {
      const minLevel = m.surfaces.care.minLevel ?? "self";
      if (minLevel === "self" || typeof level !== "function") return true;
      return levelAtLeast(level(m.capability), minLevel);
    })
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
