/**
 * verify-permissions.mjs — role → routeKey resolution parity harness
 * ─────────────────────────────────────────────────────────────────────
 * PLATFORM ARCHITECTURE §12 Phase 1 — docs/platform-architecture/PLATFORM_ARCHITECTURE.md
 *
 * Usage: npm run verify:permissions
 *        npm run verify:permissions -- --update-baseline
 *
 * Phase 1's stated gate is "every role's resolved route keys are byte-identical
 * before/after, all 9 roles." This script is that gate. It resolves permissions
 * the way the server actually does and diffs the result against a committed
 * baseline, so any change to the permission plumbing has to prove it granted
 * and revoked nothing.
 *
 * ── The authoritative resolution path (traced, not assumed) ────────────────
 *   authMiddleware._buildUserFromDoc
 *     → roleService.getPermissionsForRole(role, schoolId)
 *       → deriveRouteKeys(firestoreRoleDoc.permissions)   // MODULE_ROUTE_MAP
 *         ∪ STATIC_ROLE_PERMS[role]                       // baseline, additive only
 *   → req.user.permissions → authorizeRoute() and, via /api/auth/me, the
 *     frontend's can(routeKey).
 *
 * Two other role→routeKey maps exist and do NOT govern:
 *   - yellowdot-backend/config/permissionsBackend.js ROLE_PERMISSIONS
 *     (reachable only through getPermissions(), which has no callers)
 *   - yellowdot-frontend/src/config/permissions.js ROLE_PERMISSIONS
 *     (used only by the developer role switcher)
 * Both are compared against the authoritative map below, because a comment in
 * the frontend file claims the backend "mirrors these values".
 *
 * Backend sources are read as TEXT rather than imported: roleService.js is
 * CommonJS and requires firebaseAdmin at module load, which would try to
 * initialise a real Firebase app. The literals extracted here are plain data.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { extractLiteral } from "./verify-lib.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKEND   = join(__dirname, "../yellowdot-backend");
const BASELINE  = join(__dirname, "permissions-baseline.json");
const UPDATE    = process.argv.includes("--update-baseline");

const PASS = "✅", FAIL = "❌", WARN = "⚠️";
let failures = 0, warnings = 0;

const pass = (m, x = "") => console.log(`${PASS} ${m}${x ? `  →  ${x}` : ""}`);
const fail = (m, x = "") => { console.error(`${FAIL} ${m}${x ? `  →  ${x}` : ""}`); failures++; };
const warn = (m, x = "") => { console.log(`${WARN} ${m}${x ? `  →  ${x}` : ""}`); warnings++; };
const section = t => console.log(`\n── ${t} ${"─".repeat(Math.max(0, 62 - t.length))}`);

const sortUniq = arr => [...new Set(arr)].sort();

function run() {
  console.log("\n🔍 Permission resolution parity — PLATFORM_ARCHITECTURE §12 Phase 1");

  const roleSvcSrc = readFileSync(join(BACKEND, "services/roleService.js"), "utf8");
  const permBeSrc  = readFileSync(join(BACKEND, "config/permissionsBackend.js"), "utf8");

  const FINANCE_UI_ROUTE_KEYS = extractLiteral(roleSvcSrc, "const FINANCE_UI_ROUTE_KEYS =");
  const STATIC_ROLE_PERMS     = extractLiteral(roleSvcSrc, "const STATIC_ROLE_PERMS =", { FINANCE_UI_ROUTE_KEYS });
  const MODULE_ROUTE_MAP      = extractLiteral(roleSvcSrc, "const MODULE_ROUTE_MAP =");
  const SYSTEM_ROLES          = extractLiteral(roleSvcSrc, "const SYSTEM_ROLES =");

  const beFinanceKeys = extractLiteral(permBeSrc, "const FINANCE_UI_ROUTE_KEYS =");
  const BE_ROLE_PERMISSIONS = extractLiteral(permBeSrc, "const ROLE_PERMISSIONS =",
    { FINANCE_UI_ROUTE_KEYS: beFinanceKeys });

  // deriveRouteKeys, reimplemented exactly as roleService.js:135 defines it.
  const deriveRouteKeys = (permissions = {}) => {
    const keys = new Set(["profile"]);         // always granted
    for (const [moduleId, actions] of Object.entries(permissions)) {
      if (actions?.view) (MODULE_ROUTE_MAP[moduleId] || []).forEach(k => keys.add(k));
    }
    return [...keys];
  };

  const seedMatrixByRole = Object.fromEntries(SYSTEM_ROLES.map(r => [r.roleId, r.permissions || {}]));
  const ROLES = ["developer", "super_admin", "admin", "center_admin", "center_owner",
                 "teacher", "accountant", "reception", "parent"];

  // ── 0. Capability model — backward compatibility ───────────────────────────
  // canDo() switched from Boolean(matrix[m][a]) to the level resolver (§2c.1).
  // These assertions prove the two agree on every value shape stored today.
  section("0. Capability level model (§2c.1)");

  const cap = _capabilities;
  const cases = [
    // [matrix, capability, expectedLevel, expectedBoolean, note]
    [{ attendance: { view: true } },    "attendance.view", "all",  true,  "legacy true → all"],
    [{ attendance: { view: false } },   "attendance.view", "none", false, "legacy false → none"],
    [{ attendance: {} },                "attendance.view", "none", false, "missing action"],
    [{},                                "attendance.view", "none", false, "missing module"],
    [{ _bypass: true },                 "attendance.view", "all",  true,  "bypass grants all"],
    [{ staff_payroll: { view: "self" } }, "staff_payroll.view", "self", true, "self grants access"],
    [{ staff_payroll: { view: "team" } }, "staff_payroll.view", "team", true, "team grants access"],
    [{ staff_payroll: { view: "none" } }, "staff_payroll.view", "none", false,
      "string 'none' must be FALSE — Boolean('none') would have been true"],
    [{ staff_payroll: { view: "bogus" } }, "staff_payroll.view", "none", false, "unknown value fails closed"],
    [{ fees: { view: false, edit: true } }, "fees.*", "all", true, "wildcard takes strongest"],
  ];

  let modelFails = 0;
  for (const [matrix, capability, expLevel, expBool, note] of cases) {
    const gotLevel = cap.resolveLevel(matrix, capability);
    const gotBool  = cap.checkCapability(matrix, capability);
    if (gotLevel !== expLevel || gotBool !== expBool) {
      fail(`level model: ${note}`, `got ${gotLevel}/${gotBool}, expected ${expLevel}/${expBool}`);
      modelFails++;
    }
  }
  // Ordering: "all" must satisfy a "team" requirement, "self" must not.
  if (!cap.levelAtLeast("all", "team"))  { fail("level ordering: all should satisfy team"); modelFails++; }
  if (cap.levelAtLeast("self", "team"))  { fail("level ordering: self must not satisfy team"); modelFails++; }
  if (!modelFails) pass("Level model correct and backward compatible", `${cases.length} cases + ordering`);

  // ── 1. Effective permissions per role ──────────────────────────────────────
  section("1. Effective permissions per role (authoritative path)");

  const effective = {};
  for (const role of ROLES) {
    if (role === "developer" || role === "super_admin") { effective[role] = ["*"]; continue; }
    const derived  = deriveRouteKeys(seedMatrixByRole[role]);
    const baseline = STATIC_ROLE_PERMS[role] || [];
    effective[role] = sortUniq([...derived, ...baseline]);
  }
  for (const role of ROLES) {
    console.log(`   ${role.padEnd(13)} ${effective[role].length === 1 && effective[role][0] === "*"
      ? "* (bypass)" : `${effective[role].length} keys`}`);
  }

  // ── 2. Baseline drift ──────────────────────────────────────────────────────
  section("2. Baseline drift — did this change anyone's access?");

  if (UPDATE || !existsSync(BASELINE)) {
    writeFileSync(BASELINE, JSON.stringify(effective, null, 2) + "\n");
    warn(existsSync(BASELINE) && !UPDATE
      ? "Baseline created — commit permissions-baseline.json"
      : "Baseline WRITTEN. Review the diff in git before committing.");
  } else {
    const prev = JSON.parse(readFileSync(BASELINE, "utf8"));
    let drift = 0;
    for (const role of ROLES) {
      const before = new Set(prev[role] || []);
      const after  = new Set(effective[role] || []);
      const gained = [...after].filter(k => !before.has(k));
      const lost   = [...before].filter(k => !after.has(k));
      if (gained.length) { fail(`${role} GAINED access`, gained.join(", ")); drift++; }
      if (lost.length)   { fail(`${role} LOST access`,   lost.join(", ")); drift++; }
    }
    if (!drift) pass("No role gained or lost a single route key", `${ROLES.length} roles`);
  }

  // ── 3. UI requires vs. grantable ───────────────────────────────────────────
  // A routeKey that gates a real screen but that NO role can obtain is a
  // shipped-but-unreachable module.
  section("3. routeKeys the UI gates on but no role can obtain");

  const registry = requireRegistrySync();
  const uiKeys = new Set(
    registry.selectRoutes().map(r => r.routeKey).filter(Boolean)
  );

  const grantableAnywhere = new Set([
    ...Object.values(STATIC_ROLE_PERMS).flat(),
    ...Object.values(MODULE_ROUTE_MAP).flat(),
  ]);

  const known = new Set(registry.UNREACHABLE_ROUTEKEYS);
  const ungrantable = [...uiKeys].filter(k => !grantableAnywhere.has(k)).sort();
  let newUngrantable = 0, screensBlocked = 0;

  for (const k of ungrantable) {
    const routes = registry.selectRoutes().filter(r => r.routeKey === k).map(r => r.path);
    if (known.has(k)) { screensBlocked += routes.length; continue; }
    fail(`NEW: routeKey "${k}" gates ${routes.length} route(s) but no role can obtain it`,
         routes.slice(0, 3).join(", "));
    newUngrantable++;
  }
  if (!newUngrantable) {
    pass("No newly-unreachable routeKeys", `${uiKeys.size} keys checked`);
    warn(`KNOWN: ${ungrantable.length} routeKeys are unreachable for every non-bypass role`,
         `${screensBlocked} screens — see knownGaps.js UNREACHABLE_ROUTEKEYS`);
  }

  // ── 4. Per-role reachability of the shipped UI ─────────────────────────────
  section("4. Per-role: shipped screens the role cannot reach");

  for (const role of ["admin", "center_admin", "center_owner", "teacher", "accountant", "reception"]) {
    const have = new Set(effective[role]);
    const missing = [...uiKeys].filter(k => !have.has(k)).sort();
    // Not every role should reach every screen — this is informational, and
    // only flagged when a role is missing keys its OWN static baseline implies
    // it was meant to have (i.e. the three maps disagree).
    const beIntended = new Set(BE_ROLE_PERMISSIONS[role] || []);
    const intendedButMissing = missing.filter(k => beIntended.has(k));
    if (intendedButMissing.length) {
      warn(`${role}: ${intendedButMissing.length} keys granted in permissionsBackend but NOT resolvable`,
           intendedButMissing.slice(0, 6).join(", ") + (intendedButMissing.length > 6 ? " …" : ""));
    } else {
      pass(`${role}: no contradiction between the two backend maps`,
           `${missing.length} screens intentionally out of scope`);
    }
  }

  // ── 5. Three-copy divergence ───────────────────────────────────────────────
  section("5. Divergence across the three role→routeKey maps");

  // The three maps cannot be collapsed yet: permissionsBackend.ROLE_PERMISSIONS
  // is still a defensive fallback at authRoutes.js:57 and is read by
  // scripts/validatePhase1.js and two finance tests, and the frontend copy
  // drives the developer role switcher. Until the access diff is reviewed and
  // applied, the divergence is *evidence of intent* and must not be deleted.
  //
  // What we can do meanwhile is freeze it: this snapshot fails the build if the
  // duplication grows, so the problem cannot get worse while it waits.
  const divergence = {};
  for (const role of ROLES) {
    if (role === "developer" || role === "super_admin") continue;
    const authoritative = new Set(STATIC_ROLE_PERMS[role] || []);
    const mirrored      = new Set(BE_ROLE_PERMISSIONS[role] || []);
    divergence[role] = {
      onlyInMirror: [...mirrored].filter(k => !authoritative.has(k)).sort(),
      onlyInAuthoritative: [...authoritative].filter(k => !mirrored.has(k)).sort(),
    };
  }

  const DIV_FILE = join(__dirname, "permissions-divergence.json");
  if (UPDATE || !existsSync(DIV_FILE)) {
    writeFileSync(DIV_FILE, JSON.stringify(divergence, null, 2) + "\n");
    warn("Divergence snapshot written — review in git before committing");
  } else {
    const prev = JSON.parse(readFileSync(DIV_FILE, "utf8"));
    let grew = 0;
    for (const role of Object.keys(divergence)) {
      for (const side of ["onlyInMirror", "onlyInAuthoritative"]) {
        const before = new Set(prev[role]?.[side] || []);
        const added = divergence[role][side].filter(k => !before.has(k));
        if (added.length) {
          fail(`${role}.${side}: duplication GREW — the three maps drifted further apart`,
               added.join(", "));
          grew++;
        }
      }
    }
    if (!grew) {
      pass("Map duplication did not grow", "frozen until the access diff is applied");
      const total = Object.values(divergence)
        .reduce((n, d) => n + d.onlyInMirror.length + d.onlyInAuthoritative.length, 0);
      warn(`${total} keys still diverge across the three maps`,
           "see docs/platform-architecture/review/PHASE1_ACCESS_DIFF.md");
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  section("Summary");
  console.log(`   Roles checked   : ${ROLES.length}`);
  console.log(`   UI routeKeys    : ${uiKeys.size}`);
  console.log(`   Warnings        : ${warnings}`);

  if (failures) {
    console.error(`\n${FAIL} ${failures} failure(s).\n`);
    process.exit(1);
  }
  console.log(`\n${PASS} Permission resolution verified.\n`);
}

// The registry is ESM with extensionless-free imports, so a plain dynamic
// import works; it is loaded synchronously-ish via top-level await in main().
let _registry = null;
let _capabilities = null;
const requireRegistrySync = () => _registry;

const main = async () => {
  _registry     = await import("./src/platform/registry/index.js");
  _capabilities = await import("./src/platform/permissions/capabilities.js");
  run();
};

main().catch(err => {
  console.error(`\n${FAIL} verify-permissions crashed:\n`, err);
  process.exit(1);
});
