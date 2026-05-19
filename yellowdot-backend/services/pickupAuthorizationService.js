/**
 * pickupAuthorizationService.js — Firestore-backed pickup authorization
 * ───────────────────────────────────────────────────────────────────────
 * Collection: pickupLogs (type: "authorization")
 * Fields: entryId, type, studentId, studentName, pickupName, relation,
 *         mobile, photoUrl, emergency, status,
 *         schoolId, centerId, center, createdAt, updatedAt
 */

const { db } = require("../firebaseAdmin");

const SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";
const col = () => db.collection("pickupLogs");

function nowISO() { return new Date().toISOString(); }

function docToAuth(snap) {
  const d = snap.data() || {};
  return {
    entryId:     d.entryId     || snap.id,
    studentId:   d.studentId   || "",
    studentName: d.studentName || "",
    pickupName:  d.pickupName  || "",
    relation:    d.relation    || "",
    mobile:      d.mobile      || "",
    photoUrl:    d.photoUrl    || "",
    emergency:   d.emergency   === true || d.emergency === "true",
    status:      d.status      || "Active",
    schoolId:    d.schoolId    || SCHOOL_ID,
    centerId:    d.centerId    || d.center || "",
    center:      d.centerId    || d.center || "",
    createdAt:   d.createdAt   || "",
    updatedAt:   d.updatedAt   || "",
  };
}

async function getAll(studentId, { schoolId = SCHOOL_ID, centerId } = {}) {
  let q = col()
    .where("schoolId", "==", schoolId)
    .where("type",     "==", "authorization");
  if (studentId) q = q.where("studentId", "==", studentId);
  const snap = await q.get();
  let entries = snap.docs.map(docToAuth);
  if (centerId) entries = entries.filter(e => e.centerId === centerId);
  // Sort newest first in JS to avoid composite index requirement
  entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return entries;
}

async function create(data, { schoolId = SCHOOL_ID, centerId = "", actorUserId = "system" } = {}) {
  const entryId        = `PKUP-${Date.now()}`;
  const resolvedCenter = centerId || data.centerId || data.center || "";
  const doc = {
    entryId,
    type:        "authorization",
    studentId:   data.studentId   || "",
    studentName: data.studentName || "",
    pickupName:  data.pickupName  || "",
    relation:    data.relation    || "",
    mobile:      data.mobile      || "",
    photoUrl:    data.photoUrl    || "",
    emergency:   Boolean(data.emergency),
    status:      "Active",
    schoolId,
    centerId:    resolvedCenter,
    center:      resolvedCenter,
    createdAt:   nowISO(),
    updatedAt:   nowISO(),
    createdBy:   actorUserId,
    updatedBy:   actorUserId,
  };
  await col().doc(entryId).set(doc);
  return docToAuth({ id: entryId, data: () => doc });
}

async function update(entryId, data, { updatedBy = "system" } = {}) {
  const ref  = col().doc(entryId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const updates = { updatedAt: nowISO(), updatedBy };
  if (data.pickupName !== undefined) updates.pickupName = data.pickupName;
  if (data.relation   !== undefined) updates.relation   = data.relation;
  if (data.mobile     !== undefined) updates.mobile     = data.mobile;
  if (data.photoUrl   !== undefined) updates.photoUrl   = data.photoUrl;
  if (data.emergency  !== undefined) updates.emergency  = Boolean(data.emergency);
  if (data.status     !== undefined) updates.status     = data.status;
  await ref.update(updates);
  const updated = await ref.get();
  return docToAuth(updated);
}

async function remove(entryId) {
  const ref  = col().doc(entryId);
  const snap = await ref.get();
  if (!snap.exists) return false;
  await ref.delete();
  return true;
}

module.exports = { getAll, create, update, remove };
