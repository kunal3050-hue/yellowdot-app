/**
 * pickupAuthorizationService.js — Firestore-backed pickup authorization
 * ───────────────────────────────────────────────────────────────────────
 * Collection: pickupLogs (type: "authorization")
 * Fields: entryId, type, studentId, studentName, pickupName, relation,
 *         mobile, photoUrl, idProof, emergency, status, notes,
 *         isParent, isProtected,
 *         schoolId, centerId, center, createdAt, updatedAt
 *
 * Audit log collection: pickupAuditLogs
 *   logId, action, entityId, studentId, studentName,
 *   description, changes, actorUserId, schoolId, centerId, createdAt
 */

const { db } = require("../firebaseAdmin");

const SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";
const col      = () => db.collection("pickupLogs");
const auditCol = () => db.collection("pickupAuditLogs");

function nowISO() { return new Date().toISOString(); }

// ── Document mapper ────────────────────────────────────────────────

function docToAuth(snap) {
  const d = snap.data ? snap.data() : (typeof snap.data === "object" ? snap.data : {});
  if (!d || typeof d !== "object") return null;
  return {
    entryId:      d.entryId     || snap.id,
    studentId:    d.studentId   || "",
    studentName:  d.studentName || "",
    pickupName:   d.pickupName  || "",
    relation:     d.relation    || "",
    mobile:       d.mobile      || "",
    photoUrl:     d.photoUrl    || "",
    idProof:      d.idProof     || "",
    emergency:    d.emergency   === true || d.emergency === "true",
    status:       d.status      || "Active",
    notes:        d.notes       || "",
    isParent:     d.isParent    === true,
    isProtected:  d.isProtected === true,
    isIncomplete: d.isIncomplete === true,
    missingFields: Array.isArray(d.missingFields) ? d.missingFields : [],
    schoolId:     d.schoolId    || SCHOOL_ID,
    centerId:     d.centerId    || d.center || "",
    center:       d.centerId    || d.center || "",
    createdAt:    d.createdAt   || "",
    updatedAt:    d.updatedAt   || "",
    createdBy:    d.createdBy   || "",
    updatedBy:    d.updatedBy   || "",
  };
}

// ── Audit log (fire-and-forget — never throws) ─────────────────────

