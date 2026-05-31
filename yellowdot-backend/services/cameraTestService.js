/**
 * cameraTestService.js — CCTV V2 Phase 1 connection test
 * ──────────────────────────────────────────────────────────────────────
 * Phase 1 is metadata-only: NO streaming, NO FFmpeg, NO RTSP playback.
 *
 * "Test Connection" therefore performs a lightweight, dependency-free
 * reachability check:
 *   1. Parse the stream URL and validate scheme/host/port.
 *   2. Attempt a raw TCP socket connect to host:port (default 554) with
 *      a short timeout.
 *
 * It reports whether the camera's port is reachable on the network — it
 * does NOT verify credentials, channels, or that a valid video stream
 * exists (that requires the stream engine, which is out of scope).
 */

const net = require("net");

const DEFAULT_RTSP_PORT = 554;
const CONNECT_TIMEOUT_MS = 5000;

/**
 * Parse an rtsp:// / http(s):// URL into { host, port }.
 * Returns { ok:false, error } if it cannot be parsed.
 */
function parseStreamUrl(streamUrl) {
  if (!streamUrl || typeof streamUrl !== "string") {
    return { ok: false, error: "Stream URL is required." };
  }
  let url;
  try {
    url = new URL(streamUrl.trim());
  } catch {
    return { ok: false, error: "Stream URL is not a valid URL." };
  }
  const scheme = url.protocol.replace(":", "").toLowerCase();
  if (!["rtsp", "http", "https"].includes(scheme)) {
    return { ok: false, error: `Unsupported scheme "${scheme}". Use rtsp://, http://, or https://.` };
  }
  const host = url.hostname;
  if (!host) return { ok: false, error: "Stream URL has no host." };
  const port = url.port
    ? parseInt(url.port, 10)
    : (scheme === "https" ? 443 : scheme === "http" ? 80 : DEFAULT_RTSP_PORT);
  return { ok: true, scheme, host, port };
}

/**
 * TCP reachability probe. Resolves to { reachable, host, port, message, ms }.
 * Never rejects — failure is reported in the resolved object.
 */
function tcpProbe(host, port, timeoutMs = CONNECT_TIMEOUT_MS) {
  return new Promise((resolve) => {
    const started = Date.now();
    const socket = new net.Socket();
    let settled = false;

    const done = (reachable, message) => {
      if (settled) return;
      settled = true;
      try { socket.destroy(); } catch { /* noop */ }
      resolve({ reachable, host, port, message, ms: Date.now() - started });
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true, `Port ${port} is reachable on ${host}.`));
    socket.once("timeout", () => done(false, `Timed out after ${timeoutMs}ms connecting to ${host}:${port}.`));
    socket.once("error", (e) => done(false, `Cannot reach ${host}:${port} — ${e.code || e.message}.`));

    try {
      socket.connect(port, host);
    } catch (e) {
      done(false, `Connection error: ${e.message}`);
    }
  });
}

/**
 * Public API: test reachability of a camera's stream URL.
 * @param {string} streamUrl
 * @returns {Promise<{ reachable:boolean, host?:string, port?:number, message:string, ms?:number }>}
 */
async function testConnection(streamUrl) {
  const parsed = parseStreamUrl(streamUrl);
  if (!parsed.ok) {
    return { reachable: false, message: parsed.error };
  }
  return tcpProbe(parsed.host, parsed.port);
}

module.exports = { testConnection, parseStreamUrl };
