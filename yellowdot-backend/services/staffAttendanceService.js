/**
 * staffAttendanceService.js — Daily staff attendance
 * ────────────────────────────────────────────────────
 * Collection: staffAttendance/{id} (auto-id)
 * Unique index: schoolId + staffId + date
 *
 * Each document captures a single working day for a single staff member.
 *
 * Status enum:
 *   present | absent | half_day | leave | holiday | wfh | weekend
 *
 * Source enum (how the record was created):
 *   qr   — scanned a staff-attendance QR code
 *   self — staff member checked themselves in via the web/mobile app
 *   manual — center-admin / reception marked it on behalf of staff
 *   auto — back-fill cron (e.g. mark absent at midnight)
 *
 * Derived fields (computed on write — never trust client input):
 *   lateBy         — minutes past shift.startTime + graceMinutes
 *   earlyExitBy    — minutes before shift.endTime
 *   hoursWorked    — (checkOut - checkIn) in hours, rounded to 2 dp
 *   overtimeMinutes — max(0, totalMinutes - shift.overtimeAfterMinutes)
 *   isLate, isEarlyExit — booleans
 *
 * Soft delete: deletedAt + deletedBy. Hidden from list queries by default.
 */

const { db }      = require("../firebaseAdmin");
const shiftSvc    = require("./staffShiftService");

const SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";
const col       = () => db.collection("staffAttendance");
const nowISO    = () => new Date().toISOString();

const STATUSES = new Set([
  "present", "absent", "half_day", "leave", "holiday", "wfh", "weekend",
]);
const SOURCES = new Set(["qr", "self", "manual", "auto"]);

// ── Helpers ─────────────────────────────────────────────────────────

function _today() {
  return new Date().toISOString().slice(0, 10);
}

