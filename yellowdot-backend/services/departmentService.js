/**
 * departmentService.js — Departments registry (Staff Management)
 * ────────────────────────────────────────────────────────────────
 * Collection: departments/{deptId}
 *
 * Tenant-safe: tenantId, schoolId, centerId on every doc.
 * IDs are auto-generated Firestore IDs (not human-friendly slugs).
 */

const { db } = require("../firebaseAdmin");

const SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";
const col       = () => db.collection("departments");
const nowISO    = () => new Date().toISOString();

function docToDept(snap) {
  const d  = snap.data ? snap.data() : snap;
  const id = snap.id   || d.deptId || "";
  return {
    deptId:      d.deptId      || id,
    tenantId:    d.tenantId    || d.schoolId || SCHOOL_ID,
    schoolId:    d.schoolId    || SCHOOL_ID,
    centerId:    d.centerId    || "",
    name:        d.name        || "",
    description: d.description || "",
    headStaffId: d.headStaffId || "",
    active:      d.active !== false,
    sortOrder:   typeof d.sortOrder === "number" ? d.sortOrder : 0,
    isSystem:    Boolean(d.isSystem),
    createdAt:   d.createdAt   || "",
    updatedAt:   d.updatedAt   || "",
    createdBy:   d.createdBy   || "",
    updatedBy:   d.updatedBy   || "",
  };
}

async function getAll({ schoolId = SCHOOL_ID, tenantId, centerId, active } = {}) {
  // Trigger one-time master-data seed so the directory has values to choose from
  try {
    const designationSvc = require("./designationService");
    await designationSvc._seedDefaults(schoolId, tenantId);
  } catch (err) {
    console.warn("[departmentService] seed defaults failed:", err.message);
  }

  const snap = await col().where("schoolId", "==", schoolId).get();
  let rows   = snap.docs.map(docToDept);

  if (centerId) rows = rows.filter(r => !r.centerId || r.centerId === centerId);
  if (active !== undefined) {
    const want = active !== "false" && active !== false;
    rows = rows.filter(r => r.active === want);
  }

  rows.sort((a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name));
  return rows;
}

async function getOne(deptId) {
  const snap = await col().doc(deptId).get();
  return snap.exists ? docToDept(snap) : null;
}

async function create(data, { schoolId = SCHOOL_ID, tenantId, actorUserId = "system" } = {}) {
  const name = (data.name || "").trim();
  if (!name) {
    const err = new Error("Department name is required.");
    err.code  = "VALIDATION";
    throw err;
  }

  // Prevent duplicate names within the same school
  const dup = await col()
    .where("schoolId", "==", schoolId)
    .where("name", "==", name)
    .limit(1).get();
  if (!dup.empty) {
    const err = new Error("A department with this name already exists.");
    err.code  = "DUPLICATE";
    throw err;
  }

  const ref = col().doc();
  const doc = {
    deptId:      ref.id,
    tenantId:    tenantId || schoolId,
    schoolId,
    centerId:    (data.centerId || "").trim(),
    name,
    description: (data.description || "").trim(),
    headStaffId: (data.headStaffId || "").trim(),
    active:      data.active !== undefined ? Boolean(data.active) : true,
    sortOrder:   Number(data.sortOrder) || 0,
    createdAt:   nowISO(),
    updatedAt:   nowISO(),
    createdBy:   actorUserId,
    updatedBy:   actorUserId,
  };
  await ref.set(doc);
  return docToDept(doc);
}

async function update(deptId, data, { actorUserId = "system" } = {}) {
  const ref  = col().doc(deptId);
  const snap = await ref.get();
  if (!snap.exists) return null;

  const updates = { updatedAt: nowISO(), updatedBy: actorUserId };
  if (data.name        !== undefined) updates.name        = (data.name || "").trim();
  if (data.description !== undefined) updates.description = (data.description || "").trim();
  if (data.centerId    !== undefined) updates.centerId    = (data.centerId || "").trim();
  if (data.headStaffId !== undefined) updates.headStaffId = (data.headStaffId || "").trim();
  if (data.active      !== undefined) updates.active      = Boolean(data.active);
  if (data.sortOrder   !== undefined) updates.sortOrder   = Number(data.sortOrder) || 0;

  // If renaming, enforce uniqueness
  if (updates.name && updates.name !== snap.data().name) {
    const dup = await col()
      .where("schoolId", "==", snap.data().schoolId)
      .where("name", "==", updates.name)
      .limit(1).get();
    if (!dup.empty && dup.docs[0].id !== deptId) {
      const err = new Error("A department with this name already exists.");
      err.code  = "DUPLICATE";
      throw err;
    }
  }

  await ref.update(updates);
  return docToDept(await ref.get());
}

async function remove(deptId) {
  const snap = await col().doc(deptId).get();
  if (!snap.exists) return false;

  if (snap.data().isSystem) {
    const err = new Error("System departments cannot be deleted. Mark them inactive instead.");
    err.code  = "IN_USE";
    throw err;
  }

  const staffUsing = await db.collection("staff")
    .where("departmentId", "==", deptId)
    .limit(1).get();
  if (!staffUsing.empty) {
    const err = new Error("This department is in use and cannot be deleted. Reassign staff first.");
    err.code  = "IN_USE";
    throw err;
  }

  await col().doc(deptId).delete();
  return true;
}

async function count(schoolId = SCHOOL_ID) {
  const snap = await col().where("schoolId", "==", schoolId).where("active", "==", true).get();
  return snap.size;
}

module.exports = { getAll, getOne, create, update, remove, count };
