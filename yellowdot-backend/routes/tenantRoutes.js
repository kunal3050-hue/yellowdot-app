/**
 * tenantRoutes.js — Super Admin tenant management API
 *
 * All routes require super_admin or developer role.
 * Mount in server.js: app.use(tenantRoutes)
 *
 * Endpoints:
 *   GET    /api/tenants                          — list all tenants
 *   POST   /api/tenants                          — create tenant
 *   GET    /api/tenants/analytics                — aggregate analytics
 *   GET    /api/tenants/audit-logs               — all audit logs (recent 200)
 *   GET    /api/tenants/:tenantId                — get single tenant
 *   PUT    /api/tenants/:tenantId                — update tenant
 *   DELETE /api/tenants/:tenantId                — soft-delete tenant
 *   POST   /api/tenants/:tenantId/status         — set status (active/suspended/…)
 *   POST   /api/tenants/:tenantId/impersonate    — get impersonation custom token
 *   POST   /api/tenants/:tenantId/branches       — add branch
 *   DELETE /api/tenants/:tenantId/branches/:branchId — remove branch
 *   POST   /api/tenants/:tenantId/academic-years — upsert academic year
 *   GET    /api/tenants/:tenantId/audit-logs     — per-tenant audit logs
 */

const express = require("express");
const router  = express.Router();

const {
  authenticate,
  authorize,
} = require("../middleware/authMiddleware");

const ctrl = require("../controllers/tenantController");

const superAdminOnly = [authenticate, authorize("super_admin", "developer")];

/**
 * Reading the platform, and turning a school off.
 *
 * platform_admin is scoped deliberately narrowly (decided 2026-11-26, see
 * docs/platform-access-model.md §4): it may see which schools exist and what
 * state they are in, and it may suspend or reactivate one. Nothing else.
 *
 * What it is NOT given, and why each is a separate decision rather than an
 * oversight:
 *   create          a new tenant is a commercial act, not an operational one
 *   update          that includes subscriptionPlan — changing what a school
 *                   pays for is not the same job as switching it off
 *   delete          irreversible, and the one action with no recovery path
 *   impersonate     the only action here that reads children's records; ruled
 *                   out explicitly rather than left implied by "manage"
 *   branches,
 *   academic-years  these edit a school's own configuration, which is the
 *                   school's business, not the platform's
 *
 * Suspension is included despite being disruptive — it cuts a school off
 * mid-day — because responding to non-payment or abuse is precisely the job
 * this role exists for, and it is reversible within the 60-second tenant
 * cache.
 */
const platformOps = [authenticate, authorize("super_admin", "developer", "platform_admin")];

// ── Static sub-routes first (before /:tenantId) ───────────────────────────────
router.get ("/api/tenants/analytics",  ...platformOps, ctrl.getAnalytics);
router.get ("/api/tenants/audit-logs", ...platformOps, ctrl.getAuditLogs);

// ── Collection routes ─────────────────────────────────────────────────────────
router.get ("/api/tenants",            ...platformOps, ctrl.listTenants);
router.post("/api/tenants",            ...superAdminOnly, ctrl.createTenant);

// ── Per-tenant routes ─────────────────────────────────────────────────────────
router.get   ("/api/tenants/:tenantId",              ...platformOps, ctrl.getTenant);
router.put   ("/api/tenants/:tenantId",              ...superAdminOnly, ctrl.updateTenant);
router.delete("/api/tenants/:tenantId",              ...superAdminOnly, ctrl.deleteTenant);
router.post  ("/api/tenants/:tenantId/status",       ...platformOps, ctrl.setTenantStatus);
router.post  ("/api/tenants/:tenantId/impersonate",  ...superAdminOnly, ctrl.impersonateTenant);
router.post  ("/api/tenants/:tenantId/branches",     ...superAdminOnly, ctrl.addBranch);
router.delete("/api/tenants/:tenantId/branches/:branchId", ...superAdminOnly, ctrl.removeBranch);
router.post  ("/api/tenants/:tenantId/academic-years", ...superAdminOnly, ctrl.upsertAcademicYear);
router.get   ("/api/tenants/:tenantId/audit-logs",   ...platformOps, ctrl.getAuditLogs);

module.exports = router;
