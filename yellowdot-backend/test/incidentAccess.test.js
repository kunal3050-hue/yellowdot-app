/**
 * Milestone 7 — Incident Reports authorization & tenant isolation.
 * Covers: role gate (staffOnly blocks parent/unknown at the router level)
 * and tenant gate (checkIncidentAccess blocks cross-tenant staff access).
 */
const test = require("node:test");
const assert = require("node:assert");
const { checkIncidentAccess } = require("../middleware/incidentAccess");
const { staffOnly, blockUnknown } = require("../middleware/authMiddleware");

const INC_A = { id: "INC-1", schoolId: "school-A", studentId: "YD001" };
const INC_B = { id: "INC-2", schoolId: "school-B", studentId: "YD999" }; // different tenant

function mockRes() {
  return { _status: 200, status(c) { this._status = c; return this; }, json(b) { this.body = b; return this; } };
}
function run(mw, req) {
  let nextCalled = false;
  const res = mockRes();
  mw(req, res, () => { nextCalled = true; });
  return { nextCalled, res };
}

// ── Role gate: parents must never reach the staff-side incident routes ──

test("staffOnly: parent role is rejected (403)", () => {
  const { nextCalled, res } = run(staffOnly, { user: { role: "parent" } });
  assert.equal(nextCalled, false);
  assert.equal(res._status, 403);
});

test("staffOnly: unregistered 'unknown' role is rejected (403)", () => {
  const { nextCalled, res } = run(staffOnly, { user: { role: "unknown" } });
  assert.equal(nextCalled, false);
  assert.equal(res._status, 403);
});

test("staffOnly: teacher passes through", () => {
  const { nextCalled } = run(staffOnly, { user: { role: "teacher" } });
  assert.equal(nextCalled, true);
});

test("staffOnly: admin passes through", () => {
  const { nextCalled } = run(staffOnly, { user: { role: "admin" } });
  assert.equal(nextCalled, true);
});

test("staffOnly: reception passes through (incident reports are filed at the front desk too)", () => {
  const { nextCalled } = run(staffOnly, { user: { role: "reception" } });
  assert.equal(nextCalled, true);
});

test("blockUnknown: unregistered account rejected before reaching staffOnly", () => {
  const { nextCalled, res } = run(blockUnknown, { user: { role: "unknown" } });
  assert.equal(nextCalled, false);
  assert.equal(res._status, 403);
});

// ── Tenant gate: staff at one school cannot reach another school's incident ──

test("Tenant check: staff, same school → allowed", () => {
  const req = { user: { role: "teacher", schoolId: "school-A" } };
  assert.deepEqual(checkIncidentAccess(req, INC_A), { allowed: true });
});

test("Tenant check: staff, cross-tenant → not_found (hides existence, not a 403)", () => {
  const req = { user: { role: "teacher", schoolId: "school-A" } };
  const v = checkIncidentAccess(req, INC_B);
  assert.equal(v.allowed, false);
  assert.equal(v.reason, "not_found");
});

test("Tenant check: incident doesn't exist at all → not_found", () => {
  const req = { user: { role: "admin", schoolId: "school-A" } };
  const v = checkIncidentAccess(req, null);
  assert.equal(v.allowed, false);
  assert.equal(v.reason, "not_found");
});

test("Tenant check: reverse direction (school-B staff reaching school-A incident) → not_found", () => {
  const req = { user: { role: "center_admin", schoolId: "school-B" } };
  const v = checkIncidentAccess(req, INC_A);
  assert.equal(v.allowed, false);
  assert.equal(v.reason, "not_found");
});

// ── Route-wiring proof: the real Express handlers enforce the tenant check ──