function writeAudit({ action, entityId, studentId, studentName, description, changes = {}, actorUserId = "system", schoolId = SCHOOL_ID, centerId = "" }) {
  const logId = `PKAL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  auditCol().doc(logId).set({
    logId,
    action,           // "created" | "updated" | "status_changed" | "deleted" | "disabled"
    entityId:    entityId    || "",
    studentId:   studentId   || "",
    studentName: studentName || "",
    description: description || "",
    changes,
    actorUserId: actorUserId || "system",
    schoolId,
    centerId,
    createdAt: nowISO(),
  }).catch(err => console.warn("[pickupAudit] write failed:", err.message));
}

// ── Read ───────────────────────────────────────────────────────────

async function getAll(studentId, { schoolId = SCHOOL_ID, centerId } = {}) {
  let q = col()
    .where("schoolId", "==", schoolId)
    .where("type",     "==", "authorization");
  if (studentId) q = q.where("studentId", "==", studentId);
  const snap = await q.get();
  let entries = snap.docs.map(docToAuth).filter(Boolean);
  if (centerId) entries = entries.filter(e => e.centerId === centerId);
  // Parents first (Father → Mother), then by name
  entries.sort((a, b) => {
    if (a.isParent !== b.isParent) return a.isParent ? -1 : 1;
    if (a.relation === "Father" && b.relation !== "Father") return -1;
    if (b.relation === "Father" && a.relation !== "Father") return  1;
    return a.pickupName.localeCompare(b.pickupName);
  });
  return entries;
}

async function getOne(entryId) {
  const ref  = col().doc(entryId);
  const snap = await ref.get();
  return snap.exists ? docToAuth(snap) : null;
}

async function getAuditLogs(studentId, { schoolId = SCHOOL_ID, limit = 50 } = {}) {
  let q = auditCol()
    .where("schoolId",  "==", schoolId)
    .where("studentId", "==", studentId);
  let snap;
  try {
    snap = await q.orderBy("createdAt", "desc").limit(limit).get();
  } catch {
    snap = await q.get();
  }
  const logs = snap.docs.map(s => ({ logId: s.id, ...s.data() }));
  logs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return logs.slice(0, limit);
}

// ── Write ──────────────────────────────────────────────────────────

async function create(data, { schoolId = SCHOOL_ID, centerId = "", actorUserId = "system" } = {}) {
  const entryId        = `PKUP-${Date.now()}`;
  const resolvedCenter = centerId || data.centerId || data.center || "";
  const photoStr   = typeof data.photoUrl === "string" ? data.photoUrl.slice(0, 49_000) : "";
  const idProofStr = typeof data.idProof  === "string" ? data.idProof.slice(0, 49_000)  : "";

  // Determine incompleteness — track which fields are missing
  const missingFields = [];
  if (!data.mobile)   missingFields.push("mobile");
  if (!photoStr)      missingFields.push("photo");
  // Allow caller to force isIncomplete (e.g. migration) or auto-derive it
  const isIncomplete = data.isIncomplete !== undefined
    ? Boolean(data.isIncomplete)
    : missingFields.length > 0 && Boolean(data.isParent);  // only flag parents

  const doc = {
    entryId,
    type:         "authorization",
    studentId:    data.studentId   || "",
    studentName:  data.studentName || "",
    pickupName:   data.pickupName  || "",
    relation:     data.relation    || "",
    mobile:       data.mobile      || "",
    photoUrl:     photoStr,
    idProof:      idProofStr,
    emergency:    Boolean(data.emergency),
    status:       "Active",
    notes:        data.notes       || "",
    isParent:     Boolean(data.isParent),
    isProtected:  Boolean(data.isProtected),
    isIncomplete,
    missingFields: isIncomplete ? missingFields : [],
    schoolId,
    centerId:     resolvedCenter,
    center:       resolvedCenter,
    createdAt:    nowISO(),
    updatedAt:    nowISO(),
    createdBy:    actorUserId,
    updatedBy:    actorUserId,
  };
  await col().doc(entryId).set(doc);

  writeAudit({
    action:      "created",
    entityId:    entryId,
    studentId:   data.studentId,
    studentName: data.studentName,
    description: `${data.pickupName} (${data.relation}) added as authorized pickup person${data.isParent ? " [Parent — auto-created on admission]" : ""}`,
    actorUserId, schoolId, centerId: resolvedCenter,
  });

  return docToAuth({ id: entryId, data: () => doc });
}

async function update(entryId, data, { updatedBy = "system", studentId = "", studentName = "", schoolId = SCHOOL_ID, centerId = "" } = {}) {
  const ref  = col().doc(entryId);
  const snap = await ref.get();
  if (!snap.exists) return null;

  const prev    = docToAuth(snap);
  const updates = { updatedAt: nowISO(), updatedBy };
  const changes = {};

  if (data.pickupName !== undefined && data.pickupName !== prev.pickupName) {
    updates.pickupName = data.pickupName;
    changes.pickupName = { from: prev.pickupName, to: data.pickupName };
  }
  if (data.relation !== undefined && data.relation !== prev.relation) {
    updates.relation = data.relation;
    changes.relation = { from: prev.relation, to: data.relation };
  }
  if (data.mobile !== undefined && data.mobile !== prev.mobile) {
    updates.mobile = data.mobile;
    changes.mobile = { from: prev.mobile, to: data.mobile };
  }
  if (data.emergency !== undefined) updates.emergency = Boolean(data.emergency);
  if (data.notes     !== undefined) updates.notes     = data.notes;
  if (data.status    !== undefined && data.status !== prev.status) {
    updates.status  = data.status;
    changes.status  = { from: prev.status, to: data.status };
  }
  if (typeof data.photoUrl === "string" && data.photoUrl !== prev.photoUrl) {
    updates.photoUrl = data.photoUrl.slice(0, 49_000);
    changes.photoUrl = { from: "<<old>>", to: "<<new>>" };
  }
  if (typeof data.idProof === "string") {
    updates.idProof = data.idProof.slice(0, 49_000);
  }
  if (data.isIncomplete !== undefined) {
    updates.isIncomplete = Boolean(data.isIncomplete);
    if (!updates.isIncomplete) updates.missingFields = [];
  }

  // Auto-clear isIncomplete once photo AND mobile are both present
  if (prev.isIncomplete) {
    const resolvedPhoto  = updates.photoUrl  ?? prev.photoUrl;
    const resolvedMobile = updates.mobile    ?? prev.mobile;
    if (resolvedPhoto && resolvedMobile) {
      updates.isIncomplete  = false;
      updates.missingFields = [];
    }
  }

  await ref.update(updates);

  const action = changes.status
    ? (changes.status.to === "Inactive" ? "disabled" : "enabled")
    : Object.keys(changes).some(k => k === "photoUrl") ? "photo_updated" : "updated";

  writeAudit({
    action,
    entityId:    entryId,
    studentId:   studentId || prev.studentId,
    studentName: studentName || prev.studentName,
    description: `${prev.pickupName} (${prev.relation}) — ${action}`,
    changes,
    actorUserId: updatedBy, schoolId, centerId,
  });

  const updated = await ref.get();
  return docToAuth(updated);
}

async function remove(entryId, { actorUserId = "system", schoolId = SCHOOL_ID, centerId = "" } = {}) {
  const ref  = col().doc(entryId);
  const snap = await ref.get();
  if (!snap.exists) return false;

  const prev = docToAuth(snap);

  // Protected persons (Father/Mother) cannot be hard-deleted
  if (prev.isProtected) return "protected";

  await ref.delete();

  writeAudit({
    action:      "deleted",
    entityId:    entryId,
    studentId:   prev.studentId,
    studentName: prev.studentName,
    description: `${prev.pickupName} (${prev.relation}) removed from authorized pickup list`,
    actorUserId, schoolId, centerId,
  });

  return true;
}

module.exports = { getAll, getOne, getAuditLogs, create, update, remove };
