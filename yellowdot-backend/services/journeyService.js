/**
 * journeyService.js — Child Journey Module · Core Data Service
 *
 * Collection: journeyEntries/{entryId}
 *
 * Single source of truth for all child journey content:
 *   photo, video, observation, artwork, milestone, achievement, event-highlight
 *
 * academicYear is always auto-assigned from `date` — never passed by caller.
 * All docs carry schoolId for multi-school SaaS isolation.
 */

const { db } = require("../firebaseAdmin");
const { getAcademicYear } = require("../utils/academicYear");

const SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";
const col       = () => db.collection("journeyEntries");
const nowISO    = () => new Date().toISOString();

const VALID_KINDS = new Set([
  "photo", "video", "observation", "artwork",
  "milestone", "achievement", "event-highlight",
]);

const VALID_SOURCE_MODULES = new Set([
  "observation", "artwork", "events", "academics",
  "milestones", "memories", "awards", "teacher_notes",
]);

const VALID_DOMAINS = new Set([
  "social", "emotional", "communication", "creativity",
  "leadership", "confidence", "fine_motor", "gross_motor",
]);

const VALID_ARTWORK_CATEGORIES = new Set([
  "drawing", "craft", "coloring", "project", "worksheet",
]);

// ── Shape a Firestore snapshot into a plain object ────────────────────────────
function toEntry(snap) {
  const d  = snap.data ? snap.data() : snap;
  const id = snap.id   || d.id       || "";
  return {
    id,
    schoolId:          d.schoolId          || "",
    centerId:          d.centerId          || "",
    academicYear:      d.academicYear      || "",
    studentId:         d.studentId         || "",
    studentName:       d.studentName       || "",
    classId:           d.classId           || "",
    date:              d.date              || "",
    kind:              d.kind              || "photo",
    visibility:        d.visibility        || "all_parents",
    // Media (photo / video / artwork)
    mediaUrl:          d.mediaUrl          || "",
    thumbnailUrl:      d.thumbnailUrl      || "",
    caption:           d.caption           || "",
    // Observation
    domain:            d.domain            || "",
    level:             d.level             || 0,
    observationText:   d.observationText   || "",
    // Artwork
    artworkCategory:   d.artworkCategory   || "",
    artworkTitle:      d.artworkTitle      || "",
    // Milestone
    milestoneId:       d.milestoneId       || "",
    milestoneTitle:    d.milestoneTitle     || "",
    milestoneCategory: d.milestoneCategory || "",
    momentNote:        d.momentNote        || "",
    autoDetected:      d.autoDetected      || false,
    // Source tracking (which module published this entry)
    sourceModule:      d.sourceModule      || "",
    // Audit
    createdBy:         d.createdBy         || "",
    createdAt:         d.createdAt         || "",
    updatedAt:         d.updatedAt         || "",
  };
}

// ── Create ────────────────────────────────────────────────────────────────────
async function createEntry(data, { schoolId = SCHOOL_ID, centerId = "", actorUserId = "system" } = {}) {
  const {
    studentId, studentName = "", classId = "",
    date, kind = "photo", visibility = "all_parents",
    // media
    mediaUrl = "", thumbnailUrl = "", caption = "",
    // observation
    domain = "", level, observationText = "",
    // artwork
    artworkCategory = "", artworkTitle = "",
    // milestone / achievement / event-highlight
    milestoneId = "", milestoneTitle = "", milestoneCategory = "",
    momentNote = "", autoDetected = false,
    // source tracking
    sourceModule = "",
  } = data;

  if (!studentId)              throw new Error("studentId is required.");
  if (!VALID_KINDS.has(kind))  throw new Error(`Invalid kind "${kind}".`);

  if (kind === "observation") {
    if (!domain || !VALID_DOMAINS.has(domain))
      throw new Error(`Invalid domain "${domain}". Must be one of: ${[...VALID_DOMAINS].join(", ")}.`);
    if (!observationText?.trim())
      throw new Error("observationText is required for observations.");
    const lvl = Number(level);
    if (!lvl || lvl < 1 || lvl > 5)
      throw new Error("level must be 1–5 for observations.");
  }

  if ((kind === "photo" || kind === "video") && !mediaUrl)
    throw new Error("mediaUrl is required for photo/video entries.");

  if (kind === "artwork") {
    if (!mediaUrl) throw new Error("mediaUrl is required for artwork entries.");
    if (artworkCategory && !VALID_ARTWORK_CATEGORIES.has(artworkCategory))
      throw new Error(`Invalid artworkCategory "${artworkCategory}".`);
  }

  const entryDate = date || nowISO().slice(0, 10);

  const doc = {
    schoolId,
    centerId,
    academicYear:      getAcademicYear(entryDate),
    studentId,
    studentName,
    classId,
    date:              entryDate,
    kind,
    visibility,
    mediaUrl,
    thumbnailUrl:      thumbnailUrl || mediaUrl,
    caption,
    domain,
    level:             Number(level) || 0,
    observationText,
    artworkCategory,
    artworkTitle,
    milestoneId,
    milestoneTitle,
    milestoneCategory,
    momentNote,
    autoDetected,
    sourceModule:      VALID_SOURCE_MODULES.has(sourceModule) ? sourceModule : (kind === "observation" ? "observation" : kind === "artwork" ? "artwork" : kind === "milestone" ? "milestones" : "memories"),
    createdBy:         actorUserId,
    createdAt:         nowISO(),
    updatedAt:         nowISO(),
  };

  const ref = await col().add(doc);
  return { id: ref.id, ...doc };
}

