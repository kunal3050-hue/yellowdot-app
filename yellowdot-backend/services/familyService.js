/**
 * familyService.js — Firestore-backed family/sibling management
 * ──────────────────────────────────────────────────────────────
 * Collection: families/{familyId}
 * Subcollections: notes, documents, timeline
 *
 * Isolation:
 *   schoolId — stored on every doc; all reads scope to schoolId
 *   centerId — stored and optionally used as a read filter
 *
 * Timestamps: createdAt (on create), updatedAt (on every write)
 * ID format:  FAM001, FAM002, … (atomic counter in _counters/families)
 */

const { db } = require("../firebaseAdmin");

const SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";
const col       = () => db.collection("families");
const nowISO    = () => new Date().toISOString();

// ── Document mapper ────────────────────────────────────────────────

function docToFamily(snap) {
  const d  = snap.data ? snap.data() : snap;
  const id = snap.id   || d.familyId || "";
  return {
    familyId:         d.familyId         || id,
    familyCode:       d.familyCode       || "",
    guardian1Name:    d.guardian1Name    || d.fatherName  || "",
    guardian2Name:    d.guardian2Name    || d.motherName  || "",
    // Legacy aliases kept for backwards-compat reads
    fatherName:       d.guardian1Name    || d.fatherName  || "",
    motherName:       d.guardian2Name    || d.motherName  || "",
    primaryContact:   d.primaryContact   || "",
    alternateContact: d.alternateContact || "",
    email:            d.email            || "",
    address:          d.address          || "",
    centerId:         d.centerId         || "",
    schoolId:         d.schoolId         || SCHOOL_ID,
    studentIds:       Array.isArray(d.studentIds) ? d.studentIds : [],
    billingPreference:d.billingPreference|| "separate",
    active:           d.active !== false,
    createdAt:        d.createdAt        || "",
    updatedAt:        d.updatedAt        || "",
    createdBy:        d.createdBy        || "",
  };
}

// ── Atomic ID generation ──────────────────────────────────────────

async function _nextFamilyId() {
  const counterRef = db.collection("_counters").doc("families");
  let nextNum = 1;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    nextNum = snap.exists ? (snap.data().count || 0) + 1 : 1;
    tx.set(counterRef, { count: nextNum }, { merge: true });
  });
  const id   = `FAM${String(nextNum).padStart(3, "0")}`;
  const code = `YD-FAM-${String(nextNum).padStart(3, "0")}`;
  return { id, code };
}

// ── Timeline helper ────────────────────────────────────────────────

async function _logEvent(familyId, { type, description, actorUserId = "system", metadata = {} }) {
  try {
    const ref = col().doc(familyId).collection("timeline").doc();
    await ref.set({
      eventId:     ref.id,
      type,
      description,
      actorUserId,
      metadata,
      createdAt:   nowISO(),
    });
  } catch {
    // Timeline failures must never block the primary operation
  }
}

// ── Read ───────────────────────────────────────────────────────────

async function getAll({ schoolId = SCHOOL_ID, centerId, active } = {}) {
  let q = col().where("schoolId", "==", schoolId);
  const snap = await q.get();
  let families = snap.docs.map(docToFamily);

  if (centerId)             families = families.filter(f => f.centerId === centerId);
  if (active !== undefined) families = families.filter(f => f.active === (active !== "false" && active !== false));

  families.sort((a, b) => {
    const nameA = a.guardian1Name || a.guardian2Name || "";
    const nameB = b.guardian1Name || b.guardian2Name || "";
    return nameA.localeCompare(nameB);
  });
  return families;
}

async function getOne(familyId) {
  const ref  = col().doc(familyId);
  const snap = await ref.get();
  if (snap.exists) return docToFamily(snap);

  const q = await col().where("familyId", "==", familyId).limit(1).get();
  if (q.empty) return null;
  return docToFamily(q.docs[0]);
}

async function getByStudentId(studentId) {
  const q = await col().where("studentIds", "array-contains", studentId).limit(1).get();
  if (q.empty) return null;
  return docToFamily(q.docs[0]);
}

async function count(schoolId = SCHOOL_ID) {
  const snap = await col().where("schoolId", "==", schoolId).where("active", "==", true).get();
  return snap.size;
}

// ── Write ──────────────────────────────────────────────────────────

