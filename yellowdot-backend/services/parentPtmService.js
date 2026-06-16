/**
 * parentPtmService.js — Parent-facing PTM view
 * ──────────────────────────────────────────────
 * Class-filtered PTMs with slot availability and booking status per student.
 */

const ptmSvc = require("./ptmService");

function isVisible(meetingDate) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  return new Date(meetingDate) >= cutoff;
}

function ptmStatus(meetingDate) {
  const today = new Date().toISOString().slice(0, 10);
  if (!meetingDate) return "upcoming";
  if (meetingDate < today) return "completed";
  if (meetingDate === today) return "today";
  return "upcoming";
}

async function getPtmsView({ schoolId, studentClassId, studentId, parentId } = {}) {
  const all = await ptmSvc.getPtms({ schoolId });
  const ptms = [];

  for (const ptm of all) {
    if (!isVisible(ptm.meetingDate)) continue;
    if (ptm.appliesTo === "selected") {
      if (studentClassId && !(ptm.classIds || []).includes(studentClassId)) continue;
    }

    const status    = ptmStatus(ptm.meetingDate);
    const slots     = await ptmSvc.getSlotsForPtm(ptm.id);
    const available = slots.filter(s => s.status === "available").length;
    const total     = slots.length;

    let myBooking = null;
    if (studentId) {
      myBooking = await ptmSvc.getBookingForStudent(ptm.id, studentId);
      if (myBooking) {
        // Attach slot details to booking
        const slotDoc = slots.find(s => s.id === myBooking.slotId);
        if (slotDoc) myBooking = { ...myBooking, slot: slotDoc };
      }
    }

    // Group available slots by teacher for the booking UI
    const slotsByTeacher = {};
    for (const slot of slots) {
      if (!slotsByTeacher[slot.teacherId]) {
        slotsByTeacher[slot.teacherId] = { teacherId: slot.teacherId, teacherName: slot.teacherName, slots: [] };
      }
      slotsByTeacher[slot.teacherId].slots.push(slot);
    }

    // Fetch shared notes for this student if meeting is completed
    let notes = null;
    if (status === "completed" && studentId) {
      notes = await ptmSvc.getSharedNotesForStudent(ptm.id, studentId);
    }

    ptms.push({
      ...ptm,
      status,
      totalSlots:     total,
      availableSlots: available,
      myBooking,
      slotsByTeacher: Object.values(slotsByTeacher),
      notes,
    });
  }

  return { ptms };
}

module.exports = { getPtmsView };
