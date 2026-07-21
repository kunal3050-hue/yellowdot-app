/**
 * roleService.js — Firestore-backed dynamic role & permission management
 * ────────────────────────────────────────────────────────────────────────
 * Collection: roles/{roleId}
 *
 * Role doc fields:
 *   roleId        — doc ID (slug for system roles, auto-ID for custom)
 *   schoolId      — tenant scoping
 *   name          — display name
 *   description   — plain-text purpose
 *   color         — hex colour string
 *   isSystem      — cannot be deleted, only edited
 *   isActive      — soft-disable without deleting
 *   homeRoute     — landing page after login
 *   permissions   — { moduleId: { action: bool } }
 *   centerAccess  — [] = all centres; [id, …] = restricted
 *   classAccess   — [] = all classes; [name, …] = restricted
 *   usersCount    — denormalised (updated by userService on assign/remove)
 *   createdAt, updatedAt, createdBy, updatedBy
 *
 * Auth-middleware integration:
 *   getPermissionsForRole(roleId, schoolId) → string[]
 *   Returns route-key array for the role, with 60-second in-process cache.
 *   Invalidate on every mutation via invalidateCache(roleId, schoolId).
 */

const { db } = require("../firebaseAdmin");

const col    = () => db.collection("roles");
const nowISO = () => new Date().toISOString();

// ── Static fallback permissions (mirrors permissionsBackend.js) ───────────────
// Used when the Firestore doc is absent (legacy / bypass roles).
const STATIC_ROLE_PERMS = {
  developer:    ["*"],
  super_admin:  ["*"],
  admin: [
    "dashboard","students","attendance","fees","invoice","analytics",
    "nap-tracker","food-menu","food-consumption",
    "parent-checkin","pickup-authorization","pickup-history",
    "profile","settings","user-management","roles-permissions",
    "holidays","notices","announcements",
    "academics-classes","academics-batches",
    "academics-teacher-allocation","academics-classroom-allocation",
    "finance-foundation",
  ],
  center_owner: [
    "dashboard","students","attendance","fees","invoice","analytics",
    "nap-tracker","food-menu","food-consumption",
    "parent-checkin","pickup-authorization","pickup-history",
    "profile","settings","user-management","roles-permissions",
    "holidays","notices","announcements",
    "academics-classes","academics-batches",
    "academics-teacher-allocation","academics-classroom-allocation",
    "finance-foundation",
  ],
  center_admin: [
    "dashboard","students","attendance","fees","invoice","analytics",
    "nap-tracker","food-menu","food-consumption",
    "parent-checkin","pickup-authorization","pickup-history",
    "profile","settings","user-management","roles-permissions",
    "holidays","notices","announcements","cctv",
    "academics-classes","academics-batches",
    "academics-teacher-allocation","academics-classroom-allocation",
    "families",
    "finance-foundation",
  ],
  teacher: [
    "dashboard","attendance","nap-tracker","food-menu","food-consumption",
    "students","parent-checkin","profile",
    "holidays","notices","announcements",
    "academics-classes","academics-batches",
  ],
  accountant: [
    "dashboard","fees","invoice","analytics","students","profile",
    "finance-foundation",
  ],
  reception: [
    "dashboard","students","attendance","parent-checkin",
    "pickup-authorization","pickup-history","profile",
  ],
  parent: [
    "dashboard","parent-checkin","pickup-history","fees","profile",
  ],
};

// ── Module → route-key mapping ────────────────────────────────────────────────
// Each module's "view" action grants the listed route keys.
const MODULE_ROUTE_MAP = {
  dashboard:         ["dashboard"],
  students:          ["students"],
  admissions:        ["students"],
  attendance:        ["attendance"],
  nap_tracking:      ["nap-tracker"],
  pickup_auth:       ["pickup-authorization","pickup-history"],
  medical:           [],                   // sub-feature of students
  food_menu:         ["food-menu","food-consumption"],
  fees:              ["fees"],
  invoices:          ["invoice"],
  payments:          ["fees"],
  receipts:          ["invoice"],
  analytics:         ["analytics"],
  staff:             ["user-management"],
  roles_permissions: ["roles-permissions"],
  settings:          ["settings"],
  cctv:              ["cctv"],
  notifications:     [],
  parent_app:        ["parent-checkin"],
  documents:         [],
  communications:    ["holidays","notices","announcements"],
  academics:         ["academics-classes","academics-batches",
                      "academics-teacher-allocation","academics-classroom-allocation"],
  family_management: ["families"],
  finance_foundation: ["finance-foundation"], // Student Ledger / Billing Plan / Family Account extension / Finance Settings (Sprint 1)
  // Staff Management module — view grants dashboard + directory + dept/desig.
  // Sub-actions (create/edit/delete) are governed by manage flag in matrix.
  staff_management:  ["staff-dashboard","staff-management","departments","designations"],
};

