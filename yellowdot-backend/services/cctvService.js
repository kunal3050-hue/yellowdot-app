/**
 * cctvService.js — Firestore-backed CCTV camera management (V2)
 * ──────────────────────────────────────────────────────────────────────
 * Collection: cameras/{cameraId}
 *
 * Classroom assignment model (timeline-based):
 *   timeline[]  — ordered array of { id, classroom, days[], startTime, endTime }
 *                 representing which classroom this camera serves at which times.
 *   classrooms  — flat array of all classrooms the camera ever serves (derived
 *                 from timeline on write; used for teacher scoping + queries).
 *   classroom   — primary classroom string (first timeline entry's classroom).
 *
 * Backward compatibility: cameras without a timeline[] keep working via the
 * static classrooms[] field; docToCamera emits both fields.
 *
 * Design notes:
 *   • Delete is SOFT (deleted=true + deletedAt); records are never erased.
 *   • cameraCode is unique within a center (enforced on create/update).
 *   • viewingSchedule is deprecated — superseded by timeline[].
 */

const { db } = require("../firebaseAdmin");
const crypto = require("./cryptoService");
const { streamUrls, mediaMtxPath } = require("./cctvStreamPaths");

const SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";
const col = () => db.collection("cameras");

// Encrypt a camera password for storage. Enforcement model (CCTV-V2-TD-001):
//   • CCTV_REQUIRE_ENCRYPTION=true + valid key → encrypt (production).
//   • CCTV_REQUIRE_ENCRYPTION=true + NO key    → THROW (fail closed; never
//     silently store plaintext when encryption is mandated).
//   • flag unset + key present                 → encrypt.
//   • flag unset + no key (dev only)           → warn + store plaintext.
// Already-encrypted values pass through untouched.
function encPassword(pw) {
  if (!pw) return "";
  if (crypto.isEncrypted(pw)) return pw;

  if (crypto.isRequired() && !crypto.isEnabled()) {
    throw new Error(
      "CCTV_REQUIRE_ENCRYPTION=true but CCTV_ENCRYPTION_KEY is missing/invalid — " +
      "refusing to store a camera password in plaintext."
    );
  }
  if (!crypto.isEnabled()) {
    console.warn("[cctvService] CCTV_ENCRYPTION_KEY not set — storing camera password WITHOUT encryption (CCTV-V2-TD-001). Set the key + CCTV_REQUIRE_ENCRYPTION before Live View / Parent Access.");
    return pw;
  }
  return crypto.encrypt(pw);
}

function nowISO() { return new Date().toISOString(); }

// Detects and strips embedded "user:pass@" credentials from a custom RTSP/
// stream URL (e.g. "rtsp://admin:secret@192.168.1.5:554/stream1"), so
// credentials are never stored (or displayed) as part of streamUrl -- they
// always live in the dedicated username/password fields instead, which are
// the only fields mask()/encryption already know how to protect.
// Never throws on a malformed or plain URL.
function extractUrlCredentials(streamUrl) {
  const url = String(streamUrl || "");
  const m = url.match(/^(\w+:\/\/)([^:/@\s]+):([^@\s]+)@(.+)$/);
  if (!m) return { cleanUrl: url, username: "", password: "" };
  const [, scheme, user, pass, rest] = m;
  return { cleanUrl: `${scheme}${rest}`, username: user, password: pass };
}

// Derive the flat classrooms[] list and primary classroom string from a
// timeline[]. Deduplicates, preserves insertion order.
// Falls back to legacy classrooms[]/classroom when no timeline is present.
function deriveFromTimeline(timeline, legacyClassrooms, legacyClassroom) {
  if (Array.isArray(timeline) && timeline.length) {
    const seen = new Set();
    const list = [];
    for (const e of timeline) {
      const c = (e.classroom || "").trim();
      if (c && !seen.has(c)) { seen.add(c); list.push(c); }
    }
    return { classrooms: list, classroom: list[0] || "" };
  }
  const classrooms = Array.isArray(legacyClassrooms) && legacyClassrooms.length
    ? legacyClassrooms
    : (legacyClassroom ? [legacyClassroom] : []);
  return { classrooms, classroom: classrooms[0] || "" };
}

