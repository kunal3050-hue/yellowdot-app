/**
 * notificationService.js — Platform notification engine (Parent Module V2)
 * ─────────────────────────────────────────────────────────────────────────
 * Reusable service any backend module can call to create, read, and manage
 * parent-facing notifications.
 *
 * Collection: notifications/{id}
 *   id, parentId, childId, schoolId, type, title, message,
 *   read, createdAt, deepLink, priority, batchKey, batchCount
 *
 * Usage from a controller:
 *   const notif = require("../services/notificationService");
 *   notif.notifyAsync(() => notif.fireForStudent("YD001", "ydseawoods", {
 *     type: notif.TYPES.CHILD_CHECKED_IN,
 *     title: "Aarav checked in",
 *     message: "Aarav has checked in at Yellow Dot Preschool.",
 *     deepLink: "/parent-attendance",
 *   }));
 *
 * Anti-spam:
 *   Use batchKey to coalesce multiple rapid notifications of the same kind
 *   (e.g. bulk memory uploads). If a notification with the same batchKey
 *   was created within BATCH_WINDOW_MS, the existing one is updated with
 *   an incremented count and revised message.
 *
 * FCM Push:
 *   If a parent has an fcmToken stored in their parents/{uid} doc, a push
 *   notification is also sent via firebase-admin messaging.
 */

const { db, admin } = require("../firebaseAdmin");

const SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";
const nowISO    = () => new Date().toISOString();

// ── Notification types ────────────────────────────────────────────
const TYPES = {
  // Attendance
  CHILD_CHECKED_IN:   "attendance_checkin",
  CHILD_CHECKED_OUT:  "attendance_checkout",
  ATTENDANCE_MARKED:  "attendance_marked",
  // Daily Care
  NAP_STARTED:        "nap_started",
  NAP_ENDED:          "nap_ended",
  FOOD_CONSUMPTION:   "food_consumption",
  CARE_LOGGED:        "care_logged",
  // Memories & Activities
  NEW_MEMORY:         "new_memory",
  NEW_ACTIVITY:       "new_activity",
  // School Communication
  HOLIDAY_ANNOUNCED:  "holiday_announced",
  CIRCULAR_PUBLISHED: "circular_published",
  ANNOUNCEMENT:       "announcement",
  EMERGENCY_CLOSURE:  "emergency_closure",
  // Events
  EVENT_CREATED:      "event_created",
  EVENT_UPDATED:      "event_updated",
  EVENT_REMINDER:     "event_reminder",
  // PTM (Parent-Teacher Meetings)
  PTM_CREATED:        "ptm_created",
  PTM_BOOKED:         "ptm_booked",
  PTM_RESCHEDULED:    "ptm_rescheduled",
  PTM_CANCELLED:      "ptm_cancelled",
  PTM_REMINDER:       "ptm_reminder",
  // Billing
  FEE_REMINDER:       "fee_reminder",
  FEE_DUE_TODAY:      "fee_due_today",
  FEE_OVERDUE:        "fee_overdue",
  PAYMENT_RECEIVED:   "payment_received",
};

// ── Priority levels ───────────────────────────────────────────────
const PRIORITY = {
  HIGH:   "high",
  MEDIUM: "medium",
  LOW:    "low",
};

