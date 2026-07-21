/**
 * financeBillingEngineController.js — HTTP handler for the Manual Billing
 * Engine (Sprint 3, M3.4). Staff-triggered only — no scheduler calls this.
 */
const billingEngineSvc  = require("../services/financeBillingEngineService");
const { resolveContext } = require("../middleware/requestScope");

function _err(res, route, err) {
  let code = 500;
  if (err.code === "VALIDATION")        code = 400;
  if (err.code === "NOT_FOUND")         code = 404;
  if (err.code === "REQUIRES_APPROVAL") code = 409;
  console.error(`[${route}]`, err.message);
  res.status(code).json({ success: false, error: err.message || "Server error." });
}

async function generateInvoice(req, res) {
  try {
    const { schoolId, centerId, actorUserId } = resolveContext(req);
    const { periodStart, periodEnd } = req.body;
    const result = await billingEngineSvc.generateInvoiceForPlan(req.params.planId, {
      schoolId, centerId, actorUserId, periodStart, periodEnd,
    });
    res.json({ success: true, ...result });
  } catch (err) { _err(res, "POST /api/finance/billing-plans/:planId/generate-invoice", err); }
}

module.exports = { generateInvoice };
