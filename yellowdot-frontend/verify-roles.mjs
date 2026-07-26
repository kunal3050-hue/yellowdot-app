/**
 * verify-roles.mjs — per-role Staff experience matrix
 * ─────────────────────────────────────────────────────────────────────
 * PLATFORM ARCHITECTURE §12 Phase 9 — integration validation item 3
 *
 * Usage: npm run verify:roles
 *
 * Answers, for every staff role: which widgets, which task providers and which
 * Care modules resolve — by running the REAL resolvers (widgets/resolve.js,
 * tasks/resolve.js) against the REAL capability model and the REAL seeded role
 * matrices from the backend.
 *
 * This is deliberately not a substitute for live-backend testing: it validates
 * VISIBILITY (who sees what), not DATA (whether the numbers are right). Those
 * are different failure modes and need different checks — visibility is
 * deterministic and provable here, data correctness is not.
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { extractLiteral, makeReporter } from "./verify-lib.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKEND = join(__dirname, "../yellowdot-backend");
const { pass, fail, warn, section, state } = makeReporter();

// Frontend-facing labels → actual backend role ids.
// "Principal" has never been a real backend role; it maps to `admin`.
const ROLES = [
  { label: "Teacher",      id: "teacher" },
  { label: "Reception",    id: "reception" },
  { label: "Accountant",   id: "accountant" },
  { label: "Principal",    id: "admin",        note: "Principal → admin (no distinct backend role)" },
  { label: "Centre Owner", id: "center_owner" },
  { label: "Super Admin",  id: "super_admin",  bypass: true },
];

async function run() {
  console.log("\n🔍 Per-role Staff experience — PLATFORM_ARCHITECTURE §12 integration item 3");

  const caps       = await import("./src/platform/permissions/capabilities.js");
  const { resolveWidgets }                      = await import("./src/platform/widgets/resolve.js");
  const { resolveProviders, resolveCareModules } = await import("./src/platform/tasks/resolve.js");

  // Seeded role matrices — the same documents getRoleMatrix() serves.
  const roleSrc = readFileSync(join(BACKEND, "services/roleService.js"), "utf8");
  const SYSTEM_ROLES = extractLiteral(roleSrc, "const SYSTEM_ROLES =");
  const matrixByRole = Object.fromEntries(SYSTEM_ROLES.map(r => [r.roleId, r.permissions || {}]));

  // Frontend build-time flags, evaluated for production (the tier that matters).
  const flagsSrc = readFileSync(join(__dirname, "src/config/featureFlags.js"), "utf8");
  const FLAGS = extractLiteral(flagsSrc, "export const FLAGS =", { isPreProduction: false });
  const isEnabled = flag => Boolean(FLAGS[flag]);

  // ── 1. The matrix ──────────────────────────────────────────────────────────
  section("1. What each role sees (production flags)");

  const results = {};
  for (const role of ROLES) {
    const matrix = role.bypass ? { _bypass: true } : (matrixByRole[role.id] || {});
    const can = cap => (role.bypass ? true : caps.checkCapability(matrix, cap));

    const widgets  = resolveWidgets({ can, isEnabled, role: role.id }).map(w => w.id);
    const tasks    = resolveProviders({ can, isEnabled }).map(p => p.id);
    const modules  = resolveCareModules({ can, isEnabled, role: role.id }).map(m => m.label);

    results[role.label] = { widgets, tasks, modules, seeded: Boolean(matrixByRole[role.id]) };

    console.log(`\n   ${role.label}${role.note ? `  (${role.note})` : ""}`);
    console.log(`     widgets  (${widgets.length}): ${widgets.join(", ") || "—"}`);
    console.log(`     tasks    (${tasks.length}): ${tasks.join(", ") || "—"}`);
    console.log(`     modules  (${modules.length}): ${modules.join(", ") || "—"}`);
  }

  // ── 2. Discrepancies ───────────────────────────────────────────────────────
  section("2. Discrepancies");

  // A staff role with NOTHING is almost certainly a resolution bug, not a
  // product decision — it would render an empty Dashboard and an empty Care.
  const gaps = await import("./src/platform/registry/knownGaps.js");
  const knownEmpty = new Set(gaps.ROLES_WITHOUT_MATRIX);

  for (const role of ROLES) {
    const r = results[role.label];
    if (r.widgets.length || r.tasks.length || r.modules.length) continue;
    // Known and documented → warn. Anything NEW is a blocker.
    if (knownEmpty.has(role.id)) {
      warn(`${role.label} sees NOTHING on Dashboard or Care`,
           "no seeded role document — see knownGaps.ROLES_WITHOUT_MATRIX");
    } else {
      fail(`${role.label} sees NOTHING on Dashboard or Care`, "empty experience");
    }
  }

  // Roles the backend never seeds have no matrix, so every capability check
  // fails and the surfaces come up blank for real users of that role.
  for (const role of ROLES) {
    if (role.bypass) continue;
    if (!matrixByRole[role.id]) {
      warn(`${role.label} ("${role.id}") has NO seeded role document`,
           "capabilities resolve empty until a role doc exists");
    }
  }

  // Every widget/provider should be reachable by at least one role — an
  // unreachable one is dead code that will never render for anyone.
  const allW = new Set(Object.values(results).flatMap(r => r.widgets));
  const allT = new Set(Object.values(results).flatMap(r => r.tasks));
  const { WIDGETS }  = await import("./src/platform/widgets/resolve.js");
  const { PROVIDERS } = await import("./src/platform/tasks/resolve.js");

  for (const w of WIDGETS) {
    if (!allW.has(w.id)) fail(`widget "${w.id}" is visible to NO role`, `capability ${w.capability}`);
  }
  for (const p of PROVIDERS) {
    if (!allT.has(p.id)) fail(`task provider "${p.id}" is visible to NO role`, `capability ${p.capability}`);
  }

  // Visible ONLY to bypass roles is nearly as bad as visible to none: no real
  // staff member ever sees it, but it looks fine when tested as a developer —
  // the exact blind spot that hid the unreachable-modules defect.
  const realStaff = ROLES.filter(r => !r.bypass).map(r => results[r.label]);
  const seenByRealStaffW = new Set(realStaff.flatMap(r => r.widgets));
  const seenByRealStaffT = new Set(realStaff.flatMap(r => r.tasks));
  for (const w of WIDGETS) {
    if (allW.has(w.id) && !seenByRealStaffW.has(w.id)) {
      warn(`widget "${w.id}" is visible ONLY to bypass roles`,
           `no real staff role holds ${w.capability}`);
    }
  }
  for (const p of PROVIDERS) {
    if (allT.has(p.id) && !seenByRealStaffT.has(p.id)) {
      warn(`task provider "${p.id}" is visible ONLY to bypass roles`,
           `no real staff role holds ${p.capability}`);
    }
  }

  // Non-bypass roles must never resolve the full set — that would mean the
  // capability gate is not actually gating.
  const nonBypass = ROLES.filter(r => !r.bypass).map(r => results[r.label]);
  if (nonBypass.every(r => r.widgets.length === WIDGETS.length)) {
    fail("every non-bypass role sees every widget", "capability gate is not gating");
  }

  if (!state.failures) pass("No blocking discrepancies", `${ROLES.length} roles checked`);

  // ── 3. Scope of this check ─────────────────────────────────────────────────
  section("3. What this does NOT prove");
  warn("Visibility only", "widget VALUES and task CONTENT need a live backend");

  section("Summary");
  console.log(`   Roles          : ${ROLES.length}`);
  console.log(`   Widgets        : ${WIDGETS.length}`);
  console.log(`   Task providers : ${PROVIDERS.length}`);

  if (state.failures) {
    console.error(`\n❌ ${state.failures} failure(s).\n`);
    process.exit(1);
  }
  console.log(`\n✅ Per-role visibility verified.\n`);
}

run().catch(err => {
  console.error("\n❌ verify-roles crashed:\n", err);
  process.exit(1);
});
