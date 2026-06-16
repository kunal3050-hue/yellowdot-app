/**
 * communicationService.js
 * Firestore service for: holidays, notices, announcements
 *
 * Collections:
 *   holidays/{id}      — school calendar closures
 *   notices/{id}       — formal parent communications / circulars
 *   announcements/{id} — quick updates & live feed posts
 */

const { db } = require("../firebaseAdmin");

const SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";

function nowISO() { return new Date().toISOString(); }
function uid(prefix) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }

// ── HOLIDAYS ──────────────────────────────────────────────────────────────────

const hCol = () => db.collection("holidays");

async function getHolidays({ schoolId = SCHOOL_ID, year } = {}) {
  let q = hCol().where("schoolId", "==", schoolId);
  const snap = await q.get();
  let list = snap.docs.map(d => d.data());
  if (year) list = list.filter(h => (h.startDate || "").startsWith(year));
  return list.sort((a, b) => (a.startDate || "").localeCompare(b.startDate || ""));
}

async function createHoliday(data, { schoolId = SCHOOL_ID, actorUserId = "system" } = {}) {
  const id  = uid("HOL");
  const doc = {
    id, schoolId,
    title:         data.title         || "",
    startDate:     data.startDate     || "",
    endDate:       data.endDate       || data.startDate || "",
    type:          data.type          || "School Holiday",
    description:   data.description   || "",
    recurring:     data.recurring     ?? false,
    pushToParents: data.pushToParents ?? true,
    appliesTo:     data.appliesTo     || "all",
    classIds:      data.classIds      || [],
    centers:       data.centers       || [],
    createdAt:     nowISO(),
    updatedAt:     nowISO(),
    createdBy:     actorUserId,
  };
  await hCol().doc(id).set(doc);
  return doc;
}

async function updateHoliday(id, data, { actorUserId = "system" } = {}) {
  const ref  = hCol().doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const update = { ...data, updatedAt: nowISO(), updatedBy: actorUserId };
  await ref.update(update);
  return { ...snap.data(), ...update };
}

async function deleteHoliday(id) {
  const ref  = hCol().doc(id);
  const snap = await ref.get();
  if (!snap.exists) return false;
  await ref.delete();
  return true;
}

// ── NOTICES ───────────────────────────────────────────────────────────────────

const nCol = () => db.collection("notices");

async function getNotices({ schoolId = SCHOOL_ID, status, type } = {}) {
  const snap = await nCol().where("schoolId", "==", schoolId).get();
  let list   = snap.docs.map(d => d.data());
  if (status) list = list.filter(n => n.status === status);
  if (type)   list = list.filter(n => n.type   === type);
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function createNotice(data, { schoolId = SCHOOL_ID, actorUserId = "system" } = {}) {
  const id  = uid("NTC");
  const doc = {
    id, schoolId,
    title:       data.title      || "",
    body:        data.body       || "",
    type:        data.type       || "General",
    status:      data.status     || "draft",
    publishAt:   data.publishAt  || null,
    expiresAt:   data.expiresAt  || null,
    requireAck:  data.requireAck ?? false,
    audience:    data.audience   || { classes: [], centers: [] },
    attachments: data.attachments || [],
    createdAt:   nowISO(),
    updatedAt:   nowISO(),
    createdBy:   actorUserId,
  };
  await nCol().doc(id).set(doc);
  return doc;
}

async function updateNotice(id, data, { actorUserId = "system" } = {}) {
  const ref  = nCol().doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const update = { ...data, updatedAt: nowISO(), updatedBy: actorUserId };
  await ref.update(update);
  return { ...snap.data(), ...update };
}

async function deleteNotice(id) {
  const ref  = nCol().doc(id);
  const snap = await ref.get();
  if (!snap.exists) return false;
  await ref.delete();
  return true;
}

// ── ANNOUNCEMENTS ─────────────────────────────────────────────────────────────

const aCol = () => db.collection("announcements");

async function getAnnouncements({ schoolId = SCHOOL_ID, type } = {}) {
  const snap = await aCol().where("schoolId", "==", schoolId).get();
  let list   = snap.docs.map(d => d.data());
  if (type) list = list.filter(a => a.type === type);
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function createAnnouncement(data, { schoolId = SCHOOL_ID, actorUserId = "system" } = {}) {
  const id  = uid("ANN");
  const doc = {
    id, schoolId,
    title:           data.title           || "",
    body:            data.body            || "",
    type:            data.type            || "General",
    mediaUrl:        data.mediaUrl        || "",
    publishAt:       data.publishAt       || nowISO(),
    commentsEnabled: data.commentsEnabled ?? false,
    audience:        data.audience        || { classes: [], centers: [] },
    seenCount:       0,
    reactions:       {},
    createdAt:       nowISO(),
    updatedAt:       nowISO(),
    createdBy:       actorUserId,
  };
  await aCol().doc(id).set(doc);
  return doc;
}

async function updateAnnouncement(id, data, { actorUserId = "system" } = {}) {
  const ref  = aCol().doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const update = { ...data, updatedAt: nowISO(), updatedBy: actorUserId };
  await ref.update(update);
  return { ...snap.data(), ...update };
}

async function deleteAnnouncement(id) {
  const ref  = aCol().doc(id);
  const snap = await ref.get();
  if (!snap.exists) return false;
  await ref.delete();
  return true;
}

module.exports = {
  getHolidays, createHoliday, updateHoliday, deleteHoliday,
  getNotices,  createNotice,  updateNotice,  deleteNotice,
  getAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement,
};
