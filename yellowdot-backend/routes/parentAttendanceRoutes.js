const express          = require("express");
const router           = express.Router();
const { authenticate } = require("../middleware/authMiddleware");
const {
  validateGate,
  getParentAttendance,
  createParentAttendance,
} = require("../controllers/parentAttendanceController");

router.use(authenticate);

// Validate gate QR before starting workflow
router.get ("/api/parent-attendance/validate-gate", validateGate);

// Core CRUD
router.get ("/api/parent-attendance", getParentAttendance);   // ?date=&studentId=&gate=
router.post("/api/parent-attendance", createParentAttendance);

module.exports = router;
