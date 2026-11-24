/**
 * grantBillingRbac.js — one-off: grant the Billing module on existing role docs
 * ─────────────────────────────────────────────────────────────────────────────
 * The Billing & Payments module (#96) added `billing` to
 * roleService.SYSTEM_ROLES, but `seedDefaultRoles()` is CREATE-ONLY — it writes
 * a role document only when one does not already exist, and never adds a newly
 * introduced module to a role that is already there. So on any school seeded
 * before #96, every role document is missing `permissions.billing`, the backend
 * cannot derive the `billing` routeKey for it, and the module is invisible to
 * every non-bypass account no matter what the code says.
 *
 * Developer and super_admin are unaffected either way: `can()` short-circuits
 * to true for bypass roles, so they could already see Billing — which is the
 * only reason the gap is visible at all rather than silent.
 *
 * ── Where the grants come from ────────────────────────────────────────────────
 * Read directly out of roleService.SYSTEM_ROLES rather than restated here. The
 * seeder and this script therefore cannot disagree about what a role should
 * hold: change the tier in one place and both follow. scripts/alignCctvRbac.js,
 * which this is otherwise modelled on, hardcodes its own target table — fine
 * for a one-off correction, but a second copy of the tiers is exactly the kind
 * of duplication that drifts.
 *
 * At the time of writing that yields:
 *   admin / center_owner / center_admin   view, create, edit, delete
 *   accountant                            view, create, edit      (no delete)
 *   reception                             view, create            (desk only)
 *   teacher / parent                      nothing — not granted
 *
 * "delete" is the REVERSAL tier, not a row delete: nothing in Billing is ever
 * hard-deleted. It gates voiding an invoice, crediting one, reversing a
 * payment, reading the audit trail and changing the payee — which is why the
 * accountant holds every other action but not that one.
 *
 * ── Safety ────────────────────────────────────────────────────────────────────
 *   • Dry run by default. `--confirm` applies.
 *   • ADDITIVE ONLY. A role that already carries a `billing` key is left
 *     exactly as it is and reported as skipped — somebody configured it
 *     deliberately in Roles & Permissions and their intent outranks this
 *     script's defaults. Nothing here ever removes or downgrades a permission.
 *   • Field-level writes (`permissions.billing`), so no other module's
 *     permissions can be clobbered by a whole-map overwrite.
 *   • Full before-images of every affected role document are written to
 *     backups/ before the first write.
 *   • Roles not named in SYSTEM_ROLES (a school's own custom roles) are never
 *     touched.
 *
 * ── Usage (from yellowdot-backend/) ───────────────────────────────────────────
 *   node scripts/grantBillingRbac.js                     # dry run
 *   node scripts/grantBillingRbac.js --confirm           # apply
 *   SCHOOL_ID=other-school node scripts/grantBillingRbac.js --confirm
 *
 * Re-running after a successful apply is a no-op: every role then has a
 * `billing` key and is skipped.
 */

require("dotenv").config();
const fs   = require("fs");
const path = require("path");
const { db }  = require("../firebaseAdmin");
const roleSvc = require("../services/roleService");

const SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";
const CONFIRM   = process.argv.includes("--confirm");
const MODULE    = "billing";
const ACTOR     = "billing-rbac-grant";

/**
 * roleId → the billing permission that role should hold, taken from the same
 * SYSTEM_ROLES the seeder uses. Roles whose SYSTEM_ROLES entry has no billing
 * key (teacher, and anything else added later) are deliberately absent here,
 * so they are never granted.
 */
function desiredGrants() {
  const out = {};
  for (const role of roleSvc.SYSTEM_ROLES) {
    const want = role.permissions && role.permissions[MODULE];
    if (want) out[role.roleId] = want;
  }
  return out;
}

function fmt(v) {
  if (v == null) return "(none)";
  return Object.entries(v)
    .filter(([, on]) => on)
    .map(([k]) => k)
    .join("+") || "(no actions)";
}

