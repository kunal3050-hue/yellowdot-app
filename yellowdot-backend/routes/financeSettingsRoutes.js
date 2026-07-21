/**
 * financeSettingsRoutes.js — Finance Settings REST API (Finance Foundation, Sprint 1)
 * ────────────────────────────────────────────────────────────────────
 * GET /api/finance/settings   Fetch (defaults if never configured)
 * PUT /api/finance/settings   Update
 *
 * Gated behind FINANCE_FOUNDATION_ENABLED. Nothing reads these values to
 * drive automation yet — storage layer only, per Sprint 1 scope.
 */
const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/financeSettingsController");
const { authenticate, authorizeRoute, staffOnly } = require("../middleware/authMiddleware");
const { requireFinanceFoundationFlag } = require("../middleware/financeFoundationFlag");

const KEY = "finance-foundation";
const guard = [requireFinanceFoundationFlag, authenticate, staffOnly, authorizeRoute(KEY)];

router.get("/api/finance/settings", ...guard, ctrl.getSettings);
router.put("/api/finance/settings", ...guard, ctrl.updateSettings);

module.exports = router;
