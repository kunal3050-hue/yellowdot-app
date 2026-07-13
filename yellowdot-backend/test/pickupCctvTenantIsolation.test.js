/**
 * Milestone 10 — Pickup Authorization & CCTV Configuration tenant isolation
 * (Critical C7). Covers the shared cctvAccessResolver tenant check, and
 * route-wiring proofs for both pickup-authorization and CCTV by-ID routes.
 * Credential masking/encryption (Critical C8) is explicitly NOT in scope here
 * -- see Milestone 11.
 */
const test = require("node:test");
const assert = require("node:assert");
const { canViewCamera, canParentViewCamera } = require("../services/cctvAccessResolver");
const { checkTenantAccess } = require("../middleware/tenantRecordAccess");

const CAM_A = { cameraId: "CAM-1", schoolId: "school-A", centerId: "center-1", classrooms: ["Room 1"], deleted: false };
const CAM_B = { cameraId: "CAM-2", schoolId: "school-B", centerId: "center-1", classrooms: ["Room 1"], deleted: false }; // same centerId string, different school

// ── canViewCamera: tenant check applies to EVERY role, including bypass ──

test("canViewCamera: bypass role (developer), same school → allowed", () => {
  const d = canViewCamera({ role: "developer", schoolId: "school-A", centerId: "center-1" }, CAM_A);
  assert.equal(d.allowed, true);
  assert.equal(d.reason, "bypass-role");
});

test("canViewCamera: bypass role (developer), DIFFERENT school → denied, even though centerId matches", () => {
  const d = canViewCamera({ role: "developer", schoolId: "school-A", centerId: "center-1" }, CAM_B);
  assert.equal(d.allowed, false);
  assert.equal(d.reason, "different-school");
});

test("canViewCamera: center-wide role (admin), same school + same center → allowed", () => {
  const d = canViewCamera({ role: "admin", schoolId: "school-A", centerId: "center-1" }, CAM_A);
  assert.equal(d.allowed, true);
});

test("canViewCamera: center-wide role (admin), same school + different center → denied (pre-existing check, unaffected)", () => {
  const d = canViewCamera({ role: "admin", schoolId: "school-A", centerId: "center-2" }, CAM_A);
  assert.equal(d.allowed, false);
  assert.equal(d.reason, "different-center");
});

test("canViewCamera: center-wide role (admin), DIFFERENT school (matching centerId string) → denied", () => {
  const d = canViewCamera({ role: "admin", schoolId: "school-A", centerId: "center-1" }, CAM_B);
  assert.equal(d.allowed, false);
  assert.equal(d.reason, "different-school");
});

test("canViewCamera: classroom-scoped role (teacher), DIFFERENT school (matching classroom) → denied", () => {
  const d = canViewCamera({ role: "teacher", schoolId: "school-A", centerId: "center-1", classrooms: ["Room 1"] }, CAM_B);
  assert.equal(d.allowed, false);
  assert.equal(d.reason, "different-school");
});

test("canViewCamera: classroom-scoped role (teacher), same school + matching classroom → allowed", () => {
  const d = canViewCamera({ role: "teacher", schoolId: "school-A", centerId: "center-1", classrooms: ["Room 1"] }, CAM_A);
  assert.equal(d.allowed, true);
});

// ── canParentViewCamera: same tenant fix ────────────────────────────

test("canParentViewCamera: DIFFERENT school (matching center/classroom/presence) → denied", () => {
  const child = { studentId: "YD001", schoolId: "school-A", centerId: "center-1", classroom: "Room 1" };
  const presence = { status: "PRESENT" };
  const d = canParentViewCamera(child, presence, CAM_B, { schoolHoursOpen: true });
  assert.equal(d.allowed, false);
  assert.equal(d.reason, "different-school");
});

test("canParentViewCamera: same school + center + classroom + present → allowed", () => {
  const child = { studentId: "YD001", schoolId: "school-A", centerId: "center-1", classroom: "Room 1" };
  const presence = { status: "PRESENT" };
  const d = canParentViewCamera(child, presence, CAM_A, { schoolHoursOpen: true });
  assert.equal(d.allowed, true);
});

// ── Generic tenant helper (reused from M8) sanity re-check for this shape ──

test("checkTenantAccess: works identically for camera/pickup-person shaped records", () => {
  const req = { user: { role: "admin", schoolId: "school-A" } };
  assert.deepEqual(checkTenantAccess(req, { schoolId: "school-A" }), { allowed: true });
  assert.equal(checkTenantAccess(req, { schoolId: "school-B" }).reason, "not_found");
});

// ── Route-wiring: pickup-authorization ──────────────────────────────

