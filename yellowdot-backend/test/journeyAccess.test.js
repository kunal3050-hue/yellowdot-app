/**
 * Milestone 9 — Journey module authorization & ownership.
 * Covers: staff-only gate on /api/journey* and /api/milestones* (parents were
 * previously able to hit these), and ownership enforcement on
 * GET /api/parent/journey (previously had zero ownership check at all --
 * any authenticated user could pass any childId in the query string).
 */
const test = require("node:test");
const assert = require("node:assert");
const { requireOwnChild, staffOnly, blockUnknown } = require("../middleware/authMiddleware");

function mockRes() {
  return { _status: 200, status(c) { this._status = c; return this; }, json(b) { this.body = b; return this; } };
}
function run(mw, req) {
  let nextCalled = false;
  const res = mockRes();
  mw(req, res, () => { nextCalled = true; });
  return { nextCalled, res };
}

// ── requireOwnChild: unit behavior ──────────────────────────────────

test("requireOwnChild: parent with a linked child passes and sets req.ownChildId", () => {
  const req = { user: { role: "parent", student: { studentId: "YD001" } }, params: {}, query: {}, body: {} };
  const { nextCalled } = run(requireOwnChild, req);
  assert.equal(nextCalled, true);
  assert.equal(req.ownChildId, "YD001");
});

test("requireOwnChild: staff role rejected (this endpoint is parent-only)", () => {
  const req = { user: { role: "teacher" }, params: {}, query: {}, body: {} };
  const { nextCalled, res } = run(requireOwnChild, req);
  assert.equal(nextCalled, false);
  assert.equal(res._status, 403);
});

test("requireOwnChild: parent with no linked child rejected", () => {
  const req = { user: { role: "parent" }, params: {}, query: {}, body: {} };
  const { nextCalled, res } = run(requireOwnChild, req);
  assert.equal(nextCalled, false);
  assert.equal(res._status, 403);
});

// ── Full route-chain harness (skips `authenticate`, which needs a real token) ──

function findRouteLayer(router, path, method) {
  return router.stack.find(l => l.route && l.route.path === path && l.route.methods[method]);
}

