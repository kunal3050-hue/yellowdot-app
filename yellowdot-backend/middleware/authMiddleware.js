/**
 * authMiddleware.js — Firebase ID token verification
 * ────────────────────────────────────────────────────
 * Verifies the Firebase ID token sent in the Authorization header.
 *
 * Attaches to req.user:
 *   userId, email, role, schoolId, centerId, centers[],
 *   name, photoUrl, permissions, student (parents only)
 *
 * Role resolution order:
 *   1. Firestore users/{uid}               → staff user (direct UID match)
 *   1b. Firestore users where email==email → handles Google OAuth UID mismatch
 *       (Firebase creates a new UID for Google sign-in when the email already
 *        has a password-based account; email fallback finds the existing profile.
 *        A Firestore doc for the new Google UID is auto-created on first match.)
 *   2. students collection                 → parent (fatherEmail / motherEmail)
 *   3. No match                            → role = "unknown", profileMissing = true
 *
 * schoolId resolution:
 *   1. User doc has schoolId field   → use it
 *   2. SCHOOL_ID env var             → use it
 *   3. Default "yd-main"
 *
 * Debug logs: every resolution step is logged with [AUTH-DEBUG] prefix.
 */

const { auth, db }       = require("../firebaseAdmin");
const { isBypassRole, ROLE_PERMISSIONS } = require("../config/permissionsBackend");
const roleSvc            = require("../services/roleService");

const DEFAULT_SCHOOL_ID  = process.env.SCHOOL_ID || "yd-main";

// ── Internal helpers ───────────────────────────────────────────────

/**
 * Build req.user from a Firestore user document snapshot/data + the decoded token.
 * Logs any missing critical fields so they appear clearly in server logs.
 */
async function _buildUserFromDoc(uid, docData, decoded) {
  const missingFields = [];
  if (!docData.role)                      missingFields.push("role");
  if (!docData.schoolId)                  missingFields.push("schoolId");
  if (!docData.centerId && !docData.center) missingFields.push("centerId/center");
  if (!docData.name)                      missingFields.push("name");

  if (missingFields.length > 0) {
    console.warn(
      `[AUTH-DEBUG] User doc users/${uid} is missing fields: [${missingFields.join(", ")}]` +
      ` — email=${decoded.email || "(none)"} role=${docData.role || "(missing)"}`,
    );
  }

  const _role    = docData.role    || "teacher";
  const _schoolId = docData.schoolId || DEFAULT_SCHOOL_ID;

  console.log(
    `[AUTH-DEBUG] Profile resolved — uid=${uid} email=${decoded.email || ""}` +
    ` role=${_role} schoolId=${_schoolId} centerId=${docData.centerId || docData.center || "(none)"}`,
  );

  return {
    userId:    uid,
    email:     decoded.email || docData.email || "",
    role:      _role,
    schoolId:  _schoolId,
    centerId:  docData.centerId || docData.center || "",
    center:    docData.centerId || docData.center || "",
    centers:   Array.isArray(docData.centers) ? docData.centers
               : (docData.center ? [docData.center] : []),
    name:      docData.name    || decoded.name    || "",
    photoUrl:  docData.photoUrl || decoded.picture || "",
    permissions: await roleSvc.getPermissionsForRole(_role, _schoolId),
    roleMatrix:  await roleSvc.getRoleMatrix(_role, _schoolId),
  };
}

// ── Middleware ─────────────────────────────────────────────────────

