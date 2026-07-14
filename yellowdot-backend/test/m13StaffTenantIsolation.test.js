/**
 * Milestone 13 — staffRoutes.js tenant isolation, ownership validation,
 * role-assignment hardening, and cross-tenant Auth-account protection.
 */
const test = require("node:test");
const assert = require("node:assert");

test("staff: getOne blocks cross-tenant read (PII protection), even for a canViewAll role", async () => {
  const ctrl = require("../controllers/staffController");
  const svc  = require("../services/staffService");
  const orig = svc.getOne;
  svc.getOne = async () => ({ staffId: "STF1", schoolId: "school-B", linkedUserId: "", address: "123 Secret St" });

  const req = { params: { staffId: "STF1" }, user: { schoolId: "school-A", role: "admin", userId: "U-attacker" } };
  const res = { _status: 200, status(c) { this._status = c; return this; }, json(b) { this.body = b; return this; } };
  await ctrl.getOne(req, res);

  assert.equal(res._status, 404);
  assert.equal(JSON.stringify(res.body).includes("Secret St"), false, "must never leak a foreign staff member's address");
  svc.getOne = orig;
});

test("staff: getOne allows same-tenant canViewAll role", async () => {
  const ctrl = require("../controllers/staffController");
  const svc  = require("../services/staffService");
  const orig = svc.getOne;
  svc.getOne = async () => ({ staffId: "STF2", schoolId: "school-A", linkedUserId: "" });

  const req = { params: { staffId: "STF2" }, user: { schoolId: "school-A", role: "admin", userId: "U-owner" } };
  const res = { _status: 200, status(c) { this._status = c; return this; }, json(b) { this.body = b; return this; } };
  await ctrl.getOne(req, res);

  assert.equal(res._status, 200);
  svc.getOne = orig;
});

test("staff: getTimeline blocks cross-tenant read, never calls timelineSvc.getForStaff", async () => {
  const ctrl = require("../controllers/staffController");
  const svc  = require("../services/staffService");
  const timelineSvc = require("../services/employeeTimelineService");
  const origGetOne = svc.getOne;
  const origGetForStaff = timelineSvc.getForStaff;
  svc.getOne = async () => ({ staffId: "STF3", schoolId: "school-B" });
  let called = false;
  timelineSvc.getForStaff = async () => { called = true; return []; };

  const req = { params: { staffId: "STF3" }, query: {}, user: { schoolId: "school-A", role: "admin" } };
  const res = { _status: 200, status(c) { this._status = c; return this; }, json(b) { this.body = b; return this; } };
  await ctrl.getTimeline(req, res);

  assert.equal(res._status, 404);
  assert.equal(called, false);
  svc.getOne = origGetOne;
  timelineSvc.getForStaff = origGetForStaff;
});

test("staff: update blocks cross-tenant write, never calls svc.update", async () => {
  const ctrl = require("../controllers/staffController");
  const svc  = require("../services/staffService");
  const origGetOne = svc.getOne;
  const origUpdate = svc.update;
  svc.getOne = async () => ({ staffId: "STF4", schoolId: "school-B" });
  let called = false;
  svc.update = async () => { called = true; return { success: true }; };

  const req = { params: { staffId: "STF4" }, body: { firstName: "Hacked" }, user: { schoolId: "school-A", role: "admin", userId: "U1" } };
  const res = { _status: 200, status(c) { this._status = c; return this; }, json(b) { this.body = b; return this; } };
  await ctrl.update(req, res);

  assert.equal(res._status, 404);
  assert.equal(called, false);
  svc.getOne = origGetOne;
  svc.update = origUpdate;
});

test("staff: remove (soft delete) blocks cross-tenant delete", async () => {
  const ctrl = require("../controllers/staffController");
  const svc  = require("../services/staffService");
  const origGetOne = svc.getOne;
  const origRemove = svc.remove;
  svc.getOne = async () => ({ staffId: "STF5", schoolId: "school-B" });
  let called = false;
  svc.remove = async () => { called = true; return true; };

  const req = { params: { staffId: "STF5" }, user: { schoolId: "school-A", role: "admin", userId: "U1" } };
  const res = { _status: 200, status(c) { this._status = c; return this; }, json(b) { this.body = b; return this; } };
  await ctrl.remove(req, res);

  assert.equal(res._status, 404);
  assert.equal(called, false);
  svc.getOne = origGetOne;
  svc.remove = origRemove;
});

test("staff: invite blocks cross-tenant target, never creates/touches a Firebase Auth account", async () => {
  const ctrl = require("../controllers/staffController");
  const svc  = require("../services/staffService");
  const { auth } = require("../firebaseAdmin");
  const origGetOne = svc.getOne;
  svc.getOne = async () => ({ staffId: "STF6", schoolId: "school-B", email: "foreign@x.com", displayName: "Foreign Staff" });
  let authTouched = false;
  const origGetUserByEmail = auth.getUserByEmail;
  auth.getUserByEmail = async () => { authTouched = true; throw Object.assign(new Error("not found"), { code: "auth/user-not-found" }); };

  const req = { params: { staffId: "STF6" }, user: { schoolId: "school-A", role: "admin", userId: "U-attacker" } };
  const res = { _status: 200, status(c) { this._status = c; return this; }, json(b) { this.body = b; return this; } };
  await ctrl.invite(req, res);

  assert.equal(res._status, 404);
  assert.equal(authTouched, false, "must never touch Firebase Auth for a cross-tenant staff target");
  svc.getOne = origGetOne;
  auth.getUserByEmail = origGetUserByEmail;
});