function _parseHHMM(hhmm) {
  if (!hhmm) return 0;
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function _diffMinutes(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  return Math.max(0, Math.round((new Date(checkOut) - new Date(checkIn)) / 60000));
}

function _isoMinutesFromMidnight(iso) {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

async function _shiftFor(staff, schoolId) {
  if (staff?.shiftId) {
    const s = await shiftSvc.getOne(staff.shiftId);
    if (s) return s;
  }
  return shiftSvc.getDefaultShift(schoolId);
}

function _derive(record, shift) {
  if (!shift) return record;
  const startMin = _parseHHMM(shift.startTime);
  const endMin   = _parseHHMM(shift.endTime);
  const graceEnd = startMin + (shift.graceMinutes || 0);

  let lateBy = 0, earlyExitBy = 0;
  let hoursWorked = 0, overtimeMinutes = 0;

  if (record.checkIn) {
    const inMin = _isoMinutesFromMidnight(record.checkIn);
    if (inMin > graceEnd) lateBy = inMin - startMin;
  }
  if (record.checkOut) {
    const outMin = _isoMinutesFromMidnight(record.checkOut);
    if (outMin < endMin) earlyExitBy = endMin - outMin;
  }
  if (record.checkIn && record.checkOut) {
    const mins = _diffMinutes(record.checkIn, record.checkOut);
    hoursWorked     = Math.round((mins / 60) * 100) / 100;
    overtimeMinutes = Math.max(0, mins - (shift.overtimeAfterMinutes || 480));
  }

  // Derive status if not explicitly set/override
  let status = record.status;
  if (!status || status === "auto") {
    if (record.checkIn && record.checkOut) {
      if (hoursWorked < shift.halfDayMinHours)      status = "half_day";
      else if (hoursWorked < shift.fullDayMinHours) status = "half_day";
      else                                          status = "present";
    } else if (record.checkIn) {
      status = "present";
    } else {
      status = "absent";
    }
  }

  return {
    ...record,
    status,
    lateBy, earlyExitBy,
    hoursWorked, overtimeMinutes,
    isLate:      lateBy > 0,
    isEarlyExit: earlyExitBy > 0,
    shiftId:     shift.shiftId,
    shiftName:   shift.name,
  };
}

// ── Mapper ──────────────────────────────────────────────────────────

function docToAttendance(snap) {
  const d  = snap.data ? snap.data() : snap;
  const id = snap.id   || d.attendanceId || "";
  return {
    attendanceId: d.attendanceId || id,
    tenantId:     d.tenantId     || d.schoolId || SCHOOL_ID,
    schoolId:     d.schoolId     || SCHOOL_ID,
    centerId:     d.centerId     || "",
    staffId:      d.staffId      || "",
    employeeCode: d.employeeCode || "",
    displayName:  d.displayName  || "",
    designationName: d.designationName || "",
    departmentName:  d.departmentName  || "",
    date:         d.date         || "",
    status:       d.status       || "absent",
    source:       d.source       || "manual",
    checkIn:      d.checkIn      || "",
    checkOut:     d.checkOut     || "",
    checkInBy:    d.checkInBy    || "",
    checkOutBy:   d.checkOutBy   || "",
    location:     d.location     || "",
    notes:        d.notes        || "",
    shiftId:      d.shiftId      || "",
    shiftName:    d.shiftName    || "",
    lateBy:       Number(d.lateBy || 0),
    earlyExitBy:  Number(d.earlyExitBy || 0),
    hoursWorked:  Number(d.hoursWorked || 0),
    overtimeMinutes: Number(d.overtimeMinutes || 0),
    isLate:       Boolean(d.isLate),
    isEarlyExit:  Boolean(d.isEarlyExit),
    deletedAt:    d.deletedAt || "",
    deletedBy:    d.deletedBy || "",
    createdAt:    d.createdAt || "", updatedAt: d.updatedAt || "",
    createdBy:    d.createdBy || "", updatedBy: d.updatedBy || "",
  };
}

// ── Lookup helpers ──────────────────────────────────────────────────

async function _getStaff(staffId) {
  const snap = await db.collection("staff").doc(staffId).get();
  if (snap.exists) return { staffId: snap.id, ...snap.data() };
  const q = await db.collection("staff").where("staffId", "==", staffId).limit(1).get();
  if (q.empty) return null;
  return { staffId: q.docs[0].id, ...q.docs[0].data() };
}

async function _findRecord(schoolId, staffId, date) {
  const q = await col()
    .where("schoolId", "==", schoolId)
    .where("staffId", "==", staffId)
    .where("date", "==", date)
    .limit(1).get();
  if (q.empty) return null;
  return { ref: q.docs[0].ref, data: docToAttendance(q.docs[0]) };
}

// ── Read ────────────────────────────────────────────────────────────

async function getAll({
  schoolId = SCHOOL_ID, centerId, staffId, date, fromDate, toDate, status,
  includeDeleted = false,
} = {}) {
  let q = col().where("schoolId", "==", schoolId);
  if (date)    q = q.where("date", "==", date);
  if (staffId) q = q.where("staffId", "==", staffId);

  const snap = await q.get();
  let rows = snap.docs.map(docToAttendance);

  if (!includeDeleted) rows = rows.filter(r => !r.deletedAt);
  if (centerId) rows = rows.filter(r => r.centerId === centerId);
  if (status)   rows = rows.filter(r => r.status === status);
  if (fromDate) rows = rows.filter(r => r.date >= fromDate);
  if (toDate)   rows = rows.filter(r => r.date <= toDate);

  rows.sort((a, b) =>
    a.date.localeCompare(b.date) || a.displayName.localeCompare(b.displayName));
  return rows;
}

async function getForStaffMonth({ schoolId = SCHOOL_ID, staffId, year, month }) {
  const monthStr = String(month).padStart(2, "0");
  const fromDate = `${year}-${monthStr}-01`;
  const toDate   = `${year}-${monthStr}-31`;
  return getAll({ schoolId, staffId, fromDate, toDate });
}

// ── Today snapshot ─────────────────────────────────────────────────

async function todaySnapshot({ schoolId = SCHOOL_ID, centerId } = {}) {
  const date = _today();

  // All active staff in scope
  const staffSnap = await db.collection("staff").where("schoolId", "==", schoolId).get();
  let allStaff = staffSnap.docs.map(d => ({ staffId: d.id, ...d.data() }))
    .filter(s => !s.deletedAt && s.active !== false);
  if (centerId) allStaff = allStaff.filter(s => s.centerId === centerId);

  // Today's records
  const todayRecords = await getAll({ schoolId, centerId, date });
  const byStaff = new Map(todayRecords.map(r => [r.staffId, r]));

  const rows = allStaff.map(s => {
    const r = byStaff.get(s.staffId);
    return r || {
      staffId: s.staffId, employeeCode: s.employeeCode, displayName: s.displayName,
      designationName: s.designationName, departmentName: s.departmentName,
      photoUrl: s.photoUrl, centerId: s.centerId,
      date, status: "absent", source: "auto",
      checkIn: "", checkOut: "",
      hoursWorked: 0, lateBy: 0, earlyExitBy: 0, overtimeMinutes: 0,
      isLate: false, isEarlyExit: false,
      _unmarked: true,
    };
  });

  rows.sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""));

  // Bucket counts
  let present = 0, absent = 0, late = 0, halfDay = 0, leave = 0, onTime = 0;
  for (const r of rows) {
    if (r.status === "present")  { present++; if (!r.isLate) onTime++; else late++; }
    else if (r.status === "absent")   absent++;
    else if (r.status === "half_day") halfDay++;
    else if (r.status === "leave")    leave++;
  }
  return {
    date,
    total: rows.length, present, absent, halfDay, leave, late, onTime,
    rows,
  };
}

