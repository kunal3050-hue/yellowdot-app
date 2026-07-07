/**
 * designationService.js — Designations master list (Staff Management)
 * ─────────────────────────────────────────────────────────────────────
 * Collection: designations/{designationId}
 *
 * Tenant-safe: tenantId, schoolId on every doc.
 * Tied to an Employee Category which drives reporting (teaching vs others)
 * — this replaces the earlier "guess teacher from name" heuristic.
 */

const { db } = require("../firebaseAdmin");

const SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";
const col       = () => db.collection("designations");
const nowISO    = () => new Date().toISOString();

// ── Employee categories (master) ─────────────────────────────────
// Authoritative list used by directories, dashboards and reporting.
const CATEGORIES = [
  { id: "teaching",       label: "Teaching" },
  { id: "non_teaching",   label: "Non-Teaching" },
  { id: "administration", label: "Administration" },
  { id: "management",     label: "Management" },
  { id: "support",        label: "Support Staff" },
];
const CATEGORY_IDS = new Set(CATEGORIES.map(c => c.id));

// ── Defaults seeded on first read (per school) ───────────────────
// Department name → category alignment for the auto-seeded designations.
const DEFAULT_DEPARTMENTS = [
  { name: "Academics",      description: "Curriculum & classroom learning",   sortOrder: 10 },
  { name: "Daycare",        description: "After-school & full-day care",      sortOrder: 20 },
  { name: "Administration", description: "Front-office & coordination",       sortOrder: 30 },
  { name: "Accounts",       description: "Fees, invoicing, payroll",          sortOrder: 40 },
  { name: "Reception",      description: "Front desk & visitor handling",     sortOrder: 50 },
  { name: "Operations",     description: "Day-to-day school operations",      sortOrder: 60 },
  { name: "Housekeeping",   description: "Cleaning & facility upkeep",        sortOrder: 70 },
  { name: "Transport",      description: "Pickup, drop-off & fleet",          sortOrder: 80 },
];

const DEFAULT_DESIGNATIONS = [
  { name: "Principal",             department: "Administration", category: "management",     level: "Lead",   sortOrder: 10 },
  { name: "Center Head",           department: "Administration", category: "management",     level: "Lead",   sortOrder: 20 },
  { name: "Academic Coordinator",  department: "Academics",      category: "teaching",       level: "Senior", sortOrder: 30 },
  { name: "Teacher",               department: "Academics",      category: "teaching",       level: "Mid",    sortOrder: 40 },
  { name: "Assistant Teacher",     department: "Academics",      category: "teaching",       level: "Junior", sortOrder: 50 },
  { name: "Daycare Teacher",       department: "Daycare",        category: "teaching",       level: "Mid",    sortOrder: 60 },
  { name: "Receptionist",          department: "Reception",      category: "administration", level: "Mid",    sortOrder: 70 },
  { name: "Accountant",            department: "Accounts",       category: "administration", level: "Mid",    sortOrder: 80 },
  { name: "Caretaker",             department: "Daycare",        category: "support",        level: "Mid",    sortOrder: 90 },
  { name: "Housekeeping",          department: "Housekeeping",   category: "support",        level: "Mid",    sortOrder: 100 },
];

// ── Mapper ───────────────────────────────────────────────────────

function docToDesig(snap) {
  const d  = snap.data ? snap.data() : snap;
  const id = snap.id   || d.designationId || "";
  return {
    designationId:   d.designationId   || id,
    tenantId:        d.tenantId        || d.schoolId || SCHOOL_ID,
    schoolId:        d.schoolId        || SCHOOL_ID,
    name:            d.name            || "",
    description:     d.description     || "",
    departmentId:    d.departmentId    || "",
    departmentName:  d.departmentName  || "",
    category:        d.category        || "non_teaching",
    level:           d.level           || "",
    active:          d.active !== false,
    sortOrder:       typeof d.sortOrder === "number" ? d.sortOrder : 0,
    isSystem:        Boolean(d.isSystem),
    createdAt:       d.createdAt       || "",
    updatedAt:       d.updatedAt       || "",
    createdBy:       d.createdBy       || "",
    updatedBy:       d.updatedBy       || "",
  };
}

// ── Seed default master data on first access ─────────────────────

let _seededSchools = new Set();
async function _seedDefaults(schoolId, tenantId) {
  if (_seededSchools.has(schoolId)) return;

  const deptColRef  = db.collection("departments");
  const desigColRef = col();
  const deptSnap    = await deptColRef.where("schoolId", "==", schoolId).limit(1).get();
  const desigSnap   = await desigColRef.where("schoolId", "==", schoolId).limit(1).get();

  if (!deptSnap.empty && !desigSnap.empty) {
    _seededSchools.add(schoolId);
    return;
  }

  const now    = nowISO();
  const batch  = db.batch();
  const deptIdByName = {};

  // Seed missing departments
  if (deptSnap.empty) {
    for (const d of DEFAULT_DEPARTMENTS) {
      const ref = deptColRef.doc();
      deptIdByName[d.name] = ref.id;
      batch.set(ref, {
        deptId:      ref.id,
        tenantId:    tenantId || schoolId,
        schoolId,
        centerId:    "",
        name:        d.name,
        description: d.description,
        headStaffId: "",
        active:      true,
        sortOrder:   d.sortOrder,
        isSystem:    true,
        createdAt:   now,
        updatedAt:   now,
        createdBy:   "system-seed",
        updatedBy:   "system-seed",
      });
    }
  } else {
    // Departments already exist — look them up so designations can reference them
    const existing = await deptColRef.where("schoolId", "==", schoolId).get();
    existing.docs.forEach(d => { deptIdByName[d.data().name] = d.id; });
  }

  // Seed missing designations
  if (desigSnap.empty) {
    for (const d of DEFAULT_DESIGNATIONS) {
      const ref = desigColRef.doc();
      batch.set(ref, {
        designationId:  ref.id,
        tenantId:       tenantId || schoolId,
        schoolId,
        name:           d.name,
        description:    "",
        departmentId:   deptIdByName[d.department] || "",
        departmentName: d.department,
        category:       d.category,
        level:          d.level,
        active:         true,
        sortOrder:      d.sortOrder,
        isSystem:       true,
        createdAt:      now,
        updatedAt:      now,
        createdBy:      "system-seed",
        updatedBy:      "system-seed",
      });
    }
  }

  await batch.commit();
  _seededSchools.add(schoolId);
}

