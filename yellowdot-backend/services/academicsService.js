/**
 * academicsService.js — Class Management read layer
 * Reads from Firestore `classes/{id}` (school-scoped, active-only).
 * Falls back to built-in seed data while the Firestore collection is empty
 * (i.e., before staff populates it via the Class Management UI).
 */

const { db } = require("../firebaseAdmin");
const SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";

// Mirrors AcademicsClasses.jsx SEED_CLASSES — kept in sync so the
// staff UI and any backend consumer agree on IDs before Firestore is populated.
const SEED_CLASSES = [
  { id: "1", code: "PG001", name: "Playgroup",   ageGroup: "2–3 years",  status: "Active" },
  { id: "2", code: "NR001", name: "Nursery",     ageGroup: "3–4 years",  status: "Active" },
  { id: "3", code: "JKG01", name: "Junior KG",   ageGroup: "4–5 years",  status: "Active" },
  { id: "4", code: "SKG01", name: "Senior KG",   ageGroup: "5–6 years",  status: "Active" },
  { id: "5", code: "DC001", name: "Daycare",     ageGroup: "1–5 years",  status: "Active" },
  { id: "6", code: "AB001", name: "Abacus",      ageGroup: "5–10 years", status: "Active" },
  { id: "7", code: "HW001", name: "Handwriting", ageGroup: "4–8 years",  status: "Inactive" },
];

/**
 * Returns active classes for the given school.
 * Reads Firestore first; falls back to seed data if the collection is empty.
 */
async function getActiveClasses({ schoolId = SCHOOL_ID } = {}) {
  try {
    const snap = await db.collection("classes")
      .where("schoolId", "==", schoolId)
      .where("status", "==", "Active")
      .get();
    if (!snap.empty) {
      return snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    }
  } catch (e) {
    console.warn("[academicsService] Firestore read failed, using seed:", e.message);
  }
  return SEED_CLASSES.filter(c => c.status === "Active");
}

/**
 * Build a classId → className lookup map for a given school.
 * Includes inactive classes too so stored IDs always resolve.
 */
async function getClassMap({ schoolId = SCHOOL_ID } = {}) {
  try {
    const snap = await db.collection("classes")
      .where("schoolId", "==", schoolId)
      .get();
    if (!snap.empty) {
      const map = {};
      snap.docs.forEach(d => { const cl = d.data(); map[d.id] = cl.name || d.id; });
      return map;
    }
  } catch (e) {
    console.warn("[academicsService] getClassMap Firestore read failed, using seed:", e.message);
  }
  const map = {};
  SEED_CLASSES.forEach(c => { map[c.id] = c.name; });
  return map;
}

module.exports = { getActiveClasses, getClassMap };
