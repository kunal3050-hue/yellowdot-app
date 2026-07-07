/**
 * leaveService.js — Leave Management for staff
 * ───────────────────────────────────────────────
 * Collections:
 *   leaveTypes/{id}      — master leave type definitions (auto-seeded)
 *   leaveBalances/{id}   — per-staff per-year per-type balance
 *   leaveRequests/{id}   — applied leave records
 *
 * Tenant-safe: every document carries tenantId, schoolId, centerId, audit.
 * Soft delete on leaveRequests (deletedAt / deletedBy).
 *
 * Approval workflow:
 *   pending → approved | rejected | cancelled
 *   On approval: leaveBalances row is decremented; staffAttendance rows for
 *   the date range are auto-marked with status "leave".
 */

const { db }    = require("../firebaseAdmin");

const SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";
const types     = () => db.collection("leaveTypes");
const balances  = () => db.collection("leaveBalances");
const requests  = () => db.collection("leaveRequests");
const nowISO    = () => new Date().toISOString();

// ── Defaults seeded on first read ─────────────────────────────────

const DEFAULT_TYPES = [
  { code: "CL",   name: "Casual Leave",     annualEntitlement: 12, paid: true,  carryForward: false, maxCarryForward: 0,  gender: "any",    requiresApproval: true,  sortOrder: 10 },
  { code: "SL",   name: "Sick Leave",       annualEntitlement: 10, paid: true,  carryForward: false, maxCarryForward: 0,  gender: "any",    requiresApproval: true,  sortOrder: 20 },
  { code: "EL",   name: "Earned Leave",     annualEntitlement: 15, paid: true,  carryForward: true,  maxCarryForward: 30, gender: "any",    requiresApproval: true,  sortOrder: 30 },
  { code: "ML",   name: "Maternity Leave",  annualEntitlement: 180,paid: true,  carryForward: false, maxCarryForward: 0,  gender: "female", requiresApproval: true,  sortOrder: 40 },
  { code: "PL",   name: "Paternity Leave",  annualEntitlement: 15, paid: true,  carryForward: false, maxCarryForward: 0,  gender: "male",   requiresApproval: true,  sortOrder: 50 },
  { code: "LWP",  name: "Loss of Pay",      annualEntitlement: 0,  paid: false, carryForward: false, maxCarryForward: 0,  gender: "any",    requiresApproval: true,  sortOrder: 60 },
  { code: "COMP", name: "Compensatory Off", annualEntitlement: 0,  paid: true,  carryForward: true,  maxCarryForward: 0,  gender: "any",    requiresApproval: true,  sortOrder: 70 },
];

const _seededTypes = new Set();
async function _seedTypes(schoolId, tenantId) {
  if (_seededTypes.has(schoolId)) return;
  const snap = await types().where("schoolId", "==", schoolId).limit(1).get();
  if (!snap.empty) { _seededTypes.add(schoolId); return; }
  const batch = db.batch();
  const now   = nowISO();
  for (const t of DEFAULT_TYPES) {
    const ref = types().doc();
    batch.set(ref, {
      leaveTypeId: ref.id,
      tenantId: tenantId || schoolId,
      schoolId,
      centerId: "",
      ...t,
      active:   true,
      isSystem: true,
      createdAt: now, updatedAt: now,
      createdBy: "system-seed", updatedBy: "system-seed",
    });
  }
  await batch.commit();
  _seededTypes.add(schoolId);
}

// ── Mappers ───────────────────────────────────────────────────────