async function create(data, { schoolId = SCHOOL_ID, actorUserId = "system" } = {}) {
  const { id: familyId, code: familyCode } = await _nextFamilyId();

  // Accept both new guardian1/2 and legacy father/mother keys
  const g1 = (data.guardian1Name || data.fatherName || "").trim();
  const g2 = (data.guardian2Name || data.motherName || "").trim();

  const doc = {
    familyId,
    familyCode,
    guardian1Name:     g1,
    guardian2Name:     g2,
    // Write legacy aliases so older readers still work
    fatherName:        g1,
    motherName:        g2,
    primaryContact:    (data.primaryContact    || "").trim(),
    alternateContact:  (data.alternateContact  || "").trim(),
    email:             (data.email             || "").toLowerCase().trim(),
    address:           (data.address           || "").trim(),
    centerId:          data.centerId           || "",
    schoolId,
    studentIds:        Array.isArray(data.studentIds) ? data.studentIds : [],
    billingPreference: data.billingPreference  || "separate",
    active:            true,
    createdAt:         nowISO(),
    updatedAt:         nowISO(),
    createdBy:         actorUserId,
  };

  await col().doc(familyId).set(doc);
  await _logEvent(familyId, {
    type:        "FAMILY_CREATED",
    description: `Family ${familyCode} created`,
    actorUserId,
  });
  return { success: true, familyId, familyCode };
}

async function update(familyId, data, { actorUserId = "system" } = {}) {
  let ref  = col().doc(familyId);
  let snap = await ref.get();
  if (!snap.exists) {
    const q = await col().where("familyId", "==", familyId).limit(1).get();
    if (q.empty) return null;
    ref  = q.docs[0].ref;
    snap = q.docs[0];
  }

  const updates = { updatedAt: nowISO(), updatedBy: actorUserId };

  // Accept both naming conventions
  const g1 = data.guardian1Name !== undefined ? data.guardian1Name : data.fatherName;
  const g2 = data.guardian2Name !== undefined ? data.guardian2Name : data.motherName;

  if (g1 !== undefined) { updates.guardian1Name = g1.trim(); updates.fatherName = g1.trim(); }
  if (g2 !== undefined) { updates.guardian2Name = g2.trim(); updates.motherName = g2.trim(); }

  if (data.primaryContact    !== undefined) updates.primaryContact    = data.primaryContact.trim();
  if (data.alternateContact  !== undefined) updates.alternateContact  = data.alternateContact.trim();
  if (data.email             !== undefined) updates.email             = data.email.toLowerCase().trim();
  if (data.address           !== undefined) updates.address           = data.address.trim();
  if (data.centerId          !== undefined) updates.centerId          = data.centerId;
  if (data.active            !== undefined) updates.active            = Boolean(data.active);
  if (data.billingPreference !== undefined) updates.billingPreference = data.billingPreference;
  if (Array.isArray(data.studentIds))       updates.studentIds        = data.studentIds;

  await ref.update(updates);
  return { success: true, message: "Family updated successfully" };
}

// ── Student linking ────────────────────────────────────────────────

async function addStudent(familyId, studentId, { actorUserId = "system" } = {}) {
  const family = await getOne(familyId);
  if (!family) return null;

  if (family.studentIds.includes(studentId)) {
    return { success: true, message: "Student already linked to this family" };
  }

  const ref    = col().doc(familyId);
  const newIds = [...family.studentIds, studentId];

  await ref.update({
    studentIds: newIds,
    updatedAt:  nowISO(),
    updatedBy:  actorUserId,
  });

  // Mirror familyId onto the student doc
  await db.collection("students").doc(studentId).update({
    familyId,
    isSibling:    newIds.length > 1,
    siblingOrder: newIds.indexOf(studentId) + 1,
    updatedAt:    nowISO(),
  }).catch(() => {});

  // Update isSibling flag for all others when a new child is added
  for (let i = 0; i < newIds.length - 1; i++) {
    await db.collection("students").doc(newIds[i]).update({ isSibling: true }).catch(() => {});
  }

  // Look up student name for the timeline event
  const studentSnap = await db.collection("students").doc(studentId).get().catch(() => null);
  const studentName = studentSnap?.exists
    ? (studentSnap.data().studentName || studentSnap.data().Student_Name || studentId)
    : studentId;

  await _logEvent(familyId, {
    type:        "CHILD_LINKED",
    description: `${studentName} linked to family`,
    actorUserId,
    metadata:    { studentId, studentName },
  });

  return { success: true, message: "Student linked to family" };
}

