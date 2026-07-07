/**
 * staffShiftService.js — Shift definitions for Staff Attendance
 * ────────────────────────────────────────────────────────────────
 * Collection: staffShifts/{shiftId}
 *
 * A shift defines the working window the attendance engine uses to
 * derive late-entry, early-exit, half-day and overtime metrics.
 *
 * Each school auto-seeds three default shifts on first read:
 *   Full Day  (09:00 → 17:00, grace 10m, half-day < 4h, OT after 8h)
 *   Half Day  (09:00 → 13:00, grace 10m)
 *   Daycare   (12:00 → 19:00, grace 10m)
 *
 * Shift assignment is per-staff via `staff.shiftId` (added lazily on the
 * staff document). If a staff member has no explicit shift, the school's
 * default shift (isDefault: true) is used.
 */

const { db } = require("../firebaseAdmin");

const SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";
const col       = () => db.collection("staffShifts");
const nowISO    = () => new Date().toISOString();

const DEFAULT_SHIFTS = [
  {
    name: "Full Day", code: "FULL", startTime: "09:00", endTime: "17:00",
    graceMinutes: 10, halfDayMinHours: 4, fullDayMinHours: 7,
    overtimeAfterMinutes: 480, isDefault: true, sortOrder: 10,
  },
  {
    name: "Half Day", code: "HALF", startTime: "09:00", endTime: "13:00",
    graceMinutes: 10, halfDayMinHours: 2, fullDayMinHours: 3.5,
    overtimeAfterMinutes: 240, isDefault: false, sortOrder: 20,
  },
  {
    name: "Daycare", code: "DAYC", startTime: "12:00", endTime: "19:00",
    graceMinutes: 10, halfDayMinHours: 3.5, fullDayMinHours: 6,
    overtimeAfterMinutes: 420, isDefault: false, sortOrder: 30,
  },
];

function docToShift(snap) {
  const d  = snap.data ? snap.data() : snap;
  const id = snap.id   || d.shiftId || "";
  return {
    shiftId:              d.shiftId              || id,
    tenantId:             d.tenantId             || d.schoolId || SCHOOL_ID,
    schoolId:             d.schoolId             || SCHOOL_ID,
    centerId:             d.centerId             || "",
    name:                 d.name                 || "",
    code:                 d.code                 || "",
    startTime:            d.startTime            || "09:00",
    endTime:              d.endTime              || "17:00",
    graceMinutes:         Number(d.graceMinutes || 0),
    halfDayMinHours:      Number(d.halfDayMinHours || 4),
    fullDayMinHours:      Number(d.fullDayMinHours || 7),
    overtimeAfterMinutes: Number(d.overtimeAfterMinutes || 480),
    isDefault:            Boolean(d.isDefault),
    isSystem:             Boolean(d.isSystem),
    active:               d.active !== false,
    sortOrder:            typeof d.sortOrder === "number" ? d.sortOrder : 0,
    createdAt: d.createdAt || "", updatedAt: d.updatedAt || "",
    createdBy: d.createdBy || "", updatedBy: d.updatedBy || "",
  };
}

const _seeded = new Set();
async function _seedDefaults(schoolId, tenantId) {
  if (_seeded.has(schoolId)) return;
  const snap = await col().where("schoolId", "==", schoolId).limit(1).get();
  if (!snap.empty) { _seeded.add(schoolId); return; }

  const now   = nowISO();
  const batch = db.batch();
  for (const s of DEFAULT_SHIFTS) {
    const ref = col().doc();
    batch.set(ref, {
      shiftId: ref.id, tenantId: tenantId || schoolId, schoolId, centerId: "",
      ...s, isSystem: true, active: true,
      createdAt: now, updatedAt: now, createdBy: "system-seed", updatedBy: "system-seed",
    });
  }
  await batch.commit();
  _seeded.add(schoolId);
}

async function getAll({ schoolId = SCHOOL_ID, tenantId, active } = {}) {
  await _seedDefaults(schoolId, tenantId).catch(err =>
    console.warn("[staffShiftService] seed failed:", err.message));
  const snap = await col().where("schoolId", "==", schoolId).get();
  let rows = snap.docs.map(docToShift);
  if (active !== undefined) {
    const want = active !== "false" && active !== false;
    rows = rows.filter(r => r.active === want);
  }
  rows.sort((a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name));
  return rows;
}

async function getOne(shiftId) {
  const snap = await col().doc(shiftId).get();
  return snap.exists ? docToShift(snap) : null;
}

async function getDefaultShift(schoolId = SCHOOL_ID) {
  const all = await getAll({ schoolId });
  return all.find(s => s.isDefault && s.active) || all[0] || null;
}

async function create(data, { schoolId = SCHOOL_ID, tenantId, actorUserId = "system" } = {}) {
  const name = (data.name || "").trim();
  if (!name) {
    const err = new Error("Shift name is required.");
    err.code  = "VALIDATION";
    throw err;
  }
  const dup = await col().where("schoolId", "==", schoolId).where("name", "==", name).limit(1).get();
  if (!dup.empty) {
    const err = new Error("A shift with this name already exists.");
    err.code  = "DUPLICATE";
    throw err;
  }
  const ref = col().doc();
  const doc = {
    shiftId: ref.id, tenantId: tenantId || schoolId, schoolId,
    centerId: (data.centerId || "").trim(),
    name, code: (data.code || "").trim(),
    startTime: data.startTime || "09:00", endTime: data.endTime || "17:00",
    graceMinutes:         Number(data.graceMinutes || 10),
    halfDayMinHours:      Number(data.halfDayMinHours || 4),
    fullDayMinHours:      Number(data.fullDayMinHours || 7),
    overtimeAfterMinutes: Number(data.overtimeAfterMinutes || 480),
    isDefault: Boolean(data.isDefault), isSystem: false, active: true,
    sortOrder: Number(data.sortOrder) || 0,
    createdAt: nowISO(), updatedAt: nowISO(), createdBy: actorUserId, updatedBy: actorUserId,
  };
  await ref.set(doc);
  return docToShift(doc);
}

async function update(shiftId, data, { actorUserId = "system" } = {}) {
  const ref  = col().doc(shiftId);
  const snap = await ref.get();
  if (!snap.exists) return null;

  const updates = { updatedAt: nowISO(), updatedBy: actorUserId };
  ["name","code","startTime","endTime","centerId"].forEach(k => {
    if (data[k] !== undefined) updates[k] = String(data[k]).trim();
  });
  ["graceMinutes","halfDayMinHours","fullDayMinHours","overtimeAfterMinutes","sortOrder"].forEach(k => {
    if (data[k] !== undefined) updates[k] = Number(data[k]) || 0;
  });
  if (data.isDefault !== undefined) updates.isDefault = Boolean(data.isDefault);
  if (data.active    !== undefined) updates.active    = Boolean(data.active);

  await ref.update(updates);
  return docToShift(await ref.get());
}

async function remove(shiftId) {
  const snap = await col().doc(shiftId).get();
  if (!snap.exists) return false;
  if (snap.data().isSystem) {
    const err = new Error("System shifts cannot be deleted. Mark them inactive instead.");
    err.code  = "IN_USE";
    throw err;
  }
  await col().doc(shiftId).delete();
  return true;
}

module.exports = { getAll, getOne, getDefaultShift, create, update, remove };
