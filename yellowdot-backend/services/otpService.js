/**
 * otpService.js — In-memory OTP store for Yellow Dot mobile login
 * ────────────────────────────────────────────────────────────────
 * Uses a Map for O(1) lookup. Each entry auto-expires after OTP_TTL_MS.
 *
 * Production upgrade path:
 *   - Replace in-memory map with Redis (TTL-native)
 *   - Replace consoleSendSMS with Twilio / Textlocal / MSG91
 *   - Add rate limiting (max 3 requests per mobile per 10 min)
 *   - Add WhatsApp delivery fallback via Meta Cloud API
 */

const crypto = require("crypto");

const OTP_TTL_MS   = 5 * 60 * 1000;  // 5 minutes
const OTP_LENGTH   = 6;
const MAX_ATTEMPTS = 5;               // lock after 5 wrong guesses

// Store: mobile → { code, expiresAt, attempts, createdAt }
const otpStore = new Map();

// ── Cleanup timer: purge expired entries every 5 min ─────────────────────────
setInterval(() => {
  const now = Date.now();
  for (const [mobile, entry] of otpStore.entries()) {
    if (entry.expiresAt < now) otpStore.delete(mobile);
  }
}, OTP_TTL_MS);

// ════════════════════════════════════════════════════════════════════════
// GENERATE & SEND
// ════════════════════════════════════════════════════════════════════════

/**
 * Generate a new OTP for the given mobile number and "send" it.
 * Replaces any existing pending OTP for that number.
 *
 * @param {string} mobile — E.164 format preferred: "+919876543210"
 * @returns {{ sent: true, expiresInSeconds: number }}
 */
async function requestOTP(mobile) {
  const normalised = normaliseMobile(mobile);
  if (!normalised) {
    throw { status: 400, message: "Invalid mobile number." };
  }

  const code      = generateCode();
  const expiresAt = Date.now() + OTP_TTL_MS;

  otpStore.set(normalised, { code, expiresAt, attempts: 0, createdAt: Date.now() });

  // Deliver the OTP
  await sendOTP(normalised, code);

  console.log(`[OTP] SENT  mobile=${mask(normalised)}  expires=${new Date(expiresAt).toISOString()}`);

  return {
    sent:             true,
    expiresInSeconds: Math.floor(OTP_TTL_MS / 1000),
    // In development, also return the code so devs can test without SMS
    ...(process.env.NODE_ENV !== "production" && { _devCode: code }),
  };
}

// ════════════════════════════════════════════════════════════════════════
// VERIFY
// ════════════════════════════════════════════════════════════════════════

/**
 * Verify a submitted OTP against the store.
 * Deletes the entry on success (one-time use).
 * Increments attempt counter on failure.
 *
 * @param {string} mobile
 * @param {string} code — the 6-digit code the user entered
 * @returns {true} on success
 * @throws on failure
 */
function verifyOTP(mobile, code) {
  const normalised = normaliseMobile(mobile);
  const entry      = otpStore.get(normalised);

  if (!entry) {
    throw { status: 400, code: "OTP_NOT_FOUND", message: "No OTP was requested for this number, or it has expired." };
  }

  if (Date.now() > entry.expiresAt) {
    otpStore.delete(normalised);
    throw { status: 400, code: "OTP_EXPIRED", message: "The OTP has expired. Please request a new one." };
  }

  if (entry.attempts >= MAX_ATTEMPTS) {
    otpStore.delete(normalised);
    throw { status: 429, code: "OTP_LOCKED", message: "Too many failed attempts. Please request a new OTP." };
  }

  // Constant-time comparison to prevent timing attacks
  const submitted = String(code).trim();
  const isMatch   = crypto.timingSafeEqual(
    Buffer.from(entry.code),
    Buffer.from(submitted.padEnd(entry.code.length, " ").slice(0, entry.code.length))
  );

  if (!isMatch) {
    entry.attempts += 1;
    console.log(`[OTP] WRONG  mobile=${mask(normalised)}  attempts=${entry.attempts}/${MAX_ATTEMPTS}`);
    throw { status: 400, code: "OTP_INVALID", message: "Incorrect OTP. Please try again." };
  }

  // Success — consume the OTP
  otpStore.delete(normalised);
  console.log(`[OTP] VERIFIED  mobile=${mask(normalised)}`);
  return true;
}

// ════════════════════════════════════════════════════════════════════════
// SMS DELIVERY
// ════════════════════════════════════════════════════════════════════════

/**
 * Send the OTP via SMS.
 * Replace the body of this function with your SMS provider integration:
 *   - Twilio:      client.messages.create({ to, from, body })
 *   - MSG91:       https://msg91.com/apidoc/sendotp
 *   - Textlocal:   https://api.textlocal.in/send/
 *   - Meta/WhatsApp: Cloud API template messages
 */
async function sendOTP(mobile, code) {
  const message = `Your Yellow Dot school login code is: ${code}. Valid for 5 minutes. Do not share this code.`;

  if (process.env.NODE_ENV === "production") {
    // TODO: integrate real SMS provider here
    // Example with Twilio:
    // const twilio = require("twilio")(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
    // await twilio.messages.create({ to: mobile, from: process.env.TWILIO_FROM, body: message });
    console.warn(`[OTP] SMS provider not configured — code NOT sent to ${mask(mobile)}`);
  } else {
    // Development: just log it
    console.log(`[OTP] DEV_SMS  mobile=${mask(mobile)}  message="${message}"`);
  }
}

// ════════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════════

function generateCode() {
  // Cryptographically random 6-digit code (000000–999999)
  const buf = crypto.randomBytes(4);
  const num = buf.readUInt32BE(0) % 1_000_000;
  return String(num).padStart(OTP_LENGTH, "0");
}

function normaliseMobile(mobile) {
  if (!mobile) return null;
  // Strip spaces and dashes; keep leading +
  const clean = String(mobile).replace(/[\s\-().]/g, "");
  // Must be 7–15 digits (optionally leading +)
  if (!/^\+?\d{7,15}$/.test(clean)) return null;
  return clean;
}

function mask(mobile) {
  // Show first 3 and last 2 chars: +9198*****21
  if (!mobile || mobile.length < 6) return "****";
  return mobile.slice(0, 3) + "*".repeat(mobile.length - 5) + mobile.slice(-2);
}

module.exports = { requestOTP, verifyOTP };
