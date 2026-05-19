/**
 * streamManager.js
 * ─────────────────────────────────────────────────────────────────
 * Per-camera FFmpeg / HLS manager.
 *
 * Architecture
 * ────────────
 *   • Each camera gets its own isolated state object, stored in `streams` Map.
 *   • RTSP URL is built once from camera.channel and LOCKED — never changes
 *     on reconnect, so a camera always reconnects to its assigned channel.
 *   • HLS output → ./hls-output/{cameraId}/stream.m3u8  (fully isolated dirs)
 *   • Multiple cameras can stream simultaneously without interfering.
 *
 * Camera details (confirmed via ffprobe):
 *   Codec : HEVC / H.265  →  must transcode to H.264 for browser HLS
 *   Size  : 1920 × 1080  →  scaled to 720p to reduce CPU load
 *   Audio : PCM mulaw     →  dropped (not HLS-compatible)
 *
 * Hikvision channel URL format:
 *   Channel 1 → /Streaming/Channels/101
 *   Channel 4 → /Streaming/Channels/401
 *   Channel 7 → /Streaming/Channels/701
 *   Channel 9 → /Streaming/Channels/901
 *
 * Lifecycle per camera:
 *   idle → starting → live → (crash) → backoff → starting → ...
 *   Any state → stopped  (manual stop)
 * ─────────────────────────────────────────────────────────────────
 */

const { spawn } = require("child_process");
const path      = require("path");
const fs        = require("fs");
const ffmpeg    = require("ffmpeg-static"); // bundled Windows binary

// ── Base HLS directory (exported so server.js can serve it statically) ──
const HLS_DIR = path.join(__dirname, "..", "hls-output");

// ── Config ───────────────────────────────────────────────────────
const MAX_RESTARTS = 5;
const BACKOFF_BASE = 4_000;  // ms (doubles each attempt, capped at 30 s)
const POLL_MS      = 500;    // ms (playlist file poll interval)
const STALE_MS     = 12_000; // ms (no new segment for this long = stale)

// ── Per-camera stream registry ────────────────────────────────────
// Map<cameraId: string, CameraState>
const streams = new Map();

// ── Logging ──────────────────────────────────────────────────────
const log  = (id, m) => console.log (`[stream:${id}] ${m}`);
const warn = (id, m) => console.warn(`[stream:${id}] ⚠  ${m}`);
const err  = (id, m) => console.error(`[stream:${id}] ✖  ${m}`);

// ═══════════════════════════════════════════════════════════════════
// Hikvision channel URL builder
// ═══════════════════════════════════════════════════════════════════
/**
 * Build the correct RTSP URL for a camera using its saved channel number.
 *
 * Hikvision format: /Streaming/Channels/{channel}01
 *   channel=1  → /Streaming/Channels/101
 *   channel=4  → /Streaming/Channels/401
 *   channel=7  → /Streaming/Channels/701
 *
 * If the stored URL already has /Streaming/Channels/NNN, we replace NNN
 * with the correct channel suffix. If not, we return the URL as-is.
 */
function buildRtspUrl(cam) {
  const channel = parseInt(cam.channel, 10) || 1;
  const base    = cam.rtspUrl || cam.streamUrl || cam.stream_url || "";

  if (/\/Streaming\/Channels\/\d+/i.test(base)) {
    const corrected = base.replace(
      /\/Streaming\/Channels\/\d+/i,
      `/Streaming/Channels/${channel}01`
    );
    log(cam.cameraId, `Channel ${channel} → RTSP URL: ${corrected.replace(/:[^:@]+@/, ":***@")}`);
    return corrected;
  }

  // Non-Hikvision URL — use as-is
  return base;
}

// ═══════════════════════════════════════════════════════════════════
// Per-camera HLS directory helpers
// ═══════════════════════════════════════════════════════════════════
function hlsDir(cameraId) {
  return path.join(HLS_DIR, cameraId);
}

