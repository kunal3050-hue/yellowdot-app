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

// ── Static sub-routes first (before /:tenantId) ───────────────────────────────
router.get ("/api/tenants/analytics",  ...superAdminOnly, ctrl.getAnalytics);
router.get ("/api/tenants/audit-logs", ...superAdminOnly, ctrl.getAuditLogs);

// ── Collection routes ─────────────────────────────────────────────────────────
router.get ("/api/tenants",            ...superAdminOnly, ctrl.listTenants);
router.post("/api/tenants",            ...superAdminOnly, ctrl.createTenant);

// ── Per-tenant routes ─────────────────────────────────────────────────────────
router.get   ("/api/tenants/:tenantId",              ...superAdminOnly, ctrl.getTenant);
router.put   ("/api/tenants/:tenantId",              ...superAdminOnly, ctrl.updateTenant);
router.delete("/api/tenants/:tenantId",              ...superAdminOnly, ctrl.deleteTenant);
router.post  ("/api/tenants/:tenantId/status",       ...superAdminOnly, ctrl.setTenantStatus);
router.post  ("/api/tenants/:tenantId/impersonate",  ...superAdminOnly, ctrl.impersonateTenant);
router.post  ("/api/tenants/:tenantId/branches",     ...superAdminOnly, ctrl.addBranch);
router.delete("/api/tenants/:tenantId/branches/:branchId", ...superAdminOnly, ctrl.removeBranch);
router.post  ("/api/tenants/:tenantId/academic-years", ...superAdminOnly, ctrl.upsertAcademicYear);
router.get   ("/api/tenants/:tenantId/audit-logs",   ...superAdminOnly, ctrl.getAuditLogs);

module.exports = router;
