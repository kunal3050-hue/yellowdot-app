/**
 * Milestone 15 — Attendance Platform Hardening: attendanceRoutes.js,
 * staffAttendanceRoutes.js, qrRoutes.js. Same checkTenantAccess pattern
 * reused throughout; qrRoutes.js needed a bespoke check since qrConfigs
 * docs carry no schoolId of their own.
 */
const test = require("node:test");
const assert = require("node:assert");

function mockRes() {
  return { _status: 200, status(c) { this._status = c; return this; }, json(b) { this.body = b; return this; } };
}

// ── attendanceController: checkOut + generateStudentQR ──────────────────

test("attendance: checkOut blocks cross-tenant entry, never calls svc.checkOut", async () => {
  const ctrl = require("../controllers/attendanceController");
  const svc  = require("../services/attendanceService");
  const orig = { getEntry: svc.getEntry, checkOut: svc.checkOut };
  svc.getEntry = async () => ({ entryId: "ATT-1", schoolId: "school-B", studentId: "YD1" });
  let called = false;
  svc.checkOut = async () => { called = true; return { entryId: "ATT-1" }; };

  const req = { params: { id: "ATT-1" }, user: { schoolId: "school-A" } };
  const res = mockRes();
  await ctrl.checkOut(req, res);

  assert.equal(res._status, 404);
  assert.equal(called, false);
  Object.assign(svc, orig);
});

test("attendance: checkOut allows a same-school entry", async () => {
  const ctrl = require("../controllers/attendanceController");
  const svc  = require("../services/attendanceService");
  const orig = { getEntry: svc.getEntry, checkOut: svc.checkOut };
  svc.getEntry = async () => ({ entryId: "ATT-2", schoolId: "school-A", studentId: "YD1" });
  svc.checkOut = async () => ({ entryId: "ATT-2", studentId: "YD1", checkOut: "10:00" });

  const req = { params: { id: "ATT-2" }, user: { schoolId: "school-A" } };
  const res = mockRes();
  await ctrl.checkOut(req, res);

  assert.equal(res._status, 200);
  Object.assign(svc, orig);
});

test("attendance: generateStudentQR blocks a cross-tenant student, never returns a QR payload", async () => {
  const ctrl = require("../controllers/attendanceController");
  const studentSvc = require("../services/studentService");
  const orig = studentSvc.getOne;
  studentSvc.getOne = async () => ({ studentId: "YD-FOREIGN", schoolId: "school-B" });

  const req = { params: { studentId: "YD-FOREIGN" }, user: { schoolId: "school-A" } };
  const res = mockRes();
  await ctrl.generateStudentQR(req, res);

  assert.equal(res._status, 404);
  assert.equal(res.body.qrDataUrl, undefined, "must never return a QR code for a cross-tenant student");
  studentSvc.getOne = orig;
});

// ── staffAttendanceController: staffMonth, updateRecord, removeRecord, shifts ──

test("staffAttendance: staffMonth blocks a cross-tenant staffId", async () => {
  const ctrl = require("../controllers/staffAttendanceController");
  const staffSvc = require("../services/staffService");
  const svc = require("../services/staffAttendanceService");
  const origGetOne = staffSvc.getOne;
  const origGetForStaffMonth = svc.getForStaffMonth;
  staffSvc.getOne = async () => ({ staffId: "STF1", schoolId: "school-B" });
  let called = false;
  svc.getForStaffMonth = async () => { called = true; return []; };

  const req = { params: { staffId: "STF1" }, query: {}, user: { schoolId: "school-A" } };
  const res = mockRes();
  await ctrl.staffMonth(req, res);

  assert.equal(res._status, 404);
  assert.equal(called, false);
  staffSvc.getOne = origGetOne;
  svc.getForStaffMonth = origGetForStaffMonth;
});

test("staffAttendance: updateRecord blocks cross-tenant write", async () => {
  const ctrl = require("../controllers/staffAttendanceController");
  const svc = require("../services/staffAttendanceService");
  const orig = { getOne: svc.getOne, update: svc.update };
  svc.getOne = async () => ({ attendanceId: "SA1", schoolId: "school-B" });
  let called = false;
  svc.update = async () => { called = true; return {}; };

  const req = { params: { attendanceId: "SA1" }, body: { status: "present" }, user: { schoolId: "school-A" } };
  const res = mockRes();
  await ctrl.updateRecord(req, res);

  assert.equal(res._status, 404);
  assert.equal(called, false);
  Object.assign(svc, orig);
});

test("staffAttendance: removeRecord blocks cross-tenant delete", async () => {
  const ctrl = require("../controllers/staffAttendanceController");
  const svc = require("../services/staffAttendanceService");
  const orig = { getOne: svc.getOne, remove: svc.remove };
  svc.getOne = async () => ({ attendanceId: "SA2", schoolId: "school-B" });
  let called = false;
  svc.remove = async () => { called = true; return true; };

  const req = { params: { attendanceId: "SA2" }, user: { schoolId: "school-A" } };
  const res = mockRes();
  await ctrl.removeRecord(req, res);

  assert.equal(res._status, 404);
  assert.equal(called, false);
  Object.assign(svc, orig);
});

