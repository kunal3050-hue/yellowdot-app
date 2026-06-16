/**
 * eventRoutes.js — Staff CRUD for Events
 *
 *   GET    /api/events           — list all events for school
 *   POST   /api/events           — create event
 *   PUT    /api/events/:id       — update event
 *   DELETE /api/events/:id       — delete event
 *   GET    /api/events/:id/rsvps — list RSVPs for an event (staff view)
 */

const express = require("express");
const router  = express.Router();

const { authenticate, blockUnknown } = require("../middleware/authMiddleware");
const eventSvc  = require("../services/eventService");
const notif     = require("../services/notificationService");
const studentSvc = require("../services/studentService");

const SCHOOL_ID = process.env.SCHOOL_ID || "ydseawoods";

// All event staff routes require auth
router.use(authenticate, blockUnknown);

// ── List ──────────────────────────────────────────────────────────────────────

router.get("/api/events", async (req, res) => {
  try {
    const events = await eventSvc.getEvents({ schoolId: SCHOOL_ID });
    // Enrich with attending RSVP count
    const enriched = await Promise.all(
      events.map(async ev => ({
        ...ev,
        rsvpCount: ev.rsvpRequired ? await eventSvc.getRsvpCount(ev.id) : 0,
      }))
    );
    res.json({ events: enriched });
  } catch (e) {
    res.status(500).json({ error: "Failed to load events." });
  }
});

// ── Create ────────────────────────────────────────────────────────────────────

router.post("/api/events", async (req, res) => {
  try {
    const actorUserId = req.user?.uid || "system";
    const event = await eventSvc.createEvent(req.body, { schoolId: SCHOOL_ID, actorUserId });

    // Push notification to affected parents if enabled
    if (event.pushToParentApp) {
      _notifyAffectedStudents(event, {
        type:     notif.TYPES.EVENT_CREATED,
        title:    `New Event: ${event.title}`,
        message:  `${event.title} on ${event.eventDate}${event.venue ? ` at ${event.venue}` : ""}.`,
        deepLink: "/parent-events",
      });
    }

    res.status(201).json({ event });
  } catch (e) {
    res.status(500).json({ error: "Failed to create event." });
  }
});

// ── Update ────────────────────────────────────────────────────────────────────

router.put("/api/events/:id", async (req, res) => {
  try {
    const actorUserId = req.user?.uid || "system";
    const event = await eventSvc.updateEvent(req.params.id, req.body, { actorUserId });
    if (!event) return res.status(404).json({ error: "Event not found." });

    if (event.pushToParentApp) {
      _notifyAffectedStudents(event, {
        type:     notif.TYPES.EVENT_UPDATED,
        title:    `Event Updated: ${event.title}`,
        message:  `Details for ${event.title} have been updated.`,
        deepLink: "/parent-events",
      });
    }

    res.json({ event });
  } catch (e) {
    res.status(500).json({ error: "Failed to update event." });
  }
});

// ── Delete ────────────────────────────────────────────────────────────────────

router.delete("/api/events/:id", async (req, res) => {
  try {
    const deleted = await eventSvc.deleteEvent(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Event not found." });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to delete event." });
  }
});

// ── RSVPs (staff read) ────────────────────────────────────────────────────────

router.get("/api/events/:id/rsvps", async (req, res) => {
  try {
    const rsvps = await eventSvc.getRsvpsForEvent(req.params.id);
    res.json({ rsvps });
  } catch (e) {
    res.status(500).json({ error: "Failed to load RSVPs." });
  }
});

// ── Internal: fire push for all students in affected classes ──────────────────

function _notifyAffectedStudents(event, payload) {
  notif.notifyAsync(async () => {
    try {
      const snap = await require("../firebaseAdmin").db
        .collection("students")
        .where("schoolId", "==", SCHOOL_ID)
        .get();

      for (const doc of snap.docs) {
        const student = doc.data();
        if (!student.studentId) continue;

        // Class filter
        if (event.appliesTo === "selected") {
          const classIds = event.classIds || [];
          if (!classIds.includes(student.classId)) continue;
        }

        await notif.fireForStudent(student.studentId, SCHOOL_ID, {
          ...payload,
          childId: student.studentId,
        });
      }
    } catch (err) {
      // Non-critical — swallow notification errors
    }
  });
}

module.exports = router;