const TYPE_META = {
  [TYPES.CHILD_CHECKED_IN]:  { priority: PRIORITY.HIGH   },
  [TYPES.CHILD_CHECKED_OUT]: { priority: PRIORITY.HIGH   },
  [TYPES.ATTENDANCE_MARKED]: { priority: PRIORITY.MEDIUM },
  [TYPES.NAP_STARTED]:       { priority: PRIORITY.MEDIUM },
  [TYPES.NAP_ENDED]:         { priority: PRIORITY.MEDIUM },
  [TYPES.FOOD_CONSUMPTION]:  { priority: PRIORITY.MEDIUM },
  [TYPES.CARE_LOGGED]:       { priority: PRIORITY.MEDIUM },
  [TYPES.NEW_MEMORY]:        { priority: PRIORITY.MEDIUM },
  [TYPES.NEW_ACTIVITY]:      { priority: PRIORITY.MEDIUM },
  [TYPES.HOLIDAY_ANNOUNCED]: { priority: PRIORITY.LOW    },
  [TYPES.CIRCULAR_PUBLISHED]:{ priority: PRIORITY.LOW    },
  [TYPES.ANNOUNCEMENT]:      { priority: PRIORITY.LOW    },
  [TYPES.EMERGENCY_CLOSURE]: { priority: PRIORITY.HIGH   },
  [TYPES.EVENT_CREATED]:     { priority: PRIORITY.MEDIUM },
  [TYPES.EVENT_UPDATED]:     { priority: PRIORITY.LOW    },
  [TYPES.EVENT_REMINDER]:    { priority: PRIORITY.MEDIUM },
  [TYPES.PTM_CREATED]:       { priority: PRIORITY.MEDIUM },
  [TYPES.PTM_BOOKED]:        { priority: PRIORITY.MEDIUM },
  [TYPES.PTM_RESCHEDULED]:   { priority: PRIORITY.MEDIUM },
  [TYPES.PTM_CANCELLED]:     { priority: PRIORITY.MEDIUM },
  [TYPES.PTM_REMINDER]:      { priority: PRIORITY.HIGH   },
  [TYPES.FEE_REMINDER]:      { priority: PRIORITY.LOW    },
  [TYPES.FEE_DUE_TODAY]:     { priority: PRIORITY.MEDIUM },
  [TYPES.FEE_OVERDUE]:       { priority: PRIORITY.HIGH   },
  [TYPES.PAYMENT_RECEIVED]:  { priority: PRIORITY.MEDIUM },
};

// Anti-spam: within this window, batch notifications with the same batchKey
const BATCH_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

// ── Collection helper ─────────────────────────────────────────────
const col = () => db.collection("notifications");

// ── Shape a notification doc ──────────────────────────────────────
function buildDoc({ parentId, childId = null, schoolId, type, title, message, deepLink = null, batchKey = null }) {
  const meta = TYPE_META[type] || { priority: PRIORITY.LOW };
  return {
    parentId,
    childId,
    schoolId,
    type,
    title,
    message,
    read:       false,
    createdAt:  nowISO(),
    deepLink,
    priority:   meta.priority,
    batchKey,
    batchCount: 1,
  };
}

// ── Resolve parent UIDs for a given student ───────────────────────
// Uses a single array-contains filter (no composite index required).
// schoolId isolation is enforced in-memory after the fetch.
async function getParentsByStudentId(studentId, schoolId = SCHOOL_ID) {
  if (!studentId) return [];
  const snap = await db.collection("parents")
    .where("studentIds", "array-contains", studentId)
    .get();
  return snap.docs
    .map(d => ({ uid: d.id, ...d.data() }))
    .filter(p => p.schoolId === schoolId);
}

// ── Resolve all parents for a school (for school-wide notifications) ──
async function getAllParents(schoolId = SCHOOL_ID) {
  const snap = await db.collection("parents")
    .where("schoolId", "==", schoolId)
    .get();
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
}

// ── Send FCM push if parent has a token ──────────────────────────
async function sendPush(parent, { title, message, type, deepLink }) {
  const token = parent.fcmToken;
  if (!token) return;
  try {
    await admin.messaging().send({
      token,
      notification: { title, body: message },
      data: {
        type:      type || "",
        deepLink:  deepLink || "",
        createdAt: nowISO(),
      },
      android: { priority: "high" },
      apns:    { payload: { aps: { sound: "default" } } },
    });
  } catch (e) {
    // Invalid/expired FCM token — clear it so we stop trying
    if (e.code === "messaging/registration-token-not-registered") {
      await db.collection("parents").doc(parent.uid).update({ fcmToken: admin.firestore.FieldValue.delete() });
    } else {
      console.warn("[notificationService] FCM push failed:", e.message);
    }
  }
}

// ── Anti-spam: check for a recent notification with the same batchKey ──
// Two equality filters (parentId + batchKey) use single-field indexes — no
// composite index required. Time window and ordering are applied in-memory.
async function findBatchable(parentId, batchKey, windowMs = BATCH_WINDOW_MS) {
  if (!batchKey) return null;
  const snap = await col()
    .where("parentId", "==", parentId)
    .where("batchKey", "==", batchKey)
    .get();
  if (snap.empty) return null;
  const cutoff = new Date(Date.now() - windowMs).toISOString();
  const recent = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(d => (d.createdAt || "") >= cutoff)
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return recent[0] || null;
}

