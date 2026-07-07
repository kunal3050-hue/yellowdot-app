/**
 * staffAttendanceRoutes.js — Staff Attendance + Shifts REST API
 *
 * Self endpoints (any staff with a linked login account):
 *   POST /api/staff-attendance/self/check-in
 *   POST /api/staff-attendance/self/check-out
 *
 * Managed endpoints (admin / center-owner / center-admin / reception):
 *   GET    /api/staff-attendance               list (?staffId&date&fromDate&toDate&status&centerId)
 *   GET    /api/staff-attendance/today         today snapshot grid
 *   GET    /api/staff-attendance/dashboard     KPIs for dashboard cards
 *   GET    /api/staff-attendance/staff/:id/month?year&month
 *   POST   /api/staff-attendance/check-in      manual check-in (any staff)
 *   POST   /api/staff-attendance/check-out
 *   POST   /api/staff-attendance/mark          set status (absent/leave/etc.)
 *   POST   /api/staff-attendance/qr            QR-driven toggle
 *   PUT    /api/staff-attendance/:attendanceId
 *   DELETE /api/staff-attendance/:attendanceId (soft delete)
 *   GET    /api/staff-attendance/reports/daily?date
 *   GET    /api/staff-attendance/reports/monthly?year&month
 *
 * Shifts (admin / center-owner / center-admin):
 *   GET    /api/staff-shifts
 *   POST   /api/staff-shifts
 *   PUT    /api/staff-shifts/:shiftId
 *   DELETE /api/staff-shifts/:shiftId
 */

const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/staffAttendanceController");
const { authenticate, authorizeRoute, staffOnly } = require("../middleware/authMiddleware");

const MANAGE = "staff-attendance-manage";
const VIEW   = "staff-attendance";
const SHIFTS = "staff-shifts";

const canManage = [authenticate, staffOnly, authorizeRoute(MANAGE)];
const canView   = [authenticate, staffOnly, authorizeRoute(VIEW)];
const canShifts = [authenticate, staffOnly, authorizeRoute(SHIFTS)];

// Order: literal paths before :param routes
router.get ("/api/staff-attendance/today",     ...canView,   ctrl.today);
router.get ("/api/staff-attendance/dashboard", ...canView,   ctrl.dashboard);
router.get ("/api/staff-attendance/reports/daily",   ...canView, ctrl.dailyReport);
router.get ("/api/staff-attendance/reports/monthly", ...canView, ctrl.monthlyReport);

router.get ("/api/staff-attendance/staff/:staffId/month", ...canView, ctrl.staffMonth);

router.post("/api/staff-attendance/self/check-in",  authenticate, staffOnly, ctrl.selfCheckIn);
router.post("/api/staff-attendance/self/check-out", authenticate, staffOnly, ctrl.selfCheckOut);
router.post("/api/staff-attendance/qr",             ...canManage, ctrl.qrCheckIn);

router.get ("/api/staff-attendance",                ...canView,   ctrl.list);
router.post("/api/staff-attendance/check-in",       ...canManage, ctrl.checkIn);
router.post("/api/staff-attendance/check-out",      ...canManage, ctrl.checkOut);
router.post("/api/staff-attendance/mark",           ...canManage, ctrl.markStatus);

router.put ("/api/staff-attendance/:attendanceId",    ...canManage, ctrl.updateRecord);
router.delete("/api/staff-attendance/:attendanceId",  ...canManage, ctrl.removeRecord);

// Shifts
router.get   ("/api/staff-shifts",            ...canShifts, ctrl.listShifts);
router.post  ("/api/staff-shifts",            ...canShifts, ctrl.createShift);
router.put   ("/api/staff-shifts/:shiftId",   ...canShifts, ctrl.updateShift);
router.delete("/api/staff-shifts/:shiftId",   ...canShifts, ctrl.removeShift);

module.exports = router;