// ── Dashboard aggregates ───────────────────────────────────────────

async function dashboard({ schoolId = SCHOOL_ID, centerId } = {}) {
  const t = await todaySnapshot({ schoolId, centerId });

  // Month-to-date attendance % (present + half_day count as worked days)
  const now = new Date();
  const year  = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const fromDate = `${year}-${month}-01`;
  const toDate   = t.date;
  const monthRows = await getAll({ schoolId, centerId, fromDate, toDate });

  let workedDays = 0, totalRecords = 0;
  monthRows.forEach(r => {
    totalRecords++;
    if (r.status === "present" || r.status === "half_day") workedDays++;
  });
  const monthAttendancePct = totalRecords ? Math.round((workedDays / totalRecords) * 100) : 0;

  return {
    today: t,
    monthAttendancePct,
    monthWorkedDays: workedDays,
    monthRecordCount: totalRecords,
  };
}

// ── Mutations ──────────────────────────────────────────────────────

async function _upsert({ schoolId, tenantId, centerId, staff, date, patch, actorUserId, source }) {
  const existing = await _findRecord(schoolId, staff.staffId, date);

  const shift  = await _shiftFor(staff, schoolId);
  const merged = {
    ...(existing?.data || {}),
    ...patch,
    staffId:      staff.staffId,
    employeeCode: staff.employeeCode || "",
    displayName:  staff.displayName  || "",
    designationName: staff.designationName || "",
    departmentName:  staff.departmentName  || "",
    centerId:     centerId ?? staff.centerId ?? "",
    schoolId, tenantId: tenantId || schoolId,
    date,
    source:       patch.source || existing?.data?.source || source || "manual",
  };

  const derived = _derive(merged, shift);
  derived.updatedAt = nowISO();
  derived.updatedBy = actorUserId;

  if (existing) {
    await existing.ref.update(derived);
    return { id: existing.ref.id, ...derived };
  }
  const ref = col().doc();
  derived.attendanceId = ref.id;
  derived.createdAt    = nowISO();
  derived.createdBy    = actorUserId;
  await ref.set(derived);
  return { id: ref.id, ...derived };
}

async function checkIn({ staffId, date, checkInISO, source = "manual", location = "", actorUserId = "system", schoolId = SCHOOL_ID, tenantId, centerId }) {
  if (!STATUSES.has) { /* no-op — sanity import */ }
  if (source && !SOURCES.has(source)) {
    const err = new Error("Invalid source.");
    err.code  = "VALIDATION";
    throw err;
  }
  const staff = await _getStaff(staffId);
  if (!staff) {
    const err = new Error("Staff member not found.");
    err.code = "VALIDATION";
    throw err;
  }
  const d = date || _today();
  return _upsert({
    schoolId, tenantId, centerId,
    staff, date: d,
    patch: { checkIn: checkInISO || nowISO(), checkInBy: actorUserId, location },
    actorUserId, source,
  });
}

async function checkOut({ staffId, date, checkOutISO, source = "manual", actorUserId = "system", schoolId = SCHOOL_ID, tenantId, centerId }) {
  const staff = await _getStaff(staffId);
  if (!staff) {
    const err = new Error("Staff member not found.");
    err.code = "VALIDATION";
    throw err;
  }
  const d = date || _today();
  return _upsert({
    schoolId, tenantId, centerId,
    staff, date: d,
    patch: { checkOut: checkOutISO || nowISO(), checkOutBy: actorUserId },
    actorUserId, source,
  });
}

