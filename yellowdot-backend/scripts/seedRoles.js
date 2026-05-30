/**
 * seedRoles.js — One-time script to seed RBAC roles and assign super_admin
 *
 * Run from the yellowdot-backend directory:
 *   node scripts/seedRoles.js
 *
 * Requires:
 *   .env with GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json
 *   SCHOOL_ID=ydseawoods (or override below)
 */

require("dotenv").config();
require("../firebaseAdmin"); // initialises admin SDK

const { db, auth } = require("../firebaseAdmin");
const { seedDefaultRoles } = require("../services/roleService");

const SCHOOL_ID  = process.env.SCHOOL_ID  || "ydseawoods";
const CENTER_ID  = process.env.CENTER_ID  || "ydseawoods-main";
const ADMIN_EMAIL = "kunal3050@gmail.com";

const nowISO = () => new Date().toISOString();

// ── Extra roles not in roleService.js SYSTEM_ROLES ────────────────────────────
const EXTRA_ROLES = [
  {
    roleId:      "center_owner",
    name:        "Center Owner",
    description: "Business owner with full access across all centers",
    color:       "#7c3aed",
    isSystem:    true,
    homeRoute:   "/",
    permissions: {
      dashboard:         { view: true },
      students:          { view: true, create: true, edit: true, delete: true, export: true },
      admissions:        { view: true, create: true, edit: true, approve: true },
      attendance:        { view: true, mark: true, edit: true, export: true },
      nap_tracking:      { view: true, mark: true, edit: true },
      pickup_auth:       { view: true, create: true, edit: true, approve: true },
      medical:           { view: true, edit: true },
      food_menu:         { view: true, create: true, edit: true, delete: true },
      fees:              { view: true, create: true, edit: true, delete: true, approve: true },
      invoices:          { view: true, create: true, edit: true, delete: true, approve: true },
      payments:          { view: true, create: true, delete: true },
      receipts:          { view: true, create: true, export: true },
      analytics:         { view: true, export: true },
      staff:             { view: true, create: true, edit: true, delete: true },
      roles_permissions: { view: true, manage: true },
      settings:          { view: true, edit: true },
      notifications:     { view: true, create: true, manage: true },
      parent_app:        { view: true, manage: true },
      documents:         { view: true, create: true, delete: true, export: true },
      communications:    { view: true, create: true, edit: true, delete: true },
    },
  },
  {
    roleId:      "parent",
    name:        "Parent",
    description: "Parent/guardian with access to their child's records only",
    color:       "#db2777",
    isSystem:    true,
    homeRoute:   "/parent-home",
    permissions: {
      dashboard:   { view: true },
      fees:        { view: true },
      pickup_auth: { view: true },
      parent_app:  { view: true },
    },
  },
  {
    roleId:      "super_admin",
    name:        "Super Admin",
    description: "Platform-level administrator with unrestricted access to all features",
    color:       "#111827",
    isSystem:    true,
    homeRoute:   "/",
    // permissions left empty — bypass logic in authMiddleware grants everything
    permissions: {},
  },
];

// ── Seed extra roles if not present ──────────────────────────────────────────
async function seedExtraRoles() {
  const batch = db.batch();
  const now   = nowISO();
  const col   = db.collection("roles");
  let   count = 0;

  for (const r of EXTRA_ROLES) {
    const ref  = col.doc(r.roleId);
    const snap = await ref.get();
    if (!snap.exists) {
      batch.set(ref, {
        ...r,
        schoolId:     SCHOOL_ID,
        isActive:     true,
        centerAccess: [],
        classAccess:  [],
        usersCount:   0,
        createdAt:    now,
        updatedAt:    now,
        createdBy:    "seed-script",
        updatedBy:    "seed-script",
      });
      count++;
      console.log(`  ✓ Will create role: ${r.roleId}`);
    } else {
      console.log(`  – Role already exists, skipping: ${r.roleId}`);
    }
  }

  await batch.commit();
  console.log(`  Seeded ${count} extra role(s).`);
}

// ── Assign super_admin to the given email ─────────────────────────────────────
async function assignSuperAdmin(email) {
  console.log(`\nLooking up Firebase Auth user: ${email}`);
  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(email);
  } catch (err) {
    console.error(`  ✗ Could not find Firebase Auth user for ${email}:`, err.message);
    throw err;
  }

  const uid = userRecord.uid;
  console.log(`  Found UID: ${uid}`);

  const ref  = db.collection("users").doc(uid);
  const snap = await ref.get();
  const now  = nowISO();

  const doc = {
    userId:    uid,
    email,
    name:      userRecord.displayName || "Kunal Gudhka",
    role:      "super_admin",
    schoolId:  SCHOOL_ID,
    centerId:  CENTER_ID,
    center:    "Yellow Dot Sea Woods",
    centers:   [CENTER_ID],
    photoUrl:  userRecord.photoURL || "",
    phone:     userRecord.phoneNumber || "",
    status:    "active",
    updatedAt: now,
    updatedBy: "seed-script",
    ...(snap.exists ? {} : { createdAt: now, createdBy: "seed-script" }),
  };

  await ref.set(doc, { merge: true });
  console.log(`  ✓ users/${uid} set with role=super_admin`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  Yellow Dot — RBAC Role Seeder");
  console.log("  School ID :", SCHOOL_ID);
  console.log("═══════════════════════════════════════════\n");

  // 1. Seed the 6 built-in system roles via roleService
  console.log("Step 1 — Seeding system roles (admin, center_admin, teacher, accountant, reception)…");
  await seedDefaultRoles(SCHOOL_ID);
  console.log("  Done.\n");

  // 2. Seed extra roles (center_owner, parent, super_admin)
  console.log("Step 2 — Seeding extra roles (center_owner, parent, super_admin)…");
  await seedExtraRoles();
  console.log();

  // 3. Assign super_admin to kunal3050@gmail.com
  console.log("Step 3 — Assigning super_admin to", ADMIN_EMAIL, "…");
  await assignSuperAdmin(ADMIN_EMAIL);

  console.log("\n✅  All done! RBAC seed complete.");
  process.exit(0);
}

main().catch(err => {
  console.error("\n✗ Seed failed:", err);
  process.exit(1);
});