async function run() {
  const TARGET = desiredGrants();

  console.log("═══════════════════════════════════════════════════════");
  console.log("  Billing & Payments — grant on existing role documents");
  console.log("  School:", SCHOOL_ID, "| Mode:", CONFIRM ? "APPLY" : "DRY RUN");
  console.log("═══════════════════════════════════════════════════════\n");

  if (Object.keys(TARGET).length === 0) {
    console.log("✗ No role in SYSTEM_ROLES grants `" + MODULE + "`. Nothing this script can do.");
    console.log("  That almost certainly means this script is running against a build");
    console.log("  from before the Billing module landed.");
    process.exit(1);
  }

  console.log("Grants defined in roleService.SYSTEM_ROLES:");
  for (const [roleId, want] of Object.entries(TARGET)) {
    console.log(`  ${roleId.padEnd(14)} ${fmt(want)}`);
  }
  console.log("");

  const snap = await db.collection("roles").where("schoolId", "==", SCHOOL_ID).get();
  if (snap.empty) {
    console.log("No role documents found for this school. Nothing to do.");
    console.log("(A school with no role docs is served by seedDefaultRoles, not by this script.)");
    process.exit(0);
  }

  const plan = [];
  const skipped = [];
  const untouched = [];

  for (const doc of snap.docs) {
    const roleId = doc.id;
    const perms  = (doc.data() || {}).permissions || {};

    if (!(roleId in TARGET)) {
      untouched.push(roleId);          // custom role, or one with no billing tier
      continue;
    }

    if (MODULE in perms) {
      skipped.push({ roleId, cur: perms[MODULE] });   // already configured — leave it
      continue;
    }

    plan.push({ roleId, want: TARGET[roleId] });
  }

  if (skipped.length) {
    console.log("Already configured — left exactly as they are:");
    skipped.forEach(s => console.log(`  SKIP   ${s.roleId.padEnd(14)} billing: ${fmt(s.cur)}`));
    console.log("");
  }

  if (untouched.length) {
    console.log(`Not granted (no billing tier, or a custom role): ${untouched.join(", ")}\n`);
  }

  if (plan.length === 0) {
    console.log("✓ Every role that should hold billing already has it. No changes needed.");
    process.exit(0);
  }

  console.log("Planned changes:");
  plan.forEach(p => console.log(`  GRANT  ${p.roleId.padEnd(14)} billing: (none) -> ${fmt(p.want)}`));
  console.log("");

  if (!CONFIRM) {
    console.log("DRY RUN — nothing written. Re-run with --confirm to apply.");
    process.exit(0);
  }

  // ── Backup before the first write ───────────────────────────────────────────
  const stamp     = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(__dirname, "..", "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const backupFile = path.join(backupDir, `roles-backup-billing-${SCHOOL_ID}-${stamp}.json`);

  const beforeMap = {};
  plan.forEach(p => {
    const d = snap.docs.find(x => x.id === p.roleId);
    beforeMap[p.roleId] = d ? d.data() : null;
  });
  fs.writeFileSync(backupFile, JSON.stringify({
    schoolId: SCHOOL_ID, module: MODULE,
    takenAt: new Date().toISOString(), roles: beforeMap,
  }, null, 2));
  console.log("Backup written:", backupFile, "\n");

  const now = new Date().toISOString();
  for (const p of plan) {
    const ref = db.collection("roles").doc(p.roleId);
    await ref.update({
      [`permissions.${MODULE}`]: p.want,
      updatedAt: now,
      updatedBy: ACTOR,
    });

    // Re-read, so what is reported is what the database actually holds.
    const after = (await ref.get()).data() || {};
    console.log(`  ✓ GRANT ${p.roleId.padEnd(14)} billing: ${fmt((after.permissions || {})[MODULE])}`);
  }

  console.log("\n✅ Done. Granted billing on", plan.length, "role(s).");

  // roleService caches each role's matrix for 60s, in the BACKEND's process.
  // This script runs in its own process, so calling invalidateCache() here
  // would clear a cache nobody reads — the grant simply becomes visible once
  // the server's own entry expires. Worth saying plainly rather than leaving
  // someone to wonder why the sidebar has not changed yet.
  console.log("   The backend caches each role matrix for 60s, so allow a minute");
  console.log("   before checking; signed-in staff also need a token refresh.");
  process.exit(0);
}

run().catch(e => { console.error("✗ Failed:", e.message); process.exit(1); });