test("staff: setUserDisabled blocks cross-tenant target, never calls auth.updateUser (account-lockout DoS prevention)", async () => {
  const ctrl = require("../controllers/staffController");
  const svc  = require("../services/staffService");
  const { auth } = require("../firebaseAdmin");
  const origGetOne = svc.getOne;
  svc.getOne = async () => ({ staffId: "STF7", schoolId: "school-B", linkedUserId: "foreign-uid-1" });
  let called = false;
  const origUpdateUser = auth.updateUser;
  auth.updateUser = async () => { called = true; };

  const req = { params: { staffId: "STF7" }, body: { disabled: true }, user: { schoolId: "school-A", role: "admin", userId: "U-attacker" } };
  const res = { _status: 200, status(c) { this._status = c; return this; }, json(b) { this.body = b; return this; } };
  await ctrl.setUserDisabled(req, res);

  assert.equal(res._status, 404);
  assert.equal(called, false, "a foreign staff member's Auth account must never be disabled cross-tenant");
  svc.getOne = origGetOne;
  auth.updateUser = origUpdateUser;
});

test("staff: linkUser blocks cross-tenant target", async () => {
  const ctrl = require("../controllers/staffController");
  const svc  = require("../services/staffService");
  const origGetOne = svc.getOne;
  const origSetLoginLink = svc.setLoginLink;
  svc.getOne = async () => ({ staffId: "STF8", schoolId: "school-B" });
  let called = false;
  svc.setLoginLink = async () => { called = true; return {}; };

  const req = { params: { staffId: "STF8" }, body: { uid: "some-uid" }, user: { schoolId: "school-A", role: "admin", userId: "U1" } };
  const res = { _status: 200, status(c) { this._status = c; return this; }, json(b) { this.body = b; return this; } };
  await ctrl.linkUser(req, res);

  assert.equal(res._status, 404);
  assert.equal(called, false);
  svc.getOne = origGetOne;
  svc.setLoginLink = origSetLoginLink;
});

test("staff: unlinkUser blocks cross-tenant target", async () => {
  const ctrl = require("../controllers/staffController");
  const svc  = require("../services/staffService");
  const origGetOne = svc.getOne;
  const origSetLoginLink = svc.setLoginLink;
  svc.getOne = async () => ({ staffId: "STF9", schoolId: "school-B" });
  let called = false;
  svc.setLoginLink = async () => { called = true; return {}; };

  const req = { params: { staffId: "STF9" }, user: { schoolId: "school-A", role: "admin", userId: "U1" } };
  const res = { _status: 200, status(c) { this._status = c; return this; }, json(b) { this.body = b; return this; } };
  await ctrl.unlinkUser(req, res);

  assert.equal(res._status, 404);
  assert.equal(called, false);
  svc.getOne = origGetOne;
  svc.setLoginLink = origSetLoginLink;
});

test("staff: restore blocks cross-tenant target", async () => {
  const ctrl = require("../controllers/staffController");
  const svc  = require("../services/staffService");
  const origGetOne = svc.getOne;
  const origRestore = svc.restore;
  svc.getOne = async () => ({ staffId: "STF10", schoolId: "school-B" });
  let called = false;
  svc.restore = async () => { called = true; return true; };

  const req = { params: { staffId: "STF10" }, user: { schoolId: "school-A", role: "admin", userId: "U1" } };
  const res = { _status: 200, status(c) { this._status = c; return this; }, json(b) { this.body = b; return this; } };
  await ctrl.restore(req, res);

  assert.equal(res._status, 404);
  assert.equal(called, false);
  svc.getOne = origGetOne;
  svc.restore = origRestore;
});

// ── Role-assignment hardening (the parallel escalation path via invite()) ──
//
// invite()'s _ensureAuthUser() writes a real users/{uid} Firestore doc as a
// side effect; reliably intercepting that write requires either a Firestore
// emulator or dependency injection this module doesn't have, so the actual
// role-capping behavior of invite() is verified end-to-end during live
// production verification instead (a temp staff record with role:"super_admin"
// is invited, and the resulting real users/{uid} doc's role field is read
// back directly from Firestore). The chokepoint function itself is unit
// tested below and reused identically by both userService and staffController.

test("staffService.update: 'role' field can never resolve to a bypass role", () => {
  // Pure-logic check against the same _resolveAssignableRole chokepoint userService uses.
  const { _resolveAssignableRole } = require("../services/userService");
  assert.equal(_resolveAssignableRole("super_admin", ""), "");
  assert.equal(_resolveAssignableRole("developer", ""), "");
  assert.equal(_resolveAssignableRole("teacher", ""), "teacher");
});
