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
const parentEventSvc                 = require("../services/parentEventService");
const eventSvc                       = require("../services/eventService");
const parentPtmSvc                   = require("../services/parentPtmService");
const ptmSvc                         = require("../services/ptmService");
const parentIncidentSvc              = require("../services/parentIncidentService");
const incidentSvc                    = require("../services/incidentService");
const notif                          = require("../services/notificationService");
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

// ── GET /api/parent/events ─────────────────────────────────────────
// Events filtered to child's class, enriched with parent's RSVP status.
// Query: ?studentId=YD001 (optional; defaults to first linked child).
router.get("/api/parent/events", loadParent, async (req, res) => {
  try {
    const studentId = req.query.studentId || req.parent.studentIds?.[0];
    let studentClassId, resolvedStudentId;
    if (studentId && req.parent.studentIds?.includes(studentId)) {
      resolvedStudentId = studentId;
      try {
        const student = await studentSvc.getOne(studentId);
        studentClassId = student?.classId || undefined;
      } catch { /* non-fatal */ }
    }
    const data = await parentEventSvc.getEventsView({
      schoolId:       req.parent.schoolId,
      studentClassId,
      studentId:      resolvedStudentId,
      parentId:       req.parent.uid,
    });
    res.json(data);
  } catch (e) {
    console.error("[GET /api/parent/events]", e.message);
    res.status(500).json({ error: "Failed to load events." });
  }
});

// ── POST /api/parent/events/:id/rsvp ──────────────────────────────
// Body: { response: "attending" | "not_attending" | "maybe", studentId }
router.post("/api/parent/events/:id/rsvp", loadParent, async (req, res) => {
  try {
    const eventId  = req.params.id;
    const studentId = req.body.studentId || req.parent.studentIds?.[0];
    const response  = req.body.response;

    if (!["attending", "not_attending", "maybe"].includes(response)) {
      return res.status(400).json({ error: "Invalid response. Use: attending, not_attending, or maybe." });
    }
    if (!studentId || !req.parent.studentIds?.includes(studentId)) {
      return res.status(403).json({ error: "Student not linked to this account." });
    }

    const event = await eventSvc.getEvent(eventId);
    if (!event || event.schoolId !== req.parent.schoolId) {
      return res.status(404).json({ error: "Event not found." });
    }
    if (!event.rsvpRequired) {
      return res.status(400).json({ error: "This event does not require RSVP." });
    }

    const rsvp = await eventSvc.upsertRsvp({
      eventId, studentId, parentId: req.parent.uid, response,
    });
    res.json({ rsvp });
  } catch (e) {
    console.error("[POST /api/parent/events/:id/rsvp]", e.message);
    res.status(500).json({ error: "Failed to submit RSVP." });
  }
});

// ── GET /api/parent/ptm ────────────────────────────────────────────
// PTMs visible to this parent's child (class-filtered) with slot + booking info.
router.get("/api/parent/ptm", loadParent, async (req, res) => {
  try {
    const parent = req.parent;
    const requestedStudentId = req.query.studentId;
    // Never trust a client-supplied studentId — only honor it if it's actually
    // one of this parent's own linked children, otherwise fall back to their
    // first linked child (matches the "force the server value" pattern used
    // elsewhere for parent-scoped routes).
    const studentId = (requestedStudentId && parent.studentIds?.includes(requestedStudentId))
      ? requestedStudentId
      : parent.studentIds?.[0];

    let studentClassId = null;
    if (studentId) {
      try {
        const student = await studentSvc.getOne(studentId);
        studentClassId = student?.classId || null;
      } catch { /* class resolution failed — show all */ }
    }

    const data = await parentPtmSvc.getPtmsView({ schoolId: parent.schoolId, studentClassId, studentId, parentId: parent.parentId });
    res.json(data);
  } catch (e) {
    console.error("[GET /api/parent/ptm]", e.message);
    res.status(500).json({ error: "Failed to load PTMs." });
  }
});

