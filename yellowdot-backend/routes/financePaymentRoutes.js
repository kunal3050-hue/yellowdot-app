/**
 * financePaymentRoutes.js — Payment Recording & Allocation REST API
 * (Finance Foundation, Sprint 4, M4.1/M4.2)
 *
 * POST /api/finance/payments                        Record a payment (family-scoped)
 * GET  /api/finance/payments?familyId=...            List payments for a family
 * GET  /api/finance/payments/:paymentId              Fetch a payment
 * POST /api/finance/payments/:paymentId/allocate     Allocate a recorded/partially-allocated payment
 *
 * Gated behind FINANCE_FOUNDATION_ENABLED, same as every other Finance
 * Foundation route. Staff-triggered only — no scheduler/automation calls these.
 */
const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/financePaymentController");
const { authenticate, authorizeRoute, staffOnly } = require("../middleware/authMiddleware");
const { requireFinanceFoundationFlag } = require("../middleware/financeFoundationFlag");

const KEY = "finance-foundation";
const guard = [requireFinanceFoundationFlag, authenticate, staffOnly, authorizeRoute(KEY)];

router.post("/api/finance/payments",                    ...guard, ctrl.recordPayment);
router.get("/api/finance/payments",                      ...guard, ctrl.listForFamily);
router.get("/api/finance/payments/:paymentId",            ...guard, ctrl.getOne);
router.post("/api/finance/payments/:paymentId/allocate",  ...guard, ctrl.allocate);

module.exports = router;
