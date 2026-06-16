/**
 * eventService.js — Events module (Communications)
 *
 * Collections:
 *   events/{id}       — school events (calendar-ready)
 *   eventRsvps/{id}   — per-student RSVP responses
 */

const { db } = require("../firebaseAdmin");

const SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";

function nowISO() { return new Date().toISOString(); }
function uid(prefix) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }

// ── EVENTS ────────────────────────────────────────────────────────────────────

const eCol = () => db.collection("events");

async function getEvents({ schoolId = SCHOOL_ID } = {}) {
  const snap = await eCol().where("schoolId", "==", schoolId).get();
  const list = snap.docs.map(d => d.data());
  return list.sort((a, b) => (a.eventDate || "").localeCompare(b.eventDate || ""));
}

async function getEvent(id) {
  const snap = await eCol().doc(id).get();
  return snap.exists ? snap.data() : null;
}

async function createEvent(data, { schoolId = SCHOOL_ID, actorUserId = "system" } = {}) {
  const id  = uid("EVT");
  const doc = {
    id, schoolId,
    title:           data.title           || "",
    description:     data.description     || "",
    eventDate:       data.eventDate       || "",
    startTime:       data.startTime       || "",
    endTime:         data.endTime         || "",
    venue:           data.venue           || "",
    appliesTo:       data.appliesTo       || "all",
    classIds:        data.classIds        || [],
    rsvpRequired:    data.rsvpRequired    ?? false,
    pushToParentApp: data.pushToParentApp ?? true,
    createdBy:       actorUserId,
    createdAt:       nowISO(),
    updatedAt:       nowISO(),
  };
  await eCol().doc(id).set(doc);
  return doc;
}

async function updateEvent(id, data, { actorUserId = "system" } = {}) {
  const ref  = eCol().doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const update = { ...data, updatedAt: nowISO(), updatedBy: actorUserId };
  delete update.id;
  delete update.schoolId;
  delete update.createdAt;
  delete update.createdBy;
  await ref.update(update);
  return { ...snap.data(), ...update };
}

async function deleteEvent(id) {
  const ref  = eCol().doc(id);
  const snap = await ref.get();
  if (!snap.exists) return false;
  await ref.delete();
  return true;
}

// ── EVENT RSVPs ───────────────────────────────────────────────────────────────

const rCol = () => db.collection("eventRsvps");

async function getRsvpsForEvent(eventId) {
  const snap = await rCol().where("eventId", "==", eventId).get();
  return snap.docs.map(d => d.data());
}

async function getRsvpCount(eventId) {
  const snap = await rCol()
    .where("eventId", "==", eventId)
    .where("response", "==", "attending")
    .get();
  return snap.size;
}

async function upsertRsvp({ eventId, studentId, parentId, response }) {
  const id   = `${eventId}_${studentId}`;
  const doc  = {
    id, eventId, studentId, parentId,
    response,           // "attending" | "not_attending" | "maybe"
    respondedAt: nowISO(),
  };
  await rCol().doc(id).set(doc, { merge: true });
  return doc;
}

async function getParentRsvp({ eventId, studentId }) {
  const snap = await rCol().doc(`${eventId}_${studentId}`).get();
  return snap.exists ? snap.data() : null;
}

module.exports = {
  getEvents, getEvent, createEvent, updateEvent, deleteEvent,
  getRsvpsForEvent, getRsvpCount, upsertRsvp, getParentRsvp,
};
