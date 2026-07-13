/**
 * Milestone 11 — CCTV credential protection (Critical C8).
 * Covers: parsing credentials out of a custom RTSP streamUrl at write time
 * (create/update), and mask() scrubbing password + any embedded/derived
 * stream URL credentials before a camera is ever sent to a client.
 */
const test = require("node:test");
const assert = require("node:assert");
const { makeFakeFirestore } = require("../test-helpers/_fakeFirestore");

const fake = makeFakeFirestore();
const fbPath = require.resolve("../firebaseAdmin");
require.cache[fbPath] = { id: fbPath, filename: fbPath, loaded: true, exports: { db: fake.db, auth: {} } };

const cctvService = require("../services/cctvService");

// ── extractUrlCredentials: pure parsing logic ───────────────────────

test("extractUrlCredentials: parses a URL with embedded user:pass", () => {
  const r = cctvService.extractUrlCredentials("rtsp://admin:s3cr3t@192.168.1.5:554/stream1");
  assert.equal(r.cleanUrl, "rtsp://192.168.1.5:554/stream1");
  assert.equal(r.username, "admin");
  assert.equal(r.password, "s3cr3t");
});

test("extractUrlCredentials: a plain URL with no credentials is untouched", () => {
  const r = cctvService.extractUrlCredentials("rtsp://192.168.1.5:554/stream1");
  assert.equal(r.cleanUrl, "rtsp://192.168.1.5:554/stream1");
  assert.equal(r.username, "");
  assert.equal(r.password, "");
});

test("extractUrlCredentials: empty/undefined input never throws", () => {
  assert.deepEqual(cctvService.extractUrlCredentials(""), { cleanUrl: "", username: "", password: "" });
  assert.deepEqual(cctvService.extractUrlCredentials(undefined), { cleanUrl: "", username: "", password: "" });
});

test("extractUrlCredentials: handles http(s) scheme URLs too, not just rtsp", () => {
  const r = cctvService.extractUrlCredentials("http://viewer:pw123@10.0.0.9/onvif");
  assert.equal(r.cleanUrl, "http://10.0.0.9/onvif");
  assert.equal(r.username, "viewer");
  assert.equal(r.password, "pw123");
});

// ── create(): embedded credentials never persisted in streamUrl ────

test("create(): a streamUrl with embedded credentials is stored credential-free, username/password extracted", async () => {
  const cam = await cctvService.create(
    { cameraName: "Test Cam", classroom: "Room 1", streamUrl: "rtsp://admin:hunter2@10.1.1.1:554/ch1" },
    { schoolId: "school-A" }
  );
  assert.equal(cam.streamUrl, "rtsp://10.1.1.1:554/ch1", "stored streamUrl must never contain credentials");
  assert.equal(cam.username, "admin");
  // password is encrypted (or plaintext-with-warning if no key) by encPassword() -- either way,
  // it must not equal the embedded plaintext AND the raw stored value should decrypt back to it.
  const withSecret = await cctvService.getOneWithSecret(cam.cameraId);
  assert.equal(withSecret.password, "hunter2", "the original password must round-trip through storage correctly");
});

test("create(): explicit username/password fields win over anything embedded in the URL", async () => {
  const cam = await cctvService.create(
    {
      cameraName: "Test Cam 2", classroom: "Room 1",
      streamUrl: "rtsp://embedded:embeddedpw@10.1.1.2:554/ch1",
      username: "explicit-user", password: "explicit-pass",
    },
    { schoolId: "school-A" }
  );
  assert.equal(cam.streamUrl, "rtsp://10.1.1.2:554/ch1");
  assert.equal(cam.username, "explicit-user");
  const withSecret = await cctvService.getOneWithSecret(cam.cameraId);
  assert.equal(withSecret.password, "explicit-pass");
});

test("create(): a plain streamUrl with no embedded credentials is stored as-is", async () => {
  const cam = await cctvService.create(
    { cameraName: "Test Cam 3", classroom: "Room 1", streamUrl: "rtsp://10.1.1.3:554/ch1" },
    { schoolId: "school-A" }
  );
  assert.equal(cam.streamUrl, "rtsp://10.1.1.3:554/ch1");
  assert.equal(cam.username, "");
});

// ── mask(): exercised via the real controller handler, not re-implemented ──

