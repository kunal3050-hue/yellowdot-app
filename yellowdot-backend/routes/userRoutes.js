/**
 * userRoutes.js — Staff user management REST API
 * ─────────────────────────────────────────────────
 * All routes require a valid Firebase ID token.
 * Mutations (POST/PUT/DELETE) require admin or higher.
 *
 * GET    /api/users                        List users (schoolId-scoped)
 * GET    /api/users/:userId                Get single user
 * POST   /api/users                        Create user (creates Firebase Auth + Firestore doc)
 * PUT    /api/users/:userId                Update user fields
 * DELETE /api/users/:userId                Soft-deactivate (status → "inactive")
 * POST   /api/users/:userId/reactivate     Re-activate a deactivated user
 * POST   /api/users/:userId/reset-password Send password-reset email
 */

const express  = require("express");
const crypto   = require("crypto");
const router   = express.Router();
const svc      = require("../services/userService");
const { auth } = require("../firebaseAdmin");
const { authenticate, authorize, staffOnly } = require("../middleware/authMiddleware");

/**
 * Generate a random temporary password that satisfies Firebase's
 * minimum-6-character requirement and is memorable enough to share.
 * Format: Adjective + Noun + 4-digit number  (e.g. "Blue-Falcon-4821")
 */
function generateTempPassword() {
  const adj  = ["Blue","Red","Gold","Star","Bright","Bold","Cool","Swift","Sharp","Clear"];
  const noun = ["Falcon","Tiger","Eagle","River","Stone","Cloud","Arrow","Storm","Flash","Light"];
  const num  = String(crypto.randomInt(1000, 9999));
  const a = adj[crypto.randomInt(0, adj.length)];
  const n = noun[crypto.randomInt(0, noun.length)];
  return `${a}-${n}-${num}`;
}

// ── All user routes require a registered staff account ─────────────
// Path-scoped so this guard only runs for /api/users/* — a path-less
// router.use() would 403 EVERY request (incl. parent routes) because the
// router is mounted at the app root via app.use().
router.use("/api/users", authenticate, staffOnly);

// center_owner has the same privilege level as center_admin
const ADMIN_ROLES  = ["admin", "center_admin", "center_owner", "super_admin", "developer"];
const MANAGE_ROLES = ["admin", "center_admin", "center_owner", "super_admin", "developer"];

// ── Friendly Firebase Auth error messages ──────────────────────────
const AUTH_ERR = {
  "auth/invalid-email":          "Invalid email address format.",
  "auth/email-already-exists":   "A user with this email already exists.",
  "auth/invalid-password":       "Password must be at least 6 characters.",
  "auth/operation-not-allowed":  "Email/password sign-in is not enabled in this project.",
  "auth/uid-already-exists":     "A user with this ID already exists.",
  "auth/phone-number-already-exists": "A user with this phone number already exists.",
};

function friendlyAuthError(err) {
  return AUTH_ERR[err.code] || err.message || "Authentication service error.";
}

// ── GET /api/users ─────────────────────────────────────────────────

router.get("/api/users", authorize(...ADMIN_ROLES), async (req, res) => {
  try {
    const { centerId, role, status } = req.query;
    const users = await svc.getAll({
      schoolId: req.user.schoolId,
      centerId,
      role,
      status,
    });
    res.json({ success: true, users });
  } catch (err) {
    console.error("[GET /api/users]", err.message);
    res.status(500).json({ success: false, error: "Failed to fetch users." });
  }
});

// ── GET /api/users/:userId ─────────────────────────────────────────

router.get("/api/users/:userId", authorize(...ADMIN_ROLES), async (req, res) => {
  try {
    const user = await svc.getOne(req.params.userId);
    if (!user) return res.status(404).json({ success: false, error: "User not found." });
    res.json({ success: true, user });
  } catch (err) {
    console.error("[GET /api/users/:userId]", err.message);
    res.status(500).json({ success: false, error: "Failed to fetch user." });
  }
});

// ── POST /api/users ────────────────────────────────────────────────
//
// Flow:
//   1. Validate required fields (name, email)
//   2. Create Firebase Auth user  → get UID
//      If email already registered in Auth, load their existing UID instead
//   3. Write/upsert Firestore user document with that UID
//   4. Generate password-setup link (non-blocking; logged for now)
//   5. Return the created user record

