/**
 * capabilities.js — the capability model
 * ─────────────────────────────────────────────────────────────────────
 * PLATFORM ARCHITECTURE §2a / §2c.1 — docs/platform-architecture/PLATFORM_ARCHITECTURE.md
 *
 * A capability is "<module>.<action>" — e.g. "attendance.view". This is the
 * shape already stored in Firestore (`roles/{id}.permissions`) and already
 * delivered to the client as `roleMatrix`, addressed as a string. No data
 * migration is involved.
 *
 * ── Levels, not booleans (§2c.1) ──────────────────────────────────────────
 * A capability resolves to a LEVEL, not a yes/no:
 *
 *     none  →  no access
 *     self  →  only rows about me
 *     team  →  my direct reports (via staff.reportingManagerId), plus me
 *     all   →  every row, bounded by the branch/class scope gate
 *
 * Backward compatible by construction: legacy `true` reads as "all" and
 * `false` as "none", so every existing role document keeps its exact current
 * meaning and `canDo()` keeps returning the same booleans it returns today.
 *
 * The level answers WHOSE records. It is a different axis from the branch /
 * class scope (§2c gate 3), which answers WHERE. They compose by intersection.
 */

/** Ordered weakest → strongest. Order is meaningful: index is the rank. */
export const LEVELS = ["none", "self", "team", "all"];

/** Lowest level that still grants some access — the default `can()` threshold. */
export const MIN_GRANTED = "self";

/**
 * Coerce a stored matrix value into a level.
 * Accepts the legacy booleans and the new level strings; anything
 * unrecognised is treated as "none" (fail closed, never fail open).
 */
export function normalizeLevel(value) {
  if (value === true) return "all";
  if (value === false || value == null) return "none";
  return LEVELS.includes(value) ? value : "none";
}

export function levelRank(value) {
  return LEVELS.indexOf(normalizeLevel(value));
}

/** Is `actual` at least as strong as `required`? ("all" satisfies "team".) */
export function levelAtLeast(actual, required) {
  return levelRank(actual) >= levelRank(required);
}

/**
 * A capability contains a dot; a legacy routeKey does not. This is what lets
 * can() accept both during the migration without an explicit mode flag.
 */
export function isCapability(value) {
  return typeof value === "string" && value.includes(".");
}

export function parseCapability(capability) {
  const dot = capability.indexOf(".");
  return { moduleId: capability.slice(0, dot), action: capability.slice(dot + 1) };
}

/**
 * Resolve a capability to its level against a roleMatrix.
 *
 * Supports "module.*" — the strongest level held on any action of that module,
 * which is the useful reading for "may this user touch this module at all".
 *
 * @param {object} roleMatrix  { moduleId: { action: bool|level } }, may carry _bypass
 * @param {string} capability  "attendance.view" | "attendance.*"
 * @returns {"none"|"self"|"team"|"all"}
 */
export function resolveLevel(roleMatrix, capability) {
  if (!roleMatrix || !isCapability(capability)) return "none";
  if (roleMatrix._bypass) return "all";

  const { moduleId, action } = parseCapability(capability);
  const mod = roleMatrix[moduleId];
  if (!mod) return "none";

  if (action === "*") {
    return Object.values(mod).reduce(
      (best, v) => (levelRank(v) > levelRank(best) ? normalizeLevel(v) : best),
      "none",
    );
  }
  return normalizeLevel(mod[action]);
}

/**
 * Boolean check. `required` defaults to MIN_GRANTED, so can("x.view") means
 * "holds any level above none" — which is exactly the old boolean semantics.
 *
 * Accepts an array as an ANY-OF.
 */
export function checkCapability(roleMatrix, capability, required = MIN_GRANTED) {
  if (Array.isArray(capability)) {
    return capability.some(c => checkCapability(roleMatrix, c, required));
  }
  return levelAtLeast(resolveLevel(roleMatrix, capability), required);
}