function docToType(snap) {
  const d = snap.data ? snap.data() : snap;
  const id = snap.id || d.leaveTypeId || "";
  return {
    leaveTypeId: d.leaveTypeId || id,
    tenantId:    d.tenantId    || d.schoolId || SCHOOL_ID,
    schoolId:    d.schoolId    || SCHOOL_ID,
    centerId:    d.centerId    || "",
    code:        d.code        || "",
    name:        d.name        || "",
    annualEntitlement: Number(d.annualEntitlement || 0),
    paid:           d.paid !== false,
    carryForward:   Boolean(d.carryForward),
    maxCarryForward:Number(d.maxCarryForward || 0),
    gender:         d.gender || "any",
    requiresApproval: d.requiresApproval !== false,
    active:         d.active !== false,
    isSystem:       Boolean(d.isSystem),
    sortOrder:      typeof d.sortOrder === "number" ? d.sortOrder : 0,
    createdAt: d.createdAt || "", updatedAt: d.updatedAt || "",
    createdBy: d.createdBy || "", updatedBy: d.updatedBy || "",
  };
}

function docToBalance(snap) {
  const d = snap.data ? snap.data() : snap;
  const id = snap.id || d.balanceId || "";
  return {
    balanceId:   d.balanceId   || id,
    tenantId:    d.tenantId    || d.schoolId || SCHOOL_ID,
    schoolId:    d.schoolId    || SCHOOL_ID,
    centerId:    d.centerId    || "",
    staffId:     d.staffId     || "",
    employeeCode:d.employeeCode|| "",
    displayName: d.displayName || "",
    leaveTypeId: d.leaveTypeId || "",
    leaveCode:   d.leaveCode   || "",
    leaveName:   d.leaveName   || "",
    year:        Number(d.year || new Date().getFullYear()),
    entitled:    Number(d.entitled || 0),
    used:        Number(d.used || 0),
    pending:     Number(d.pending || 0),
    carriedForward: Number(d.carriedForward || 0),
    remaining:   Math.max(0, Number(d.entitled || 0) + Number(d.carriedForward || 0) - Number(d.used || 0) - Number(d.pending || 0)),
    createdAt: d.createdAt || "", updatedAt: d.updatedAt || "",
    createdBy: d.createdBy || "", updatedBy: d.updatedBy || "",
  };
}

function docToRequest(snap) {
  const d = snap.data ? snap.data() : snap;
  const id = snap.id || d.requestId || "";
  return {
    requestId:   d.requestId   || id,
    tenantId:    d.tenantId    || d.schoolId || SCHOOL_ID,
    schoolId:    d.schoolId    || SCHOOL_ID,
    centerId:    d.centerId    || "",
    staffId:     d.staffId     || "",
    employeeCode:d.employeeCode|| "",
    displayName: d.displayName || "",
    departmentName: d.departmentName || "",
    designationName:d.designationName|| "",
    leaveTypeId: d.leaveTypeId || "",
    leaveCode:   d.leaveCode   || "",
    leaveName:   d.leaveName   || "",
    fromDate:    d.fromDate    || "",
    toDate:      d.toDate      || "",
    days:        Number(d.days || 0),
    halfDayStart:Boolean(d.halfDayStart),
    halfDayEnd:  Boolean(d.halfDayEnd),
    reason:      d.reason      || "",
    attachmentUrl: d.attachmentUrl || "",
    status:      d.status      || "pending",
    appliedAt:   d.appliedAt   || d.createdAt || "",
    approverId:  d.approverId  || "",
    approverName:d.approverName|| "",
    approverComment: d.approverComment || "",
    decidedAt:   d.decidedAt   || "",
    deletedAt:   d.deletedAt   || "",
    deletedBy:   d.deletedBy   || "",
    createdAt: d.createdAt || "", updatedAt: d.updatedAt || "",
    createdBy: d.createdBy || "", updatedBy: d.updatedBy || "",
  };
}

// ── Helpers ───────────────────────────────────────────────────────

async function _getStaff(staffId) {
  const snap = await db.collection("staff").doc(staffId).get();
  if (snap.exists) return { staffId: snap.id, ...snap.data() };
  const q = await db.collection("staff").where("staffId", "==", staffId).limit(1).get();
  return q.empty ? null : { staffId: q.docs[0].id, ...q.docs[0].data() };
}

