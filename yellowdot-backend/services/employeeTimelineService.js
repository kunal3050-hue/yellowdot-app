/**
 * employeeTimelineService.js — Per-staff activity log
 * ─────────────────────────────────────────────────────
 * Collection (top-level): employeeTimeline/{eventId}
 *
 * Each event references the parent staff doc via `staffId` so we can
 * paginate / filter without nested-collection queries.
 *
 * Event types (extensible):
 *   STAFF_CREATED, STAFF_UPDATED, STAFF_STATUS_CHANGED,
 *   DEPARTMENT_CHANGED, DESIGNATION_CHANGED,
 *   NOTE_ADDED, DOCUMENT_UPLOADED
 */

const { db } = require("../firebaseAdmin");

const SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";
const col       = () => db.collection("employeeTimeline");
const nowISO    = () => new Date().toISOString();

async function log(staffId, { type, description, actorUserId = "system", metadata = {}, schoolId = SCHOOL_ID } = {}) {
  try {
    const ref = col().doc();
    await ref.set({
      eventId:     ref.id,
      staffId,
      schoolId,
      type,
      description,
      actorUserId,
      metadata,
      createdAt:   nowISO(),
    });
  } catch (err) {
    // Timeline failures must never break the primary operation.
    console.warn("[employeeTimelineService] log failed:", err.message);
  }
}

async function getForStaff(staffId, { limit = 50 } = {}) {
  try {
    const snap = await col()
      .where("staffId", "==", staffId)
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();
    return snap.docs.map(d => d.data());
  } catch (err) {
    // If composite index is missing, fall back to a non-ordered scan.
    if (err.code === 9 || /index/i.test(err.message)) {
      const snap = await col().where("staffId", "==", staffId).limit(limit).get();
      const rows = snap.docs.map(d => d.data());
      rows.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
      return rows;
    }
    throw err;
  }
}

async function getRecent({ schoolId = SCHOOL_ID, limit = 20 } = {}) {
  try {
    const snap = await col()
      .where("schoolId", "==", schoolId)
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();
    return snap.docs.map(d => d.data());
  } catch (err) {
    if (err.code === 9 || /index/i.test(err.message)) {
      const snap = await col().where("schoolId", "==", schoolId).limit(limit).get();
      const rows = snap.docs.map(d => d.data());
      rows.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
      return rows.slice(0, limit);
    }
    throw err;
  }
}

module.exports = { log, getForStaff, getRecent };
