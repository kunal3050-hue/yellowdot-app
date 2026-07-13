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

/**
 * Returns the timeline entry that is active right now for this camera, or null.
 * A camera without a timeline[] falls back to the static classrooms[] model.
 * @param {{ timeline?: Array }} camera
 * @param {Date} [now]
 * @returns {{ id, classroom, days, startTime, endTime } | null}
 */
function getActiveTimelineEntry(camera, now = new Date()) {
  if (!Array.isArray(camera.timeline) || !camera.timeline.length) return null;
  const day  = now.getDay();                                  // 0=Sun … 6=Sat
  const mins = now.getHours() * 60 + now.getMinutes();
  return camera.timeline.find(e => {
    if (!Array.isArray(e.days) || !e.days.includes(day)) return false;
    const [sh, sm] = (e.startTime || "00:00").split(":").map(Number);
    const [eh, em] = (e.endTime   || "23:59").split(":").map(Number);
    return mins >= sh * 60 + sm && mins < eh * 60 + em;
  }) || null;
}

function sameCenter(user, camera) {
  // Bypass roles already handled by caller. Center match is exact; empty
  // camera center is treated as "unscoped" and only visible to bypass/center-wide
  // admins of the same (empty) center — keep strict to avoid leaks.
  return norm(user.centerId) === norm(camera.centerId);
}

function sameSchool(user, camera) {
  return norm(user.schoolId) === norm(camera.schoolId);
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

  // Tenant check first, for every role including bypass roles. "developer"/
  // "super_admin" here are school-scoped staff roles (they bypass the
  // CENTER-level restriction below, not the school boundary) -- distinct
  // from the platform-level Super Admin, which is a separate mechanism
  // entirely. "All centers" in this module's scope model has always meant
  // "all centers within the caller's own school."
  if (!sameSchool(user, camera)) {
    return { allowed: false, reason: "different-school", scope: "none" };
  }

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

  // parent + any other role: no STAFF access. Parent access is evaluated by
  // canParentViewCamera() (presence-gated) — not here.
  return { allowed: false, reason: "role-not-permitted", scope: "none" };
}

/**
 * Parent access to a camera (Phase 3). Distinct from staff scoping: a parent
 * may view ONLY a camera mapped to their own child's classroom, and ONLY while
 * the child is present. Presence + child are resolved by the caller (controller)
 * and passed in — this function stays pure (no DB).
 *
 * @param {{ studentId, classroom, centerId, schoolId }} child   the parent's linked child
 * @param {{ status }} presence                          getChildStatus() result
 * @param {{ centerId, classroom?, classrooms?, deleted? }} camera
 * @param {{ schoolHoursOpen?:boolean }} [opts]          optional school-hours gate
 * @returns {{ allowed:boolean, reason:string }}
 */
function canParentViewCamera(child, presence, camera, opts = {}) {
  if (!child || !child.studentId) return { allowed: false, reason: "no-linked-child" };
  if (!camera || camera.deleted)  return { allowed: false, reason: "camera-unavailable" };
  if (opts.schoolHoursOpen === false) return { allowed: false, reason: "outside-school-hours" };
  if (!presence || presence.status !== "PRESENT") {
    return { allowed: false, reason: presence && presence.status === "CHECKED_OUT" ? "child-checked-out" : "child-not-present" };
  }
  if (norm(child.schoolId) !== norm(camera.schoolId)) {
    return { allowed: false, reason: "different-school" };
  }
  if (norm(child.centerId) !== norm(camera.centerId)) {
    return { allowed: false, reason: "different-center" };
  }

  // Timeline-aware classroom check.
  // Cameras with a timeline[] use time-based routing: only the currently-active
  // entry's classroom is accessible. Cameras without a timeline fall back to the
  // static classrooms[] model (backward-compatible with pre-timeline records).
  if (Array.isArray(camera.timeline) && camera.timeline.length) {
    const now   = opts.now instanceof Date ? opts.now : new Date();
    const entry = getActiveTimelineEntry(camera, now);
    if (!entry) return { allowed: false, reason: "no-active-slot" };
    if (norm(entry.classroom) !== norm(child.classroom)) {
      return { allowed: false, reason: "not-child-classroom" };
    }
  } else {
    const camRooms = cameraClassrooms(camera).map(norm);
    if (!camRooms.includes(norm(child.classroom))) {
      return { allowed: false, reason: "not-child-classroom" };
    }
  }

  return { allowed: true, reason: "present-and-classroom-match" };
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
  canParentViewCamera,
  filterViewableCameras,
  describeScope,
  getActiveTimelineEntry,
  BYPASS_ROLES,
  CENTER_WIDE_ROLES,
  CLASSROOM_SCOPED,
};