function _daysBetween(fromDate, toDate, halfStart, halfEnd) {
  const a = new Date(fromDate + "T00:00:00");
  const b = new Date(toDate   + "T00:00:00");
  let raw = Math.round((b - a) / 86400000) + 1;
  if (raw < 1) raw = 1;
  let total = raw;
  if (halfStart) total -= 0.5;
  if (halfEnd)   total -= 0.5;
  return Math.max(0.5, total);
}

function _enumerateDates(fromDate, toDate) {
  const out = [];
  const cur = new Date(fromDate + "T00:00:00");
  const end = new Date(toDate   + "T00:00:00");
  while (cur <= end) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

// ── Leave Types CRUD ─────────────────────────────────────────────

async function listTypes({ schoolId = SCHOOL_ID, tenantId, active } = {}) {
  await _seedTypes(schoolId, tenantId).catch(err => console.warn("[leaveService] seed types failed:", err.message));
  const snap = await types().where("schoolId", "==", schoolId).get();
  let rows = snap.docs.map(docToType);
  if (active !== undefined) rows = rows.filter(r => r.active === (active !== false && active !== "false"));
  rows.sort((a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name));
  return rows;
}

async function getType(id) {
  const snap = await types().doc(id).get();
  return snap.exists ? docToType(snap) : null;
}

async function createType(data, { schoolId = SCHOOL_ID, tenantId, actorUserId = "system" } = {}) {
  const name = (data.name || "").trim();
  if (!name) { const e = new Error("Leave type name is required."); e.code = "VALIDATION"; throw e; }
  const code = (data.code || "").trim().toUpperCase();
  if (code) {
    const dup = await types().where("schoolId", "==", schoolId).where("code", "==", code).limit(1).get();
    if (!dup.empty) { const e = new Error("A leave type with this code already exists."); e.code = "DUPLICATE"; throw e; }
  }
  const ref = types().doc();
  const doc = {
    leaveTypeId: ref.id,
    tenantId: tenantId || schoolId, schoolId,
    centerId: (data.centerId || "").trim(),
    code, name,
    annualEntitlement: Number(data.annualEntitlement || 0),
    paid:             data.paid !== false,
    carryForward:     Boolean(data.carryForward),
    maxCarryForward:  Number(data.maxCarryForward || 0),
    gender:           data.gender || "any",
    requiresApproval: data.requiresApproval !== false,
    active:           data.active !== false,
    isSystem:         false,
    sortOrder:        Number(data.sortOrder) || 0,
    createdAt: nowISO(), updatedAt: nowISO(),
    createdBy: actorUserId, updatedBy: actorUserId,
  };
  await ref.set(doc);
  return docToType(doc);
}

async function updateType(id, data, { actorUserId = "system" } = {}) {
  const ref = types().doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const updates = { updatedAt: nowISO(), updatedBy: actorUserId };
  ["name","code","gender","centerId"].forEach(k => {
    if (data[k] !== undefined) updates[k] = (k === "code" ? String(data[k]).toUpperCase() : String(data[k])).trim();
  });
  ["annualEntitlement","maxCarryForward","sortOrder"].forEach(k => {
    if (data[k] !== undefined) updates[k] = Number(data[k]) || 0;
  });
  ["paid","carryForward","requiresApproval","active"].forEach(k => {
    if (data[k] !== undefined) updates[k] = Boolean(data[k]);
  });
  await ref.update(updates);
  return docToType(await ref.get());
}

async function removeType(id) {
  const snap = await types().doc(id).get();
  if (!snap.exists) return false;
  if (snap.data().isSystem) { const e = new Error("System leave types cannot be deleted."); e.code = "IN_USE"; throw e; }
  const used = await requests().where("leaveTypeId", "==", id).limit(1).get();
  if (!used.empty) { const e = new Error("This leave type is referenced by existing requests."); e.code = "IN_USE"; throw e; }
  await types().doc(id).delete();
  return true;
}

// ── Leave Balances ───────────────────────────────────────────────

async function _balanceKey(staffId, leaveTypeId, year) {
  return `${staffId}_${leaveTypeId}_${year}`;
}

async function ensureBalances({ staffId, year, schoolId = SCHOOL_ID, tenantId, actorUserId = "system" }) {
  const staff      = await _getStaff(staffId);
  if (!staff) { const e = new Error("Staff not found."); e.code = "VALIDATION"; throw e; }
  const typesAll   = await listTypes({ schoolId, tenantId, active: true });
  const yr         = Number(year) || new Date().getFullYear();

  const created = [];
  for (const t of typesAll) {
    // Gender filter
    if (t.gender !== "any" && staff.gender && staff.gender !== t.gender) continue;

    const key  = await _balanceKey(staff.staffId, t.leaveTypeId, yr);
    const ref  = balances().doc(key);
    const snap = await ref.get();
    if (snap.exists) continue;

    await ref.set({
      balanceId:    key,
      tenantId:     tenantId || schoolId,
      schoolId,
      centerId:     staff.centerId || "",
      staffId:      staff.staffId,
      employeeCode: staff.employeeCode || "",
      displayName:  staff.displayName || "",
      leaveTypeId:  t.leaveTypeId,
      leaveCode:    t.code,
      leaveName:    t.name,
      year:         yr,
      entitled:     t.annualEntitlement,
      used:         0,
      pending:      0,
      carriedForward: 0,
      createdAt: nowISO(), updatedAt: nowISO(),
      createdBy: actorUserId, updatedBy: actorUserId,
    });
    created.push(key);
  }
  return created;
}

async function getBalancesForStaff({ schoolId = SCHOOL_ID, staffId, year }) {
  const yr   = Number(year) || new Date().getFullYear();
  await ensureBalances({ schoolId, staffId, year: yr });
  const snap = await balances()
    .where("schoolId", "==", schoolId)
    .where("staffId", "==", staffId)
    .where("year", "==", yr)
    .get();
  const rows = snap.docs.map(docToBalance);
  rows.sort((a, b) => a.leaveName.localeCompare(b.leaveName));
  return rows;
}

async function _adjustBalance({ schoolId, staffId, leaveTypeId, year, deltaUsed = 0, deltaPending = 0 }) {
  const key = await _balanceKey(staffId, leaveTypeId, year);
  const ref = balances().doc(key);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      // Lazily create with zero entitlement so the delta is at least tracked
      tx.set(ref, {
        balanceId: key, tenantId: schoolId, schoolId, staffId,
        leaveTypeId, year, entitled: 0, used: 0, pending: 0, carriedForward: 0,
        createdAt: nowISO(), updatedAt: nowISO(),
      });
    }
    const fresh = (await tx.get(ref)).data();
    tx.update(ref, {
      used:    Math.max(0, Number(fresh.used    || 0) + deltaUsed),
      pending: Math.max(0, Number(fresh.pending || 0) + deltaPending),
      updatedAt: nowISO(),
    });
  });
}

