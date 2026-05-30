const express = require("express");
const router  = express.Router();
const { authenticate, blockUnknown, staffOnly } = require("../middleware/authMiddleware");
const {
  getChildStatus,
  getCctvAccess,
  createPickupRequest,
  getPickupRequests,
  approvePickupRequest,
  rejectPickupRequest,
} = require("../controllers/securityController");

// All security routes require a real (non-unknown) account
router.use(authenticate, blockUnknown);

// Child status — parents always get their linked child; staff pass :studentId
router.get("/api/child-status/:studentId", getChildStatus);

// CCTV access check — parents only (returns cameras iff child is PRESENT)
router.get("/api/cctv-access", getCctvAccess);

// Pickup requests — staff creates; anyone (parent or staff) can read/approve/reject
router.post("/api/pickup-request",              staffOnly,           createPickupRequest);
router.get ("/api/pickup-requests",                                  getPickupRequests);
router.put ("/api/pickup-requests/:id/approve",                      approvePickupRequest);
router.put ("/api/pickup-requests/:id/reject",                       rejectPickupRequest);

module.exports = router;
