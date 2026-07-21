/**
 * billingPlanRoutes.js — Billing Plan REST API (Finance Foundation, Sprint 1)
 * ────────────────────────────────────────────────────────────────────
 * POST /api/finance/billing-plans                  Create a plan (draft status)
 * GET  /api/finance/billing-plans?studentId=...     List plans for a student
 * GET  /api/finance/billing-plans/:planId           Fetch a plan
 * PUT  /api/finance/billing-plans/:planId/status    Change status (no automation fires)
 *
 * Gated behind FINANCE_FOUNDATION_ENABLED. No scheduler/automation reads
 * these plans this sprint — "do not enable recurring billing".
 */
const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/billingPlanController");
const { authenticate, authorizeRoute, staffOnly } = require("../middleware/authMiddleware");
const { requireFinanceFoundationFlag } = require("../middleware/financeFoundationFlag");

const KEY = "finance-foundation";
const guard = [requireFinanceFoundationFlag, authenticate, staffOnly, authorizeRoute(KEY)];

router.post("/api/finance/billing-plans",                  ...guard, ctrl.create);
router.get("/api/finance/billing-plans",                   ...guard, ctrl.listForStudent);
router.get("/api/finance/billing-plans/:planId",            ...guard, ctrl.getOne);
router.put("/api/finance/billing-plans/:planId/status",     ...guard, ctrl.setStatus);

module.exports = router;
