/**
 * incidentRoutes.js — Incident / Accident Report endpoints
 * ──────────────────────────────────────────────────────────
 * All routes require a valid Firebase token (authenticate middleware).
 *
 *   GET    /api/incidents                       — list + filter
 *   GET    /api/incidents/dashboard             — stats for dashboard
 *   GET    /api/incidents/staff                 — list staff users (for witness selector)
 *   POST   /api/incidents                       — create report
 *   GET    /api/incidents/:id                   — get single report
 *   PUT    /api/incidents/:id                   — update report
 *   DELETE /api/incidents/:id                   — delete report
 *   PATCH  /api/incidents/:id/status            — change status
 *   GET    /api/incidents/:id/audit             — audit log
 *   GET    /api/incidents/:id/acknowledgement   — get ack
 */

const express  = require("express");
const router   = express.Router();
const incSvc   = require("../services/incidentService");
const userSvc  = require("../services/userService");
const { authenticate } = require("../middleware/authMiddleware");
const notif    = require("../services/notificationService");
const studentSvc = require("../services/studentService");

const SCHOOL_ID = process.env.SCHOOL_ID || "ydseawoods";

router.use(authenticate);

// ── Helpers ────────────────────────────────────────────────────────

async function notifyParentForStudent(studentId, type, { title, message, deepLink }) {
  try {
    notif.notifyAsync(() =>
      notif.fireForStudent(studentId, SCHOOL_ID, { type, title, message, deepLink })
    );
  } catch { /* non-critical */ }
}

// ── Dashboard stats ────────────────────────────────────────────────

router.get("/api/incidents/dashboard", async (req, res) => {
  try {
    const stats = await incSvc.getDashboardStats({ schoolId: SCHOOL_ID });
    res.json({ stats });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Staff list (for witness selector) ─────────────────────────────

router.get("/api/incidents/staff", async (req, res) => {
  try {
    const users = await userSvc.listUsers({ schoolId: SCHOOL_ID, status: "active" });
    const staff = users.filter(u => u.role !== "parent");
    res.json({ staff });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── List incidents ─────────────────────────────────────────────────

router.get("/api/incidents", async (req, res) => {
  try {
    const { studentId, classId, severity, status, dateFrom, dateTo } = req.query;
    const incidents = await incSvc.getIncidents({ schoolId: SCHOOL_ID, studentId, classId, severity, status, dateFrom, dateTo });

    // Attach acknowledgement info
    const enriched = await Promise.all(incidents.map(async inc => {
      const ack = await incSvc.getAcknowledgement(inc.id);
      return { ...inc, acknowledged: !!ack, acknowledgedAt: ack?.acknowledgedAt || null };
    }));

    res.json({ incidents: enriched });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Create incident ────────────────────────────────────────────────

router.post("/api/incidents", async (req, res) => {
  try {
    const { studentId, incidentType, severity, incidentDate, location, description, actionTaken } = req.body;
    if (!studentId || !incidentType || !incidentDate || !location || !description || !actionTaken) {
      return res.status(400).json({ error: "studentId, incidentType, incidentDate, location, description, actionTaken are required" });
    }

    const incident = await incSvc.createIncident(req.body, { schoolId: SCHOOL_ID, actorUserId: req.user?.uid });

    if (incident.notifyParent) {
      const priorityMap = { low: "low", medium: "medium", high: "high", critical: "high" };
      const isCritical  = incident.severity === "critical";

      notifyParentForStudent(studentId, isCritical ? notif.TYPES.CRITICAL_INCIDENT : notif.TYPES.INCIDENT_REPORTED, {
        title:    isCritical ? `⚠️ Critical Incident: ${incident.incidentType}` : `Incident Report: ${incident.incidentType}`,
        message:  `An incident involving your child was reported on ${incident.incidentDate}. Please check the Parent App for details.`,
        deepLink: "/parent-incidents",
      });
    }

    res.status(201).json({ incident });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Get single incident ────────────────────────────────────────────

router.get("/api/incidents/:id", async (req, res) => {
  try {
    const incident = await incSvc.getIncident(req.params.id);
    if (!incident) return res.status(404).json({ error: "Incident not found" });
    const ack = await incSvc.getAcknowledgement(req.params.id);
    res.json({ incident: { ...incident, acknowledged: !!ack, acknowledgedAt: ack?.acknowledgedAt || null } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Update incident ────────────────────────────────────────────────

router.put("/api/incidents/:id", async (req, res) => {
  try {
    const incident = await incSvc.updateIncident(req.params.id, req.body, { actorUserId: req.user?.uid });
    if (!incident) return res.status(404).json({ error: "Incident not found" });

    if (incident.notifyParent) {
      notifyParentForStudent(incident.studentId, notif.TYPES.INCIDENT_UPDATED, {
        title:    `Incident Update: ${incident.incidentType}`,
        message:  "The incident report for your child has been updated. Please check the Parent App.",
        deepLink: "/parent-incidents",
      });
    }

    res.json({ incident });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Delete incident ────────────────────────────────────────────────

router.delete("/api/incidents/:id", async (req, res) => {
  try {
    await incSvc.deleteIncident(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Update status ──────────────────────────────────────────────────

router.patch("/api/incidents/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    await incSvc.updateStatus(req.params.id, status, { actorUserId: req.user?.uid });
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ── Audit log ──────────────────────────────────────────────────────

router.get("/api/incidents/:id/audit", async (req, res) => {
  try {
    const logs = await incSvc.getAuditLog(req.params.id);
    res.json({ logs });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Acknowledgement (staff read) ───────────────────────────────────

router.get("/api/incidents/:id/acknowledgement", async (req, res) => {
  try {
    const ack = await incSvc.getAcknowledgement(req.params.id);
    res.json({ acknowledgement: ack });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
