/**
 * cameraVerifyService.js — lightweight RTSP camera verification (CCTV V2)
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure-Node RTSP verification — NO ffmpeg, NO external binary, NO streaming.
 * Uses only built-in `net` (TCP) and `crypto` (MD5 Digest auth).
 *
 * Staged checks (Phase 1 scope):
 *     ✓ Camera reachable    — TCP connect to host:port
 *     ✓ Credentials valid   — RTSP DESCRIBE accepted (200), not 401
 *     ✓ Channel valid        — DESCRIBE returned an SDP media description (not 404)
 *
 * It does NOT decode video frames (that needs the stream engine in Phase 3).
 * A 200 + SDP from DESCRIBE proves the channel path resolves to real media,
 * which is sufficient to confirm the camera/channel/credentials are correct.
 *
 * Protocol (RFC 2326), HTTP-style:
 *   1. OPTIONS  rtsp://host/...        → 200 (server speaks RTSP)
 *   2. DESCRIBE rtsp://host/path       → 401 + WWW-Authenticate: Digest ...
 *   3. DESCRIBE + Authorization: Digest → 200 + SDP  | 401 (bad creds) | 404 (no channel)
 */

const net    = require("net");
const crypto = require("crypto");

const DEFAULT_PORT  = 554;
const SOCKET_TIMEOUT_MS = 6000;

// ── Build the path-only RTSP URL (no credentials) per brand ──────────
function buildRtspPath({ brand, ip, port, channel, streamUrl }) {
  const host = (ip || "").trim();
  const prt  = String(port || DEFAULT_PORT).trim() || DEFAULT_PORT;
  const ch   = String(channel || "1").trim() || "1";
  const templates = {
    Hikvision: `rtsp://${host}:${prt}/Streaming/Channels/${ch}01`,
    Dahua:     `rtsp://${host}:${prt}/cam/realmonitor?channel=${ch}&subtype=0`,
    "CP Plus": `rtsp://${host}:${prt}/cam/realmonitor?channel=${ch}&subtype=0`,
  };
  if (templates[brand] && host) return templates[brand];
  if (streamUrl && /^rtsp:\/\//i.test(streamUrl)) {
    // strip any embedded credentials — we add auth via headers, not URL
    return streamUrl.replace(/^rtsp:\/\/[^/@]+@/i, "rtsp://");
  }
  return "";
}

function parseHostPort(rtspUrl) {
  try {
    const u = new URL(rtspUrl);
    return { host: u.hostname, port: parseInt(u.port, 10) || DEFAULT_PORT };
  } catch { return null; }
}

// ── Digest auth (RFC 2617) ───────────────────────────────────────────
function md5(s) { return crypto.createHash("md5").update(s).digest("hex"); }

function parseAuthHeader(line) {
  // line: Digest realm="...", nonce="...", qop="auth", ...
  const out = {};
  const body = line.replace(/^Digest\s+/i, "");
  body.replace(/(\w+)="?([^",]+)"?/g, (_, k, v) => { out[k.toLowerCase()] = v; return ""; });
  return out;
}

