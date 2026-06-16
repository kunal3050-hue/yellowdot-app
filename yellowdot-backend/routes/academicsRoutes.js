/**
 * academicsRoutes.js — Academics module REST endpoints
 * GET /api/academics/classes  — list active classes (staff-scoped)
 */

const express = require("express");
const router  = express.Router();
const { authenticate, blockUnknown } = require("../middleware/authMiddleware");
const svc = require("../services/academicsService");

const SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";

router.get("/api/academics/classes", authenticate, blockUnknown, async (req, res) => {
  try {
    const schoolId = req.user?.schoolId || SCHOOL_ID;
    const classes  = await svc.getActiveClasses({ schoolId });
    res.json({ success: true, classes });
  } catch (e) {
    console.error("[GET /api/academics/classes]", e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
