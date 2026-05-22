/**
 * userRoutes.js — Staff user management REST API
 * ─────────────────────────────────────────────────
 * All routes require a valid Firebase ID token.
 * Mutations (POST/PUT/DELETE) require admin or higher.
 *
 * GET    /api/users              List users (schoolId-scoped)
 * GET    /api/users/:userId      Get single user
 * POST   /api/users              Create user (sets schoolId from actor)
 * PUT    /api/users/:userId      Update user fields
 * DELETE /api/users/:userId      Soft-deactivate (status → "inactive")
 * POST   /api/users/:userId/reactivate   Re-activate a deactivated user
 */

const express  = require("express");
const router   = express.Router();
const svc      = require("../services/userService");
const { authenticate, authorize, staffOnly } = require("../middleware/authMiddleware");

// ── All user routes require a registered staff account ─────────────
router.use(authenticate, staffOnly);

const ADMIN_ROLES  = ["admin", "center_admin", "super_admin", "developer"];
const MANAGE_ROLES = ["admin", "super_admin", "developer"];

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

router.post("/api/users", authorize(...MANAGE_ROLES), async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.uid && !body.userId) {
      return res.status(400).json({ success: false, error: "uid is required." });
    }
    const user = await svc.create(
      { ...body, schoolId: req.user.schoolId },
      req.user.userId
    );
    res.status(201).json({ success: true, user });
  } catch (err) {
    console.error("[POST /api/users]", err.message);
    res.status(500).json({ success: false, error: err.message || "Failed to create user." });
  }
});

// ── PUT /api/users/:userId ─────────────────────────────────────────

router.put("/api/users/:userId", authorize(...ADMIN_ROLES), async (req, res) => {
  try {
    const user = await svc.update(req.params.userId, req.body || {}, req.user.userId);
    if (!user) return res.status(404).json({ success: false, error: "User not found." });
    res.json({ success: true, user });
  } catch (err) {
    console.error("[PUT /api/users/:userId]", err.message);
    res.status(500).json({ success: false, error: "Failed to update user." });
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

module.exports = router;
