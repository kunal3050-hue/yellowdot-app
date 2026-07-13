/**
 * Milestone 6 — student CRUD tenant isolation & identifier security.
 * Covers GET /students/:id, PUT /update-student/:id, DELETE /delete-student/:id.
 */
const test = require("node:test");
const assert = require("node:assert");
const { isStaffRole, checkStudentAccess } = require("../middleware/studentAccess");

const STU_A = { studentId: "YD001", schoolId: "school-A" };
const STU_B = { studentId: "YD002", schoolId: "school-A" }; // different child, same school
const STU_C = { studentId: "YD999", schoolId: "school-B" }; // different tenant entirely -- note the
                                                             // sequential-looking ID is irrelevant to
                                                             // the decision below, only schoolId is.

// ── Parent — own child ──────────────────────────────────────────────

test("Parent viewing their own child → allowed", () => {
  const req = { user: { role: "parent", schoolId: "school-A", student: { studentId: "YD001" } } };
  assert.deepEqual(checkStudentAccess(req, STU_A), { allowed: true });
});

// ── Parent — different child, same school ───────────────────────────

test("Parent viewing a different child, same school → forbidden (wrong_child)", () => {
  const req = { user: { role: "parent", schoolId: "school-A", student: { studentId: "YD001" } } };
  const v = checkStudentAccess(req, STU_B);
  assert.equal(v.allowed, false);
  assert.equal(v.reason, "wrong_child");
});

// ── Cross-tenant ─────────────────────────────────────────────────────

test("Parent cannot reach a cross-tenant student, even one with a highly guessable ID → not_found", () => {
  const req = { user: { role: "parent", schoolId: "school-A", student: { studentId: "YD001" } } };
  const v = checkStudentAccess(req, STU_C);
  assert.equal(v.allowed, false);
  assert.equal(v.reason, "not_found");
});

test("Staff (teacher) from school-A cannot reach a school-B student → not_found", () => {
  const req = { user: { role: "teacher", schoolId: "school-A" } };
  const v = checkStudentAccess(req, STU_C);
  assert.equal(v.allowed, false);
  assert.equal(v.reason, "not_found");
});

test("Staff (admin) from school-A cannot reach a school-B student → not_found", () => {
  const req = { user: { role: "admin", schoolId: "school-A" } };
  const v = checkStudentAccess(req, STU_C);
  assert.equal(v.allowed, false);
  assert.equal(v.reason, "not_found");
});

test("Staff (center_admin) from school-A cannot DELETE a school-B student → not_found", () => {
  const req = { user: { role: "center_admin", schoolId: "school-A" } };
  const v = checkStudentAccess(req, STU_C);
  assert.equal(v.allowed, false);
  assert.equal(v.reason, "not_found");
});

// ── Guessable/sequential ID does not help authorization ─────────────

test("A correctly-guessed sequential ID (YD001) still requires a matching schoolId", () => {
  // Attacker from school-B guesses the extremely common first ID "YD001",
  // which happens to exist in school-A. Guessing right buys nothing.
  const req = { user: { role: "teacher", schoolId: "school-B" } };
  const v = checkStudentAccess(req, STU_A);
  assert.equal(v.allowed, false);
  assert.equal(v.reason, "not_found");
});

// ── Teacher ──────────────────────────────────────────────────────────

test("Teacher, same school, any student → allowed", () => {
  const req = { user: { role: "teacher", schoolId: "school-A" } };
  assert.deepEqual(checkStudentAccess(req, STU_A), { allowed: true });
  assert.deepEqual(checkStudentAccess(req, STU_B), { allowed: true });
});

// ── Admin ────────────────────────────────────────────────────────────

test("Admin, same school, any student → allowed", () => {
  const req = { user: { role: "admin", schoolId: "school-A" } };
  assert.deepEqual(checkStudentAccess(req, STU_B), { allowed: true });
});

// ── Unauthenticated / unknown ────────────────────────────────────────

test("No req.user at all (unauthenticated) → forbidden", () => {
  const v = checkStudentAccess({}, STU_A);
  assert.equal(v.allowed, false);
  assert.equal(v.reason, "forbidden");
});

