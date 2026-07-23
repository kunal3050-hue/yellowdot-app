/**
 * familyAccountRoutes.js — Family Account (extension) REST API (Finance Foundation, Sprint 1)
 * ────────────────────────────────────────────────────────────────────
 * GET  /api/finance/family-accounts/:familyId          Fetch the finance facet
 * POST /api/finance/family-accounts/:familyId          Initialize it (idempotent)
 * POST /api/finance/family-accounts/:familyId/credit   Adjust shared credit balance
 *
 * Gated behind FINANCE_FOUNDATION_ENABLED. Does not touch familyRoutes.js
 * or familyService.js — purely additive endpoints against the same
 * underlying `families` collection.
 */
const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/familyAccountController");
const { authenticate, authorizeRoute, staffOnly } = require("../middleware/authMiddleware");
const { requireFinanceFoundationFlag } = require("../middleware/financeFoundationFlag");

const KEY = "finance-foundation";
const guard = [requireFinanceFoundationFlag, authenticate, staffOnly, authorizeRoute(KEY)];

router.get("/api/finance/family-accounts",                       ...guard, ctrl.list);
router.get("/api/finance/family-accounts/:familyId",             ...guard, ctrl.getOne);
router.post("/api/finance/family-accounts/:familyId",            ...guard, ctrl.ensure);
router.post("/api/finance/family-accounts/:familyId/credit",     ...guard, ctrl.adjustCredit);

module.exports = router;
