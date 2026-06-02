/**
 * cctvStreamPaths.js — main/sub stream path derivation (CCTV V2)
 * ─────────────────────────────────────────────────────────────────────────────
 * Convention (Hikvision-style, verified live):
 *   Main stream  : /Streaming/Channels/<ch>01   → H.265, used for verification,
 *                  snapshots, diagnostics.
 *   Sub  stream  : /Streaming/Channels/<ch>02   → H.264, used for live viewing
 *                  (browser-native; no FFmpeg transcode required).
 *
 * All returned URLs are CREDENTIAL-FREE. Credentials are injected server-side
 * only (MediaMTX source / verification), never persisted in these URLs and
 * never sent to the browser.
 *
 * Dahua/CP Plus use a different scheme (subtype=0 main / subtype=1 sub); handled
 * so the convention generalizes beyond Hikvision.
 */

const DEFAULT_PORT = 554;

function hostPort(cam) {
  const ip = (cam.ip || "").trim();
  const port = String(cam.port || DEFAULT_PORT).trim() || DEFAULT_PORT;
  return { ip, port };
}

// Returns { mainPath, subPath } — RTSP path portions (no host, no creds).
function streamPaths(cam) {
  const ch = String(cam.channel || "1").trim() || "1";
  const brand = cam.brand || "";
  if (brand === "Dahua" || brand === "CP Plus") {
    return {
      mainPath: `/cam/realmonitor?channel=${ch}&subtype=0`,
      subPath:  `/cam/realmonitor?channel=${ch}&subtype=1`,
    };
  }
  // Hikvision + default
  return {
    mainPath: `/Streaming/Channels/${ch}01`,
    subPath:  `/Streaming/Channels/${ch}02`,
  };
}

// Convert a Hikvision/Dahua MAIN-stream URL into its SUB-stream equivalent.
// Hikvision: /Streaming/Channels/<ch>01 → <ch>02
// Dahua:     subtype=0 → subtype=1
function deriveSubFromMain(mainUrl) {
  if (!mainUrl) return "";
  // Hikvision: .../Streaming/Channels/<ch>01 → <ch>02 (swap the trailing "01").
  const hik = /(\/Streaming\/Channels\/\d+?)01(?=$|[/?])/i;
  if (hik.test(mainUrl)) return mainUrl.replace(hik, "$102");
  // Dahua/CP Plus: subtype=0 → subtype=1.
  if (/subtype=0/i.test(mainUrl)) return mainUrl.replace(/subtype=0/i, "subtype=1");
  return ""; // unknown scheme — cannot derive a substream safely
}

// Credential-free RTSP URLs for main (verification) and sub (live).
// Prefers structured ip/port/channel; falls back to transforming a stored
// main streamUrl for legacy records that lack ip/port.
function streamUrls(cam) {
  const { ip, port } = hostPort(cam);
  if (ip) {
    const { mainPath, subPath } = streamPaths(cam);
    return {
      mainStreamUrl: `rtsp://${ip}:${port}${mainPath}`,
      liveStreamUrl: `rtsp://${ip}:${port}${subPath}`,
    };
  }
  // Legacy: no ip — derive from the stored (credential-free) main streamUrl.
  const main = cam.streamUrl || "";
  return { mainStreamUrl: main, liveStreamUrl: deriveSubFromMain(main) };
}

// Stable MediaMTX path name for this camera (no creds).
function mediaMtxPath(cam) {
  return `cam/${cam.cameraId || cam.camera_id || ""}`;
}

module.exports = { streamPaths, streamUrls, mediaMtxPath, DEFAULT_PORT };