function mockRes() {
  return { _status: 200, status(c) { this._status = c; return this; }, json(b) { this.body = b; return this; } };
}

test("mask (via getCamera): scrubs password and embedded streamUrl credentials in the API response", async () => {
  const cctvSvc = require("../services/cctvService");
  const resolver = require("../services/cctvAccessResolver");
  const origGetOne = cctvSvc.getOne;
  const origCanView = resolver.canViewCamera;
  cctvSvc.getOne = async () => ({
    cameraId: "CAM-X", schoolId: "school-A", centerId: "", deleted: false,
    password: "realsecret",
    streamUrl: "rtsp://admin:realsecret@10.9.9.9:554/ch1",
    mainStreamUrl: "rtsp://admin:realsecret@10.9.9.9:554/Streaming/Channels/101",
    liveStreamUrl: "rtsp://10.9.9.9:554/Streaming/Channels/102",
  });
  resolver.canViewCamera = () => ({ allowed: true, reason: "bypass-role" });

  const cctvController = require("../controllers/cctvController");
  const req = { params: { id: "CAM-X" }, user: { role: "developer", schoolId: "school-A" } };
  const res = mockRes();
  await cctvController.getCamera(req, res);

  assert.equal(res._status, 200);
  const json = JSON.stringify(res.body);
  assert.ok(!json.includes("realsecret"), "the real password must never appear anywhere in the response, incl. embedded in URLs");
  assert.equal(res.body.password, "••••••••");
  assert.equal(res.body.streamUrl, "rtsp://admin:••••••••@10.9.9.9:554/ch1");
  assert.equal(res.body.mainStreamUrl, "rtsp://admin:••••••••@10.9.9.9:554/Streaming/Channels/101");
  assert.equal(res.body.liveStreamUrl, "rtsp://10.9.9.9:554/Streaming/Channels/102", "a URL with no embedded creds is left unchanged");

  cctvSvc.getOne = origGetOne;
  resolver.canViewCamera = origCanView;
});

test("mask (via getCamera): the snake_case stream_url alias is scrubbed too (regression -- docToCamera emits both)", async () => {
  const cctvSvc = require("../services/cctvService");
  const resolver = require("../services/cctvAccessResolver");
  const origGetOne = cctvSvc.getOne;
  const origCanView = resolver.canViewCamera;
  cctvSvc.getOne = async () => ({
    cameraId: "CAM-Z", schoolId: "school-A", centerId: "", deleted: false,
    password: "realsecret", streamUrl: "rtsp://admin:realsecret@10.9.9.9:554/ch1",
    stream_url: "rtsp://admin:realsecret@10.9.9.9:554/ch1", // snake_case alias, same raw value
  });
  resolver.canViewCamera = () => ({ allowed: true, reason: "bypass-role" });

  const cctvController = require("../controllers/cctvController");
  const req = { params: { id: "CAM-Z" }, user: { role: "developer", schoolId: "school-A" } };
  const res = mockRes();
  await cctvController.getCamera(req, res);

  assert.ok(!JSON.stringify(res.body).includes("realsecret"), "real password must not leak via the stream_url alias either");

  cctvSvc.getOne = origGetOne;
  resolver.canViewCamera = origCanView;
});

test("mask (via getCameras list): scrubs every camera in the list response", async () => {
  const cctvSvc = require("../services/cctvService");
  const resolver = require("../services/cctvAccessResolver");
  const origGetAll = cctvSvc.getAll;
  const origFilter = resolver.filterViewableCameras;
  cctvSvc.getAll = async () => ([
    { cameraId: "CAM-Y", schoolId: "school-A", password: "pw1", streamUrl: "rtsp://u:pw1@1.2.3.4/ch1" },
  ]);
  resolver.filterViewableCameras = (user, cams) => cams;

  const cctvController = require("../controllers/cctvController");
  const req = { user: { role: "admin", schoolId: "school-A", centerId: "" }, query: {} };
  const res = mockRes();
  await cctvController.getCameras(req, res);

  assert.equal(res._status, 200);
  const json = JSON.stringify(res.body);
  assert.ok(!json.includes("pw1"), "no camera's real password should leak in the list response");

  cctvSvc.getAll = origGetAll;
  resolver.filterViewableCameras = origFilter;
});
