/**
 * journeyRoutes.js — Child Journey Module · API Routes
 *
 * Staff endpoints (require auth + staff role):
 *   POST   /api/journey              — create entry (any kind)
 *   GET    /api/journey              — list entries (staff view, unfiltered)
 *   PUT    /api/journey/:id          — edit text fields
 *   DELETE /api/journey/:id          — delete entry
 *
 * Parent endpoints (require auth + linked child, own child only):
 *   GET    /api/parent/journey       — child's journey (visibility-filtered)
 */

const express    = require("express");
const router     = express.Router();
const journeySvc    = require("../services/journeyService");
const milestoneSvc  = require("../services/milestoneService");
const notif         = require("../services/notificationService");
const { authenticate, blockUnknown, staffOnly, requireOwnChild } = require("../middleware/authMiddleware");

const SCHOOL_ID = process.env.SCHOOL_ID || "ydseawoods";

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveCtx(req) {
  return {
    schoolId:    req.user?.schoolId || SCHOOL_ID,
    centerId:    req.user?.centerId || "",
    actorUserId: req.user?.userId   || "system",
  };
}

const DOMAIN_LABELS = {
  social:        "Social Development",
  emotional:     "Emotional Development",
  communication: "Communication",
  creativity:    "Creativity",
  leadership:    "Leadership",
  confidence:    "Confidence",
  fine_motor:    "Fine Motor Skills",
  gross_motor:   "Gross Motor Skills",
};

function buildNotification(entry) {
  switch (entry.kind) {
    case "observation":
      return {
        type:     notif.TYPES.NEW_OBSERVATION,
        title:    "📝 New observation from teacher",
        message:  `${DOMAIN_LABELS[entry.domain] || entry.domain}${entry.observationText ? ` · ${entry.observationText.slice(0, 80)}` : ""}`,
        deepLink: "/parent-journey",
        batchKey: `obs-${entry.studentId}-${entry.date}`,
      };
    case "photo":
    case "video":
      return {
        type:     notif.TYPES.NEW_MEMORY,
        title:    `📸 New ${entry.kind} from school`,
        message:  entry.caption || "A new moment was captured.",
        deepLink: "/parent-journey",
        batchKey: `media-${entry.studentId}-${entry.date}`,
      };
    case "artwork":
      return {
        type:     notif.TYPES.NEW_ARTWORK,
        title:    "🎨 New artwork from school",
        message:  entry.artworkTitle || entry.caption || "New artwork has been added to the journey.",
        deepLink: "/parent-journey",
        batchKey: `art-${entry.studentId}-${entry.date}`,
      };
    case "milestone":
      return {
        type:          notif.TYPES.MILESTONE_ACHIEVED,
        title:         `⭐ ${entry.milestoneTitle || "A milestone was reached!"}`,
        message:       entry.momentNote || "A new milestone has been achieved.",
        deepLink:      "/parent-journey",
        milestoneFlag: true,
      };
    case "achievement":
      return {
        type:     notif.TYPES.NEW_OBSERVATION,
        title:    "🏆 New achievement recorded",
        message:  entry.caption || entry.observationText || "A new achievement was added.",
        deepLink: "/parent-journey",
        batchKey: `ach-${entry.studentId}-${entry.date}`,
      };
    default:
      return null;
  }
}

// ── POST /api/journey — create entry (staff only) ────────────────────────────
router.post("/api/journey", authenticate, blockUnknown, staffOnly, async (req, res) => {
  try {
    const { schoolId, centerId, actorUserId } = resolveCtx(req);
    const entry = await journeySvc.createEntry(req.body, { schoolId, centerId, actorUserId });

    const notifPayload = buildNotification(entry);
    if (notifPayload) {
      notif.notifyAsync(() =>
        notif.fireForStudent(entry.studentId, schoolId, notifPayload)
      );
    }

    res.status(201).json({ entry });
  } catch (e) {
    const status = /required|invalid|must be/i.test(e.message) ? 400 : 500;
    res.status(status).json({ error: e.message });
  }
});

