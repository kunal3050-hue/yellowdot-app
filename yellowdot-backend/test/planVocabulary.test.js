/**
 * One set of plan names, used consistently.
 *
 * tenants.subscriptionPlan is written by the TenantDetail dropdown and
 * documented in tenantService as trial / starter / professional / enterprise.
 * plans.js independently ranked trial / standard / premium / enterprise, and
 * planRank() falls back to DEFAULT_PLAN for anything it does not recognise —
 * so "starter" and "professional" both resolved to the same rank and were
 * indistinguishable from each other.
 *
 * That was invisible because every catalog entry is minPlan: null today, so
 * no feature is plan-gated and no comparison had consequences. The first time
 * a feature was gated, a professional customer would quietly have been served
 * the starter tier, with nothing failing to reveal it.
 */
const test   = require("node:test");
const assert = require("node:assert");
const fs     = require("node:fs");
const path   = require("node:path");

const { PLAN_ORDER, DEFAULT_PLAN, planRank, planIncludes } = require("../platform/features/plans");

const read = p => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

test("the four plan names are the ones stored on the tenant", () => {
  assert.deepEqual(PLAN_ORDER, ["trial", "starter", "professional", "enterprise"]);
});

test("every plan name ranks distinctly — no two tiers collide", () => {
  const ranks = PLAN_ORDER.map(planRank);
  assert.equal(new Set(ranks).size, PLAN_ORDER.length,
    `two plans share a rank: ${JSON.stringify(Object.fromEntries(PLAN_ORDER.map(p => [p, planRank(p)])))}`);
});

test("professional outranks starter", () => {
  // The specific collision that existed: both fell back to DEFAULT_PLAN.
  assert.ok(planRank("professional") > planRank("starter"));
});

test("DEFAULT_PLAN is itself a real plan", () => {
  assert.ok(PLAN_ORDER.includes(DEFAULT_PLAN),
    "an unknown plan falls back to DEFAULT_PLAN; it cannot be a name that does not exist");
});

test("an unknown plan still grants the mid tier, never nothing", () => {
  // A billing data problem must not lock a school out of its own software.
  assert.equal(planRank("nonsense-plan"), planRank(DEFAULT_PLAN));
  assert.ok(planRank("nonsense-plan") > planRank("trial"));
});

test("an ungated feature is granted to every plan, trial included", () => {
  for (const p of PLAN_ORDER) assert.equal(planIncludes(p, null), true);
});

test("the schema doc and the seeds use only canonical names", () => {
  const sources = {
    "services/tenantService.js": read("services/tenantService.js"),
    "scripts/seedTenant.js":     read("scripts/seedTenant.js"),
    "scripts/seedEmulator.js":   read("scripts/seedEmulator.js"),
  };
  const retired = /\b(standard|premium)\b/;
  for (const [file, src] of Object.entries(sources)) {
    const planLines = src.split("\n").filter(l => /subscriptionPlan/.test(l));
    for (const line of planLines) {
      assert.doesNotMatch(line, retired,
        `${file} still uses a retired plan name: ${line.trim()}`);
    }
  }
});
