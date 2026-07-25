/**
 * plans.js — subscription plans (layer 3: plan grants)
 * ─────────────────────────────────────────────────────────────────────
 * PLATFORM ARCHITECTURE §2c.2
 *
 * Plans are ORDERED, weakest first. A plan includes every feature whose
 * `minPlan` rank is at or below its own, so adding a feature to a tier
 * automatically grants it to every tier above — the same containment trick the
 * scope ladder uses (§2c.1), for the same reason: one ordered comparison
 * instead of a matrix nobody maintains.
 *
 * `tenants.subscriptionPlan` already exists and today holds "trial" or a paid
 * plan name (see tenantService.js). Unknown or missing values resolve to
 * DEFAULT_PLAN rather than throwing — a billing data problem must never lock a
 * school out of its own software.
 *
 * ── Cutover state ─────────────────────────────────────────────────────────
 * Every catalog entry currently has `minPlan: null`, meaning NOT plan-gated,
 * so this file grants nothing extra and denies nothing on day one. It is the
 * seam that licensing switches on later, per feature, deliberately.
 */

const PLAN_ORDER = ["trial", "standard", "premium", "enterprise"];

const DEFAULT_PLAN = "standard";

/** Rank of a plan; unknown plans fall back to DEFAULT_PLAN's rank. */
function planRank(plan) {
  const i = PLAN_ORDER.indexOf(plan);
  return i === -1 ? PLAN_ORDER.indexOf(DEFAULT_PLAN) : i;
}

/**
 * Does `plan` include a feature requiring at least `minPlan`?
 * `minPlan: null` means the feature is not plan-gated at all.
 */
function planIncludes(plan, minPlan) {
  if (minPlan == null) return true;
  return planRank(plan) >= planRank(minPlan);
}

/**
 * Trial is deliberately NOT the weakest-by-exclusion tier — a trial should
 * show off the product. It ranks lowest only so that `minPlan: "standard"`
 * can fence off features that cost real money to run.
 */
module.exports = { PLAN_ORDER, DEFAULT_PLAN, planRank, planIncludes };
