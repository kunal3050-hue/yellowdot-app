/**
 * cctvService.js — Firestore-backed CCTV camera management (V2 Phase 1)
 * ──────────────────────────────────────────────────────────────────────
 * Collection: cameras/{cameraId}
 * Fields: cameraId, cameraCode, cameraName, classroom, classrooms[],
 *         brand, streamUrl, username, password, channel, streamType,
 *         status, deleted, deletedAt, schoolId, centerId, center,
 *         createdAt, updatedAt, createdBy, updatedBy
 *
 * Phase 1 scope: metadata CRUD only. No streaming / FFmpeg / HLS.
 *
 * Design notes:
 *   • Delete is SOFT (deleted=true + deletedAt); records are never erased.
 *   • cameraCode is unique within a center (enforced on create/update).
 *   • Classroom mapping stored as BOTH `classroom` (string, current single
 *     mapping) and `classrooms` (array) so future one→many mapping is a
 *     non-breaking change — no schema migration required later.
 */

const { db } = require("../firebaseAdmin");
const crypto = require("./cryptoService");

const SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";
const col = () => db.collection("cameras");

// Encrypt a camera password for storage. If no encryption key is configured,
// fall back to storing plaintext but warn loudly (dev convenience; prod must
// set CCTV_ENCRYPTION_KEY). Already-encrypted values pass through untouched.
//
// TECH DEBT — CCTV-V2-TD-001 (see docs/TECH_DEBT.md):
//   Plaintext storage is ACCEPTED for Phase 1 (internal camera management).
//   Before Phase 3 (Live View) or Phase 4 (Parent Access): set
//   CCTV_ENCRYPTION_KEY in production, migrate existing passwords, and make
//   a missing key fatal for streaming/parent paths.
function encPassword(pw) {
  if (!pw) return "";
  if (crypto.isEncrypted(pw)) return pw;
  if (!crypto.isEnabled()) {
    console.warn("[cctvService] CCTV_ENCRYPTION_KEY not set — storing camera password WITHOUT encryption (CCTV-V2-TD-001). Set the key before Live View / Parent Access.");
    return pw;
  }
  return crypto.encrypt(pw);
}

function nowISO() { return new Date().toISOString(); }

function docToCamera(snap) {
  const d = (snap.data && snap.data()) || {};
  const classroom  = d.classroom || "";
  const classrooms = Array.isArray(d.classrooms) && d.classrooms.length
    ? d.classrooms
    : (classroom ? [classroom] : []);
  return {
    cameraId:   d.cameraId   || snap.id,
    cameraCode: d.cameraCode || "",
    cameraName: d.cameraName || "",
    classroom,                       // primary (single) mapping — Phase 1
    classrooms,                      // forward-compatible multi-mapping
    brand:      d.brand      || "",
    ip:         d.ip         || "",
    port:       d.port       || "",
    streamUrl:  d.streamUrl  || "",
    username:   d.username   || "",
    password:   d.password   || "",
    channel:    d.channel    || "",
    streamType: d.streamType || "RTSP",
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
}

// ── Uniqueness: cameraCode must be unique within a center ──────────────
// Returns the conflicting camera (non-deleted) if one exists, else null.
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

  // Enforce per-center code uniqueness.
  if (cameraCode) {
    const clash = await findByCode(cameraCode, { schoolId, centerId: resolvedCenter });
    if (clash) {
      const err = new Error(`Camera code "${cameraCode}" already exists in this center.`);
      err.code = "DUPLICATE_CAMERA_CODE";
      throw err;
    }
  }

  const cameraId   = `CAM-${Date.now()}`;
  const classroom  = data.classroom || "";
  const classrooms = Array.isArray(data.classrooms) && data.classrooms.length
    ? data.classrooms
    : (classroom ? [classroom] : []);

  const doc = {
    cameraId,
    cameraCode,
    cameraName: data.cameraName || data.camera_name || "",
    classroom,
    classrooms,
    brand:      data.brand      || "",
    ip:         data.ip         || "",
    port:       String(data.port || "554"),
    streamUrl:  data.streamUrl  || data.stream_url  || "",
    username:   data.username   || "",
    password:   encPassword(data.password || ""),
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

  // Code uniqueness on change.
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

  const updates = {
    updatedAt: nowISO(),
    updatedBy,
    ...(data.cameraCode !== undefined && { cameraCode: String(data.cameraCode).trim() }),
    ...(data.cameraName !== undefined && { cameraName: data.cameraName }),
    ...(data.brand      !== undefined && { brand:      data.brand      }),
    ...(data.ip         !== undefined && { ip:         data.ip         }),
    ...(data.port       !== undefined && { port:       String(data.port) }),
    ...(data.streamUrl  !== undefined && { streamUrl:  data.streamUrl  }),
    ...(data.username   !== undefined && { username:   data.username   }),
    ...(data.password   !== undefined && { password:   encPassword(data.password) }),
    ...(data.channel    !== undefined && { channel:    String(data.channel) }),
    ...(data.streamType !== undefined && { streamType: data.streamType }),
    ...(data.status     !== undefined && { status:     data.status     }),
  };

  // Keep classroom (single) and classrooms (array) in sync.
  if (data.classrooms !== undefined && Array.isArray(data.classrooms)) {
    updates.classrooms = data.classrooms;
    updates.classroom  = data.classrooms[0] || "";
  } else if (data.classroom !== undefined) {
    updates.classroom  = data.classroom;
    updates.classrooms = data.classroom ? [data.classroom] : [];
  }

  await ref.update(updates);
  return docToCamera(await ref.get());
}

// ── Soft delete (record is retained; flagged deleted) ──────────────────
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

module.exports = { getAll, getOne, getOneWithSecret, create, update, remove, findByCode };
