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
      req.user = {
        userId:    uid,
        email:     decoded.email || u.email || "",
        role:      u.role        || "teacher",
        schoolId:  u.schoolId    || DEFAULT_SCHOOL_ID,
        centerId:  u.centerId    || u.center || "",
        center:    u.centerId    || u.center || "",
        centers:   Array.isArray(u.centers) ? u.centers : (u.center ? [u.center] : []),
        name:      u.name        || decoded.name    || "",
        photoUrl:  u.photoUrl    || decoded.picture || "",
        permissions: getPermissions(u.role),
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
          permissions: getPermissions("parent"),
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

module.exports = { authenticate, authorize, authorizeRoute };
