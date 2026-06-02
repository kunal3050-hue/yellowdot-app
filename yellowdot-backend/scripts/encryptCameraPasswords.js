/**
 * encryptCameraPasswords.js — migrate existing plaintext camera passwords
 * ─────────────────────────────────────────────────────────────────────────────
 * Pays down CCTV-V2-TD-001. Reads every camera, and for any with a plaintext
 * (non-encrypted, non-empty) password, re-encrypts it with cryptoService
 * (AES-256-GCM) and writes it back. Idempotent — already-encrypted values are
 * skipped (cryptoService.isEncrypted()).
 *
 * REQUIRES CCTV_ENCRYPTION_KEY to be set (else nothing can be encrypted).
 *
 * SAFETY:
 *   • Dry-run by default — reports what WOULD change, writes nothing.
 *   • --confirm to apply.
 *   • Backs up affected docs (full, INCLUDING current password) before writing.
 *   • Never logs plaintext passwords.
 *
 * Usage (from yellowdot-backend/):
 *   node scripts/encryptCameraPasswords.js            # dry run
 *   node scripts/encryptCameraPasswords.js --confirm  # apply
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { db } = require("../firebaseAdmin");
const crypto = require("../services/cryptoService");

const CONFIRM = process.argv.includes("--confirm");

(async () => {
  console.log("═══════════════════════════════════════════════");
  console.log("  CCTV camera password encryption migration");
  console.log("  Mode:", CONFIRM ? "APPLY" : "DRY RUN", "| key:", crypto.isEnabled() ? "present" : "MISSING");
  console.log("═══════════════════════════════════════════════\n");

  if (!crypto.isEnabled()) {
    console.error("✗ CCTV_ENCRYPTION_KEY is not set/valid. Set it before running this migration.");
    process.exit(1);
  }

  const snap = await db.collection("cameras").get();
  const targets = [];
  snap.docs.forEach(d => {
    const data = d.data() || {};
    const pw = data.password || "";
    if (pw && !crypto.isEncrypted(pw)) {
      targets.push({ id: d.id, name: data.cameraName || "", data });
    }
  });

  console.log(`Cameras total: ${snap.size}  |  plaintext passwords to encrypt: ${targets.length}`);
  targets.forEach(t => console.log(`  - ${t.id}  (${t.name})  password length=${(t.data.password || "").length}`));
  console.log("");

  if (targets.length === 0) { console.log("Nothing to migrate."); process.exit(0); }

  if (!CONFIRM) {
    console.log("DRY RUN — nothing written. Re-run with --confirm to apply.");
    process.exit(0);
  }

  // Backup (full docs, including current plaintext) before mutating.
  const backupDir = path.join(__dirname, "..", "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const file = path.join(backupDir, `cameras-pwd-pre-encrypt-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(file, JSON.stringify(targets.map(t => ({ id: t.id, data: t.data })), null, 2));
  console.log("Backup written:", file, "\n");

  let ok = 0;
  for (const t of targets) {
    const enc = crypto.encrypt(t.data.password);
    await db.collection("cameras").doc(t.id).update({
      password: enc,
      updatedAt: new Date().toISOString(),
      updatedBy: "pwd-encrypt-migration",
    });
    ok++;
    console.log(`  ✓ encrypted ${t.id}`);
  }

  console.log(`\n✅ Done. Encrypted ${ok}/${targets.length} camera password(s).`);
  process.exit(0);
})().catch(e => { console.error("✗ Failed:", e.message); process.exit(1); });
