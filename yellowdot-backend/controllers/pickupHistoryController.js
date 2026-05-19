/**
 * pickupHistoryController.js — Firestore-backed
 *
 * GET  /api/pickup-history      — list (filter: date, studentId, approvalStatus)
 * GET  /api/pickup-history/:id  — get single entry (includes selfie)
 * POST /api/pickup-history      — record a pickup verification event
 */

const svc = require("../services/pickupHistoryService");

const DEFAULT_SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";

const VALID_STATUSES = ["Authorized", "Emergency_Authorized", "Unauthorized"];

function resolveCtx(req) {
  return {
    schoolId:    req.user?.schoolId  || DEFAULT_SCHOOL_ID,
    centerId:    req.user?.centerId  || "",
    actorUserId: req.user?.userId    || "system",
  };
}

function logErr(route, e) { console.error(`[${route}]`, e.message); }

// ── GET /api/pickup-history ───────────────────────────────────────

async function getPickupHistory(req, res) {
  try {
    const { schoolId, centerId } = resolveCtx(req);
    const bypassCenter = ["developer", "super_admin", "admin"].includes(req.user?.role);
    const { date, studentId, approvalStatus } = req.query;

    let entries = await svc.getAll(
      studentId || null,
      { schoolId, centerId: bypassCenter ? undefined : centerId }
    );

    if (date)           entries = entries.filter(e => e.date           === date);
    if (approvalStatus) entries = entries.filter(e => e.approvalStatus === approvalStatus);

    // Strip selfie from list view to keep payload small
    const light = entries.map(({ selfieUrl, ...rest }) => ({
      ...rest,
      hasSelfie: !!selfieUrl,
    }));

    res.json({ success: true, count: light.length, entries: light });
  } catch (e) {
    logErr("GET /api/pickup-history", e);
    res.status(500).json({ success: false, error: e.message });
  }
}

// ── GET /api/pickup-history/:id ───────────────────────────────────

async function getPickupHistoryEntry(req, res) {
  try {
    const entry = await svc.getOne(req.params.id);
    if (!entry) return res.status(404).json({ success: false, error: "Entry not found." });
    res.json({ success: true, entry });
  } catch (e) {
    logErr("GET /api/pickup-history/:id", e);
    res.status(500).json({ success: false, error: e.message });
  }
}

// ── POST /api/pickup-history ──────────────────────────────────────

async function createPickupHistory(req, res) {
  try {
    const { schoolId, centerId, actorUserId } = resolveCtx(req);
    const {
      studentId, studentName, pickupName, relation,
      selfieImage, approvalStatus, verifiedBy,
    } = req.body || {};

    if (!studentId)   return res.status(400).json({ success: false, error: "studentId required." });
    if (!studentName) return res.status(400).json({ success: false, error: "studentName required." });
    if (!approvalStatus || !VALID_STATUSES.includes(approvalStatus)) {
      return res.status(400).json({
        success: false,
        error: `approvalStatus must be one of: ${VALID_STATUSES.join(", ")}`,
      });
    }

    const selfieStr = typeof selfieImage === "string" ? selfieImage.slice(0, 49_000) : "";

    const entry = await svc.record(
      {
        studentId,
        studentName,
        pickupName:     pickupName  || "",
        relation:       relation    || "",
        selfieUrl:      selfieStr,
        approvalStatus,
        verifiedBy:     verifiedBy  || actorUserId,
      },
      { schoolId, centerId, actorUserId }
    );

    console.log(
      `[pickup-hist] ${approvalStatus}  student=${studentName}(${studentId})` +
      `  pickup=${pickupName}  by=${verifiedBy || actorUserId}`
    );

    res.json({
      success: true,
      message: `Pickup ${approvalStatus.toLowerCase().replace("_", " ")} recorded.`,
      entry:   { ...entry, selfieUrl: selfieStr ? "<<stored>>" : "" },
    });
  } catch (e) {
    logErr("POST /api/pickup-history", e);
    res.status(500).json({ success: false, error: e.message });
  }
}

module.exports = { getPickupHistory, getPickupHistoryEntry, createPickupHistory };