function findRouteHandler(router, path, method) {
  const layer = router.stack.find(l => l.route && l.route.path === path && l.route.methods[method]);
  if (!layer) return null;
  return layer.route.stack[layer.route.stack.length - 1].handle;
}
function mockRes() {
  return { _status: 200, status(c) { this._status = c; return this; }, json(b) { this.body = b; return this; } };
}

test("Pickup route wiring: PUT /api/pickup-authorization/:id blocks cross-tenant write, never calls svc.update", async () => {
  const pickupSvc = require("../services/pickupAuthorizationService");
  const origGetOne = pickupSvc.getOne;
  const origUpdate = pickupSvc.update;
  pickupSvc.getOne = async () => ({ entryId: "PKUP-1", schoolId: "school-B", studentId: "YD999", pickupName: "Uncle Bob" });
  let updateCalled = false;
  pickupSvc.update = async () => { updateCalled = true; return { entryId: "PKUP-1" }; };

  const pickupRoutes = require("../routes/pickupRoutes");
  const handler = findRouteHandler(pickupRoutes, "/api/pickup-authorization/:id", "put");
  assert.ok(handler, "route must still be registered");

  const req = { params: { id: "PKUP-1" }, body: { mobile: "9999999999" }, user: { role: "center_admin", schoolId: "school-A" } };
  const res = mockRes();
  await handler(req, res);

  assert.equal(res._status, 404);
  assert.equal(updateCalled, false, "svc.update must never be called for a cross-tenant target");

  pickupSvc.getOne = origGetOne;
  pickupSvc.update = origUpdate;
});

test("Pickup route wiring: DELETE /api/pickup-authorization/:id blocks cross-tenant delete, never calls svc.remove", async () => {
  const pickupSvc = require("../services/pickupAuthorizationService");
  const origGetOne = pickupSvc.getOne;
  const origRemove = pickupSvc.remove;
  pickupSvc.getOne = async () => ({ entryId: "PKUP-2", schoolId: "school-B", studentId: "YD999", pickupName: "Uncle Bob", isProtected: false });
  let removeCalled = false;
  pickupSvc.remove = async () => { removeCalled = true; return true; };

  const pickupRoutes = require("../routes/pickupRoutes");
  const handler = findRouteHandler(pickupRoutes, "/api/pickup-authorization/:id", "delete");
  assert.ok(handler, "route must still be registered");

  const req = { params: { id: "PKUP-2" }, user: { role: "admin", schoolId: "school-A" } };
  const res = mockRes();
  await handler(req, res);

  assert.equal(res._status, 404);
  assert.equal(removeCalled, false, "svc.remove must never be called for a cross-tenant target");

  pickupSvc.getOne = origGetOne;
  pickupSvc.remove = origRemove;
});

test("Pickup route wiring: PUT /api/pickup-authorization/:id allows a same-school write", async () => {
  const pickupSvc = require("../services/pickupAuthorizationService");
  const origGetOne = pickupSvc.getOne;
  const origUpdate = pickupSvc.update;
  pickupSvc.getOne = async () => ({ entryId: "PKUP-3", schoolId: "school-A", studentId: "YD001", pickupName: "Aunt Jane" });
  pickupSvc.update = async () => ({ entryId: "PKUP-3", pickupName: "Aunt Jane", mobile: "9999999999" });

  const pickupRoutes = require("../routes/pickupRoutes");
  const handler = findRouteHandler(pickupRoutes, "/api/pickup-authorization/:id", "put");

  const req = { params: { id: "PKUP-3" }, body: { mobile: "9999999999" }, user: { role: "center_admin", schoolId: "school-A" } };
  const res = mockRes();
  await handler(req, res);

  assert.equal(res._status, 200);
  assert.equal(res.body.success, true);

  pickupSvc.getOne = origGetOne;
  pickupSvc.update = origUpdate;
});

// ── Route-wiring: CCTV ───────────────────────────────────────────────

test("CCTV route wiring: PUT /api/cctv/cameras/:id blocks cross-tenant write, never calls svc.update", async () => {
  const cctvSvc = require("../services/cctvService");
  const origGetOne = cctvSvc.getOne;
  const origUpdate = cctvSvc.update;
  cctvSvc.getOne = async () => ({ cameraId: "CAM-1", schoolId: "school-B", cameraName: "Foreign Cam" });
  let updateCalled = false;
  cctvSvc.update = async () => { updateCalled = true; return { cameraId: "CAM-1" }; };

  const cctvRoutes = require("../routes/cctvRoutes");
  const handler = findRouteHandler(cctvRoutes, "/api/cctv/cameras/:id", "put");
  assert.ok(handler, "route must still be registered");

  const req = { params: { id: "CAM-1" }, body: { cameraName: "HIJACKED" }, user: { role: "admin", schoolId: "school-A" } };
  const res = mockRes();
  await handler(req, res);

  assert.equal(res._status, 404);
  assert.equal(updateCalled, false, "svc.update must never be called for a cross-tenant camera");

  cctvSvc.getOne = origGetOne;
  cctvSvc.update = origUpdate;
});