async function markStatus({ staffId, date, status, notes = "", actorUserId = "system", schoolId = SCHOOL_ID, tenantId, centerId }) {
  if (!STATUSES.has(status)) {
    const err = new Error("Invalid status.");
    err.code  = "VALIDATION";
    throw err;
  }
  const staff = await _getStaff(staffId);
  if (!staff) {
    const err = new Error("Staff member not found.");
    err.code  = "VALIDATION";
    throw err;
  }
  const d = date || _today();
  return _upsert({
    schoolId, tenantId, centerId,
    staff, date: d,
    patch: { status, notes },
    actorUserId, source: "manual",
  });
}

async function update(attendanceId, data, { actorUserId = "system" } = {}) {
  const ref  = col().doc(attendanceId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const existing = snap.data();
  const staff = await _getStaff(existing.staffId);
  const shift = await _shiftFor(staff, existing.schoolId);

  const merged = { ...existing, ...data };
  if (data.status && !STATUSES.has(data.status)) {
    const err = new Error("Invalid status.");
    err.code  = "VALIDATION";
    throw err;
  }
  const derived = _derive(merged, shift);
  derived.updatedAt = nowISO();
  derived.updatedBy = actorUserId;
  await ref.update(derived);
  return { id: attendanceId, ...derived };
}

async function remove(attendanceId, { actorUserId = "system" } = {}) {
  const ref  = col().doc(attendanceId);
  const snap = await ref.get();
  if (!snap.exists) return false;
  await ref.update({
    deletedAt: nowISO(), deletedBy: actorUserId,
    updatedAt: nowISO(), updatedBy: actorUserId,
  });
  return true;
}

// ── Reports ────────────────────────────────────────────────────────

async function dailyReport({ schoolId = SCHOOL_ID, centerId, date }) {
  const d    = date || _today();
  const rows = await getAll({ schoolId, centerId, date: d });
  const summary = { date: d, total: rows.length, present: 0, absent: 0, halfDay: 0, leave: 0, late: 0, overtime: 0 };
  rows.forEach(r => {
    if (r.status === "present")  summary.present++;
    if (r.status === "absent")   summary.absent++;
    if (r.status === "half_day") summary.halfDay++;
    if (r.status === "leave")    summary.leave++;
    if (r.isLate)                summary.late++;
    if (r.overtimeMinutes > 0)   summary.overtime++;
  });
  return { ...summary, rows };
}

async function monthlyReport({ schoolId = SCHOOL_ID, centerId, year, month }) {
  const monthStr = String(month).padStart(2, "0");
  const fromDate = `${year}-${monthStr}-01`;
  const toDate   = `${year}-${monthStr}-31`;
  const rows = await getAll({ schoolId, centerId, fromDate, toDate });

  // Per-staff aggregate
  const byStaff = new Map();
  rows.forEach(r => {
    const m = byStaff.get(r.staffId) || {
      staffId: r.staffId, employeeCode: r.employeeCode, displayName: r.displayName,
      designationName: r.designationName, departmentName: r.departmentName,
      present: 0, absent: 0, halfDay: 0, leave: 0,
      lateMinutes: 0, overtimeMinutes: 0, hoursWorked: 0,
    };
    if (r.status === "present")  m.present++;
    if (r.status === "absent")   m.absent++;
    if (r.status === "half_day") m.halfDay++;
    if (r.status === "leave")    m.leave++;
    m.lateMinutes     += r.lateBy || 0;
    m.overtimeMinutes += r.overtimeMinutes || 0;
    m.hoursWorked     += r.hoursWorked || 0;
    byStaff.set(r.staffId, m);
  });

  const staffRows = [...byStaff.values()].sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""));
  return {
    year: Number(year), month: Number(month),
    fromDate, toDate,
    totalRecords: rows.length,
    staffRows,
  };
}

module.exports = {
  STATUSES: [...STATUSES],
  SOURCES:  [...SOURCES],
  getAll,
  getForStaffMonth,
  todaySnapshot,
  dashboard,
  checkIn,
  checkOut,
  markStatus,
  update,
  remove,
  dailyReport,
  monthlyReport,
};
