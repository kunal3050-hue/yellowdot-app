/**
 * tenantMiddleware.js — Per-request tenant status enforcement
 *
 * Runs AFTER authenticate() to block requests when a tenant is
 * suspended or cancelled.  super_admin and developer bypass this
 * so they can still manage / reactivate tenants.
 *
 * Usage:
 *   app.use(authenticate, enforceTenant, ...)
 *
 * The middleware also attaches req.tenant (the full tenant doc) for
 * use by downstream handlers (e.g. subscription-limit checks).
 */

const tenantSvc = require("../services/tenantService");

// Cache tenant docs for 60 s to avoid a Firestore read on every request.
const _cache = new Map(); // tenantId → { doc, expiresAt }
const CACHE_TTL_MS = 60_000;

async function _getCachedTenant(tenantId) {
  const cached = _cache.get(tenantId);
  if (cached && cached.expiresAt > Date.now()) return cached.doc;

  const doc = await tenantSvc.getById(tenantId);
  _cache.set(tenantId, { doc, expiresAt: Date.now() + CACHE_TTL_MS });
  return doc;
}

// ── Main middleware ────────────────────────────────────────────────────────────

async function enforceTenant(req, res, next) {
  try {
    const { role, schoolId } = req.user || {};

    // super_admin / developer: pass through unconditionally
    if (role === "super_admin" || role === "developer") {
      return next();
    }

    if (!schoolId) {
      return res.status(403).json({ error: "No tenant context for this account." });
    }

    const tenant = await _getCachedTenant(schoolId);

    if (!tenant) {
      // Tenant doc missing — could be a legacy pre-migration school.
      // Allow through; the existing schoolId-based isolation still applies.
      return next();
    }

    req.tenant = tenant;

    if (tenant.status === "suspended") {
      return res.status(403).json({
        error:   "Your school account has been suspended.",
        code:    "TENANT_SUSPENDED",
        contact: tenant.contactEmail || "support@kueboxscare.com",
      });
    }

    if (tenant.status === "cancelled") {
      return res.status(403).json({
        error: "This school account has been cancelled.",
        code:  "TENANT_CANCELLED",
      });
    }

    // trial: allow access but surface expiry info
    if (tenant.status === "trial" && tenant.trialEndsAt) {
      const daysLeft = Math.ceil(
        (new Date(tenant.trialEndsAt) - Date.now()) / (1000 * 60 * 60 * 24),
      );
      if (daysLeft < 0) {
        return res.status(403).json({
          error:    "Your free trial has expired. Please upgrade to continue.",
          code:     "TRIAL_EXPIRED",
          contact:  "support@kueboxscare.com",
        });
      }
      res.setHeader("X-Trial-Days-Remaining", String(daysLeft));
    }

    next();
  } catch (err) {
    console.error("[tenantMiddleware] Error:", err.message);
    next(); // fail-open: don't block real users due to Firestore issues
  }
}

// Invalidate a specific tenant from the cache (call after status change)
function invalidateTenantCache(tenantId) {
  _cache.delete(tenantId);
}

module.exports = { enforceTenant, invalidateTenantCache };
