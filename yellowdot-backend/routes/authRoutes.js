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
const roleSvc = require("../services/roleService");

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
// Verifies the Firebase ID token and returns the user's profile + permissions.
// Called immediately after every Firebase Auth sign-in.
router.get("/api/auth/me", authenticate, async (req, res) => {
  try {
    // ── Profile-missing early return ─────────────────────────────────────────
    // authMiddleware sets profileMissing=true when Firebase auth succeeds but
    // no matching Firestore staff doc or parent link was found.
    // Return a structured 200 so the frontend can show a user-friendly message
    // instead of a generic 403 "access denied" screen.
    if (req.user.profileMissing || req.user.role === "unknown") {
      console.warn(
        `[AUTH /me] Profile missing — uid=${req.user.userId} email=${req.user.email}` +
        ` — returning profileMissing response`,
      );
      return res.status(200).json({
        user: {
          userId:   req.user.userId,
          email:    req.user.email,
          name:     req.user.name || "",
          photoUrl: req.user.photoUrl || "",
          role:     "unknown",
          homeRoute: "/profile-incomplete",
        },
        permissions:    [],
        roleMatrix:     {},
        homeRoute:      "/profile-incomplete",
        profileMissing: true,
        message: "Your account was authenticated but your profile is not set up yet. Contact your administrator.",
      });
    }

    const { userId, role, name, email, photoUrl, centers, center, student } = req.user;

    // Use permissions resolved by authMiddleware (Firestore-backed with static fallback).
    // req.user.permissions is set by roleSvc.getPermissionsForRole() — do NOT re-derive
    // from the static ROLE_PERMISSIONS map here, as that would discard dynamic roles.
    const permissions = req.user.permissions || ROLE_PERMISSIONS[role] || [];
    const roleMatrix  = req.user.roleMatrix  || {};
    const homeRoute   = ROLE_HOME[role]      || "/";

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
      roleMatrix,   // granular { moduleId: { action: bool } } for button-level UI enforcement
      homeRoute,
      requiresCenterSelect: centers?.length > 1 && !center,
    };

    return res.json(response);
  } catch (err) {
    console.error("[AUTH /me]", err);
    return res.status(500).json({ error: "Failed to fetch user profile." });
  }
});

// ── POST /api/auth/refresh-permissions ───────────────────────────────────────
// Clears the in-process permission cache for the calling user's role and returns
// a fresh permissions array + roleMatrix. Call this after any server-side role
// change to avoid waiting for the 60-second cache TTL to expire.
router.post("/api/auth/refresh-permissions", authenticate, async (req, res) => {
  try {
    const { role, schoolId } = req.user;

    // Drop cached entry so the next fetch goes straight to Firestore / static baseline.
    roleSvc.invalidateCache(role, schoolId);

    // Re-resolve with the now-empty cache slot.
    const permissions = await roleSvc.getPermissionsForRole(role, schoolId);
    const roleMatrix  = await roleSvc.getRoleMatrix(role, schoolId);
    const homeRoute   = ROLE_HOME[role] || "/";

    return res.json({ success: true, permissions, roleMatrix, homeRoute, role });
  } catch (err) {
    console.error("[AUTH /refresh-permissions]", err);
    return res.status(500).json({ error: "Failed to refresh permissions." });
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
