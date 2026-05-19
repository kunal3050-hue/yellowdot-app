/**
 * cctvService.js — Firestore-backed CCTV camera management
 * ──────────────────────────────────────────────────────────
 * Collection: cameras/{cameraId}
 * Fields: cameraId, cameraName, classroom, brand, streamUrl,
 *         username, password, channel, streamType, status,
 *         schoolId, centerId, center, createdAt, updatedAt
 */

const { db } = require("../firebaseAdmin");

const SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";
const col = () => db.collection("cameras");

function nowISO() { return new Date().toISOString(); }

function docToCamera(snap) {
  const d = snap.data() || {};
  return {
    // camelCase (primary)
    cameraId:   d.cameraId   || snap.id,
    cameraName: d.cameraName || "",
    classroom:  d.classroom  || "",
    brand:      d.brand      || "",
    streamUrl:  d.streamUrl  || "",
    username:   d.username   || "",
    password:   d.password   || "",
    channel:    d.channel    || "",
    streamType: d.streamType || "rtsp",
    status:     d.status     || "Active",
    schoolId:   d.schoolId   || SCHOOL_ID,
    centerId:   d.centerId   || d.center || "",
    center:     d.centerId   || d.center || "",
    createdAt:  d.createdAt  || "",
    updatedAt:  d.updatedAt  || "",
    // snake_case aliases for backward compatibility
    camera_id:   d.cameraId   || snap.id,
    camera_name: d.cameraName || "",
    stream_url:  d.streamUrl  || "",
    stream_type: d.streamType || "rtsp",
  };
}

async function getAll({ schoolId = SCHOOL_ID, centerId } = {}) {
  const snap = await col().where("schoolId", "==", schoolId).get();
  let cameras = snap.docs.map(docToCamera);
  if (centerId) cameras = cameras.filter(c => c.centerId === centerId);
  cameras.sort((a, b) => a.cameraName.localeCompare(b.cameraName));
  return cameras;
}

async function getOne(cameraId) {
  const ref  = col().doc(cameraId);
  const snap = await ref.get();
  return snap.exists ? docToCamera(snap) : null;
}

async function create(data, { schoolId = SCHOOL_ID, centerId = "", actorUserId = "system" } = {}) {
  const cameraId       = `CAM-${Date.now()}`;
  const resolvedCenter = centerId || data.centerId || data.center || "";
  const doc = {
    cameraId,
    cameraName: data.cameraName || data.camera_name || "",
    classroom:  data.classroom  || "",
    brand:      data.brand      || "",
    streamUrl:  data.streamUrl  || data.stream_url  || "",
    username:   data.username   || "",
    password:   data.password   || "",
    channel:    data.channel    || "",
    streamType: data.streamType || data.stream_type || "rtsp",
    status:     "Active",
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
  const updates = {
    updatedAt: nowISO(),
    updatedBy,
    ...(data.cameraName !== undefined && { cameraName: data.cameraName }),
    ...(data.classroom  !== undefined && { classroom:  data.classroom  }),
    ...(data.brand      !== undefined && { brand:      data.brand      }),
    ...(data.streamUrl  !== undefined && { streamUrl:  data.streamUrl  }),
    ...(data.username   !== undefined && { username:   data.username   }),
    ...(data.password   !== undefined && { password:   data.password   }),
    ...(data.channel    !== undefined && { channel:    data.channel    }),
    ...(data.streamType !== undefined && { streamType: data.streamType }),
    ...(data.status     !== undefined && { status:     data.status     }),
  };
  await ref.update(updates);
  const updated = await ref.get();
  return docToCamera(updated);
}

async function remove(cameraId) {
  const ref  = col().doc(cameraId);
  const snap = await ref.get();
  if (!snap.exists) return false;
  await ref.delete();
  return true;
}

module.exports = { getAll, getOne, create, update, remove };