// ── Public API ───────────────────────────────────────────────────

async function getAll({ schoolId = SCHOOL_ID, tenantId, departmentId, category, active } = {}) {
  await _seedDefaults(schoolId, tenantId).catch(err =>
    console.warn("[designationService] seed defaults failed:", err.message),
  );

  const snap = await col().where("schoolId", "==", schoolId).get();
  let rows   = snap.docs.map(docToDesig);

  if (departmentId) rows = rows.filter(r => r.departmentId === departmentId);
  if (category)     rows = rows.filter(r => r.category     === category);
  if (active !== undefined) {
    const want = active !== "false" && active !== false;
    rows = rows.filter(r => r.active === want);
  }

  rows.sort((a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name));
  return rows;
}

async function getOne(designationId) {
  const snap = await col().doc(designationId).get();
  return snap.exists ? docToDesig(snap) : null;
}

async function create(data, { schoolId = SCHOOL_ID, tenantId, actorUserId = "system" } = {}) {
  const name = (data.name || "").trim();
  if (!name) {
    const err = new Error("Designation name is required.");
    err.code  = "VALIDATION";
    throw err;
  }

  const category = data.category || "non_teaching";
  if (!CATEGORY_IDS.has(category)) {
    const err = new Error("Invalid category.");
    err.code  = "VALIDATION";
    throw err;
  }

  const dup = await col()
    .where("schoolId", "==", schoolId)
    .where("name", "==", name)
    .limit(1).get();
  if (!dup.empty) {
    const err = new Error("A designation with this name already exists.");
    err.code  = "DUPLICATE";
    throw err;
  }

  const ref = col().doc();
  const doc = {
    designationId:  ref.id,
    tenantId:       tenantId || schoolId,
    schoolId,
    name,
    description:    (data.description || "").trim(),
    departmentId:   (data.departmentId  || "").trim(),
    departmentName: (data.departmentName|| "").trim(),
    category,
    level:          (data.level || "").trim(),
    active:         data.active !== undefined ? Boolean(data.active) : true,
    sortOrder:      Number(data.sortOrder) || 0,
    isSystem:       false,
    createdAt:      nowISO(),
    updatedAt:      nowISO(),
    createdBy:      actorUserId,
    updatedBy:      actorUserId,
  };
  await ref.set(doc);
  return docToDesig(doc);
}

async function update(designationId, data, { actorUserId = "system" } = {}) {
  const ref  = col().doc(designationId);
  const snap = await ref.get();
  if (!snap.exists) return null;

  const updates = { updatedAt: nowISO(), updatedBy: actorUserId };
  if (data.name           !== undefined) updates.name           = (data.name || "").trim();
  if (data.description    !== undefined) updates.description    = (data.description || "").trim();
  if (data.departmentId   !== undefined) updates.departmentId   = (data.departmentId || "").trim();
  if (data.departmentName !== undefined) updates.departmentName = (data.departmentName || "").trim();
  if (data.category       !== undefined) {
    if (!CATEGORY_IDS.has(data.category)) {
      const err = new Error("Invalid category.");
      err.code  = "VALIDATION";
      throw err;
    }
    updates.category = data.category;
  }
  if (data.level     !== undefined) updates.level     = (data.level || "").trim();
  if (data.active    !== undefined) updates.active    = Boolean(data.active);
  if (data.sortOrder !== undefined) updates.sortOrder = Number(data.sortOrder) || 0;

  if (updates.name && updates.name !== snap.data().name) {
    const dup = await col()
      .where("schoolId", "==", snap.data().schoolId)
      .where("name", "==", updates.name)
      .limit(1).get();
    if (!dup.empty && dup.docs[0].id !== designationId) {
      const err = new Error("A designation with this name already exists.");
      err.code  = "DUPLICATE";
      throw err;
    }
  }

  await ref.update(updates);
  return docToDesig(await ref.get());
}

async function remove(designationId) {
  const snap = await col().doc(designationId).get();
  if (!snap.exists) return false;

  if (snap.data().isSystem) {
    const err = new Error("System designations cannot be deleted. Mark them inactive instead.");
    err.code  = "IN_USE";
    throw err;
  }

  const staffUsing = await db.collection("staff")
    .where("designationId", "==", designationId)
    .limit(1).get();
  if (!staffUsing.empty) {
    const err = new Error("This designation is in use and cannot be deleted. Reassign staff first.");
    err.code  = "IN_USE";
    throw err;
  }

  await col().doc(designationId).delete();
  return true;
}

async function count(schoolId = SCHOOL_ID) {
  const snap = await col().where("schoolId", "==", schoolId).where("active", "==", true).get();
  return snap.size;
}

module.exports = {
  getAll, getOne, create, update, remove, count,
  CATEGORIES,
  CATEGORY_IDS: [...CATEGORY_IDS],
  _seedDefaults, // exposed for tests / explicit seeding
};