function findRouteHandler(router, path, method) {
  const layer = router.stack.find(l => l.route && l.route.path === path && l.route.methods[method]);
  if (!layer) return null;
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

test("Route wiring: GET /api/incidents/:id blocks cross-tenant staff, end-to-end", async () => {
  const incSvc = require("../services/incidentService");
  const origGetIncident = incSvc.getIncident;
  incSvc.getIncident = async () => INC_B; // belongs to school-B

  const incidentRoutes = require("../routes/incidentRoutes");
  const handler = findRouteHandler(incidentRoutes, "/api/incidents/:id", "get");
  assert.ok(handler, "route must still be registered");

  const req = { params: { id: "INC-2" }, user: { role: "teacher", schoolId: "school-A" } };
  const res = mockRes();
  await handler(req, res);

  assert.equal(res._status, 404);

  incSvc.getIncident = origGetIncident;
});

test("Route wiring: PUT /api/incidents/:id blocks a cross-tenant write, and never calls updateIncident", async () => {
  const incSvc = require("../services/incidentService");
  const origGetIncident = incSvc.getIncident;
  const origUpdate = incSvc.updateIncident;
  incSvc.getIncident = async () => INC_B;
  let updateCalled = false;
  incSvc.updateIncident = async () => { updateCalled = true; return { ...INC_B, description: "HIJACKED" }; };

  const incidentRoutes = require("../routes/incidentRoutes");
  const handler = findRouteHandler(incidentRoutes, "/api/incidents/:id", "put");
  assert.ok(handler, "route must still be registered");

  const req = { params: { id: "INC-2" }, body: { description: "HIJACKED" }, user: { role: "center_admin", schoolId: "school-A" } };
  const res = mockRes();
  await handler(req, res);

  assert.equal(res._status, 404);
  assert.equal(updateCalled, false, "updateIncident must never be called for a cross-tenant target");

  incSvc.getIncident = origGetIncident;
  incSvc.updateIncident = origUpdate;
});

test("Route wiring: DELETE /api/incidents/:id blocks a cross-tenant delete, and never calls deleteIncident", async () => {
  const incSvc = require("../services/incidentService");
  const origGetIncident = incSvc.getIncident;
  const origDelete = incSvc.deleteIncident;
  incSvc.getIncident = async () => INC_B;
  let deleteCalled = false;
  incSvc.deleteIncident = async () => { deleteCalled = true; };

  const incidentRoutes = require("../routes/incidentRoutes");
  const handler = findRouteHandler(incidentRoutes, "/api/incidents/:id", "delete");
  assert.ok(handler, "route must still be registered");

  const req = { params: { id: "INC-2" }, user: { role: "admin", schoolId: "school-A" } };
  const res = mockRes();
  await handler(req, res);

  assert.equal(res._status, 404);
  assert.equal(deleteCalled, false, "deleteIncident must never be called for a cross-tenant target");

  incSvc.getIncident = origGetIncident;
  incSvc.deleteIncident = origDelete;
});

test("Route wiring: PATCH /api/incidents/:id/status blocks cross-tenant status change", async () => {
  const incSvc = require("../services/incidentService");
  const origGetIncident = incSvc.getIncident;
  const origUpdateStatus = incSvc.updateStatus;
  incSvc.getIncident = async () => INC_B;
  let statusCalled = false;
  incSvc.updateStatus = async () => { statusCalled = true; };

  const incidentRoutes = require("../routes/incidentRoutes");
  const handler = findRouteHandler(incidentRoutes, "/api/incidents/:id/status", "patch");
  assert.ok(handler, "route must still be registered");

  const req = { params: { id: "INC-2" }, body: { status: "closed" }, user: { role: "teacher", schoolId: "school-A" } };
  const res = mockRes();
  await handler(req, res);

  assert.equal(res._status, 404);
  assert.equal(statusCalled, false, "updateStatus must never be called for a cross-tenant target");

  incSvc.getIncident = origGetIncident;
  incSvc.updateStatus = origUpdateStatus;
});

test("Route wiring: GET /api/incidents/:id allows same-school staff", async () => {
  const incSvc = require("../services/incidentService");
  const origGetIncident = incSvc.getIncident;
  const origGetAck = incSvc.getAcknowledgement;
  incSvc.getIncident = async () => INC_A;
  incSvc.getAcknowledgement = async () => null;

  const incidentRoutes = require("../routes/incidentRoutes");
  const handler = findRouteHandler(incidentRoutes, "/api/incidents/:id", "get");

  const req = { params: { id: "INC-1" }, user: { role: "teacher", schoolId: "school-A" } };
  const res = mockRes();
  await handler(req, res);

  assert.equal(res._status, 200);
  assert.equal(res.body.incident.id, "INC-1");

  incSvc.getIncident = origGetIncident;
  incSvc.getAcknowledgement = origGetAck;
});
