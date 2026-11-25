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

// ── Evaluation ────────────────────────────────────────────────────────────────

/**
 * Decide what a tenant's status means for this request, without answering it.
 *
 * Split out from enforceTenant so the same judgement can be used two ways:
 * to block a request, and to TELL a client why it is blocked. /api/auth/me is
 * exempt from blocking on purpose — if the boot call 403s, a suspended school
 * sees a broken app instead of an explanation — but it still needs the verdict
 * in order to show one.
 *
 * @returns {{ tenant: object|null, block: object|null, trialDaysLeft: number|null }}
 *          `block` is null when the request may proceed.
 */
async function evaluateTenant(user) {
  const { role, schoolId } = user || {};

  // super_admin / developer bypass unconditionally, so suspending a tenant can
  // never remove the means of un-suspending it.
  if (role === "super_admin" || role === "developer") {
    return { tenant: null, block: null, trialDaysLeft: null };
  }

  if (!schoolId) {
    return {
      tenant: null,
      block: { code: "NO_TENANT_CONTEXT", error: "No tenant context for this account." },
      trialDaysLeft: null,
    };
  }

  const tenant = await _getCachedTenant(schoolId);

  // Tenant doc missing — a legacy pre-migration school. Allow through; the
  // existing schoolId-based isolation still applies.
  if (!tenant) return { tenant: null, block: null, trialDaysLeft: null };

  if (tenant.status === "suspended") {
    return {
      tenant,
      block: {
        code:    "TENANT_SUSPENDED",
        error:   "Your school account has been suspended.",
        contact: tenant.contactEmail || "support@kueboxscare.com",
      },
      trialDaysLeft: null,
    };
  }

  if (tenant.status === "cancelled") {
    return {
      tenant,
      block: { code: "TENANT_CANCELLED", error: "This school account has been cancelled." },
      trialDaysLeft: null,
    };
  }

  if (tenant.status === "trial" && tenant.trialEndsAt) {
    const daysLeft = Math.ceil((new Date(tenant.trialEndsAt) - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) {
      return {
        tenant,
        block: {
          code:    "TRIAL_EXPIRED",
          error:   "Your free trial has expired. Please upgrade to continue.",
          contact: tenant.contactEmail || "support@kueboxscare.com",
        },
        trialDaysLeft: daysLeft,
      };
    }
    return { tenant, block: null, trialDaysLeft: daysLeft };
  }

  return { tenant, block: null, trialDaysLeft: null };
}

// ── Main middleware ────────────────────────────────────────────────────────────

async function enforceTenant(req, res, next) {
  try {
    const { tenant, block, trialDaysLeft } = await evaluateTenant(req.user);
    if (tenant) req.tenant = tenant;
    if (trialDaysLeft != null && trialDaysLeft >= 0) {
      res.setHeader("X-Trial-Days-Remaining", String(trialDaysLeft));
    }
    if (block) return res.status(403).json(block);
    next();
  } catch (err) {
    console.error("[tenantMiddleware] Error:", err.message);
    next(); // fail-open: don't block real users due to Firestore issues
  }
}

/**
 * Attach the verdict without acting on it. Used for the handful of paths that
 * must stay reachable for a blocked school (see TENANT_GATE_EXEMPT in
 * authMiddleware); /api/auth/me reads req.tenantBlock to tell the client why.
 */
async function attachTenantStatus(req, res, next) {
  try {
    const { tenant, block, trialDaysLeft } = await evaluateTenant(req.user);
    if (tenant) req.tenant = tenant;
    req.tenantBlock = block;
    if (trialDaysLeft != null && trialDaysLeft >= 0) {
      res.setHeader("X-Trial-Days-Remaining", String(trialDaysLeft));
    }
  } catch (err) {
    console.error("[tenantMiddleware] attach error:", err.message);
  }
  next();
}

// Invalidate a specific tenant from the cache (call after status change)
function invalidateTenantCache(tenantId) {
  _cache.delete(tenantId);
}

module.exports = { enforceTenant, attachTenantStatus, evaluateTenant, invalidateTenantCache };
