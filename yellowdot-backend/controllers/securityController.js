/**
 * securityController.js — Smart Child Security System
 * ──────────────────────────────────────────────────────────────────
 *
 * GET  /api/child-status/:studentId       — child presence status
 * POST /api/pickup-request                — staff: create unknown pickup request
 * GET  /api/pickup-requests               — list pickup requests
 * PUT  /api/pickup-requests/:id/approve   — parent approves pickup
 * PUT  /api/pickup-requests/:id/reject    — parent rejects pickup
 */

const svc     = require("../services/securityService");
const notif   = require("../services/notificationService");

const DEFAULT_SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";

function resolveCtx(req) {
  return {
    schoolId:    req.user?.schoolId  || DEFAULT_SCHOOL_ID,
    centerId:    req.user?.centerId  || "",
    actorUserId: req.user?.userId    || "system",
  };
}

function logErr(route, e) { console.error(`[${route}]`, e.message); }

// ── GET /api/child-status/:studentId ──────────────────────────────
// Parents get their own child; staff/admin can query any studentId.

async function getChildStatus(req, res) {
  try {
    const { schoolId, centerId } = resolveCtx(req);
    const role = req.user?.role;
    let { studentId } = req.params;

    if (role === "parent") {
      const linkedId = req.user.student?.studentId;
      if (!linkedId) {
        return res.status(403).json({ success: false, error: "No student linked to this parent account." });
      }
      studentId = linkedId; // parents always see their own child
    }

    if (!studentId) {
      return res.status(400).json({ success: false, error: "studentId required." });
    }

    const info = await svc.getChildStatus(studentId, { schoolId, centerId });
    res.json({ success: true, studentId, ...info });
  } catch (e) {
    logErr("GET /api/child-status", e);
    res.status(500).json({ success: false, error: e.message });
  }
}

// ── POST /api/pickup-request ──────────────────────────────────────
// Staff records an unknown person arriving to pick up a child.
// Sends the request to the parent for Approve / Reject.

async function createPickupRequest(req, res) {
  try {
    const { schoolId, centerId, actorUserId } = resolveCtx(req);
    const {
      studentId, studentName, personName, personPhoto,
      relation, staffName, gate,
    } = req.body || {};

    if (!studentId)   return res.status(400).json({ success: false, error: "studentId required." });
    if (!studentName) return res.status(400).json({ success: false, error: "studentName required." });
    if (!personPhoto) return res.status(400).json({ success: false, error: "personPhoto required — please take a photo of the pickup person." });

    const request = await svc.createPickupRequest({
      studentId, studentName, personName, personPhoto,
      relation, staffName, gate,
      schoolId, centerId, requestedBy: actorUserId,
    });

    // Notify parent — fire-and-forget so it never blocks the 200 response
    notif.notifyAsync(() =>
      notif.fireForStudent(studentId, schoolId, {
        type:     notif.TYPES.PICKUP_REQUEST,
        title:    `Unknown person at the gate for ${studentName}`,
        message:  `${personName || "Someone"} (${relation || "unknown relation"}) is requesting to pick up ${studentName}. Staff member: ${staffName || "Staff"}.`,
        deepLink: "/parent-pickup-approval",
        childId:  studentId,
      })
    );

    res.json({
      success: true,
      message: "Pickup request sent to parent for approval.",
      request: { ...request, personPhoto: "<<stored>>" },
    });
  } catch (e) {
    logErr("POST /api/pickup-request", e);
    res.status(500).json({ success: false, error: e.message });
  }
}

// ── GET /api/pickup-requests ──────────────────────────────────────
// Parents see requests for their own child.
// Staff/admin see all requests (or filter by studentId/status).

async function getPickupRequests(req, res) {
  try {
    const { schoolId, centerId } = resolveCtx(req);
    const role = req.user?.role;
    let { studentId, status } = req.query;

    if (role === "parent") {
      const linkedId = req.user.student?.studentId;
      if (!linkedId) return res.status(403).json({ success: false, error: "No student linked." });
      studentId = linkedId;
    }

    const requests = await svc.getPickupRequests({ studentId, status, schoolId, centerId });
    res.json({ success: true, count: requests.length, requests });
  } catch (e) {
    logErr("GET /api/pickup-requests", e);
    res.status(500).json({ success: false, error: e.message });
  }
}

// ── PUT /api/pickup-requests/:id/approve ─────────────────────────

async function approvePickupRequest(req, res) {
  try {
    const { actorUserId } = resolveCtx(req);
    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, error: "Request ID required." });

    const existing = await svc.getPickupRequest(id);
    if (!existing) return res.status(404).json({ success: false, error: "Pickup request not found." });
    if (existing.status !== "pending") {
      return res.status(409).json({ success: false, error: `Request is already ${existing.status}.` });
    }

    const {
      approvedByParent,
      approvedAt,
      authMethod,
      deviceAuthenticated,
    } = req.body || {};

    const updated = await svc.updatePickupRequest(id, {
      status:              "approved",
      approvedBy:          actorUserId,
      resolvedAt:          new Date().toISOString(),
      approvedByParent:    approvedByParent === true,
      approvedAt:          approvedAt || new Date().toISOString(),
      authMethod:          authMethod || "unknown",
      deviceAuthenticated: deviceAuthenticated === true,
    });

    res.json({
      success: true,
      message: "Pickup approved. Staff at the gate has been notified.",
      request: updated,
    });
  } catch (e) {
    logErr("PUT /api/pickup-requests/:id/approve", e);
    res.status(500).json({ success: false, error: e.message });
  }
}

// ── PUT /api/pickup-requests/:id/reject ──────────────────────────

async function rejectPickupRequest(req, res) {
  try {
    const { actorUserId } = resolveCtx(req);
    const { id } = req.params;
    const { reason } = req.body || {};
    if (!id) return res.status(400).json({ success: false, error: "Request ID required." });

    const existing = await svc.getPickupRequest(id);
    if (!existing) return res.status(404).json({ success: false, error: "Pickup request not found." });
    if (existing.status !== "pending") {
      return res.status(409).json({ success: false, error: `Request is already ${existing.status}.` });
    }

    const updated = await svc.updatePickupRequest(id, {
      status:          "rejected",
      approvedBy:      actorUserId,
      rejectedReason:  reason || "Rejected by parent.",
      resolvedAt:      new Date().toISOString(),
    });

    res.json({
      success: true,
      message: "Pickup rejected. Staff at the gate has been notified.",
      request: updated,
    });
  } catch (e) {
    logErr("PUT /api/pickup-requests/:id/reject", e);
    res.status(500).json({ success: false, error: e.message });
  }
}

module.exports = {
  getChildStatus,
  createPickupRequest,
  getPickupRequests,
  approvePickupRequest,
  rejectPickupRequest,
};
