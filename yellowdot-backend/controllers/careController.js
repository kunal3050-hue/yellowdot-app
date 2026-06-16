/**
 * careController.js — Care & Hygiene
 *
 * POST /api/care          — log a care event
 * GET  /api/care/history  — child-wise / classroom history
 * GET  /api/care/summary  — daily summary by type + student
 */

const svc   = require("../services/careService");
const notif = require("../services/notificationService");

const DEFAULT_SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";

function resolveCtx(req) {
  return {
    schoolId:    req.user?.schoolId  || DEFAULT_SCHOOL_ID,
    centerId:    req.user?.centerId  || "",
    actorUserId: req.user?.userId    || "system",
  };
}

function logErr(route, e) { console.error(`[${route}]`, e.message); }

const TYPE_EMOJI = {
  Urine:          "🟡",
  Motion:         "🟤",
  Both:           "🟢",
  "Diaper Change":"🔵",
  "Toilet Visit": "🚽",
  Accident:       "⚠️",
  "Water Refilled":"💧",
};

// POST /api/care
async function logCare(req, res) {
  try {
    const { schoolId, centerId, actorUserId } = resolveCtx(req);
    const { studentId, studentName, class: cls, type, notes, date } = req.body || {};

    const entry = await svc.logCare({
      studentId, studentName, class: cls,
      type, notes, date,
      centerId, schoolId,
      loggedBy: actorUserId,
    });

    notif.notifyAsync(() => notif.fireForStudent(studentId, schoolId, {
      type:     notif.TYPES.CARE_LOGGED,
      childId:  studentId,
      title:    `${studentName || studentId} — ${type}`,
      message:  type === "Water Refilled"
        ? `${studentName || studentId}'s water bottle was refilled${notes ? ` · ${notes}` : ""}.`
        : notes
          ? `${TYPE_EMOJI[type] || "🩺"} ${type} logged${notes ? `: ${notes}` : ""}.`
          : `${TYPE_EMOJI[type] || "🩺"} ${type} logged at school.`,
      deepLink: "/parent-care",
    }));

    res.json({ success: true, message: "Care event logged.", entry });
  } catch (e) {
    logErr("POST /api/care", e);
    res.status(400).json({ success: false, error: e.message });
  }
}

// GET /api/care/history?studentId=&date=&from=&to=&type=&limit=
async function getCareHistory(req, res) {
  try {
    const { schoolId, centerId } = resolveCtx(req);
    const bypassCenter = ["developer", "super_admin", "admin"].includes(req.user?.role);
    const { studentId, date, from, to, type, limit } = req.query;

    const records = await svc.getCareHistory({
      studentId, date, from, to, type, limit,
      schoolId,
      centerId: bypassCenter ? undefined : centerId,
    });

    res.json({ success: true, count: records.length, records });
  } catch (e) {
    logErr("GET /api/care/history", e);
    res.status(500).json({ success: false, error: e.message });
  }
}

// GET /api/care/summary?date=
async function getDailySummary(req, res) {
  try {
    const { schoolId, centerId } = resolveCtx(req);
    const bypassCenter = ["developer", "super_admin", "admin"].includes(req.user?.role);
    const { date } = req.query;

    const summary = await svc.getDailySummary({
      date,
      schoolId,
      centerId: bypassCenter ? undefined : centerId,
    });

    res.json({ success: true, summary });
  } catch (e) {
    logErr("GET /api/care/summary", e);
    res.status(500).json({ success: false, error: e.message });
  }
}

module.exports = { logCare, getCareHistory, getDailySummary };
