/**
 * financeSchedulerRoutes.js — Recurring Billing Engine REST API (M3.5 / M3.5.1)
 * ────────────────────────────────────────────────────────────────────
 * POST /api/finance/scheduler/run              Trigger a run — body {mode:"preview"} for a dry run, omitted/anything else for a real manual run (async — returns runId immediately)
 * GET  /api/finance/scheduler/runs              List recent runs
 * GET  /api/finance/scheduler/runs/:runId       Run detail + per-plan results
 * GET  /api/finance/scheduler/dashboard         Last successful run / next scheduled run / total invoices generated / last failure / scheduler health
 *
 * RBAC: bypass roles only (developer/super_admin) — `authorize()` with no
 * role list, NOT the regular `authorizeRoute("finance-foundation")` every
 * other Finance route uses. Deliberate: the scheduler is a single,
 * PLATFORM-WIDE operation that touches every school's Billing Plans in one
 * run. A per-school admin/center_admin/accountant seeing another school's
 * plan results in the same run's execution log would be a real
 * tenant-isolation leak — this app's entire Finance Platform is
 * schoolId-scoped everywhere else, and the scheduler is the one
 * legitimately cross-tenant operation, so it gets the one RBAC tier this
 * app already uses for cross-tenant operations (Super Admin / tenant
 * management), not the per-school Finance permission.
 *
 * Gated behind FINANCE_FOUNDATION_ENABLED, same as every other Finance
 * Foundation route.
 */
const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/financeSchedulerController");
const { authenticate, authorize } = require("../middleware/authMiddleware");
const { requireFinanceFoundationFlag } = require("../middleware/financeFoundationFlag");

const guard = [requireFinanceFoundationFlag, authenticate, authorize()];

router.post("/api/finance/scheduler/run",             ...guard, ctrl.runNow);
router.get("/api/finance/scheduler/runs",              ...guard, ctrl.listRuns);
router.get("/api/finance/scheduler/runs/:runId",       ...guard, ctrl.getRun);
router.get("/api/finance/scheduler/dashboard",         ...guard, ctrl.getDashboard);

module.exports = router;
