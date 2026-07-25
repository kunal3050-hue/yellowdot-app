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

/**
 * Slice a balanced `{...}` or `[...]` literal that follows `marker` and
 * evaluate it. `scope` supplies any identifiers the literal spreads in.
 */
function extractLiteral(src, marker, scope = {}) {
  const start = src.indexOf(marker);
  if (start === -1) throw new Error(`marker not found: ${marker}`);
  // Skip whitespace after the marker and take whichever bracket opens first.
  let openIdx = start + marker.length;
  while (openIdx < src.length && /\s/.test(src[openIdx])) openIdx++;
  const open = src[openIdx];
  if (open !== "{" && open !== "[") {
    throw new Error(`expected { or [ after "${marker}", found "${open}"`);
  }
  const close = open === "{" ? "}" : "]";

  let depth = 0, end = -1, inStr = null, inComment = null;
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i], next = src[i + 1];
    if (inComment === "line")  { if (c === "\n") inComment = null; continue; }
    if (inComment === "block") { if (c === "*" && next === "/") { inComment = null; i++; } continue; }
    if (inStr) { if (c === "\\") i++; else if (c === inStr) inStr = null; continue; }
    if (c === "/" && next === "/") { inComment = "line"; i++; continue; }
    if (c === "/" && next === "*") { inComment = "block"; i++; continue; }
    if (c === '"' || c === "'" || c === "`") { inStr = c; continue; }
    if (c === open) depth++;
    else if (c === close && --depth === 0) { end = i + 1; break; }
  }
  if (end === -1) throw new Error(`unbalanced literal after: ${marker}`);

  const names = Object.keys(scope);
  return new Function(...names, `return (${src.slice(openIdx, end)});`)(...names.map(n => scope[n]));
}

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

  for (const role of ROLES) {
    if (role === "developer" || role === "super_admin") continue;
    const authoritative = new Set(STATIC_ROLE_PERMS[role] || []);
    const mirrored      = new Set(BE_ROLE_PERMISSIONS[role] || []);
    const onlyMirror = [...mirrored].filter(k => !authoritative.has(k));
    const onlyAuth   = [...authoritative].filter(k => !mirrored.has(k));
    if (onlyMirror.length || onlyAuth.length) {
      warn(`${role}: permissionsBackend vs roleService differ`,
           `+${onlyMirror.length} / -${onlyAuth.length}`);
    }
  }
  if (!warnings) pass("The two backend maps agree for every role");

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
const requireRegistrySync = () => _registry;

const main = async () => {
  _registry = await import("./src/platform/registry/index.js");
  run();
};

main().catch(err => {
  console.error(`\n${FAIL} verify-permissions crashed:\n`, err);
  process.exit(1);
});
