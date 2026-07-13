/**
 * Milestone 5 — student medical records & private notes access control.
 * Covers: parent own child, parent different child, cross-tenant,
 * teacher, admin, unauthenticated.
 */
const test = require("node:test");
const assert = require("node:assert");
const { isStaffRole, checkMedicalAccess, checkNotesAccess } = require("../middleware/studentRecordAccess");

const STU_A = { studentId: "YD001", schoolId: "school-A" };
const STU_B = { studentId: "YD002", schoolId: "school-A" }; // different child, same school
const STU_C = { studentId: "YD003", schoolId: "school-B" }; // different tenant entirely

// ── Parent — own child ──────────────────────────────────────────────

test("Medical: parent viewing their own child → allowed", () => {
  const req = { user: { role: "parent", schoolId: "school-A", student: { studentId: "YD001" } } };
  assert.equal(checkMedicalAccess(req, STU_A), null);
});

// ── Parent — different child ────────────────────────────────────────

test("Medical: parent viewing a different child, same school → 403", () => {
  const req = { user: { role: "parent", schoolId: "school-A", student: { studentId: "YD001" } } };
  const denied = checkMedicalAccess(req, STU_B);
  assert.equal(denied.status, 403);
});

test("Notes: parents have NO access at all, even to their own child (private staff notes)", () => {
  const req = { user: { role: "parent", schoolId: "school-A", student: { studentId: "YD001" } } };
  const denied = checkNotesAccess(req, STU_A);
  assert.equal(denied.status, 403);
});

// ── Cross-tenant ─────────────────────────────────────────────────────

test("Medical: parent from school-A cannot reach a school-B student → 404 (no cross-tenant leak)", () => {
  const req = { user: { role: "parent", schoolId: "school-A", student: { studentId: "YD003" } } };
  const denied = checkMedicalAccess(req, STU_C);
  assert.equal(denied.status, 404);
});

test("Medical: staff from school-A cannot reach a school-B student → 404", () => {
  const req = { user: { role: "teacher", schoolId: "school-A" } };
  const denied = checkMedicalAccess(req, STU_C);
  assert.equal(denied.status, 404);
});

test("Notes: staff from school-A cannot reach a school-B student → 404", () => {
  const req = { user: { role: "center_admin", schoolId: "school-A" } };
  const denied = checkNotesAccess(req, STU_C);
  assert.equal(denied.status, 404);
});

// ── Teacher ──────────────────────────────────────────────────────────

test("Medical: teacher, same school, any student → allowed", () => {
  const req = { user: { role: "teacher", schoolId: "school-A" } };
  assert.equal(checkMedicalAccess(req, STU_A), null);
  assert.equal(checkMedicalAccess(req, STU_B), null);
});

test("Notes: teacher, same school, any student → allowed", () => {
  const req = { user: { role: "teacher", schoolId: "school-A" } };
  assert.equal(checkNotesAccess(req, STU_A), null);
});

// ── Admin ────────────────────────────────────────────────────────────

test("Medical: admin, same school, any student → allowed", () => {
  const req = { user: { role: "admin", schoolId: "school-A" } };
  assert.equal(checkMedicalAccess(req, STU_B), null);
});

test("Notes: admin, same school, any student → allowed", () => {
  const req = { user: { role: "admin", schoolId: "school-A" } };
  assert.equal(checkNotesAccess(req, STU_B), null);
});

// ── Unauthenticated / unknown ────────────────────────────────────────

test("Medical: no req.user at all (unauthenticated) → 403, not silently allowed", () => {
  const req = {};
  const denied = checkMedicalAccess(req, STU_A);
  assert.equal(denied.status, 403);
});

test("Notes: no req.user at all (unauthenticated) → 403", () => {
  const req = {};
  const denied = checkNotesAccess(req, STU_A);
  assert.equal(denied.status, 403);
});

test("Medical: 'unknown' role (authenticated but unregistered) → 403", () => {
  const req = { user: { role: "unknown", schoolId: "school-A" } };
  const denied = checkMedicalAccess(req, STU_A);
  assert.equal(denied.status, 403);
});