function buildDigestHeader({ username, password, realm, nonce, qop, uri, method, cnonce, nc }) {
  const ha1 = md5(`${username}:${realm}:${password}`);
  const ha2 = md5(`${method}:${uri}`);
  let response;
  let header = `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}"`;
  if (qop) {
    response = md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`);
    header += `, qop=${qop}, nc=${nc}, cnonce="${cnonce}", response="${response}"`;
  } else {
    response = md5(`${ha1}:${nonce}:${ha2}`);
    header += `, response="${response}"`;
  }
  return header;
}

function basicHeader(username, password) {
  return "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
}

// ── Single RTSP request/response over a persistent socket ────────────
// Sends one request, resolves with { status, headers, body, raw }.
function rtspRequest(socket, { method, uri, cseq, extraHeaders = {} }) {
  return new Promise((resolve, reject) => {
    let buf = "";
    let expectedLen = null;
    let headerEnd = -1;

    const onData = (chunk) => {
      buf += chunk.toString("binary");
      if (headerEnd === -1) headerEnd = buf.indexOf("\r\n\r\n");
      if (headerEnd !== -1) {
        if (expectedLen === null) {
          const m = /content-length:\s*(\d+)/i.exec(buf.slice(0, headerEnd));
          expectedLen = m ? parseInt(m[1], 10) : 0;
        }
        const bodySoFar = buf.length - (headerEnd + 4);
        if (bodySoFar >= expectedLen) {
          socket.removeListener("data", onData);
          const headerBlock = buf.slice(0, headerEnd);
          const body = buf.slice(headerEnd + 4, headerEnd + 4 + expectedLen);
          const statusMatch = /^RTSP\/1\.0\s+(\d+)/.exec(headerBlock);
          const headers = {};
          headerBlock.split("\r\n").slice(1).forEach(l => {
            const i = l.indexOf(":");
            if (i > 0) headers[l.slice(0, i).trim().toLowerCase()] = l.slice(i + 1).trim();
          });
          resolve({ status: statusMatch ? parseInt(statusMatch[1], 10) : 0, headers, body, raw: headerBlock });
        }
      }
    };

    socket.on("data", onData);

    let req = `${method} ${uri} RTSP/1.0\r\nCSeq: ${cseq}\r\n`;
    for (const [k, v] of Object.entries(extraHeaders)) req += `${k}: ${v}\r\n`;
    req += "User-Agent: YellowDot-CameraVerify/1.0\r\n\r\n";
    socket.write(req, "binary", (err) => { if (err) reject(err); });
  });
}

// ── Stage 1: TCP reachability ────────────────────────────────────────
function connect(host, port) {
  return new Promise((resolve) => {
    const s = new net.Socket();
    let done = false;
    const fin = (ok) => { if (done) return; done = true; resolve(ok ? s : null); };
    s.setTimeout(SOCKET_TIMEOUT_MS);
    s.once("connect", () => fin(true));
    s.once("timeout", () => { try { s.destroy(); } catch {} fin(false); });
    s.once("error",   () => fin(false));
    s.connect(port, host);
  });
}

/**
 * Verify a camera via RTSP OPTIONS + DESCRIBE (+ Digest/Basic auth).
 * @returns {Promise<{ ok, checks:{reachable,credentials,channel}, failedStage?, message, detail? }>}
 */
async function verifyCamera(cam) {
  const checks = { reachable: false, credentials: false, channel: false };

  const rtspUrl = buildRtspPath(cam);
  if (!rtspUrl) {
    return { ok: false, checks, failedStage: "config",
      message: "Could not build an RTSP URL from the camera’s brand/IP or stored URL." };
  }
  const hp = parseHostPort(rtspUrl);
  if (!hp || !hp.host) {
    return { ok: false, checks, failedStage: "config", message: "No valid host/IP for this camera." };
  }

  // Stage 1 — TCP
  const socket = await connect(hp.host, hp.port);
  if (!socket) {
    return { ok: false, checks, failedStage: "reachable",
      message: `Camera not reachable at ${hp.host}:${hp.port}. Check IP, port, and network/firewall.` };
  }
  checks.reachable = true;

  const username = cam.username || "";
  const password = cam.password || "";

  try {
    let cseq = 1;

    // Stage handshake — OPTIONS (best-effort; some cams skip auth here)
    try { await rtspRequest(socket, { method: "OPTIONS", uri: rtspUrl, cseq: cseq++ }); } catch { /* tolerate */ }

    // DESCRIBE #1 — expect 200 (no auth needed) or 401 (challenge)
    let res = await rtspRequest(socket, {
      method: "DESCRIBE", uri: rtspUrl, cseq: cseq++,
      extraHeaders: { Accept: "application/sdp" },
    });

    // If challenged, answer it.
    if (res.status === 401) {
      const wallenge = res.headers["www-authenticate"] || "";
      if (!username) {
        return finish(socket, { ok: false, checks, failedStage: "credentials",
          message: "Camera requires authentication but no username is stored." });
      }
      let authHeader;
      if (/^Digest/i.test(wallenge)) {
        const p = parseAuthHeader(wallenge);
        authHeader = buildDigestHeader({
          username, password, realm: p.realm || "", nonce: p.nonce || "",
          qop: p.qop, uri: rtspUrl, method: "DESCRIBE",
          cnonce: crypto.randomBytes(8).toString("hex"), nc: "00000001",
        });
      } else {
        authHeader = basicHeader(username, password);
      }
      res = await rtspRequest(socket, {
        method: "DESCRIBE", uri: rtspUrl, cseq: cseq++,
        extraHeaders: { Accept: "application/sdp", Authorization: authHeader },
      });
    }

    // Classify final DESCRIBE result.
    if (res.status === 200) {
      checks.credentials = true;
      const hasSdp = /m=video|m=application|application\/sdp/i.test(res.body) ||
                     /content-type:\s*application\/sdp/i.test(res.raw);
      if (hasSdp || (res.headers["content-length"] && parseInt(res.headers["content-length"], 10) > 0)) {
        checks.channel = true;
        return finish(socket, { ok: true, checks,
          message: "Camera verified: reachable, credentials valid, channel valid." });
      }
      // 200 but no SDP body — treat channel as unverified.
      return finish(socket, { ok: false, checks, failedStage: "channel",
        message: "Authenticated, but the channel returned no media description. Check Camera Number." });
    }

    if (res.status === 401) {
      return finish(socket, { ok: false, checks, failedStage: "credentials",
        message: "RTSP authentication failed. Check username/password." });
    }
    if (res.status === 404) {
      checks.credentials = true; // got past auth to a 404
      return finish(socket, { ok: false, checks, failedStage: "channel",
        message: "Authenticated, but the requested channel was not found. Check Camera Number.",
        detail: `RTSP ${res.status}` });
    }
    return finish(socket, { ok: false, checks, failedStage: "stream",
      message: `Camera responded with RTSP ${res.status || "?"}. Could not verify the channel.`,
      detail: res.raw ? res.raw.split("\r\n")[0] : "" });

  } catch (e) {
    return finish(socket, { ok: false, checks, failedStage: "protocol",
      message: "RTSP error during verification.", detail: e.message });
  }
}

function finish(socket, result) {
  try { socket.destroy(); } catch { /* noop */ }
  return result;
}

module.exports = { verifyCamera, buildRtspPath };
