/**
 * cctvController.js — CCTV V2 Phase 1 (camera metadata management)
 *
 * GET    /api/cctv/cameras         → list cameras (optional ?classroom=)
 * GET    /api/cctv/cameras/:id     → single camera
 * POST   /api/cctv/cameras         → add camera
 * PUT    /api/cctv/cameras/:id     → update camera (partial merge)
 * DELETE /api/cctv/cameras/:id     → delete camera
 * POST   /api/cctv/cameras/test    → TCP reachability test (no streaming)
 *
 * Accepts camelCase and snake_case in request bodies. Passwords are never
 * returned to the client (masked). No streaming logic lives here.
 */

const svc       = require("../services/cctvService");
const testSvc   = require("../services/cameraTestService");
const verifySvc = require("../services/cameraVerifyService");
const resolver  = require("../services/cctvAccessResolver");
const session   = require("../services/streamSessionService");
const securitySvc   = require("../services/securityService");
const studentSvc    = require("../services/studentService");
const parentSettings = require("../services/cctvParentSettingsService");

const DEFAULT_SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";

function resolveCtx(req) {
  return {
    schoolId:    req.user?.schoolId || DEFAULT_SCHOOL_ID,
    centerId:    req.user?.centerId || "",
    actorUserId: req.user?.userId   || "system",
  };
}

function logErr(route, e) { console.error(`[${route}]`, e.message); }

function pick(body, camel, snake) {
  const v = body[camel] !== undefined ? body[camel] : body[snake];
  return v !== undefined ? v : undefined;
}

// Strip the password before sending a camera to the client.
function mask(cam) {
  return { ...cam, password: cam.password ? "••••••••" : "" };
}

// ── GET /api/cctv/cameras ──────────────────────────────────────────
async function getCameras(req, res) {
  try {
    const { schoolId, centerId } = resolveCtx(req);
    const bypassCenter = ["developer", "super_admin", "admin"].includes(req.user?.role);
    const { classroom } = req.query;

    let cameras = await svc.getAll({
      schoolId,
      centerId: bypassCenter ? undefined : centerId,
    });
    if (classroom && classroom !== "All") {
      cameras = cameras.filter(c => c.classroom === classroom);
    }
    res.json(cameras.map(mask));
  } catch (e) {
    logErr("GET /api/cctv/cameras", e);
    res.status(500).json({ error: "Failed to fetch cameras.", details: e.message });
  }
}

// ── GET /api/cctv/cameras/:id ──────────────────────────────────────
async function getCamera(req, res) {
  try {
    const cam = await svc.getOne(req.params.id);
    if (!cam) return res.status(404).json({ success: false, message: "Camera not found." });
    res.json(mask(cam));
  } catch (e) {
    logErr("GET /api/cctv/cameras/:id", e);
    res.status(500).json({ success: false, error: e.message });
  }
}

// ── POST /api/cctv/cameras ─────────────────────────────────────────
async function addCamera(req, res) {
  try {
    const { schoolId, centerId, actorUserId } = resolveCtx(req);
    const body = req.body || {};

    const cameraName = pick(body, "cameraName", "camera_name")?.trim();
    const cameraCode = pick(body, "cameraCode", "camera_code")?.trim();
    const classroom  = pick(body, "classroom",  "classroom")?.trim();
    const streamUrl  = pick(body, "streamUrl",  "stream_url")?.trim();
    const classrooms = Array.isArray(body.classrooms) ? body.classrooms : undefined;

    if (!cameraName) return res.status(400).json({ success: false, message: "cameraName is required." });
    if (!classroom && !(classrooms && classrooms.length))
      return res.status(400).json({ success: false, message: "classroom is required." });
    if (!streamUrl)  return res.status(400).json({ success: false, message: "streamUrl is required." });

    const camera = await svc.create(
      {
        cameraCode,
        cameraName,
        classroom,
        classrooms,
        brand:      pick(body, "brand",      "brand")      || "Other",
        ip:         pick(body, "ip",         "ip")         || "",
        port:       String(pick(body, "port", "port")      || "554"),
        streamUrl,
        username:   pick(body, "username",   "username")   || "",
        password:   pick(body, "password",   "password")   || "",
        channel:    String(pick(body, "channel", "channel") || "1"),
        streamType: pick(body, "streamType", "stream_type") || "RTSP",
        status:     pick(body, "status",     "status")     || "Active",
      },
      { schoolId, centerId, actorUserId }
    );

    res.json({ success: true, message: "Camera added.", id: camera.cameraId, camera: mask(camera) });
  } catch (e) {
    if (e.code === "DUPLICATE_CAMERA_CODE") {
      return res.status(409).json({ success: false, error: e.message });
    }
    logErr("POST /api/cctv/cameras", e);
    res.status(500).json({ success: false, error: e.message });
  }
}

