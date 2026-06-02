/**
 * cameraVerifyService.js — real RTSP camera verification (CCTV V2)
 * ─────────────────────────────────────────────────────────────────────────────
 * Unlike the TCP-only reachability probe (cameraTestService.js), this performs
 * an ACTUAL RTSP connection using the camera's stored credentials and reports
 * staged results:
 *     ✓ Camera reachable    — TCP connect to host:port
 *     ✓ Credentials valid   — RTSP DESCRIBE accepted (not 401)
 *     ✓ Channel valid       — the requested channel path resolved
 *     ✓ Stream available    — a video stream was negotiated
 *
 * Implementation: spawns the bundled ffmpeg (ffmpeg-static) to open the RTSP
 * URL for ~1s and writes to the null muxer (no recording, no HLS, no file
 * output). We parse ffmpeg's stderr to classify the outcome. This is a
 * one-shot verification — NOT a stream engine.
 *
 * NOTE: this re-introduces ffmpeg as a dependency (removed during V1 cleanup),
 * pulled forward intentionally to support real Camera Verification in Phase 2.
 */

const { spawn } = require("child_process");
const net = require("net");

let ffmpegPath;
try { ffmpegPath = require("ffmpeg-static"); } catch { ffmpegPath = null; }

const TCP_TIMEOUT_MS    = 4000;
const FFMPEG_TIMEOUT_MS = 12000;
const DEFAULT_PORT      = 554;

