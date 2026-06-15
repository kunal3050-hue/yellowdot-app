/**
 * attendanceController.js — Firestore-backed
 *
 * GET  /api/attendance               — list records (date, class filters)
 * POST /api/attendance/mark          — upsert attendance
 * PUT  /api/attendance/:id/checkout  — update check-out time
 * GET  /api/attendance/summary       — live stats for a date
 * GET  /api/attendance/inside        — students currently inside school
 * GET  /api/attendance/history       — historical records (date range filter)
 * POST /api/attendance/qr-scan       — process QR code scan
 * GET  /api/qr/:studentId            — generate QR code PNG data URL
 * GET  /api/qr/batch                 — generate QR codes for all active students
 */

const svc        = require("../services/attendanceService");
const studentSvc = require("../services/studentService");
const QRCode     = require("qrcode");
const notif      = require("../services/notificationService");

const DEFAULT_SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";

function resolveCtx(req) {
  return {
    schoolId:    req.user?.schoolId  || DEFAULT_SCHOOL_ID,
    centerId:    req.user?.centerId  || "",
    actorUserId: req.user?.userId    || "system",
  };
}

// ── QR payload format ─────────────────────────────────────────────────
const QR_PREFIX = "YD-";
function makeQRPayload(studentId) { return `${QR_PREFIX}${studentId}`; }
function parseQRPayload(text) {
  if (!text || !text.startsWith(QR_PREFIX)) return null;
  return text.slice(QR_PREFIX.length);
}

function logErr(route, e) { console.error(`[${route}]`, e.message); }

// ════════════════════════════════════════════════════════════════════
// GET /api/attendance?date=&class=
// ════════════════════════════════════════════════════════════════════
async function getAttendance(req, res) {
  try {
    const { schoolId, centerId } = resolveCtx(req);
    const bypassCenter = ["developer", "super_admin", "admin"].includes(req.user?.role);
    const { date, class: cls } = req.query;
    const targetDate = date || new Date().toISOString().slice(0, 10);
    const result = await svc.getAttendance({
      date: targetDate,
      class: cls || undefined,
      schoolId,
      centerId: bypassCenter ? undefined : centerId,
    });
    // getAttendance returns { entries } or an array — normalise
    const entries = Array.isArray(result) ? result : (result.entries || []);
    res.json({ success: true, date: targetDate, entries });
  } catch (e) {
    logErr("GET /api/attendance", e);
    res.status(500).json({ success: false, error: e.message });
  }
}

// ════════════════════════════════════════════════════════════════════
// POST /api/attendance/mark
// ════════════════════════════════════════════════════════════════════
async function markAttendance(req, res) {
  try {
    const { schoolId, centerId, actorUserId } = resolveCtx(req);
    const {
      studentId, studentName, class: studentClass,
      batchId, batchCode, teacherId,
      status, date, checkIn, checkOut, attendanceMethod, center, markedBy,
    } = req.body || {};

    if (!studentId) return res.status(400).json({ success: false, error: "studentId is required." });
    if (!status)    return res.status(400).json({ success: false, error: "status is required." });
    if (!["Present", "Absent", "Late"].includes(status)) {
      return res.status(400).json({ success: false, error: "status must be Present, Absent, or Late." });
    }

    const entry = await svc.markAttendance({
      studentId, studentName, class: studentClass,
      batchId, batchCode, teacherId,
      status, date, method: attendanceMethod,
      center:   center   || centerId || "",
      centerId: centerId || center   || "",
      markedBy: markedBy || actorUserId,
      schoolId,
    });

    notif.notifyAsync(() => notif.fireForStudent(studentId, schoolId, {
      type:     notif.TYPES.ATTENDANCE_MARKED,
      childId:  studentId,
      title:    status === "Present" ? `${studentName || studentId} is at school` : `Attendance update for ${studentName || studentId}`,
      message:  status === "Present"
        ? `${studentName || studentId} was marked Present at Yellow Dot Preschool.`
        : `${studentName || studentId} was marked ${status} today.`,
      deepLink: "/parent-attendance",
    }));

    res.json({ success: true, message: "Attendance saved.", entry });
  } catch (e) {
    logErr("POST /api/attendance/mark", e);
    res.status(500).json({ success: false, error: e.message });
  }
}

