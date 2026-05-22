/**
 * roleRoutes.js — Dynamic role & permission REST API
 * ────────────────────────────────────────────────────
 * All routes require a valid Firebase ID token.
 * Mutations require admin or higher.
 *
 * GET    /api/roles                  List all roles for school
 * POST   /api/roles/seed             Seed default system roles
 * GET    /api/roles/:roleId          Get single role + permissions
 * POST   /api/roles                  Create custom role
 * PUT    /api/roles/:roleId          Update role metadata
 * PUT    /api/roles/:roleId/permissions  Replace permission matrix
 * DELETE /api/roles/:roleId          Delete custom role (not system)
 * GET    /api/roles/:roleId/audit    Get audit log for role
 */

const express = require("express");
const router  = express.Router();
const svc     = require("../services/roleService");
const { authenticate, authorize, staffOnly } = require("../middleware/authMiddleware");

const ADMIN_ROLES  = ["admin", "center_admin", "super_admin", "developer"];
const MANAGE_ROLES = ["admin", "super_admin", "developer"];

// Role management is strictly admin-level staff.
router.use(authenticate, staffOnly);

// ── GET /api/roles ────────────────────────────────────────────────────────────
router.get("/api/roles", authorize(...ADMIN_ROLES), async (req, res) => {
  try {
    const { schoolId } = req.user;
    let roles = await svc.getAll(schoolId);

    // Auto-seed if the school has no roles yet
    if (roles.length === 0) {
      await svc.seedDefaultRoles(schoolId);
      roles = await svc.getAll(schoolId);
    }

    res.json({ success: true, roles });
  } catch (err) {
    console.error("[GET /api/roles]", err.message);
    res.status(500).json({ success: false, error: "Failed to fetch roles." });
  }
});

// ── POST /api/roles/seed ──────────────────────────────────────────────────────
// Idempotent — only creates docs that don't exist yet.
router.post("/api/roles/seed", authorize(...MANAGE_ROLES), async (req, res) => {
  try {
    await svc.seedDefaultRoles(req.user.schoolId);
    const roles = await svc.getAll(req.user.schoolId);
    res.json({ success: true, message: "Default roles seeded.", roles });
  } catch (err) {
    console.error("[POST /api/roles/seed]", err.message);
    res.status(500).json({ success: false, error: "Failed to seed roles." });
  }
});

// ── GET /api/roles/:roleId ────────────────────────────────────────────────────
router.get("/api/roles/:roleId", authorize(...ADMIN_ROLES), async (req, res) => {
  try {
    const role = await svc.getOne(req.params.roleId);
    if (!role) return res.status(404).json({ success: false, error: "Role not found." });
    res.json({ success: true, role });
  } catch (err) {
    console.error("[GET /api/roles/:roleId]", err.message);
    res.status(500).json({ success: false, error: "Failed to fetch role." });
  }
});

// ── POST /api/roles ───────────────────────────────────────────────────────────
router.post("/api/roles", authorize(...MANAGE_ROLES), async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.name?.trim()) {
      return res.status(400).json({ success: false, error: "Role name is required." });
    }
    const role = await svc.create(body, req.user.userId, req.user.schoolId);
    res.status(201).json({ success: true, role });
  } catch (err) {
    console.error("[POST /api/roles]", err.message);
    res.status(500).json({ success: false, error: err.message || "Failed to create role." });
  }
});

// ── PUT /api/roles/:roleId ────────────────────────────────────────────────────
router.put("/api/roles/:roleId", authorize(...MANAGE_ROLES), async (req, res) => {
  try {
    const role = await svc.update(req.params.roleId, req.body || {}, req.user.userId);
    if (!role) return res.status(404).json({ success: false, error: "Role not found." });
    res.json({ success: true, role });
  } catch (err) {
    console.error("[PUT /api/roles/:roleId]", err.message);
    res.status(500).json({ success: false, error: err.message || "Failed to update role." });
  }
});

// ── PUT /api/roles/:roleId/permissions ────────────────────────────────────────
router.put("/api/roles/:roleId/permissions", authorize(...MANAGE_ROLES), async (req, res) => {
  try {
    const { permissions } = req.body || {};
    if (!permissions || typeof permissions !== "object") {
      return res.status(400).json({ success: false, error: "permissions object is required." });
    }
    const role = await svc.updatePermissions(req.params.roleId, permissions, req.user.userId);
    if (!role) return res.status(404).json({ success: false, error: "Role not found." });
    res.json({ success: true, role });
  } catch (err) {
    console.error("[PUT /api/roles/:roleId/permissions]", err.message);
    res.status(500).json({ success: false, error: err.message || "Failed to update permissions." });
  }
});

// ── DELETE /api/roles/:roleId ─────────────────────────────────────────────────
router.delete("/api/roles/:roleId", authorize(...MANAGE_ROLES), async (req, res) => {
  try {
    await svc.remove(req.params.roleId, req.user.userId);
    res.json({ success: true, message: "Role deleted." });
  } catch (err) {
    console.error("[DELETE /api/roles/:roleId]", err.message);
    const status = err.message.includes("System roles") || err.message.includes("Reassign") ? 400 : 500;
    res.status(status).json({ success: false, error: err.message });
  }
});

// ── GET /api/roles/:roleId/audit ──────────────────────────────────────────────
router.get("/api/roles/:roleId/audit", authorize(...ADMIN_ROLES), async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const logs  = await svc.getAuditLogs(req.params.roleId, limit);
    res.json({ success: true, logs });
  } catch (err) {
    console.error("[GET /api/roles/:roleId/audit]", err.message);
    res.status(500).json({ success: false, error: "Failed to fetch audit logs." });
  }
});

module.exports = router;
