/**
 * verify-features.mjs — feature flag + scope resolution parity
 * ─────────────────────────────────────────────────────────────────────
 * PLATFORM ARCHITECTURE §12 Phase 2 — docs/platform-architecture/PLATFORM_ARCHITECTURE.md
 *
 * Usage: npm run verify:features
 *
 * Phase 2's gate: "every flag resolves to its current value for every plan,
 * and scope resolution grants no rung the caller's data does not support."
 *
 * The risk this guards is specific. Feature resolution moved from a build-time
 * constant in the frontend bundle to a four-layer resolver on the server. If
 * the backend catalogue's defaults disagree with the frontend's flags by even
 * one key, a module silently appears or disappears for every tenant at once.
 * So the two are compared directly, per flag, per environment.
 *
 * The backend modules are plain CommonJS with no Firebase imports, so they are
 * required directly rather than parsed.
 */

import { createRequire } from "module";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { extractLiteral } from "./verify-lib.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require   = createRequire(import.meta.url);
const BACKEND   = join(__dirname, "../yellowdot-backend");

const PASS = "✅", FAIL = "❌", WARN = "⚠️";
let failures = 0, warnings = 0;
const pass = (m, x = "") => console.log(`${PASS} ${m}${x ? `  →  ${x}` : ""}`);
const fail = (m, x = "") => { console.error(`${FAIL} ${m}${x ? `  →  ${x}` : ""}`); failures++; };
const warn = (m, x = "") => { console.log(`${WARN} ${m}${x ? `  →  ${x}` : ""}`); warnings++; };
const section = t => console.log(`\n── ${t} ${"─".repeat(Math.max(0, 62 - t.length))}`);

