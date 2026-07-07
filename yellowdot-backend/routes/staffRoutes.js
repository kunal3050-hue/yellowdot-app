/**
 * staffRoutes.js — Staff Management REST API
 * ────────────────────────────────────────────
 * GET    /api/staff/dashboard          Dashboard aggregates (cards, birthdays, anniversaries)
 * GET    /api/staff/recent-activity    Recent timeline events across all staff
 * GET    /api/staff/count              Total staff (active)
 * GET    /api/staff/me                 Current logged-in user's own staff record (if linked)
 * GET    /api/staff                    List staff (filters via querystring)
 * GET    /api/staff/:staffId           Single staff record
 * GET    /api/staff/:staffId/timeline  Per-staff activity timeline
 * POST   /api/staff                    Create staff
 * PUT    /api/staff/:staffId           Update staff
 * DELETE /api/staff/:staffId           Delete staff
 *
 * Permission routing:
 *   • Dashboard / list / count / mutations → "staff-management" route key
 *     (admin, center_owner, center_admin, super_admin, developer)
 *   • Self profile (GET /me) → any authenticated staff member
 *   • Individual profile (GET /:staffId) → managers OR self (controller-checked)
 */

const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/staffController");
const { authenticate, authorizeRoute, staffOnly } = require("../middleware/authMiddleware");

const MANAGE_KEY  = "staff-management";
const DASH_KEY    = "staff-dashboard";

const canManage   = [authenticate, staffOnly, authorizeRoute(MANAGE_KEY)];
const canSeeDash  = [authenticate, staffOnly, authorizeRoute(DASH_KEY)];

// Order matters: literal paths before the `:staffId` parameter route.
router.get("/api/staff/dashboard",        ...canSeeDash, ctrl.dashboard);
router.get("/api/staff/recent-activity",  ...canSeeDash, ctrl.recentActivity);
router.get("/api/staff/count",            ...canSeeDash, ctrl.count);
router.get("/api/staff/me",               authenticate, staffOnly, ctrl.getSelf);

router.get("/api/staff",                  ...canManage, ctrl.list);
router.post("/api/staff",                 ...canManage, ctrl.create);

// Individual profile read: any authenticated staff hits the route; the controller
// itself enforces "managers can see anyone, others can only see themselves".
router.get("/api/staff/:staffId",         authenticate, staffOnly, ctrl.getOne);
router.get("/api/staff/:staffId/timeline",...canManage, ctrl.getTimeline);

router.put("/api/staff/:staffId",         ...canManage, ctrl.update);
router.delete("/api/staff/:staffId",      ...canManage, ctrl.remove);    // soft delete
router.post("/api/staff/:staffId/restore",...canManage, ctrl.restore);

// ── Login account linkage ──
router.post("/api/staff/:staffId/invite",       ...canManage, ctrl.invite);
router.post("/api/staff/:staffId/link-user",    ...canManage, ctrl.linkUser);
router.post("/api/staff/:staffId/unlink-user",  ...canManage, ctrl.unlinkUser);
router.post("/api/staff/:staffId/disable-user", ...canManage, ctrl.setUserDisabled);

module.exports = router;
