/**
 * ptmRoutes.js — Staff PTM management endpoints
 * ───────────────────────────────────────────────
 * All routes require a valid Firebase token, a registered staff role
 * (blockUnknown + staffOnly), and same-school tenant membership for any
 * by-ID operation.
 *
 * PTMs:
 *   GET    /api/ptm                            — list all PTMs (with stats)
 *   POST   /api/ptm                            — create PTM
 *   PUT    /api/ptm/:id                        — update PTM
 *   DELETE /api/ptm/:id                        — delete PTM + cascade
 *
 * Slots:
 *   GET    /api/ptm/:id/slots                  — list slots for PTM
 *   POST   /api/ptm/:id/slots/generate         — auto-generate slots for a teacher
 *   DELETE /api/ptm/:id/slots/:slotId          — delete a single slot
 *
 * Bookings:
 *   GET    /api/ptm/:id/bookings               — list bookings for PTM
 *   PATCH  /api/ptm/bookings/:bookingId/status — mark attended/missed
 *
 * Notes:
 *   GET    /api/ptm/:id/notes/:studentId       — get meeting notes
 *   PUT    /api/ptm/:id/notes/:studentId       — create/update meeting notes
 *
 * Stats:
 *   GET    /api/ptm/:id/stats                  — dashboard stats for PTM
 */

const express    = require("express");
const router     = express.Router();
const ptmSvc     = require("../services/ptmService");
const userSvc    = require("../services/userService");
const { authenticate, blockUnknown, staffOnly } = require("../middleware/authMiddleware");
const notif      = require("../services/notificationService");
const studentSvc = require("../services/studentService");
const { checkTenantAccess } = require("../middleware/tenantRecordAccess");

// Staff-only end to end: blockUnknown + staffOnly reject "unknown" and
// "parent" roles. Parents interact with PTMs exclusively through the
// dedicated /api/parent/ptm* routes (unaffected by this milestone).
router.use("/api/ptm", authenticate, blockUnknown, staffOnly);

// ── Helper: notify affected students ──────────────────────────────

async function notifyAffectedStudents(ptm, schoolId, type, { title, message, deepLink } = {}) {
  try {
    const allStudents = await studentSvc.listStudents({ schoolId });
    const targets = ptm.appliesTo === "all"
      ? allStudents
      : allStudents.filter(s => (ptm.classIds || []).includes(s.classId));

    for (const student of targets) {
      notif.notifyAsync(() =>
        notif.fireForStudent(student.studentId, schoolId, { type, title, message, deepLink })
      );
    }
  } catch { /* non-critical */ }
}

// ── PTMs ───────────────────────────────────────────────────────────

