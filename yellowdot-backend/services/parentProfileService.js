/**
 * parentProfileService.js — Parent identity + child resolution (Parent Module V1)
 * ───────────────────────────────────────────────────────────────────────────────
 * Collection: parents/{uid}
 *
 * First-class parent identity. Lazily provisioned on first authenticated parent
 * access from the existing student email-link data (students.fatherEmail /
 * motherEmail), so no separate migration is required to go live.
 *
 * parents/{uid} shape:
 *   uid, schoolId, email, name, phone,
 *   studentIds: ["YD001", ...],   // supports multi-child families
 *   relation: "father" | "mother" | "guardian",
 *   status: "active" | "inactive",
 *   provisionedFrom, createdAt, updatedAt
 *
 * Isolation: every parent doc carries schoolId. Child access is authorized
 * against parent.studentIds (a parent may only read their own children).
 */

const { db }          = require("../firebaseAdmin");
const studentService  = require("./studentService");

const DEFAULT_SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";
const col    = () => db.collection("parents");
const nowISO = () => new Date().toISOString();

// ── Child-safe projection ──────────────────────────────────────────
// Only fields a parent should see about their own child.
function toChildSafe(student) {
  if (!student) return null;
  return {
    studentId:     student.studentId,
    studentName:   student.studentName,
    class:         student.class,
    dob:           student.dob,
    gender:        student.gender,
    admissionDate: student.admissionDate,
    status:        student.status,
    centerId:      student.centerId,
    profileImage:  student.profileImage || "",
    fatherName:    student.fatherName,
    motherName:    student.motherName,
  };
}

// ── Resolve children by parent email (provisioning source) ─────────
async function _findStudentIdsByEmail(email) {
  if (!email) return { studentIds: [], schoolId: null, relation: "guardian" };
  const lower = email.toLowerCase();

  const [fatherSnap, motherSnap] = await Promise.all([
    db.collection("students").where("fatherEmail", "==", lower).get(),
    db.collection("students").where("motherEmail", "==", lower).get(),
  ]);

  const ids = new Set();
  let schoolId = null;
  let relation = "guardian";

  fatherSnap.forEach(d => {
    const s = d.data();
    ids.add(s.studentId || d.id);
    schoolId = schoolId || s.schoolId;
    relation = "father";
  });
  motherSnap.forEach(d => {
    const s = d.data();
    ids.add(s.studentId || d.id);
    schoolId = schoolId || s.schoolId;
    if (relation === "guardian") relation = "mother";
  });

  return { studentIds: [...ids], schoolId, relation };
}

/** Set-equality for two id arrays (order-independent). */
function sameIds(a = [], b = []) {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every(x => set.has(x));
}

/**
 * Get the parent doc for the authenticated user, provisioning it on first
 * access from email-linked students.
 *
 * @param {Object}  authUser
 * @param {Object} [opts]
 * @param {boolean}[opts.sync] When true (use on the "load" call, e.g. /me),
 *   re-resolve studentIds from the student email mapping and self-heal the doc
 *   if a child was added / removed / relinked or the email mapping changed.
 *   Other endpoints pass sync=false (fast path, use the cached doc).
 * @returns {Promise<Object|null>} parent record, or null if not a parent.
 */
async function getOrCreateParent(authUser, { sync = false } = {}) {
  const uid = authUser.userId;
  const ref = col().doc(uid);
  const snap = await ref.get();

  // ── First access: provision from email match ───────────────────────
  if (!snap.exists) {
    const { studentIds, schoolId, relation } = await _findStudentIdsByEmail(authUser.email);
    if (studentIds.length === 0) return null; // no linked children → not a parent

    const doc = {
      uid,
      schoolId:        schoolId || authUser.schoolId || DEFAULT_SCHOOL_ID,
      email:           (authUser.email || "").toLowerCase(),
      name:            authUser.name || "",
      phone:           authUser.phone || "",
      studentIds,
      relation,
      status:          "active",
      provisionedFrom: "email-match",
      createdAt:       nowISO(),
      updatedAt:       nowISO(),
      lastSyncedAt:    nowISO(),
    };
    await ref.set(doc);
    return { uid, ...doc };
  }

  const existing = { uid, ...snap.data() };

  // ── Fast path: return cached doc unless a sync was requested ───────
  if (!sync) return existing;

  // ── Self-heal: re-resolve links from the source of truth ──────────
  // Safety: never wipe links when we can't determine the email (would be a
  // false "no children"). Only update when the resolved set actually differs.
  if (!authUser.email) return existing;
  const resolved = await _findStudentIdsByEmail(authUser.email);
  const changed =
    !sameIds(existing.studentIds || [], resolved.studentIds) ||
    (resolved.schoolId && resolved.schoolId !== existing.schoolId);

  if (!changed) {
    await ref.set({ lastSyncedAt: nowISO() }, { merge: true });
    return existing;
  }

  const update = {
    studentIds:   resolved.studentIds,
    schoolId:     resolved.schoolId || existing.schoolId,
    relation:     resolved.relation || existing.relation,
    updatedAt:    nowISO(),
    lastSyncedAt: nowISO(),
  };
  await ref.set(update, { merge: true });
  return { ...existing, ...update };
}

/** Return the child-safe profiles for all of a parent's linked children. */
async function getChildren(parent) {
  if (!parent?.studentIds?.length) return [];
  const students = await Promise.all(parent.studentIds.map(id => studentService.getOne(id)));
  return students.filter(Boolean).map(toChildSafe);
}

/**
 * Return a single child's safe profile, but only if the child is linked to
 * this parent. Returns null when not owned (caller should 403/404).
 */
async function getChild(parent, studentId) {
  if (!parent?.studentIds?.includes(studentId)) return null;
  const student = await studentService.getOne(studentId);
  return toChildSafe(student);
}

module.exports = { getOrCreateParent, getChildren, getChild, toChildSafe, sameIds };