test("'unknown' role (authenticated but unregistered) → forbidden", () => {
  const req = { user: { role: "unknown", schoolId: "school-A" } };
  const v = checkStudentAccess(req, STU_A);
  assert.equal(v.allowed, false);
  assert.equal(v.reason, "forbidden");
});

// ── Student not found ───────────────────────────────────────────────

test("Student doesn't exist at all → not_found regardless of caller role", () => {
  const req = { user: { role: "admin", schoolId: "school-A" } };
  const v = checkStudentAccess(req, null);
  assert.equal(v.allowed, false);
  assert.equal(v.reason, "not_found");
});

// ── Role classification ─────────────────────────────────────────────

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
  const layer = app.router.stack.find(
    l => l.route && l.route.path === path && l.route.methods[method]
  );
  if (!layer) return null;
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

function mockRes() {
  return {
    _status: 200,
    status(c) { this._status = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

test("Route wiring: GET /students/:id blocks cross-tenant staff access, end-to-end", async () => {
  const studentSvc = require("../services/studentService");
  const origGetOne = studentSvc.getOne;
  studentSvc.getOne = async () => ({ studentId: "YD999", schoolId: "school-B" });

  const app = require("../server.js");
  const handler = findRouteHandler(app, "/students/:id", "get");
  assert.ok(handler, "route must still be registered");

  const req = { params: { id: "YD999" }, user: { role: "teacher", schoolId: "school-A" } };
  const res = mockRes();
  await handler(req, res);

  assert.equal(res._status, 404);

  studentSvc.getOne = origGetOne;
});

test("Route wiring: GET /students/:id allows same-school staff, end-to-end", async () => {
  const studentSvc = require("../services/studentService");
  const origGetOne = studentSvc.getOne;
  studentSvc.getOne = async () => ({ studentId: "YD001", schoolId: "school-A" });

  const app = require("../server.js");
  const handler = findRouteHandler(app, "/students/:id", "get");

  const req = { params: { id: "YD001" }, user: { role: "teacher", schoolId: "school-A" } };
  const res = mockRes();
  await handler(req, res);

  assert.equal(res._status, 200);
  assert.equal(res.body.studentId, "YD001");

  studentSvc.getOne = origGetOne;
});

test("Route wiring: PUT /update-student/:id blocks a cross-tenant write, end-to-end", async () => {
  const studentSvc = require("../services/studentService");
  const origGetOne = studentSvc.getOne;
  const origUpdate = studentSvc.update;
  studentSvc.getOne = async () => ({ studentId: "YD999", schoolId: "school-B" });
  let updateCalled = false;
  studentSvc.update = async () => { updateCalled = true; return { success: true }; };

  const app = require("../server.js");
  const handler = findRouteHandler(app, "/update-student/:id", "put");
  assert.ok(handler, "route must still be registered");

  const req = { params: { id: "YD999" }, body: { studentName: "Hijacked" }, user: { role: "center_admin", schoolId: "school-A" } };
  const res = mockRes();
  await handler(req, res);

  assert.equal(res._status, 404);
  assert.equal(updateCalled, false, "the underlying update must never be called for a cross-tenant target");

  studentSvc.getOne = origGetOne;
  studentSvc.update = origUpdate;
});

test("Route wiring: DELETE /delete-student/:id blocks a cross-tenant delete, end-to-end", async () => {
  const studentSvc = require("../services/studentService");
  const origGetOne = studentSvc.getOne;
  const origRemove = studentSvc.remove;
  studentSvc.getOne = async () => ({ studentId: "YD999", schoolId: "school-B" });
  let removeCalled = false;
  studentSvc.remove = async () => { removeCalled = true; return true; };

  const app = require("../server.js");
  const handler = findRouteHandler(app, "/delete-student/:id", "delete");
  assert.ok(handler, "route must still be registered");

  const req = { params: { id: "YD999" }, user: { role: "admin", schoolId: "school-A" } };
  const res = mockRes();
  await handler(req, res);

  assert.equal(res._status, 404);
  assert.equal(removeCalled, false, "the underlying delete must never be called for a cross-tenant target");

  studentSvc.getOne = origGetOne;
  studentSvc.remove = origRemove;
});
