const express = require("express");
const router  = express.Router();
const { authenticate, blockUnknown, staffOnly } = require("../middleware/authMiddleware");
const {
  getChildStatus,
  createPickupRequest,
  getPickupRequests,
  approvePickupRequest,
  rejectPickupRequest,
} = require("../controllers/securityController");

// All security routes require a real (non-unknown) account.
// Path-scoped to this router's own prefixes (mounted at app root via app.use())
// so the guard does not run for unrelated paths like /api/parent/*.
router.use(["/api/pickup-request", "/api/pickup-requests"], authenticate, blockUnknown);

// Child status — parents always get their linked child; staff pass :studentId
router.get("/api/child-status/:studentId", getChildStatus);

// Pickup requests — staff creates; anyone (parent or staff) can read/approve/reject
router.post("/api/pickup-request",              staffOnly,           createPickupRequest);
router.get ("/api/pickup-requests",                                  getPickupRequests);
router.put ("/api/pickup-requests/:id/approve",                      approvePickupRequest);
router.put ("/api/pickup-requests/:id/reject",                       rejectPickupRequest);

module.exports = router;