// ── Read: parent view (visibility-filtered, sorted newest-first) ──────────────
async function getForStudent({
  schoolId = SCHOOL_ID, studentId,
  kinds = [], academicYear, limit = 100,
} = {}) {
  if (!studentId) return [];

  let q = col()
    .where("schoolId",  "==", schoolId)
    .where("studentId", "==", studentId);

  if (academicYear) q = q.where("academicYear", "==", academicYear);

  const snap = await q.get();
  let list = snap.docs
    .map(toEntry)
    .filter(e => e.visibility !== "staff_only");

  if (kinds.length) list = list.filter(e => kinds.includes(e.kind));

  list.sort((a, b) =>
    (b.date || b.createdAt || "").localeCompare(a.date || a.createdAt || "")
  );
  return list.slice(0, Number(limit) || 100);
}

// ── Read: staff view (no visibility filter, all kinds) ────────────────────────
async function getForStaff({
  schoolId = SCHOOL_ID, studentId, classId,
  kinds = [], academicYear, limit = 200,
} = {}) {
  let q = col().where("schoolId", "==", schoolId);
  if (studentId) q = q.where("studentId", "==", studentId);

  const snap = await q.get();
  let list = snap.docs.map(toEntry);

  if (classId)      list = list.filter(e => e.classId     === classId);
  if (academicYear) list = list.filter(e => e.academicYear === academicYear);
  if (kinds.length) list = list.filter(e => kinds.includes(e.kind));

  list.sort((a, b) =>
    (b.date || b.createdAt || "").localeCompare(a.date || a.createdAt || "")
  );
  return list.slice(0, Number(limit) || 200);
}

// ── Update (text fields only — media URL is immutable after upload) ───────────
async function updateEntry(id, data, { schoolId = SCHOOL_ID, actorUserId = "system" } = {}) {
  const ref  = col().doc(id);
  const snap = await ref.get();
  if (!snap.exists)                       throw new Error("Journey entry not found.");
  if (snap.data().schoolId !== schoolId)  throw new Error("Forbidden.");

  const allowed = [
    "caption", "observationText", "level", "domain",
    "artworkTitle", "artworkCategory", "momentNote", "visibility",
  ];
  const update = { updatedAt: nowISO() };
  for (const k of allowed) {
    if (data[k] !== undefined) update[k] = data[k];
  }

  await ref.update(update);
  return { id, ...snap.data(), ...update };
}

// ── Delete ────────────────────────────────────────────────────────────────────
async function deleteEntry(id, { schoolId = SCHOOL_ID } = {}) {
  const ref  = col().doc(id);
  const snap = await ref.get();
  if (!snap.exists)                       throw new Error("Journey entry not found.");
  if (snap.data().schoolId !== schoolId)  throw new Error("Forbidden.");
  await ref.delete();
  return true;
}

module.exports = { createEntry, getForStudent, getForStaff, updateEntry, deleteEntry, VALID_DOMAINS, VALID_ARTWORK_CATEGORIES, VALID_SOURCE_MODULES };
