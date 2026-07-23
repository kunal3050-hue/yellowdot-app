/**
 * financeInvoiceRoutes.js — Finance Foundation Invoice REST API (read-only)
 * ────────────────────────────────────────────────────────────────────
 * GET /api/finance/invoices?studentId=&status=   List (school-wide or by student)
 * GET /api/finance/invoices/:invoiceId           Fetch one
 *
 * Creation happens only through financeBillingEngineRoutes.js's
 * generate-invoice endpoint — there is deliberately no POST here.
 *
 * Gated behind FINANCE_FOUNDATION_ENABLED, same as every other Finance
 * Foundation route.
 */
const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/financeInvoiceController");
const { authenticate, authorizeRoute, staffOnly } = require("../middleware/authMiddleware");
const { requireFinanceFoundationFlag } = require("../middleware/financeFoundationFlag");

const KEY = "finance-foundation";
const guard = [requireFinanceFoundationFlag, authenticate, staffOnly, authorizeRoute(KEY)];

router.get("/api/finance/invoices",             ...guard, ctrl.list);
router.get("/api/finance/invoices/:invoiceId",  ...guard, ctrl.getOne);

module.exports = router;