function docToCamera(snap) {
  const d = (snap.data && snap.data()) || {};
  const timeline  = Array.isArray(d.timeline) ? d.timeline : [];
  const { classrooms, classroom } = deriveFromTimeline(
    timeline, d.classrooms, d.classroom
  );
  const base = {
    cameraId:   d.cameraId   || snap.id,
    cameraCode: d.cameraCode || "",
    cameraName: d.cameraName || "",
    classroom,
    classrooms,
    timeline,
    brand:      d.brand      || "",
    ip:         d.ip         || "",
    port:       d.port       || "",
    streamUrl:  d.streamUrl  || "",
    username:   d.username   || "",
    password:   d.password   || "",
    channel:    d.channel    || "",
    streamType: d.streamType || "RTSP",
    substreamCodec: d.substreamCodec || "",
    status:     d.status     || "Active",
    deleted:    d.deleted    === true,
    deletedAt:  d.deletedAt  || null,
    schoolId:   d.schoolId   || SCHOOL_ID,
    centerId:   d.centerId   || d.center || "",
    center:     d.centerId   || d.center || "",
    createdAt:  d.createdAt  || "",
    updatedAt:  d.updatedAt  || "",
    // snake_case aliases (house style)
    camera_id:   d.cameraId   || snap.id,
    camera_code: d.cameraCode || "",
    camera_name: d.cameraName || "",
    stream_url:  d.streamUrl  || "",
    stream_type: d.streamType || "RTSP",
  };
  // Derived, credential-free stream paths (main = verification, sub = live).
  const urls = streamUrls(base);
  base.mainStreamUrl = urls.mainStreamUrl;
  base.liveStreamUrl = urls.liveStreamUrl;
  base.mediaMtxPath  = mediaMtxPath(base);
  return base;
}

// ── Uniqueness: cameraCode must be unique within a center ──────────────
async function findByCode(cameraCode, { schoolId, centerId, excludeId } = {}) {
  if (!cameraCode) return null;
  const code = String(cameraCode).trim().toLowerCase();
  const snap = await col().where("schoolId", "==", schoolId).get();
  const hit = snap.docs
    .map(docToCamera)
    .find(c =>
      !c.deleted &&
      (c.centerId || "") === (centerId || "") &&
      c.cameraCode.trim().toLowerCase() === code &&
      c.cameraId !== excludeId
    );
  return hit || null;
}

// ── List (excludes soft-deleted by default) ───────────────────────────
async function getAll({ schoolId = SCHOOL_ID, centerId, includeDeleted = false } = {}) {
  const snap = await col().where("schoolId", "==", schoolId).get();
  let cameras = snap.docs.map(docToCamera);
  if (!includeDeleted) cameras = cameras.filter(c => !c.deleted);
  if (centerId) cameras = cameras.filter(c => c.centerId === centerId);
  cameras.sort((a, b) => a.cameraName.localeCompare(b.cameraName));
  return cameras;
}

async function getOne(cameraId) {
  const snap = await col().doc(cameraId).get();
  return snap.exists ? docToCamera(snap) : null;
}

// Server-side only: returns the camera with its DECRYPTED password, for use
// by the verification engine when composing the live RTSP URL. NEVER return
// this object to a client — the controller must not serialize it directly.
async function getOneWithSecret(cameraId) {
  const snap = await col().doc(cameraId).get();
  if (!snap.exists) return null;
  const cam = docToCamera(snap);
  const stored = (snap.data() || {}).password || "";
  let plain = "";
  try { plain = crypto.decrypt(stored); } catch { plain = ""; }
  return { ...cam, password: plain };
}

async function create(data, { schoolId = SCHOOL_ID, centerId = "", actorUserId = "system" } = {}) {
  const resolvedCenter = centerId || data.centerId || data.center || "";
  const cameraCode     = String(data.cameraCode || data.camera_code || "").trim();

  if (cameraCode) {
    const clash = await findByCode(cameraCode, { schoolId, centerId: resolvedCenter });
    if (clash) {
      const err = new Error(`Camera code "${cameraCode}" already exists in this center.`);
      err.code = "DUPLICATE_CAMERA_CODE";
      throw err;
    }
  }

  const cameraId = `CAM-${Date.now()}`;
  const timeline = Array.isArray(data.timeline) ? data.timeline : [];
  const { classrooms, classroom } = deriveFromTimeline(
    timeline, data.classrooms, data.classroom
  );

  // Never let a custom RTSP URL carry plaintext credentials at rest --
  // extract them into username/password if present. Explicit username/
  // password fields, when supplied, win over anything embedded in the URL.
  const parsedUrl = extractUrlCredentials(data.streamUrl || data.stream_url || "");

  const doc = {
    cameraId,
    cameraCode,
    cameraName:  data.cameraName || data.camera_name || "",
    classroom,
    classrooms,
    timeline,
    brand:      data.brand      || "",
    ip:         data.ip         || "",
    port:       String(data.port || "554"),
    streamUrl:  parsedUrl.cleanUrl,
    username:   data.username   || parsedUrl.username || "",
    password:   encPassword(data.password || parsedUrl.password || ""),
    channel:    String(data.channel || "1"),
    streamType: data.streamType || data.stream_type || "RTSP",
    status:     data.status     || "Active",
    deleted:    false,
    deletedAt:  null,
    schoolId,
    centerId:   resolvedCenter,
    center:     resolvedCenter,
    createdAt:  nowISO(),
    updatedAt:  nowISO(),
    createdBy:  actorUserId,
    updatedBy:  actorUserId,
  };
  await col().doc(cameraId).set(doc);
  return docToCamera({ id: cameraId, data: () => doc });
}

