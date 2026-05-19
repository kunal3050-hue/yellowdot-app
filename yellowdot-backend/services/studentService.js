/**
 * studentService.js — Firestore-backed student records
 * ───────────────────────────────────────────────────────
 * Collection: students/{studentId}
 *
 * Isolation:
 *   schoolId — stored on every doc; all reads scope to schoolId
 *   centerId — stored and optionally used as a read filter
 *
 * Timestamps: createdAt (on create), updatedAt (on every write)
 * ID format:  YD001, YD002, … (atomic counter in _counters/students)
 */

const { db } = require("../firebaseAdmin");

const SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";
const col       = () => db.collection("students");
const nowISO    = () => new Date().toISOString();

// ── Document mapper ────────────────────────────────────────────────

function docToStudent(snap) {
  const d  = snap.data ? snap.data() : snap;
  const id = snap.id   || d.studentId || "";
  return {
    // PascalCase shape — legacy frontend compatibility
    Student_ID:        d.studentId        || id,
    Student_Name:      d.studentName      || "",
    DOB:               d.dob              || "",
    Class:             d.class            || "",
    Admission_Date:    d.admissionDate    || "",
    Gender:            d.gender           || "",
    Father_Name:       d.fatherName       || "",
    Father_WhatsApp:   d.fatherWhatsApp   || "",
    Father_Email:      d.fatherEmail      || "",
    Mother_Name:       d.motherName       || "",
    Mother_WhatsApp:   d.motherWhatsApp   || "",
    Mother_Email:      d.motherEmail      || "",
    Status:            d.status           || "Active",
    Center:            d.centerId         || d.center || "",
    Profile_Image:     d.profileImage     || "",
    Parent_Registered: String(d.parentRegistered || false),
    QR_Enabled:        String(d.qrEnabled        || false),
    Created_At:        d.createdAt        || "",
    Updated_At:        d.updatedAt        || "",
    // camelCase aliases used by newer code paths
    studentId:         d.studentId        || id,
    studentName:       d.studentName      || "",
    dob:               d.dob              || "",
    class:             d.class            || "",
    admissionDate:     d.admissionDate    || "",
    gender:            d.gender           || "",
    fatherName:        d.fatherName       || "",
    fatherWhatsApp:    d.fatherWhatsApp   || "",
    fatherEmail:       d.fatherEmail      || "",
    motherName:        d.motherName       || "",
    motherWhatsApp:    d.motherWhatsApp   || "",
    motherEmail:       d.motherEmail      || "",
    status:            d.status           || "Active",
    centerId:          d.centerId         || d.center || "",
    center:            d.centerId         || d.center || "",
    schoolId:          d.schoolId         || SCHOOL_ID,
    profileImage:      d.profileImage     || "",
    parentRegistered:  d.parentRegistered || false,
    qrEnabled:         d.qrEnabled        || false,
    createdAt:         d.createdAt        || "",
    updatedAt:         d.updatedAt        || "",
  };
}

// ── Atomic ID generation ──────────────────────────────────────────

async function _nextStudentId() {
  const counterRef = db.collection("_counters").doc("students");
  let nextNum = 1;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    nextNum = snap.exists ? (snap.data().count || 0) + 1 : 1;
    tx.set(counterRef, { count: nextNum }, { merge: true });
  });
  return `YD${String(nextNum).padStart(3, "0")}`;
}

// ── Read ───────────────────────────────────────────────────────────

/**
 * Return all students.
 * Filters: schoolId (required), centerId, status, class.
 * Sorted by studentName (JS-side to avoid composite index requirement).
 */
async function getAll({ schoolId = SCHOOL_ID, centerId, status, class: cls } = {}) {
  let q = col().where("schoolId", "==", schoolId);
  const snap = await q.get();
  let students = snap.docs.map(docToStudent);

  // In-memory filters (avoids Firestore composite index on every combo)
  if (centerId) students = students.filter(s => s.centerId === centerId);
  if (status)   students = students.filter(s => s.status   === status);
  if (cls)      students = students.filter(s => s.class    === cls);

  students.sort((a, b) => a.studentName.localeCompare(b.studentName));
  return students;
}

/**
 * Legacy getAll — no schoolId filter.
 * Used by routes that were created before multi-tenancy.
 * Prefer getAll() with an explicit schoolId going forward.
 */
async function getAllLegacy() {
  const snap = await col().orderBy("studentName").get();
  return snap.docs.map(docToStudent);
}

async function getOne(studentId) {
  // Try direct doc lookup first (fastest path)
  const ref  = col().doc(studentId);
  const snap = await ref.get();
  if (snap.exists) return docToStudent(snap);

  // Fallback: query by studentId field (handles doc ID mismatches)
  const q = await col().where("studentId", "==", studentId).limit(1).get();
  if (q.empty) return null;
  return docToStudent(q.docs[0]);
}

// ── Write ──────────────────────────────────────────────────────────

