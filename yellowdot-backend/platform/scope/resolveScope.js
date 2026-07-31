/**
 * resolveScope.js — the hierarchical scope ladder, server side
 * ─────────────────────────────────────────────────────────────────────
 * PLATFORM ARCHITECTURE §2c.1 — docs/platform-architecture/PLATFORM_ARCHITECTURE.md
 *
 *   none < self < team < classroom < department < branch < school < tenant < platform
 *
 * Two distinct jobs, deliberately separated:
 *
 *   buildScope(user)          — WHAT the caller is: their ids at every rung.
 *   scopeFilterFor(level, s)  — GIVEN a capability's level, the filter to apply.
 *
 * The second is the one that matters for security. A capability's level says
 * how wide a query may be; this turns that into a concrete predicate resolved
 * ENTIRELY from the authenticated user. A client-supplied branch or student id
 * is never an input here — that is the difference between access control and a
 * UI convenience.
 */

const LEVELS = [
  "none", "self", "team", "classroom",
  "department", "branch", "school", "tenant", "platform",
];

const levelRank = level => {
  const i = LEVELS.indexOf(level);
  return i === -1 ? 0 : i;
};

const levelAtLeast = (actual, required) => levelRank(actual) >= levelRank(required);

/** Legacy matrix values: `true` means school-wide, which is what it means today. */
function normalizeLevel(value) {
  if (value === true) return "school";
  if (value === false || value == null) return "none";
  return LEVELS.includes(value) ? value : "none";
}

/**
 * Assemble the caller's scope from their already-loaded user document.
 *
 * PHASE 2 SCOPE OF WORK — read this before assuming a rung is populated.
 * Only the rungs derivable WITHOUT extra Firestore reads are filled here,
 * because this runs on every authenticated request and a per-request fan-out
 * would be a real cost:
 *
 *   platform / tenantId / schoolId / branchIds / self   → always populated
 *   departmentIds                                        → from the staff doc, if present
 *   classIds                                             → from the staff doc, if present
 *   teamIds                                              → NOT populated here (see below)
 *
 * `teamIds` requires a reverse lookup over staff.reportingManagerId. It is
 * resolved lazily by resolveTeamIds() and only by endpoints that actually
 * serve a `team`-level capability — today that is leave approval and
 * performance review, the two cases the Backend Capability Audit confirmed
 * have a real named owner. Everything else never pays for it.
 */
function buildScope(user = {}, { isBypass = false } = {}) {
  const branchIds = Array.isArray(user.centers) && user.centers.length
    ? user.centers.filter(Boolean)
    : [user.centerId || user.center].filter(Boolean);

  return {
    platform:      Boolean(isBypass),
    tenantId:      user.tenantId  || user.schoolId || null,   // see §2c.1 caveat 1
    schoolId:      user.schoolId  || null,
    branchIds,
    departmentIds: [user.departmentId].filter(Boolean),
    classIds:      Array.isArray(user.classIds) ? user.classIds.filter(Boolean) : [],
    teamIds:       null,                                       // lazily resolved — see above
    self:          user.userId || null,
  };
}

/**
 * Turn a capability level into a query filter.
 *
 * Returns `{ field, values }` describing the narrowing to apply, or `null` for
 * "no narrowing" (school and above, which the schoolId filter already bounds).
 * `deny: true` means the caller holds no access at all and the endpoint must
 * return empty or 403 — never an unfiltered result.
 */
function scopeFilterFor(level, scope) {
  const normalized = normalizeLevel(level);

  switch (normalized) {
    case "none":
      return { deny: true };
    case "self":
      return { field: "staffId",      values: [scope.self].filter(Boolean) };
    case "team":
      // null teamIds means the caller forgot to resolve them. Fail CLOSED:
      // an unresolved team must never widen into "everyone".
      return { field: "staffId",      values: scope.teamIds ?? [] };
    case "classroom":
      return { field: "classId",      values: scope.classIds };
    case "department":
      return { field: "departmentId", values: scope.departmentIds };
    case "branch":
      return { field: "centerId",     values: scope.branchIds };
    case "school":
    case "tenant":
      // Every query is already bounded by schoolId upstream; these rungs add
      // no further narrowing. They differ only for a future multi-school
      // tenant — see §2c.1 caveat 1.
      return null;
    case "platform":
      return scope.platform ? null : { deny: true };
    default:
      return { deny: true };
  }
}

/**
 * Resolve direct reports for a manager. Callers must pass their own Firestore
 * handle so this module stays dependency-free and unit-testable.
 *
 * Includes the manager themselves: "my team" in every product sense means my
 * reports AND me — a manager viewing team leave expects to see their own.
 */
async function resolveTeamIds(db, { schoolId, managerUserId }) {
  if (!schoolId || !managerUserId) return [];
  const snap = await db.collection("staff")
    .where("schoolId", "==", schoolId)
    .where("reportingManagerId", "==", managerUserId)
    .get();
  const ids = snap.docs.map(d => d.data()?.userId || d.id).filter(Boolean);
  return [...new Set([managerUserId, ...ids])];
}

module.exports = {
  LEVELS, levelRank, levelAtLeast, normalizeLevel,
  buildScope, scopeFilterFor, resolveTeamIds,
};