router.post("/api/users", authorize(...MANAGE_ROLES), async (req, res) => {
  try {
    const body = req.body || {};
    const {
      name, email, role,
      centers, phone, mobile,
      centerId, center,
    } = body;

    // ── 1. Input validation ──────────────────────────────────────
    const errs = [];
    if (!email || !email.trim())   errs.push("Email address is required.");
    if (!name  || !name.trim())    errs.push("Full name is required.");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.push("Email address format is invalid.");
    }
    if (errs.length) {
      return res.status(400).json({ success: false, error: errs.join(" ") });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName  = name.trim();

    // ── 2. Create / locate Firebase Auth user ───────────────────
    let authUser;
    let isNewAuthUser = false;
    const tempPassword = generateTempPassword();

    try {
      authUser = await auth.createUser({
        email:         cleanEmail,
        displayName:   cleanName,
        password:      tempPassword,   // set a temp password so the account is usable immediately
        emailVerified: false,
      });
      isNewAuthUser = true;
      console.log(`[POST /api/users] Firebase Auth user created: ${cleanEmail} (uid=${authUser.uid})`);
    } catch (authErr) {
      if (authErr.code === "auth/email-already-exists") {
        // Auth account exists — reuse its UID to link/update the Firestore record
        authUser = await auth.getUserByEmail(cleanEmail);
        console.log(`[POST /api/users] Auth user already exists, reusing uid=${authUser.uid} for ${cleanEmail}`);
      } else {
        console.error("[POST /api/users] Firebase Auth error:", authErr.code, authErr.message);
        return res.status(400).json({ success: false, error: friendlyAuthError(authErr) });
      }
    }

    const uid = authUser.uid;

    // ── 3. Resolve center fields ─────────────────────────────────
    const centersArr = Array.isArray(centers) ? centers.filter(Boolean)
                     : typeof centers === "string" && centers.trim()
                       ? centers.split(",").map(s => s.trim()).filter(Boolean)
                       : [];

    const resolvedCenterId = centerId || center || centersArr[0] || "";

    // ── 4. Write Firestore user document ─────────────────────────
    const user = await svc.create(
      {
        uid,
        name:     cleanName,
        email:    cleanEmail,
        role:     role || "teacher",
        centers:  centersArr,
        centerId: resolvedCenterId,
        center:   resolvedCenterId,
        phone:    phone || mobile || "",
        status:   "active",
        schoolId: req.user.schoolId,
      },
      req.user.userId
    );

    // ── 5. Generate password-reset link so user can set their own password ──
    let resetLink = null;
    try {
      resetLink = await auth.generatePasswordResetLink(cleanEmail);
      console.log(`[POST /api/users] Password reset link for ${cleanEmail}:\n  ${resetLink}`);
      // TODO: send via email service (SendGrid, Resend, nodemailer, etc.)
    } catch (e) {
      console.warn(`[POST /api/users] Could not generate password reset link: ${e.message}`);
    }

    res.status(201).json({
      success: true,
      user,
      // Return setup info only for newly created auth accounts
      ...(isNewAuthUser && {
        tempPassword,
        passwordResetSent: !!resetLink,
        note: `Temporary password set. Share it with ${cleanName} and ask them to reset it on first login.`,
      }),
    });

  } catch (err) {
    console.error("[POST /api/users]", err.message);
    const msg = AUTH_ERR[err.code] || err.message || "Failed to create user.";
    const status = err.code?.startsWith("auth/") ? 400 : 500;
    res.status(status).json({ success: false, error: msg });
  }
});

// ── PUT /api/users/:userId ─────────────────────────────────────────

router.put("/api/users/:userId", authorize(...ADMIN_ROLES), async (req, res) => {
  try {
    const body    = req.body || {};
    // Normalise mobile → phone before passing to service
    if (body.mobile !== undefined && body.phone === undefined) {
      body.phone = body.mobile;
    }
    const user = await svc.update(req.params.userId, body, req.user.userId);
    if (!user) return res.status(404).json({ success: false, error: "User not found." });
    res.json({ success: true, user });
  } catch (err) {
    console.error("[PUT /api/users/:userId]", err.message);
    res.status(500).json({ success: false, error: err.message || "Failed to update user." });
  }
});

// ── DELETE /api/users/:userId  (soft delete) ──────────────────────

router.delete("/api/users/:userId", authorize(...MANAGE_ROLES), async (req, res) => {
  try {
    if (req.params.userId === req.user.userId) {
      return res.status(400).json({ success: false, error: "You cannot deactivate your own account." });
    }
    const user = await svc.deactivate(req.params.userId, req.user.userId);
    if (!user) return res.status(404).json({ success: false, error: "User not found." });
    res.json({ success: true, message: "User deactivated.", user });
  } catch (err) {
    console.error("[DELETE /api/users/:userId]", err.message);
    res.status(500).json({ success: false, error: "Failed to deactivate user." });
  }
});

// ── POST /api/users/:userId/reactivate ────────────────────────────

router.post("/api/users/:userId/reactivate", authorize(...MANAGE_ROLES), async (req, res) => {
  try {
    const user = await svc.update(req.params.userId, { status: "active" }, req.user.userId);
    if (!user) return res.status(404).json({ success: false, error: "User not found." });
    res.json({ success: true, message: "User reactivated.", user });
  } catch (err) {
    console.error("[POST /api/users/:userId/reactivate]", err.message);
    res.status(500).json({ success: false, error: "Failed to reactivate user." });
  }
});

// ── POST /api/users/:userId/reset-password ────────────────────────
//
// Generates a Firebase password-reset link for the user's email.
// In production this should be piped through an email service.
// For now the link is logged server-side and the email address returned
// so the caller knows it succeeded.

router.post("/api/users/:userId/reset-password", authorize(...ADMIN_ROLES), async (req, res) => {
  try {
    const user = await svc.getOne(req.params.userId);
    if (!user) return res.status(404).json({ success: false, error: "User not found." });

    const email = user.email;
    if (!email) return res.status(400).json({ success: false, error: "User has no email address on record." });

    const resetLink = await auth.generatePasswordResetLink(email);
    // TODO: send via email service
    console.log(`[POST /api/users/:userId/reset-password] Reset link for ${email}:\n  ${resetLink}`);

    res.json({
      success: true,
      message: `Password reset link generated for ${email}. Link logged server-side.`,
      email,
    });
  } catch (err) {
    console.error("[POST /api/users/:userId/reset-password]", err.message);
    res.status(500).json({ success: false, error: err.message || "Failed to generate password reset link." });
  }
});

module.exports = router;
