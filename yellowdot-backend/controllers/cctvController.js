/**
 * cctvController.js — Firestore-backed
 *
 * GET    /api/cctv/cameras         → list cameras (optional ?classroom=)
 * POST   /api/cctv/cameras         → add camera
 * PUT    /api/cctv/cameras/:id     → update camera (partial merge)
 * DELETE /api/cctv/cameras/:id     → delete camera
 *
 * Accepts both camelCase and snake_case in request bodies.
 */

const svc = require("../services/cctvService");

const DEFAULT_SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";

function resolveCtx(req) {
  return {
    schoolId:    req.user?.schoolId  || DEFAULT_SCHOOL_ID,
    centerId:    req.user?.centerId  || "",
    actorUserId: req.user?.userId    || "system",
  };
}

function logErr(route, e) { console.error(`[${route}] Error:`, e.message); }

// Accept either camelCase or snake_case body field
function pick(body, camel, snake) {
  const v = body[camel] !== undefined ? body[camel] : body[snake];
  return v !== undefined ? v : undefined;
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

    // Mask passwords
    const safe = cameras.map(c => ({ ...c, password: c.password ? "••••••••" : "" }));
    res.json(safe);
  } catch (e) {
    logErr("GET /api/cctv/cameras", e);
    res.status(500).json({ error: "Failed to fetch cameras.", details: e.message });
  }
}

// ── POST /api/cctv/cameras ─────────────────────────────────────────

async function addCamera(req, res) {
  try {
    const { schoolId, centerId, actorUserId } = resolveCtx(req);
    const body = req.body || {};

    const cameraName = pick(body, "cameraName", "camera_name")?.trim();
    const classroom  = pick(body, "classroom",  "classroom")?.trim();
    const streamUrl  = pick(body, "streamUrl",  "stream_url")?.trim();

    if (!cameraName) return res.status(400).json({ success: false, message: "cameraName is required." });
    if (!classroom)  return res.status(400).json({ success: false, message: "classroom is required." });
    if (!streamUrl)  return res.status(400).json({ success: false, message: "streamUrl is required." });

    const camera = await svc.create(
      {
        cameraName,
        classroom,
        brand:      pick(body, "brand",      "brand")      || "Other",
        streamUrl,
        username:   pick(body, "username",   "username")   || "",
        password:   pick(body, "password",   "password")   || "",
        channel:    String(pick(body, "channel", "channel") || "1"),
        streamType: pick(body, "streamType", "stream_type") || "RTSP",
      },
      { schoolId, centerId, actorUserId }
    );

    res.json({ success: true, message: "Camera added.", camera_id: camera.cameraId, id: camera.cameraId, camera });
  } catch (e) {
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

    set("cameraName",  "camera_name");
    set("classroom",   "classroom");
    set("brand",       "brand");
    set("streamUrl",   "stream_url");
    set("username",    "username");
    set("streamType",  "stream_type");
    set("status",      "status");
    set("channel",     "channel");
    if (body.password?.trim()) updates.password = body.password.trim();

    const camera = await svc.update(id, updates, { updatedBy: actorUserId });
    if (!camera) return res.status(404).json({ success: false, message: "Camera not found." });

    res.json({ success: true, message: "Camera updated.", camera: { ...camera, password: camera.password ? "••••••••" : "" } });
  } catch (e) {
    logErr("PUT /api/cctv/cameras/:id", e);
    res.status(500).json({ success: false, error: e.message });
  }
}

// ── DELETE /api/cctv/cameras/:id ──────────────────────────────────

async function deleteCamera(req, res) {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, message: "Camera ID required." });

    const deleted = await svc.remove(id);
    if (!deleted) return res.status(404).json({ success: false, message: "Camera not found." });

    res.json({ success: true, message: "Camera deleted." });
  } catch (e) {
    logErr("DELETE /api/cctv/cameras/:id", e);
    res.status(500).json({ success: false, error: e.message });
  }
}

module.exports = { getCameras, addCamera, updateCamera, deleteCamera };
