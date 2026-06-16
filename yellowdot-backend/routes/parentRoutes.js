/**
 * parentRoutes.js — Parent Module V1 API
 * ────────────────────────────────────────────────────────────────────
 * Consolidated, parent-scoped endpoints. Every route:
 *   1. verifies the Firebase token (authenticate)
 *   2. blocks unregistered accounts (blockUnknown)
 *   3. allows only parents (or bypass roles) via parentOnly
 *   4. resolves/provisions the parents/{uid} identity doc
 *
 * Child access is authorized against parent.studentIds — a parent can only
 * read their own children's data.
 *
 *   GET /api/parent/me                  — parent profile + linked children
 *   GET /api/parent/children            — linked children (child-safe)
 *   GET /api/parent/child/:studentId    — single child profile (ownership enforced)
 */

const express = require("express");
const router  = express.Router();

const { authenticate, blockUnknown } = require("../middleware/authMiddleware");
const { isBypassRole }               = require("../config/permissionsBackend");
const parentSvc                      = require("../services/parentProfileService");
const parentFeedSvc                  = require("../services/parentFeedService");
const parentAttendanceViewSvc        = require("../services/parentAttendanceViewService");
const memoriesSvc                    = require("../services/memoriesService");
const parentFeesSvc                  = require("../services/parentFeesService");
const parentFoodMenuSvc              = require("../services/parentFoodMenuService");
const parentConsumptionSvc           = require("../services/parentConsumptionService");
const parentNapSvc                   = require("../services/parentNapService");
const parentHolidaysSvc              = require("../services/parentHolidaysService");
const parentNoticesSvc               = require("../services/parentNoticesService");
const parentActivitySvc              = require("../services/parentActivityFeedService");
const parentHighlightsSvc            = require("../services/parentHighlightsService");
const careSvc                        = require("../services/careService");
const studentSvc                     = require("../services/studentService");

// ── Parent-only guard ──────────────────────────────────────────────
function parentOnly(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Authentication required." });
  if (isBypassRole(req.user.role)) return next();
  if (req.user.role !== "parent") {
    return res.status(403).json({ error: "This endpoint is for parents only.", code: "PARENT_ONLY" });
  }
  next();
}

// ── Resolve parent identity (provision on first access) ────────────
// sync=true (used on the "load" call /api/parent/me) self-heals studentIds
// when a child is added/removed/relinked or the email mapping changes.
function makeLoadParent({ sync = false } = {}) {
  return async function loadParent(req, res, next) {
    try {
      const parent = await parentSvc.getOrCreateParent(req.user, { sync });
      if (!parent) {
        return res.status(403).json({
          error: "No child is linked to this account. Contact your school administrator.",
          code:  "NO_LINKED_CHILD",
        });
      }
      req.parent = parent;
      next();
    } catch (e) {
      console.error("[parentRoutes loadParent]", e.message);
      res.status(500).json({ error: "Failed to resolve parent profile." });
    }
  };
}
const loadParent       = makeLoadParent();              // fast path (cached)
const loadParentSynced = makeLoadParent({ sync: true }); // refresh links

// Path-scoped to /api/parent so this guard runs ONLY for this router's own
// routes — not for every request (the router is mounted at app root via
// app.use(), where a path-less guard would also affect other routers).
router.use("/api/parent", authenticate, blockUnknown, parentOnly);

// ── GET /api/parent/me ─────────────────────────────────────────────
// Uses the synced loader — this is the "load" call the app makes on startup,
// so it self-heals the parent↔child links here.
router.get("/api/parent/me", loadParentSynced, async (req, res) => {
  try {
    const children = await parentSvc.getChildren(req.parent);
    const { uid, schoolId, email, name, phone, relation, status, studentIds } = req.parent;
    res.json({
      parent: { uid, schoolId, email, name, phone, relation, status, studentIds },
      children,
    });
  } catch (e) {
    console.error("[GET /api/parent/me]", e.message);
    res.status(500).json({ error: "Failed to load parent profile." });
  }
});

// ── GET /api/parent/children ───────────────────────────────────────
router.get("/api/parent/children", loadParent, async (req, res) => {
  try {
    const children = await parentSvc.getChildren(req.parent);
    res.json({ children });
  } catch (e) {
    console.error("[GET /api/parent/children]", e.message);
    res.status(500).json({ error: "Failed to load children." });
  }
});

// ── GET /api/parent/feed ───────────────────────────────────────────
// Phase 2 — Home Feed. Merged school content (announcements/activities/events).
// Resolves the first linked child's classId to filter class-specific event notices.
router.get("/api/parent/feed", loadParent, async (req, res) => {
  try {
    const studentId = req.query.studentId || req.parent.studentIds?.[0];
    let studentClassId;
    if (studentId && req.parent.studentIds?.includes(studentId)) {
      try {
        const student = await studentSvc.getOne(studentId);
        studentClassId = student?.classId || undefined;
      } catch { /* non-fatal */ }
    }
    const feed = await parentFeedSvc.getFeed({ schoolId: req.parent.schoolId, studentClassId });
    res.json({ feed });
  } catch (e) {
    console.error("[GET /api/parent/feed]", e.message);
    res.status(500).json({ error: "Failed to load feed." });
  }
});

