/**
 * financePaymentController.js — HTTP handlers for Payment recording and
 * allocation (Sprint 4, M4.1/M4.2). Staff-triggered only.
 */
const paymentSvc    = require("../services/financePaymentService");
const allocationSvc = require("../services/financePaymentAllocationService");
const { resolveContext } = require("../middleware/requestScope");

function _err(res, route, err) {
  let code = 500;
  if (err.code === "VALIDATION")        code = 400;
  if (err.code === "NOT_FOUND")         code = 404;
  if (err.code === "REQUIRES_APPROVAL") code = 409;
  console.error(`[${route}]`, err.message);
  res.status(code).json({ success: false, error: err.message || "Server error." });
}

async function recordPayment(req, res) {
  try {
    const { schoolId, centerId, actorUserId } = resolveContext(req);
    const payment = await paymentSvc.recordPayment(req.body, { schoolId, centerId, actorUserId });
    res.json({ success: true, payment });
  } catch (err) { _err(res, "POST /api/finance/payments", err); }
}

async function getOne(req, res) {
  try {
    const { schoolId } = resolveContext(req);
    const payment = await paymentSvc.getPayment(req.params.paymentId, { schoolId });
    if (!payment) return res.status(404).json({ success: false, error: "Payment not found." });
    res.json({ success: true, payment });
  } catch (err) { _err(res, "GET /api/finance/payments/:paymentId", err); }
}

async function listForFamily(req, res) {
  try {
    const { schoolId } = resolveContext(req);
    const payments = await paymentSvc.listForFamily(req.query.familyId, { schoolId });
    res.json({ success: true, payments, total: payments.length });
  } catch (err) { _err(res, "GET /api/finance/payments", err); }
}

async function allocate(req, res) {
  try {
    const { schoolId, centerId, actorUserId } = resolveContext(req);
    const { strategyOverride, manualAllocations, applyLeftoverToCredit } = req.body;
    const result = await allocationSvc.allocatePayment(req.params.paymentId, {
      schoolId, centerId, actorUserId, strategyOverride, manualAllocations, applyLeftoverToCredit,
    });
    res.json({ success: true, ...result });
  } catch (err) { _err(res, "POST /api/finance/payments/:paymentId/allocate", err); }
}

module.exports = { recordPayment, getOne, listForFamily, allocate };
