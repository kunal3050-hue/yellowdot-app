/**
 * Milestone 8 — Events & PTM authorization and tenant isolation.
 * Covers role gate (staffOnly/blockUnknown) and tenant gate (checkTenantAccess)
 * for both /api/events* and /api/ptm* routers.
 */
const test = require("node:test");
const assert = require("node:assert");
const { checkTenantAccess } = require("../middleware/tenantRecordAccess");
const { staffOnly, blockUnknown } = require("../middleware/authMiddleware");

const REC_A = { id: "R-1", schoolId: "school-A" };
const REC_B = { id: "R-2", schoolId: "school-B" };

function mockRes() {
  return { _status: 200, status(c) { this._status = c; return this; }, json(b) { this.body = b; return this; } };
}
function run(mw, req) {
  let nextCalled = false;
  const res = mockRes();
  mw(req, res, () => { nextCalled = true; });
  return { nextCalled, res };
}
function findRouteHandler(router, path, method) {
  const layer = router.stack.find(l => l.route && l.route.path === path && l.route.methods[method]);
  if (!layer) return null;
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

// ── Generic tenant-check helper (reused by both events and PTM routes) ──

test("checkTenantAccess: same school → allowed", () => {
  const req = { user: { role: "teacher", schoolId: "school-A" } };
  assert.deepEqual(checkTenantAccess(req, REC_A), { allowed: true });
});

test("checkTenantAccess: cross-tenant → not_found", () => {
  const req = { user: { role: "teacher", schoolId: "school-A" } };
  const v = checkTenantAccess(req, REC_B);
  assert.equal(v.allowed, false);
  assert.equal(v.reason, "not_found");
});

test("checkTenantAccess: record doesn't exist → not_found", () => {
  const req = { user: { role: "admin", schoolId: "school-A" } };
  const v = checkTenantAccess(req, null);
  assert.equal(v.allowed, false);
  assert.equal(v.reason, "not_found");
});

// ── Role gate: parents/unknown must never reach these staff-side routers ──

test("staffOnly: parent rejected (events/PTM are staff-only)", () => {
  const { nextCalled, res } = run(staffOnly, { user: { role: "parent" } });
  assert.equal(nextCalled, false);
  assert.equal(res._status, 403);
});

test("blockUnknown: unregistered account rejected", () => {
  const { nextCalled, res } = run(blockUnknown, { user: { role: "unknown" } });
  assert.equal(nextCalled, false);
  assert.equal(res._status, 403);
});

test("staffOnly: reception (files events at the front desk) passes through", () => {
  const { nextCalled } = run(staffOnly, { user: { role: "reception" } });
  assert.equal(nextCalled, true);
});

// ── EVENTS: route-wiring proofs ─────────────────────────────────────

test("Events route wiring: PUT /api/events/:id blocks a cross-tenant write, never calls updateEvent", async () => {
  const eventSvc = require("../services/eventService");
  const origGet = eventSvc.getEvent;
  const origUpdate = eventSvc.updateEvent;
  eventSvc.getEvent = async () => ({ id: "EVT-B", schoolId: "school-B" });
  let updateCalled = false;
  eventSvc.updateEvent = async () => { updateCalled = true; return { id: "EVT-B", title: "HIJACKED" }; };

  const eventRoutes = require("../routes/eventRoutes");
  const handler = findRouteHandler(eventRoutes, "/api/events/:id", "put");
  assert.ok(handler, "route must still be registered");

  const req = { params: { id: "EVT-B" }, body: { title: "HIJACKED" }, user: { role: "center_admin", schoolId: "school-A" } };
  const res = mockRes();
  await handler(req, res);

  assert.equal(res._status, 404);
  assert.equal(updateCalled, false, "updateEvent must never be called for a cross-tenant target");

  eventSvc.getEvent = origGet;
  eventSvc.updateEvent = origUpdate;
});

test("Events route wiring: DELETE /api/events/:id blocks a cross-tenant delete, never calls deleteEvent", async () => {
  const eventSvc = require("../services/eventService");
  const origGet = eventSvc.getEvent;
  const origDelete = eventSvc.deleteEvent;
  eventSvc.getEvent = async () => ({ id: "EVT-B", schoolId: "school-B" });
  let deleteCalled = false;
  eventSvc.deleteEvent = async () => { deleteCalled = true; return true; };

  const eventRoutes = require("../routes/eventRoutes");
  const handler = findRouteHandler(eventRoutes, "/api/events/:id", "delete");

  const req = { params: { id: "EVT-B" }, user: { role: "admin", schoolId: "school-A" } };
  const res = mockRes();
  await handler(req, res);

  assert.equal(res._status, 404);
  assert.equal(deleteCalled, false, "deleteEvent must never be called for a cross-tenant target");

  eventSvc.getEvent = origGet;
  eventSvc.deleteEvent = origDelete;
});

test("Events route wiring: GET /api/events/:id/rsvps blocks cross-tenant read", async () => {
  const eventSvc = require("../services/eventService");
  const origGet = eventSvc.getEvent;
  eventSvc.getEvent = async () => ({ id: "EVT-B", schoolId: "school-B" });

  const eventRoutes = require("../routes/eventRoutes");
  const handler = findRouteHandler(eventRoutes, "/api/events/:id/rsvps", "get");

  const req = { params: { id: "EVT-B" }, user: { role: "teacher", schoolId: "school-A" } };
  const res = mockRes();
  await handler(req, res);

  assert.equal(res._status, 404);
  eventSvc.getEvent = origGet;
});

test("Events route wiring: PUT /api/events/:id allows same-school staff", async () => {
  const eventSvc = require("../services/eventService");
  const origGet = eventSvc.getEvent;
  const origUpdate = eventSvc.updateEvent;
  eventSvc.getEvent = async () => ({ id: "EVT-A", schoolId: "school-A" });
  eventSvc.updateEvent = async () => ({ id: "EVT-A", schoolId: "school-A", title: "Updated" });

  const eventRoutes = require("../routes/eventRoutes");
  const handler = findRouteHandler(eventRoutes, "/api/events/:id", "put");

  const req = { params: { id: "EVT-A" }, body: { title: "Updated" }, user: { role: "teacher", schoolId: "school-A" } };
  const res = mockRes();
  await handler(req, res);

  assert.equal(res._status, 200);
  assert.equal(res.body.event.title, "Updated");

  eventSvc.getEvent = origGet;
  eventSvc.updateEvent = origUpdate;
});

// ── PTM: route-wiring proofs ─────────────────────────────────────────

test("PTM route wiring: PUT /api/ptm/:id blocks a cross-tenant write, never calls updatePtm", async () => {
  const ptmSvc = require("../services/ptmService");
  const origGet = ptmSvc.getPtm;
  const origUpdate = ptmSvc.updatePtm;
  ptmSvc.getPtm = async () => ({ id: "PTM-B", schoolId: "school-B" });
  let updateCalled = false;
  ptmSvc.updatePtm = async () => { updateCalled = true; return { id: "PTM-B", title: "HIJACKED" }; };

  const ptmRoutes = require("../routes/ptmRoutes");
  const handler = findRouteHandler(ptmRoutes, "/api/ptm/:id", "put");
  assert.ok(handler, "route must still be registered");

  const req = { params: { id: "PTM-B" }, body: { title: "HIJACKED" }, user: { role: "center_admin", schoolId: "school-A" } };
  const res = mockRes();
  await handler(req, res);

  assert.equal(res._status, 404);
  assert.equal(updateCalled, false, "updatePtm must never be called for a cross-tenant target");

  ptmSvc.getPtm = origGet;
  ptmSvc.updatePtm = origUpdate;
});

test("PTM route wiring: DELETE /api/ptm/:id blocks a cross-tenant delete, never calls deletePtm", async () => {
  const ptmSvc = require("../services/ptmService");
  const origGet = ptmSvc.getPtm;
  const origDelete = ptmSvc.deletePtm;
  ptmSvc.getPtm = async () => ({ id: "PTM-B", schoolId: "school-B" });
  let deleteCalled = false;
  ptmSvc.deletePtm = async () => { deleteCalled = true; };

  const ptmRoutes = require("../routes/ptmRoutes");
  const handler = findRouteHandler(ptmRoutes, "/api/ptm/:id", "delete");

  const req = { params: { id: "PTM-B" }, user: { role: "admin", schoolId: "school-A" } };
  const res = mockRes();
  await handler(req, res);

  assert.equal(res._status, 404);
  assert.equal(deleteCalled, false, "deletePtm must never be called for a cross-tenant target");

  ptmSvc.getPtm = origGet;
  ptmSvc.deletePtm = origDelete;
});

test("PTM route wiring: DELETE /api/ptm/:id/slots/:slotId blocks cross-tenant, never calls deleteSlot", async () => {
  const ptmSvc = require("../services/ptmService");
  const origGet = ptmSvc.getPtm;
  const origDeleteSlot = ptmSvc.deleteSlot;
  ptmSvc.getPtm = async () => ({ id: "PTM-B", schoolId: "school-B" });
  let deleteSlotCalled = false;
  ptmSvc.deleteSlot = async () => { deleteSlotCalled = true; };

  const ptmRoutes = require("../routes/ptmRoutes");
  const handler = findRouteHandler(ptmRoutes, "/api/ptm/:id/slots/:slotId", "delete");
  assert.ok(handler, "route must still be registered");

  const req = { params: { id: "PTM-B", slotId: "SLOT-1" }, user: { role: "teacher", schoolId: "school-A" } };
  const res = mockRes();
  await handler(req, res);

  assert.equal(res._status, 404);
  assert.equal(deleteSlotCalled, false, "deleteSlot must never be called for a cross-tenant target");

  ptmSvc.getPtm = origGet;
  ptmSvc.deleteSlot = origDeleteSlot;
});

test("PTM route wiring: PATCH /api/ptm/bookings/:bookingId/status resolves tenant via booking's ptmId (2-hop) and blocks cross-tenant", async () => {
  const ptmSvc = require("../services/ptmService");
  const origGetBooking = ptmSvc.getBooking;
  const origGetPtm = ptmSvc.getPtm;
  const origUpdateStatus = ptmSvc.updateBookingStatus;
  ptmSvc.getBooking = async () => ({ id: "BOOK-1", ptmId: "PTM-B", studentId: "YD001" });
  ptmSvc.getPtm = async (id) => (id === "PTM-B" ? { id: "PTM-B", schoolId: "school-B" } : null);
  let statusCalled = false;
  ptmSvc.updateBookingStatus = async () => { statusCalled = true; };

  const ptmRoutes = require("../routes/ptmRoutes");
  const handler = findRouteHandler(ptmRoutes, "/api/ptm/bookings/:bookingId/status", "patch");
  assert.ok(handler, "route must still be registered");

  const req = { params: { bookingId: "BOOK-1" }, body: { status: "attended" }, user: { role: "teacher", schoolId: "school-A" } };
  const res = mockRes();
  await handler(req, res);

  assert.equal(res._status, 404);
  assert.equal(statusCalled, false, "updateBookingStatus must never be called for a cross-tenant booking");

  ptmSvc.getBooking = origGetBooking;
  ptmSvc.getPtm = origGetPtm;
  ptmSvc.updateBookingStatus = origUpdateStatus;
});

test("PTM route wiring: PATCH /api/ptm/bookings/:bookingId/status allows same-tenant staff", async () => {
  const ptmSvc = require("../services/ptmService");
  const origGetBooking = ptmSvc.getBooking;
  const origGetPtm = ptmSvc.getPtm;
  const origUpdateStatus = ptmSvc.updateBookingStatus;
  ptmSvc.getBooking = async () => ({ id: "BOOK-2", ptmId: "PTM-A", studentId: "YD001" });
  ptmSvc.getPtm = async (id) => (id === "PTM-A" ? { id: "PTM-A", schoolId: "school-A" } : null);
  let statusCalled = false;
  ptmSvc.updateBookingStatus = async () => { statusCalled = true; };

  const ptmRoutes = require("../routes/ptmRoutes");
  const handler = findRouteHandler(ptmRoutes, "/api/ptm/bookings/:bookingId/status", "patch");

  const req = { params: { bookingId: "BOOK-2" }, body: { status: "attended" }, user: { role: "teacher", schoolId: "school-A" } };
  const res = mockRes();
  await handler(req, res);

  assert.equal(res._status, 200);
  assert.equal(statusCalled, true, "updateBookingStatus must be called for a legitimate same-tenant booking");

  ptmSvc.getBooking = origGetBooking;
  ptmSvc.getPtm = origGetPtm;
  ptmSvc.updateBookingStatus = origUpdateStatus;
});

test("PTM route wiring: GET /api/ptm/:id/notes/:studentId blocks cross-tenant read", async () => {
  const ptmSvc = require("../services/ptmService");
  const origGet = ptmSvc.getPtm;
  ptmSvc.getPtm = async () => ({ id: "PTM-B", schoolId: "school-B" });

  const ptmRoutes = require("../routes/ptmRoutes");
  const handler = findRouteHandler(ptmRoutes, "/api/ptm/:id/notes/:studentId", "get");

  const req = { params: { id: "PTM-B", studentId: "YD001" }, user: { role: "teacher", schoolId: "school-A" } };
  const res = mockRes();
  await handler(req, res);

  assert.equal(res._status, 404);
  ptmSvc.getPtm = origGet;
});

test("PTM route wiring: GET /api/ptm/:id/stats allows same-school staff", async () => {
  const ptmSvc = require("../services/ptmService");
  const origGet = ptmSvc.getPtm;
  const origStats = ptmSvc.getPtmStats;
  ptmSvc.getPtm = async () => ({ id: "PTM-A", schoolId: "school-A" });
  ptmSvc.getPtmStats = async () => ({ total: 5, booked: 2, available: 3, attended: 0, missed: 0 });

  const ptmRoutes = require("../routes/ptmRoutes");
  const handler = findRouteHandler(ptmRoutes, "/api/ptm/:id/stats", "get");

  const req = { params: { id: "PTM-A" }, user: { role: "admin", schoolId: "school-A" } };
  const res = mockRes();
  await handler(req, res);

  assert.equal(res._status, 200);
  assert.equal(res.body.stats.total, 5);

  ptmSvc.getPtm = origGet;
  ptmSvc.getPtmStats = origStats;
});
