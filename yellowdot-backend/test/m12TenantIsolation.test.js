/**
 * Milestone 12 — Shared ownership-check helper across HR/finance/admin routes (H1).
 * Covers by-ID cross-tenant IDOR fixes across payrollController, leaveController,
 * performanceController, familyRoutes, departmentController, designationController,
 * roleRoutes, and userRoutes — plus the two escalations discovered during the
 * audit: userService role-assignment (bypass roles) and roleRoutes system-role
 * cross-tenant mutation lockdown.
 */
const test = require("node:test");
const assert = require("node:assert");

function mockRes() {
  return { _status: 200, status(c) { this._status = c; return this; }, json(b) { this.body = b; return this; }, end() { return this; }, setHeader() {}, pipe() {} };
}
function findRouteHandler(router, path, method) {
  const layer = router.stack.find(l => l.route && l.route.path === path && l.route.methods[method]);
  if (!layer) return null;
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

// familyRoutes.js wires a separate requireFamilyTenant middleware ahead of each
// handler (not inlined), so testing only the last stack entry would skip the
// tenant check entirely. Walk the whole chain instead, skipping `authenticate`
// (index 0) since req.user is pre-set in these tests.
function findRouteLayer(router, path, method) {
  return router.stack.find(l => l.route && l.route.path === path && l.route.methods[method]);
}
async function runProtectedChain(layer, req) {
  const res = mockRes();
  const handles = layer.route.stack.map(l => l.handle).slice(1);
  let i = 0;
  async function dispatch() {
    if (i >= handles.length) return;
    const handle = handles[i++];
    let calledNext = false;
    const maybePromise = handle(req, res, () => { calledNext = true; });
    if (maybePromise && typeof maybePromise.then === "function") await maybePromise;
    if (calledNext) await dispatch();
  }
  await dispatch();
  return res;
}

// ── payrollController ────────────────────────────────────────────────

test("payroll: updateComponent blocks cross-tenant write, never calls svc.updateComponent", async () => {
  const ctrl = require("../controllers/payrollController");
  const svc  = require("../services/payrollService");
  const orig = { getComponent: svc.getComponent, updateComponent: svc.updateComponent };
  svc.getComponent = async () => ({ componentId: "C1", schoolId: "school-B" });
  let called = false;
  svc.updateComponent = async () => { called = true; return { componentId: "C1" }; };

  const req = { params: { id: "C1" }, body: { name: "Hacked" }, user: { schoolId: "school-A" } };
  const res = mockRes();
  await ctrl.updateComponent(req, res);

  assert.equal(res._status, 404);
  assert.equal(called, false);
  Object.assign(svc, orig);
});

test("payroll: getPayslip blocks cross-tenant read of bank/net-pay data", async () => {
  const ctrl = require("../controllers/payrollController");
  const svc  = require("../services/payrollService");
  const orig = svc.getPayslip;
  svc.getPayslip = async () => ({ payslipId: "P1", schoolId: "school-B", net: 50000, bankAccountLast4: "1234" });

  const req = { params: { id: "P1" }, user: { schoolId: "school-A" } };
  const res = mockRes();
  await ctrl.getPayslip(req, res);

  assert.equal(res._status, 404);
  assert.equal(JSON.stringify(res.body).includes("1234"), false, "must never leak a foreign payslip's bank digits");
  svc.getPayslip = orig;
});

test("payroll: getStaffSalary returns null (not the record) for a cross-tenant staffId", async () => {
  const ctrl = require("../controllers/payrollController");
  const svc  = require("../services/payrollService");
  const orig = svc.getStaffSalary;
  svc.getStaffSalary = async () => ({ staffId: "S1", schoolId: "school-B", bankAccountLast4: "9999" });

  const req = { params: { staffId: "S1" }, user: { schoolId: "school-A" } };
  const res = mockRes();
  await ctrl.getStaffSalary(req, res);

  assert.equal(res._status, 200); // this endpoint responds 200 with null on "not found", by design
  assert.equal(res.body.staffSalary, null);
  svc.getStaffSalary = orig;
});

test("payroll: lockRun blocks cross-tenant run mutation", async () => {
  const ctrl = require("../controllers/payrollController");
  const svc  = require("../services/payrollService");
  const orig = { getRun: svc.getRun, lockRun: svc.lockRun };
  svc.getRun = async () => ({ runId: "R1", schoolId: "school-B" });
  let called = false;
  svc.lockRun = async () => { called = true; return { runId: "R1" }; };

  const req = { params: { id: "R1" }, user: { schoolId: "school-A" } };
  const res = mockRes();
  await ctrl.lockRun(req, res);

  assert.equal(res._status, 404);
  assert.equal(called, false);
  Object.assign(svc, orig);
});

test("payroll: updateComponent allows a same-school write", async () => {
  const ctrl = require("../controllers/payrollController");
  const svc  = require("../services/payrollService");
  const orig = { getComponent: svc.getComponent, updateComponent: svc.updateComponent };
  svc.getComponent = async () => ({ componentId: "C2", schoolId: "school-A" });
  svc.updateComponent = async () => ({ componentId: "C2", name: "Renamed" });

  const req = { params: { id: "C2" }, body: { name: "Renamed" }, user: { schoolId: "school-A" } };
  const res = mockRes();
  await ctrl.updateComponent(req, res);

  assert.equal(res._status, 200);
  assert.equal(res.body.component.name, "Renamed");
  Object.assign(svc, orig);
});

// ── leaveController ──────────────────────────────────────────────────

test("leave: approveRequest blocks cross-tenant approval, never calls svc.decideRequest", async () => {
  const ctrl = require("../controllers/leaveController");
  const svc  = require("../services/leaveService");
  const orig = { getRequest: svc.getRequest, decideRequest: svc.decideRequest };
  svc.getRequest = async () => ({ requestId: "LR1", schoolId: "school-B" });
  let called = false;
  svc.decideRequest = async () => { called = true; return { requestId: "LR1" }; };

  const req = { params: { id: "LR1" }, body: {}, user: { schoolId: "school-A" } };
  const res = mockRes();
  await ctrl.approveRequest(req, res);

  assert.equal(res._status, 404);
  assert.equal(called, false);
  Object.assign(svc, orig);
});

test("leave: removeRequest blocks cross-tenant delete", async () => {
  const ctrl = require("../controllers/leaveController");
  const svc  = require("../services/leaveService");
  const orig = { getRequest: svc.getRequest, removeRequest: svc.removeRequest };
  svc.getRequest = async () => ({ requestId: "LR2", schoolId: "school-B" });
  let called = false;
  svc.removeRequest = async () => { called = true; return true; };

  const req = { params: { id: "LR2" }, user: { schoolId: "school-A" } };
  const res = mockRes();
  await ctrl.removeRequest(req, res);

  assert.equal(res._status, 404);
  assert.equal(called, false);
  Object.assign(svc, orig);
});

test("leave: getRequest allows a same-school read", async () => {
  const ctrl = require("../controllers/leaveController");
  const svc  = require("../services/leaveService");
  const orig = svc.getRequest;
  svc.getRequest = async () => ({ requestId: "LR3", schoolId: "school-A", staffId: "S1" });

  const req = { params: { id: "LR3" }, user: { schoolId: "school-A" } };
  const res = mockRes();
  await ctrl.getRequest(req, res);

  assert.equal(res._status, 200);
  assert.equal(res.body.request.requestId, "LR3");
  svc.getRequest = orig;
});

// ── performanceController ───────────────────────────────────────────

test("performance: removeReview blocks cross-tenant delete", async () => {
  const ctrl = require("../controllers/performanceController");
  const svc  = require("../services/performanceService");
  const orig = { getReview: svc.getReview, removeReview: svc.removeReview };
  svc.getReview = async () => ({ reviewId: "REV1", schoolId: "school-B" });
  let called = false;
  svc.removeReview = async () => { called = true; return true; };

  const req = { params: { id: "REV1" }, user: { schoolId: "school-A" } };
  const res = mockRes();
  await ctrl.removeReview(req, res);

  assert.equal(res._status, 404);
  assert.equal(called, false);
  Object.assign(svc, orig);
});

test("performance: upsertReview blocks overwriting a cross-tenant reviewId", async () => {
  const ctrl = require("../controllers/performanceController");
  const svc  = require("../services/performanceService");
  const orig = { getReview: svc.getReview, upsertReview: svc.upsertReview };
  svc.getReview = async () => ({ reviewId: "REV2", schoolId: "school-B" });
  let called = false;
  svc.upsertReview = async () => { called = true; return {}; };

  const req = { body: { reviewId: "REV2", staffId: "S1", period: "2026-07" }, user: { schoolId: "school-A" } };
  const res = mockRes();
  await ctrl.upsertReview(req, res);

  assert.equal(res._status, 404);
  assert.equal(called, false, "svc.upsertReview must never be called to overwrite a foreign school's review");
  Object.assign(svc, orig);
});

test("performance: removeKpi blocks cross-tenant delete", async () => {
  const ctrl = require("../controllers/performanceController");
  const svc  = require("../services/performanceService");
  const orig = { getKpi: svc.getKpi, removeKpi: svc.removeKpi };
  svc.getKpi = async () => ({ kpiId: "K1", schoolId: "school-B" });
  let called = false;
  svc.removeKpi = async () => { called = true; return true; };

  const req = { params: { id: "K1" }, user: { schoolId: "school-A" } };
  const res = mockRes();
  await ctrl.removeKpi(req, res);

  assert.equal(res._status, 404);
  assert.equal(called, false);
  Object.assign(svc, orig);
});

test("performance: getReview allows a same-school read", async () => {
  const ctrl = require("../controllers/performanceController");
  const svc  = require("../services/performanceService");
  const orig = svc.getReview;
  svc.getReview = async () => ({ reviewId: "REV3", schoolId: "school-A", staffId: "S1" });

  const req = { params: { id: "REV3" }, user: { schoolId: "school-A" } };
  const res = mockRes();
  await ctrl.getReview(req, res);

  assert.equal(res._status, 200);
  svc.getReview = orig;
});

// ── familyRoutes ─────────────────────────────────────────────────────

test("family: GET /api/families/:familyId blocks cross-tenant read", async () => {
  const svc = require("../services/familyService");
  const orig = svc.getOne;
  svc.getOne = async () => ({ familyId: "FAM1", schoolId: "school-B" });

  const familyRoutes = require("../routes/familyRoutes");
  const layer = findRouteLayer(familyRoutes, "/api/families/:familyId", "get");
  assert.ok(layer);

  const req = { params: { familyId: "FAM1" }, user: { schoolId: "school-A", role: "admin", permissions: ["*"] } };
  const res = await runProtectedChain(layer, req);

  assert.equal(res._status, 404);
  svc.getOne = orig;
});

test("family: DELETE /api/families/:familyId blocks cross-tenant delete, never calls svc.remove", async () => {
  const svc = require("../services/familyService");
  const origGetOne = svc.getOne;
  const origRemove = svc.remove;
  svc.getOne = async () => ({ familyId: "FAM2", schoolId: "school-B" });
  let called = false;
  svc.remove = async () => { called = true; return true; };

  const familyRoutes = require("../routes/familyRoutes");
  const layer = findRouteLayer(familyRoutes, "/api/families/:familyId", "delete");
  const req = { params: { familyId: "FAM2" }, user: { schoolId: "school-A", role: "admin", permissions: ["*"] } };
  const res = await runProtectedChain(layer, req);

  assert.equal(res._status, 404);
  assert.equal(called, false);
  svc.getOne = origGetOne;
  svc.remove = origRemove;
});

test("family: POST /api/families/:familyId/notes blocks cross-tenant note injection", async () => {
  const svc = require("../services/familyService");
  const origGetOne = svc.getOne;
  const origAddNote = svc.addNote;
  svc.getOne = async () => ({ familyId: "FAM3", schoolId: "school-B" });
  let called = false;
  svc.addNote = async () => { called = true; return { success: true }; };

  const familyRoutes = require("../routes/familyRoutes");
  const layer = findRouteLayer(familyRoutes, "/api/families/:familyId/notes", "post");
  const req = { params: { familyId: "FAM3" }, body: { content: "hi" }, user: { schoolId: "school-A", userId: "U1", role: "admin", permissions: ["*"] } };
  const res = await runProtectedChain(layer, req);

  assert.equal(res._status, 404);
  assert.equal(called, false);
  svc.getOne = origGetOne;
  svc.addNote = origAddNote;
});

test("family: GET /api/families/:familyId allows a same-school read", async () => {
  const svc = require("../services/familyService");
  const orig = svc.getOne;
  svc.getOne = async () => ({ familyId: "FAM4", schoolId: "school-A" });

  const familyRoutes = require("../routes/familyRoutes");
  const layer = findRouteLayer(familyRoutes, "/api/families/:familyId", "get");
  const req = { params: { familyId: "FAM4" }, user: { schoolId: "school-A", role: "admin", permissions: ["*"] } };
  const res = await runProtectedChain(layer, req);

  assert.equal(res._status, 200);
  assert.equal(res.body.family.familyId, "FAM4");
  svc.getOne = orig;
});

// ── departmentController / designationController ────────────────────

test("department: update blocks cross-tenant write", async () => {
  const ctrl = require("../controllers/departmentController");
  const svc  = require("../services/departmentService");
  const orig = { getOne: svc.getOne, update: svc.update };
  svc.getOne = async () => ({ deptId: "D1", schoolId: "school-B" });
  let called = false;
  svc.update = async () => { called = true; return { deptId: "D1" }; };

  const req = { params: { deptId: "D1" }, body: { name: "Hacked" }, user: { schoolId: "school-A" } };
  const res = mockRes();
  await ctrl.update(req, res);

  assert.equal(res._status, 404);
  assert.equal(called, false);
  Object.assign(svc, orig);
});

test("designation: remove blocks cross-tenant delete", async () => {
  const ctrl = require("../controllers/designationController");
  const svc  = require("../services/designationService");
  const orig = { getOne: svc.getOne, remove: svc.remove };
  svc.getOne = async () => ({ designationId: "DS1", schoolId: "school-B" });
  let called = false;
  svc.remove = async () => { called = true; return true; };

  const req = { params: { designationId: "DS1" }, user: { schoolId: "school-A" } };
  const res = mockRes();
  await ctrl.remove(req, res);

  assert.equal(res._status, 404);
  assert.equal(called, false);
  Object.assign(svc, orig);
});

test("department: getOne allows a same-school read", async () => {
  const ctrl = require("../controllers/departmentController");
  const svc  = require("../services/departmentService");
  const orig = svc.getOne;
  svc.getOne = async () => ({ deptId: "D2", schoolId: "school-A", name: "Ops" });

  const req = { params: { deptId: "D2" }, user: { schoolId: "school-A" } };
  const res = mockRes();
  await ctrl.getOne(req, res);

  assert.equal(res._status, 200);
  svc.getOne = orig;
});

// ── roleRoutes ───────────────────────────────────────────────────────

test("roles: GET /api/roles/:roleId blocks cross-tenant read (including isSystem docs)", async () => {
  const svc = require("../services/roleService");
  const orig = svc.getOne;
  svc.getOne = async () => ({ roleId: "admin", schoolId: "school-B", isSystem: true, permissions: {} });

  const roleRoutes = require("../routes/roleRoutes");
  const handler = findRouteHandler(roleRoutes, "/api/roles/:roleId", "get");
  const req = { params: { roleId: "admin" }, user: { schoolId: "school-A", role: "admin" } };
  const res = mockRes();
  await handler(req, res);

  assert.equal(res._status, 404, "a non-owning tenant must not read another tenant's system-role doc");
  svc.getOne = orig;
});

test("roles: PUT /api/roles/:roleId/permissions blocks cross-tenant mutation of an isSystem role", async () => {
  const svc = require("../services/roleService");
  const origGetOne = svc.getOne;
  const origUpdatePerms = svc.updatePermissions;
  svc.getOne = async () => ({ roleId: "teacher", schoolId: "school-B", isSystem: true, permissions: {} });
  let called = false;
  svc.updatePermissions = async () => { called = true; return {}; };

  const roleRoutes = require("../routes/roleRoutes");
  const handler = findRouteHandler(roleRoutes, "/api/roles/:roleId/permissions", "put");
  const req = { params: { roleId: "teacher" }, body: { permissions: { fees: { view: false } } }, user: { schoolId: "school-A", role: "admin", userId: "U1" } };
  const res = mockRes();
  await handler(req, res);

  assert.equal(res._status, 404);
  assert.equal(called, false, "a non-owning tenant must never be able to rewrite a shared system-role's permission matrix");
  svc.getOne = origGetOne;
  svc.updatePermissions = origUpdatePerms;
});

test("roles: DELETE /api/roles/:roleId blocks cross-tenant delete", async () => {
  const svc = require("../services/roleService");
  const origGetOne = svc.getOne;
  const origRemove = svc.remove;
  svc.getOne = async () => ({ roleId: "custom-1", schoolId: "school-B", isSystem: false });
  let called = false;
  svc.remove = async () => { called = true; return true; };

  const roleRoutes = require("../routes/roleRoutes");
  const handler = findRouteHandler(roleRoutes, "/api/roles/:roleId", "delete");
  const req = { params: { roleId: "custom-1" }, user: { schoolId: "school-A", role: "admin", userId: "U1" } };
  const res = mockRes();
  await handler(req, res);

  assert.equal(res._status, 404);
  assert.equal(called, false);
  svc.getOne = origGetOne;
  svc.remove = origRemove;
});

test("roles: GET /api/roles/:roleId allows a same-school read", async () => {
  const svc = require("../services/roleService");
  const orig = svc.getOne;
  svc.getOne = async () => ({ roleId: "custom-2", schoolId: "school-A", permissions: {} });

  const roleRoutes = require("../routes/roleRoutes");
  const handler = findRouteHandler(roleRoutes, "/api/roles/:roleId", "get");
  const req = { params: { roleId: "custom-2" }, user: { schoolId: "school-A", role: "admin" } };
  const res = mockRes();
  await handler(req, res);

  assert.equal(res._status, 200);
  svc.getOne = orig;
});

// ── userRoutes ───────────────────────────────────────────────────────

test("users: GET /api/users/:userId blocks cross-tenant read", async () => {
  const svc = require("../services/userService");
  const orig = svc.getOne;
  svc.getOne = async () => ({ userId: "U1", schoolId: "school-B", email: "foreign@x.com" });

  const userRoutes = require("../routes/userRoutes");
  const handler = findRouteHandler(userRoutes, "/api/users/:userId", "get");
  const req = { params: { userId: "U1" }, user: { schoolId: "school-A", role: "admin" } };
  const res = mockRes();
  await handler(req, res);

  assert.equal(res._status, 404);
  svc.getOne = orig;
});

test("users: PUT /api/users/:userId blocks a cross-tenant role-escalation attempt, never calls svc.update", async () => {
  const svc = require("../services/userService");
  const origGetOne = svc.getOne;
  const origUpdate = svc.update;
  svc.getOne = async () => ({ userId: "U2", schoolId: "school-B", role: "teacher" });
  let called = false;
  svc.update = async () => { called = true; return { userId: "U2", role: "super_admin" }; };

  const userRoutes = require("../routes/userRoutes");
  const handler = findRouteHandler(userRoutes, "/api/users/:userId", "put");
  const req = { params: { userId: "U2" }, body: { role: "super_admin" }, user: { schoolId: "school-A", role: "admin", userId: "U-attacker" } };
  const res = mockRes();
  await handler(req, res);

  assert.equal(res._status, 404, "cross-tenant target must 404 before any role update is attempted");
  assert.equal(called, false, "svc.update must never be reached for a cross-tenant target");
  svc.getOne = origGetOne;
  svc.update = origUpdate;
});

test("users: DELETE /api/users/:userId (deactivate) blocks cross-tenant target", async () => {
  const svc = require("../services/userService");
  const origGetOne = svc.getOne;
  const origDeactivate = svc.deactivate;
  svc.getOne = async () => ({ userId: "U3", schoolId: "school-B" });
  let called = false;
  svc.deactivate = async () => { called = true; return { userId: "U3", status: "inactive" }; };

  const userRoutes = require("../routes/userRoutes");
  const handler = findRouteHandler(userRoutes, "/api/users/:userId", "delete");
  const req = { params: { userId: "U3" }, user: { schoolId: "school-A", role: "admin", userId: "U-attacker" } };
  const res = mockRes();
  await handler(req, res);

  assert.equal(res._status, 404);
  assert.equal(called, false);
  svc.getOne = origGetOne;
  svc.deactivate = origDeactivate;
});

test("users: POST /api/users/:userId/reset-password blocks cross-tenant target", async () => {
  const svc = require("../services/userService");
  const orig = svc.getOne;
  svc.getOne = async () => ({ userId: "U4", schoolId: "school-B", email: "foreign@x.com" });

  const userRoutes = require("../routes/userRoutes");
  const handler = findRouteHandler(userRoutes, "/api/users/:userId/reset-password", "post");
  const req = { params: { userId: "U4" }, user: { schoolId: "school-A", role: "admin" } };
  const res = mockRes();
  await handler(req, res);

  assert.equal(res._status, 404);
  svc.getOne = orig;
});

test("users: PUT /api/users/:userId allows a same-school, non-bypass role update", async () => {
  const svc = require("../services/userService");
  const origGetOne = svc.getOne;
  const origUpdate = svc.update;
  svc.getOne = async () => ({ userId: "U5", schoolId: "school-A", role: "teacher" });
  svc.update = async () => ({ userId: "U5", schoolId: "school-A", role: "center_admin" });

  const userRoutes = require("../routes/userRoutes");
  const handler = findRouteHandler(userRoutes, "/api/users/:userId", "put");
  const req = { params: { userId: "U5" }, body: { role: "center_admin" }, user: { schoolId: "school-A", role: "admin", userId: "U-owner" } };
  const res = mockRes();
  await handler(req, res);

  assert.equal(res._status, 200);
  assert.equal(res.body.user.role, "center_admin");
  svc.getOne = origGetOne;
  svc.update = origUpdate;
});

// ── userService: bypass-role assignment lockdown (escalation found during audit) ──

test("userService._resolveAssignableRole: 'super_admin' request never resolves to a bypass role", () => {
  const svc = require("../services/userService");
  assert.equal(svc._resolveAssignableRole("super_admin"), "teacher");
  assert.equal(svc._resolveAssignableRole("super_admin", null), null);
});

test("userService._resolveAssignableRole: 'developer' request never resolves to a bypass role", () => {
  const svc = require("../services/userService");
  assert.equal(svc._resolveAssignableRole("developer"), "teacher");
  assert.equal(svc._resolveAssignableRole("developer", null), null);
});

test("userService._resolveAssignableRole: ordinary roles pass through unchanged", () => {
  const svc = require("../services/userService");
  assert.equal(svc._resolveAssignableRole("center_admin"), "center_admin");
  assert.equal(svc._resolveAssignableRole("accountant", null), "accountant");
});

test("userService: ASSIGNABLE_ROLES excludes both bypass roles", () => {
  const svc = require("../services/userService");
  assert.equal(svc.ASSIGNABLE_ROLES.includes("developer"), false);
  assert.equal(svc.ASSIGNABLE_ROLES.includes("super_admin"), false);
  assert.equal(svc.ASSIGNABLE_ROLES.includes("admin"), true);
});
