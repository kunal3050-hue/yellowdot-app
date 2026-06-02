/**
 * cctvAccessResolver.js — reusable CCTV visibility / access resolver
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for "which cameras can this user see/stream?".
 * Designed to serve BOTH Phase 2A (staff live view) and Phase 3 (parent access)
 * without refactoring — Phase 3 adds a `parent` branch here, nothing else.
 *
 * It does NOT stream, decrypt, or touch credentials — it only answers
 * authorization questions about camera visibility. Streaming/token issuance
 * layers call canViewCamera() before doing anything sensitive.
 *
 * Scope model (Phase 2A):
 *   developer / super_admin → all cameras, all centers (bypass)
 *   admin / center_admin / center_owner → all cameras in their center
 *   coordinator*            → all cameras in their center
 *   teacher                 → cameras whose classrooms intersect the teacher's
 *                             assigned classrooms, within their center
 *   everyone else / parent  → none (parent handled in Phase 3)
 *
 * * "coordinator" is represented today by center-level admin roles. If a
 *   dedicated `coordinator` role is added later, include it in CENTER_WIDE_ROLES.
 */

const BYPASS_ROLES       = new Set(["developer", "super_admin"]);
// Roles that may view every camera within their own center.
const CENTER_WIDE_ROLES  = new Set(["admin", "center_admin", "center_owner", "coordinator"]);
// Roles scoped to their assigned classrooms only.
const CLASSROOM_SCOPED    = new Set(["teacher"]);

function norm(v) { return String(v == null ? "" : v).trim().toLowerCase(); }

function cameraClassrooms(camera) {
  if (Array.isArray(camera.classrooms) && camera.classrooms.length) return camera.classrooms;
  return camera.classroom ? [camera.classroom] : [];
}

function sameCenter(user, camera) {
  // Bypass roles already handled by caller. Center match is exact; empty
  // camera center is treated as "unscoped" and only visible to bypass/center-wide
  // admins of the same (empty) center — keep strict to avoid leaks.
  return norm(user.centerId) === norm(camera.centerId);
}

/**
 * Can this user view/stream this specific camera?
 * @param {{role, centerId, classrooms?:string[]}} user
 * @param {{centerId, classroom?, classrooms?:string[], status?, deleted?}} camera
 * @returns {{ allowed:boolean, reason:string, scope:string }}
 */
function canViewCamera(user, camera) {
  if (!user || !camera) return { allowed: false, reason: "missing-user-or-camera", scope: "none" };
  if (camera.deleted)   return { allowed: false, reason: "camera-deleted", scope: "none" };

  const role = norm(user.role);

  if (BYPASS_ROLES.has(role)) {
    return { allowed: true, reason: "bypass-role", scope: "all" };
  }

  if (CENTER_WIDE_ROLES.has(role)) {
    return sameCenter(user, camera)
      ? { allowed: true, reason: "center-wide", scope: "center" }
      : { allowed: false, reason: "different-center", scope: "center" };
  }

  if (CLASSROOM_SCOPED.has(role)) {
    if (!sameCenter(user, camera)) {
      return { allowed: false, reason: "different-center", scope: "classroom" };
    }
    const userRooms = (user.classrooms || []).map(norm);
    const camRooms  = cameraClassrooms(camera).map(norm);
    const intersect = camRooms.some(c => userRooms.includes(c));
    return intersect
      ? { allowed: true, reason: "classroom-match", scope: "classroom" }
      : { allowed: false, reason: "classroom-not-assigned", scope: "classroom" };
  }

  // parent + any other role: no staff access (Phase 3 will add a parent branch)
  return { allowed: false, reason: "role-not-permitted", scope: "none" };
}

/**
 * Filter a list of cameras down to those the user may view.
 * @returns {Array} visible cameras
 */
function filterViewableCameras(user, cameras = []) {
  return cameras.filter(c => canViewCamera(user, c).allowed);
}

/**
 * Describe a user's overall CCTV scope (for UI hints / logging).
 * @returns {{ scope:"all"|"center"|"classroom"|"none", role:string }}
 */
function describeScope(user) {
  const role = norm(user && user.role);
  if (BYPASS_ROLES.has(role))      return { scope: "all", role };
  if (CENTER_WIDE_ROLES.has(role)) return { scope: "center", role };
  if (CLASSROOM_SCOPED.has(role))  return { scope: "classroom", role };
  return { scope: "none", role };
}

module.exports = {
  canViewCamera,
  filterViewableCameras,
  describeScope,
  BYPASS_ROLES,
  CENTER_WIDE_ROLES,
  CLASSROOM_SCOPED,
};
