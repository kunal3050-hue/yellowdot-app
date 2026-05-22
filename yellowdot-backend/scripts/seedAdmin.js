/**
 * seedAdmin.js — Bootstrap the ydseawoods admin user
 *
 * Creates a Firebase Auth account + Firestore users/{uid} document.
 * Safe to re-run: existing Auth accounts and Firestore docs are updated
 * in-place rather than duplicated.
 *
 * Usage:
 *   node scripts/seedAdmin.js
 *
 * Required env vars (set in .env):
 *   GOOGLE_APPLICATION_CREDENTIALS  — path to serviceAccountKey.json
 *   SCHOOL_ID                       — defaults to "ydseawoods"
 */

require("dotenv").config();

const { admin, db, auth } = require("../firebaseAdmin");

// ── Seed config ────────────────────────────────────────────────────
const SCHOOL_ID = process.env.SCHOOL_ID || "ydseawoods";
const CENTER_ID = "ydseawoods-main";

const SEED = {
  email:    "admin@ydseawoods.com",
  password: "YDAdmin2025!",
  name:     "School Admin",
  role:     "admin",
};

// ── Helpers ────────────────────────────────────────────────────────

function nowISO() {
  return new Date().toISOString();
}

async function getOrCreateAuthUser(email, password, displayName) {
  try {
    const existing = await auth.getUserByEmail(email);
    console.log("  Firebase Auth  : account already exists, updating display name");
    await auth.updateUser(existing.uid, { displayName });
    return { uid: existing.uid, created: false };
  } catch (err) {
    if (err.code !== "auth/user-not-found") throw err;
    const newUser = await auth.createUser({ email, password, displayName });
    console.log("  Firebase Auth  : account created");
    return { uid: newUser.uid, created: true };
  }
}

async function upsertFirestoreDoc(uid) {
  const ref  = db.collection("users").doc(uid);
  const snap = await ref.get();
  const now  = nowISO();

  const doc = {
    userId:    uid,
    email:     SEED.email,
    name:      SEED.name,
    role:      SEED.role,
    schoolId:  SCHOOL_ID,
    centerId:  CENTER_ID,
    center:    CENTER_ID,
    centers:   [CENTER_ID],
    photoUrl:  "",
    phone:     "",
    status:    "active",
    updatedAt: now,
    updatedBy: "seed-script",
    ...(snap.exists ? {} : { createdAt: now, createdBy: "seed-script" }),
  };

  await ref.set(doc, { merge: true });
  return { existed: snap.exists };
}

// ── Main ───────────────────────────────────────────────────────────

async function run() {
  console.log("\n🌱  Yellow Dot — Admin Seed Script");
  console.log("    schoolId  :", SCHOOL_ID);
  console.log("    email     :", SEED.email);
  console.log("    role      :", SEED.role);
  console.log("    centerId  :", CENTER_ID);
  console.log("");

  // 1. Firebase Auth
  const { uid, created: authCreated } = await getOrCreateAuthUser(
    SEED.email,
    SEED.password,
    SEED.name
  );
  console.log("  Auth UID       :", uid);

  // 2. Firestore
  const { existed } = await upsertFirestoreDoc(uid);
  console.log("  Firestore doc  :", existed ? "updated" : "created");

  // 3. Summary
  console.log("\n✅  Done.");
  console.log("    Email    :", SEED.email);
  console.log("    Password :", SEED.password);
  console.log("    Role     :", SEED.role);
  if (authCreated) {
    console.log("\n    ⚠️   Change the password after first login.");
  }

  process.exit(0);
}

run().catch(err => {
  console.error("\n❌  Seed failed:", err.code || "", err.message);
  process.exit(1);
});
