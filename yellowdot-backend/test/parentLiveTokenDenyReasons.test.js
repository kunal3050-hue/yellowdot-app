/**
 * POST /api/cctv/parent/live-token — every denial must be self-describing.
 *
 * The parent Live View client decides whether to retry or to stop and show a
 * message based on `reason` in the response body. Several deny paths used to
 * omit it entirely (503 engine, 404 no-camera, 404 child-missing, 500), so the
 * client fell through to its retry branch and span on "Reconnecting…" forever
 * with the real cause discarded. And `auditDeny` accepted a reason it never
 * wrote, so cctvAuditLogs recorded LIVE_VIEW_DENIED rows with no cause on them
 * — the denial was invisible from both ends at once.
 *
 * These tests pin both halves: the response carries a reason, and the audit
 * entry records the same one.
 */
const test   = require("node:test");
const assert = require("node:assert");

// ── Stub every dependency before the controller loads them ───────────────────
const stub = (path, exports) => {
  const p = require.resolve(path);
  require.cache[p] = { id: p, filename: p, loaded: true, exports };
};

const audits = [];

stub("../firebaseAdmin", { db: { collection: () => ({}) }, auth: {} });
stub("../services/cameraTestService", {});
stub("../services/cameraVerifyService", {});
stub("../middleware/tenantRecordAccess", { checkTenantAccess: () => ({ allowed: true }) });
stub("../services/streamSessionService", {
  audit: async (event, payload) => { audits.push({ event, ...payload }); },
  issueToken: () => ({ token: "t", expiresIn: 120, sessionId: "s1" }),
});

// Mutable stubs — each test sets the behaviour it needs.
const state = {
  viewingOpen: { open: true, reason: "within-hours" },
  child:       { studentId: "YD001", class: "Daycare", centerId: "c1", schoolId: "sch1" },
  presence:    { status: "PRESENT" },
  camera:      { cameraId: "cam-07", cameraName: "CAm 07", mediaMtxPath: "cam07", classroom: "Daycare", classrooms: ["Daycare"], centerId: "c1", schoolId: "sch1" },
  decision:    { allowed: true, reason: "present-and-classroom-match" },
};

stub("../services/cctvParentSettingsService", { isParentViewingOpen: async () => state.viewingOpen });
stub("../services/studentService",  { getOne: async () => state.child });
stub("../services/securityService", { getChildStatus: async () => state.presence });
stub("../services/cctvService",     { getOne: async () => state.camera, getAll: async () => [state.camera] });
stub("../services/cctvAccessResolver", {
  canParentViewCamera: () => state.decision,
  getActiveTimelineEntry: () => null,
});

const { parentLiveToken } = require("../controllers/cctvController");

// ── Harness ──────────────────────────────────────────────────────────────────
function mockRes() {
  return { _status: 200, status(c) { this._status = c; return this; }, json(b) { this.body = b; return this; } };
}

const PARENT = { role: "parent", userId: "uid-parent", name: "Meera", email: "meera@example.com", student: { studentId: "YD001" } };

async function call({ user = PARENT, body = { cameraId: "cam-07" } } = {}) {
  audits.length = 0;
  const res = mockRes();
  await parentLiveToken({ user, body, ip: "1.2.3.4" }, res);
  return res;
}

/** Reset to the all-green baseline before each case. */
function baseline() {
  state.viewingOpen = { open: true, reason: "within-hours" };
  state.child       = { studentId: "YD001", class: "Daycare", centerId: "c1", schoolId: "sch1" };
  state.presence    = { status: "PRESENT" };
  state.camera      = { cameraId: "cam-07", cameraName: "CAm 07", mediaMtxPath: "cam07", classroom: "Daycare", classrooms: ["Daycare"], centerId: "c1", schoolId: "sch1" };
  state.decision    = { allowed: true, reason: "present-and-classroom-match" };
  delete process.env.CCTV_STREAM_ENGINE_URL;
}

const deniedAudit = () => audits.find(a => a.event === "LIVE_VIEW_DENIED");

// ── Every denial carries a reason ────────────────────────────────────────────

test("503 engine not provisioned carries reason + is audited", async () => {
  baseline();                       // CCTV_STREAM_ENGINE_URL deliberately unset
  const res = await call();

  assert.equal(res._status, 503);
  assert.equal(res.body.reason, "engine-not-provisioned");
  assert.equal(res.body.error, "ENGINE_NOT_PROVISIONED", "existing error code preserved");
  assert.equal(deniedAudit()?.reason, "engine-not-provisioned");
});

