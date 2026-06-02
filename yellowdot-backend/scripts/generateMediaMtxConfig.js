/**
 * generateMediaMtxConfig.js — emit a MediaMTX config for the live (H.264 sub) streams
 * ─────────────────────────────────────────────────────────────────────────────
 * Reads active cameras from Firestore and produces a mediamtx.yml with one
 * on-demand path per camera, sourced from the camera's H.264 SUBSTREAM (xx02).
 * Remux only — NO transcoding.
 *
 * SECURITY: the generated file CONTAINS RTSP CREDENTIALS (MediaMTX needs them to
 * pull the source). It is written to yellowdot-backend/.mediamtx/ which MUST be
 * gitignored. Treat the output like a secret. Regenerate when cameras change.
 *
 * Usage (from yellowdot-backend/):
 *   node scripts/generateMediaMtxConfig.js            # prints to stdout (creds REDACTED)
 *   node scripts/generateMediaMtxConfig.js --write    # writes .mediamtx/mediamtx.yml (REAL creds)
 *
 * NOTE: some MediaMTX config keys (auth hook, sourceProtocol) are version-
 * specific. The base template below targets MediaMTX v1.x; validate against the
 * version you deploy. Auth-hook wiring is left commented until the API endpoint
 * (/internal/cctv/auth) is built in the next step.
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const svc = require("../services/cctvService");

const WRITE = process.argv.includes("--write");

// Build an authenticated substream RTSP URL (server-side only).
function authedSubUrl(cam) {
  const live = cam.liveStreamUrl || "";           // credential-free xx02
  if (!live || !cam.username) return live;
  const u = encodeURIComponent(cam.username);
  const p = cam.password ? ":" + encodeURIComponent(cam.password) : "";
  return live.replace(/^rtsp:\/\//i, `rtsp://${u}${p}@`);
}

function redact(url) { return (url || "").replace(/\/\/[^@/]+@/, "//***:***@"); }

function pathBlock(cam, url) {
  return [
    `  ${cam.mediaMtxPath}:`,
    `    source: ${url}`,
    `    sourceOnDemand: yes`,
    `    sourceOnDemandCloseAfter: 20s`,
  ].join("\n");
}

(async () => {
  const list = await svc.getAll({});                // non-deleted, all centers
  const active = list.filter(c => c.status !== "Inactive");

  const header = [
    "# mediamtx.yml — GENERATED. Contains credentials. DO NOT COMMIT.",
    `# Generated for ${active.length} camera(s). Regenerate when cameras change.`,
    "logLevel: info",
    "",
    "# HLS (mobile/Safari fallback)",
    "hls: yes",
    "hlsAddress: :8888",
    "hlsVariant: lowLatency",
    "hlsAlwaysRemux: no",
    "",
    "# WebRTC (primary, low-latency; H.264 is natively supported)",
    "webrtc: yes",
    "webrtcAddress: :8889",
    "",
    "# Auth — wire to the CRM API once /internal/cctv/auth exists (next step):",
    "#   authMethod: http",
    "#   authHTTPAddress: http://<api-host>/internal/cctv/auth",
    "#   (exact keys are MediaMTX-version-specific — validate at deploy)",
    "",
    "paths:",
  ].join("\n");

  const blocks = [];
  const report = [];
  for (const cam of active) {
    const real = await svc.getOneWithSecret(cam.cameraId); // decrypted creds
    const url = authedSubUrl(real);
    if (!url || !/\/\/[^@/]+@/.test(url)) {
      report.push(`SKIP ${cam.cameraId} (${cam.cameraName}) — no substream URL or no credentials`);
      continue;
    }
    blocks.push(pathBlock(real, url));
    report.push(`OK   ${cam.cameraId} (${cam.cameraName}) → ${redact(url)}`);
  }

  const yml = header + "\n" + blocks.join("\n") + "\n";

  console.log("=== camera → substream mapping (redacted) ===");
  report.forEach(r => console.log("  " + r));
  console.log("");

  if (!WRITE) {
    console.log("=== mediamtx.yml (credentials REDACTED — run with --write for real file) ===\n");
    console.log(yml.replace(/\/\/[^@/]+@/g, "//***:***@"));
    process.exit(0);
  }

  const outDir = path.join(__dirname, "..", ".mediamtx");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "mediamtx.yml");
  fs.writeFileSync(outFile, yml, { mode: 0o600 });
  console.log("WROTE (with real credentials):", outFile);
  console.log("⚠  This file contains secrets — never commit it. .mediamtx/ is gitignored.");
  process.exit(0);
})().catch(e => { console.error("Failed:", e.message); process.exit(1); });
