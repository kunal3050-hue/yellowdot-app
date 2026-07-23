/**
 * financeSchedulerController.js — HTTP handlers for the Recurring Billing
 * Scheduler (M3.5). Platform-wide (cross-tenant) operation — see
 * routes/financeSchedulerRoutes.js for why this is gated to bypass roles
 * only (developer/super_admin), not the regular per-school
 * "finance-foundation" permission.
 */
const schedulerSvc = require("../services/financeBillingSchedulerService");
const { resolveContext } = require("../middleware/requestScope");

function _err(res, route, err) {
  const code = err.code === "SCHEDULER_LOCKED" ? 409 : 500;
  console.error(`[${route}]`, err.message);
  res.status(code).json({ success: false, error: err.message || "Server error." });
}

async function runNow(req, res) {
  try {
    const { actorUserId } = resolveContext(req);
    const result = await schedulerSvc.runSchedulerOnce({ triggeredBy: "manual", actorUserId });
    res.json({ success: true, ...result });
  } catch (err) { _err(res, "POST /api/finance/scheduler/run", err); }
}

async function listRuns(req, res) {
  try {
    const runs = await schedulerSvc.listRuns({ limit: Number(req.query.limit) || 50 });
    res.json({ success: true, runs, total: runs.length });
  } catch (err) { _err(res, "GET /api/finance/scheduler/runs", err); }
}

async function getRun(req, res) {
  try {
    const run = await schedulerSvc.getRunDetail(req.params.runId);
    if (!run) return res.status(404).json({ success: false, error: "Run not found." });
    res.json({ success: true, run });
  } catch (err) { _err(res, "GET /api/finance/scheduler/runs/:runId", err); }
}

module.exports = { runNow, listRuns, getRun };
