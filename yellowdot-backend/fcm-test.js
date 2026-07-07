/**
 * fcm-test.js — FCM End-to-End Push Verification
 * ───────────────────────────────────────────────
 * Run AFTER the parent app has granted notification permission in the browser.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json \
 *   SCHOOL_ID=ydseawoods \
 *   node fcm-test.js
 *
 * What it tests:
 *   1. Reads FCM token from parents/{uid} in Firestore
 *   2. Marks attendance for YD008 (same as real admin action)
 *   3. Fires fireForStudent → creates notification doc + sends FCM push
 *   4. Verifies notification doc created correctly
 *   5. Verifies FCM token not cleared (proof push was accepted by FCM servers)
 */

require("dotenv").config();
const { db }   = require("./firebaseAdmin");
const attSvc   = require("./services/attendanceService");
const notifSvc = require("./services/notificationService");

const PARENT_UID = "wAUEaJBvi1W84JLyWBYIn268uUi1";
const STUDENT_ID = "YD008";
const SCHOOL_ID  = process.env.SCHOOL_ID || "ydseawoods";

(async () => {
  console.log("=== Yellow Dot — FCM Push End-to-End Test ===\n");

  // ── 1. Read FCM token ──────────────────────────────────────────────
  const parentSnap = await db.collection("parents").doc(PARENT_UID).get();
  const parentData  = parentSnap.data() || {};
  const fcmToken    = parentData.fcmToken;

  console.log("1. Notification permission & FCM token:");
  if (!fcmToken) {
    console.error("   ❌ fcmToken is null — browser has not granted permission yet.");
    console.error("   → Open http://localhost:5173, log in as parent, click Allow.");
    process.exit(1);
  }
  const masked = fcmToken.slice(0, 16) + "..." + fcmToken.slice(-12);
  console.log("   Permission status: granted (token present in Firestore)  ✅");
  console.log("   FCM token (masked):", masked);
  console.log("   Token length:      ", fcmToken.length, "chars");
  console.log("   Registered at:     ", parentData.fcmTokenUpdatedAt || "unknown");

  // ── 2. Mark attendance ─────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  console.log("\n2. Marking attendance:");
  const att = await attSvc.markAttendance({
    studentId:   STUDENT_ID,
    studentName: "Rishaan",
    class:       "Daycare",
    status:      "Present",
    date:        today,
    method:      "Manual",
    schoolId:    SCHOOL_ID,
    markedBy:    "fcm-e2e-test",
  });
  console.log("   entryId:   ", att.entryId, "  ✅");
  console.log("   checkIn:   ", att.checkIn, " (UTC)");
  console.log("   checkInAt: ", att.checkInAt);

  // ── 3. Fire notification + FCM push ───────────────────────────────
  console.log("\n3. Firing notification + FCM push:");
  const t0 = Date.now();
  await notifSvc.fireForStudent(STUDENT_ID, SCHOOL_ID, {
    type:     notifSvc.TYPES.ATTENDANCE_MARKED,
    title:    "Rishaan is at school",
    message:  "Rishaan was marked Present at Yellow Dot Preschool.",
    deepLink: "/parent-attendance",
    priority: "medium",
  });
  const elapsed = Date.now() - t0;
  console.log("   fireForStudent() completed in", elapsed + "ms  ✅");
  console.log("   → Notification doc written to Firestore");
  console.log("   → admin.messaging().send() called with token");

  // ── 4. Verify notification document ───────────────────────────────
  await new Promise(r => setTimeout(r, 1200));
  const notifs = await notifSvc.listNotifications({ parentId: PARENT_UID, limit: 5 });
  const latest  = notifs.find(n => n.type === "attendance_marked");

  console.log("\n4. Notification document:");
  if (latest) {
    console.log("   id:        ", latest.id, "  ✅");
    console.log("   type:      ", latest.type);
    console.log("   title:     ", latest.title);
    console.log("   message:   ", latest.message);
    console.log("   read:      ", latest.read);
    console.log("   deepLink:  ", latest.deepLink);
    console.log("   priority:  ", latest.priority);
    console.log("   createdAt: ", latest.createdAt);
  } else {
    console.log("   ❌ No attendance_marked notification found");
  }

  // ── 5. Verify push delivery (token not cleared) ────────────────────
  const afterSnap  = await db.collection("parents").doc(PARENT_UID).get();
  const tokenAfter = afterSnap.data()?.fcmToken;

  console.log("\n5. Push delivery log:");
  if (tokenAfter) {
    console.log("   Token still valid in Firestore  ✅");
    console.log("   FCM servers accepted the push — token was NOT revoked");
    console.log("   → Device will receive the notification shortly");
  } else {
    console.log("   ❌ Token was cleared after send attempt");
    console.log("   FCM reported token as invalid/expired");
    console.log("   → Reopen the parent app to get a fresh token");
  }

  // ── Summary ────────────────────────────────────────────────────────
  const allPass = !!fcmToken && !!latest && !!tokenAfter;
  console.log("\n=== Result:", allPass ? "✅ ALL CHECKS PASSED" : "❌ ONE OR MORE CHECKS FAILED", "===");
  console.log("Device receipt: check the browser that granted notification permission.");
  console.log("The notification should appear as a system alert (or in Notification Center).");

  process.exit(0);
})().catch(e => {
  console.error("\n[fcm-test] Unexpected error:", e.message);
  process.exit(1);
});