// ── GET /api/parent/notices ────────────────────────────────────────
// Published notices filtered by the child's class.
// Query: ?studentId=YD001 (optional; defaults to first linked child).
router.get("/api/parent/notices", loadParent, async (req, res) => {
  try {
    const studentId = req.query.studentId || req.parent.studentIds?.[0];
    let studentClassId;
    if (studentId && req.parent.studentIds?.includes(studentId)) {
      try {
        const student = await studentSvc.getOne(studentId);
        studentClassId = student?.classId || undefined;
      } catch { /* non-fatal — fall back to showing all notices */ }
    }
    const data = await parentNoticesSvc.getNoticesView({
      schoolId:      req.parent.schoolId,
      studentClassId,
    });
    res.json(data);
  } catch (e) {
    console.error("[GET /api/parent/notices]", e.message);
    res.status(500).json({ error: "Failed to load notices." });
  }
});

// ── GET /api/parent/activity ───────────────────────────────────────
// Home — unified, CHILD-SPECIFIC activity timeline (attendance, food menu,
// naps, consumption, memories) + the single nearest upcoming holiday.
// Query: ?studentId=YD001 (defaults to first linked child).
router.get("/api/parent/activity", loadParent, async (req, res) => {
  try {
    const studentId = req.query.studentId || req.parent.studentIds?.[0];
    if (studentId && !req.parent.studentIds?.includes(studentId)) {
      return res.status(404).json({ error: "Child not found or not linked to this account.", code: "CHILD_NOT_FOUND" });
    }
    const [data, highlights] = await Promise.all([
      parentActivitySvc.getActivityFeed({ schoolId: req.parent.schoolId, studentId }),
      parentHighlightsSvc.getHighlights({ schoolId: req.parent.schoolId, studentId }),
    ]);
    res.json({ ...data, highlights });
  } catch (e) {
    console.error("[GET /api/parent/activity]", e.message);
    res.status(500).json({ error: "Failed to load activity feed." });
  }
});

// ── GET /api/parent/fees ───────────────────────────────────────────
// Phase 5 — read-only fees for the parent's linked children.
// Query: ?studentId=YD001 (optional; must be linked) to filter to one child.
router.get("/api/parent/fees", loadParent, async (req, res) => {
  try {
    const { studentId } = req.query;
    if (studentId && !req.parent.studentIds?.includes(studentId)) {
      return res.status(404).json({
        error: "Child not found or not linked to this account.",
        code:  "CHILD_NOT_FOUND",
      });
    }
    const data = await parentFeesSvc.getFees({
      schoolId:   req.parent.schoolId,
      studentIds: req.parent.studentIds,
      studentId,
    });
    res.json(data);
  } catch (e) {
    console.error("[GET /api/parent/fees]", e.message);
    res.status(500).json({ error: "Failed to load fees." });
  }
});

// ── GET /api/parent/food-menu ──────────────────────────────────────
// Daily Care · Food Menu (read-only). Query: ?date=YYYY-MM-DD (optional).
// School-scoped (the menu is the same for everyone that day).
router.get("/api/parent/food-menu", loadParent, async (req, res) => {
  try {
    const data = await parentFoodMenuSvc.getFoodMenuView({
      schoolId: req.parent.schoolId,
      date:     req.query.date,
    });
    res.json(data);
  } catch (e) {
    console.error("[GET /api/parent/food-menu]", e.message);
    res.status(500).json({ error: "Failed to load food menu." });
  }
});

// ── GET /api/parent/consumption ────────────────────────────────────
// Daily Care · Consumption Log (read-only) for ONE linked child.
// Query: ?studentId=YD001 (defaults to first child) &date=YYYY-MM-DD.
router.get("/api/parent/consumption", loadParent, async (req, res) => {
  try {
    const studentId = req.query.studentId || req.parent.studentIds?.[0];
    if (studentId && !req.parent.studentIds?.includes(studentId)) {
      return res.status(404).json({ error: "Child not found or not linked to this account.", code: "CHILD_NOT_FOUND" });
    }
    const data = await parentConsumptionSvc.getConsumptionView({
      schoolId: req.parent.schoolId, studentId, date: req.query.date,
    });
    res.json(data);
  } catch (e) {
    console.error("[GET /api/parent/consumption]", e.message);
    res.status(500).json({ error: "Failed to load consumption log." });
  }
});

