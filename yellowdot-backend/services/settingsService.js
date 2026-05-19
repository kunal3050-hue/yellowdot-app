/**
 * settingsService.js — Firestore-backed Settings & User management
 * ─────────────────────────────────────────────────────────────────
 * Settings:  one Firestore doc per section  →  settings/{section}
 * Users:     users/{uid}  (Firebase Auth uid as doc ID)
 *
 * NOTE: Full user CRUD is handled by userService.js.
 *       This service provides the legacy Settings panel helpers only.
 */

const { db } = require("../firebaseAdmin");

const SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";

function nowISO() { return new Date().toISOString(); }

// ── Settings ───────────────────────────────────────────────────────

/**
 * Load all settings.
 * @returns {{ [section: string]: { [key: string]: string } }}
 */
async function getAllSettings() {
  const snap = await db.collection("settings").get();
  const out  = {};
  snap.docs.forEach(doc => { out[doc.id] = doc.data() || {}; });
  return out;
}

/**
 * Save one section of settings (merge/upsert).
 * @param {string} section
 * @param {{ [key: string]: string }} data
 */
async function saveSection(section, data) {
  await db.collection("settings").doc(section).set(
    { ...data, updatedAt: nowISO() },
    { merge: true }
  );
  console.log(`[settings-svc] Saved section '${section}'.`);
}

// ── Users ──────────────────────────────────────────────────────────

/** Return all staff users for a given school (no password fields). */
async function getUsers({ schoolId = SCHOOL_ID } = {}) {
  const snap = await db.collection("users").where("schoolId", "==", schoolId).get();
  const users = snap.docs.map(doc => {
    const d = doc.data();
    return {
      userId:    doc.id,
      name:      d.name      || "",
      email:     d.email     || "",
      mobile:    d.mobile    || "",
      role:      d.role      || "teacher",
      centerId:  d.centerId  || d.center || "",
      center:    d.centerId  || d.center || "",
      status:    d.status    || "active",
      photoUrl:  d.photoUrl  || "",
      schoolId:  d.schoolId  || schoolId,
    };
  });
  // Sort by name in JS (avoids composite index)
  users.sort((a, b) => a.name.localeCompare(b.name));
  return users;
}

/**
 * Update role and/or status for a user.
 * @param {string} userId  — Firebase Auth uid (Firestore doc ID)
 * @param {{ role?: string, status?: string }} updates
 * @param {{ updatedBy?: string }} opts
 */
async function updateUser(userId, updates, { updatedBy = "system" } = {}) {
  const ref  = db.collection("users").doc(userId);
  const snap = await ref.get();
  if (!snap.exists) return null;

  const allowed = { updatedAt: nowISO(), updatedBy };
  if (updates.role   !== undefined) allowed.role   = updates.role;
  if (updates.status !== undefined) allowed.status = updates.status;

  await ref.update(allowed);
  const updated = await ref.get();
  const d = updated.data();
  return {
    userId:   updated.id,
    name:     d.name     || "",
    email:    d.email    || "",
    role:     d.role     || "teacher",
    centerId: d.centerId || d.center || "",
    center:   d.centerId || d.center || "",
    status:   d.status   || "active",
    photoUrl: d.photoUrl || "",
    schoolId: d.schoolId || SCHOOL_ID,
  };
}

/**
 * Create a new staff user document (invite).
 * The Firebase Auth account must be created separately.
 * @param {{ name, email, role, center, centerId, mobile, schoolId }} data
 * @param {{ actorUserId?: string }} opts
 */
async function createUser(data, { actorUserId = "system" } = {}) {
  const resolvedSchool  = data.schoolId || SCHOOL_ID;
  const resolvedCenter  = data.centerId || data.center || "";
  const ref = db.collection("users").doc();
  const doc = {
    userId:    ref.id,
    name:      data.name   || "",
    email:     data.email  || "",
    mobile:    data.mobile || "",
    role:      data.role   || "teacher",
    centerId:  resolvedCenter,
    center:    resolvedCenter,
    centers:   resolvedCenter ? [resolvedCenter] : [],
    status:    "active",
    photoUrl:  "",
    schoolId:  resolvedSchool,
    createdAt: nowISO(),
    updatedAt: nowISO(),
    createdBy: actorUserId,
    updatedBy: actorUserId,
  };
  await ref.set(doc);
  return doc;
}

module.exports = { getAllSettings, saveSection, getUsers, updateUser, createUser };
