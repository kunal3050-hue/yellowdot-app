/**
 * notificationRoutes.js — Parent notification endpoints
 * ──────────────────────────────────────────────────────
 * Mounted in server.js alongside parentRoutes.
 * All routes require Firebase auth + parent identity resolution.
 *
 *   GET    /api/parent/notifications              — list (filters: childId, type, limit, before)
 *   GET    /api/parent/notifications/unread-count — unread count
 *   PATCH  /api/parent/notifications/read-all     — mark all as read
 *   PATCH  /api/parent/notifications/:id/read     — mark one as read
 *   POST   /api/parent/notifications/fcm-token    — register device push token
 */

const express      = require("express");
const router       = express.Router();
const { authenticate, blockUnknown } = require("../middleware/authMiddleware");
const { isBypassRole }               = require("../config/permissionsBackend");
const parentSvc                      = require("../services/parentProfileService");
const notifSvc                       = require("../services/notificationService");

// ── Parent-only guard ─────────────────────────────────────────────
function parentOnly(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Authentication required." });
  if (isBypassRole(req.user.role)) return next();
  if (req.user.role !== "parent") {
    return res.status(403).json({ error: "This endpoint is for parents only.", code: "PARENT_ONLY" });
  }
  next();
}

// ── Resolve parent identity ───────────────────────────────────────
async function loadParent(req, res, next) {
  try {
    const parent = await parentSvc.getOrCreateParent(req.user, { sync: false });
    if (!parent) {
      return res.status(403).json({
        error: "No child is linked to this account.",
        code:  "NO_LINKED_CHILD",
      });
    }
    req.parent = parent;
    next();
  } catch (e) {
    console.error("[notificationRoutes loadParent]", e.message);
    res.status(500).json({ error: "Failed to resolve parent profile." });
  }
}

router.use("/api/parent/notifications", authenticate, blockUnknown, parentOnly);

// ── GET /api/parent/notifications/unread-count ────────────────────
// Must be registered BEFORE /:id/read to avoid route collision.
router.get("/api/parent/notifications/unread-count", loadParent, async (req, res) => {
  try {
    const count = await notifSvc.getUnreadCount(req.parent.uid);
    res.json({ count });
  } catch (e) {
    console.error("[GET /api/parent/notifications/unread-count]", e.message);
    res.status(500).json({ error: "Failed to fetch unread count." });
  }
});

// ── PATCH /api/parent/notifications/read-all ──────────────────────
router.patch("/api/parent/notifications/read-all", loadParent, async (req, res) => {
  try {
    const updated = await notifSvc.markAllRead(req.parent.uid);
    res.json({ updated });
  } catch (e) {
    console.error("[PATCH /api/parent/notifications/read-all]", e.message);
    res.status(500).json({ error: "Failed to mark all as read." });
  }
});

// ── GET /api/parent/notifications ────────────────────────────────
router.get("/api/parent/notifications", loadParent, async (req, res) => {
  try {
    const { childId, type, limit, before } = req.query;
    // Validate childId ownership if provided
    if (childId && !req.parent.studentIds?.includes(childId)) {
      return res.status(404).json({ error: "Child not found or not linked to this account.", code: "CHILD_NOT_FOUND" });
    }
    const notifications = await notifSvc.listNotifications({
      parentId: req.parent.uid,
      childId:  childId || null,
      type:     type    || null,
      limit:    Math.min(Number(limit) || 50, 100),
      before:   before  || null,
    });
    res.json({ notifications });
  } catch (e) {
    console.error("[GET /api/parent/notifications]", e.message);
    res.status(500).json({ error: "Failed to fetch notifications." });
  }
});

// ── PATCH /api/parent/notifications/:id/read ─────────────────────
router.patch("/api/parent/notifications/:id/read", loadParent, async (req, res) => {
  try {
    const result = await notifSvc.markRead(req.params.id, req.parent.uid);
    if (!result) return res.status(404).json({ error: "Notification not found." });
    res.json(result);
  } catch (e) {
    console.error("[PATCH /api/parent/notifications/:id/read]", e.message);
    res.status(500).json({ error: "Failed to mark notification as read." });
  }
});

// ── POST /api/parent/notifications/fcm-token ─────────────────────
// Call this from the parent app when a device push token is obtained.
router.post("/api/parent/notifications/fcm-token", loadParent, async (req, res) => {
  try {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ error: "token is required." });
    await notifSvc.storeFcmToken(req.parent.uid, token);
    res.json({ success: true });
  } catch (e) {
    console.error("[POST /api/parent/notifications/fcm-token]", e.message);
    res.status(500).json({ error: "Failed to store FCM token." });
  }
});

module.exports = router;
