/**
 * napController.js — Firestore-backed
 *
 * GET  /naps/active       — students currently sleeping
 * GET  /naps/history      — nap log (date / studentId filters)
 * GET  /naps/stats/today  — summary stats for a date
 * POST /naps/start        — start a new nap
 * POST /naps/wakeup       — end a nap
 */

const svc = require("../services/napService");

const DEFAULT_SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";

function resolveCtx(req) {
  return {
    schoolId:    req.user?.schoolId  || DEFAULT_SCHOOL_ID,
    centerId:    req.user?.centerId  || "",
    actorUserId: req.user?.userId    || "system",
  };
}

function logErr(route, e) { console.error(`[${route}]`, e.message); }

// GET /naps/active?date=
async function getActiveNaps(req, res) {
  try {
    const { schoolId, centerId } = resolveCtx(req);
    const bypassCenter = ["developer", "super_admin", "admin"].includes(req.user?.role);
    const naps = await svc.getActiveNaps(
      req.query.date || null,
      { schoolId, centerId: bypassCenter ? undefined : centerId }
    );
    res.json(naps);
  } catch (e) {
    logErr("GET /naps/active", e);
    res.status(500).json({ error: "Failed to fetch active naps.", details: e.message });
  }
}

// GET /naps/history?date=&studentId=&limit=
async function getNapHistory(req, res) {
  try {
    const { schoolId, centerId } = resolveCtx(req);
    const bypassCenter = ["developer", "super_admin", "admin"].includes(req.user?.role);
    const { date, studentId, limit } = req.query;
    const naps = await svc.getNapHistory({
      date, studentId, limit,
      schoolId,
      centerId: bypassCenter ? undefined : centerId,
    });
    res.json(naps);
  } catch (e) {
    logErr("GET /naps/history", e);
    res.status(500).json({ error: "Failed to fetch nap history.", details: e.message });
  }
}

// GET /naps/stats/today?date=
async function getTodayStats(req, res) {
  try {
    const { schoolId, centerId } = resolveCtx(req);
    const bypassCenter = ["developer", "super_admin", "admin"].includes(req.user?.role);
    const stats = await svc.getTodayStats(
      req.query.date || null,
      { schoolId, centerId: bypassCenter ? undefined : centerId }
    );
    res.json({
      currentlySleeping:  stats.active,
      totalNapsToday:     stats.totalNaps,
      avgDurationMinutes: stats.avgMinutes,
      completedNaps:      stats.completed,
      totalMinutes:       stats.totalMinutes,
    });
  } catch (e) {
    logErr("GET /naps/stats/today", e);
    res.status(500).json({ error: "Failed to fetch stats.", details: e.message });
  }
}

// POST /naps/start  { studentId, studentName, class, center, date? }
async function startNap(req, res) {
  try {
    const { schoolId, centerId, actorUserId } = resolveCtx(req);
    const {
      student_id, studentId,
      student_name, studentName,
      class: studentClass,
      center, date,
    } = req.body || {};

    const sid  = studentId  || student_id;
    const name = studentName || student_name;

    if (!sid || !name || !studentClass) {
      return res.status(400).json({
        success: false,
        message: "studentId, studentName and class are required.",
      });
    }

    const nap = await svc.startNap({
      studentId:   sid,
      studentName: name,
      class:       studentClass,
      center:      center || centerId || "",
      centerId:    centerId || center || "",
      date,
      schoolId,
      actorUserId,
    });

    res.json({
      success:    true,
      message:    `${name}'s nap started.`,
      nap_id:     nap.napId,
      napId:      nap.napId,
      start_time: nap.startTime,
      nap,
    });
  } catch (e) {
    logErr("POST /naps/start", e);
    res.status(500).json({ success: false, error: e.message });
  }
}

// POST /naps/wakeup  { nap_id | napId }
async function wakeUp(req, res) {
  try {
    const { actorUserId } = resolveCtx(req);
    const napId = req.body?.napId || req.body?.nap_id;
    const mood  = req.body?.mood  || "";
    const notes = req.body?.notes || "";
    if (!napId) return res.status(400).json({ success: false, message: "napId is required." });

    const nap = await svc.wakeUp(napId, { updatedBy: actorUserId, mood, notes });
    if (!nap) return res.status(404).json({ success: false, message: "Nap not found." });

    res.json({
      success:          true,
      message:          "Nap completed.",
      end_time:         nap.endTime,
      duration_minutes: nap.duration,
      nap,
    });
  } catch (e) {
    logErr("POST /naps/wakeup", e);
    res.status(500).json({ success: false, error: e.message });
  }
}

module.exports = { getActiveNaps, getNapHistory, getTodayStats, startNap, wakeUp };
