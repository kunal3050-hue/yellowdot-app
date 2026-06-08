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

/**
 * Get the parent doc for the authenticated user, provisioning it on first
 * access from email-linked students. Returns the parent record or null if
 * the user has no linked children (not a parent).
 */
async function getOrCreateParent(authUser) {
  const uid = authUser.userId;
  const ref = col().doc(uid);
  const snap = await ref.get();

  if (snap.exists) {
    return { uid, ...snap.data() };
  }

  // Lazy provision from email match
  const { studentIds, schoolId, relation } = await _findStudentIdsByEmail(authUser.email);
  if (studentIds.length === 0) {
    return null; // no linked children → not a provisionable parent
  }

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
  };
  await ref.set(doc);
  return { uid, ...doc };
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

module.exports = { getOrCreateParent, getChildren, getChild, toChildSafe };