// ── Leave Requests ───────────────────────────────────────────────

async function listRequests({ schoolId = SCHOOL_ID, centerId, staffId, status, fromDate, toDate, includeDeleted = false } = {}) {
  let q = requests().where("schoolId", "==", schoolId);
  if (staffId) q = q.where("staffId", "==", staffId);
  const snap = await q.get();
  let rows = snap.docs.map(docToRequest);
  if (!includeDeleted) rows = rows.filter(r => !r.deletedAt);
  if (centerId) rows = rows.filter(r => r.centerId === centerId);
  if (status)   rows = rows.filter(r => r.status === status);
  if (fromDate) rows = rows.filter(r => r.toDate   >= fromDate);
  if (toDate)   rows = rows.filter(r => r.fromDate <= toDate);
  rows.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return rows;
}

async function getRequest(id) {
  const snap = await requests().doc(id).get();
  return snap.exists ? docToRequest(snap) : null;
}

async function createRequest(data, { schoolId = SCHOOL_ID, tenantId, actorUserId = "system" } = {}) {
  if (!data.staffId)     { const e = new Error("staffId is required."); e.code = "VALIDATION"; throw e; }
  if (!data.leaveTypeId) { const e = new Error("leaveTypeId is required."); e.code = "VALIDATION"; throw e; }
  if (!data.fromDate || !data.toDate) { const e = new Error("fromDate and toDate are required."); e.code = "VALIDATION"; throw e; }
  if (data.fromDate > data.toDate)    { const e = new Error("fromDate must be on or before toDate."); e.code = "VALIDATION"; throw e; }

  const staff = await _getStaff(data.staffId);
  if (!staff) { const e = new Error("Staff not found."); e.code = "VALIDATION"; throw e; }

  const t = await getType(data.leaveTypeId);
  if (!t) { const e = new Error("Leave type not found."); e.code = "VALIDATION"; throw e; }

  const days = _daysBetween(data.fromDate, data.toDate, !!data.halfDayStart, !!data.halfDayEnd);

  const ref = requests().doc();
  const doc = {
    requestId: ref.id,
    tenantId: tenantId || schoolId,
    schoolId,
    centerId: staff.centerId || "",
    staffId:      staff.staffId,
    employeeCode: staff.employeeCode || "",
    displayName:  staff.displayName || "",
    departmentName: staff.departmentName || "",
    designationName:staff.designationName|| "",
    leaveTypeId: t.leaveTypeId,
    leaveCode:   t.code,
    leaveName:   t.name,
    fromDate:    data.fromDate,
    toDate:      data.toDate,
    days,
    halfDayStart: Boolean(data.halfDayStart),
    halfDayEnd:   Boolean(data.halfDayEnd),
    reason:      (data.reason || "").trim(),
    attachmentUrl: data.attachmentUrl || "",
    status:      t.requiresApproval ? "pending" : "approved",
    appliedAt:   nowISO(),
    approverId:  t.requiresApproval ? "" : "system",
    approverName:t.requiresApproval ? "" : "Auto-approved",
    decidedAt:   t.requiresApproval ? "" : nowISO(),
    deletedAt:   "", deletedBy: "",
    createdAt: nowISO(), updatedAt: nowISO(),
    createdBy: actorUserId, updatedBy: actorUserId,
  };
  await ref.set(doc);

  const year = Number(data.fromDate.slice(0, 4));
  if (doc.status === "pending") {
    await _adjustBalance({ schoolId, staffId: staff.staffId, leaveTypeId: t.leaveTypeId, year, deltaPending: days });
  } else {
    // Auto-approved
    await _adjustBalance({ schoolId, staffId: staff.staffId, leaveTypeId: t.leaveTypeId, year, deltaUsed: days });
    await _markAttendanceLeave({ schoolId, staff, doc });
  }

  return docToRequest(doc);
}

