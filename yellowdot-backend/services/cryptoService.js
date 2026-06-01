/**
 * cryptoService.js — symmetric encryption for secrets at rest (AES-256-GCM)
 * ─────────────────────────────────────────────────────────────────────────────
 * Used to encrypt camera credentials (passwords) before storing in Firestore.
 * The plaintext is never returned to the client; only the Stream Engine
 * (server-side) decrypts it when composing the final RTSP URL.
 *
 * Key: process.env.CCTV_ENCRYPTION_KEY
 *   - 32-byte key, provided as 64 hex chars OR a base64 string.
 *   - Generate one with:  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * Stored format (string):  "enc:v1:<iv_b64>:<tag_b64>:<ciphertext_b64>"
 *   The "enc:v1:" prefix lets us detect encrypted values and migrate later.
 *
 * If no key is configured, encrypt()/decrypt() throw — callers decide whether
 * that's fatal. isEnabled() lets callers branch (e.g. warn + skip in dev).
 */

const crypto = require("crypto");

const ALGO   = "aes-256-gcm";
const PREFIX = "enc:v1:";

function loadKey() {
  const raw = process.env.CCTV_ENCRYPTION_KEY;
  if (!raw) return null;
  let key;
  if (/^[0-9a-fA-F]{64}$/.test(raw.trim())) {
    key = Buffer.from(raw.trim(), "hex");
  } else {
    try { key = Buffer.from(raw.trim(), "base64"); } catch { key = null; }
  }
  if (!key || key.length !== 32) {
    console.warn("[cryptoService] CCTV_ENCRYPTION_KEY is set but is not a valid 32-byte key (need 64 hex chars or base64 of 32 bytes).");
    return null;
  }
  return key;
}

function isEnabled() {
  return loadKey() !== null;
}

function isEncrypted(value) {
  return typeof value === "string" && value.startsWith(PREFIX);
}

function encrypt(plaintext) {
  if (plaintext == null || plaintext === "") return "";
  const key = loadKey();
  if (!key) throw new Error("CCTV_ENCRYPTION_KEY not configured — cannot encrypt secret.");
  const iv  = crypto.randomBytes(12); // GCM standard nonce size
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

function decrypt(stored) {
  if (!isEncrypted(stored)) return stored; // plaintext / legacy — return as-is
  const key = loadKey();
  if (!key) throw new Error("CCTV_ENCRYPTION_KEY not configured — cannot decrypt secret.");
  const [, , ivB64, tagB64, ctB64] = stored.split(":");
  const iv  = Buffer.from(ivB64,  "base64");
  const tag = Buffer.from(tagB64, "base64");
  const ct  = Buffer.from(ctB64,  "base64");
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

module.exports = { encrypt, decrypt, isEnabled, isEncrypted };