// ── Student not found ───────────────────────────────────────────────

test("Medical: student doesn't exist at all → 404, regardless of caller role", () => {
  const req = { user: { role: "admin", schoolId: "school-A" } };
  const denied = checkMedicalAccess(req, null);
  assert.equal(denied.status, 404);
});

// ── Role classification sanity ──────────────────────────────────────

test("isStaffRole classifies roles correctly", () => {
  for (const r of ["developer", "super_admin", "admin", "center_admin", "teacher", "accountant", "reception"]) {
    assert.equal(isStaffRole(r), true, `${r} should be staff`);
  }
  for (const r of ["parent", "unknown", "cctv_viewer", undefined]) {
    assert.equal(isStaffRole(r), false, `${r} should not be staff`);
  }
});

// ── Route-wiring proof: the real Express handlers enforce this end-to-end ──

function findRouteHandler(app, path, method) {
  // Express 5 exposes the route stack as app.router.stack (app._router no longer exists).
  const layer = app.router.stack.find(
    l => l.route && l.route.path === path && l.route.methods[method]
  );
  if (!layer) return null;
  return layer.route.stack[layer.route.stack.length - 1].handle; // last = real business logic
}

function mockRes() {
  return {
    _status: 200,
    status(c) { this._status = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

test("Route wiring: GET /api/student-medical/:studentId blocks a parent from a different child, end-to-end", async () => {
  const studentSvc = require("../services/studentService");
  const studentMedicalSvc = require("../services/studentMedicalService");
  const origGetOne = studentSvc.getOne;
  const origGet = studentMedicalSvc.get;
  studentSvc.getOne = async () => ({ studentId: "YD002", schoolId: "school-A" });
  studentMedicalSvc.get = async () => ({ bloodGroup: "O+", allergies: "peanuts" });

  const app = require("../server.js");
  const handler = findRouteHandler(app, "/api/student-medical/:studentId", "get");
  assert.ok(handler, "route must still be registered");

  const req = { params: { studentId: "YD002" }, user: { role: "parent", schoolId: "school-A", student: { studentId: "YD001" } } };
  const res = mockRes();
  await handler(req, res);

  assert.equal(res._status, 403);
  assert.equal(res.body.success, false);

  studentSvc.getOne = origGetOne;
  studentMedicalSvc.get = origGet;
});

test("Route wiring: GET /api/student-medical/:studentId allows a teacher, same school", async () => {
  const studentSvc = require("../services/studentService");
  const studentMedicalSvc = require("../services/studentMedicalService");
  const origGetOne = studentSvc.getOne;
  const origGet = studentMedicalSvc.get;
  studentSvc.getOne = async () => ({ studentId: "YD002", schoolId: "school-A" });
  studentMedicalSvc.get = async () => ({ bloodGroup: "O+", allergies: "peanuts" });

  const app = require("../server.js");
  const handler = findRouteHandler(app, "/api/student-medical/:studentId", "get");

  const req = { params: { studentId: "YD002" }, user: { role: "teacher", schoolId: "school-A" } };
  const res = mockRes();
  await handler(req, res);

  assert.equal(res._status, 200);
  assert.equal(res.body.success, true);
  assert.deepEqual(res.body.entry, { bloodGroup: "O+", allergies: "peanuts" });

  studentSvc.getOne = origGetOne;
  studentMedicalSvc.get = origGet;
});

test("Route wiring: GET /api/student-notes/:studentId blocks a parent entirely, end-to-end", async () => {
  const studentSvc = require("../services/studentService");
  const origGetOne = studentSvc.getOne;
  studentSvc.getOne = async () => ({ studentId: "YD001", schoolId: "school-A" });

  const app = require("../server.js");
  const handler = findRouteHandler(app, "/api/student-notes/:studentId", "get");
  assert.ok(handler, "route must still be registered");

  const req = { params: { studentId: "YD001" }, user: { role: "parent", schoolId: "school-A", student: { studentId: "YD001" } } };
  const res = mockRes();
  await handler(req, res);

  assert.equal(res._status, 403);

  studentSvc.getOne = origGetOne;
});