async function removeStudent(familyId, studentId, { actorUserId = "system" } = {}) {
  const family = await getOne(familyId);
  if (!family) return null;

  const newIds = family.studentIds.filter(id => id !== studentId);

  const ref = col().doc(familyId);
  await ref.update({
    studentIds: newIds,
    updatedAt:  nowISO(),
    updatedBy:  actorUserId,
  });

  // Clear familyId from student doc
  await db.collection("students").doc(studentId).update({
    familyId:     null,
    isSibling:    false,
    siblingOrder: null,
    updatedAt:    nowISO(),
  }).catch(() => {});

  // If only 1 child remains, they're no longer a sibling
  if (newIds.length === 1) {
    await db.collection("students").doc(newIds[0]).update({ isSibling: false }).catch(() => {});
  }

  const studentSnap = await db.collection("students").doc(studentId).get().catch(() => null);
  const studentName = studentSnap?.exists
    ? (studentSnap.data().studentName || studentSnap.data().Student_Name || studentId)
    : studentId;

  await _logEvent(familyId, {
    type:        "CHILD_UNLINKED",
    description: `${studentName} removed from family`,
    actorUserId,
    metadata:    { studentId, studentName },
  });

  return { success: true, message: "Student removed from family" };
}

async function remove(familyId) {
  const family = await getOne(familyId);
  if (!family) return false;

  // Clear familyId from all linked students
  await Promise.all(
    family.studentIds.map(id =>
      db.collection("students").doc(id).update({
        familyId:     null,
        isSibling:    false,
        siblingOrder: null,
        updatedAt:    nowISO(),
      }).catch(() => {}),
    ),
  );

  await col().doc(familyId).delete();
  return true;
}

// ── Search ─────────────────────────────────────────────────────────

async function search(query, { schoolId = SCHOOL_ID } = {}) {
  if (!query) return getAll({ schoolId });

  const q   = query.toLowerCase().trim();
  const all = await getAll({ schoolId });

  return all.filter(f =>
    f.guardian1Name.toLowerCase().includes(q)     ||
    f.guardian2Name.toLowerCase().includes(q)     ||
    f.primaryContact.includes(q)                  ||
    f.alternateContact.includes(q)                ||
    f.email.toLowerCase().includes(q)             ||
    f.familyCode.toLowerCase().includes(q),
  );
}

// ── Notes ──────────────────────────────────────────────────────────

async function getNotes(familyId) {
  const snap = await col().doc(familyId).collection("notes")
    .orderBy("createdAt", "desc").get();
  return snap.docs.map(d => ({ noteId: d.id, ...d.data() }));
}

async function addNote(familyId, { content, authorName, authorId } = {}) {
  if (!content?.trim()) throw new Error("Note content is required.");
  const ref  = col().doc(familyId).collection("notes").doc();
  const note = {
    noteId:     ref.id,
    content:    content.trim(),
    authorName: authorName || "Staff",
    authorId:   authorId   || "system",
    createdAt:  nowISO(),
  };
  await ref.set(note);
  await _logEvent(familyId, {
    type:        "NOTE_ADDED",
    description: `Note added by ${authorName || "Staff"}`,
    actorUserId: authorId,
    metadata:    { noteId: ref.id, preview: content.slice(0, 80) },
  });
  return { success: true, note };
}

async function deleteNote(familyId, noteId) {
  await col().doc(familyId).collection("notes").doc(noteId).delete();
  return { success: true };
}

// ── Documents ──────────────────────────────────────────────────────

async function getDocuments(familyId) {
  const snap = await col().doc(familyId).collection("documents")
    .orderBy("createdAt", "desc").get();
  return snap.docs.map(d => ({ docId: d.id, ...d.data() }));
}

async function addDocument(familyId, { name, url, type, uploadedBy, uploadedByName } = {}) {
  if (!name?.trim()) throw new Error("Document name is required.");
  const ref = col().doc(familyId).collection("documents").doc();
  const doc = {
    docId:          ref.id,
    name:           name.trim(),
    url:            url || "",
    type:           type || "other",
    uploadedBy:     uploadedBy     || "system",
    uploadedByName: uploadedByName || "Staff",
    createdAt:      nowISO(),
  };
  await ref.set(doc);
  await _logEvent(familyId, {
    type:        "DOCUMENT_ADDED",
    description: `Document "${name}" added by ${uploadedByName || "Staff"}`,
    actorUserId: uploadedBy,
    metadata:    { docId: ref.id, docName: name, docType: type },
  });
  return { success: true, document: doc };
}

