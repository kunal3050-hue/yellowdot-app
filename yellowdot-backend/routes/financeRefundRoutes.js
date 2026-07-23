/**
 * financeRefundRoutes.js — Refund & Reversal REST API
 * (Finance Foundation, Sprint 4, M4.5)
 *
 * POST /api/finance/refunds                        Request a refund (auto-processes below threshold)
 * GET  /api/finance/refunds/:refundId               Fetch a refund
 * POST /api/finance/refunds/:refundId/approve       Approve a Requested refund — REQUIRES the narrower
 *                                                    "finance-refund-approval" permission, not just
 *                                                    "finance-foundation", per the Sprint 4 approval's
 *                                                    explicit instruction that approver authority must
 *                                                    be validated server-side, never client-asserted.
 * POST /api/finance/refunds/:refundId/reject        Reject a Requested refund
 * POST /api/finance/payments/:paymentId/reverse     Reverse a payment (never edits history, only appends)
 *
 * Gated behind FINANCE_FOUNDATION_ENABLED, same as every other Finance
 * Foundation route.
 */
const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/financeRefundController");
const { authenticate, authorizeRoute, staffOnly } = require("../middleware/authMiddleware");
const { requireFinanceFoundationFlag } = require("../middleware/financeFoundationFlag");

const KEY          = "finance-foundation";
const APPROVAL_KEY = "finance-refund-approval";
const guard         = [requireFinanceFoundationFlag, authenticate, staffOnly, authorizeRoute(KEY)];
const approvalGuard = [requireFinanceFoundationFlag, authenticate, staffOnly, authorizeRoute(APPROVAL_KEY)];

router.post("/api/finance/refunds",                       ...guard,         ctrl.requestRefund);
router.get("/api/finance/refunds",                         ...guard,         ctrl.list);
router.get("/api/finance/refunds/:refundId",               ...guard,         ctrl.getOne);
router.post("/api/finance/refunds/:refundId/approve",      ...approvalGuard, ctrl.approveRefund);
router.post("/api/finance/refunds/:refundId/reject",       ...guard,         ctrl.rejectRefund);
router.post("/api/finance/payments/:paymentId/reverse",    ...guard,         ctrl.reversePayment);

module.exports = router;