async function authenticate(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required." });
  }

  const token = authHeader.slice(7);

  try {
    const decoded = await auth.verifyIdToken(token);
    const uid     = decoded.uid;
    const email   = (decoded.email || "").toLowerCase();

    console.log(`[AUTH-DEBUG] Token verified — uid=${uid} email=${decoded.email || "(none)"} provider=${decoded.firebase?.sign_in_provider || "?"}`);

    // ── 1. Direct UID lookup in Firestore users collection ────────────────────
    const userDoc = await db.collection("users").doc(uid).get();
    console.log(`[AUTH-DEBUG] Firestore users/${uid} → exists=${userDoc.exists}`);

    if (userDoc.exists) {
      req.user = await _buildUserFromDoc(uid, userDoc.data(), decoded);
      return next();
    }

    // ── 1b. Email-based fallback ───────────────────────────────────────────────
    // Handles: admin pre-creates user with password auth → user signs in with
    // Google → Firebase Email Enumeration Protection creates a new UID.
    // We find the profile by email and auto-link the new Google UID to it.
    if (email) {
      console.log(`[AUTH-DEBUG] UID lookup miss — trying email fallback for ${email}`);
      const emailSnap = await db.collection("users")
        .where("email", "==", email)
        .limit(1)
        .get();

      if (!emailSnap.empty) {
        const matchedDoc  = emailSnap.docs[0];
        const matchedData = matchedDoc.data();
        const originalUid = matchedDoc.id;

        console.warn(
          `[AUTH-DEBUG] UID MISMATCH — email=${email}` +
          ` uid_in_token=${uid} uid_in_doc=${originalUid}` +
          ` provider=${decoded.firebase?.sign_in_provider || "?"}` +
          ` — auto-linking Google UID to existing profile.`,
        );

        // Build req.user using the matched profile data but the CURRENT uid
        req.user = await _buildUserFromDoc(uid, matchedData, decoded);

        // Fire-and-forget: create a Firestore doc for the Google UID so future
        // sign-ins hit the direct UID lookup (path 1) instead of this fallback.
        db.collection("users").doc(uid).set(
          {
            ...matchedData,
            userId:      uid,            // update to Google UID
            linkedUid:   originalUid,    // keep audit trail to the original UID
            updatedAt:   new Date().toISOString(),
          },
          { merge: true },
        ).then(() =>
          console.log(`[AUTH-DEBUG] Auto-linked Google UID ${uid} to profile of ${email} (original uid: ${originalUid})`),
        ).catch(err =>
          console.error(`[AUTH-DEBUG] Auto-link write failed:`, err.message),
        );

        return next();
      }

      console.log(`[AUTH-DEBUG] Email fallback miss — no users doc with email=${email}`);
    }

    // ── 2. Authenticated but no matching staff profile found ──────────────────
    console.warn(
      `[AUTH-DEBUG] PROFILE MISSING — uid=${uid} email=${decoded.email || "(none)"}` +
      ` provider=${decoded.firebase?.sign_in_provider || "?"}` +
      ` — No Firestore staff doc or parent email match found.` +
      ` Ensure admin has created a user with POST /api/users for this email.`,
    );

    req.user = {
      userId:       uid,
      email:        decoded.email || "",
      role:         "unknown",
      schoolId:     DEFAULT_SCHOOL_ID,
      centerId:     "",
      center:       "",
      centers:      [],
      name:         decoded.name || "",
      photoUrl:     decoded.picture || "",
      permissions:  [],
      profileMissing: true,   // surfaced to frontend for user-friendly error
    };
    next();

  } catch (err) {
    if (err.code === "auth/id-token-expired") {
      return res.status(401).json({
        error: "Session expired. Please log in again.",
        code:  "TOKEN_EXPIRED",
      });
    }
    console.error("[auth-middleware] Token verification failed:", err.message);
    return res.status(401).json({ error: "Invalid authentication token." });
  }
}

// ── Authorization helpers ──────────────────────────────────────────

/**
 * Role-based access — allow if user's role is in the allowed list.
 * Bypass roles (developer, super_admin) always pass.
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Authentication required." });
    if (isBypassRole(req.user.role)) return next();
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "You do not have access to this resource." });
    }
    next();
  };
}

/**
 * Permission-based access — allow if user has the named route permission.
 */
function authorizeRoute(routeKey) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Authentication required." });
    if (isBypassRole(req.user.role)) return next();
    const perms = req.user.permissions || [];
    if (!perms.includes("*") && !perms.includes(routeKey)) {
      return res.status(403).json({ error: "You do not have access to this module." });
    }
    next();
  };
}

function getPermissions(role) {
  return ROLE_PERMISSIONS[role] || [];
}

// ── Security guards ────────────────────────────────────────────────

/**
 * blockUnknown — rejects Firebase-authenticated users who have no matching
 * staff record OR parent link in Firestore. Prevents "ghost" accounts from
 * reading any data.
 */
function blockUnknown(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Authentication required." });
  if (req.user.role === "unknown") {
    return res.status(403).json({
      error: "Your account is not registered in this system. Contact your administrator.",
      code:  "ACCOUNT_NOT_REGISTERED",
    });
  }
  next();
}

/**
 * staffOnly — allows only registered staff roles through. Blocks:
 *   - "unknown" (not registered)
 *   - "parent"  (must use the parent-specific endpoints)
 * Bypass roles (developer, super_admin) always pass.
 */
function staffOnly(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Authentication required." });
  if (isBypassRole(req.user.role)) return next();
  if (req.user.role === "unknown") {
    return res.status(403).json({
      error: "Your account is not registered in this system. Contact your administrator.",
      code:  "ACCOUNT_NOT_REGISTERED",
    });
  }
  if (req.user.role === "parent") {
    return res.status(403).json({
      error: "Parents cannot access staff-only resources.",
      code:  "PARENT_ACCESS_DENIED",
    });
  }
  next();
}

module.exports = { authenticate, authorize, authorizeRoute, blockUnknown, staffOnly };