// ── Derive route keys from granular permission matrix ─────────────────────────
function deriveRouteKeys(permissions = {}) {
  const keys = new Set(["profile"]); // always granted
  for (const [moduleId, actions] of Object.entries(permissions)) {
    if (actions?.view) {
      (MODULE_ROUTE_MAP[moduleId] || []).forEach(k => keys.add(k));
    }
  }
  return [...keys];
}

// ── In-process 60-second cache ────────────────────────────────────────────────
// Each slot stores: { routeKeys, matrix, exp }
// Both getPermissionsForRole() and getRoleMatrix() share the same cache slot
// so a single Firestore read serves both callers.
const _cache = new Map();

function _cacheKey(roleId, schoolId) { return `${schoolId}:${roleId}`; }

function invalidateCache(roleId, schoolId) {
  _cache.delete(_cacheKey(roleId, schoolId));
}

// ── Internal: fetch role data from Firestore and populate cache ───────────────
async function _fetchAndCache(roleId, schoolId) {
  const key = _cacheKey(roleId, schoolId);

  try {
    const snap = await col().doc(roleId).get();
    if (snap.exists) {
      const doc = snap.data();
      if (doc.schoolId === schoolId || doc.isSystem) {
        const matrix  = doc.permissions || {};
        const derived = deriveRouteKeys(matrix);
        // Union with static baseline: guarantees route keys added to STATIC_ROLE_PERMS
        // propagate to users whose Firestore role doc predates the module addition.
        // We only ever ADD permissions here — never subtract — so dynamic restrictions
        // set via the Roles UI are preserved on every other key.
        const baseline  = STATIC_ROLE_PERMS[roleId] || [];
        const routeKeys = [...new Set([...derived, ...baseline])];
        _cache.set(key, { routeKeys, matrix, exp: Date.now() + 60_000 });
        return { routeKeys, matrix };
      }
    }
  } catch (err) {
    console.warn("[roleService] Firestore lookup failed, using static fallback:", err.message);
  }

  // Static fallback (route keys only — matrix will be empty object for unknown roles)
  const routeKeys = STATIC_ROLE_PERMS[roleId] || [];
  _cache.set(key, { routeKeys, matrix: {}, exp: Date.now() + 30_000 });
  return { routeKeys, matrix: {} };
}

// ── Invalidate cache for all roles (used after bulk permission updates) ───────
function invalidateCacheAll() {
  _cache.clear();
}

// ── Permission resolution for auth middleware ─────────────────────────────────
/**
 * Returns an array of route-key strings for the given role.
 * Priority: bypass roles → Firestore doc → static fallback.
 * Results are cached for 60 s to avoid per-request Firestore reads.
 */
async function getPermissionsForRole(roleId, schoolId) {
  if (roleId === "developer" || roleId === "super_admin") return ["*"];
  if (roleId === "parent") return STATIC_ROLE_PERMS.parent;

  const key    = _cacheKey(roleId, schoolId);
  const cached = _cache.get(key);
  if (cached && Date.now() < cached.exp) return cached.routeKeys;

  const { routeKeys } = await _fetchAndCache(roleId, schoolId);
  return routeKeys;
}

/**
 * Returns the granular permission matrix { moduleId: { action: bool } } for the role.
 * Shares the same cache slot as getPermissionsForRole — zero extra Firestore reads
 * when both are called on the same request (middleware calls both in sequence).
 */
async function getRoleMatrix(roleId, schoolId) {
  if (roleId === "developer" || roleId === "super_admin") return { _bypass: true };
  if (roleId === "parent") return {};

  const key    = _cacheKey(roleId, schoolId);
  const cached = _cache.get(key);
  if (cached && Date.now() < cached.exp) return cached.matrix;

  const { matrix } = await _fetchAndCache(roleId, schoolId);
  return matrix;
}