// ── POST /api/parent/ptm/:id/book ─────────────────────────────────
// Book a slot in a PTM for a linked child.
router.post("/api/parent/ptm/:id/book", loadParent, async (req, res) => {
  try {
    const parent    = req.parent;
    const { studentId, slotId } = req.body;
    if (!studentId || !slotId) return res.status(400).json({ error: "studentId and slotId are required" });

    // Ensure student belongs to this parent
    if (!parent.studentIds?.includes(studentId)) {
      return res.status(403).json({ error: "Student not linked to this account." });
    }

    const ptm = await ptmSvc.getPtm(req.params.id);
    if (!ptm || ptm.schoolId !== parent.schoolId) return res.status(404).json({ error: "PTM not found" });

    const booking = await ptmSvc.bookSlot({ ptmId: ptm.id, slotId, studentId, parentId: parent.parentId });

    const SCHOOL_ID = process.env.SCHOOL_ID || "ydseawoods";
    notif.notifyAsync(() =>
      notif.fireForStudent(studentId, SCHOOL_ID, {
        type:     notif.TYPES.PTM_BOOKED,
        title:    `PTM Slot Booked`,
        message:  `Your slot for "${ptm.title}" has been confirmed.`,
        deepLink: "/parent-ptm",
      })
    );

    res.status(201).json({ booking });
  } catch (e) {
    console.error("[POST /api/parent/ptm/:id/book]", e.message);
    const status = e.message.includes("not available") || e.message.includes("Already has") ? 409 : 500;
    res.status(status).json({ error: e.message });
  }
});

// ── PATCH /api/parent/ptm/bookings/:bookingId/reschedule ───────────
router.patch("/api/parent/ptm/bookings/:bookingId/reschedule", loadParent, async (req, res) => {
  try {
    const { newSlotId } = req.body;
    if (!newSlotId) return res.status(400).json({ error: "newSlotId is required" });

    const booking = await ptmSvc.rescheduleBooking(req.params.bookingId, newSlotId, { parentId: req.parent.parentId });

    const SCHOOL_ID = process.env.SCHOOL_ID || "ydseawoods";
    notif.notifyAsync(() =>
      notif.fireForStudent(booking.studentId, SCHOOL_ID, {
        type:     notif.TYPES.PTM_RESCHEDULED,
        title:    "PTM Slot Rescheduled",
        message:  "Your PTM appointment has been rescheduled successfully.",
        deepLink: "/parent-ptm",
      })
    );

    res.json({ booking });
  } catch (e) {
    console.error("[PATCH /api/parent/ptm/bookings/:bookingId/reschedule]", e.message);
    const status = e.message.includes("not found") ? 404 : e.message.includes("not available") ? 409 : 500;
    res.status(status).json({ error: e.message });
  }
});

// ── DELETE /api/parent/ptm/bookings/:bookingId ────────────────────
router.delete("/api/parent/ptm/bookings/:bookingId", loadParent, async (req, res) => {
  try {
    await ptmSvc.cancelBooking(req.params.bookingId, { parentId: req.parent.parentId });
    res.json({ success: true });
  } catch (e) {
    console.error("[DELETE /api/parent/ptm/bookings/:bookingId]", e.message);
    const status = e.message.includes("not found") ? 404 : 500;
    res.status(status).json({ error: e.message });
  }
});

// Exported for unit testing (pure middleware, no I/O).
// ── GET /api/parent/incidents ──────────────────────────────────────
// Incident reports for all linked children.
router.get("/api/parent/incidents", loadParent, async (req, res) => {
  try {
    const parent    = req.parent;
    const data = await parentIncidentSvc.getIncidentsForParent({
      schoolId:   parent.schoolId,
      studentIds: parent.studentIds || [],
    });
    res.json(data);
  } catch (e) {
    console.error("[GET /api/parent/incidents]", e.message);
    res.status(500).json({ error: "Failed to load incidents." });
  }
});

// ── POST /api/parent/incidents/:id/acknowledge ─────────────────────
// Parent acknowledges an incident report.
router.post("/api/parent/incidents/:id/acknowledge", loadParent, async (req, res) => {
  try {
    const parent    = req.parent;
    const incident  = await incidentSvc.getIncident(req.params.id);
    if (!incident) return res.status(404).json({ error: "Incident not found" });

    // Tenant check first (defense-in-depth alongside the ownership check
    // below), then confirm this incident belongs to one of the parent's
    // own children.
    if (incident.schoolId !== parent.schoolId || !(parent.studentIds || []).includes(incident.studentId)) {
      return res.status(403).json({ error: "Not authorised to acknowledge this incident." });
    }

    const { acknowledgementNotes = "" } = req.body;
    const ack = await incidentSvc.acknowledge(req.params.id, { parentId: parent.parentId, acknowledgementNotes });

    notif.notifyAsync(() =>
      notif.fireForStudent(incident.studentId, parent.schoolId, {
        type:     notif.TYPES.INCIDENT_ACKNOWLEDGED,
        title:    "Incident Acknowledged",
        message:  `Parent has acknowledged the incident report: ${incident.incidentType}.`,
        deepLink: "/incidents",
      })
    );

    res.json({ acknowledgement: ack });
  } catch (e) {
    console.error("[POST /api/parent/incidents/:id/acknowledge]", e.message);
    res.status(500).json({ error: "Failed to acknowledge incident." });
  }
});

router.parentOnly = parentOnly;

module.exports = router;