test("CCTV route wiring: DELETE /api/cctv/cameras/:id blocks cross-tenant delete, never calls svc.remove", async () => {
  const cctvSvc = require("../services/cctvService");
  const origGetOne = cctvSvc.getOne;
  const origRemove = cctvSvc.remove;
  cctvSvc.getOne = async () => ({ cameraId: "CAM-2", schoolId: "school-B", cameraName: "Foreign Cam" });
  let removeCalled = false;
  cctvSvc.remove = async () => { removeCalled = true; return true; };

  const cctvRoutes = require("../routes/cctvRoutes");
  const handler = findRouteHandler(cctvRoutes, "/api/cctv/cameras/:id", "delete");
  assert.ok(handler, "route must still be registered");

  const req = { params: { id: "CAM-2" }, user: { role: "super_admin", schoolId: "school-A" } };
  const res = mockRes();
  await handler(req, res);

  assert.equal(res._status, 404);
  assert.equal(removeCalled, false, "svc.remove must never be called for a cross-tenant camera");

  cctvSvc.getOne = origGetOne;
  cctvSvc.remove = origRemove;
});

test("CCTV route wiring: POST /api/cctv/cameras/test blocks a cross-tenant cameraId, never leaks host/port", async () => {
  const cctvSvc = require("../services/cctvService");
  const origGetOne = cctvSvc.getOne;
  cctvSvc.getOne = async () => ({ cameraId: "CAM-3", schoolId: "school-B", ip: "10.0.0.9", port: "554" });

  const cctvRoutes = require("../routes/cctvRoutes");
  const handler = findRouteHandler(cctvRoutes, "/api/cctv/cameras/test", "post");
  assert.ok(handler, "route must still be registered");

  const req = { body: { cameraId: "CAM-3" }, user: { role: "center_admin", schoolId: "school-A" } };
  const res = mockRes();
  await handler(req, res);

  assert.equal(res._status, 404);
  assert.equal(JSON.stringify(res.body).includes("10.0.0.9"), false, "must never leak the foreign camera's IP");

  cctvSvc.getOne = origGetOne;
});

test("CCTV route wiring: POST /api/cctv/cameras/verify blocks a cross-tenant cameraId, never calls getOneWithSecret", async () => {
  const cctvSvc = require("../services/cctvService");
  const origGetOne = cctvSvc.getOne;
  const origGetSecret = cctvSvc.getOneWithSecret;
  cctvSvc.getOne = async () => ({ cameraId: "CAM-4", schoolId: "school-B" });
  let secretFetched = false;
  cctvSvc.getOneWithSecret = async () => { secretFetched = true; return { cameraId: "CAM-4", password: "real-password" }; };

  const cctvRoutes = require("../routes/cctvRoutes");
  const handler = findRouteHandler(cctvRoutes, "/api/cctv/cameras/verify", "post");
  assert.ok(handler, "route must still be registered");

  const req = { body: { cameraId: "CAM-4" }, user: { role: "admin", schoolId: "school-A" } };
  const res = mockRes();
  await handler(req, res);

  assert.equal(res._status, 404);
  assert.equal(secretFetched, false, "getOneWithSecret (decrypted password) must never be reached for a cross-tenant camera");

  cctvSvc.getOne = origGetOne;
  cctvSvc.getOneWithSecret = origGetSecret;
});

test("CCTV route wiring: PUT /api/cctv/cameras/:id allows a same-school write", async () => {
  const cctvSvc = require("../services/cctvService");
  const origGetOne = cctvSvc.getOne;
  const origUpdate = cctvSvc.update;
  cctvSvc.getOne = async () => ({ cameraId: "CAM-5", schoolId: "school-A", cameraName: "Own Cam" });
  cctvSvc.update = async () => ({ cameraId: "CAM-5", cameraName: "Updated Name", password: "x" });

  const cctvRoutes = require("../routes/cctvRoutes");
  const handler = findRouteHandler(cctvRoutes, "/api/cctv/cameras/:id", "put");

  const req = { params: { id: "CAM-5" }, body: { cameraName: "Updated Name" }, user: { role: "admin", schoolId: "school-A" } };
  const res = mockRes();
  await handler(req, res);

  assert.equal(res._status, 200);
  assert.equal(res.body.camera.cameraName, "Updated Name");

  cctvSvc.getOne = origGetOne;
  cctvSvc.update = origUpdate;
});
