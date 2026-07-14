/**
 * Milestone 16 — Communication module hardening: holidays, notices,
 * announcements cross-tenant update/delete protection, plus a
 * client-supplied-schoolId injection fix found during the audit.
 */
const test = require("node:test");
const assert = require("node:assert");

function mockRes() {
  return { _status: 200, status(c) { this._status = c; return this; }, json(b) { this.body = b; return this; } };
}
function findRouteHandler(router, path, method) {
  const layer = router.stack.find(l => l.route && l.route.path === path && l.route.methods[method]);
  if (!layer) return null;
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

const RESOURCES = [
  { name: "holiday",      path: "/api/holidays/:id",      get: "getHoliday",      update: "updateHoliday",      remove: "deleteHoliday" },
  { name: "notice",       path: "/api/notices/:id",       get: "getNotice",       update: "updateNotice",       remove: "deleteNotice" },
  { name: "announcement", path: "/api/announcements/:id", get: "getAnnouncement", update: "updateAnnouncement", remove: "deleteAnnouncement" },
];

for (const r of RESOURCES) {
  test(`communication: PUT ${r.path} blocks cross-tenant write, never calls svc.${r.update}`, async () => {
    const commRoutes = require("../routes/communicationRoutes");
    const svc = require("../services/communicationService");
    const origGet = svc[r.get];
    const origUpdate = svc[r.update];
    svc[r.get] = async () => ({ id: "X1", schoolId: "school-B", title: "Foreign" });
    let called = false;
    svc[r.update] = async () => { called = true; return {}; };

    const handler = findRouteHandler(commRoutes, r.path, "put");
    assert.ok(handler, `route ${r.path} PUT must be registered`);
    const req = { params: { id: "X1" }, body: { title: "HIJACKED" }, user: { schoolId: "school-A", role: "admin" } };
    const res = mockRes();
    await handler(req, res);

    assert.equal(res._status, 404);
    assert.equal(called, false, `${r.update} must never be called for a cross-tenant target`);
    svc[r.get] = origGet;
    svc[r.update] = origUpdate;
  });

  test(`communication: DELETE ${r.path} blocks cross-tenant delete, never calls svc.${r.remove}`, async () => {
    const commRoutes = require("../routes/communicationRoutes");
    const svc = require("../services/communicationService");
    const origGet = svc[r.get];
    const origRemove = svc[r.remove];
    svc[r.get] = async () => ({ id: "X2", schoolId: "school-B" });
    let called = false;
    svc[r.remove] = async () => { called = true; return true; };

    const handler = findRouteHandler(commRoutes, r.path, "delete");
    const req = { params: { id: "X2" }, user: { schoolId: "school-A", role: "admin" } };
    const res = mockRes();
    await handler(req, res);

    assert.equal(res._status, 404);
    assert.equal(called, false);
    svc[r.get] = origGet;
    svc[r.remove] = origRemove;
  });

  test(`communication: PUT ${r.path} allows a same-school write`, async () => {
    const commRoutes = require("../routes/communicationRoutes");
    const svc = require("../services/communicationService");
    const origGet = svc[r.get];
    const origUpdate = svc[r.update];
    svc[r.get] = async () => ({ id: "X3", schoolId: "school-A", title: "Own" });
    svc[r.update] = async () => ({ id: "X3", schoolId: "school-A", title: "Renamed" });

    const handler = findRouteHandler(commRoutes, r.path, "put");
    const req = { params: { id: "X3" }, body: { title: "Renamed" }, user: { schoolId: "school-A", role: "admin" } };
    const res = mockRes();
    await handler(req, res);

    assert.equal(res._status, 200);
    svc[r.get] = origGet;
    svc[r.update] = origUpdate;
  });
}

// ── Client-supplied schoolId injection (found during the audit) ────────

test("communicationService.updateHoliday: strips a client-supplied schoolId, never moves a record cross-tenant", async () => {
  const svc = require("../services/communicationService");
  const { db } = require("../firebaseAdmin");
  const origCollection = db.collection.bind(db);
  let capturedUpdate = null;
  db.collection = (name) => {
    if (name === "holidays") {
      return {
        doc: () => ({
          get: async () => ({ exists: true, data: () => ({ id: "H1", schoolId: "school-A", title: "Diwali" }) }),
          update: async (patch) => { capturedUpdate = patch; },
        }),
      };
    }
    return origCollection(name);
  };

  await svc.updateHoliday("H1", { title: "Diwali (renamed)", schoolId: "school-B" }, { actorUserId: "U1" });
  assert.equal(capturedUpdate.schoolId, undefined, "schoolId must never be settable via the update body");
  assert.equal(capturedUpdate.title, "Diwali (renamed)", "legitimate fields still update normally");

  db.collection = origCollection;
});

test("communicationService.updateNotice: strips a client-supplied schoolId", async () => {
  const svc = require("../services/communicationService");
  const { db } = require("../firebaseAdmin");
  const origCollection = db.collection.bind(db);
  let capturedUpdate = null;
  db.collection = (name) => {
    if (name === "notices") {
      return {
        doc: () => ({
          get: async () => ({ exists: true, data: () => ({ id: "N1", schoolId: "school-A" }) }),
          update: async (patch) => { capturedUpdate = patch; },
        }),
      };
    }
    return origCollection(name);
  };

  await svc.updateNotice("N1", { body: "Updated body", schoolId: "school-B" }, { actorUserId: "U1" });
  assert.equal(capturedUpdate.schoolId, undefined);

  db.collection = origCollection;
});

test("communicationService.updateAnnouncement: strips a client-supplied schoolId", async () => {
  const svc = require("../services/communicationService");
  const { db } = require("../firebaseAdmin");
  const origCollection = db.collection.bind(db);
  let capturedUpdate = null;
  db.collection = (name) => {
    if (name === "announcements") {
      return {
        doc: () => ({
          get: async () => ({ exists: true, data: () => ({ id: "A1", schoolId: "school-A" }) }),
          update: async (patch) => { capturedUpdate = patch; },
        }),
      };
    }
    return origCollection(name);
  };

  await svc.updateAnnouncement("A1", { title: "New title", schoolId: "school-B" }, { actorUserId: "U1" });
  assert.equal(capturedUpdate.schoolId, undefined);

  db.collection = origCollection;
});