async function create(data, { schoolId = SCHOOL_ID, centerId, actorUserId = "system" } = {}) {
  const studentId = await _nextStudentId();
  const resolvedCenterId = centerId || data.center || data.centerId || "";

  const doc = {
    studentId,
    schoolId:         schoolId,
    centerId:         resolvedCenterId,
    center:           resolvedCenterId,     // legacy alias
    studentName:      (data.student_name   || data.studentName   || "").trim(),
    dob:              data.dob             || "",
    class:            data.class           || data.student_class || "",
    admissionDate:    data.join_date       || data.admissionDate || "",
    gender:           data.gender          || "",
    fatherName:       (data.father_name    || data.fatherName    || "").trim(),
    fatherWhatsApp:   data.father_whatsapp || data.fatherWhatsApp|| "",
    fatherEmail:      (data.father_email   || data.fatherEmail   || "").toLowerCase().trim(),
    motherName:       (data.mother_name    || data.motherName    || "").trim(),
    motherWhatsApp:   data.mother_whatsapp || data.motherWhatsApp|| "",
    motherEmail:      (data.mother_email   || data.motherEmail   || "").toLowerCase().trim(),
    status:           "Active",
    profileImage:     (data.profile_image  || data.profileImage  || "").slice(0, 50_000),
    parentRegistered: Boolean(data.parent_registered || data.parentRegistered),
    qrEnabled:        Boolean(data.qr_enabled        || data.qrEnabled),
    createdAt:        nowISO(),
    updatedAt:        nowISO(),
    createdBy:        actorUserId,
  };

  await col().doc(studentId).set(doc);
  return { success: true, student_id: studentId, studentId };
}

async function update(studentId, data, { actorUserId = "system" } = {}) {
  // Resolve the actual Firestore doc ref
  let ref  = col().doc(studentId);
  let snap = await ref.get();
  if (!snap.exists) {
    const q = await col().where("studentId", "==", studentId).limit(1).get();
    if (q.empty) return null;
    ref  = q.docs[0].ref;
    snap = q.docs[0];
  }

  const e = snap.data();
  const m = (camel, snake, fallback) =>
    data[camel] !== undefined ? data[camel] :
    data[snake] !== undefined ? data[snake] : fallback;

  const updates = { updatedAt: nowISO(), updatedBy: actorUserId };

  if (data.student_name  !== undefined || data.studentName  !== undefined)
    updates.studentName      = m("studentName",      "student_name",     e.studentName);
  if (data.dob !== undefined)
    updates.dob              = data.dob;
  if (data.class !== undefined || data.student_class !== undefined)
    updates.class            = m("class",            "student_class",    e.class);
  if (data.join_date !== undefined || data.admissionDate !== undefined)
    updates.admissionDate    = m("admissionDate",    "join_date",        e.admissionDate);
  if (data.gender !== undefined)
    updates.gender           = data.gender;
  if (data.center !== undefined || data.centerId !== undefined) {
    const c = data.centerId !== undefined ? data.centerId : data.center;
    updates.centerId         = c;
    updates.center           = c;
  }
  if (data.father_name !== undefined || data.fatherName !== undefined)
    updates.fatherName       = m("fatherName",       "father_name",      e.fatherName);
  if (data.father_whatsapp !== undefined || data.fatherWhatsApp !== undefined)
    updates.fatherWhatsApp   = m("fatherWhatsApp",   "father_whatsapp",  e.fatherWhatsApp);
  if (data.father_email !== undefined || data.fatherEmail !== undefined)
    updates.fatherEmail      = (m("fatherEmail",     "father_email",     e.fatherEmail) || "").toLowerCase().trim();
  if (data.mother_name !== undefined || data.motherName !== undefined)
    updates.motherName       = m("motherName",       "mother_name",      e.motherName);
  if (data.mother_whatsapp !== undefined || data.motherWhatsApp !== undefined)
    updates.motherWhatsApp   = m("motherWhatsApp",   "mother_whatsapp",  e.motherWhatsApp);
  if (data.mother_email !== undefined || data.motherEmail !== undefined)
    updates.motherEmail      = (m("motherEmail",     "mother_email",     e.motherEmail) || "").toLowerCase().trim();
  if (data.status !== undefined)
    updates.status           = data.status;
  if (data.profile_image !== undefined && String(data.profile_image).startsWith("data:"))
    updates.profileImage     = data.profile_image.slice(0, 50_000);
  if (data.parent_registered !== undefined || data.parentRegistered !== undefined)
    updates.parentRegistered = Boolean(m("parentRegistered", "parent_registered", e.parentRegistered));
  if (data.qr_enabled !== undefined || data.qrEnabled !== undefined)
    updates.qrEnabled        = Boolean(m("qrEnabled",        "qr_enabled",        e.qrEnabled));

  await ref.update(updates);
  return { success: true, message: "Student updated successfully" };
}

async function remove(studentId, { actorUserId = "system" } = {}) {
  const ref  = col().doc(studentId);
  const snap = await ref.get();
  if (!snap.exists) {
    const q = await col().where("studentId", "==", studentId).limit(1).get();
    if (q.empty) return false;
    await q.docs[0].ref.delete();
    return true;
  }
  await ref.delete();
  return true;
}

module.exports = { getAll, getAllLegacy, getOne, create, update, remove };
