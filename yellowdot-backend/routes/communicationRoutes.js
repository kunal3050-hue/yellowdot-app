/**
 * communicationRoutes.js
 * REST endpoints for holidays, notices, and announcements.
 */

const express  = require("express");
const router   = express.Router();
const { authenticate, authorize, blockUnknown } = require("../middleware/authMiddleware");
const svc      = require("../services/communicationService");

const SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";

// Every communication route requires a registered account.
// Parents can read (holidays, notices, announcements); staff-only routes
// are further guarded by authorize(CAN_WRITE / CAN_DELETE).
// Path-scoped to this router's own prefixes (mounted at app root via app.use())
// so the guard does not run for unrelated paths like /api/parent/*.
router.use(["/api/announcements", "/api/holidays", "/api/notices"], authenticate, blockUnknown);

function ctx(req) {
  return {
    schoolId:    req.user?.schoolId || SCHOOL_ID,
    actorUserId: req.user?.userId   || "system",
  };
}
function fail(res, route, e) {
  console.error(`[${route}]`, e.message);
  res.status(500).json({ success: false, error: e.message });
}

const CAN_WRITE  = ["admin", "center_admin", "super_admin", "developer", "teacher"];
const CAN_DELETE = ["admin", "super_admin", "developer"];

// ── HOLIDAYS ──────────────────────────────────────────────────────────────────

router.get("/api/holidays", authenticate, async (req, res) => {
  try {
    const { schoolId } = ctx(req);
    const holidays = await svc.getHolidays({ schoolId, year: req.query.year });
    res.json({ success: true, holidays });
  } catch (e) { fail(res, "GET /api/holidays", e); }
});

router.post("/api/holidays", authenticate, authorize(...CAN_WRITE), async (req, res) => {
  try {
    const { schoolId, actorUserId } = ctx(req);
    const holiday = await svc.createHoliday(req.body || {}, { schoolId, actorUserId });
    res.json({ success: true, holiday });
  } catch (e) { fail(res, "POST /api/holidays", e); }
});

router.put("/api/holidays/:id", authenticate, authorize(...CAN_WRITE), async (req, res) => {
  try {
    const { actorUserId } = ctx(req);
    const holiday = await svc.updateHoliday(req.params.id, req.body || {}, { actorUserId });
    if (!holiday) return res.status(404).json({ success: false, error: "Not found." });
    res.json({ success: true, holiday });
  } catch (e) { fail(res, "PUT /api/holidays/:id", e); }
});

router.delete("/api/holidays/:id", authenticate, authorize(...CAN_DELETE), async (req, res) => {
  try {
    const ok = await svc.deleteHoliday(req.params.id);
    if (!ok) return res.status(404).json({ success: false, error: "Not found." });
    res.json({ success: true });
  } catch (e) { fail(res, "DELETE /api/holidays/:id", e); }
});

// ── NOTICES ───────────────────────────────────────────────────────────────────

router.get("/api/notices", authenticate, async (req, res) => {
  try {
    const { schoolId } = ctx(req);
    const notices = await svc.getNotices({ schoolId, status: req.query.status, type: req.query.type });
    res.json({ success: true, notices });
  } catch (e) { fail(res, "GET /api/notices", e); }
});

router.post("/api/notices", authenticate, authorize(...CAN_WRITE), async (req, res) => {
  try {
    const { schoolId, actorUserId } = ctx(req);
    const notice = await svc.createNotice(req.body || {}, { schoolId, actorUserId });
    res.json({ success: true, notice });
  } catch (e) { fail(res, "POST /api/notices", e); }
});

router.put("/api/notices/:id", authenticate, authorize(...CAN_WRITE), async (req, res) => {
  try {
    const { actorUserId } = ctx(req);
    const notice = await svc.updateNotice(req.params.id, req.body || {}, { actorUserId });
    if (!notice) return res.status(404).json({ success: false, error: "Not found." });
    res.json({ success: true, notice });
  } catch (e) { fail(res, "PUT /api/notices/:id", e); }
});

router.delete("/api/notices/:id", authenticate, authorize(...CAN_DELETE), async (req, res) => {
  try {
    const ok = await svc.deleteNotice(req.params.id);
    if (!ok) return res.status(404).json({ success: false, error: "Not found." });
    res.json({ success: true });
  } catch (e) { fail(res, "DELETE /api/notices/:id", e); }
});

// ── ANNOUNCEMENTS ─────────────────────────────────────────────────────────────

router.get("/api/announcements", authenticate, async (req, res) => {
  try {
    const { schoolId } = ctx(req);
    const announcements = await svc.getAnnouncements({ schoolId, type: req.query.type });
    res.json({ success: true, announcements });
  } catch (e) { fail(res, "GET /api/announcements", e); }
});

router.post("/api/announcements", authenticate, authorize(...CAN_WRITE), async (req, res) => {
  try {
    const { schoolId, actorUserId } = ctx(req);
    const announcement = await svc.createAnnouncement(req.body || {}, { schoolId, actorUserId });
    res.json({ success: true, announcement });
  } catch (e) { fail(res, "POST /api/announcements", e); }
});

router.put("/api/announcements/:id", authenticate, authorize(...CAN_WRITE), async (req, res) => {
  try {
    const { actorUserId } = ctx(req);
    const announcement = await svc.updateAnnouncement(req.params.id, req.body || {}, { actorUserId });
    if (!announcement) return res.status(404).json({ success: false, error: "Not found." });
    res.json({ success: true, announcement });
  } catch (e) { fail(res, "PUT /api/announcements/:id", e); }
});

router.delete("/api/announcements/:id", authenticate, authorize(...CAN_DELETE), async (req, res) => {
  try {
    const ok = await svc.deleteAnnouncement(req.params.id);
    if (!ok) return res.status(404).json({ success: false, error: "Not found." });
    res.json({ success: true });
  } catch (e) { fail(res, "DELETE /api/announcements/:id", e); }
});

module.exports = router;
