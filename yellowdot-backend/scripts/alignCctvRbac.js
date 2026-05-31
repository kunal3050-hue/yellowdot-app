/**
 * alignCctvRbac.js — one-off: align live role docs to CCTV V2 Phase 1 RBAC
 * ─────────────────────────────────────────────────────────────────────────────
 * The CCTV V1 removal deleted code but not Firestore role data, and the
 * create-only seeder cannot fix existing role docs. This script makes
 * ONLY CCTV-related corrections, leaving every other permission untouched.
 *
 * Target state (Phase 1 — manage = admin-tier only):
 *   admin         cctv: { view:true,  manage:true  }
 *   center_admin  cctv: { view:true,  manage:true  }   (was manage:false)
 *   center_owner  cctv: { view:true,  manage:true  }
 *   super_admin   cctv: { view:true,  manage:true  }   (was MISSING; wildcard anyway)
 *   teacher       cctv removed (no access)
 *   accountant    cctv removed (no access)
 *   reception     cctv removed (no access)
 *   parent        cctv removed (LEAK fix — parents must not get CCTV)
 *   cctv_viewer   ghost V1 role → isActive:false + cctv removed (kept for audit,
 *                 not hard-deleted; no users should reference it)
 *
 * SAFETY:
 *   • Dry-run by default (prints planned diff, writes nothing).
 *   • Pass --confirm to apply.
 *   • Uses field-level updates — never overwrites whole permission maps.
 *   • Only ever touches `permissions.cctv` (+ isActive for the ghost role).
 *
 * Usage (from yellowdot-backend/):
 *   node scripts/alignCctvRbac.js            # dry run
 *   node scripts/alignCctvRbac.js --confirm  # apply
 */

require("dotenv").config();
const fs   = require("fs");
const path = require("path");
const { db } = require("../firebaseAdmin");
const admin = require("firebase-admin");

const SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";
const CONFIRM   = process.argv.includes("--confirm");

// roleId → desired cctv permission, or null to REMOVE the cctv key entirely.
const TARGET = {
  admin:        { view: true, manage: true },
  center_admin: { view: true, manage: true },
  center_owner: { view: true, manage: true },
  super_admin:  { view: true, manage: true },
  teacher:      null,
  accountant:   null,
  reception:    null,
  parent:       null,
};

function sameCctv(a, b) {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return a.view === b.view && a.manage === b.manage;
}

async function run() {
  console.log("═══════════════════════════════════════════════");
  console.log("  CCTV V2 Phase 1 — RBAC alignment");
  console.log("  School:", SCHOOL_ID, "| Mode:", CONFIRM ? "APPLY" : "DRY RUN");
  console.log("═══════════════════════════════════════════════\n");

  const snap = await db.collection("roles").where("schoolId", "==", SCHOOL_ID).get();
  if (snap.empty) { console.log("No role docs found. Nothing to do."); process.exit(0); }

  const plan = [];

  for (const doc of snap.docs) {
    const roleId = doc.id;
    const data   = doc.data() || {};
    const perms  = data.permissions || {};
    const cur    = perms.cctv || null;

    // Ghost V1 role — deactivate + strip cctv.
    if (roleId === "cctv_viewer") {
      const needsDeactivate = data.isActive !== false;
      const needsStrip = cur != null;
      if (needsDeactivate || needsStrip) {
        plan.push({ roleId, action: "ghost", cur, deactivate: needsDeactivate, strip: needsStrip });
      }
      continue;
    }

    if (!(roleId in TARGET)) continue; // custom/unknown role — leave untouched
    const want = TARGET[roleId];

    if (want === null) {
      if (cur != null) plan.push({ roleId, action: "remove", cur });
    } else {
      if (!sameCctv(cur, want)) plan.push({ roleId, action: "set", cur, want });
    }
  }

  if (plan.length === 0) {
    console.log("✓ All role docs already aligned. No changes needed.");
    process.exit(0);
  }

  console.log("Planned changes:");
  plan.forEach(p => {
    if (p.action === "set")    console.log(`  SET    ${p.roleId.padEnd(14)} cctv: ${JSON.stringify(p.cur)} -> ${JSON.stringify(p.want)}`);
    if (p.action === "remove") console.log(`  REMOVE ${p.roleId.padEnd(14)} cctv: ${JSON.stringify(p.cur)} -> (deleted)`);
    if (p.action === "ghost")  console.log(`  GHOST  ${p.roleId.padEnd(14)} isActive->false${p.strip ? ", cctv removed" : ""}`);
  });
  console.log("");

  if (!CONFIRM) {
    console.log("DRY RUN — nothing written. Re-run with --confirm to apply.");
    process.exit(0);
  }

  // ── Backup: full before-images of every affected role doc ────────────
  const stamp   = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(__dirname, "..", "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const backupFile = path.join(backupDir, `roles-backup-${SCHOOL_ID}-${stamp}.json`);
  const beforeMap = {};
  plan.forEach(p => {
    const d = snap.docs.find(x => x.id === p.roleId);
    beforeMap[p.roleId] = d ? d.data() : null;
  });
  fs.writeFileSync(backupFile, JSON.stringify({ schoolId: SCHOOL_ID, takenAt: new Date().toISOString(), roles: beforeMap }, null, 2));
  console.log("Backup written:", backupFile, "\n");

  const now = new Date().toISOString();
  for (const p of plan) {
    const ref = db.collection("roles").doc(p.roleId);
    if (p.action === "set") {
      await ref.update({ "permissions.cctv": p.want, updatedAt: now, updatedBy: "cctv-rbac-align" });
    } else if (p.action === "remove") {
      await ref.update({ "permissions.cctv": admin.firestore.FieldValue.delete(), updatedAt: now, updatedBy: "cctv-rbac-align" });
    } else if (p.action === "ghost") {
      const upd = { isActive: false, updatedAt: now, updatedBy: "cctv-rbac-align" };
      if (p.strip) upd["permissions.cctv"] = admin.firestore.FieldValue.delete();
      await ref.update(upd);
    }
    // Re-read for an authoritative after-image of cctv.
    const after = (await ref.get()).data() || {};
    const afterCctv = after.permissions && after.permissions.cctv ? JSON.stringify(after.permissions.cctv) : "(none)";
    console.log(`  ✓ ${p.action.padEnd(6)} ${p.roleId.padEnd(14)} cctv before=${JSON.stringify(p.cur)} after=${afterCctv}` +
      (p.action === "ghost" ? `  isActive=${after.isActive}` : ""));
  }

  console.log("\n✅ Done. Applied", plan.length, "change(s).");
  process.exit(0);
}

run().catch(e => { console.error("✗ Failed:", e.message); process.exit(1); });
