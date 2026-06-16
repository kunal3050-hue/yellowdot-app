/**
 * memoriesService.js — Parent Module · Phase 4 (Memories)
 * ──────────────────────────────────────────────────────────────────
 * Collection: memories/{id}
 *
 * A "memory" is a photo or video shared by school staff for a child.
 * Parents read only memories belonging to their linked children.
 *
 * memories/{id} shape:
 *   id, schoolId, studentId, centerId,
 *   type: "photo" | "video",
 *   mediaUrl, thumbnailUrl, caption,
 *   date (YYYY-MM-DD), createdAt, updatedAt, createdBy
 *
 * V1 is read-only for parents. No likes/comments/downloads/sharing/albums/tags.
 */

const { db } = require("../firebaseAdmin");

const SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";
const col    = () => db.collection("memories");
const nowISO = () => new Date().toISOString();

function toMemory(snap) {
  const d  = snap.data ? snap.data() : snap;
  const id = snap.id || d.id || "";
  return {
    id,
    studentId:    d.studentId    || "",
    type:         d.type === "video" ? "video" : "photo",
    mediaUrl:     d.mediaUrl     || "",
    thumbnailUrl: d.thumbnailUrl || "",
    caption:      d.caption      || "",
    date:         d.date         || (d.createdAt ? String(d.createdAt).slice(0, 10) : ""),
    createdAt:    d.createdAt     || "",
  };
}

/**
 * Memories for a parent's linked children (optionally one child).
 * Filters studentId in-memory to avoid composite-index requirements.
 *
 * @param {Object} opts
 * @param {string}   opts.schoolId
 * @param {string[]} opts.studentIds  — all linked children
 * @param {string}  [opts.studentId]  — restrict to one child (must be linked)
 * @param {number}  [opts.limit]
 */
async function getForChildren({ schoolId = SCHOOL_ID, studentIds = [], studentId, limit = 100 } = {}) {
  const ids = studentId ? [studentId] : studentIds;
  if (!ids.length) return [];

  const snap = await col().where("schoolId", "==", schoolId).get();
  let list = snap.docs.map(toMemory).filter(m => ids.includes(m.studentId));

  // Newest first by date (fallback createdAt).
  list.sort((a, b) => (b.date || b.createdAt || "").localeCompare(a.date || a.createdAt || ""));
  return list.slice(0, Number(limit) || 100);
}

/**
 * Create a new memory (staff-only).
 */
async function createMemory(data, { schoolId = SCHOOL_ID, actorUserId = "system" } = {}) {
  const {
    studentId, studentName = "", centerId = "",
    type = "photo", mediaUrl = "", thumbnailUrl = "",
    caption = "", date,
  } = data;

  if (!studentId) throw new Error("studentId is required.");
  if (!mediaUrl)  throw new Error("mediaUrl is required.");

  const doc = {
    schoolId,
    studentId,
    studentName,
    centerId,
    type:         type === "video" ? "video" : "photo",
    mediaUrl,
    thumbnailUrl: thumbnailUrl || mediaUrl,
    caption,
    date:         date || nowISO().slice(0, 10),
    createdAt:    nowISO(),
    updatedAt:    nowISO(),
    createdBy:    actorUserId,
  };

  const ref = await col().add(doc);
  return { id: ref.id, ...doc };
}

/**
 * Delete a memory by id.
 */
async function deleteMemory(id) {
  await col().doc(id).delete();
  return true;
}

module.exports = { getForChildren, createMemory, deleteMemory };