function hlsPlaylist(cameraId) {
  return path.join(hlsDir(cameraId), "stream.m3u8");
}

function hlsSegPattern(cameraId) {
  return path.join(hlsDir(cameraId), "seg%05d.ts");
}

function ensureHlsDir(cameraId) {
  fs.mkdirSync(hlsDir(cameraId), { recursive: true });
}

function cleanHlsFiles(cameraId) {
  try {
    const dir = hlsDir(cameraId);
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).forEach(f => {
      try { fs.unlinkSync(path.join(dir, f)); } catch {}
    });
    log(cameraId, "HLS directory cleaned.");
  } catch (e) {
    warn(cameraId, `Could not clean HLS dir: ${e.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// Camera state factory
// ═══════════════════════════════════════════════════════════════════
function makeState(cam) {
  const rtspUrl = buildRtspUrl(cam); // LOCKED — never changes after this

  return {
    // Identity (immutable after creation)
    cameraId:   cam.cameraId,
    cameraName: cam.cameraName || "Camera",
    channel:    String(cam.channel || "1"),
    rtspUrl,                              // ← correct channel URL, locked

    // Mutable lifecycle state
    status:      "idle",   // "idle"|"starting"|"live"|"error"|"stopped"
    proc:        null,     // ChildProcess
    restarts:    0,
    startedAt:   null,
    error:       null,

    // Timer handles
    pollTimer:    null,
    staleTimer:   null,
    restartTimer: null,
  };
}

// ═══════════════════════════════════════════════════════════════════
// Timer helpers (per-state)
// ═══════════════════════════════════════════════════════════════════
function clearAllTimers(s) {
  if (s.pollTimer)    { clearInterval(s.pollTimer);   s.pollTimer    = null; }
  if (s.staleTimer)   { clearInterval(s.staleTimer);  s.staleTimer   = null; }
  if (s.restartTimer) { clearTimeout(s.restartTimer); s.restartTimer = null; }
}

// ═══════════════════════════════════════════════════════════════════
// Stale segment watcher
// ═══════════════════════════════════════════════════════════════════
function armStaleWatcher(s) {
  if (s.staleTimer) clearInterval(s.staleTimer);
  s.staleTimer = setInterval(() => {
    if (s.status !== "live") return;
    try {
      const dir  = hlsDir(s.cameraId);
      const segs = fs.readdirSync(dir).filter(f => f.endsWith(".ts"));
      if (segs.length === 0) return;
      const latestMtime = Math.max(
        ...segs.map(f => fs.statSync(path.join(dir, f)).mtimeMs)
      );
      if (Date.now() - latestMtime > STALE_MS) {
        warn(s.cameraId, "Stream stale — no new segments. Triggering restart.");
        killProc(s);
        scheduleRestart(s);
      }
    } catch {}
  }, 4_000);
}

// ═══════════════════════════════════════════════════════════════════
// Playlist poller — waits for m3u8 to appear then marks "live"
// ═══════════════════════════════════════════════════════════════════
function startPlaylistPoll(s) {
  if (s.pollTimer) clearInterval(s.pollTimer);
  const playlist = hlsPlaylist(s.cameraId);
  s.pollTimer = setInterval(() => {
    if (s.status !== "starting") {
      clearInterval(s.pollTimer); s.pollTimer = null;
      return;
    }
    if (fs.existsSync(playlist)) {
      s.status    = "live";
      s.error     = null;
      s.startedAt = new Date().toISOString();
      clearInterval(s.pollTimer); s.pollTimer = null;
      log(s.cameraId, `LIVE  ← ch${s.channel}  ${s.rtspUrl.replace(/:[^:@]+@/, ":***@")}`);
      armStaleWatcher(s);
    }
  }, POLL_MS);
}

// ═══════════════════════════════════════════════════════════════════
// FFmpeg args builder (HEVC → H.264, 720p, HLS)
// ═══════════════════════════════════════════════════════════════════
function buildArgs(s) {
  return [
    "-hide_banner",
    "-loglevel",  "warning",
    "-stats",

    // Input
    "-rtsp_transport",  "tcp",
    "-analyzeduration", "3000000",
    "-probesize",       "5000000",
    "-i",               s.rtspUrl,

    // Video: transcode HEVC → H.264
    "-c:v",         "libx264",
    "-preset",      "ultrafast",
    "-tune",        "zerolatency",
    "-crf",         "26",
    "-vf",          "scale=-2:720",
    "-g",           "30",
    "-sc_threshold","0",

    // Drop audio (PCM mulaw not HLS-compatible)
    "-an",

    // HLS muxer
    "-f",           "hls",
    "-hls_time",    "2",
    "-hls_list_size","6",
    "-hls_flags",   "delete_segments+append_list+omit_endlist",
    "-hls_segment_filename", hlsSegPattern(s.cameraId),
    hlsPlaylist(s.cameraId),
  ];
}

// ═══════════════════════════════════════════════════════════════════
// Kill FFmpeg process
// ═══════════════════════════════════════════════════════════════════
function killProc(s) {
  if (!s.proc) return;
  try {
    s.proc.stdout?.destroy();
    s.proc.stderr?.destroy();
    s.proc.kill("SIGTERM");
    const p = s.proc;
    setTimeout(() => { try { p.kill("SIGKILL"); } catch {} }, 3_000);
  } catch {}
  s.proc = null;
}

// ═══════════════════════════════════════════════════════════════════
// Exponential back-off restart
// ═══════════════════════════════════════════════════════════════════
function scheduleRestart(s) {
  if (s.status === "stopped") return;

  if (s.restarts >= MAX_RESTARTS) {
    err(s.cameraId, `Max restarts (${MAX_RESTARTS}) reached — giving up.`);
    s.status = "error";
    s.error  = `Stream failed after ${MAX_RESTARTS} reconnection attempts. Check camera connectivity.`;
    s.proc   = null;
    return;
  }

  const delay = Math.min(BACKOFF_BASE * Math.pow(2, s.restarts), 30_000);
  s.restarts++;
  warn(s.cameraId, `Reconnecting ch${s.channel} in ${delay / 1000}s (attempt ${s.restarts}/${MAX_RESTARTS})…`);

  s.restartTimer = setTimeout(() => {
    s.restartTimer = null;
    if (s.status === "stopped") return;
    spawnFfmpeg(s); // uses s.rtspUrl — LOCKED, correct channel guaranteed
  }, delay);
}

// ═══════════════════════════════════════════════════════════════════
// Spawn FFmpeg for a camera state object
// ═══════════════════════════════════════════════════════════════════
function spawnFfmpeg(s) {
  ensureHlsDir(s.cameraId);
  cleanHlsFiles(s.cameraId);

  const args = buildArgs(s);
  log(s.cameraId, `Spawning FFmpeg  ch${s.channel}  ${s.rtspUrl.replace(/:[^:@]+@/, ":***@")}`);
  log(s.cameraId, `HLS → hls-output/${s.cameraId}/stream.m3u8`);

  const proc = spawn(ffmpeg, args, {
    stdio:       ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  const skipLine    = /ignoring invalid SAR|last message repeated|PPS id out of range/i;
  const interesting = /error|fail|frame=|fps=|speed=|time=/i;

  proc.stderr.on("data", chunk => {
    String(chunk).split("\n").forEach(line => {
      const l = line.trim();
      if (!l || skipLine.test(l)) return;
      if (interesting.test(l)) {
        process.stderr.write(`[ffmpeg:${s.cameraId}] ${l}\n`);
      }
    });
  });
  proc.stdout.on("data", () => {});

  proc.on("exit", (code, signal) => {
    log(s.cameraId, `FFmpeg exited — code=${code} signal=${signal} status=${s.status}`);
    clearAllTimers(s);
    s.proc = null;
    if (s.status !== "stopped") scheduleRestart(s);
  });

  proc.on("error", e => {
    err(s.cameraId, `FFmpeg spawn error: ${e.message}`);
    s.error = e.message;
    clearAllTimers(s);
    s.proc = null;
    scheduleRestart(s);
  });

  s.proc      = proc;
  s.status    = "starting";
  s.error     = null;
  s.startedAt = null;
  startPlaylistPoll(s);
}

// ═══════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════

/**
 * Start a stream for a camera.
 *
 * @param {{
 *   cameraId:   string,
 *   cameraName: string,
 *   channel:    string|number,
 *   rtspUrl:    string,   // raw URL from DB — channel will be corrected
 * }} cam
 */
function startStream(cam) {
  const { cameraId } = cam;
  if (!cameraId) throw new Error("cameraId is required");
  if (!cam.rtspUrl && !cam.streamUrl && !cam.stream_url) throw new Error("rtspUrl is required");

  // Already streaming this camera?
  const existing = streams.get(cameraId);
  if (existing && (existing.status === "live" || existing.status === "starting")) {
    log(cameraId, "startStream: already streaming — no-op.");
    return;
  }

  // Stop and clean up any previous state for this camera
  if (existing) {
    log(cameraId, "startStream: cleaning up previous state before restart.");
    clearAllTimers(existing);
    existing.status = "stopped";
    killProc(existing);
    cleanHlsFiles(cameraId);
  }

  const s = makeState(cam);
  streams.set(cameraId, s);

  log(cameraId, `Starting stream — camera="${s.cameraName}" ch=${s.channel}`);
  spawnFfmpeg(s);
}

/**
 * Stop the stream for a specific camera (or ALL cameras if cameraId omitted).
 *
 * @param {string} [cameraId]
 */
function stopStream(cameraId) {
  if (cameraId) {
    const s = streams.get(cameraId);
    if (!s) { return; }
    log(cameraId, "Stopping stream (manual).");
    clearAllTimers(s);
    s.status = "stopped";
    killProc(s);
    cleanHlsFiles(cameraId);
    s.rtspUrl    = null;
    s.startedAt  = null;
    s.error      = null;
  } else {
    // Stop all
    for (const [id, s] of streams) {
      log(id, "Stopping stream (manual — stop all).");
      clearAllTimers(s);
      s.status = "stopped";
      killProc(s);
      cleanHlsFiles(id);
    }
  }
}

/**
 * Get a safe status snapshot (no process objects, password redacted).
 *
 * @param {string} [cameraId]  If provided, returns single-camera status.
 *                             If omitted, returns array of all statuses.
 */
function getStatus(cameraId) {
  function snapshot(s) {
    return {
      status:      s.status,
      cameraId:    s.cameraId,
      cameraName:  s.cameraName,
      channel:     s.channel,
      rtspUrl:     s.rtspUrl
        ? s.rtspUrl.replace(/:[^:@]+@/, ":***@")
        : null,
      restarts:    s.restarts,
      maxRestarts: MAX_RESTARTS,
      startedAt:   s.startedAt,
      error:       s.error,
      hlsUrl:      `/stream/live/${s.cameraId}/stream.m3u8`,
    };
  }

  if (cameraId) {
    const s = streams.get(cameraId);
    if (!s) {
      return {
        status:      "idle",
        cameraId,
        cameraName:  null,
        channel:     null,
        rtspUrl:     null,
        restarts:    0,
        maxRestarts: MAX_RESTARTS,
        startedAt:   null,
        error:       null,
        hlsUrl:      `/stream/live/${cameraId}/stream.m3u8`,
      };
    }
    return snapshot(s);
  }

  // Return all
  return Array.from(streams.values()).map(snapshot);
}

module.exports = { startStream, stopStream, getStatus, HLS_DIR };