// ── Default system roles (seeded once per school) ─────────────────────────────
const SYSTEM_ROLES = [
  {
    roleId:      "admin",
    name:        "Admin",
    description: "Full administrative access to all modules",
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
      cctv:              { view: true, manage: true },
      notifications:     { view: true, create: true, manage: true },
      parent_app:        { view: true, manage: true },
      documents:         { view: true, create: true, delete: true, export: true },
      communications:    { view: true, create: true, edit: true, delete: true },
    },
  },
  {
    roleId:      "center_admin",
    name:        "Center Admin",
    description: "Full access scoped to their assigned center",
    color:       "#0891b2",
    isSystem:    true,
    homeRoute:   "/",
    permissions: {
      dashboard:         { view: true },
      students:          { view: true, create: true, edit: true, delete: false, export: true },
      admissions:        { view: true, create: true, edit: true, approve: true },
      attendance:        { view: true, mark: true, edit: true, export: true },
      nap_tracking:      { view: true, mark: true, edit: true },
      pickup_auth:       { view: true, create: true, edit: true, approve: true },
      medical:           { view: true, edit: true },
      food_menu:         { view: true, create: true, edit: true, delete: false },
      fees:              { view: true, create: true, edit: true, delete: false, approve: true },
      invoices:          { view: true, create: true, edit: true, delete: false, approve: false },
      payments:          { view: true, create: true, delete: false },
      receipts:          { view: true, create: true, export: true },
      analytics:         { view: true, export: false },
      staff:             { view: true, create: true, edit: true, delete: false },
      roles_permissions: { view: true, manage: false },
      settings:          { view: true, edit: true },
      cctv:              { view: true, manage: true },
      notifications:     { view: true, create: true, manage: false },
      parent_app:        { view: true, manage: false },
      documents:         { view: true, create: true, delete: false, export: true },
      communications:    { view: true, create: true, edit: true, delete: false },
    },
  },
  {
    roleId:      "teacher",
    name:        "Teacher",
    description: "Daily classroom and student care operations",
    color:       "#059669",
    isSystem:    true,
    homeRoute:   "/attendance",
    permissions: {
      dashboard:         { view: true },
      students:          { view: true, create: false, edit: false, delete: false, export: false },
      attendance:        { view: true, mark: true, edit: true, export: false },
      nap_tracking:      { view: true, mark: true, edit: true },
      pickup_auth:       { view: true, create: false, edit: false, approve: false },
      medical:           { view: true, edit: false },
      food_menu:         { view: true, create: false, edit: false, delete: false },
      documents:         { view: true, create: false, delete: false, export: false },
      communications:    { view: true, create: false, edit: false, delete: false },
    },
  },
  {
    roleId:      "accountant",
    name:        "Accountant",
    description: "Financial management, invoicing and reporting",
    color:       "#2563eb",
    isSystem:    true,
    homeRoute:   "/invoice",
    permissions: {
      dashboard:  { view: true },
      students:   { view: true, create: false, edit: false, delete: false, export: true },
      fees:       { view: true, create: true, edit: true, delete: false, approve: true },
      invoices:   { view: true, create: true, edit: true, delete: false, approve: true },
      payments:   { view: true, create: true, delete: false },
      receipts:   { view: true, create: true, export: true },
      analytics:  { view: true, export: true },
      documents:  { view: true, create: true, delete: false, export: true },
    },
  },
  {
    roleId:      "reception",
    name:        "Reception",
    description: "Front desk, student check-in and pickup management",
    color:       "#d97706",
    isSystem:    true,
    homeRoute:   "/",
    permissions: {
      dashboard:   { view: true },
      students:    { view: true, create: false, edit: false, delete: false, export: false },
      attendance:  { view: true, mark: true, edit: false, export: false },
      pickup_auth: { view: true, create: true, edit: true, approve: false },
    },
  },
];

