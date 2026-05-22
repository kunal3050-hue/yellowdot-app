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
 *   1. Firestore users/{uid}  → staff user (role from doc)
 *   2. students collection    → parent (email matches fatherEmail/motherEmail)
 *   3. No match               → role = "unknown"
 *
 * schoolId resolution:
 *   1. User doc has schoolId field   → use it
 *   2. SCHOOL_ID env var             → use it
 *   3. Default "yd-main"
 */

const { auth, db }       = require("../firebaseAdmin");
const { isBypassRole, ROLE_PERMISSIONS } = require("../config/permissionsBackend");
const roleSvc            = require("../services/roleService");

const DEFAULT_SCHOOL_ID  = process.env.SCHOOL_ID || "yd-main";

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

    // ── 1. Staff user in Firestore users collection ───────────────────────────
    const userDoc = await db.collection("users").doc(uid).get();
    if (userDoc.exists) {
      const u = userDoc.data();
      const _schoolId = u.schoolId || DEFAULT_SCHOOL_ID;
      const _role     = u.role    || "teacher";
      req.user = {
        userId:    uid,
        email:     decoded.email || u.email || "",
        role:      _role,
        schoolId:  _schoolId,
        centerId:  u.centerId    || u.center || "",
        center:    u.centerId    || u.center || "",
        centers:   Array.isArray(u.centers) ? u.centers : (u.center ? [u.center] : []),
        name:      u.name        || decoded.name    || "",
        photoUrl:  u.photoUrl    || decoded.picture || "",
        permissions: await roleSvc.getPermissionsForRole(_role, _schoolId),
        roleMatrix:  await roleSvc.getRoleMatrix(_role, _schoolId),
      };
      return next();
    }

    // ── 2. Parent — email match in students collection ────────────────────────
    if (email) {
      let studentDoc = null;

      const fatherSnap = await db.collection("students")
        .where("fatherEmail", "==", email)
        .limit(1)
        .get();

      if (!fatherSnap.empty) {
        studentDoc = fatherSnap.docs[0].data();
      } else {
        const motherSnap = await db.collection("students")
          .where("motherEmail", "==", email)
          .limit(1)
          .get();
        if (!motherSnap.empty) studentDoc = motherSnap.docs[0].data();
      }

      if (studentDoc) {
        const resolvedCenter = studentDoc.centerId || studentDoc.center || "";
        req.user = {
          userId:    uid,
          email:     decoded.email || "",
          role:      "parent",
          schoolId:  studentDoc.schoolId || DEFAULT_SCHOOL_ID,
          centerId:  resolvedCenter,
          center:    resolvedCenter,
          centers:   [resolvedCenter].filter(Boolean),
          name:      decoded.name    || "",
          photoUrl:  decoded.picture || "",
          student:   {
            studentId:   studentDoc.studentId,
            studentName: studentDoc.studentName,
          },
          permissions: await roleSvc.getPermissionsForRole("parent", studentDoc.schoolId || DEFAULT_SCHOOL_ID),
        };
        return next();
      }
    }

    // ── 3. Authenticated but not registered in the system ─────────────────────
    req.user = {
      userId:    uid,
      email:     decoded.email || "",
      role:      "unknown",
      schoolId:  DEFAULT_SCHOOL_ID,
      centerId:  "",
      center:    "",
      centers:   [],
      name:      decoded.name || "",
      photoUrl:  decoded.picture || "",
      permissions: [],
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

/**
 * requireOwnChild — for parent-facing endpoints.
 * - Bypass roles pass through with no restriction.
 * - Non-parent roles (staff) receive a 403.
 * - Parent must have a linked student; if a studentId is present in
 *   params/query/body it must match the linked child.
 * Sets req.ownChildId = linkedStudentId so controllers can use it directly.
 */
function requireOwnChild(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Authentication required." });
  if (isBypassRole(req.user.role)) return next(); // developers / super_admin see all

  if (req.user.role !== "parent") {
    return res.status(403).json({
      error: "This endpoint is for parents only.",
      code:  "STAFF_ACCESS_DENIED",
    });
  }

  const linkedId = req.user.student?.studentId;
  if (!linkedId) {
    return res.status(403).json({
      error: "No student linked to this parent account. Contact your administrator.",
      code:  "NO_LINKED_STUDENT",
    });
  }

  // If a studentId was supplied, it must match the linked child
  const requestedId =
    req.params.studentId ||
    req.params.id        ||
    req.query.studentId  ||
    req.body?.studentId;

  if (requestedId && requestedId !== linkedId) {
    return res.status(403).json({
      error: "You can only access your own child's records.",
      code:  "CHILD_SCOPE_VIOLATION",
    });
  }

  req.ownChildId = linkedId; // controllers read this instead of req.body/query
  next();
}

module.exports = { authenticate, authorize, authorizeRoute, blockUnknown, staffOnly, requireOwnChild };
