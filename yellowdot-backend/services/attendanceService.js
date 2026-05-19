/**
 * attendanceService.js — Firestore-backed attendance records
 * ───────────────────────────────────────────────────────────
 * Collection: attendance/{entryId}
 *
 * Isolation:
 *   schoolId — stored on every document
 *   centerId — stored and used as optional filter
 *
 * Deterministic IDs: ATT-{date}-{studentId}
 * Timestamps: createdAt (first mark), updatedAt (each change)
 */

const { db } = require("../firebaseAdmin");

const SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";
const col       = () => db.collection("attendance");
const nowISO    = () => new Date().toISOString();
const todayISO  = () => new Date().toISOString().slice(0, 10);
const timeStr   = () => new Date().toTimeString().slice(0, 8);

// ── Document mapper ────────────────────────────────────────────────

function docToRecord(snap) {
  const d  = snap.data ? snap.data() : snap;
  const id = snap.id   || d.entryId  || "";
  return {
    entryId:     d.entryId     || id,
    date:        d.date        || "",
    studentId:   d.studentId   || "",
    studentName: d.studentName || "",
    class:       d.class       || "",
    status:      d.status      || "Absent",
    checkIn:     d.checkIn     || "",
    checkOut:    d.checkOut    || "",
    method:      d.method      || "Manual",
    centerId:    d.centerId    || d.center || "",
    center:      d.centerId    || d.center || "",
    schoolId:    d.schoolId    || SCHOOL_ID,
    markedBy:    d.markedBy    || "",
    createdAt:   d.createdAt   || "",
    updatedAt:   d.updatedAt   || "",
  };
}

// ── Read ───────────────────────────────────────────────────────────

/**
 * Fetch attendance records.
 * Filters: date, class, centerId, studentId.
 * schoolId is mandatory for multi-tenant safety.
 */
async function getAttendance({ date, class: cls, centerId, studentId, schoolId = SCHOOL_ID } = {}) {
  let q = col().where("schoolId", "==", schoolId);
  if (date)      q = q.where("date",      "==", date);
  if (studentId) q = q.where("studentId", "==", studentId);

  const snap    = await q.get();
  let records   = snap.docs.map(docToRecord);

  // In-memory filters to avoid composite index requirements
  if (cls)      records = records.filter(r => r.class    === cls);
  if (centerId) records = records.filter(r => r.centerId === centerId);

  records.sort((a, b) => a.studentName.localeCompare(b.studentName));
  return { entries: records };
}

/**
 * Aggregate summary for a given date.
 */
async function getAttendanceSummary(date, { schoolId = SCHOOL_ID, centerId } = {}) {
  const d    = date || todayISO();
  let q      = col().where("schoolId", "==", schoolId).where("date", "==", d);
  const snap = await q.get();
  let records = snap.docs.map(docToRecord);
  if (centerId) records = records.filter(r => r.centerId === centerId);

  return {
    date:    d,
    total:   records.length,
    present: records.filter(r => r.status === "Present").length,
    absent:  records.filter(r => r.status === "Absent").length,
    late:    records.filter(r => r.status === "Late").length,
  };
}

/**
 * Students currently inside (checked in, not checked out).
 */
async function getStudentsInside(date, { schoolId = SCHOOL_ID, centerId } = {}) {
  const d    = date || todayISO();
  let q      = col()
    .where("schoolId", "==", schoolId)
    .where("date",     "==", d)
    .where("status",   "in", ["Present", "Late"]);
  const snap = await q.get();
  let records = snap.docs.map(docToRecord).filter(r => !r.checkOut);
  if (centerId) records = records.filter(r => r.centerId === centerId);
  return records;
}

/**
 * Attendance history with date-range and optional student filter.
 */
async function getAttendanceHistory({ studentId, from, to, limit: lim = 100, schoolId = SCHOOL_ID, centerId } = {}) {
  let q = col().where("schoolId", "==", schoolId);
  if (studentId) q = q.where("studentId", "==", studentId);
  if (from)      q = q.where("date", ">=", from);
  if (to)        q = q.where("date", "<=", to);
  q = q.orderBy("date", "desc").limit(Number(lim) || 100);
  const snap    = await q.get();
  let records   = snap.docs.map(docToRecord);
  if (centerId) records = records.filter(r => r.centerId === centerId);
  return records;
}

// ── Write ──────────────────────────────────────────────────────────

/**
 * Mark or update attendance for one student on one day.
 * Uses deterministic ID (ATT-{date}-{studentId}) — upsert safe.
 */
async function markAttendance({
  studentId, studentName, class: cls, status, date,
  method, centerId, center, markedBy, schoolId = SCHOOL_ID,
}) {
  const d         = date || todayISO();
  const entryId   = `ATT-${d}-${studentId}`;
  const ref       = col().doc(entryId);
  const existing  = await ref.get();
  const resolvedCenter = centerId || center || "";

  const doc = {
    entryId,
    date:        d,
    studentId:   studentId   || "",
    studentName: studentName || "",
    class:       cls         || "",
    status:      status      || "Present",
    checkIn:     existing.exists ? (existing.data().checkIn || timeStr()) : timeStr(),
    checkOut:    existing.exists ? (existing.data().checkOut || "") : "",
    method:      method      || "Manual",
    centerId:    resolvedCenter,
    center:      resolvedCenter,
    schoolId,
    markedBy:    markedBy    || "",
    createdAt:   existing.exists ? (existing.data().createdAt || nowISO()) : nowISO(),
    updatedAt:   nowISO(),
  };

  if (status === "Absent") { doc.checkIn = ""; doc.checkOut = ""; }

  await ref.set(doc, { merge: true });
  return doc;
}

/**
 * Record check-out for an attendance entry.
 */
async function checkOut(entryId) {
  const ref  = col().doc(entryId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const t = timeStr();
  await ref.update({ checkOut: t, updatedAt: nowISO() });
  return { ...docToRecord(snap), checkOut: t };
}

/**
 * Process a QR code scan: check-in on first scan, check-out on second.
 */
async function processQRScan({ studentId, studentName, class: cls, centerId, center, schoolId = SCHOOL_ID }) {
  const d        = todayISO();
  const entryId  = `ATT-${d}-${studentId}`;
  const ref      = col().doc(entryId);
  const existing = await ref.get();

  if (existing.exists) {
    const rec = existing.data();
    if (rec.status !== "Absent" && !rec.checkOut) {
      const t = timeStr();
      await ref.update({ checkOut: t, updatedAt: nowISO() });
      return { action: "checkout", record: { ...docToRecord(existing), checkOut: t } };
    }
    if (rec.checkOut) return { action: "already_out", record: docToRecord(existing) };
  }

  const record = await markAttendance({
    studentId, studentName, class: cls, status: "Present",
    date: d, method: "QR", centerId, center, schoolId,
  });
  return { action: "checkin", record };
}

module.exports = {
  getAttendance,
  getAttendanceSummary,
  getStudentsInside,
  getAttendanceHistory,
  markAttendance,
  checkOut,
  processQRScan,
};
