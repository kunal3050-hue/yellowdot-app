/**
 * pickupHistoryService.js — Firestore-backed pickup history
 * ──────────────────────────────────────────────────────────
 * Collection: pickupLogs (type: "history")
 * Fields: entryId, type, date, studentId, studentName, pickupName,
 *         relation, selfieUrl, approvalStatus, verifiedBy,
 *         checkoutTime, schoolId, centerId, center, createdAt, updatedAt
 */

const { db } = require("../firebaseAdmin");

const SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";
const col = () => db.collection("pickupLogs");

function nowISO() { return new Date().toISOString(); }

function docToHistory(snap) {
  const d = snap.data() || {};
  return {
    entryId:        d.entryId        || snap.id,
    date:           d.date           || "",
    studentId:      d.studentId      || "",
    studentName:    d.studentName    || "",
    pickupName:     d.pickupName     || "",
    relation:       d.relation       || "",
    selfieUrl:      d.selfieUrl      || "",
    approvalStatus: d.approvalStatus || "Authorized",
    verifiedBy:     d.verifiedBy     || "",
    checkoutTime:   d.checkoutTime   || "",
    schoolId:       d.schoolId       || SCHOOL_ID,
    centerId:       d.centerId       || d.center || "",
    center:         d.centerId       || d.center || "",
    createdAt:      d.createdAt      || "",
    updatedAt:      d.updatedAt      || "",
  };
}

async function getAll(studentId, { schoolId = SCHOOL_ID, centerId } = {}) {
  let q = col()
    .where("schoolId", "==", schoolId)
    .where("type",     "==", "history");
  if (studentId) q = q.where("studentId", "==", studentId);
  const snap = await q.get();
  let entries = snap.docs.map(docToHistory);
  if (centerId) entries = entries.filter(e => e.centerId === centerId);
  // Sort newest first in JS to avoid composite index requirement
  entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return entries;
}

async function getOne(entryId) {
  const ref  = col().doc(entryId);
  const snap = await ref.get();
  if (!snap.exists || snap.data().type !== "history") return null;
  return docToHistory(snap);
}

async function record(data, { schoolId = SCHOOL_ID, centerId = "", actorUserId = "system" } = {}) {
  const entryId        = `HIST-${Date.now()}`;
  const resolvedCenter = centerId || data.centerId || data.center || "";
  const doc = {
    entryId,
    type:           "history",
    date:           data.date           || new Date().toISOString().slice(0, 10),
    studentId:      data.studentId      || "",
    studentName:    data.studentName    || "",
    pickupName:     data.pickupName     || "",
    relation:       data.relation       || "",
    selfieUrl:      data.selfieUrl      || "",
    approvalStatus: data.approvalStatus || "Authorized",
    verifiedBy:     data.verifiedBy     || actorUserId,
    checkoutTime:   data.checkoutTime   || new Date().toTimeString().slice(0, 8),
    schoolId,
    centerId:       resolvedCenter,
    center:         resolvedCenter,
    createdAt:      nowISO(),
    updatedAt:      nowISO(),
    createdBy:      actorUserId,
    updatedBy:      actorUserId,
  };
  await col().doc(entryId).set(doc);
  return docToHistory({ id: entryId, data: () => doc });
}

module.exports = { getAll, getOne, record };