async function deleteDocument(familyId, docId) {
  await col().doc(familyId).collection("documents").doc(docId).delete();
  return { success: true };
}

// ── Timeline ───────────────────────────────────────────────────────

async function getTimeline(familyId) {
  const snap = await col().doc(familyId).collection("timeline")
    .orderBy("createdAt", "desc").limit(50).get();
  return snap.docs.map(d => ({ eventId: d.id, ...d.data() }));
}

// ── Outstanding fees by family ─────────────────────────────────────

async function getFeesSummary(familyId, schoolId = SCHOOL_ID) {
  const family = await getOne(familyId);
  if (!family || !family.studentIds.length) {
    return { totalOutstanding: 0, totalInvoiced: 0, totalPaid: 0, byStudent: [] };
  }

  // Fetch student names
  const studentSnaps = await Promise.all(
    family.studentIds.map(id => db.collection("students").doc(id).get().catch(() => null)),
  );
  const studentNames = {};
  studentSnaps.forEach(s => {
    if (s?.exists) {
      const d = s.data();
      studentNames[s.id] = d.studentName || d.Student_Name || s.id;
    }
  });

  // Firestore 'in' supports up to 10 items; chunk if family is large
  const ids   = family.studentIds.slice(0, 10);
  const invoiceSnap = await db.collection("invoices")
    .where("schoolId", "==", schoolId)
    .where("studentId", "in", ids)
    .get();

  const byStudent = {};
  family.studentIds.forEach(id => {
    byStudent[id] = {
      studentId:    id,
      studentName:  studentNames[id] || id,
      invoiced:     0,
      paid:         0,
      outstanding:  0,
      invoiceCount: 0,
    };
  });

  invoiceSnap.docs.forEach(d => {
    const inv = d.data();
    const sid = inv.studentId;
    if (!byStudent[sid]) return;
    const invoiced    = parseFloat(inv.totalAmount) || 0;
    const paid        = parseFloat(inv.paidAmount)  || 0;
    byStudent[sid].invoiced     += invoiced;
    byStudent[sid].paid         += paid;
    byStudent[sid].outstanding  += Math.max(0, invoiced - paid);
    byStudent[sid].invoiceCount++;
  });

  const rows = Object.values(byStudent);
  return {
    totalOutstanding: rows.reduce((s, r) => s + r.outstanding, 0),
    totalInvoiced:    rows.reduce((s, r) => s + r.invoiced,    0),
    totalPaid:        rows.reduce((s, r) => s + r.paid,        0),
    byStudent:        rows,
  };
}

// ── Sibling discount rules ─────────────────────────────────────────

async function getDiscountRules(schoolId = SCHOOL_ID) {
  const snap = await db.collection("_settings").doc(`siblingDiscounts_${schoolId}`).get();
  if (!snap.exists) {
    return {
      schoolId,
      rules: [
        { siblingOrder: 2, discountPercent: 10, label: "2nd Child" },
        { siblingOrder: 3, discountPercent: 15, label: "3rd Child" },
        { siblingOrder: 4, discountPercent: 20, label: "4th Child+" },
      ],
    };
  }
  const d = snap.data();
  return { rules: d.rules || [], schoolId, updatedAt: d.updatedAt || "", updatedBy: d.updatedBy || "" };
}

async function updateDiscountRules(rules, { schoolId = SCHOOL_ID, actorUserId = "system" } = {}) {
  const normalized = (rules || []).map(r => ({
    siblingOrder:    parseInt(r.siblingOrder, 10),
    discountPercent: parseFloat(r.discountPercent),
    label:           r.label || `${r.siblingOrder}${r.siblingOrder === 2 ? "nd" : r.siblingOrder === 3 ? "rd" : "th"} Child`,
  }));
  await db.collection("_settings").doc(`siblingDiscounts_${schoolId}`).set({
    rules:      normalized,
    schoolId,
    updatedAt:  nowISO(),
    updatedBy:  actorUserId,
  });
  return { success: true };
}

module.exports = {
  // Core CRUD
  getAll, getOne, getByStudentId, count,
  create, update, remove,
  addStudent, removeStudent,
  search,
  // V2
  getNotes, addNote, deleteNote,
  getDocuments, addDocument, deleteDocument,
  getTimeline,
  getFeesSummary,
  getDiscountRules, updateDiscountRules,
};
