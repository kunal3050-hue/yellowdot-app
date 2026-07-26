/**
 * resolve.js — pure widget resolution
 * ─────────────────────────────────────────────────────────────────────
 * PLATFORM ARCHITECTURE §3b
 *
 * Split out of index.js so the resolution rules can be exercised WITHOUT React
 * or a network — verify-roles.mjs runs this directly to produce the per-role
 * matrix. index.js re-exports it, so there is still exactly one implementation.
 */
import WIDGETS from "./widgets.js";

/**
 * Which widgets a user may see, in order.
 *
 * @param {function} can        capability check
 * @param {function} isEnabled  feature-flag check
 * @param {string}   role       only used for displayOrder overrides
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

export { WIDGETS };