async function runProtectedChain(layer, req) {
  const res = mockRes();
  const handles = layer.route.stack.map(l => l.handle).slice(1); // [0] is `authenticate`, skipped -- req.user is pre-set
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

// ── GET /api/parent/journey: the actual ownership fix, end-to-end ──────

test("Route chain: parent's own journey ignores a forged childId in the query string", async () => {
  const journeySvc = require("../services/journeyService");
  const origGetForStudent = journeySvc.getForStudent;
  let seenStudentId = null;
  journeySvc.getForStudent = async ({ studentId }) => { seenStudentId = studentId; return []; };

  const journeyRoutes = require("../routes/journeyRoutes");
  const layer = findRouteLayer(journeyRoutes, "/api/parent/journey", "get");
  assert.ok(layer, "route must still be registered");

  const req = {
    user:  { role: "parent", schoolId: "school-A", student: { studentId: "YD001" } },
    query: { childId: "YD999" }, // forged -- belongs to a different child entirely
    params: {}, body: {},
  };
  const res = await runProtectedChain(layer, req);

  assert.equal(res._status, 200);
  assert.equal(seenStudentId, "YD001", "must query using the linked child, never the client-supplied childId");

  journeySvc.getForStudent = origGetForStudent;
});

test("Route chain: staff cannot use the parent-facing journey route at all", async () => {
  const journeyRoutes = require("../routes/journeyRoutes");
  const layer = findRouteLayer(journeyRoutes, "/api/parent/journey", "get");

  const req = { user: { role: "teacher", schoolId: "school-A" }, query: {}, params: {}, body: {} };
  const res = await runProtectedChain(layer, req);

  assert.equal(res._status, 403);
});

test("Route chain: 'unknown' role blocked before ever reaching requireOwnChild", async () => {
  const journeyRoutes = require("../routes/journeyRoutes");
  const layer = findRouteLayer(journeyRoutes, "/api/parent/journey", "get");

  const req = { user: { role: "unknown" }, query: { childId: "YD001" }, params: {}, body: {} };
  const res = await runProtectedChain(layer, req);

  assert.equal(res._status, 403);
});

// ── Staff-side routes: parents must no longer be able to reach these ───

test("Route chain: POST /api/journey rejects a parent (previously reachable)", async () => {
  const journeyRoutes = require("../routes/journeyRoutes");
  const layer = findRouteLayer(journeyRoutes, "/api/journey", "post");
  assert.ok(layer);

  const req = { user: { role: "parent", schoolId: "school-A" }, body: {}, query: {}, params: {} };
  const res = await runProtectedChain(layer, req);

  assert.equal(res._status, 403);
});

test("Route chain: GET /api/journey (unfiltered staff view) rejects a parent", async () => {
  const journeyRoutes = require("../routes/journeyRoutes");
  const layer = findRouteLayer(journeyRoutes, "/api/journey", "get");

  const req = { user: { role: "parent", schoolId: "school-A" }, query: {}, params: {}, body: {} };
  const res = await runProtectedChain(layer, req);

  assert.equal(res._status, 403);
});

test("Route chain: GET /api/journey allows staff and returns entries", async () => {
  const journeySvc = require("../services/journeyService");
  const origGetForStaff = journeySvc.getForStaff;
  journeySvc.getForStaff = async () => [{ id: "J-1", kind: "observation" }];

  const journeyRoutes = require("../routes/journeyRoutes");
  const layer = findRouteLayer(journeyRoutes, "/api/journey", "get");

  const req = { user: { role: "teacher", schoolId: "school-A" }, query: {}, params: {}, body: {} };
  const res = await runProtectedChain(layer, req);

  assert.equal(res._status, 200);
  assert.equal(res.body.entries.length, 1);

  journeySvc.getForStaff = origGetForStaff;
});

test("Route chain: PUT /api/journey/:id rejects a parent", async () => {
  const journeyRoutes = require("../routes/journeyRoutes");
  const layer = findRouteLayer(journeyRoutes, "/api/journey/:id", "put");

  const req = { user: { role: "parent", schoolId: "school-A" }, params: { id: "J-1" }, body: {}, query: {} };
  const res = await runProtectedChain(layer, req);

  assert.equal(res._status, 403);
});

test("Route chain: DELETE /api/journey/:id rejects a parent", async () => {
  const journeyRoutes = require("../routes/journeyRoutes");
  const layer = findRouteLayer(journeyRoutes, "/api/journey/:id", "delete");

  const req = { user: { role: "parent", schoolId: "school-A" }, params: { id: "J-1" }, body: {}, query: {} };
  const res = await runProtectedChain(layer, req);

  assert.equal(res._status, 403);
});

test("Route chain: POST /api/milestones rejects a parent", async () => {
  const journeyRoutes = require("../routes/journeyRoutes");
  const layer = findRouteLayer(journeyRoutes, "/api/milestones", "post");

  const req = { user: { role: "parent", schoolId: "school-A" }, body: {}, query: {}, params: {} };
  const res = await runProtectedChain(layer, req);

  assert.equal(res._status, 403);
});

test("Route chain: POST /api/milestones/check rejects a parent", async () => {
  const journeyRoutes = require("../routes/journeyRoutes");
  const layer = findRouteLayer(journeyRoutes, "/api/milestones/check", "post");

  const req = { user: { role: "parent", schoolId: "school-A" }, body: { studentId: "YD001" }, query: {}, params: {} };
  const res = await runProtectedChain(layer, req);

  assert.equal(res._status, 403);
});

test("Route chain: POST /api/milestones allows staff", async () => {
  const milestoneSvc = require("../services/milestoneService");
  const origCreate = milestoneSvc.createTeacherMilestone;
  milestoneSvc.createTeacherMilestone = async () => ({ id: "M-1", title: "First steps" });

  const journeyRoutes = require("../routes/journeyRoutes");
  const layer = findRouteLayer(journeyRoutes, "/api/milestones", "post");

  const req = { user: { role: "teacher", schoolId: "school-A" }, body: { studentId: "YD001", title: "First steps" }, query: {}, params: {} };
  const res = await runProtectedChain(layer, req);

  assert.equal(res._status, 201);
  assert.equal(res.body.entry.id, "M-1");

  milestoneSvc.createTeacherMilestone = origCreate;
});