// ── GET /api/parent/naps ───────────────────────────────────────────
// Daily Care · Nap Tracker (read-only) for ONE linked child.
// Query: ?studentId=YD001 (defaults to first child) &date=YYYY-MM-DD.
router.get("/api/parent/naps", loadParent, async (req, res) => {
  try {
    const studentId = req.query.studentId || req.parent.studentIds?.[0];
    if (studentId && !req.parent.studentIds?.includes(studentId)) {
      return res.status(404).json({ error: "Child not found or not linked to this account.", code: "CHILD_NOT_FOUND" });
    }
    const data = await parentNapSvc.getNapView({
      schoolId: req.parent.schoolId, studentId, date: req.query.date,
    });
    res.json(data);
  } catch (e) {
    console.error("[GET /api/parent/naps]", e.message);
    res.status(500).json({ error: "Failed to load nap tracker." });
  }
});

// ── GET /api/parent/holidays ───────────────────────────────────────
// Daily Care · Holiday Calendar (read-only).
// Query: ?year=YYYY (optional), ?studentId=YD001 (optional — defaults to first
// linked child). Filters class-specific holidays to only the child's class.
router.get("/api/parent/holidays", loadParent, async (req, res) => {
  try {
    // Resolve classId for the requested (or first) linked child.
    const studentId = req.query.studentId || req.parent.studentIds?.[0];
    let studentClassId;
    if (studentId && req.parent.studentIds?.includes(studentId)) {
      try {
        const student = await studentSvc.getOne(studentId);
        studentClassId = student?.classId || undefined;
      } catch { /* non-fatal — fall back to showing all holidays */ }
    }
    const data = await parentHolidaysSvc.getHolidaysView({
      schoolId:       req.parent.schoolId,
      year:           req.query.year,
      studentClassId,
    });
    res.json(data);
  } catch (e) {
    console.error("[GET /api/parent/holidays]", e.message);
    res.status(500).json({ error: "Failed to load holidays." });
  }
});

// ── GET /api/parent/memories ───────────────────────────────────────
// Phase 4 — photos/videos for the parent's linked children.
// Query: ?studentId=YD001 (optional; must be linked) to filter to one child.
router.get("/api/parent/memories", loadParent, async (req, res) => {
  try {
    const { studentId } = req.query;
    if (studentId && !req.parent.studentIds?.includes(studentId)) {
      return res.status(404).json({
        error: "Child not found or not linked to this account.",
        code:  "CHILD_NOT_FOUND",
      });
    }
    const memories = await memoriesSvc.getForChildren({
      schoolId:   req.parent.schoolId,
      studentIds: req.parent.studentIds,
      studentId,
    });
    res.json({ memories });
  } catch (e) {
    console.error("[GET /api/parent/memories]", e.message);
    res.status(500).json({ error: "Failed to load memories." });
  }
});

// ── GET /api/parent/child/:studentId ───────────────────────────────
router.get("/api/parent/child/:studentId", loadParent, async (req, res) => {
  try {
    const child = await parentSvc.getChild(req.parent, req.params.studentId);
    if (!child) {
      return res.status(404).json({
        error: "Child not found or not linked to this account.",
        code:  "CHILD_NOT_FOUND",
      });
    }
    res.json({ child });
  } catch (e) {
    console.error("[GET /api/parent/child/:studentId]", e.message);
    res.status(500).json({ error: "Failed to load child profile." });
  }
});

// ── GET /api/parent/child/:studentId/attendance ────────────────────
// Phase 3 — read-only attendance view for ONE linked child + month.
// Query: ?month=YYYY-MM (defaults to current month).
router.get("/api/parent/child/:studentId/attendance", loadParent, async (req, res) => {
  try {
    const { studentId } = req.params;
    // Ownership: child must be linked to this parent.
    if (!req.parent.studentIds?.includes(studentId)) {
      return res.status(404).json({
        error: "Child not found or not linked to this account.",
        code:  "CHILD_NOT_FOUND",
      });
    }
    const data = await parentAttendanceViewSvc.getChildAttendance({
      studentId,
      schoolId: req.parent.schoolId,
      month:    req.query.month,
    });
    res.json(data);
  } catch (e) {
    console.error("[GET /api/parent/child/:studentId/attendance]", e.message);
    res.status(500).json({ error: "Failed to load attendance." });
  }
});

// ── GET /api/parent/care ───────────────────────────────────────────
// Care & Hygiene log for ONE linked child.
// Query: ?studentId=YD001 (defaults to first child) &date=YYYY-MM-DD.
router.get("/api/parent/care", loadParent, async (req, res) => {
  try {
    const studentId = req.query.studentId || req.parent.studentIds?.[0];
    if (studentId && !req.parent.studentIds?.includes(studentId)) {
      return res.status(404).json({ error: "Child not found or not linked to this account.", code: "CHILD_NOT_FOUND" });
    }
    const records = await careSvc.getCareHistory({
      studentId,
      date:     req.query.date,
      schoolId: req.parent.schoolId,
    });
    res.json({ records });
  } catch (e) {
    console.error("[GET /api/parent/care]", e.message);
    res.status(500).json({ error: "Failed to load care log." });
  }
});

// Exported for unit testing (pure middleware, no I/O).
router.parentOnly = parentOnly;

module.exports = router;
