/**
 * securityService.js — Smart Child Security System
 * ──────────────────────────────────────────────────────────────────
 *
 * Firestore collections:
 *   pickupRequests/{requestId}  — unknown pickup person approvals
 *
 * Child status is derived live from parentAttendance (today's records).
 */

const { db } = require("../firebaseAdmin");
const parentAttSvc = require("./parentAttendanceService");

const SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";

function nowISO() { return new Date().toISOString(); }
function today()  { return new Date().toISOString().slice(0, 10); }

const reqCol = () => db.collection("pickupRequests");

// ── Child Status ───────────────────────────────────────────────────
// Derives PRESENT / CHECKED_OUT / NOT_ARRIVED from today's parentAttendance.
// Most recent record wins.

async function getChildStatus(studentId, { schoolId = SCHOOL_ID, centerId } = {}) {
  const entries = await parentAttSvc.getAll({
    date: today(),
    studentId,
    schoolId,
    centerId: centerId || undefined,
  });

  if (!entries.length) {
    return {
      status:         "NOT_ARRIVED",
      lastAction:     null,
      lastActionTime: null,
      checkinTime:    null,
      gate:           null,
    };
  }

  // entries are already sorted newest-first by createdAt
  const latest  = entries[0];
  const checkin  = entries.find(e => e.action === "Check_In");

  if (latest.action === "Check_In") {
    return {
      status:         "PRESENT",
      lastAction:     "Check_In",
      lastActionTime: latest.createdAt,
      checkinTime:    latest.createdAt,
      checkoutTime:   null,
      gate:           latest.gate || null,
    };
  }

  return {
    status:         "CHECKED_OUT",
    lastAction:     "Check_Out",
    lastActionTime: latest.createdAt,
    checkinTime:    checkin?.createdAt || null,
    checkoutTime:   latest.createdAt,
    gate:           latest.gate || null,
  };
}

// ── Pickup Requests ────────────────────────────────────────────────

function docToRequest(snap) {
  const d = snap.data ? snap.data() : {};
  return {
    requestId:      snap.id || d.requestId || "",
    studentId:      d.studentId      || "",
    studentName:    d.studentName    || "",
    personName:     d.personName     || "Unknown Person",
    personPhoto:    d.personPhoto    || "",
    relation:       d.relation       || "Unknown",
    requestedBy:    d.requestedBy    || "",
    staffName:      d.staffName      || "",
    gate:           d.gate           || "",
    status:         d.status         || "pending",
    approvedBy:     d.approvedBy     || "",
    rejectedReason: d.rejectedReason || "",
    schoolId:       d.schoolId       || SCHOOL_ID,
    centerId:       d.centerId       || "",
    createdAt:      d.createdAt      || "",
    updatedAt:      d.updatedAt      || "",
    resolvedAt:     d.resolvedAt     || "",
  };
}

async function createPickupRequest({
  studentId, studentName, personName, personPhoto,
  relation, staffName, gate,
  schoolId = SCHOOL_ID, centerId = "", requestedBy = "system",
}) {
  const requestId = `PKR-${Date.now()}`;
  const now = nowISO();
  const doc = {
    requestId,
    studentId:      studentId   || "",
    studentName:    studentName || "",
    personName:     personName  || "Unknown Person",
    personPhoto:    typeof personPhoto === "string" ? personPhoto.slice(0, 49_000) : "",
    relation:       relation    || "Unknown",
    requestedBy,
    staffName:      staffName   || "",
    gate:           gate        || "",
    status:         "pending",
    approvedBy:     "",
    rejectedReason: "",
    schoolId,
    centerId,
    createdAt: now,
    updatedAt: now,
    resolvedAt: "",
  };
  await reqCol().doc(requestId).set(doc);
  return { ...doc, requestId };
}

async function getPickupRequests({ studentId, status, schoolId = SCHOOL_ID, centerId } = {}) {
  let q = reqCol().where("schoolId", "==", schoolId);
  if (studentId) q = q.where("studentId", "==", studentId);
  if (status)    q = q.where("status",    "==", status);

  let snap;
  try {
    snap = await q.orderBy("createdAt", "desc").get();
  } catch {
    // Firestore may need an index the first time — fallback to unordered
    snap = await q.get();
  }

  let requests = snap.docs.map(docToRequest);
  if (centerId) requests = requests.filter(r => r.centerId === centerId);
  // Sort newest first in JS as fallback
  requests.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return requests;
}

async function getPickupRequest(requestId) {
  const ref  = reqCol().doc(requestId);
  const snap = await ref.get();
  return snap.exists ? docToRequest(snap) : null;
}

async function updatePickupRequest(requestId, updates) {
  const ref  = reqCol().doc(requestId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  await ref.update({ ...updates, updatedAt: nowISO() });
  const updated = await ref.get();
  return docToRequest(updated);
}

module.exports = {
  getChildStatus,
  createPickupRequest,
  getPickupRequests,
  getPickupRequest,
  updatePickupRequest,
};