// ════════════════════════════════════════════════════════════════════
// PUT /api/attendance/:id/checkout
// ════════════════════════════════════════════════════════════════════
async function checkOut(req, res) {
  try {
    const entry = await svc.checkOut(req.params.id);
    if (!entry) return res.status(404).json({ success: false, error: "Entry not found." });

    const { schoolId: eSchool } = resolveCtx(req);
    notif.notifyAsync(() => notif.fireForStudent(entry.studentId, entry.schoolId || eSchool, {
      type:     notif.TYPES.CHILD_CHECKED_OUT,
      childId:  entry.studentId,
      title:    `${entry.studentName || entry.studentId} checked out`,
      message:  `${entry.studentName || entry.studentId} has checked out at ${entry.checkOut}.`,
      deepLink: "/parent-attendance",
    }));

    res.json({ success: true, message: "Check-out recorded.", entry });
  } catch (e) {
    logErr("PUT /api/attendance/:id/checkout", e);
    res.status(500).json({ success: false, error: e.message });
  }
}

// ════════════════════════════════════════════════════════════════════
// GET /api/attendance/summary?date=&class=
// ════════════════════════════════════════════════════════════════════
async function getSummary(req, res) {
  try {
    const { schoolId, centerId } = resolveCtx(req);
    const bypassCenter = ["developer", "super_admin", "admin"].includes(req.user?.role);
    const { date, class: cls } = req.query;
    const targetDate   = date || new Date().toISOString().slice(0, 10);
    const resolvedCId  = bypassCenter ? undefined : centerId;

    const summary = await svc.getAttendanceSummary(targetDate, { schoolId, centerId: resolvedCId });

    // If class filter requested, re-compute from raw records
    if (cls && cls !== "All") {
      const result  = await svc.getAttendance({ date: targetDate, class: cls, schoolId, centerId: resolvedCId });
      const entries = Array.isArray(result) ? result : (result.entries || []);
      const filtered = {
        date:      targetDate,
        total:     entries.length,
        present:   entries.filter(r => r.status === "Present").length,
        absent:    entries.filter(r => r.status === "Absent").length,
        late:      entries.filter(r => r.status === "Late").length,
        inside:    entries.filter(r => r.checkIn && !r.checkOut && r.status !== "Absent").length,
        qrScanned: entries.filter(r => r.method === "QR").length,
      };
      return res.json({ success: true, date: targetDate, summary: filtered });
    }

    res.json({ success: true, date: targetDate, summary: { ...summary, inside: 0, qrScanned: 0 } });
  } catch (e) {
    logErr("GET /api/attendance/summary", e);
    res.status(500).json({ success: false, error: e.message });
  }
}

// ════════════════════════════════════════════════════════════════════
// GET /api/attendance/inside?date=&class=
// ════════════════════════════════════════════════════════════════════
async function getInsideNow(req, res) {
  try {
    const { schoolId, centerId } = resolveCtx(req);
    const bypassCenter = ["developer", "super_admin", "admin"].includes(req.user?.role);
    const { date, class: cls } = req.query;
    const targetDate = date || new Date().toISOString().slice(0, 10);
    let inside = await svc.getStudentsInside(targetDate, {
      schoolId,
      centerId: bypassCenter ? undefined : centerId,
    });
    if (cls && cls !== "All") inside = inside.filter(e => e.class === cls);
    res.json({ success: true, date: targetDate, count: inside.length, students: inside });
  } catch (e) {
    logErr("GET /api/attendance/inside", e);
    res.status(500).json({ success: false, error: e.message });
  }
}

// ════════════════════════════════════════════════════════════════════
// GET /api/attendance/history?from=&to=&class=&studentId=
// ════════════════════════════════════════════════════════════════════
async function getHistory(req, res) {
  try {
    const { schoolId, centerId } = resolveCtx(req);
    const bypassCenter = ["developer", "super_admin", "admin"].includes(req.user?.role);
    const { from, to, class: cls, studentId } = req.query;
    let entries = await svc.getAttendanceHistory({
      from, to, studentId,
      schoolId,
      centerId: bypassCenter ? undefined : centerId,
    });
    if (cls && cls !== "All") entries = entries.filter(e => e.class === cls);
    res.json({ success: true, count: entries.length, entries });
  } catch (e) {
    logErr("GET /api/attendance/history", e);
    res.status(500).json({ success: false, error: e.message });
  }
}

