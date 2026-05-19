/**
 * napService.js — Firestore-backed nap tracker
 * ──────────────────────────────────────────────
 * Collection: napLogs/{napId}
 * Fields: napId, studentId, studentName, class, date,
 *         startTime, endTime, duration, status,
 *         schoolId, centerId, center, createdAt, updatedAt
 */

const { db } = require("../firebaseAdmin");

const SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";
const col = () => db.collection("napLogs");

function todayISO() { return new Date().toISOString().slice(0, 10); }
function timeStr()  { return new Date().toTimeString().slice(0, 8); }
function nowISO()   { return new Date().toISOString(); }

function docToNap(snap) {
  const d = snap.data() || {};
  return {
    napId:       d.napId       || snap.id,
    studentId:   d.studentId   || "",
    studentName: d.studentName || "",
    class:       d.class       || "",
    date:        d.date        || "",
    startTime:   d.startTime   || "",
    endTime:     d.endTime     || null,
    duration:    d.duration    || null,   // minutes
    status:      d.status      || "sleeping",
    schoolId:    d.schoolId    || SCHOOL_ID,
    centerId:    d.centerId    || d.center || "",
    center:      d.centerId    || d.center || "",
    createdAt:   d.createdAt   || "",
    updatedAt:   d.updatedAt   || "",
  };
}

function minutesBetween(start, end) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

// ── Read ───────────────────────────────────────────────────────────

async function getActiveNaps(date, { schoolId = SCHOOL_ID, centerId } = {}) {
  const d    = date || todayISO();
  const snap = await col()
    .where("schoolId", "==", schoolId)
    .where("date",     "==", d)
    .get();
  let naps = snap.docs.map(docToNap).filter(n => n.status === "sleeping");
  if (centerId) naps = naps.filter(n => n.centerId === centerId);
  return naps;
}

async function getNapHistory({ date, studentId, limit: lim = 50, schoolId = SCHOOL_ID, centerId } = {}) {
  let q = col().where("schoolId", "==", schoolId);
  if (date)      q = q.where("date",      "==", date);
  if (studentId) q = q.where("studentId", "==", studentId);
  const snap = await q.get();
  let naps = snap.docs.map(docToNap);
  if (centerId) naps = naps.filter(n => n.centerId === centerId);
  // Sort newest first in JS to avoid composite index requirement
  naps.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return naps.slice(0, Number(lim) || 50);
}

async function getTodayStats(date, { schoolId = SCHOOL_ID, centerId } = {}) {
  const d    = date || todayISO();
  const snap = await col()
    .where("schoolId", "==", schoolId)
    .where("date",     "==", d)
    .get();
  let naps = snap.docs.map(docToNap);
  if (centerId) naps = naps.filter(n => n.centerId === centerId);
  const done  = naps.filter(n => n.status === "done");
  const total = done.reduce((s, n) => s + (n.duration || 0), 0);
  return {
    date:         d,
    totalNaps:    naps.length,
    active:       naps.filter(n => n.status === "sleeping").length,
    completed:    done.length,
    avgMinutes:   done.length ? Math.round(total / done.length) : 0,
    totalMinutes: total,
  };
}

// ── Write ──────────────────────────────────────────────────────────

async function startNap({ studentId, studentName, class: cls, center, centerId, date, schoolId = SCHOOL_ID, actorUserId = "system" }) {
  const d        = date || todayISO();
  const napId    = `NAP-${Date.now()}-${studentId}`;
  const resolvedCenter = centerId || center || "";
  const doc = {
    napId,
    studentId:   studentId   || "",
    studentName: studentName || "",
    class:       cls         || "",
    date:        d,
    startTime:   timeStr(),
    endTime:     null,
    duration:    null,
    status:      "sleeping",
    schoolId,
    centerId:    resolvedCenter,
    center:      resolvedCenter,
    createdAt:   nowISO(),
    updatedAt:   nowISO(),
    createdBy:   actorUserId,
    updatedBy:   actorUserId,
  };
  await col().doc(napId).set(doc);
  return docToNap({ id: napId, data: () => doc });
}

async function wakeUp(napId, { updatedBy = "system" } = {}) {
  const ref  = col().doc(napId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const d        = snap.data();
  const endTime  = timeStr();
  const duration = minutesBetween(d.startTime || "00:00", endTime);
  const updates  = { endTime, duration: Math.max(0, duration), status: "done", updatedAt: nowISO(), updatedBy };
  await ref.update(updates);
  return { ...docToNap(snap), ...updates };
}

module.exports = { getActiveNaps, getNapHistory, getTodayStats, startNap, wakeUp };