router.get("/api/ptm", async (req, res) => {
  try {
    const ptms = await ptmSvc.getPtms({ schoolId: req.user.schoolId });
    // Attach stats to each PTM
    const enriched = await Promise.all(
      ptms.map(async p => ({ ...p, stats: await ptmSvc.getPtmStats(p.id) }))
    );
    res.json({ ptms: enriched });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/api/ptm", async (req, res) => {
  try {
    const { title, description, meetingDate, startTime, endTime, venue, appliesTo, classIds, teacherIds } = req.body;
    if (!title || !meetingDate || !startTime || !endTime) {
      return res.status(400).json({ error: "title, meetingDate, startTime, endTime are required" });
    }
    const ptm = await ptmSvc.createPtm(req.body, { schoolId: req.user.schoolId, actorUserId: req.user?.userId });

    // Push notification to affected parents
    notifyAffectedStudents(ptm, req.user.schoolId, notif.TYPES.PTM_CREATED, {
      title:   `New PTM: ${ptm.title}`,
      message: `A Parent-Teacher Meeting has been scheduled for ${ptm.meetingDate}. Book your slot now.`,
      deepLink: "/parent-ptm",
    });

    res.status(201).json({ ptm });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/api/ptm/:id", async (req, res) => {
  try {
    const existing = await ptmSvc.getPtm(req.params.id);
    if (!checkTenantAccess(req, existing).allowed) return res.status(404).json({ error: "PTM not found" });

    const ptm = await ptmSvc.updatePtm(req.params.id, req.body, { actorUserId: req.user?.userId });
    if (!ptm) return res.status(404).json({ error: "PTM not found" });
    res.json({ ptm });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/api/ptm/:id", async (req, res) => {
  try {
    const existing = await ptmSvc.getPtm(req.params.id);
    if (!checkTenantAccess(req, existing).allowed) return res.status(404).json({ error: "PTM not found" });

    await ptmSvc.deletePtm(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Slots ──────────────────────────────────────────────────────────

router.get("/api/ptm/:id/slots", async (req, res) => {
  try {
    const ptm = await ptmSvc.getPtm(req.params.id);
    if (!checkTenantAccess(req, ptm).allowed) return res.status(404).json({ error: "PTM not found" });

    const slots = await ptmSvc.getSlotsForPtm(req.params.id);
    res.json({ slots });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/api/ptm/:id/slots/generate", async (req, res) => {
  try {
    const ptm = await ptmSvc.getPtm(req.params.id);
    if (!checkTenantAccess(req, ptm).allowed) return res.status(404).json({ error: "PTM not found" });

    const { teacherId, teacherName, startTime, endTime, durationMinutes } = req.body;
    if (!teacherId || !startTime || !endTime || !durationMinutes) {
      return res.status(400).json({ error: "teacherId, startTime, endTime, durationMinutes are required" });
    }
    if (durationMinutes < 5 || durationMinutes > 120) {
      return res.status(400).json({ error: "durationMinutes must be between 5 and 120" });
    }
    const slots = await ptmSvc.generateSlots({
      ptmId: req.params.id,
      teacherId,
      teacherName,
      startTime,
      endTime,
      durationMinutes: parseInt(durationMinutes, 10),
    });
    res.json({ slots });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/api/ptm/:id/slots/:slotId", async (req, res) => {
  try {
    const ptm = await ptmSvc.getPtm(req.params.id);
    if (!checkTenantAccess(req, ptm).allowed) return res.status(404).json({ error: "PTM not found" });

    await ptmSvc.deleteSlot(req.params.slotId);
    res.json({ success: true });
  } catch (e) {
    if (e.message.includes("not found")) return res.status(404).json({ error: e.message });
    res.status(400).json({ error: e.message });
  }
});

// ── Bookings ───────────────────────────────────────────────────────

router.get("/api/ptm/:id/bookings", async (req, res) => {
  try {
    const ptm = await ptmSvc.getPtm(req.params.id);
    if (!checkTenantAccess(req, ptm).allowed) return res.status(404).json({ error: "PTM not found" });

    const bookings = await ptmSvc.getBookingsForPtm(req.params.id);
    res.json({ bookings });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch("/api/ptm/bookings/:bookingId/status", async (req, res) => {
  try {
    // This route has no :id (ptmId) segment -- resolve tenant via the
    // booking's own ptmId, then that PTM's schoolId.
    const booking = await ptmSvc.getBooking(req.params.bookingId);
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    const ptm = await ptmSvc.getPtm(booking.ptmId);
    if (!checkTenantAccess(req, ptm).allowed) return res.status(404).json({ error: "Booking not found" });

    const { status } = req.body;
    await ptmSvc.updateBookingStatus(req.params.bookingId, status);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ── Notes ──────────────────────────────────────────────────────────

router.get("/api/ptm/:id/notes/:studentId", async (req, res) => {
  try {
    const ptm = await ptmSvc.getPtm(req.params.id);
    if (!checkTenantAccess(req, ptm).allowed) return res.status(404).json({ error: "PTM not found" });

    const notes = await ptmSvc.getNotes(req.params.id, req.params.studentId);
    res.json({ notes });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/api/ptm/:id/notes/:studentId", async (req, res) => {
  try {
    const ptm = await ptmSvc.getPtm(req.params.id);
    if (!checkTenantAccess(req, ptm).allowed) return res.status(404).json({ error: "PTM not found" });

    const { summary, strengths, improvements, actionItems, sharedWithParent } = req.body;
    const notes = await ptmSvc.upsertNotes({
      ptmId:            req.params.id,
      studentId:        req.params.studentId,
      teacherId:        req.user?.userId || "",
      summary,
      strengths,
      improvements,
      actionItems,
      sharedWithParent: !!sharedWithParent,
    });
    res.json({ notes });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Stats ──────────────────────────────────────────────────────────

router.get("/api/ptm/:id/stats", async (req, res) => {
  try {
    const ptm = await ptmSvc.getPtm(req.params.id);
    if (!checkTenantAccess(req, ptm).allowed) return res.status(404).json({ error: "PTM not found" });

    const stats = await ptmSvc.getPtmStats(req.params.id);
    res.json({ stats });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Teachers list (for PTM teacher selector) ───────────────────────

router.get("/api/ptm/teachers", async (req, res) => {
  try {
    const users = await userSvc.listUsers({ schoolId: req.user.schoolId, role: "teacher", status: "active" });
    res.json({ teachers: users });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
