/**
 * fixCam7Record.js — one-off data fix for camera CAM-1780298326263 ("cam 7")
 * ─────────────────────────────────────────────────────────────────────────────
 * Legacy record (created before ip/port persistence) had:
 *   ip=undefined, port=undefined, channel="1"
 *   streamUrl="rtsp://182.48.203.40:554/Streaming/Channels/101"
 *
 * Correct values (per working VLC URL rtsp://...@182.48.203.40:554/Streaming/Channels/701):
 *   ip="182.48.203.40", port="554", channel="7"
 *   streamUrl="rtsp://182.48.203.40:554/Streaming/Channels/701"  (credential-free, Phase 1)
 *
 * Dry-run by default; pass --confirm to write. Backs up the doc first.
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { db } = require("../firebaseAdmin");

const CONFIRM   = process.argv.includes("--confirm");
const CAMERA_ID = "CAM-1780298326263";

const TARGET = {
  ip:        "182.48.203.40",
  port:      "554",
  channel:   "7",
  brand:     "Hikvision",
  streamUrl: "rtsp://182.48.203.40:554/Streaming/Channels/701",
};

(async () => {
  console.log("Mode:", CONFIRM ? "APPLY" : "DRY RUN", "| camera:", CAMERA_ID, "\n");
  const ref  = db.collection("cameras").doc(CAMERA_ID);
  const snap = await ref.get();
  if (!snap.exists) { console.log("Camera not found."); process.exit(1); }

  const before = snap.data();
  console.log("BEFORE:", JSON.stringify({
    ip: before.ip, port: before.port, channel: before.channel, streamUrl: before.streamUrl,
  }, null, 2));
  console.log("AFTER :", JSON.stringify(TARGET, null, 2), "\n");

  if (!CONFIRM) { console.log("DRY RUN — nothing written. Re-run with --confirm."); process.exit(0); }

  // Backup
  const backupDir = path.join(__dirname, "..", "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const file = path.join(backupDir, `camera-${CAMERA_ID}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(file, JSON.stringify(before, null, 2));
  console.log("Backup written:", file);

  await ref.update({ ...TARGET, updatedAt: new Date().toISOString(), updatedBy: "fix-cam7-record" });
  const after = (await ref.get()).data();
  console.log("\n✓ Updated. Verified:", JSON.stringify({
    ip: after.ip, port: after.port, channel: after.channel, streamUrl: after.streamUrl,
  }));
  process.exit(0);
})().catch(e => { console.error("✗ Failed:", e.message); process.exit(1); });
