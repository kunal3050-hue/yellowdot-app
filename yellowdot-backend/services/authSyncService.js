/**
 * authSyncService.js — builds the /api/auth/sync-user response.
 *
 * Takes ONLY the server-resolved `req.user` object (built entirely by
 * authMiddleware from Firestore/token data: direct users/{uid} lookup ->
 * email fallback -> parent match via students collection -> "unknown").
 * Deliberately never accepts req.body, so a client can never influence
 * role/permissions/schoolId/tenantId by supplying them in the request --
 * there is no code path here that could read them even by mistake.
 */
function buildSyncUserResponse(user) {
  const { userId, email, name, photoUrl, role, schoolId, centerId, center, student } = user || {};

  if (!role || role === "unknown") {
    // Genuinely unregistered. No Firestore doc is written here -- creating
    // one (even without a role field) would make authMiddleware's direct-UID
    // lookup treat the account as "resolved" on the next request and default
    // it to a staff role. Staying unknown until an admin provisions the
    // account via POST /api/users is the only safe behavior.
    return {
      success: true,
      user: { userId, email: email || "", name: name || "", photoUrl: photoUrl || "", role: "unknown" },
      profileMissing: true,
      message: "Your account was authenticated but your profile is not set up yet. Contact your administrator.",
    };
  }

  return {
    success: true,
    user: {
      userId,
      email:    email    || "",
      name:     name     || "",
      photoUrl: photoUrl || "",
      role,
      schoolId: schoolId || "",
      center:   centerId || center || "",
      ...(role === "parent" && student ? { student } : {}),
    },
  };
}

module.exports = { buildSyncUserResponse };
