/**
 * tenantController.js — Super Admin tenant management HTTP handlers
 *
 * All endpoints require role=super_admin or role=developer.
 * Impersonation generates a Firebase custom token so the super admin can
 * log in as a tenant admin and is always written to tenantAuditLogs.
 */

const tenantSvc = require("../services/tenantService");
const { auth }  = require("../firebaseAdmin");
const { invalidateTenantCache } = require("../middleware/tenantMiddleware");

function actor(req) {
  return {
    actorUserId: req.user?.userId   || "system",
    actorEmail:  req.user?.email    || "",
  };
}

// ── List all tenants ───────────────────────────────────────────────────────────
async function listTenants(req, res) {
  try {
    const { status, plan, search } = req.query;
    const tenants = await tenantSvc.getAll({ status, plan, search });
    res.json({ tenants, total: tenants.length });
  } catch (err) {
    console.error("[tenantController.listTenants]", err.message);
    res.status(500).json({ error: err.message });
  }
}

// ── Get single tenant ──────────────────────────────────────────────────────────
async function getTenant(req, res) {
  try {
    const tenant = await tenantSvc.getById(req.params.tenantId);
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });
    res.json(tenant);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ── Create tenant ──────────────────────────────────────────────────────────────
async function createTenant(req, res) {
  try {
    const tenant = await tenantSvc.create(req.body, actor(req));
    res.status(201).json(tenant);
  } catch (err) {
    const status = err.message.includes("already exists") ? 409 : 400;
    res.status(status).json({ error: err.message });
  }
}

// ── Update tenant ──────────────────────────────────────────────────────────────
async function updateTenant(req, res) {
  try {
    const updated = await tenantSvc.update(req.params.tenantId, req.body, actor(req));
    invalidateTenantCache(req.params.tenantId);
    res.json(updated);
  } catch (err) {
    const status = err.message.includes("not found") ? 404 : 400;
    res.status(status).json({ error: err.message });
  }
}

// ── Delete (soft) tenant ───────────────────────────────────────────────────────
async function deleteTenant(req, res) {
  try {
    await tenantSvc.remove(req.params.tenantId, actor(req));
    invalidateTenantCache(req.params.tenantId);
    res.json({ success: true });
  } catch (err) {
    const status = err.message.includes("not found") ? 404 : 400;
    res.status(status).json({ error: err.message });
  }
}

// ── Set status ─────────────────────────────────────────────────────────────────
async function setTenantStatus(req, res) {
  try {
    const { status, reason } = req.body;
    const tenant = await tenantSvc.setStatus(req.params.tenantId, status, { ...actor(req), reason });
    invalidateTenantCache(req.params.tenantId);
    res.json(tenant);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// ── Add branch ─────────────────────────────────────────────────────────────────
async function addBranch(req, res) {
  try {
    const branch = await tenantSvc.addBranch(req.params.tenantId, req.body, actor(req));
    res.status(201).json(branch);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// ── Remove branch ──────────────────────────────────────────────────────────────
async function removeBranch(req, res) {
  try {
    await tenantSvc.removeBranch(req.params.tenantId, req.params.branchId, actor(req));
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// ── Upsert academic year ───────────────────────────────────────────────────────
async function upsertAcademicYear(req, res) {
  try {
    const year = await tenantSvc.upsertAcademicYear(req.params.tenantId, req.body, actor(req));
    res.json(year);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// ── Analytics ──────────────────────────────────────────────────────────────────
async function getAnalytics(req, res) {
  try {
    const analytics = await tenantSvc.getAnalytics();
    res.json(analytics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ── Audit logs ─────────────────────────────────────────────────────────────────
async function getAuditLogs(req, res) {
  try {
    const limit    = Math.min(parseInt(req.query.limit) || 50, 200);
    const tenantId = req.params.tenantId || req.query.tenantId;
    const logs     = await tenantSvc.getAuditLogs({ tenantId, limit });
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ── Impersonation ──────────────────────────────────────────────────────────────
// Creates a short-lived Firebase custom token so the super admin can
// experience the app exactly as a tenant admin would.
// The custom token carries extra claims: { schoolId, role: "admin", impersonatedBy }.
async function impersonateTenant(req, res) {
  try {
    const { tenantId } = req.params;
    const tenant = await tenantSvc.getById(tenantId);
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });

    const actorInfo = actor(req);

    // Use a deterministic UID for the impersonation session so Firebase Auth
    // doesn't create a new user record each time.
    const impersonationUid = `impersonate_${actorInfo.actorUserId}_${tenantId}`;

    const customToken = await auth.createCustomToken(impersonationUid, {
      schoolId:         tenantId,
      role:             "admin",
      impersonatedBy:   actorInfo.actorUserId,
      impersonatedAt:   new Date().toISOString(),
      // Marks session as impersonation so the frontend can show a banner
      isImpersonation:  true,
    });

    await tenantSvc.logImpersonation(tenantId, {
      ...actorInfo,
      targetSchoolId: tenantId,
    });

    res.json({
      customToken,
      tenantId,
      schoolName:     tenant.schoolName,
      expiresInSeconds: 3600,
      warning: "This token grants admin access to the tenant. Use responsibly.",
    });
  } catch (err) {
    console.error("[tenantController.impersonateTenant]", err.message);
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  listTenants,
  getTenant,
  createTenant,
  updateTenant,
  deleteTenant,
  setTenantStatus,
  addBranch,
  removeBranch,
  upsertAcademicYear,
  getAnalytics,
  getAuditLogs,
  impersonateTenant,
};