// ── Create a single notification for one parent ───────────────────
// Respects batchKey dedup: if a recent batched notification exists, updates
// it with an incremented count instead of creating a new document.
async function createOne(parent, payload) {
  const { uid: parentId, schoolId } = parent;

  // Anti-spam check
  if (payload.batchKey) {
    const existing = await findBatchable(parentId, payload.batchKey);
    if (existing) {
      const newCount = (existing.batchCount || 1) + 1;
      const updatedMessage = payload.batchMessageFn
        ? payload.batchMessageFn(newCount)
        : payload.message;
      await col().doc(existing.id).update({
        batchCount: newCount,
        message:    updatedMessage,
      });
      return { id: existing.id, batched: true, count: newCount };
    }
  }

  const doc  = buildDoc({ parentId, schoolId, ...payload });
  const ref  = await col().add(doc);
  // Fire push in background — don't await so it never blocks
  sendPush(parent, payload).catch(() => {});
  return { id: ref.id, batched: false };
}

// ── Fire a notification for all parents linked to a student ───────
async function fireForStudent(studentId, schoolId, payload) {
  const parents = await getParentsByStudentId(studentId, schoolId);
  if (!parents.length) return [];
  const results = await Promise.all(parents.map(p => createOne(p, payload)));
  return results;
}

// ── Fire a notification for all parents in a school ───────────────
// Used for holidays, circulars, announcements, emergency closures.
// childId is null; each parent only sees one notification (not one per child).
async function fireForSchool(schoolId, payload) {
  const parents = await getAllParents(schoolId);
  if (!parents.length) return [];

  // Deduplicate by uid in case of duplicates in the collection
  const unique = [...new Map(parents.map(p => [p.uid, p])).values()];
  const results = await Promise.all(unique.map(p => createOne(p, { ...payload, childId: null })));
  return results;
}

// ── Fire-and-forget wrapper — call from controllers ───────────────
// Prevents notification failures from breaking primary operations.
function notifyAsync(fn) {
  Promise.resolve().then(fn).catch(e => {
    console.error("[notificationService] async error:", e.message);
  });
}

// ═══════════════════════════════════════════════════════════════════
// READ / MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

// ── List notifications for a parent ──────────────────────────────
// Single equality filter on parentId — no composite index required.
// Sorting, pagination, and type/child filtering are done in-memory.
async function listNotifications({ parentId, childId, type, limit = 50, before } = {}) {
  const snap = await col()
    .where("parentId", "==", parentId)
    .get();

  let docs = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  if (childId) docs = docs.filter(d => !d.childId || d.childId === childId);
  if (type)    docs = docs.filter(d => d.type === type);
  if (before)  docs = docs.filter(d => (d.createdAt || "") < before);

  return docs.slice(0, Number(limit) || 50);
}

// ── Unread count ──────────────────────────────────────────────────
async function getUnreadCount(parentId) {
  const snap = await col()
    .where("parentId", "==", parentId)
    .where("read", "==", false)
    .get();
  return snap.size;
}

// ── Mark one notification as read ────────────────────────────────
async function markRead(notificationId, parentId) {
  const ref  = col().doc(notificationId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  if (snap.data().parentId !== parentId) return null; // ownership check
  await ref.update({ read: true });
  return { id: notificationId, read: true };
}

// ── Mark all notifications as read for a parent ──────────────────
async function markAllRead(parentId) {
  const snap = await col()
    .where("parentId", "==", parentId)
    .where("read", "==", false)
    .get();

  if (snap.empty) return 0;

  const batch = db.batch();
  snap.docs.forEach(d => batch.update(d.ref, { read: true }));
  await batch.commit();
  return snap.size;
}

// ── Store FCM device token for a parent ──────────────────────────
async function storeFcmToken(parentId, fcmToken) {
  if (!parentId || !fcmToken) return;
  await db.collection("parents").doc(parentId).update({ fcmToken, fcmTokenUpdatedAt: nowISO() });
}

module.exports = {
  TYPES,
  PRIORITY,
  notifyAsync,
  fireForStudent,
  fireForSchool,
  createOne,
  listNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
  storeFcmToken,
  getParentsByStudentId,
};
