/**
 * parentAttendanceService.js — Firestore-backed parent attendance
 * ────────────────────────────────────────────────────────────────
 * Collection: parentAttendance/{entryId}
 * Fields: entryId, date, studentId, studentName, parentName, relation,
 *         action, time, gate, selfieImage, faceDetected,
 *         attendanceMethod, gps,
 *         schoolId, centerId, center, createdAt, updatedAt
 */

const { db } = require("../firebaseAdmin");

const SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";
const col = () => db.collection("parentAttendance");

function nowISO() { return new Date().toISOString(); }

function docToEntry(snap) {
  const d = snap.data() || {};
  return {
    entryId:          d.entryId          || snap.id,
    date:             d.date             || "",
    studentId:        d.studentId        || "",
    studentName:      d.studentName      || "",
    parentName:       d.parentName       || "",
    relation:         d.relation         || "",
    action:           d.action           || "",
    time:             d.time             || "",
    gate:             d.gate             || "",
    selfieImage:      d.selfieImage      || "",
    faceDetected:     d.faceDetected     || "false",
    attendanceMethod: d.attendanceMethod || "Parent_QR",
    gps:              d.gps              || "unavailable",
    schoolId:         d.schoolId         || SCHOOL_ID,
    centerId:         d.centerId         || d.center || "",
    center:           d.centerId         || d.center || "",
    createdAt:        d.createdAt        || "",
    updatedAt:        d.updatedAt        || "",
  };
}

// ── Read ───────────────────────────────────────────────────────────

async function getAll({ date, studentId, gate, class: cls, schoolId = SCHOOL_ID, centerId } = {}) {
  let q = col().where("schoolId", "==", schoolId);
  if (date)      q = q.where("date",      "==", date);
  if (studentId) q = q.where("studentId", "==", studentId);
  const snap = await q.get();
  let entries = snap.docs.map(docToEntry);
  if (gate)     entries = entries.filter(e => e.gate?.includes(gate));
  if (cls)      entries = entries.filter(e => e.studentClass === cls);
  if (centerId) entries = entries.filter(e => e.centerId === centerId);
  // Sort newest first in JS
  entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return entries;
}

// ── Write ──────────────────────────────────────────────────────────

async function record(data, { schoolId = SCHOOL_ID, centerId = "", actorUserId = "system" } = {}) {
  const entryId        = `PATT-${Date.now()}`;
  const now            = new Date();
  const resolvedCenter = centerId || data.centerId || data.center || "";
  const doc = {
    entryId,
    date:             data.date             || now.toISOString().slice(0, 10),
    studentId:        data.studentId        || "",
    studentName:      data.studentName      || "",
    parentName:       data.parentName       || "",
    relation:         data.relation         || "Guardian",
    action:           data.action           || "Check_In",
    time:             data.time             || now.toTimeString().slice(0, 8),
    gate:             data.gate             || "",
    selfieImage:      data.selfieImage      || "",
    faceDetected:     String(data.faceDetected || "false"),
    attendanceMethod: data.attendanceMethod || "Parent_QR",
    gps:              data.gps              || "unavailable",
    schoolId,
    centerId:         resolvedCenter,
    center:           resolvedCenter,
    createdAt:        nowISO(),
    updatedAt:        nowISO(),
    createdBy:        actorUserId,
    updatedBy:        actorUserId,
  };
  await col().doc(entryId).set(doc);
  return docToEntry({ id: entryId, data: () => doc });
}

module.exports = { getAll, record };
