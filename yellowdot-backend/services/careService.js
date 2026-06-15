/**
 * careService.js — Firestore-backed Care & Hygiene tracker
 * ─────────────────────────────────────────────────────────
 * Collection: careLogs/{logId}
 *
 * Fields: logId, studentId, studentName, class, schoolId, centerId,
 *         type, notes, loggedBy, date, loggedAt, createdAt, updatedAt
 *
 * Types: "Motion" | "Both" | "Diaper Change"
 */

const { db } = require("../firebaseAdmin");

const SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";
const col     = () => db.collection("careLogs");
const nowISO  = () => new Date().toISOString();
const todayISO = () => new Date().toISOString().slice(0, 10);

const VALID_TYPES = ["Urine", "Motion", "Both", "Diaper Change", "Toilet Visit", "Accident", "Water Refilled"];

function docToLog(snap) {
  const d  = snap.data ? snap.data() : snap;
  const id = snap.id   || d.logId || "";
  return {
    logId:       d.logId       || id,
    studentId:   d.studentId   || "",
    studentName: d.studentName || "",
    class:       d.class       || "",
    schoolId:    d.schoolId    || SCHOOL_ID,
    centerId:    d.centerId    || "",
    type:        d.type        || "",
    notes:       d.notes       || "",
    loggedBy:    d.loggedBy    || "",
    date:        d.date        || "",
    loggedAt:    d.loggedAt    || "",
    createdAt:   d.createdAt   || "",
    updatedAt:   d.updatedAt   || "",
  };
}

/**
 * Create a new care log entry.
 */
async function logCare({ studentId, studentName, class: cls, type, notes, loggedBy, date, centerId, schoolId = SCHOOL_ID }) {
  if (!studentId)             throw new Error("studentId is required.");
  if (!VALID_TYPES.includes(type)) throw new Error(`type must be one of: ${VALID_TYPES.join(", ")}.`);

  const d      = date || todayISO();
  const ref    = col().doc();
  const logId  = ref.id;
  const now    = nowISO();

  const doc = {
    logId,
    studentId:   studentId   || "",
    studentName: studentName || "",
    class:       cls         || "",
    schoolId,
    centerId:    centerId    || "",
    type,
    notes:       notes       || "",
    loggedBy:    loggedBy    || "",
    date:        d,
    loggedAt:    now,
    createdAt:   now,
    updatedAt:   now,
  };

  await ref.set(doc);
  return doc;
}

/**
 * Fetch care logs for a child or classroom.
 * Filters: studentId, date, from, to, type, centerId.
 */
async function getCareHistory({ studentId, date, from, to, type, centerId, limit: lim = 100, schoolId = SCHOOL_ID } = {}) {
  let q = col().where("schoolId", "==", schoolId);
  if (studentId) q = q.where("studentId", "==", studentId);
  if (date)      q = q.where("date",      "==", date);
  if (from && !date) q = q.where("date",  ">=", from);
  if (to   && !date) q = q.where("date",  "<=", to);

  q = q.orderBy("loggedAt", "desc").limit(Number(lim) || 100);

  const snap    = await q.get();
  let records   = snap.docs.map(docToLog);

  if (type)     records = records.filter(r => r.type === type);
  if (centerId) records = records.filter(r => r.centerId === centerId);

  return records;
}

/**
 * Daily summary: event counts by type for a given date / classroom.
 */
async function getDailySummary({ date, centerId, schoolId = SCHOOL_ID } = {}) {
  const d  = date || todayISO();
  const q  = col().where("schoolId", "==", schoolId).where("date", "==", d);
  const snap = await q.get();
  let records = snap.docs.map(docToLog);
  if (centerId) records = records.filter(r => r.centerId === centerId);

  const counts = { Urine: 0, Motion: 0, Both: 0, "Diaper Change": 0, "Toilet Visit": 0, Accident: 0, "Water Refilled": 0 };
  const byStudent = {};

  for (const r of records) {
    counts[r.type] = (counts[r.type] || 0) + 1;
    if (!byStudent[r.studentId]) {
      byStudent[r.studentId] = { studentId: r.studentId, studentName: r.studentName, class: r.class, events: [] };
    }
    byStudent[r.studentId].events.push({ type: r.type, loggedAt: r.loggedAt, notes: r.notes });
  }

  return {
    date:    d,
    total:   records.length,
    counts,
    students: Object.values(byStudent),
  };
}

module.exports = { logCare, getCareHistory, getDailySummary, VALID_TYPES };