// ── Build the full authenticated RTSP URL (server-side only; never returned) ──
// Mirrors the frontend templates but injects credentials for the live probe.
function buildAuthUrl({ brand, ip, port, channel, username, password, streamUrl }) {
  // If a custom/explicit URL is stored and has no template basis, prefer it
  // but inject credentials if missing.
  const u  = encodeURIComponent(username || "");
  const p  = encodeURIComponent(password || "");
  const cred = username ? `${u}${password ? ":" + p : ""}@` : "";
  const host = (ip || "").trim();
  const prt  = String(port || DEFAULT_PORT).trim() || DEFAULT_PORT;
  const ch   = String(channel || "1").trim() || "1";

  const templates = {
    Hikvision: `rtsp://${cred}${host}:${prt}/Streaming/Channels/${ch}01`,
    Dahua:     `rtsp://${cred}${host}:${prt}/cam/realmonitor?channel=${ch}&subtype=0`,
    "CP Plus": `rtsp://${cred}${host}:${prt}/cam/realmonitor?channel=${ch}&subtype=0`,
  };

  if (templates[brand] && host) return templates[brand];

  // Fallback: inject credentials into a stored streamUrl that lacks them.
  if (streamUrl && /^rtsp:\/\//i.test(streamUrl)) {
    if (cred && !/^rtsp:\/\/[^/@]+@/i.test(streamUrl)) {
      return streamUrl.replace(/^rtsp:\/\//i, `rtsp://${cred}`);
    }
    return streamUrl;
  }
  return "";
}

function redact(url) {
  return (url || "").replace(/\/\/[^@/]+@/, "//***:***@");
}

// ── Stage 1: TCP reachability ────────────────────────────────────────────────
function tcpReachable(host, port) {
  return new Promise((resolve) => {
    const s = new net.Socket();
    let done = false;
    const fin = (ok) => { if (done) return; done = true; try { s.destroy(); } catch {} resolve(ok); };
    s.setTimeout(TCP_TIMEOUT_MS);
    s.once("connect", () => fin(true));
    s.once("timeout", () => fin(false));
    s.once("error",   () => fin(false));
    s.connect(port, host);
  });
}

// ── Stage 2-4: RTSP probe via ffmpeg ──────────────────────────────────────────
function ffmpegProbe(authUrl) {
  return new Promise((resolve) => {
    if (!ffmpegPath) {
      return resolve({ ok: false, reason: "ffmpeg-not-available", stderr: "" });
    }
    const args = [
      "-hide_banner",
      "-rtsp_transport", "tcp",
      "-analyzeduration", "2000000",
      "-probesize", "1000000",
      "-i", authUrl,
      "-t", "1",
      "-f", "null",
      "-",
    ];
    const proc = spawn(ffmpegPath, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    const timer = setTimeout(() => { try { proc.kill("SIGKILL"); } catch {} }, FFMPEG_TIMEOUT_MS);

    proc.stderr.on("data", (c) => { stderr += String(c); if (stderr.length > 20000) stderr = stderr.slice(-20000); });
    proc.on("error", (e) => { clearTimeout(timer); resolve({ ok: false, reason: "spawn-error", stderr: e.message }); });
    proc.on("close", (code) => {
      clearTimeout(timer);
      const hasVideo = /Stream #\d+:\d+.*Video:/i.test(stderr) || /Input #0, rtsp/i.test(stderr);
      resolve({ ok: code === 0 || hasVideo, code, stderr, hasVideo });
    });
  });
}

// Classify ffmpeg stderr into a specific failure stage.
function classify(stderr) {
  const s = (stderr || "").toLowerCase();
  if (/401 unauthorized|authorization failed|authentication/.test(s)) return "auth";
  if (/404 not found|method describe failed.*404|stream not found/.test(s)) return "channel";
  if (/connection refused|timed out|no route to host|network is unreachable/.test(s)) return "network";
  if (/invalid data|could not find codec|unable to open/.test(s)) return "stream";
  return "unknown";
}

/**
 * Full staged verification.
 * @returns {Promise<{
 *   ok:boolean, checks:{reachable,credentials,channel,stream}, failedStage?:string,
 *   message:string, detail?:string
 * }>}
 */
async function verifyCamera(cam) {
  const checks = { reachable: false, credentials: false, channel: false, stream: false };
  const host = (cam.ip || "").trim();
  const port = parseInt(cam.port, 10) || DEFAULT_PORT;

  // Need a host to even start. (Custom-URL cameras: derive host from URL.)
  let probeHost = host;
  if (!probeHost && cam.streamUrl) {
    try { probeHost = new URL(cam.streamUrl).hostname; } catch { /* noop */ }
  }
  if (!probeHost) {
    return { ok: false, checks, failedStage: "config", message: "No IP/host configured for this camera." };
  }

  // Stage 1 — TCP reachability
  checks.reachable = await tcpReachable(probeHost, port);
  if (!checks.reachable) {
    return { ok: false, checks, failedStage: "reachable",
      message: `Camera not reachable at ${probeHost}:${port}. Check IP, port, and network/firewall.` };
  }

  if (!ffmpegPath) {
    return { ok: false, checks, failedStage: "engine",
      message: "Reachable, but RTSP verification engine (ffmpeg) is unavailable on the server." };
  }

  // Stages 2-4 — RTSP auth + channel + stream
  const authUrl = buildAuthUrl(cam);
  if (!authUrl) {
    return { ok: false, checks, failedStage: "config",
      message: "Could not build an RTSP URL from the camera’s brand/IP or stored URL." };
  }

  const probe = await ffmpegProbe(authUrl);

  if (probe.ok && probe.hasVideo) {
    checks.credentials = true;
    checks.channel = true;
    checks.stream = true;
    return { ok: true, checks, message: "Camera verified: reachable, credentials valid, channel valid, stream available." };
  }

  const stage = classify(probe.stderr);
  // Reached the camera (TCP ok); refine which RTSP stage failed.
  if (stage === "auth") {
    return { ok: false, checks, failedStage: "credentials",
      message: "Reachable, but RTSP authentication failed. Check username/password.",
      detail: tail(probe.stderr) };
  }
  if (stage === "channel") {
    checks.credentials = true; // got past auth to a 404
    return { ok: false, checks, failedStage: "channel",
      message: "Reachable and authenticated, but the requested channel was not found. Check Camera Number.",
      detail: tail(probe.stderr) };
  }
  return { ok: false, checks, failedStage: "stream",
    message: "Reachable, but could not open a valid video stream. Check channel, codec, or camera status.",
    detail: tail(probe.stderr) };
}

function tail(s, n = 400) {
  const t = (s || "").trim();
  return t.length > n ? t.slice(-n) : t;
}

module.exports = { verifyCamera, buildAuthUrl, redact };