// ════════════════════════════════════════════════════════════════════
// POST /api/attendance/qr-scan
// ════════════════════════════════════════════════════════════════════
async function processQRScan(req, res) {
  try {
    const { schoolId, centerId, actorUserId } = resolveCtx(req);
    const { qrData } = req.body || {};
    if (!qrData) return res.status(400).json({ success: false, error: "qrData is required." });

    const studentId = parseQRPayload(qrData.trim());
    if (!studentId) {
      return res.status(400).json({
        success: false,
        error: "Invalid QR code. Not a Yellow Dot attendance code.",
      });
    }

    // Look up student from Firestore
    const student = await studentSvc.getOne(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        error: `Student '${studentId}' not found in the system.`,
      });
    }

    const result = await svc.processQRScan({
      studentId:   student.studentId,
      studentName: student.studentName,
      class:       student.class,
      center:      student.center || centerId || "",
      centerId:    student.centerId || centerId || "",
      schoolId:    student.schoolId || schoolId,
      markedBy:    actorUserId,
    });

    const actionMsg = {
      checkin:     `✅ ${student.studentName} checked IN at ${result.record.checkIn}`,
      checkout:    `👋 ${student.studentName} checked OUT at ${result.record.checkOut}`,
      already_out: `ℹ️  ${student.studentName} already checked in and out today.`,
    }[result.action] || "Action recorded.";

    if (result.action === "checkin") {
      notif.notifyAsync(() => notif.fireForStudent(student.studentId, student.schoolId || schoolId, {
        type:     notif.TYPES.CHILD_CHECKED_IN,
        childId:  student.studentId,
        title:    `${student.studentName} arrived at school`,
        message:  `${student.studentName} has checked in at Yellow Dot Preschool at ${result.record.checkIn}.`,
        deepLink: "/parent-attendance",
      }));
    } else if (result.action === "checkout") {
      notif.notifyAsync(() => notif.fireForStudent(student.studentId, student.schoolId || schoolId, {
        type:     notif.TYPES.CHILD_CHECKED_OUT,
        childId:  student.studentId,
        title:    `${student.studentName} checked out`,
        message:  `${student.studentName} has checked out at ${result.record.checkOut}.`,
        deepLink: "/parent-attendance",
      }));
    }

    res.json({
      success: true,
      action:  result.action,
      message: actionMsg,
      student: { id: student.studentId, name: student.studentName, class: student.class },
      entry:   result.record,
    });
  } catch (e) {
    logErr("POST /api/attendance/qr-scan", e);
    res.status(500).json({ success: false, error: e.message });
  }
}

// ════════════════════════════════════════════════════════════════════
// GET /api/qr/:studentId — generate QR code for one student
// ════════════════════════════════════════════════════════════════════
async function generateStudentQR(req, res) {
  try {
    const { studentId } = req.params;
    const student = await studentSvc.getOne(studentId);
    if (!student) return res.status(404).json({ success: false, error: "Student not found." });

    const payload    = makeQRPayload(studentId);
    const qrDataUrl  = await QRCode.toDataURL(payload, {
      width: 300, margin: 2,
      color: { dark: "#04114B", light: "#FFFFFF" },
      errorCorrectionLevel: "M",
    });

    res.json({
      success:     true,
      studentId:   student.studentId,
      studentName: student.studentName,
      class:       student.class,
      qrPayload:   payload,
      qrDataUrl,
    });
  } catch (e) {
    logErr("GET /api/qr/:studentId", e);
    res.status(500).json({ success: false, error: e.message });
  }
}

// ════════════════════════════════════════════════════════════════════
// GET /api/qr/batch?class= — generate QR codes for all active students
// ════════════════════════════════════════════════════════════════════
async function generateBatchQR(req, res) {
  try {
    const { schoolId, centerId } = resolveCtx(req);
    const bypassCenter = ["developer", "super_admin", "admin"].includes(req.user?.role);
    const { class: cls } = req.query;

    let students = await studentSvc.getAll({
      schoolId,
      centerId: bypassCenter ? undefined : centerId,
    });

    students = students.filter(s => (s.status || s.Status) === "Active");
    if (cls && cls !== "All") students = students.filter(s => (s.class || s.Class) === cls);

    const results = await Promise.all(
      students.map(async s => {
        const payload   = makeQRPayload(s.studentId || s.Student_ID);
        const qrDataUrl = await QRCode.toDataURL(payload, {
          width: 200, margin: 1,
          color: { dark: "#04114B", light: "#FFFFFF" },
          errorCorrectionLevel: "M",
        });
        return {
          id:    s.studentId || s.Student_ID,
          name:  s.studentName || s.Student_Name,
          class: s.class || s.Class,
          qrPayload: payload,
          qrDataUrl,
        };
      })
    );

    res.json({ success: true, count: results.length, students: results });
  } catch (e) {
    logErr("GET /api/qr/batch", e);
    res.status(500).json({ success: false, error: e.message });
  }
}

module.exports = {
  getAttendance,
  markAttendance,
  checkOut,
  getSummary,
  getInsideNow,
  getHistory,
  processQRScan,
  generateStudentQR,
  generateBatchQR,
};