// ── PUT /api/cctv/cameras/:id ──────────────────────────────────────
async function updateCamera(req, res) {
  try {
    const { actorUserId } = resolveCtx(req);
    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, message: "Camera ID required." });

    const body = req.body || {};
    const updates = {};
    const set = (camel, snake) => {
      const v = pick(body, camel, snake);
      if (v !== undefined) updates[camel] = v;
    };
    set("cameraCode",  "camera_code");
    set("cameraName",  "camera_name");
    set("classroom",   "classroom");
    set("brand",       "brand");
    set("ip",          "ip");
    set("port",        "port");
    set("streamUrl",   "stream_url");
    set("username",    "username");
    set("channel",     "channel");
    set("streamType",  "stream_type");
    set("status",      "status");
    if (Array.isArray(body.classrooms)) updates.classrooms = body.classrooms;
    // Only overwrite the password when a non-empty value is supplied.
    if (body.password && body.password.trim() && body.password !== "••••••••") {
      updates.password = body.password.trim();
    }

    const camera = await svc.update(id, updates, { updatedBy: actorUserId });
    if (!camera) return res.status(404).json({ success: false, message: "Camera not found." });
    res.json({ success: true, message: "Camera updated.", camera: mask(camera) });
  } catch (e) {
    if (e.code === "DUPLICATE_CAMERA_CODE") {
      return res.status(409).json({ success: false, error: e.message });
    }
    logErr("PUT /api/cctv/cameras/:id", e);
    res.status(500).json({ success: false, error: e.message });
  }
}

// ── DELETE /api/cctv/cameras/:id ───────────────────────────────────
async function deleteCamera(req, res) {
  try {
    const { actorUserId } = resolveCtx(req);
    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, message: "Camera ID required." });
    const deleted = await svc.remove(id, { actorUserId });   // soft delete
    if (!deleted) return res.status(404).json({ success: false, message: "Camera not found." });
    res.json({ success: true, message: "Camera deleted." });
  } catch (e) {
    logErr("DELETE /api/cctv/cameras/:id", e);
    res.status(500).json({ success: false, error: e.message });
  }
}

// ── POST /api/cctv/cameras/test ────────────────────────────────────
// TCP reachability only — NO stream. Resolution order (prefer structured fields):
//   1. explicit { ip, port } in the body              (live form values)
//   2. { cameraId } → saved camera's ip/port          (preferred for records)
//   3. saved camera's streamUrl, or body.streamUrl    (legacy fallback)
async function testConnection(req, res) {
  try {
    const body = req.body || {};
    let ip   = (body.ip   || "").trim();
    let port = body.port != null ? String(body.port).trim() : "";
    let streamUrl = (body.streamUrl || body.stream_url || "").trim();

    // If a cameraId is given and no explicit ip, pull structured fields from the record.
    if (!ip && body.cameraId) {
      const cam = await svc.getOne(body.cameraId);
      if (!cam) return res.status(404).json({ success: false, message: "Camera not found." });
      ip   = (cam.ip   || "").trim();
      port = (cam.port || "").trim() || port;
      if (!streamUrl) streamUrl = cam.streamUrl || "";
    }

    let result;
    if (ip) {
      // Preferred: test the saved/structured IP + port.
      result = await testSvc.testHostPort(ip, port || 554);
    } else if (streamUrl) {
      // Legacy fallback: parse host:port out of the stored URL.
      result = await testSvc.testConnection(streamUrl);
    } else {
      return res.status(400).json({ success: false, message: "Provide ip (+port), cameraId, or streamUrl." });
    }

    res.json({
      success: true,
      reachable: result.reachable,
      message: result.message,
      host: result.host || null,
      port: result.port || null,
      ms: result.ms || null,
      source: result.source || null,   // "ip-port" | "stream-url" — which path was tested
      note: "Network Reachability Test Only — does not verify camera credentials or video stream.",
    });
  } catch (e) {
    logErr("POST /api/cctv/cameras/test", e);
    res.status(500).json({ success: false, error: e.message });
  }
}

// ── POST /api/cctv/cameras/verify ──────────────────────────────────
// REAL camera verification: TCP + RTSP auth + channel + stream (via ffmpeg).
// Body: { cameraId } (preferred — uses stored+decrypted creds) OR an inline
// camera object { brand, ip, port, channel, username, password, streamUrl }.
async function verifyCamera(req, res) {
  try {
    const body = req.body || {};
    let cam;
    if (body.cameraId) {
      cam = await svc.getOneWithSecret(body.cameraId); // decrypted password, server-side only
      if (!cam) return res.status(404).json({ success: false, message: "Camera not found." });
    } else {
      cam = {
        brand:    body.brand,    ip:       body.ip,       port:     body.port,
        channel:  body.channel,  username: body.username, password: body.password,
        streamUrl: body.streamUrl || body.stream_url,
      };
    }

    const result = await verifySvc.verifyCamera(cam);
    // result.checks + message are safe; never echo the password or auth URL.
    res.json({ success: true, ...result });
  } catch (e) {
    logErr("POST /api/cctv/cameras/verify", e);
    res.status(500).json({ success: false, error: e.message });
  }
}