// ── Seed default roles for a school ──────────────────────────────────────────
async function seedDefaultRoles(schoolId) {
  const batch = db.batch();
  const now   = nowISO();

  for (const r of SYSTEM_ROLES) {
    const ref = col().doc(r.roleId);
    const snap = await ref.get();
    if (!snap.exists) {
      batch.set(ref, {
        ...r,
        schoolId,
        isActive:   true,
        usersCount: 0,
        createdAt:  now,
        updatedAt:  now,
        createdBy:  "system",
        updatedBy:  "system",
      });
    }
  }

  await batch.commit();
  return true;
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

async function getAll(schoolId) {
  const snap = await col()
    .where("schoolId", "==", schoolId)
    .get();

  const roles = snap.docs.map(d => ({ ...d.data(), roleId: d.id }));
  roles.sort((a, b) => {
    // System roles first, then alphabetical
    if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1;
    return (a.name || "").localeCompare(b.name || "");
  });
  return roles;
}

async function getOne(roleId) {
  const snap = await col().doc(roleId).get();
  if (!snap.exists) return null;
  return { ...snap.data(), roleId: snap.id };
}

async function create(data, actorId, schoolId) {
  const ref = col().doc(); // auto-ID for custom roles
  const now = nowISO();

  const doc = {
    roleId:       ref.id,
    schoolId,
    name:         (data.name || "").trim(),
    description:  (data.description || "").trim(),
    color:        data.color || "#6366f1",
    isSystem:     false,
    isActive:     true,
    homeRoute:    data.homeRoute || "/",
    permissions:  data.permissions || {},
    centerAccess: Array.isArray(data.centerAccess) ? data.centerAccess : [],
    classAccess:  Array.isArray(data.classAccess)  ? data.classAccess  : [],
    usersCount:   0,
    createdAt:    now,
    updatedAt:    now,
    createdBy:    actorId,
    updatedBy:    actorId,
  };

  await ref.set(doc);
  return doc;
}

async function update(roleId, data, actorId) {
  const ref  = col().doc(roleId);
  const snap = await ref.get();
  if (!snap.exists) return null;

  const patch = { updatedAt: nowISO(), updatedBy: actorId };

  if (data.name        !== undefined) patch.name        = (data.name || "").trim();
  if (data.description !== undefined) patch.description = (data.description || "").trim();
  if (data.color       !== undefined) patch.color       = data.color;
  if (data.isActive    !== undefined) patch.isActive    = Boolean(data.isActive);
  if (data.homeRoute   !== undefined) patch.homeRoute   = data.homeRoute;
  if (data.centerAccess !== undefined) patch.centerAccess = data.centerAccess;
  if (data.classAccess  !== undefined) patch.classAccess  = data.classAccess;

  await ref.update(patch);

  // Log audit entry
  try {
    await db.collection("permissionAuditLogs").add({
      roleId,
      schoolId:   snap.data().schoolId,
      action:     "ROLE_UPDATED",
      changes:    Object.keys(patch).filter(k => k !== "updatedAt" && k !== "updatedBy"),
      actorId,
      timestamp:  patch.updatedAt,
    });
  } catch { /* non-fatal */ }

  invalidateCache(roleId, snap.data().schoolId);
  return { ...snap.data(), ...patch, roleId };
}

async function updatePermissions(roleId, permissions, actorId) {
  const ref  = col().doc(roleId);
  const snap = await ref.get();
  if (!snap.exists) return null;

  const now   = nowISO();
  const patch = { permissions, updatedAt: now, updatedBy: actorId };
  await ref.update(patch);

  // Audit log
  try {
    await db.collection("permissionAuditLogs").add({
      roleId,
      schoolId:   snap.data().schoolId,
      action:     "PERMISSIONS_UPDATED",
      actorId,
      timestamp:  now,
    });
  } catch { /* non-fatal */ }

  invalidateCache(roleId, snap.data().schoolId);
  return { ...snap.data(), ...patch, roleId };
}

async function remove(roleId, actorId) {
  const ref  = col().doc(roleId);
  const snap = await ref.get();
  if (!snap.exists) return null;

  const doc = snap.data();
  if (doc.isSystem) throw new Error("System roles cannot be deleted.");
  if (doc.usersCount > 0) throw new Error("Reassign all users before deleting this role.");

  await ref.delete();

  try {
    await db.collection("permissionAuditLogs").add({
      roleId,
      schoolId: doc.schoolId,
      action:   "ROLE_DELETED",
      actorId,
      timestamp: nowISO(),
    });
  } catch { /* non-fatal */ }

  invalidateCache(roleId, doc.schoolId);
  return true;
}

async function getAuditLogs(roleId, schoolId, limit = 50) {
  const snap = await db.collection("permissionAuditLogs")
    .where("roleId", "==", roleId)
    .where("schoolId", "==", schoolId)
    .orderBy("timestamp", "desc")
    .limit(limit)
    .get();
  return snap.docs.map(d => d.data());
}

module.exports = {
  getAll,
  getOne,
  create,
  update,
  updatePermissions,
  remove,
  seedDefaultRoles,
  getPermissionsForRole,
  getRoleMatrix,
  invalidateCache,
  invalidateCacheAll,
  deriveRouteKeys,
  SYSTEM_ROLES,
  getAuditLogs,
};
