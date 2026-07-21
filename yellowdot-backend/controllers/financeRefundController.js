/**
 * financeRefundController.js — HTTP handlers for Refund & Reversal
 * (Sprint 4, M4.5). Staff-triggered only.
 */
const refundSvc = require("../services/financeRefundReversalService");
const { resolveContext } = require("../middleware/requestScope");

function _err(res, route, err) {
  let code = 500;
  if (err.code === "VALIDATION") code = 400;
  if (err.code === "NOT_FOUND")  code = 404;
  console.error(`[${route}]`, err.message);
  res.status(code).json({ success: false, error: err.message || "Server error." });
}

async function requestRefund(req, res) {
  try {
    const { schoolId, centerId, actorUserId } = resolveContext(req);
    const { paymentId, amount, reason } = req.body;
    const result = await refundSvc.requestRefund(paymentId, amount, { schoolId, centerId, actorUserId, reason });
    res.json({ success: true, ...result });
  } catch (err) { _err(res, "POST /api/finance/refunds", err); }
}

async function approveRefund(req, res) {
  try {
    const { schoolId, centerId, actorUserId } = resolveContext(req);
    const result = await refundSvc.approveRefund(req.params.refundId, { schoolId, centerId, actorUserId });
    res.json({ success: true, ...result });
  } catch (err) { _err(res, "POST /api/finance/refunds/:refundId/approve", err); }
}

async function rejectRefund(req, res) {
  try {
    const { schoolId, actorUserId } = resolveContext(req);
    const refund = await refundSvc.rejectRefund(req.params.refundId, { schoolId, actorUserId, reason: req.body.reason });
    res.json({ success: true, refund });
  } catch (err) { _err(res, "POST /api/finance/refunds/:refundId/reject", err); }
}

async function getOne(req, res) {
  try {
    const { schoolId } = resolveContext(req);
    const refund = await refundSvc.getRefund(req.params.refundId, { schoolId });
    if (!refund) return res.status(404).json({ success: false, error: "Refund not found." });
    res.json({ success: true, refund });
  } catch (err) { _err(res, "GET /api/finance/refunds/:refundId", err); }
}

async function reversePayment(req, res) {
  try {
    const { schoolId, centerId, actorUserId } = resolveContext(req);
    const payment = await refundSvc.reversePayment(req.params.paymentId, { schoolId, centerId, actorUserId, reason: req.body.reason });
    res.json({ success: true, payment });
  } catch (err) { _err(res, "POST /api/finance/payments/:paymentId/reverse", err); }
}

module.exports = { requestRefund, approveRefund, rejectRefund, getOne, reversePayment };