async function run() {
  console.log("\n🔍 Feature flag + scope resolution — PLATFORM_ARCHITECTURE §12 Phase 2");

  const catalog  = require(join(BACKEND, "platform/features/catalog.js"));
  const resolver = require(join(BACKEND, "platform/features/resolveFeatures.js"));
  const plans    = require(join(BACKEND, "platform/features/plans.js"));
  const scopeMod = require(join(BACKEND, "platform/scope/resolveScope.js"));

  // featureFlags.js cannot be imported here — it pulls in environment.js, which
  // reads the Vite-only `import.meta.env`. Both literals are sliced from source
  // instead, with `isPreProduction` supplied explicitly per environment.
  const flagsSrc = readFileSync(join(__dirname, "src/config/featureFlags.js"), "utf8");
  const flagsFor = env => extractLiteral(flagsSrc, "export const FLAGS =",
    { isPreProduction: env !== "production" });
  const FLAG_GROUPS = extractLiteral(flagsSrc, "export const FLAG_GROUPS =");
  const FLAGS = flagsFor("development");

  // ── 1. Backend defaults vs frontend build-time flags ───────────────────────
  section("1. Catalogue defaults match today's build-time flags");

  // Re-evaluating FLAGS once per environment reproduces exactly what a build
  // for that tier would compile in — no heuristics, no FLAG_GROUPS guesswork.
  const ENVS = ["development", "staging", "production"];
  const frontendByEnv = Object.fromEntries(ENVS.map(e => [e, flagsFor(e)]));
  const expected = (key, env) => Boolean(frontendByEnv[env][key]);
  let mismatches = 0;
  for (const key of Object.keys(FLAGS)) {
    if (!catalog.BY_KEY[key]) {
      fail(`flag "${key}" exists in the frontend but NOT in the backend catalogue`);
      mismatches++;
      continue;
    }
    for (const env of ENVS) {
      const got = resolver.resolveFeature(key, null, env).enabled;
      const exp = expected(key, env);
      if (got !== exp) {
        fail(`flag "${key}" in ${env}`, `backend=${got}, frontend=${exp}`);
        mismatches++;
      }
    }
  }
  if (!mismatches) {
    pass("Every frontend flag resolves identically on the backend",
         `${Object.keys(FLAGS).length} flags × ${ENVS.length} envs`);
  }

  // Backend-only flags are legitimate (FINANCE_FOUNDATION, AI_INSIGHTS) but
  // should be deliberate, so list them rather than passing silently.
  const backendOnly = catalog.FEATURES.map(f => f.key).filter(k => !(k in FLAGS));
  if (backendOnly.length) warn("Backend-only flags (not in the frontend bundle)", backendOnly.join(", "));

  // ── 2. Layer precedence ────────────────────────────────────────────────────
  section("2. Four-layer precedence (§2c.2)");

  const key = "STUDENTS";   // default-on, not plan-gated
  const cases = [
    ["no tenant → platform default", resolver.resolveFeature(key, null, "production"), true, "platform-default"],
    ["tenant override false BEATS default",
      resolver.resolveFeature(key, { features: { [key]: false } }, "production"), false, "tenant-override"],
    ["tenant override true on an OFF flag",
      resolver.resolveFeature("MESSAGING", { features: { MESSAGING: true } }, "production"), true, "tenant-override"],
    ["absent override key falls through",
      resolver.resolveFeature(key, { features: { SOMETHING_ELSE: false } }, "production"), true, "platform-default"],
  ];
  let precFails = 0;
  for (const [label, got, expEnabled, expSource] of cases) {
    if (got.enabled !== expEnabled || got.source !== expSource) {
      fail(`precedence: ${label}`, `got ${got.enabled}/${got.source}, expected ${expEnabled}/${expSource}`);
      precFails++;
    }
  }
  // An explicit `false` override must survive — this is the "turn it off for
  // this customer" case, and truthiness testing would silently lose it.
  const denied = resolver.resolveFeature("STUDENTS", { features: { STUDENTS: false } }, "production");
  if (denied.enabled) { fail("precedence: explicit false override was lost"); precFails++; }
  if (!precFails) pass("Precedence correct", `${cases.length + 1} cases`);

  // ── 3. Plan gating is inert at cutover ─────────────────────────────────────
  section("3. Plan gating inert at cutover");

  const planGated = catalog.FEATURES.filter(f => f.minPlan != null);
  if (planGated.length) {
    warn("Flags now plan-gated — every tenant below that plan LOSES them",
         planGated.map(f => `${f.key}>=${f.minPlan}`).join(", "));
  } else {
    pass("No flag is plan-gated yet", "licensing switches on deliberately, per flag");
  }

  for (const plan of plans.PLAN_ORDER) {
    const withPlan = resolver.resolveAll({ subscriptionPlan: plan }, "production");
    const without  = resolver.resolveAll(null, "production");
    const diff = Object.keys(withPlan).filter(k => withPlan[k] !== without[k]);
    if (diff.length) fail(`plan "${plan}" changes resolution at cutover`, diff.join(", "));
  }

  // ── 4. Scope ladder ────────────────────────────────────────────────────────
  section("4. Scope ladder (§2c.1)");

  const { buildScope, scopeFilterFor, normalizeLevel, levelAtLeast, LEVELS } = scopeMod;

  let scopeFails = 0;
  if (normalizeLevel(true) !== "school") { fail("legacy true must map to school"); scopeFails++; }
  if (normalizeLevel(false) !== "none")  { fail("legacy false must map to none"); scopeFails++; }
  if (!levelAtLeast("branch", "classroom")) { fail("branch must satisfy classroom"); scopeFails++; }
  if (levelAtLeast("classroom", "branch"))  { fail("classroom must NOT satisfy branch"); scopeFails++; }
  if (LEVELS.length !== 9) { fail(`ladder should have 9 rungs, has ${LEVELS.length}`); scopeFails++; }

  const s = buildScope({
    userId: "staff_1", schoolId: "ydseawoods", centerId: "seawoods",
    departmentId: "academic", classIds: ["butterfly"],
  });
  if (s.self !== "staff_1")                { fail("scope.self not resolved"); scopeFails++; }
  if (!s.branchIds.includes("seawoods"))   { fail("scope.branchIds not resolved"); scopeFails++; }
  if (s.platform)                          { fail("non-bypass user must not get platform scope"); scopeFails++; }
  if (s.teamIds !== null)                  { fail("teamIds must be null until lazily resolved"); scopeFails++; }

  // The security-critical cases: unresolved or absent scope must FAIL CLOSED.
  if (!scopeFilterFor("none", s)?.deny)     { fail("level none must deny"); scopeFails++; }
  if (!scopeFilterFor("platform", s)?.deny) { fail("platform must deny for a non-bypass user"); scopeFails++; }
  const teamFilter = scopeFilterFor("team", s);
  if (!teamFilter || teamFilter.values.length !== 0) {
    fail("unresolved teamIds must yield an EMPTY filter, never an unfiltered read"); scopeFails++;
  }
  if (scopeFilterFor("school", s) !== null) { fail("school adds no narrowing"); scopeFails++; }
  const selfFilter = scopeFilterFor("self", s);
  if (selfFilter?.values?.[0] !== "staff_1") { fail("self must filter to the caller"); scopeFails++; }

  if (!scopeFails) pass("Ladder ordering, legacy mapping and fail-closed behaviour correct", "13 assertions");

  // ── Summary ────────────────────────────────────────────────────────────────
  section("Summary");
  console.log(`   Catalogue flags : ${catalog.FEATURES.length}`);
  console.log(`   Plans           : ${plans.PLAN_ORDER.join(" < ")}`);
  console.log(`   Scope rungs     : ${LEVELS.join(" < ")}`);
  console.log(`   Warnings        : ${warnings}`);

  if (failures) {
    console.error(`\n${FAIL} ${failures} failure(s).\n`);
    process.exit(1);
  }
  console.log(`\n${PASS} Feature and scope resolution verified — no behaviour change.\n`);
}

run().catch(err => {
  console.error(`\n${FAIL} verify-features crashed:\n`, err);
  process.exit(1);
});