// ── POST /api/cctv/cameras/:id/live-token ──────────────────────────
// Staff Live View. Authz via cctvAccessResolver (role + classroom scope).
// Returns engine HLS/WebRTC URL + short-lived token. NEVER returns RTSP/creds.
async function liveToken(req, res) {
  const nowMs = Date.now();
  const nowISO = new Date(nowMs).toISOString();
  try {
    const user = req.user || {};
    const cam = await svc.getOne(req.params.id);   // masked (no password)
    if (!cam || cam.deleted) return res.status(404).json({ success: false, message: "Camera not found." });

    const decision = resolver.canViewCamera(
      { role: user.role, centerId: user.centerId, classrooms: user.classrooms || [] },
      cam
    );
    if (!decision.allowed) {
      await session.audit("LIVE_VIEW_DENIED", {
        userId: user.userId, role: user.role, cameraId: cam.cameraId,
        classroom: cam.classroom, centerId: cam.centerId, ip: req.ip,
      }, nowISO);
      return res.status(403).json({ success: false, error: "Not authorized to view this camera.", reason: decision.reason });
    }

    const engine = process.env.CCTV_STREAM_ENGINE_URL;
    if (!engine) {
      return res.status(503).json({ success: false, error: "ENGINE_NOT_PROVISIONED",
        message: "Live stream engine is not configured yet." });
    }

    const t = session.issueToken({
      subjectId: user.userId, kind: "staff", cameraId: cam.cameraId,
      mediaMtxPath: cam.mediaMtxPath, centerId: cam.centerId, classroom: cam.classroom,
    }, nowMs);

    await session.audit("LIVE_VIEW_STARTED", {
      userId: user.userId, role: user.role, kind: "staff", cameraId: cam.cameraId,
      classroom: cam.classroom, centerId: cam.centerId, sessionId: t.sessionId, ip: req.ip,
    }, nowISO);

    const base = engine.replace(/\/+$/, "");
    res.json({
      success: true,
      cameraId: cam.cameraId,
      protocol: "hls",
      hlsUrl:    `${base}/${cam.mediaMtxPath}/index.m3u8`,
      webrtcUrl: `${base}/${cam.mediaMtxPath}/whep`,
      token: t.token,
      expiresIn: t.expiresIn,
      sessionId: t.sessionId,
    });
  } catch (e) {
    logErr("POST /api/cctv/cameras/:id/live-token", e);
    res.status(500).json({ success: false, error: e.message });
  }
}

// ── POST /api/cctv/cameras/:id/live-stop ───────────────────────────
async function liveStop(req, res) {
  const nowISO = new Date().toISOString();
  try {
    const user = req.user || {};
    await session.audit("LIVE_VIEW_STOPPED", {
      userId: user.userId, role: user.role, cameraId: req.params.id,
      sessionId: req.body?.sessionId || "", ip: req.ip,
    }, nowISO);
    res.json({ success: true, stopped: true });
  } catch (e) {
    logErr("POST /api/cctv/cameras/:id/live-stop", e);
    res.status(500).json({ success: false, error: e.message });
  }
}

// ── POST /internal/cctv/auth ───────────────────────────────────────
// MediaMTX auth hook. Validates the stream token against the requested path.
// Not behind staff auth (the media server calls it) — it validates the token.
async function streamAuthHook(req, res) {
  const nowMs = Date.now();
  try {
    const body = req.body || {};
    // MediaMTX posts { path, query, ... }; token passed as ?token= in the query.
    const path = body.path || "";
    const token = body.token || (body.query && /(?:^|&)token=([^&]+)/.exec(body.query)?.[1]) || "";
    const result = session.verifyToken(token, path, nowMs);
    if (!result.valid) return res.status(401).json({ error: result.reason });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(401).json({ error: "auth-error" });
  }
}

