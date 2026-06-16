/**
 * incidentService.js — Incident / Accident Reports data layer
 * ────────────────────────────────────────────────────────────
 * Collections:
 *   incidentReports          — core incident records
 *   incidentAcknowledgements — parent acknowledgements
 *   incidentAuditLogs        — full audit trail
 */

const { db } = require("../firebaseAdmin");

const SCHOOL_ID = process.env.SCHOOL_ID || "ydseawoods";
const nowISO    = () => new Date().toISOString();

const incCol  = () => db.collection("incidentReports");
const ackCol  = () => db.collection("incidentAcknowledgements");
const logCol  = () => db.collection("incidentAuditLogs");

function nanoid6() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// ── Audit helpers ──────────────────────────────────────────────────

async function auditLog({ incidentId, action, oldValue = null, newValue = null, changedBy = "" }) {
  const id = `LOG-${Date.now()}-${nanoid6()}`;
  await logCol().doc(id).set({
    incidentId,
    action,
    oldValue:  oldValue  !== null ? String(oldValue)  : null,
    newValue:  newValue  !== null ? String(newValue)  : null,
    changedBy,
    timestamp: nowISO(),
  });
}

// ── Incidents ──────────────────────────────────────────────────────

/**
 * List incidents, optionally filtered.
 * Filters applied in-memory after schoolId query (avoids composite index requirements).
 */
async function getIncidents({ schoolId = SCHOOL_ID, studentId, classId, severity, status, dateFrom, dateTo } = {}) {
  const snap = await incCol().where("schoolId", "==", schoolId).get();
  let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  if (studentId) docs = docs.filter(d => d.studentId === studentId);
  if (classId)   docs = docs.filter(d => d.classId   === classId);
  if (severity)  docs = docs.filter(d => d.severity  === severity);
  if (status)    docs = docs.filter(d => d.status    === status);
  if (dateFrom)  docs = docs.filter(d => d.incidentDate >= dateFrom);
  if (dateTo)    docs = docs.filter(d => d.incidentDate <= dateTo);

  // Sort: critical first, then by date desc
  const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
  docs.sort((a, b) => {
    const sa = SEVERITY_ORDER[a.severity] ?? 4;
    const sb = SEVERITY_ORDER[b.severity] ?? 4;
    if (sa !== sb) return sa - sb;
    return (b.incidentDate + b.incidentTime || "").localeCompare(a.incidentDate + a.incidentTime || "");
  });

  return docs;
}

async function getIncident(id) {
  const doc = await incCol().doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

async function createIncident(data, { schoolId = SCHOOL_ID, actorUserId } = {}) {
  const id  = `INC-${Date.now()}-${nanoid6()}`;
  const now = nowISO();
  const payload = {
    schoolId,
    studentId:              data.studentId,
    classId:                data.classId || "",
    incidentType:           data.incidentType,
    severity:               data.severity || "low",
    incidentDate:           data.incidentDate,
    incidentTime:           data.incidentTime || "",
    location:               data.location,
    locationOther:          data.locationOther || "",
    description:            data.description,
    actionTaken:            data.actionTaken,
    immediateResponse:      data.immediateResponse || "",
    reportedBy:             data.reportedBy || actorUserId || "",
    reportedByName:         data.reportedByName || "",
    witnessStaffIds:        data.witnessStaffIds || [],
    witnessStaffNames:      data.witnessStaffNames || [],
    photoUrls:              data.photoUrls || [],
    notifyParent:           data.notifyParent !== false,
    acknowledgementRequired: data.acknowledgementRequired || false,
    status:                 "open",
    createdBy:              actorUserId || "",
    createdAt:              now,
    updatedAt:              now,
  };
  await incCol().doc(id).set(payload);

  await auditLog({ incidentId: id, action: "created", newValue: payload.status, changedBy: actorUserId });

  return { id, ...payload };
}

async function updateIncident(id, data, { actorUserId } = {}) {
  const now = nowISO();
  const allowed = [
    "incidentType","severity","incidentDate","incidentTime","location","locationOther",
    "description","actionTaken","immediateResponse","reportedBy","reportedByName",
    "witnessStaffIds","witnessStaffNames","photoUrls","notifyParent","acknowledgementRequired",
    "classId",
  ];
  const patch = { updatedAt: now };
  for (const k of allowed) {
    if (data[k] !== undefined) patch[k] = data[k];
  }
  await incCol().doc(id).update(patch);
  await auditLog({ incidentId: id, action: "updated", changedBy: actorUserId });
  return getIncident(id);
}

async function deleteIncident(id) {
  await incCol().doc(id).delete();
  // Delete related docs
  const [acks, logs] = await Promise.all([
    ackCol().where("incidentId","==",id).get(),
    logCol().where("incidentId","==",id).get(),
  ]);
  const batch = db.batch();
  acks.docs.forEach(d => batch.delete(d.ref));
  logs.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
}

async function updateStatus(id, status, { actorUserId } = {}) {
  const validStatuses = ["open","under_review","resolved","closed"];
  if (!validStatuses.includes(status)) throw new Error("Invalid status");
  const existing = await getIncident(id);
  if (!existing) throw new Error("Incident not found");
  const now = nowISO();
  await incCol().doc(id).update({ status, updatedAt: now });
  await auditLog({ incidentId: id, action: "status_changed", oldValue: existing.status, newValue: status, changedBy: actorUserId });
}

// ── Acknowledgements ───────────────────────────────────────────────

async function getAcknowledgement(incidentId) {
  const id  = `ACK-${incidentId}`;
  const doc = await ackCol().doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

async function acknowledge(incidentId, { parentId, acknowledgementNotes = "" }) {
  const id  = `ACK-${incidentId}`;
  const now = nowISO();
  const payload = {
    incidentId,
    parentId,
    acknowledgedAt: now,
    acknowledgementNotes,
  };
  await ackCol().doc(id).set(payload);
  await auditLog({ incidentId, action: "acknowledged", newValue: parentId, changedBy: parentId });
  return { id, ...payload };
}

// ── Audit log ──────────────────────────────────────────────────────

async function getAuditLog(incidentId) {
  const snap = await logCol().where("incidentId","==",incidentId).orderBy("timestamp","asc").get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Dashboard stats ────────────────────────────────────────────────

async function getDashboardStats({ schoolId = SCHOOL_ID } = {}) {
  const all = await getIncidents({ schoolId });

  const thisMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  const open                = all.filter(i => i.status === "open").length;
  const highSeverity        = all.filter(i => ["high","critical"].includes(i.severity) && i.status !== "closed").length;
  const resolvedThisMonth   = all.filter(i => i.status === "resolved" && i.updatedAt?.startsWith(thisMonth)).length;

  // Awaiting ack: acknowledgementRequired=true, not yet acknowledged
  let awaitingAck = 0;
  for (const inc of all.filter(i => i.acknowledgementRequired && i.status !== "closed")) {
    const ack = await getAcknowledgement(inc.id);
    if (!ack) awaitingAck++;
  }

  return { total: all.length, open, highSeverity, awaitingAck, resolvedThisMonth };
}

module.exports = {
  getIncidents, getIncident, createIncident, updateIncident, deleteIncident, updateStatus,
  getAcknowledgement, acknowledge,
  getAuditLog,
  getDashboardStats,
};
