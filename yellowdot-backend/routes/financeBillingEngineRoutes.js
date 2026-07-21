/**
 * financeBillingEngineRoutes.js — Manual Billing Engine REST API
 * (Finance Foundation, Sprint 3, M3.4)
 *
 * POST /api/finance/billing-plans/:planId/generate-invoice
 *   Staff-triggered only. Body: { periodStart, periodEnd } (ISO date strings).
 *   No background scheduler ever calls this — that is M3.5, explicitly deferred.
 *
 * Gated behind FINANCE_FOUNDATION_ENABLED, same as every other Finance
 * Foundation route.
 */
const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/financeBillingEngineController");
const { authenticate, authorizeRoute, staffOnly } = require("../middleware/authMiddleware");
const { requireFinanceFoundationFlag } = require("../middleware/financeFoundationFlag");

const KEY = "finance-foundation";
const guard = [requireFinanceFoundationFlag, authenticate, staffOnly, authorizeRoute(KEY)];

router.post("/api/finance/billing-plans/:planId/generate-invoice", ...guard, ctrl.generateInvoice);

module.exports = router;