async function _markAttendanceLeave({ schoolId, staff, doc }) {
  // Best-effort: write a "leave" attendance row for each date in the range
  try {
    const attendanceSvc = require("./staffAttendanceService");
    for (const date of _enumerateDates(doc.fromDate, doc.toDate)) {
      await attendanceSvc.markStatus({
        schoolId, staffId: staff.staffId, date,
        status: "leave",
        notes: `${doc.leaveName} (auto via leave approval)`,
        actorUserId: "system",
      }).catch(() => {});
    }
  } catch (err) {
    console.warn("[leaveService] auto-mark attendance failed:", err.message);
  }
}

async function decideRequest(id, { decision, comment = "", approverId, approverName }) {
  if (!["approved","rejected","cancelled"].includes(decision)) {
    const e = new Error("Invalid decision."); e.code = "VALIDATION"; throw e;
  }
  const ref  = requests().doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const existing = docToRequest(snap);
  if (existing.status !== "pending") {
    const e = new Error(`Request already ${existing.status}.`); e.code = "VALIDATION"; throw e;
  }

  await ref.update({
    status: decision,
    approverId:   approverId   || "system",
    approverName: approverName || "System",
    approverComment: comment,
    decidedAt: nowISO(),
    updatedAt: nowISO(),
    updatedBy: approverId || "system",
  });

  const year = Number(existing.fromDate.slice(0, 4));
  if (decision === "approved") {
    await _adjustBalance({ schoolId: existing.schoolId, staffId: existing.staffId, leaveTypeId: existing.leaveTypeId, year, deltaPending: -existing.days, deltaUsed: existing.days });
    const staff = await _getStaff(existing.staffId);
    if (staff) await _markAttendanceLeave({ schoolId: existing.schoolId, staff, doc: existing });
  } else {
    // rejected or cancelled — release the pending hold
    await _adjustBalance({ schoolId: existing.schoolId, staffId: existing.staffId, leaveTypeId: existing.leaveTypeId, year, deltaPending: -existing.days });
  }

  return docToRequest((await ref.get()));
}

