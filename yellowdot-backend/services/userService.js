/**
 * userService.js — Firestore-backed staff user management
 * ─────────────────────────────────────────────────────────
 * Collection: users/{uid}   (Firebase Auth UID = doc ID)
 *
 * Isolation:
 *   schoolId — every document is scoped to a school
 *   centerId — optionally scoped to a center within the school
 *
 * All reads accept { schoolId, centerId } so callers can scope
 * to their school/center without hardcoding collection paths.
 *
 * Timestamps:
 *   createdAt — ISO string set on first write
 *   updatedAt — ISO string set on every write
 */

const { db } = require("../firebaseAdmin");

const SCHOOL_ID   = process.env.SCHOOL_ID || "yd-main";
const col         = () => db.collection("users");
const nowISO      = () => new Date().toISOString();

const VALID_ROLES = new Set([
  "developer", "super_admin", "admin", "center_admin", "center_owner",
  "teacher", "accountant", "reception", "parent",
]);

// ── Document mapper ────────────────────────────────────────────────

function docToUser(snap) {
  const d = snap.data ? snap.data() : snap;
  const id = snap.id || d.userId || "";
  return {
    userId:    d.userId    || id,
    email:     d.email     || "",
    name:      d.name      || "",
    role:      d.role      || "teacher",
    schoolId:  d.schoolId  || SCHOOL_ID,
    centerId:  d.centerId  || d.center || "",
    centers:   Array.isArray(d.centers) ? d.centers : (d.center ? [d.center] : []),
    // Classrooms a staff member is assigned to. Used by CCTV classroom-scope
    // resolver (teachers see only their classrooms) and future Phase 2/3 scoping.
    classrooms: Array.isArray(d.classrooms) ? d.classrooms : [],
    photoUrl:  d.photoUrl  || "",
    phone:     d.phone     || d.mobile || "",
    mobile:    d.phone     || d.mobile || "",   // alias so frontend receives it
    status:    d.status    || "active",
    createdAt: d.createdAt || "",
    updatedAt: d.updatedAt || "",
    createdBy: d.createdBy || "",
    updatedBy: d.updatedBy || "",
  };
}

// ── Read ───────────────────────────────────────────────────────────

/**
 * List users scoped by schoolId.
 * Optional filters: centerId, role, status.
 * Results sorted by name (JS side to avoid composite index).
 */
async function getAll({ schoolId = SCHOOL_ID, centerId, role, status } = {}) {
  let q = col().where("schoolId", "==", schoolId);
  // Avoid compound-index conflicts by applying extra filters in JS
  const snap = await q.get();
  let users = snap.docs.map(docToUser);

  if (centerId) users = users.filter(u => u.centerId === centerId);
  if (role)     users = users.filter(u => u.role     === role);
  if (status)   users = users.filter(u => u.status   === status);

  users.sort((a, b) => a.name.localeCompare(b.name));
  return users;
}

/**
 * Fetch a single user by Firebase Auth UID.
 */
async function getOne(userId) {
  const snap = await col().doc(userId).get();
  if (!snap.exists) return null;
  return docToUser(snap);
}

// ── Write ──────────────────────────────────────────────────────────

/**
 * Create or upsert a user document.
 * data.uid / data.userId must be provided (Firebase Auth UID).
 */
async function create(data, actorUserId = "system") {
  const uid = data.uid || data.userId;
  if (!uid) throw new Error("uid / userId is required to create a user");

  const centerId = data.centerId || data.center || "";
  const doc = {
    userId:    uid,
    email:     (data.email || "").toLowerCase().trim(),
    name:      (data.name  || "").trim(),
    role:      VALID_ROLES.has(data.role) ? data.role : "teacher",
    schoolId:  data.schoolId || SCHOOL_ID,
    centerId,
    center:    centerId,                          // legacy alias kept in sync
    centers:   Array.isArray(data.centers)
                 ? data.centers
                 : centerId ? [centerId] : [],
    classrooms: Array.isArray(data.classrooms) ? data.classrooms : [],
    photoUrl:  data.photoUrl || "",
    phone:     data.phone    || data.mobile || "",
    status:    "active",
    createdAt: nowISO(),
    updatedAt: nowISO(),
    createdBy: actorUserId,
    updatedBy: actorUserId,
  };

  await col().doc(uid).set(doc, { merge: true });
  return docToUser({ id: uid, data: () => doc });
}

/**
 * Update allowed fields on a user document.
 * Returns the updated user, or null if not found.
 */
async function update(userId, updates, actorUserId = "system") {
  const ref  = col().doc(userId);
  const snap = await ref.get();
  if (!snap.exists) return null;

  const patch = { updatedAt: nowISO(), updatedBy: actorUserId };

  if (updates.name     !== undefined) patch.name     = (updates.name || "").trim();
  if (updates.role     !== undefined && VALID_ROLES.has(updates.role)) patch.role = updates.role;
  if (updates.photoUrl !== undefined) patch.photoUrl = updates.photoUrl;
  // Accept both phone and mobile as the same field
  if (updates.phone    !== undefined) patch.phone    = updates.phone;
  if (updates.mobile   !== undefined) patch.phone    = updates.mobile;
  if (updates.status   !== undefined) patch.status   = updates.status;

  // centerId / center kept in sync
  const newCenter = updates.centerId !== undefined ? updates.centerId
                  : updates.center   !== undefined ? updates.center
                  : undefined;
  if (newCenter !== undefined) {
    patch.centerId = newCenter;
    patch.center   = newCenter;
  }
  if (updates.centers !== undefined) patch.centers = updates.centers;
  if (updates.classrooms !== undefined && Array.isArray(updates.classrooms)) {
    patch.classrooms = updates.classrooms;
  }

  await ref.update(patch);
  return docToUser({ ...snap, data: () => ({ ...snap.data(), ...patch }) });
}

/**
 * Soft-delete: sets status = "inactive".
 */
async function deactivate(userId, actorUserId = "system") {
  return update(userId, { status: "inactive" }, actorUserId);
}

/**
 * Upsert on Firebase Auth sign-in.
 * Called by authMiddleware when a user authenticates for the first time
 * (no existing Firestore doc). Safe to call repeatedly.
 */
async function syncFromFirebaseAuth(uid, { email, name, photoUrl, role, centerId, schoolId } = {}) {
  const ref  = col().doc(uid);
  const snap = await ref.get();

  if (snap.exists) {
    // Refresh mutable display fields from Firebase Auth
    const d = snap.data();
    const patch = { updatedAt: nowISO() };
    if (name     && name     !== d.name)     patch.name     = name;
    if (photoUrl && photoUrl !== d.photoUrl) patch.photoUrl = photoUrl;
    await ref.update(patch);
    return docToUser({ ...snap, data: () => ({ ...d, ...patch }) });
  }

  // First sign-in → create with minimal profile
  return create(
    { uid, email, name, photoUrl, role: role || "teacher", centerId, schoolId },
    "firebase-auth"
  );
}

module.exports = { getAll, getOne, create, update, deactivate, syncFromFirebaseAuth, VALID_ROLES: [...VALID_ROLES] };
