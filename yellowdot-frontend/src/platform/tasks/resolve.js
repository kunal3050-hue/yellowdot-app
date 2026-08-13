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
import { isBypassRole, ROLE_LABELS } from "../../config/permissions.js";

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

/**
 * Split a resolved feed into what's actually the signed-in user's to act on
 * versus everything else they merely have view-capability on.
 *
 * C1, Care experience review (2026-07-31): `resolveProviders` gates on
 * capability only, so a task's presence in the feed never meant it belonged
 * to the viewer — live as Teacher, 4 of 5 "Needs attention" items were
 * Principal's or Reception's, with `owner` only ever rendered as a caption.
 * `owner.id` is always a role id (see providers.js), so matching it against
 * the viewer's own role is enough — no per-task assignment model exists to
 * do better than that today, and this doesn't invent one.
 *
 * Bypass roles (§ config/permissions BYPASS_ROLES) hold every capability by
 * construction, so splitting their feed would put everything in "team" and
 * nothing in "mine" — the opposite of what the split is for. They keep the
 * unsplit view.
 *
 * ── Capability fallback (Staff Home audit follow-up, 2026-08-13) ──────────
 * `owner.id === role` on its own is brittle for a role this file has never
 * heard of: Staff is now one platform with an open-ended set of roles (§
 * Platform Architecture Freeze), and a brand-new role holding exactly the
 * capability a provider gates on has no literal here to match, so it was
 * silently swept into "team" — its own work read as someone else's.
 *
 * Capability alone can't replace the role match entirely: every task already
 * passed `resolveProviders`'s `can(p.capability)` gate to be in `tasks` at
 * all, so "the viewer holds this capability" is true for every role that
 * sees the task, "mine" and "team" alike — it's not a signal, it's the
 * entry ticket. The only thing worth deciding differently is what happens
 * when `role` isn't one of the legacy roles this file was written against
 * (`ROLE_LABELS`, the same enumeration Staff Home's own role-label pill
 * already reads from): for those, fall back to the capability that the
 * owning provider stamped on the task at creation time (`owner.capability`,
 * providers.js) — if the task is visible to this unrecognised role at all,
 * it's because that role holds this exact capability, so treat it as theirs
 * rather than defaulting to "someone else's."
 */
export function splitTasksByOwnership(tasks, role) {
  if (isBypassRole(role)) return { mine: tasks, team: [] };

  const isLegacyRole = Object.prototype.hasOwnProperty.call(ROLE_LABELS, role);
  const isMine = t => !t.owner?.id || t.owner.id === role || (!isLegacyRole && Boolean(t.owner?.capability));

  const mine = tasks.filter(isMine);
  const team = tasks.filter(t => !isMine(t));
  return { mine, team };
}

export { PROVIDERS };
