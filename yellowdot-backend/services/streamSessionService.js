/**
 * streamSessionService.js — short-lived signed stream tokens + audit (CCTV 2B/3)
 * ─────────────────────────────────────────────────────────────────────────────
 * Issues and verifies stream tokens that gate the MediaMTX media plane. The
 * media server calls back (/internal/cctv/auth) to verify a token before
 * serving a path — so credentials/paths are never trusted from the browser.
 *
 * Token: HMAC-SHA256 over a compact JSON payload, signed with
 * CCTV_STREAM_TOKEN_SECRET (falls back to CCTV_ENCRYPTION_KEY, else a per-boot
 * random secret — fine for single-instance; set the env in multi-instance).
 *
 * Audit: writes cctvAuditLogs/{id} for issue / start / stop / deny.
 * No streaming, no credentials handled here.
 */

const crypto = require("crypto");
const { db } = require("../firebaseAdmin");

const TTL_SECONDS = 120;
const auditCol = () => db.collection("cctvAuditLogs");

let _secret = null;
function secret() {
  if (_secret) return _secret;
  _secret = process.env.CCTV_STREAM_TOKEN_SECRET
         || process.env.CCTV_ENCRYPTION_KEY
         || crypto.randomBytes(32).toString("hex"); // per-boot fallback (single instance)
  return _secret;
}

function b64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function sign(payloadStr) {
  return b64url(crypto.createHmac("sha256", secret()).update(payloadStr).digest());
}

/**
 * Issue a stream token. `nowMs` is injected (no Date.now in shared libs that
 * might be journaled); callers pass Date.now().
 * @returns { token, expiresIn, sessionId, mediaMtxPath }
 */
function issueToken({ subjectId, kind, cameraId, mediaMtxPath, centerId, classroom, childId }, nowMs) {
  const iat = Math.floor(nowMs / 1000);
  const exp = iat + TTL_SECONDS;
  const sessionId = b64url(crypto.randomBytes(9));
  const payload = { sub: subjectId, kind, cam: cameraId, p: mediaMtxPath, sid: sessionId, iat, exp };
  const body = b64url(JSON.stringify(payload));
  const token = `${body}.${sign(body)}`;
  return { token, expiresIn: TTL_SECONDS, sessionId, exp };
}

/**
 * Verify a token for a given mediaMtxPath. `nowMs` injected.
 * @returns { valid, reason?, payload? }
 */
function verifyToken(token, expectedPath, nowMs) {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    return { valid: false, reason: "malformed" };
  }
  const [body, mac] = token.split(".");
  const expected = sign(body);
  // constant-time compare
  const a = Buffer.from(mac || ""); const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { valid: false, reason: "bad-signature" };
  }
  let payload;
  try { payload = JSON.parse(Buffer.from(body.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString()); }
  catch { return { valid: false, reason: "bad-payload" }; }
  if (Math.floor(nowMs / 1000) > payload.exp) return { valid: false, reason: "expired" };
  if (expectedPath && payload.p !== expectedPath) return { valid: false, reason: "path-mismatch" };
  return { valid: true, payload };
}

// ── Audit ────────────────────────────────────────────────────────────────────
async function audit(event, data, nowISO) {
  try {
    const id = `${event}-${data.sessionId || "na"}-${nowISO}`;
    await auditCol().doc(id.slice(0, 480)).set({
      event,
      userId:     data.userId     || "",
      userName:   data.userName   || "",
      userEmail:  data.userEmail  || "",
      role:       data.role       || "",
      kind:       data.kind       || "staff",
      cameraId:   data.cameraId   || "",
      cameraName: data.cameraName || "",
      classroom:  data.classroom  || "",
      centerId:   data.centerId   || "",
      childId:    data.childId    || "",
      sessionId:  data.sessionId  || "",
      ip:         data.ip         || "",
      ts:         nowISO,
    });
  } catch (e) {
    console.error("[streamSession] audit write failed:", e.message);
  }
}

module.exports = { issueToken, verifyToken, audit, TTL_SECONDS };
