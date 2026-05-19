/**
 * streamController.js
 *
 * GET  /api/stream/status?cameraId=  — status for one camera (or all)
 * POST /api/stream/start             — start stream by cameraId OR direct rtspUrl
 * POST /api/stream/stop              — stop stream (by cameraId, or all)
 */

const streamManager = require("../services/streamManager");
const cctvService   = require("../services/cctvService");

// ── GET /api/stream/status ─────────────────────────────────────────
// ?cameraId=   → returns single-camera status object
// (no param)   → returns array of all active stream statuses
function getStatus(req, res) {
  const { cameraId } = req.query;
  res.json(streamManager.getStatus(cameraId || undefined));
}

// ── POST /api/stream/start ─────────────────────────────────────────
// Accepts either:
//   { cameraId }                          → look up camera from CCTV Settings
//   { rtspUrl, channel?, cameraName? }    → direct RTSP URL (channel defaults to 1)
//
async function startStream(req, res) {
  try {
    const { cameraId, rtspUrl: directUrl, cameraName: directName, channel: directChannel } = req.body || {};

    // ── Mode 1: direct RTSP URL ──────────────────────────────────
    if (directUrl) {
      if (!directUrl.startsWith("rtsp://")) {
        return res.status(400).json({ error: "rtspUrl must start with rtsp://" });
      }
      const id = `direct-${Date.now()}`;
      streamManager.startStream({
        cameraId:   id,
        rtspUrl:    directUrl,
        cameraName: directName || "Direct Camera",
        channel:    String(directChannel || "1"),
      });
      return res.json({
        success: true,
        message: "Starting direct stream…",
        status:  streamManager.getStatus(id),
      });
    }

    // ── Mode 2: camera from CCTV Settings ────────────────────────
    if (!cameraId) {
      return res.status(400).json({
        error: "Provide either cameraId (from CCTV Settings) or rtspUrl (direct RTSP URL)."
      });
    }

    // readAll() returns raw row arrays — convert with dataRows + toCamera
    const rawRows = await cctvService.readAll();
    const cameras = cctvService.dataRows(rawRows).map(cctvService.toCamera);
    const camera  = cameras.find(c => c.id === cameraId || c.camera_id === cameraId);

    if (!camera) {
      return res.status(404).json({ error: `Camera '${cameraId}' not found in CCTV Settings.` });
    }
    if (camera.status !== "Active") {
      return res.status(400).json({
        error: `Camera '${camera.cameraName}' is inactive. Enable it in CCTV Settings first.`
      });
    }

    const storedUrl = camera.streamUrl || camera.stream_url || "";
    if (!storedUrl || !storedUrl.startsWith("rtsp://")) {
      return res.status(400).json({
        error: `Camera '${camera.cameraName}' has no valid RTSP URL. Edit it in CCTV Settings.`
      });
    }

    const channel = camera.channel || "1";
    const camName = camera.cameraName || camera.camera_name || "Camera";

    console.log(
      `[stream/start] cameraId=${cameraId} name="${camName}" ch=${channel}` +
      `  rawUrl=${storedUrl.replace(/:[^:@]+@/, ":***@")}`
    );

    // Pass the raw stored URL — streamManager.buildRtspUrl() will correct the channel
    streamManager.startStream({
      cameraId,
      cameraName: camName,
      channel,
      rtspUrl:    storedUrl,
    });

    res.json({
      success: true,
      message: `Starting stream for ${camName} (ch${channel})…`,
      status:  streamManager.getStatus(cameraId),
    });

  } catch (e) {
    console.error("[stream/start]", e.message);
    res.status(500).json({ error: e.message });
  }
}

// ── POST /api/stream/stop ──────────────────────────────────────────
// Body: { cameraId }  → stops that camera's stream
// Body: {}            → stops ALL streams
function stopStream(req, res) {
  const { cameraId } = req.body || {};
  streamManager.stopStream(cameraId || undefined);
  res.json({
    success: true,
    message: cameraId ? `Stream stopped for ${cameraId}.` : "All streams stopped.",
    status:  cameraId ? streamManager.getStatus(cameraId) : streamManager.getStatus(),
  });
}

module.exports = { getStatus, startStream, stopStream };
