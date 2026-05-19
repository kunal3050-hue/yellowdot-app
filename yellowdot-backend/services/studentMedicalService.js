/**
 * studentMedicalService.js — Firestore-backed student medical records
 * ────────────────────────────────────────────────────────────────────
 * Stored as a subcollection: students/{studentId}/medical/record
 * (single doc per student — upsert pattern)
 * schoolId isolation is inherited from the parent student document.
 */

const { db } = require("../firebaseAdmin");

function nowISO() { return new Date().toISOString(); }

function medRef(studentId) {
  return db.collection("students").doc(studentId).collection("medical").doc("record");
}

function docToMedical(snap, studentId) {
  const d = snap.data() || {};
  return {
    studentId:      studentId        || "",
    bloodGroup:     d.bloodGroup     || "",
    allergies:      d.allergies      || "",
    medications:    d.medications    || "",
    doctorName:     d.doctorName     || "",
    doctorPhone:    d.doctorPhone    || "",
    emergencyNotes: d.emergencyNotes || "",
    notes:          d.notes          || "",
    createdAt:      d.createdAt      || "",
    updatedAt:      d.updatedAt      || "",
    updatedBy:      d.updatedBy      || "",
  };
}

async function get(studentId) {
  const snap = await medRef(studentId).get();
  if (!snap.exists) return null;
  return docToMedical(snap, studentId);
}

async function upsert({ studentId, bloodGroup, allergies, medications, doctorName, doctorPhone, emergencyNotes, notes }, { actorUserId = "system" } = {}) {
  const ref      = medRef(studentId);
  const existing = await ref.get();
  const doc = {
    bloodGroup:     bloodGroup     || "",
    allergies:      allergies      || "",
    medications:    medications    || "",
    doctorName:     doctorName     || "",
    doctorPhone:    doctorPhone    || "",
    emergencyNotes: emergencyNotes || "",
    notes:          notes          || "",
    createdAt:      existing.exists ? (existing.data().createdAt || nowISO()) : nowISO(),
    updatedAt:      nowISO(),
    updatedBy:      actorUserId,
  };
  await ref.set(doc, { merge: true });
  return docToMedical({ data: () => doc }, studentId);
}

module.exports = { get, upsert };
