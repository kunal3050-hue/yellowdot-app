/**
 * verify-registry.mjs — Module Registry drift verification
 * ─────────────────────────────────────────────────────────────────────
 * PLATFORM ARCHITECTURE §12 Phase 0 — docs/platform-architecture/PLATFORM_ARCHITECTURE.md
 *
 * Usage: npm run verify:registry
 *
 * The registry (src/platform/registry) is DARK — nothing imports it yet. This
 * script is what makes that safe: it proves the registry describes the running
 * app EXACTLY, before any consumer depends on it. Every later phase that flips
 * a consumer over (routes, sidebar, grid) is mechanical only because this
 * passes first.
 *
 * Four comparisons:
 *   1. Routes  — registry vs the <Route> declarations in App.jsx
 *   2. Sidebar — registry vs SIDEBAR_GROUPS in config/sidebarConfig.js
 *   3. Grid    — registry vs SECTIONS in pages/quickNavigation/modules.js
 *   4. Orphans — nav targets pointing at paths that have no route at all
 *
 * sidebarConfig.js and modules.js are imported directly rather than parsed —
 * they are plain ESM data modules, so the comparison runs against the real
 * exported values and cannot drift from a regex's idea of them. App.jsx is JSX
 * and cannot be imported in Node, so its routes are extracted textually.
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const PASS = "✅";
const FAIL = "❌";
const WARN = "⚠️";

let failures = 0;
let warnings = 0;

function pass(msg, extra = "") { console.log(`${PASS} ${msg}${extra ? `  →  ${extra}` : ""}`); }
function fail(msg, extra = "") { console.error(`${FAIL} ${msg}${extra ? `  →  ${extra}` : ""}`); failures++; }
function warn(msg, extra = "") { console.log(`${WARN} ${msg}${extra ? `  →  ${extra}` : ""}`); warnings++; }
function section(title) {
  console.log(`\n── ${title} ${"─".repeat(Math.max(0, 62 - title.length))}`);
}

/** Report a set difference as individual failures, capped so output stays readable. */
function diff(label, expected, actual, { asWarning = false } = {}) {
  const missing = [...expected].filter(x => !actual.has(x));
  const extra   = [...actual].filter(x => !expected.has(x));
  const report  = asWarning ? warn : fail;

  if (!missing.length && !extra.length) {
    pass(`${label} — exact match`, `${expected.size} entries`);
    return true;
  }
  for (const m of missing.slice(0, 12)) report(`${label}: in app but MISSING from registry`, m);
  if (missing.length > 12) report(`${label}: …and ${missing.length - 12} more missing`);
  for (const e of extra.slice(0, 12)) report(`${label}: in registry but NOT in app`, e);
  if (extra.length > 12) report(`${label}: …and ${extra.length - 12} more extra`);
  return false;
}

// ── Extract routes from App.jsx ───────────────────────────────────────────────
function extractAppRoutes() {
  const src = readFileSync(join(__dirname, "src/App.jsx"), "utf8");
  const routes = [];
  // Split on <Route boundaries; within each fragment take the first path= and
  // routeKey= before the element closes. Route elements never nest here.
  for (const frag of src.split(/<Route\b/).slice(1)) {
    const end = frag.indexOf("/>");
    const seg = end > -1 ? frag.slice(0, end + 2) : frag.slice(0, 2000);
    const path = seg.match(/path="([^"]+)"/)?.[1];
    if (!path) continue;
    routes.push({ path, routeKey: seg.match(/routeKey="([^"]+)"/)?.[1] ?? null });
  }
  return routes;
}

