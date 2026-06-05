const express      = require("express");
const router       = express.Router();
const { authenticate, staffOnly } = require("../middleware/authMiddleware");
const {
  getAttendance,
  markAttendance,
  checkOut,
  getSummary,
  getInsideNow,
  getHistory,
  processQRScan,
  generateStudentQR,
  generateBatchQR,
} = require("../controllers/attendanceController");

// All attendance endpoints require a registered staff account.
// Parents use /api/parent-attendance instead.
// Path-scoped to this router's prefixes so it does not intercept other routers'
// paths (mounted at the app root via app.use()).
router.use(["/api/attendance", "/api/qr"], authenticate, staffOnly);

// ── Attendance records ──────────────────────────────────────────
router.get ("/api/attendance",               getAttendance);   // ?date=&class=
router.post("/api/attendance/mark",          markAttendance);
router.put ("/api/attendance/:id/checkout",  checkOut);

// ── Stats / live views ──────────────────────────────────────────
router.get ("/api/attendance/summary",       getSummary);   // ?date=&class=
router.get ("/api/attendance/inside",        getInsideNow); // ?date=&class=
router.get ("/api/attendance/history",       getHistory);   // ?from=&to=&class=&studentId=

// ── QR scanning ─────────────────────────────────────────────────
router.post("/api/attendance/qr-scan",       processQRScan);

// ── QR code generation ──────────────────────────────────────────
router.get ("/api/qr/batch",                 generateBatchQR);  // ?class=   ← must come before /:studentId
router.get ("/api/qr/:studentId",            generateStudentQR);

module.exports = router;