async function cancelRequest(id, { actorUserId = "system" }) {
  return decideRequest(id, { decision: "cancelled", comment: "Cancelled by applicant", approverId: actorUserId, approverName: "Applicant" });
}

async function removeRequest(id, { actorUserId = "system" }) {
  const snap = await requests().doc(id).get();
  if (!snap.exists) return false;
  await requests().doc(id).update({
    deletedAt: nowISO(), deletedBy: actorUserId,
    updatedAt: nowISO(), updatedBy: actorUserId,
  });
  return true;
}

// ── Calendar + reports ────────────────────────────────────────────

async function calendarFeed({ schoolId = SCHOOL_ID, fromDate, toDate, centerId }) {
  const rows = await listRequests({ schoolId, centerId, fromDate, toDate });
  const approved = rows.filter(r => r.status === "approved" || r.status === "pending");
  // Pull holidays for the same window (if collection exists)
  let holidays = [];
  try {
    const snap = await db.collection("holidays").where("schoolId", "==", schoolId).get();
    holidays = snap.docs.map(d => ({ ...d.data(), holidayId: d.id }))
      .filter(h => (!fromDate || h.date >= fromDate) && (!toDate || h.date <= toDate));
  } catch { /* optional */ }
  return { leaves: approved, holidays };
}

async function dashboard({ schoolId = SCHOOL_ID, centerId }) {
  const all = await listRequests({ schoolId, centerId });
  const today = new Date().toISOString().slice(0, 10);
  let pending = 0, approvedThisMonth = 0, onLeaveToday = 0;
  const monthStart = today.slice(0, 7) + "-01";
  for (const r of all) {
    if (r.status === "pending") pending++;
    if (r.status === "approved" && r.decidedAt >= monthStart) approvedThisMonth++;
    if (r.status === "approved" && r.fromDate <= today && r.toDate >= today) onLeaveToday++;
  }
  return {
    total: all.length, pending, approvedThisMonth, onLeaveToday,
    recent: all.slice(0, 10),
  };
}

async function leaveReport({ schoolId = SCHOOL_ID, year, centerId }) {
  const yr   = Number(year) || new Date().getFullYear();
  const from = `${yr}-01-01`;
  const to   = `${yr}-12-31`;
  const all  = await listRequests({ schoolId, centerId, fromDate: from, toDate: to });
  const byStaff = new Map();
  all.forEach(r => {
    if (r.status !== "approved") return;
    const k = r.staffId;
    const cur = byStaff.get(k) || {
      staffId: r.staffId, displayName: r.displayName, employeeCode: r.employeeCode,
      departmentName: r.departmentName, totalDays: 0, byType: {},
    };
    cur.totalDays += r.days;
    cur.byType[r.leaveCode] = (cur.byType[r.leaveCode] || 0) + r.days;
    byStaff.set(k, cur);
  });
  const rows = [...byStaff.values()].sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""));
  return { year: yr, totalRequests: all.length, rows };
}

module.exports = {
  // Types
  listTypes, getType, createType, updateType, removeType,
  // Balances
  ensureBalances, getBalancesForStaff,
  // Requests
  listRequests, getRequest, createRequest, decideRequest, cancelRequest, removeRequest,
  // Aggregates
  calendarFeed, dashboard, leaveReport,
};