async function update(cameraId, data, { updatedBy = "system" } = {}) {
  const ref  = col().doc(cameraId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const current = docToCamera(snap);

  if (data.cameraCode !== undefined) {
    const newCode = String(data.cameraCode).trim();
    if (newCode && newCode.toLowerCase() !== current.cameraCode.trim().toLowerCase()) {
      const clash = await findByCode(newCode, {
        schoolId: current.schoolId, centerId: current.centerId, excludeId: cameraId,
      });
      if (clash) {
        const err = new Error(`Camera code "${newCode}" already exists in this center.`);
        err.code = "DUPLICATE_CAMERA_CODE";
        throw err;
      }
    }
  }

  // Never let a custom RTSP URL carry plaintext credentials at rest --
  // extract them into username/password if present. Explicit username/
  // password fields in this same update call win over anything embedded
  // in the URL.
  const parsedUrl = data.streamUrl !== undefined
    ? extractUrlCredentials(data.streamUrl)
    : null;

  const updates = {
    updatedAt: nowISO(),
    updatedBy,
    ...(data.cameraCode !== undefined && { cameraCode: String(data.cameraCode).trim() }),
    ...(data.cameraName !== undefined && { cameraName: data.cameraName }),
    ...(data.brand      !== undefined && { brand:      data.brand      }),
    ...(data.ip         !== undefined && { ip:         data.ip         }),
    ...(data.port       !== undefined && { port:       String(data.port) }),
    ...(parsedUrl && { streamUrl: parsedUrl.cleanUrl }),
    ...(data.username !== undefined ? { username: data.username }
        : parsedUrl && parsedUrl.username ? { username: parsedUrl.username } : {}),
    ...(data.password !== undefined ? { password: encPassword(data.password) }
        : parsedUrl && parsedUrl.password ? { password: encPassword(parsedUrl.password) } : {}),
    ...(data.channel    !== undefined && { channel:    String(data.channel) }),
    ...(data.streamType !== undefined && { streamType: data.streamType }),
    ...(data.status     !== undefined && { status:     data.status     }),
  };

  // Timeline update: re-derive classrooms[] + classroom from the new entries.
  if (Array.isArray(data.timeline)) {
    const { classrooms, classroom } = deriveFromTimeline(data.timeline, [], "");
    updates.timeline   = data.timeline;
    updates.classrooms = classrooms;
    updates.classroom  = classroom;
  } else if (data.classrooms !== undefined && Array.isArray(data.classrooms)) {
    // Legacy path (no timeline supplied — keep classrooms in sync).
    updates.classrooms = data.classrooms;
    updates.classroom  = data.classrooms[0] || "";
  } else if (data.classroom !== undefined) {
    updates.classroom  = data.classroom;
    updates.classrooms = data.classroom ? [data.classroom] : [];
  }

  await ref.update(updates);
  return docToCamera(await ref.get());
}

// ── Soft delete ────────────────────────────────────────────────────────
async function remove(cameraId, { actorUserId = "system" } = {}) {
  const ref  = col().doc(cameraId);
  const snap = await ref.get();
  if (!snap.exists) return false;
  await ref.update({
    deleted:   true,
    deletedAt: nowISO(),
    status:    "Deleted",
    updatedBy: actorUserId,
    updatedAt: nowISO(),
  });
  return true;
}

module.exports = { getAll, getOne, getOneWithSecret, create, update, remove, findByCode, extractUrlCredentials };
