/**
 * studentNotesService.js — Firestore-backed student notes
 * ──────────────────────────────────────────────────────────
 * Stored as a subcollection: students/{studentId}/notes/{noteId}
 * schoolId isolation is inherited from the parent student document.
 */

const { db } = require("../firebaseAdmin");

function nowISO() { return new Date().toISOString(); }

function notesCol(studentId) {
  return db.collection("students").doc(studentId).collection("notes");
}

function docToNote(snap, studentId) {
  const d = snap.data() || {};
  return {
    noteId:    snap.id,
    studentId: studentId   || "",
    note:      d.note      || "",
    createdBy: d.createdBy || "",
    updatedBy: d.updatedBy || "",
    createdAt: d.createdAt || "",
    updatedAt: d.updatedAt || "",
  };
}

async function getNotes(studentId) {
  const snap = await notesCol(studentId).get();
  const notes = snap.docs.map(d => docToNote(d, studentId));
  // Sort newest first in JS
  notes.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return notes;
}

async function addNote(studentId, note, createdBy = "Staff") {
  const ref = notesCol(studentId).doc();
  const doc = {
    note:      note      || "",
    createdBy: createdBy,
    updatedBy: createdBy,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };
  await ref.set(doc);
  return docToNote({ id: ref.id, data: () => doc }, studentId);
}

async function updateNote(studentId, noteId, note, updatedBy = "Staff") {
  const ref  = notesCol(studentId).doc(noteId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const updates = { note, updatedBy, updatedAt: nowISO() };
  await ref.update(updates);
  return docToNote({ id: noteId, data: () => ({ ...snap.data(), ...updates }) }, studentId);
}

async function deleteNote(studentId, noteId) {
  const ref  = notesCol(studentId).doc(noteId);
  const snap = await ref.get();
  if (!snap.exists) return false;
  await ref.delete();
  return true;
}

module.exports = { getNotes, addNote, updateNote, deleteNote };
