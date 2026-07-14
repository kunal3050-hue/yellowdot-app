/**
 * staffAttendanceController.js — HTTP handlers for Staff Attendance
 */

const svc       = require("../services/staffAttendanceService");
const shiftSvc  = require("../services/staffShiftService");
const staffSvc  = require("../services/staffService");
const { checkTenantAccess } = require("../middleware/tenantRecordAccess");

function _ctx(req) {
  return {
    schoolId:    req.user?.schoolId || process.env.SCHOOL_ID || "yd-main",
    tenantId:    req.user?.schoolId || process.env.SCHOOL_ID || "yd-main",
    centerId:    req.query?.centerId || req.user?.centerId || "",
    actorUserId: req.user?.userId   || "system",
  };
}

function _err(res, route, err) {
  let code = 500;
  if (err.code === "VALIDATION") code = 400;
  if (err.code === "DUPLICATE")  code = 409;
  if (err.code === "IN_USE")     code = 409;
  console.error(`[${route}]`, err.message);
  res.status(code).json({ success: false, error: err.message || "Server error." });
}

// ── Attendance ────────────────────────────────────────────────────

async function list(req, res) {
  try {
    const { schoolId } = _ctx(req);
    const { centerId, staffId, date, fromDate, toDate, status, includeDeleted } = req.query;
    const rows = await svc.getAll({ schoolId, centerId, staffId, date, fromDate, toDate, status, includeDeleted });
    res.json({ success: true, rows, total: rows.length });
  } catch (err) { _err(res, "GET /api/staff-attendance", err); }
}

async function today(req, res) {
  try {
    const { schoolId, centerId } = _ctx(req);
    const snap = await svc.todaySnapshot({ schoolId, centerId });
    res.json({ success: true, ...snap });
  } catch (err) { _err(res, "GET /api/staff-attendance/today", err); }
}

async function dashboard(req, res) {
  try {
    const { schoolId, centerId } = _ctx(req);
    const data = await svc.dashboard({ schoolId, centerId });
    res.json({ success: true, ...data });
  } catch (err) { _err(res, "GET /api/staff-attendance/dashboard", err); }
}

async function staffMonth(req, res) {
  try {
    const { schoolId } = _ctx(req);
    const { staffId } = req.params;
    const staff = await staffSvc.getOne(staffId);
    if (!staff || !checkTenantAccess(req, staff).allowed) {
      return res.status(404).json({ success: false, error: "Staff member not found." });
    }
    const year  = Number(req.query.year)  || new Date().getFullYear();
    const month = Number(req.query.month) || (new Date().getMonth() + 1);
    const rows = await svc.getForStaffMonth({ schoolId, staffId, year, month });
    res.json({ success: true, year, month, rows });
  } catch (err) { _err(res, "GET /api/staff-attendance/staff/:staffId/month", err); }
}

async function checkIn(req, res) {
  try {
    const ctx = _ctx(req);
    const { staffId, date, source, location, checkInISO } = req.body || {};
    if (!staffId) return res.status(400).json({ success: false, error: "staffId is required." });
    const row = await svc.checkIn({ ...ctx, staffId, date, source, location, checkInISO });
    res.json({ success: true, attendance: row });
  } catch (err) { _err(res, "POST /api/staff-attendance/check-in", err); }
}

async function checkOut(req, res) {
  try {
    const ctx = _ctx(req);
    const { staffId, date, source, checkOutISO } = req.body || {};
    if (!staffId) return res.status(400).json({ success: false, error: "staffId is required." });
    const row = await svc.checkOut({ ...ctx, staffId, date, source, checkOutISO });
    res.json({ success: true, attendance: row });
  } catch (err) { _err(res, "POST /api/staff-attendance/check-out", err); }
}

async function markStatus(req, res) {
  try {
    const ctx = _ctx(req);
    const { staffId, date, status, notes } = req.body || {};
    if (!staffId || !status) return res.status(400).json({ success: false, error: "staffId + status required." });
    const row = await svc.markStatus({ ...ctx, staffId, date, status, notes });
    res.json({ success: true, attendance: row });
  } catch (err) { _err(res, "POST /api/staff-attendance/mark", err); }
}

async function selfCheckIn(req, res) {
  // Logged-in user checks themselves in via /me
  try {
    const ctx = _ctx(req);
    const staff = await staffSvc.getByLinkedUserId(ctx.actorUserId, ctx.schoolId);
    if (!staff) return res.status(404).json({ success: false, error: "No staff record linked to your login account." });
    const row = await svc.checkIn({ ...ctx, staffId: staff.staffId, source: "self", location: req.body?.location || "" });
    res.json({ success: true, attendance: row });
  } catch (err) { _err(res, "POST /api/staff-attendance/self/check-in", err); }
}

async function selfCheckOut(req, res) {
  try {
    const ctx = _ctx(req);
    const staff = await staffSvc.getByLinkedUserId(ctx.actorUserId, ctx.schoolId);
    if (!staff) return res.status(404).json({ success: false, error: "No staff record linked to your login account." });
    const row = await svc.checkOut({ ...ctx, staffId: staff.staffId, source: "self" });
    res.json({ success: true, attendance: row });
  } catch (err) { _err(res, "POST /api/staff-attendance/self/check-out", err); }
}

