/**
 * authRoutes.js — Firebase-backed authentication endpoints
 * ──────────────────────────────────────────────────────────
 * Login / signup is handled client-side by the Firebase Auth SDK.
 * These routes handle profile lookup and session management.
 *
 * GET  /api/auth/me            — Verify Firebase token, return profile + permissions
 * POST /api/auth/logout        — Write audit log (token revoked client-side)
 * POST /api/auth/select-center — Switch active center (multi-center staff)
 */

const express = require("express");
const router  = express.Router();
const { db, auth } = require("../firebaseAdmin");
const { authenticate } = require("../middleware/authMiddleware");
const { ROLE_HOME, ROLE_PERMISSIONS, isBypassRole } = require("../config/permissionsBackend");

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
// Verifies the Firebase ID token and returns the user's profile + permissions.
// Called immediately after every Firebase Auth sign-in.
router.get("/api/auth/me", authenticate, async (req, res) => {
  try {
    const { userId, role, name, email, photoUrl, centers, center, student } = req.user;

    const permissions = ROLE_PERMISSIONS[role] || [];
    const homeRoute   = ROLE_HOME[role]        || "/";

    const response = {
      user: {
        userId,
        name,
        email,
        role,
        center:       center || centers?.[0] || "",
        centers:      centers || [],
        activeCenter: center || centers?.[0] || null,
        photoUrl:     photoUrl || "",
        homeRoute,
        ...(role === "parent" && student ? { student } : {}),
      },
      permissions,
      homeRoute,
      requiresCenterSelect: centers?.length > 1 && !center,
    };

    return res.json(response);
  } catch (err) {
    console.error("[AUTH /me]", err);
    return res.status(500).json({ error: "Failed to fetch user profile." });
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
// Writes an audit log. Token revocation happens client-side via Firebase Auth.
router.post("/api/auth/logout", authenticate, async (req, res) => {
  try {
    await db.collection("auditLogs").add({
      userId:    req.user.userId,
      action:    "LOGOUT",
      email:     req.user.email || "",
      ip:        req.ip || "",
      timestamp: new Date().toISOString(),
    });
  } catch { /* non-fatal */ }

  return res.json({ success: true });
});

// ── POST /api/auth/select-center ──────────────────────────────────────────────
// Saves the chosen center to the user doc and returns the updated profile.
router.post("/api/auth/select-center", authenticate, async (req, res) => {
  try {
    const { centerId } = req.body;
    if (!centerId) {
      return res.status(400).json({ error: "centerId is required." });
    }

    // Persist to Firestore
    await db.collection("users").doc(req.user.userId).update({
      center: centerId,
    });

    return res.json({ success: true, activeCenter: centerId });
  } catch (err) {
    console.error("[AUTH /select-center]", err);
    return res.status(500).json({ error: "Failed to switch center." });
  }
});

// ── POST /api/auth/sync-user ──────────────────────────────────────────────────
// Called after first Google/Email sign-up to create the Firestore user doc.
// Safe to call repeatedly (upsert).
router.post("/api/auth/sync-user", authenticate, async (req, res) => {
  try {
    const { userId, email, name, photoUrl } = req.user;
    const { role, center } = req.body;

    const userRef = db.collection("users").doc(userId);
    const snap    = await userRef.get();

    if (!snap.exists) {
      // New user — create doc with provided or default role
      await userRef.set({
        userId,
        email:     email   || "",
        name:      name    || "",
        photoUrl:  photoUrl || "",
        role:      role    || "teacher",
        center:    center  || "",
        centers:   center  ? [center] : [],
        status:    "active",
        createdAt: new Date().toISOString(),
      });
    }

    const updated = await userRef.get();
    return res.json({ success: true, user: updated.data() });
  } catch (err) {
    console.error("[AUTH /sync-user]", err);
    return res.status(500).json({ error: "Failed to sync user." });
  }
});

module.exports = router;