test("404 no camera for the classroom carries reason", async () => {
  baseline();
  process.env.CCTV_STREAM_ENGINE_URL = "https://stream.example.com";
  state.camera = null;
  const res = await call();

  assert.equal(res._status, 404);
  assert.equal(res.body.reason, "no-camera");
  assert.equal(deniedAudit()?.reason, "no-camera");
});

test("404 linked student not found carries reason", async () => {
  baseline();
  process.env.CCTV_STREAM_ENGINE_URL = "https://stream.example.com";
  state.child = null;
  const res = await call();

  assert.equal(res._status, 404);
  assert.equal(res.body.reason, "child-missing");
  assert.equal(deniedAudit()?.reason, "child-missing");
});

test("403 non-parent role carries reason", async () => {
  baseline();
  const res = await call({ user: { ...PARENT, role: "teacher" } });

  assert.equal(res._status, 403);
  assert.equal(res.body.reason, "not-parent");
});

test("403 no linked student carries reason", async () => {
  baseline();
  const res = await call({ user: { ...PARENT, student: undefined } });

  assert.equal(res._status, 403);
  assert.equal(res.body.reason, "not-linked");
  assert.equal(deniedAudit()?.reason, "not-linked");
});

test("500 carries a reason instead of a bare message", async () => {
  baseline();
  process.env.CCTV_STREAM_ENGINE_URL = "https://stream.example.com";
  state.presence = null;
  const boom = new Error("firestore exploded");
  const svcPath = require.resolve("../services/securityService");
  require.cache[svcPath].exports.getChildStatus = async () => { throw boom; };

  const res = await call();
  require.cache[svcPath].exports.getChildStatus = async () => state.presence;

  assert.equal(res._status, 500);
  assert.equal(res.body.reason, "server-error");
});

// ── The resolver's own reasons reach the client verbatim ─────────────────────
// no-active-slot is the case that motivated this: friendlyError and a dedicated
// UI hint both existed for it, and neither could ever render.

for (const reason of [
  "no-active-slot", "not-child-classroom", "different-center",
  "different-school", "camera-unavailable", "child-not-present", "child-checked-out",
]) {
  test(`403 resolver denial "${reason}" reaches the client and the audit log`, async () => {
    baseline();
    process.env.CCTV_STREAM_ENGINE_URL = "https://stream.example.com";
    state.decision = { allowed: false, reason };

    const res = await call();

    assert.equal(res._status, 403);
    assert.equal(res.body.reason, reason);
    assert.equal(deniedAudit()?.reason, reason);
  });
}

// ── School-hours / master-switch denial ──────────────────────────────────────

test("403 outside school hours carries the window reason", async () => {
  baseline();
  state.viewingOpen = { open: false, reason: "outside-school-hours" };
  const res = await call();

  assert.equal(res._status, 403);
  assert.equal(res.body.reason, "outside-school-hours");
  assert.equal(deniedAudit()?.reason, "outside-school-hours");
});

test("403 parent CCTV disabled carries the window reason", async () => {
  baseline();
  state.viewingOpen = { open: false, reason: "parent-cctv-disabled" };
  const res = await call();

  assert.equal(res._status, 403);
  assert.equal(res.body.reason, "parent-cctv-disabled");
  assert.equal(deniedAudit()?.reason, "parent-cctv-disabled");
});

// ── No denial path may return a body without a reason ────────────────────────

test("EVERY non-2xx response from parentLiveToken carries a reason", async () => {
  const scenarios = [
    ["engine unset",    () => { /* baseline leaves it unset */ }],
    ["no camera",       () => { state.camera = null; }],
    ["no child",        () => { state.child = null; }],
    ["window closed",   () => { state.viewingOpen = { open: false, reason: "parent-cctv-disabled" }; }],
    ["resolver denies", () => { state.decision = { allowed: false, reason: "no-active-slot" }; }],
  ];

  for (const [label, mutate] of scenarios) {
    baseline();
    if (label !== "engine unset") process.env.CCTV_STREAM_ENGINE_URL = "https://stream.example.com";
    mutate();
    const res = await call();

    assert.ok(res._status >= 400, `${label}: expected a failure status`);
    assert.ok(res.body.reason, `${label}: response body is missing "reason"`);
  }
});

// ── The success path is unchanged ────────────────────────────────────────────

test("success path still returns hlsUrl, token and sessionId", async () => {
  baseline();
  process.env.CCTV_STREAM_ENGINE_URL = "https://stream.example.com";
  const res = await call();

  assert.equal(res._status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.hlsUrl, "https://stream.example.com/cam07/index.m3u8");
  assert.equal(res.body.token, "t");
  assert.equal(res.body.sessionId, "s1");
  assert.equal(deniedAudit(), undefined, "no denial audited on success");
  assert.ok(audits.some(a => a.event === "LIVE_VIEW_STARTED"));
});
