/**
 * requestScope.js — pure request-scoping helpers shared by server.js routes.
 * No Firestore/Express dependency, so these are directly unit-testable.
 */

// Resolve school + center context from authenticated request. schoolId always
// comes from req.user.schoolId (set by authMiddleware from the verified
// Firestore/token identity) — never from client-supplied query/body, which
// is what keeps every route below tenant-isolated.
function resolveContext(req) {
  return {
    schoolId:    req.user?.schoolId || process.env.SCHOOL_ID || "yd-main",
    centerId:    req.query?.centerId || req.user?.centerId   || "",
    actorUserId: req.user?.userId   || "system",
  };
}

module.exports = { resolveContext };
