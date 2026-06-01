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

const svc      = require("../services/cctvService");
const testSvc  = require("../services/cameraTestService");

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

module.exports = {
  getCameras,
  getCamera,
  addCamera,
  updateCamera,
  deleteCamera,
  testConnection,
};
