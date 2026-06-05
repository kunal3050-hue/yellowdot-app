/**
 * parentDailyRoutes.js — Parent Timeline MVP (read-only daily data)
 * ─────────────────────────────────────────────────────────────────────────────
 * Powers the ParentDashboard "Today's story" timeline with the parent's OWN
 * child's naps and meals. Attendance comes from the existing
 * /api/parent-attendance endpoint (already parent-readable) and is NOT
 * duplicated here.
 *
 * Security:
 *   • requireOwnChild — blocks non-parents (403 STAFF_ACCESS_DENIED), requires a
 *     linked child, rejects any cross-child studentId (403 CHILD_SCOPE_VIOLATION),
 *     and sets req.ownChildId.
 *   • Scoping is by studentId (the security boundary) + schoolId. centerId is
 *     intentionally omitted so a center value mismatch can never hide the child's
 *     own records — studentId already uniquely scopes to the one linked child.
 *
 * These are additive, read-only routes. The staff routers (napRoutes,
 * foodConsumptionRoutes) and their staffOnly guards are left untouched.
 */

const express = require("express");
const router  = express.Router();
const { authenticate, requireOwnChild } = require("../middleware/authMiddleware");
const napSvc  = require("../services/napService");
const foodSvc = require("../services/foodConsumptionService");

const DEFAULT_SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";

// Path-scoped to /api/parent so this parent-only guard does not intercept
// staff requests to other routers' paths (router mounted at the app root).
router.use("/api/parent", authenticate, requireOwnChild);

// GET /api/parent/naps — the linked child's nap log (newest first).
router.get("/api/parent/naps", async (req, res) => {
  try {
    const schoolId = req.user?.schoolId || DEFAULT_SCHOOL_ID;
    const naps = await napSvc.getNapHistory({ studentId: req.ownChildId, schoolId });
    res.json(naps);
  } catch (e) {
    console.error("[GET /api/parent/naps]", e.message);
    res.status(500).json({ error: "Failed to fetch naps.", details: e.message });
  }
});

// GET /api/parent/food-consumption?date= — the linked child's meals.
router.get("/api/parent/food-consumption", async (req, res) => {
  try {
    const schoolId = req.user?.schoolId || DEFAULT_SCHOOL_ID;
    const { date } = req.query;
    const entries = await foodSvc.getConsumption({ studentId: req.ownChildId, date, schoolId });
    res.json(entries);
  } catch (e) {
    console.error("[GET /api/parent/food-consumption]", e.message);
    res.status(500).json({ error: "Failed to fetch meals.", details: e.message });
  }
});

module.exports = router;