async function run() {
  console.log("\n🔍 Module Registry drift verification — PLATFORM_ARCHITECTURE §12 Phase 0");

  const registry = await import("./src/platform/registry/index.js");
  const { SIDEBAR_GROUPS } = await import("./src/config/sidebarConfig.js");
  const { SECTIONS }       = await import("./src/pages/quickNavigation/modules.js");

  // ── 1. Routes ──────────────────────────────────────────────────────────────
  section("1. Routes — App.jsx vs registry");

  const appRoutes = extractAppRoutes();
  const regRoutes = registry.selectRoutes();

  const appPaths = new Set(appRoutes.map(r => r.path));
  const regPaths = new Set(regRoutes.map(r => r.path));
  diff("Route paths", appPaths, regPaths);

  // routeKey parity — the security-relevant half. A registry route claiming a
  // different routeKey than App.jsx enforces would silently change access when
  // routes are generated in Phase 7.
  const appByPath = new Map(appRoutes.map(r => [r.path, r.routeKey]));
  let keyMismatches = 0;
  for (const r of regRoutes) {
    if (!appByPath.has(r.path)) continue;
    const appKey = appByPath.get(r.path);
    const regKey = r.public ? null : (r.ungated ? null : r.routeKey);
    if (appKey !== regKey) {
      fail(`routeKey mismatch for ${r.path}`, `App.jsx="${appKey}" registry="${regKey}"`);
      keyMismatches++;
    }
  }
  if (!keyMismatches) pass("routeKey parity — every shared path agrees", `${regRoutes.length} routes`);

  // ── 2. Sidebar ─────────────────────────────────────────────────────────────
  section("2. Sidebar — sidebarConfig.js vs registry");

  const liveNav = new Set();
  for (const g of SIDEBAR_GROUPS) {
    for (const it of g.items) {
      if (!it.path) continue;   // dev role-switcher placeholder has no path
      liveNav.add(`${g.id} :: ${it.path} :: ${it.label}`);
    }
  }
  const regNav = new Set();
  for (const g of registry.selectNavGroups()) {
    for (const it of g.items) regNav.add(`${g.id} :: ${it.path} :: ${it.label}`);
  }
  diff("Sidebar items", liveNav, regNav);

  // Group ordering — the sidebar's group sequence is a product decision
  // (Safety & Compliance sits where it does deliberately), so drift here matters.
  const liveGroupOrder = SIDEBAR_GROUPS.filter(g => g.items.some(i => i.path)).map(g => g.id);
  const regGroupOrder  = registry.selectNavGroups().map(g => g.id);
  if (liveGroupOrder.join(",") === regGroupOrder.join(",")) {
    pass("Sidebar group order — identical", regGroupOrder.join(" → "));
  } else {
    fail("Sidebar group order differs");
    console.error(`     app:      ${liveGroupOrder.join(" → ")}`);
    console.error(`     registry: ${regGroupOrder.join(" → ")}`);
  }

  // ── 3. Control Center grid ─────────────────────────────────────────────────
  section("3. Control Center grid — modules.js vs registry");

  const liveGrid = new Set();
  for (const s of SECTIONS) {
    for (const it of s.items) liveGrid.add(`${s.id} :: ${it.path} :: ${it.label}`);
  }
  const regGrid = new Set();
  for (const s of registry.selectGridSections()) {
    for (const it of s.items) regGrid.add(`${s.id} :: ${it.path} :: ${it.label}`);
  }
  diff("Grid cards", liveGrid, regGrid);

  // ── 4. Orphaned navigation targets ─────────────────────────────────────────
  section("4. Orphaned navigation targets");

  const navTargets = new Map();   // path → [where it is linked from]
  for (const g of SIDEBAR_GROUPS) {
    for (const it of g.items) if (it.path) {
      navTargets.set(it.path, [...(navTargets.get(it.path) ?? []), `sidebar:${g.id}`]);
    }
  }
  const { PARENT_MENU } = await import("./src/config/sidebarConfig.js");
  for (const it of PARENT_MENU) {
    navTargets.set(it.path, [...(navTargets.get(it.path) ?? []), "sidebar:PARENT_MENU"]);
  }
  for (const s of SECTIONS) {
    for (const it of s.items) {
      navTargets.set(it.path, [...(navTargets.get(it.path) ?? []), `grid:${s.id}`]);
    }
  }

  // Parent-app routes live in their own file and are legitimately absent from App.jsx.
  const parentRoutesSrc = readFileSync(join(__dirname, "src/modules/parent/routes/parentRoutes.jsx"), "utf8");
  const parentPaths = new Set([...parentRoutesSrc.matchAll(/path="([^"]+)"/g)].map(m => m[1]));

  // Known orphans warn; anything NEW fails. A gate that is red from day one
  // gets ignored, so pre-existing defects are tracked in knownGaps.js instead
  // of blocking every future run.
  let newOrphans = 0;
  for (const [path, sources] of navTargets) {
    if (appPaths.has(path) || parentPaths.has(path)) continue;
    if (registry.KNOWN_ORPHAN_PATHS.has(path)) {
      warn(`Known orphan — "${path}" is linked but has NO route`, sources.join(", "));
      continue;
    }
    fail(`NEW ORPHAN — "${path}" is linked but has NO route`, sources.join(", "));
    newOrphans++;
  }
  if (!newOrphans) pass("No new orphaned nav targets", `${navTargets.size} targets checked`);

  // ── 5. Granted permissions with no route ───────────────────────────────────
  // Catches whole modules that are permission-granted and shipped but
  // unreachable — this is the check that found the Families module.
  section("5. Granted routeKeys with no route");

  const { ROLE_PERMISSIONS } = await import("./src/config/permissions.js");
  const grantedKeys = new Set(
    Object.values(ROLE_PERMISSIONS).flat().filter(k => k !== "*")
  );
  const routedKeys = new Set(appRoutes.map(r => r.routeKey).filter(Boolean));

  let unroutedNew = 0;
  let actionOnly = 0;
  for (const key of grantedKeys) {
    if (routedKeys.has(key)) continue;
    if (registry.ACTION_ONLY_ROUTEKEYS.has(key)) { actionOnly++; continue; }
    if (registry.KNOWN_ORPHAN_ROUTEKEYS.has(key)) {
      const gap = registry.KNOWN_ORPHANS.find(o => o.routeKey === key);
      warn(`Known gap [${gap.severity}] — routeKey "${key}" is granted but unroutable`, gap.summary);
      continue;
    }
    fail(`routeKey "${key}" is granted to a role but NO route declares it`);
    unroutedNew++;
  }
  if (!unroutedNew) {
    pass("No new unroutable permissions", `${grantedKeys.size} granted keys checked`);
    pass("Action-level keys correctly have no route", `${actionOnly} keys, all server-enforced`);
  }

  // ── Known gaps, informational ──────────────────────────────────────────────
  section("Known architectural gaps (informational)");

  warn("Permission modules mapped to zero routes (§0.3 gap 1)",
       registry.UNMAPPED_PERMISSION_MODULES.join(", "));
  for (const gap of registry.KNOWN_ORPHANS) {
    console.log(`     · [${gap.severity}] ${gap.id}: ${gap.summary}`);
    console.log(`       fix: ${gap.fix}`);
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  section("Summary");
  console.log(`   Modules registered : ${registry.MODULES.length}`);
  console.log(`   Routes registered  : ${regRoutes.length}   (App.jsx declares ${appRoutes.length})`);
  console.log(`   Sidebar items      : ${regNav.size}   (sidebarConfig has ${liveNav.size})`);
  console.log(`   Grid cards         : ${regGrid.size}   (modules.js has ${liveGrid.size})`);
  console.log(`   Warnings           : ${warnings}`);

  if (failures) {
    console.error(`\n${FAIL} REGISTRY DRIFT — ${failures} failure(s). The registry does not describe the app.\n`);
    process.exit(1);
  }
  console.log(`\n${PASS} Registry matches the application exactly. Safe to build consumers on it.\n`);
}

run().catch(err => {
  console.error(`\n${FAIL} verify-registry crashed:\n`, err);
  process.exit(1);
});