test("staffAttendance: updateShift blocks cross-tenant write", async () => {
  const ctrl = require("../controllers/staffAttendanceController");
  const shiftSvc = require("../services/staffShiftService");
  const orig = { getOne: shiftSvc.getOne, update: shiftSvc.update };
  shiftSvc.getOne = async () => ({ shiftId: "SH1", schoolId: "school-B" });
  let called = false;
  shiftSvc.update = async () => { called = true; return {}; };

  const req = { params: { shiftId: "SH1" }, body: { name: "Hacked" }, user: { schoolId: "school-A" } };
  const res = mockRes();
  await ctrl.updateShift(req, res);

  assert.equal(res._status, 404);
  assert.equal(called, false);
  Object.assign(shiftSvc, orig);
});

test("staffAttendance: removeShift blocks cross-tenant delete", async () => {
  const ctrl = require("../controllers/staffAttendanceController");
  const shiftSvc = require("../services/staffShiftService");
  const orig = { getOne: shiftSvc.getOne, remove: shiftSvc.remove };
  shiftSvc.getOne = async () => ({ shiftId: "SH2", schoolId: "school-B" });
  let called = false;
  shiftSvc.remove = async () => { called = true; return true; };

  const req = { params: { shiftId: "SH2" }, user: { schoolId: "school-A" } };
  const res = mockRes();
  await ctrl.removeShift(req, res);

  assert.equal(res._status, 404);
  assert.equal(called, false);
  Object.assign(shiftSvc, orig);
});

test("staffAttendance: updateRecord allows a same-school write", async () => {
  const ctrl = require("../controllers/staffAttendanceController");
  const svc = require("../services/staffAttendanceService");
  const orig = { getOne: svc.getOne, update: svc.update };
  svc.getOne = async () => ({ attendanceId: "SA3", schoolId: "school-A" });
  svc.update = async () => ({ attendanceId: "SA3", status: "present" });

  const req = { params: { attendanceId: "SA3" }, body: { status: "present" }, user: { schoolId: "school-A" } };
  const res = mockRes();
  await ctrl.updateRecord(req, res);

  assert.equal(res._status, 200);
  Object.assign(svc, orig);
});

// ── qrRoutes: center QR tenant isolation ─────────────────────────────────

function findRouteHandler(router, path, method) {
  const layer = router.stack.find(l => l.route && l.route.path === path && l.route.methods[method]);
  if (!layer) return null;
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

test("qr: GET /api/qr/center/:centerId blocks a foreign center, never calls getCenterQR", async () => {
  const qrRoutes = require("../routes/qrRoutes");
  const qrSvc = require("../services/qrService");
  const origBelongs = qrSvc.centerBelongsToSchool;
  const origGetCenterQR = qrSvc.getCenterQR;
  qrSvc.centerBelongsToSchool = async () => false;
  let called = false;
  qrSvc.getCenterQR = async () => { called = true; return { qrDataUrl: "data:leak" }; };

  const handler = findRouteHandler(qrRoutes, "/api/qr/center/:centerId", "get");
  const req = { params: { centerId: "foreign-center" }, user: { schoolId: "school-A" } };
  const res = mockRes();
  await handler(req, res);

  assert.equal(res._status, 404);
  assert.equal(called, false, "getCenterQR must never be called for a center outside the caller's school");
  qrSvc.centerBelongsToSchool = origBelongs;
  qrSvc.getCenterQR = origGetCenterQR;
});

test("qr: POST /api/qr/center/:centerId/generate blocks a foreign center, never calls generateCenterQR", async () => {
  const qrRoutes = require("../routes/qrRoutes");
  const qrSvc = require("../services/qrService");
  const origBelongs = qrSvc.centerBelongsToSchool;
  const origGenerate = qrSvc.generateCenterQR;
  qrSvc.centerBelongsToSchool = async () => false;
  let called = false;
  qrSvc.generateCenterQR = async () => { called = true; return {}; };

  const handler = findRouteHandler(qrRoutes, "/api/qr/center/:centerId/generate", "post");
  const req = { params: { centerId: "foreign-center" }, body: {}, user: { schoolId: "school-A", userId: "U1", role: "admin" } };
  const res = mockRes();
  await handler(req, res);

  assert.equal(res._status, 404);
  assert.equal(called, false, "generateCenterQR must never overwrite another school's center QR");
  qrSvc.centerBelongsToSchool = origBelongs;
  qrSvc.generateCenterQR = origGenerate;
});

test("qr: GET /api/qr/center/:centerId allows the caller's own center", async () => {
  const qrRoutes = require("../routes/qrRoutes");
  const qrSvc = require("../services/qrService");
  const origBelongs = qrSvc.centerBelongsToSchool;
  const origGetCenterQR = qrSvc.getCenterQR;
  qrSvc.centerBelongsToSchool = async () => true;
  qrSvc.getCenterQR = async () => ({ centerId: "own-center", qrDataUrl: "data:ok" });

  const handler = findRouteHandler(qrRoutes, "/api/qr/center/:centerId", "get");
  const req = { params: { centerId: "own-center" }, user: { schoolId: "school-A" } };
  const res = mockRes();
  await handler(req, res);

  assert.equal(res._status, 200);
  assert.equal(res.body.hasQR, true);
  qrSvc.centerBelongsToSchool = origBelongs;
  qrSvc.getCenterQR = origGetCenterQR;
});
