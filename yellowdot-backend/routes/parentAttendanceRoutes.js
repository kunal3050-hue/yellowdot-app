const express          = require("express");
const router           = express.Router();
const { authenticate } = require("../middleware/authMiddleware");
const {
  validateGate,
  getParentAttendance,
  createParentAttendance,
} = require("../controllers/parentAttendanceController");

// Path-scoped: this router is mounted at app root via app.use(router), so a
// path-less router.use() would run for EVERY request (incl. /api/parent/*),
// causing redundant token verification. Scope to this router's own prefix.
router.use("/api/parent-attendance", authenticate);

// Validate gate QR before starting workflow
router.get ("/api/parent-attendance/validate-gate", validateGate);

// Core CRUD
router.get ("/api/parent-attendance", getParentAttendance);   // ?date=&studentId=&gate=
router.post("/api/parent-attendance", createParentAttendance);

module.exports = router;
