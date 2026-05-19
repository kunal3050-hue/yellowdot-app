/**
 * parentAttendanceController.js — Firestore-backed
 *
 * POST /api/parent-attendance                  — save a parent check-in/out record
 * GET  /api/parent-attendance                  — list records (?date=&studentId=&gate=)
 * GET  /api/parent-attendance/validate-gate    — validate gate QR code
 *
 * QR format:  YD-{BRANCH}-GATE-{N}   e.g. YD-SEAWOODS-GATE-1
 */

const svc = require("../services/parentAttendanceService");

const DEFAULT_SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";

function resolveCtx(req) {
  return {
    schoolId:    req.user?.schoolId  || DEFAULT_SCHOOL_ID,
    centerId:    req.user?.centerId  || "",
    actorUserId: req.user?.userId    || "system",
  };
}

// ── Gate QR parser ────────────────────────────────────────────────
function parseGateQR(raw) {
  if (!raw || !raw.startsWith("YD-")) return null;
  const parts = raw.split("-");
  if (parts.length < 4) return null;
  const branch = parts[1].toUpperCase();
  const gate   = parts.slice(2).join("-").toUpperCase();
  return { branch, gate, label: `${branch} / ${gate}`, raw };
}

// ── GET /api/parent-attendance/validate-gate?qr= ─────────────────

function validateGate(req, res) {
  const { qr } = req.query;
  const parsed = parseGateQR(qr);
  if (!parsed) {
    return res.status(400).json({
      success: false,
      error:   "Invalid gate QR code. Expected format: YD-BRANCH-GATE-N",
    });
  }
  res.json({ success: true, gate: parsed });
}

// ── GET /api/parent-attendance ────────────────────────────────────

async function getParentAttendance(req, res) {
  try {
    const { schoolId, centerId } = resolveCtx(req);
    const bypassCenter = ["developer", "super_admin", "admin"].includes(req.user?.role);
    const { date, studentId, gate, class: cls } = req.query;
    const entries = await svc.getAll({
      date, studentId, gate, class: cls,
      schoolId,
      centerId: bypassCenter ? undefined : centerId,
    });
    res.json({ success: true, count: entries.length, entries });
  } catch (e) {
    console.error("[GET /api/parent-attendance]", e.message);
    res.status(500).json({ success: false, error: e.message });
  }
}

// ── POST /api/parent-attendance ───────────────────────────────────

async function createParentAttendance(req, res) {
  try {
    const { schoolId, centerId, actorUserId } = resolveCtx(req);
    const {
      studentId, studentName, parentName, relation,
      action, gate, selfieImage, faceDetected, gps,
    } = req.body || {};

    if (!studentId)   return res.status(400).json({ success: false, error: "studentId required." });
    if (!studentName) return res.status(400).json({ success: false, error: "studentName required." });
    if (!parentName)  return res.status(400).json({ success: false, error: "parentName required." });
    if (!action || !["Check_In", "Check_Out"].includes(action)) {
      return res.status(400).json({ success: false, error: "action must be Check_In or Check_Out." });
    }
    if (!selfieImage) {
      return res.status(400).json({ success: false, error: "selfieImage required (face selfie is mandatory)." });
    }
    if (faceDetected !== "true" && faceDetected !== true) {
      return res.status(400).json({ success: false, error: "Face must be detected before submitting." });
    }

    const selfieStr = typeof selfieImage === "string" ? selfieImage.slice(0, 49_000) : "";

    const entry = await svc.record(
      {
        studentId,
        studentName,
        parentName,
        relation:         relation || "Guardian",
        action,
        gate:             gate || "",
        selfieImage:      selfieStr,
        faceDetected:     "true",
        attendanceMethod: "Parent_QR",
        gps:              gps || "unavailable",
      },
      { schoolId, centerId, actorUserId }
    );

    console.log(
      `[parent-att] ${action}  student=${studentName}(${studentId})` +
      `  parent=${parentName}  gate=${gate}  gps=${gps}`
    );

    res.json({
      success: true,
      message: `${action.replace("_", " ")} recorded for ${studentName}.`,
      entry:   { ...entry, selfieImage: "<<stored>>" },
    });
  } catch (e) {
    console.error("[POST /api/parent-attendance]", e.message);
    res.status(500).json({ success: false, error: e.message });
  }
}

module.exports = { validateGate, getParentAttendance, createParentAttendance };