async function qrCheckIn(req, res) {
  // QR payload format: { qrToken, staffId } — the QR encodes the staff's staffId and a rotating token
  try {
    const ctx = _ctx(req);
    const { staffId, location } = req.body || {};
    if (!staffId) return res.status(400).json({ success: false, error: "staffId is required (decoded from QR)." });
    // Idempotent: if the staff already has a checkIn today, treat as checkOut.
    const todayRows = await svc.getAll({ schoolId: ctx.schoolId, staffId, date: new Date().toISOString().slice(0,10) });
    const today = todayRows[0];
    let row;
    if (today && today.checkIn && !today.checkOut) {
      row = await svc.checkOut({ ...ctx, staffId, source: "qr" });
    } else {
      row = await svc.checkIn({ ...ctx, staffId, source: "qr", location });
    }
    res.json({ success: true, attendance: row });
  } catch (err) { _err(res, "POST /api/staff-attendance/qr", err); }
}

async function updateRecord(req, res) {
  try {
    const existing = await svc.getOne(req.params.attendanceId);
    if (!existing || !checkTenantAccess(req, existing).allowed) {
      return res.status(404).json({ success: false, error: "Attendance record not found." });
    }
    const { actorUserId } = _ctx(req);
    const row = await svc.update(req.params.attendanceId, req.body, { actorUserId });
    if (!row) return res.status(404).json({ success: false, error: "Attendance record not found." });
    res.json({ success: true, attendance: row });
  } catch (err) { _err(res, "PUT /api/staff-attendance/:id", err); }
}

async function removeRecord(req, res) {
  try {
    const existing = await svc.getOne(req.params.attendanceId);
    if (!existing || !checkTenantAccess(req, existing).allowed) {
      return res.status(404).json({ success: false, error: "Attendance record not found." });
    }
    const { actorUserId } = _ctx(req);
    const ok = await svc.remove(req.params.attendanceId, { actorUserId });
    if (!ok) return res.status(404).json({ success: false, error: "Attendance record not found." });
    res.json({ success: true });
  } catch (err) { _err(res, "DELETE /api/staff-attendance/:id", err); }
}

async function dailyReport(req, res) {
  try {
    const { schoolId, centerId } = _ctx(req);
    const data = await svc.dailyReport({ schoolId, centerId, date: req.query.date });
    res.json({ success: true, ...data });
  } catch (err) { _err(res, "GET /api/staff-attendance/reports/daily", err); }
}

async function monthlyReport(req, res) {
  try {
    const { schoolId, centerId } = _ctx(req);
    const year  = Number(req.query.year)  || new Date().getFullYear();
    const month = Number(req.query.month) || (new Date().getMonth() + 1);
    const data = await svc.monthlyReport({ schoolId, centerId, year, month });
    res.json({ success: true, ...data });
  } catch (err) { _err(res, "GET /api/staff-attendance/reports/monthly", err); }
}

// ── Shifts ───────────────────────────────────────────────────────

async function listShifts(req, res) {
  try {
    const { schoolId, tenantId } = _ctx(req);
    const shifts = await shiftSvc.getAll({ schoolId, tenantId, active: req.query.active });
    res.json({ success: true, shifts });
  } catch (err) { _err(res, "GET /api/staff-shifts", err); }
}

async function createShift(req, res) {
  try {
    const { schoolId, tenantId, actorUserId } = _ctx(req);
    const shift = await shiftSvc.create(req.body, { schoolId, tenantId, actorUserId });
    res.status(201).json({ success: true, shift });
  } catch (err) { _err(res, "POST /api/staff-shifts", err); }
}

async function updateShift(req, res) {
  try {
    const existing = await shiftSvc.getOne(req.params.shiftId);
    if (!existing || !checkTenantAccess(req, existing).allowed) {
      return res.status(404).json({ success: false, error: "Shift not found." });
    }
    const { actorUserId } = _ctx(req);
    const shift = await shiftSvc.update(req.params.shiftId, req.body, { actorUserId });
    if (!shift) return res.status(404).json({ success: false, error: "Shift not found." });
    res.json({ success: true, shift });
  } catch (err) { _err(res, "PUT /api/staff-shifts/:shiftId", err); }
}

async function removeShift(req, res) {
  try {
    const existing = await shiftSvc.getOne(req.params.shiftId);
    if (!existing || !checkTenantAccess(req, existing).allowed) {
      return res.status(404).json({ success: false, error: "Shift not found." });
    }
    const ok = await shiftSvc.remove(req.params.shiftId);
    if (!ok) return res.status(404).json({ success: false, error: "Shift not found." });
    res.json({ success: true });
  } catch (err) { _err(res, "DELETE /api/staff-shifts/:shiftId", err); }
}

module.exports = {
  list, today, dashboard, staffMonth,
  checkIn, checkOut, markStatus, selfCheckIn, selfCheckOut, qrCheckIn,
  updateRecord, removeRecord,
  dailyReport, monthlyReport,
  listShifts, createShift, updateShift, removeShift,
};