// ── GET /api/journey — list entries, unfiltered staff view (staff only) ──────
router.get("/api/journey", authenticate, blockUnknown, staffOnly, async (req, res) => {
  try {
    const { schoolId } = resolveCtx(req);
    const { studentId, classId, kind, academicYear, limit } = req.query;
    const kinds = kind ? kind.split(",").map(k => k.trim()).filter(Boolean) : [];
    const entries = await journeySvc.getForStaff({
      schoolId, studentId, classId, kinds,
      academicYear, limit: Number(limit) || 200,
    });
    res.json({ entries });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── PUT /api/journey/:id — update text fields (staff only) ───────────────────
router.put("/api/journey/:id", authenticate, blockUnknown, staffOnly, async (req, res) => {
  try {
    const { schoolId, actorUserId } = resolveCtx(req);
    const entry = await journeySvc.updateEntry(req.params.id, req.body, { schoolId, actorUserId });
    res.json({ entry });
  } catch (e) {
    const status = /not found/i.test(e.message) ? 404 : /forbidden/i.test(e.message) ? 403 : 500;
    res.status(status).json({ error: e.message });
  }
});

// ── DELETE /api/journey/:id (staff only) ──────────────────────────────────────
router.delete("/api/journey/:id", authenticate, blockUnknown, staffOnly, async (req, res) => {
  try {
    const { schoolId } = resolveCtx(req);
    await journeySvc.deleteEntry(req.params.id, { schoolId });
    res.json({ ok: true });
  } catch (e) {
    const status = /not found/i.test(e.message) ? 404 : /forbidden/i.test(e.message) ? 403 : 500;
    res.status(status).json({ error: e.message });
  }
});

// ── POST /api/milestones — teacher creates a milestone (staff only) ──────────
router.post("/api/milestones", authenticate, blockUnknown, staffOnly, async (req, res) => {
  try {
    const { schoolId, actorUserId } = resolveCtx(req);
    const entry = await milestoneSvc.createTeacherMilestone(req.body, { schoolId, actorUserId });
    res.status(201).json({ entry });
  } catch (e) {
    const status = /required/i.test(e.message) ? 400 : 500;
    res.status(status).json({ error: e.message });
  }
});

// ── POST /api/milestones/check — trigger auto-milestone check (staff only) ───
router.post("/api/milestones/check", authenticate, blockUnknown, staffOnly, async (req, res) => {
  try {
    const { schoolId } = resolveCtx(req);
    const { studentId, date } = req.body;
    if (!studentId) return res.status(400).json({ error: "studentId is required." });
    const created = await milestoneSvc.checkAutoMilestones({ studentId, schoolId, date });
    res.json({ created, count: created.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/milestones/presets — static preset labels, no per-child data ────
router.get("/api/milestones/presets", authenticate, (req, res) => {
  res.json({ presets: milestoneSvc.TEACHER_MILESTONES });
});

// ── GET /api/parent/journey — child's unified journey (parent, own child only) ─
// requireOwnChild rejects staff (403) and parents with no linked child (403),
// and sets req.ownChildId to the server-resolved linked studentId. The route
// deliberately ignores req.query.childId for the actual query -- a client-
// supplied childId can no longer influence which child's data is returned.
router.get("/api/parent/journey", authenticate, blockUnknown, requireOwnChild, async (req, res) => {
  try {
    const { schoolId } = resolveCtx(req);
    const { kind, academicYear, limit } = req.query;

    const kinds = kind ? kind.split(",").map(k => k.trim()).filter(Boolean) : [];
    const entries = await journeySvc.getForStudent({
      schoolId, studentId: req.ownChildId, kinds,
      academicYear, limit: Number(limit) || 100,
    });

    res.json({ entries });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
