/**
 * foodConsumptionService.js — Firestore-backed food consumption log
 * ──────────────────────────────────────────────────────────────────
 * Collection: foodConsumption/{entryId}
 * Deterministic ID: FC-{date}-{studentId}-{mealType}
 * Fields: entryId, date, studentId, studentName, class, mealType,
 *         foodItem, quantity, unit, status, notes, updatedBy,
 *         schoolId, centerId, center, createdAt, updatedAt
 */

const { db } = require("../firebaseAdmin");

const SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";
const col = () => db.collection("foodConsumption");

function nowISO() { return new Date().toISOString(); }

function docToEntry(snap) {
  const d = snap.data() || {};
  return {
    entryId:     d.entryId     || snap.id,
    date:        d.date        || "",
    studentId:   d.studentId   || "",
    studentName: d.studentName || "",
    class:       d.class       || "",
    mealType:    d.mealType    || "",
    foodItem:    d.foodItem    || "",
    quantity:    d.quantity    || "",
    unit:        d.unit        || "",
    status:      d.status      || "",
    notes:       d.notes       || "",
    updatedBy:   d.updatedBy   || "",
    schoolId:    d.schoolId    || SCHOOL_ID,
    centerId:    d.centerId    || d.center || "",
    center:      d.centerId    || d.center || "",
    createdAt:   d.createdAt   || "",
    updatedAt:   d.updatedAt   || "",
  };
}

async function getConsumption({ date, studentId, class: cls, schoolId = SCHOOL_ID, centerId } = {}) {
  let q = col().where("schoolId", "==", schoolId);
  if (date)      q = q.where("date",      "==", date);
  if (studentId) q = q.where("studentId", "==", studentId);
  const snap = await q.get();
  let entries = snap.docs.map(docToEntry);
  if (cls)      entries = entries.filter(e => e.class    === cls);
  if (centerId) entries = entries.filter(e => e.centerId === centerId);
  // Sort newest first in JS
  entries.sort((a, b) => b.date.localeCompare(a.date));
  return entries;
}

async function upsertConsumption(data, { schoolId = SCHOOL_ID, centerId = "", actorUserId = "system" } = {}) {
  const date           = data.date      || new Date().toISOString().slice(0, 10);
  const studentId      = data.studentId || "";
  const mealType       = data.mealType  || "";
  const entryId        = `FC-${date}-${studentId}-${mealType}`;
  const ref            = col().doc(entryId);
  const existing       = await ref.get();
  const resolvedCenter = centerId || data.centerId || data.center || "";

  const doc = {
    entryId,
    date,
    studentId,
    studentName: data.studentName || "",
    class:       data.class       || "",
    mealType,
    foodItem:    data.foodItem    || "",
    quantity:    data.quantity    || "",
    unit:        data.unit        || "",
    status:      data.status      || "",
    notes:       data.notes       || "",
    updatedBy:   data.updatedBy   || actorUserId,
    schoolId,
    centerId:    resolvedCenter,
    center:      resolvedCenter,
    createdAt:   existing.exists ? (existing.data().createdAt || nowISO()) : nowISO(),
    updatedAt:   nowISO(),
    updatedBy:   data.updatedBy || actorUserId,
  };

  await ref.set(doc, { merge: true });
  return doc;
}

async function deleteEntry(entryId) {
  const ref  = col().doc(entryId);
  const snap = await ref.get();
  if (!snap.exists) return false;
  await ref.delete();
  return true;
}

module.exports = { getConsumption, upsertConsumption, deleteEntry };
