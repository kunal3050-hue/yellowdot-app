/**
 * e2e-push-test.js — End-to-end push notification test
 * ─────────────────────────────────────────────────────
 * Steps:
 *   1. Poll Firestore until fcmToken appears on the parent doc
 *   2. Send a direct FCM test message and capture the response
 *   3. Trigger the full attendance notification flow (fireForStudent)
 *   4. Verify notification document was created
 *   5. Print a pass/fail evidence report
 *
 * Run: node e2e-push-test.js
 *
 * Before running: open the parent app on Android, grant notification
 * permission when prompted — that registers the FCM token.
 */
require("dotenv").config();

const { db, admin } = require("./firebaseAdmin");
const notifSvc = require("./services/notificationService");

const PARENT_UID  = "wAUEaJBvi1W84JLyWBYIn268uUi1";
const STUDENT_ID  = "YD008";
const SCHOOL_ID   = "ydseawoods";
const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS  = 300000; // 5 minutes

const hr = () => "─".repeat(60);
const ts = () => new Date().toISOString();

// ── Step 1: Poll for FCM token ────────────────────────────────────
async function waitForToken() {
  console.log(hr());
  console.log("STEP 1 — Polling for FCM token in parents/" + PARENT_UID);
  console.log("         Open the parent app on Android and grant notification permission.");
  console.log(hr());

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const snap = await db.collection("parents").doc(PARENT_UID).get();
    const data = snap.data() || {};
    const token = data.fcmToken;
    if (token) {
      console.log("\n✅ FCM token found at", ts());
      console.log("   Token (first 20):", token.slice(0, 20) + "...");
      console.log("   fcmTokenUpdatedAt:", data.fcmTokenUpdatedAt || "(not set)");
      console.log("   Parent doc:");
      console.log("     uid:", data.uid);
      console.log("     email:", data.email);
      console.log("     studentIds:", JSON.stringify(data.studentIds));
      console.log("     schoolId:", data.schoolId);
      return token;
    }
    process.stdout.write(".");
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error("Timeout — FCM token not registered within 2 minutes.");
}

// ── Step 2: Direct FCM test message ──────────────────────────────
async function sendDirectFcm(token) {
  console.log("\n" + hr());
  console.log("STEP 2 — Sending direct FCM test message");
  console.log(hr());

  const message = {
    token,
    notification: {
      title: "Yellow Dot Test Push ✅",
      body:  "This is a direct FCM test from the E2E script.",
    },
    data: {
      type:     "test",
      deepLink: "/parent-notifications",
      sentAt:   ts(),
    },
    android: { priority: "high" },
    apns:    { payload: { aps: { sound: "default" } } },
  };

  console.log("   Payload:", JSON.stringify(message, null, 4));

  const messageId = await admin.messaging().send(message);
  console.log("\n✅ FCM accepted the message — messageId:", messageId);
  return messageId;
}

// ── Step 3: Trigger attendance notification flow ──────────────────
async function triggerAttendanceNotification() {
  console.log("\n" + hr());
  console.log("STEP 3 — Triggering attendance notification via fireForStudent()");
  console.log("         (same code path as when teacher marks Present)");
  console.log(hr());

  const before = await db.collection("notifications")
    .where("parentId", "==", PARENT_UID)
    .get();
  const beforeIds = new Set(before.docs.map(d => d.id));
  console.log("   Notifications before:", before.size);

  const results = await notifSvc.fireForStudent(STUDENT_ID, SCHOOL_ID, {
    type:     notifSvc.TYPES.ATTENDANCE_MARKED,
    title:    "Rishaan is at school",
    message:  "Rishaan was marked Present at Yellow Dot Preschool. (E2E test)",
    deepLink: "/parent-attendance",
  });

  console.log("   fireForStudent() returned:", JSON.stringify(results, null, 4));

  // Verify new notification doc was created
  await new Promise(r => setTimeout(r, 2000));
  const after = await db.collection("notifications")
    .where("parentId", "==", PARENT_UID)
    .get();
  const newDocs = after.docs.filter(d => !beforeIds.has(d.id));

  if (newDocs.length > 0) {
    const nd = newDocs[0];
    console.log("\n✅ Notification document created:");
    console.log("   ID:", nd.id);
    console.log("   Data:", JSON.stringify(nd.data(), null, 4));
  } else {
    console.log("⚠️  No new notification document created (may have been batched into existing doc)");
    // Check if existing doc was updated (batching)
    const existing = after.docs.find(d => beforeIds.has(d.id));
    if (existing) {
      console.log("   Existing doc (possibly updated):", existing.id, JSON.stringify(existing.data(), null, 2));
    }
  }

  return results;
}

// ── Step 4: Summary ───────────────────────────────────────────────
function printSummary(token, messageId, fireResults) {
  console.log("\n" + hr());
  console.log("E2E PUSH NOTIFICATION TEST — SUMMARY");
  console.log(hr());
  console.log("  STEP 1 fcmToken in Firestore:  ✅", token.slice(0, 20) + "...");
  console.log("  STEP 2 FCM direct send:        ✅ messageId =", messageId);
  console.log("  STEP 3 fireForStudent():       ✅ results =", JSON.stringify(fireResults));
  console.log("\n  If you received the notification on Android:");
  console.log("    → FCM delivery is working end-to-end ✅");
  console.log("\n  If you did NOT receive the notification:");
  console.log("    → Check Android notification settings for Chrome");
  console.log("    → Ensure the device is not in DND mode");
  console.log("    → Check Firebase Console → Cloud Messaging → Delivery dashboard");
  console.log(hr());
}

// ── Main ──────────────────────────────────────────────────────────
(async () => {
  try {
    const token     = await waitForToken();
    const messageId = await sendDirectFcm(token);
    const results   = await triggerAttendanceNotification();
    printSummary(token, messageId, results);
  } catch (e) {
    console.error("\n❌ E2E test failed:", e.message);
    console.error(e.stack);
    process.exit(1);
  } finally {
    process.exit(0);
  }
})();
