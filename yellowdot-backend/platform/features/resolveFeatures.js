/**
 * resolveFeatures.js — the four-layer feature flag resolver
 * ─────────────────────────────────────────────────────────────────────
 * PLATFORM ARCHITECTURE §2c.2
 *
 *   1. kill switch      →  platform says OFF, unconditionally
 *   2. tenant override  →  explicit true/false on tenants/{id}.features
 *   3. plan grant       →  the subscription plan's feature list
 *   4. platform default →  catalog defaultByEnv (or envVar, where set)
 *
 * Pure and synchronous: it takes an already-loaded tenant record and returns a
 * plain object. Fetching and caching the tenant is the caller's job, which
 * keeps this trivially testable and keeps Firestore out of the hot path.
 */

const { FEATURES, BY_KEY, currentEnv } = require("./catalog");
const { planIncludes, DEFAULT_PLAN } = require("./plans");

/**
 * The layer-4 default for one feature.
 * `envVar` takes precedence over defaultByEnv where a flag is still governed
 */
function platformDefault(feature, env) {
  if (feature.envVar) {
    const raw = process.env[feature.envVar];
    if (raw != null) return raw === "true";
  }
  return Boolean(feature.defaultByEnv?.[env]);
}

/**
 * Resolve one feature for one tenant.
 * @returns {{ enabled: boolean, source: string }} — `source` names the layer
 *          that decided, so support can answer "why is this on?" without
 *          reading code.
 */
function resolveFeature(key, tenant = null, env = currentEnv()) {
  const feature = BY_KEY[key];
  if (!feature) return { enabled: false, source: "unknown-flag" };

  // 1. Kill switch — beats every other layer, including explicit overrides.
  if (feature.killed) return { enabled: false, source: "kill-switch" };

  // 2. Tenant override — tested by PRESENCE, never truthiness, so an explicit
  //    `false` survives a plan that would otherwise grant the feature.
  const overrides = tenant?.features;
  if (overrides && Object.prototype.hasOwnProperty.call(overrides, key)) {
    return { enabled: Boolean(overrides[key]), source: "tenant-override" };
  }

  // 3. Plan grant — only meaningful for features that declare a minPlan.
  if (feature.minPlan != null) {
    const plan = tenant?.subscriptionPlan || DEFAULT_PLAN;
    if (!planIncludes(plan, feature.minPlan)) {
      return { enabled: false, source: "plan-excluded" };
    }
    return { enabled: true, source: "plan" };
  }

  // 4. Platform default.
  return { enabled: platformDefault(feature, env), source: feature.envVar ? "env" : "platform-default" };
}

/** Resolve every feature for a tenant → { KEY: boolean }. */
function resolveAll(tenant = null, env = currentEnv()) {
  const out = {};
  for (const f of FEATURES) out[f.key] = resolveFeature(f.key, tenant, env).enabled;
  return out;
}

/** Same, but retaining which layer decided — for Super Admin tooling and support. */
function explainAll(tenant = null, env = currentEnv()) {
  const out = {};
  for (const f of FEATURES) {
    out[f.key] = { ...resolveFeature(f.key, tenant, env), stage: f.stage, label: f.label };
  }
  return out;
}

module.exports = { resolveFeature, resolveAll, explainAll, platformDefault };