// ── POST /api/cctv/parent/live-token ───────────────────────────────
// Parent Live View. Guards: parent↔child link · school-hours window ·
// child CHECKED_IN today · camera ∈ child's classroom. Presence re-checked
// on every (short-lived) token, so access auto-revokes ~2 min after checkout.
async function parentLiveToken(req, res) {
  const nowMs = Date.now();
  const nowISO = new Date(nowMs).toISOString();
  const user = req.user || {};
  const auditDeny = (reason, childId) => session.audit("LIVE_VIEW_DENIED", {
    userId: user.userId, role: "parent", kind: "parent", cameraId: req.body?.cameraId || "",
    childId: childId || "", ip: req.ip,
  }, nowISO);

  try {
    if (user.role !== "parent") {
      return res.status(403).json({ success: false, error: "Parent endpoint only." });
    }
    const linkedId = user.student?.studentId;
    if (!linkedId) { await auditDeny("not-linked"); return res.status(403).json({ success: false, error: "No student linked to this account.", reason: "not-linked" }); }

    // School-hours / master switch
    const window = await parentSettings.isParentViewingOpen();
    if (!window.open) {
      await auditDeny(window.reason, linkedId);
      return res.status(403).json({ success: false, error: "Live viewing is not available right now.", reason: window.reason });
    }

    // Resolve child + presence
    const child = await studentSvc.getOne(linkedId);
    if (!child) { await auditDeny("child-missing", linkedId); return res.status(404).json({ success: false, error: "Linked student not found." }); }
    const childCtx = { studentId: linkedId, classroom: child.class || child.Class || "", centerId: child.centerId || child.center || "" };
    const presence = await securitySvc.getChildStatus(linkedId, { schoolId: child.schoolId, centerId: childCtx.centerId });

    // Resolve target camera (explicit cameraId, else first camera in child's classroom)
    let cam;
    if (req.body?.cameraId) {
      cam = await svc.getOne(req.body.cameraId);
    } else {
      const all = await svc.getAll({ schoolId: child.schoolId, centerId: childCtx.centerId });
      cam = all.find(c => (c.classrooms || [c.classroom]).map(x => (x||"").toLowerCase()).includes((childCtx.classroom||"").toLowerCase()));
    }
    if (!cam || cam.deleted) { await auditDeny("no-camera", linkedId); return res.status(404).json({ success: false, error: "No camera available for your child's classroom." }); }

    const decision = resolver.canParentViewCamera(childCtx, presence, cam, { schoolHoursOpen: window.open });
    if (!decision.allowed) {
      await auditDeny(decision.reason, linkedId);
      const msg = decision.reason === "child-not-present" ? "Your child has not checked in yet."
                : decision.reason === "child-checked-out" ? "Your child has checked out for today."
                : "Live view is not available for your child right now.";
      return res.status(403).json({ success: false, error: msg, reason: decision.reason });
    }

    const engine = process.env.CCTV_STREAM_ENGINE_URL;
    if (!engine) return res.status(503).json({ success: false, error: "ENGINE_NOT_PROVISIONED", message: "Live streaming is not enabled yet." });

    const t = session.issueToken({
      subjectId: user.userId, kind: "parent", cameraId: cam.cameraId,
      mediaMtxPath: cam.mediaMtxPath, centerId: cam.centerId, classroom: cam.classroom, childId: linkedId,
    }, nowMs);
    await session.audit("LIVE_VIEW_STARTED", {
      userId: user.userId, role: "parent", kind: "parent", cameraId: cam.cameraId,
      classroom: cam.classroom, centerId: cam.centerId, childId: linkedId, sessionId: t.sessionId, ip: req.ip,
    }, nowISO);

    const base = engine.replace(/\/+$/, "");
    res.json({
      success: true, cameraId: cam.cameraId, classroom: cam.classroom, protocol: "hls",
      hlsUrl: `${base}/${cam.mediaMtxPath}/index.m3u8`, webrtcUrl: `${base}/${cam.mediaMtxPath}/whep`,
      token: t.token, expiresIn: t.expiresIn, sessionId: t.sessionId,
    });
  } catch (e) {
    logErr("POST /api/cctv/parent/live-token", e);
    res.status(500).json({ success: false, error: e.message });
  }
}

// ── GET/PUT /api/cctv/parent/settings (admin) ──────────────────────
async function getParentSettings(req, res) {
  try { res.json({ success: true, settings: await parentSettings.getSettings() }); }
  catch (e) { logErr("GET /api/cctv/parent/settings", e); res.status(500).json({ success: false, error: e.message }); }
}
async function updateParentSettings(req, res) {
  try {
    const saved = await parentSettings.saveSettings(req.body || {}, req.user?.userId || "system");
    res.json({ success: true, settings: saved });
  } catch (e) { logErr("PUT /api/cctv/parent/settings", e); res.status(500).json({ success: false, error: e.message }); }
}

module.exports = {
  getCameras,
  getCamera,
  verifyCamera,
  liveToken,
  liveStop,
  streamAuthHook,
  parentLiveToken,
  getParentSettings,
  updateParentSettings,
  addCamera,
  updateCamera,
  deleteCamera,
  testConnection,
};
