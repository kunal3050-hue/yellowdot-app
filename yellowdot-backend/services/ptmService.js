/**
 * ptmService.js — PTM (Parent-Teacher Meetings) data layer
 * ──────────────────────────────────────────────────────────
 * Collections:
 *   ptms         — meeting records
 *   ptmSlots     — individual appointment slots per teacher
 *   ptmBookings  — parent slot bookings
 *   ptmNotes     — teacher-written meeting notes (optional share to parent)
 */

const { db } = require("../firebaseAdmin");

const SCHOOL_ID = process.env.SCHOOL_ID || "ydseawoods";
const nowISO    = () => new Date().toISOString();

const ptmCol      = () => db.collection("ptms");
const slotCol     = () => db.collection("ptmSlots");
const bookingCol  = () => db.collection("ptmBookings");
const notesCol    = () => db.collection("ptmNotes");

// ── Helpers ────────────────────────────────────────────────────────

function timeToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
}

function nanoid6() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// ── PTMs ───────────────────────────────────────────────────────────

async function getPtms({ schoolId = SCHOOL_ID } = {}) {
  const snap = await ptmCol().where("schoolId", "==", schoolId).orderBy("meetingDate", "desc").get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getPtm(id) {
  const doc = await ptmCol().doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

async function createPtm(data, { schoolId = SCHOOL_ID, actorUserId } = {}) {
  const id  = `PTM-${Date.now()}-${nanoid6()}`;
  const now = nowISO();
  const payload = {
    schoolId,
    title:        data.title,
    description:  data.description || "",
    meetingDate:  data.meetingDate,
    startTime:    data.startTime,
    endTime:      data.endTime,
    venue:        data.venue || "",
    appliesTo:    data.appliesTo || "all",
    classIds:     data.classIds  || [],
    teacherIds:   data.teacherIds || [],
    createdBy:    actorUserId || "",
    createdAt:    now,
    updatedAt:    now,
  };
  await ptmCol().doc(id).set(payload);
  return { id, ...payload };
}

async function updatePtm(id, data, { actorUserId } = {}) {
  const now = nowISO();
  const allowed = ["title","description","meetingDate","startTime","endTime","venue","appliesTo","classIds","teacherIds"];
  const patch = { updatedAt: now };
  for (const k of allowed) {
    if (data[k] !== undefined) patch[k] = data[k];
  }
  await ptmCol().doc(id).update(patch);
  const updated = await getPtm(id);
  return updated;
}

async function deletePtm(id) {
  // Also delete all slots, bookings, notes for this PTM
  await ptmCol().doc(id).delete();
  const [slots, bookings, notes] = await Promise.all([
    slotCol().where("ptmId","==",id).get(),
    bookingCol().where("ptmId","==",id).get(),
    notesCol().where("ptmId","==",id).get(),
  ]);
  const batch = db.batch();
  slots.docs.forEach(d    => batch.delete(d.ref));
  bookings.docs.forEach(d => batch.delete(d.ref));
  notes.docs.forEach(d    => batch.delete(d.ref));
  await batch.commit();
}

// ── Slots ──────────────────────────────────────────────────────────

async function getSlotsForPtm(ptmId) {
  const snap = await slotCol().where("ptmId","==",ptmId).orderBy("teacherId").orderBy("startTime").get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getSlotsForPtmAndTeacher(ptmId, teacherId) {
  const snap = await slotCol()
    .where("ptmId","==",ptmId)
    .where("teacherId","==",teacherId)
    .orderBy("startTime")
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Auto-generate slots for a teacher within a PTM's time range.
 * Deletes any existing slots for this teacher in this PTM before creating.
 * Returns the newly created slots.
 */
async function generateSlots({ ptmId, teacherId, teacherName, startTime, endTime, durationMinutes }) {
  // Delete existing slots for this teacher in this PTM (that are not booked)
  const existingSnap = await slotCol()
    .where("ptmId","==",ptmId)
    .where("teacherId","==",teacherId)
    .get();

  const batch = db.batch();
  const bookedIds = new Set();
  for (const doc of existingSnap.docs) {
    if (doc.data().status === "booked") {
      bookedIds.add(doc.id);
    } else {
      batch.delete(doc.ref);
    }
  }

  // Generate new slots
  const start = timeToMinutes(startTime);
  const end   = timeToMinutes(endTime);
  const newSlots = [];

  for (let cur = start; cur + durationMinutes <= end; cur += durationMinutes) {
    const slotStart = minutesToTime(cur);
    const slotEnd   = minutesToTime(cur + durationMinutes);
    const slotId    = `SLOT-${ptmId}-${teacherId}-${slotStart.replace(":","")}-${nanoid6()}`;
    const payload   = {
      ptmId,
      teacherId,
      teacherName: teacherName || "",
      startTime:   slotStart,
      endTime:     slotEnd,
      status:      "available",
      createdAt:   nowISO(),
    };
    batch.set(slotCol().doc(slotId), payload);
    newSlots.push({ id: slotId, ...payload });
  }

  await batch.commit();
  return newSlots;
}

async function deleteSlot(slotId) {
  const doc = await slotCol().doc(slotId).get();
  if (!doc.exists) throw new Error("Slot not found");
  if (doc.data().status === "booked") throw new Error("Cannot delete a booked slot");
  await slotCol().doc(slotId).delete();
}

// ── Bookings ───────────────────────────────────────────────────────

async function getBookingsForPtm(ptmId) {
  const snap = await bookingCol().where("ptmId","==",ptmId).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getBookingForStudent(ptmId, studentId) {
  const snap = await bookingCol()
    .where("ptmId","==",ptmId)
    .where("studentId","==",studentId)
    .where("status","!=","cancelled")
    .get();
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

async function bookSlot({ ptmId, slotId, studentId, parentId }) {
  // Check slot exists and is available
  const slotDoc = await slotCol().doc(slotId).get();
  if (!slotDoc.exists) throw new Error("Slot not found");
  if (slotDoc.data().status !== "available") throw new Error("Slot is not available");

  // Enforce one booking per student per PTM
  const existing = await getBookingForStudent(ptmId, studentId);
  if (existing) throw new Error("Already has a booking for this PTM");

  const bookingId = `BOOK-${ptmId}-${studentId}-${nanoid6()}`;
  const now = nowISO();
  const booking = {
    ptmId,
    slotId,
    studentId,
    parentId,
    status:    "confirmed",
    bookedAt:  now,
    updatedAt: now,
  };

  const batch = db.batch();
  batch.set(bookingCol().doc(bookingId), booking);
  batch.update(slotCol().doc(slotId), { status: "booked", bookingId, studentId, parentId, updatedAt: now });
  await batch.commit();

  return { id: bookingId, ...booking };
}

async function rescheduleBooking(bookingId, newSlotId, { parentId } = {}) {
  const bookDoc = await bookingCol().doc(bookingId).get();
  if (!bookDoc.exists) throw new Error("Booking not found");
  const booking = bookDoc.data();
  if (booking.status === "cancelled") throw new Error("Booking is already cancelled");

  // Validate new slot
  const newSlotDoc = await slotCol().doc(newSlotId).get();
  if (!newSlotDoc.exists) throw new Error("New slot not found");
  if (newSlotDoc.data().status !== "available") throw new Error("New slot is not available");

  const now = nowISO();
  const batch = db.batch();
  // Free old slot
  batch.update(slotCol().doc(booking.slotId), { status: "available", bookingId: null, studentId: null, parentId: null, updatedAt: now });
  // Reserve new slot
  batch.update(slotCol().doc(newSlotId), { status: "booked", bookingId, studentId: booking.studentId, parentId: booking.parentId, updatedAt: now });
  // Update booking
  batch.update(bookingCol().doc(bookingId), { slotId: newSlotId, status: "confirmed", rescheduledAt: now, updatedAt: now });
  await batch.commit();

  return { id: bookingId, ...booking, slotId: newSlotId, status: "confirmed", rescheduledAt: now };
}

async function cancelBooking(bookingId, { parentId } = {}) {
  const bookDoc = await bookingCol().doc(bookingId).get();
  if (!bookDoc.exists) throw new Error("Booking not found");
  const booking = bookDoc.data();
  if (booking.status === "cancelled") throw new Error("Already cancelled");

  const now = nowISO();
  const batch = db.batch();
  batch.update(bookingCol().doc(bookingId), { status: "cancelled", cancelledAt: now, updatedAt: now });
  batch.update(slotCol().doc(booking.slotId), { status: "available", bookingId: null, studentId: null, parentId: null, updatedAt: now });
  await batch.commit();
}

async function updateBookingStatus(bookingId, status) {
  const validStatuses = ["confirmed","attended","missed","cancelled"];
  if (!validStatuses.includes(status)) throw new Error("Invalid status");
  const now = nowISO();
  await bookingCol().doc(bookingId).update({ status, updatedAt: now });
}

// ── Notes ──────────────────────────────────────────────────────────

async function getNotes(ptmId, studentId) {
  const id  = `NOTE-${ptmId}-${studentId}`;
  const doc = await notesCol().doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

async function upsertNotes({ ptmId, studentId, teacherId, summary, strengths, improvements, actionItems, sharedWithParent }) {
  const id  = `NOTE-${ptmId}-${studentId}`;
  const now = nowISO();
  const existing = await notesCol().doc(id).get();
  const payload = {
    ptmId,
    studentId,
    teacherId: teacherId || "",
    summary:        summary        || "",
    strengths:      strengths      || "",
    improvements:   improvements   || "",
    actionItems:    actionItems    || "",
    sharedWithParent: sharedWithParent ?? false,
    updatedAt: now,
  };
  if (!existing.exists) {
    payload.createdAt = now;
    await notesCol().doc(id).set(payload);
  } else {
    await notesCol().doc(id).update(payload);
  }
  return { id, ...payload };
}

async function getSharedNotesForStudent(ptmId, studentId) {
  const notes = await getNotes(ptmId, studentId);
  if (!notes || !notes.sharedWithParent) return null;
  return notes;
}

// ── Dashboard stats ────────────────────────────────────────────────

async function getPtmStats(ptmId) {
  const slots    = await getSlotsForPtm(ptmId);
  const bookings = await getBookingsForPtm(ptmId);
  const total    = slots.length;
  const booked   = slots.filter(s => s.status === "booked").length;
  const attended = bookings.filter(b => b.status === "attended").length;
  const missed   = bookings.filter(b => b.status === "missed").length;
  return { total, booked, available: total - booked, attended, missed };
}

module.exports = {
  getPtms, getPtm, createPtm, updatePtm, deletePtm,
  getSlotsForPtm, getSlotsForPtmAndTeacher, generateSlots, deleteSlot,
  getBookingsForPtm, getBookingForStudent, bookSlot, rescheduleBooking, cancelBooking, updateBookingStatus,
  getNotes, upsertNotes, getSharedNotesForStudent,
  getPtmStats,
};
