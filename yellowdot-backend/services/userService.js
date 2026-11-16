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
const { BYPASS_ROLES } = require("../config/permissionsBackend");

const SCHOOL_ID   = process.env.SCHOOL_ID || "yd-main";
const col         = () => db.collection("users");
const nowISO      = () => new Date().toISOString();

const VALID_ROLES = new Set([
  "developer", "super_admin", "admin", "center_admin", "center_owner",
  "teacher", "accountant", "reception", "parent",
]);

// Platform-level bypass roles (developer, super_admin) are never assignable
// through ordinary staff-management APIs — they grant unscoped, cross-tenant
// access and must be provisioned outside this service.
const ASSIGNABLE_ROLES = new Set([...VALID_ROLES].filter(r => !BYPASS_ROLES.has(r)));

function _resolveAssignableRole(requestedRole, fallback = "teacher") {
  return ASSIGNABLE_ROLES.has(requestedRole) ? requestedRole : fallback;
}

/**
 * Refuse to write a second login profile onto an email that already has one.
 *
 * Why this matters: authMiddleware resolves a token to a profile by UID first,
 * and falls back to `users where email == <token email> limit(1)` when the UID
 * misses (the Google-OAuth UID-mismatch path). With two documents sharing an
 * email, that limit(1) picks one arbitrarily — so which role and which centers
 * the request runs with is down to Firestore's ordering, not to anything a
 * human decided.
 *
 * Two deliberate choices, both to match how that fallback actually queries:
 *
 *   • NOT scoped to schoolId. The fallback does not filter by school, so a
 *     duplicate in any school is still an ambiguous resolution. (staffService's
 *     _assertNoDuplicate IS school-scoped, correctly — it guards HR records,
 *     which are never used to resolve a token.) If the fallback ever becomes
 *     school-scoped, scope this the same way in the same change.
 *   • Deactivated accounts still count. The fallback has no status filter, so
 *     a status:"inactive" document with the same email can still win the
 *     limit(1). Reusing an email therefore means removing the old profile, not
 *     just deactivating it.
 *
 * @param {string} email
 * @param {{excludeUserId?: string|null}} opts  excludeUserId is the document
 *   being written — create() upserts by UID, so a profile must not collide
 *   with itself on re-save.
 * @throws {Error} code "DUPLICATE", field "email"
 */
async function assertEmailNotTaken(email, { excludeUserId = null } = {}) {
  const value = String(email || "").toLowerCase().trim();
  if (!value) return;

  const snap = await col().where("email", "==", value).limit(2).get();
  const hit  = snap.docs.find(d => d.id !== excludeUserId);
  if (!hit) return;

  const err = new Error("Email is already in use by another login account.");
  err.code       = "DUPLICATE";
  err.field      = "email";
  err.conflictId = hit.id;
  throw err;
}

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

  // Upsert by UID, so a re-save of the same profile must not collide with
  // itself — hence excludeUserId.
  await assertEmailNotTaken(data.email, { excludeUserId: uid });

  const centerId = data.centerId || data.center || "";
  const doc = {
    userId:    uid,
    email:     (data.email || "").toLowerCase().trim(),
    name:      (data.name  || "").trim(),
    role:      _resolveAssignableRole(data.role),
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
  if (updates.role     !== undefined) {
    const resolved = _resolveAssignableRole(updates.role, null);
    if (resolved) patch.role = resolved;
  }
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

module.exports = {
  getAll, getOne, create, update, deactivate, syncFromFirebaseAuth,
  assertEmailNotTaken,
  VALID_ROLES: [...VALID_ROLES], ASSIGNABLE_ROLES: [...ASSIGNABLE_ROLES],
  _resolveAssignableRole,
};
