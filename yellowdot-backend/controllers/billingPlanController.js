/**
 * billingPlanController.js — HTTP handlers for Billing Plan (Sprint 1: CRUD + lifecycle only, no automation)
 */
const billingPlanSvc      = require("../services/billingPlanService");
const { resolveContext }  = require("../middleware/requestScope");

function _err(res, route, err) {
  let code = 500;
  if (err.code === "VALIDATION") code = 400;
  if (err.code === "NOT_FOUND")  code = 404;
  console.error(`[${route}]`, err.message);
  res.status(code).json({ success: false, error: err.message || "Server error." });
}

async function create(req, res) {
  try {
    const { schoolId, centerId, actorUserId } = resolveContext(req);
    const plan = await billingPlanSvc.create(req.body, { schoolId, centerId, actorUserId });
    res.json({ success: true, plan });
  } catch (err) { _err(res, "POST /api/finance/billing-plans", err); }
}

async function getOne(req, res) {
  try {
    const { schoolId } = resolveContext(req);
    const plan = await billingPlanSvc.getPlan(req.params.planId, { schoolId });
    if (!plan) return res.status(404).json({ success: false, error: "Billing plan not found." });
    res.json({ success: true, plan });
  } catch (err) { _err(res, "GET /api/finance/billing-plans/:planId", err); }
}

async function listForStudent(req, res) {
  try {
    const { schoolId } = resolveContext(req);
    const plans = await billingPlanSvc.listForStudent(req.query.studentId, { schoolId });
    res.json({ success: true, plans, total: plans.length });
  } catch (err) { _err(res, "GET /api/finance/billing-plans", err); }
}

async function setStatus(req, res) {
  try {
    const { schoolId, actorUserId } = resolveContext(req);
    const plan = await billingPlanSvc.setStatus(req.params.planId, req.body.status, { schoolId, actorUserId });
    if (!plan) return res.status(404).json({ success: false, error: "Billing plan not found." });
    res.json({ success: true, plan });
  } catch (err) { _err(res, "PUT /api/finance/billing-plans/:planId/status", err); }
}

module.exports = { create, getOne, listForStudent, setStatus };
