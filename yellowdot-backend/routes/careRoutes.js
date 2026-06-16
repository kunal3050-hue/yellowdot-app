/**
 * careRoutes.js — Care & Hygiene API
 *
 * POST /api/care          — log a care event (staff only)
 * GET  /api/care/history  — child-wise / classroom history (staff only)
 * GET  /api/care/summary  — daily summary (staff only)
 */

const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/careController");
const { authenticate, staffOnly } = require("../middleware/authMiddleware");

// All care staff routes require auth + staff role
router.use("/api/care", authenticate, staffOnly);

router.post("/api/care",         ctrl.logCare);
router.get( "/api/care/history", ctrl.getCareHistory);
router.get( "/api/care/summary", ctrl.getDailySummary);

module.exports = router;
