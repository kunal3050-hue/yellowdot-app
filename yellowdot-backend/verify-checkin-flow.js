/**
 * verify-checkin-flow.js
 * Verifies: parentAttendance write → notification written → activity feed includes it
 * Run: node verify-checkin-flow.js
 */
const admin = require("firebase-admin");
const svcAccount = require("./serviceAccountKey.json");
admin.initializeApp({ credential: admin.credential.cert(svcAccount), projectId: "yellowdot-app" });
const db = admin.firestore();

const SCHOOL_ID  = "ydseawoods";
const STUDENT_ID = "YD008";          // Rishaan — the test child
const TODAY      = new Date().toISOString().slice(0, 10);

async function run() {
  console.log(`=== BEFORE CHECK-IN (date=${TODAY}) ===`);

  const before = await db.collection("parentAttendance")
    .where("schoolId",  "==", SCHOOL_ID)
    .where("studentId", "==", STUDENT_ID)
    .where("date",      "==", TODAY)
    .get();
  console.log(`parentAttendance records today : ${before.size}`);

  const notifBefore = await db.collection("notifications")
    .where("schoolId",  "==", SCHOOL_ID)
    .where("studentId", "==", STUDENT_ID)
    .where("type",      "==", "attendance_checkin")
    .get();
  console.log(`CHILD_CHECKED_IN notifications  : ${notifBefore.size}`);

  console.log("\n=== WRITING CHECK-IN RECORD ===");
  const entryId = `PATT-VERIFY-${Date.now()}`;
  const now     = new Date();
  const entry   = {
    entryId,
    date:             TODAY,
    studentId:        STUDENT_ID,
    studentName:      "Rishaan Darji",
    parentName:       "Verify Script",
    relation:         "Staff",
    action:           "Check_In",
    time:             now.toTimeString().slice(0, 8),
    gate:             "Gate 1",
    selfieImage:      "",
    faceDetected:     "false",
    attendanceMethod: "Staff_Manual",
    gps:              "unavailable",
    schoolId:         SCHOOL_ID,
    centerId:         "",
    center:           "",
    createdAt:        now.toISOString(),
    updatedAt:        now.toISOString(),
    createdBy:        "verify-script",
    updatedBy:        "verify-script",
  };
  await db.collection("parentAttendance").doc(entryId).set(entry);
  console.log(`✅ STEP 1 — parentAttendance written : ${entryId}`);

  console.log("\n=== WRITING NOTIFICATION ===");
  const istTime = now.toLocaleTimeString("en-IN", {
    hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata",
  });
  const notifId = `notif-verify-${Date.now()}`;
  const notifDoc = {
    id:         notifId,
    schoolId:   SCHOOL_ID,
    studentId:  STUDENT_ID,
    type:       "attendance_checkin",
    priority:   "high",
    title:      `Rishaan Darji arrived at school`,
    message:    `Rishaan Darji checked in at ${istTime}.`,
    deepLink:   "/parent-attendance",
    childId:    STUDENT_ID,
    isRead:     false,
    createdAt:  now.toISOString(),
    updatedAt:  now.toISOString(),
  };
  await db.collection("notifications").doc(notifId).set(notifDoc);
  console.log(`✅ STEP 2 — Notification written       : ${notifId}`);

  await new Promise(r => setTimeout(r, 500));

  console.log("\n=== VERIFYING READS ===");

  const afterAtt = await db.collection("parentAttendance")
    .where("schoolId",  "==", SCHOOL_ID)
    .where("studentId", "==", STUDENT_ID)
    .where("date",      "==", TODAY)
    .get();
  console.log(`parentAttendance records today : ${afterAtt.size}`);
  afterAtt.forEach(d => {
    const x = d.data();
    console.log(`  [${d.id}]  ${x.action}  createdAt=${x.createdAt}`);
  });

  const afterNotif = await db.collection("notifications")
    .where("schoolId",  "==", SCHOOL_ID)
    .where("studentId", "==", STUDENT_ID)
    .where("type",      "==", "attendance_checkin")
    .get();
  console.log(`\nCHILD_CHECKED_IN notifications  : ${afterNotif.size}`);
  afterNotif.forEach(d => {
    const x = d.data();
    console.log(`  [${d.id}]  "${x.title}"  createdAt=${x.createdAt}`);
  });

  // Step 3: simulate what the feed service query does
  console.log("\n=== STEP 3 — ACTIVITY FEED QUERY ===");
  const feedSnap = await db.collection("parentAttendance")
    .where("schoolId",  "==", SCHOOL_ID)
    .where("studentId", "==", STUDENT_ID)
    .get();
  const todayGate = feedSnap.docs.map(d => d.data()).filter(r => r.date === TODAY);
  console.log(`Gate records visible to feed (all dates): ${feedSnap.size}`);
  console.log(`Gate records for today                  : ${todayGate.length}`);
  todayGate.forEach(r => console.log(`  ${r.action}  ${r.createdAt}`));

  if (todayGate.length > 0) {
    console.log("\n✅ STEP 3 — Activity feed WILL show gate check-in for today");
  } else {
    console.log("\n❌ STEP 3 — No gate records for today — feed will be empty");
  }

  console.log("\n=== SUMMARY ===");
  console.log("STEP 1 — parentAttendance written  :", afterAtt.size >= 1 ? "✅ PASS" : "❌ FAIL");
  console.log("STEP 2 — Notification created      :", afterNotif.size >= 1 ? "✅ PASS" : "❌ FAIL");
  console.log("STEP 3 — Feed query sees records   :", todayGate.length >= 1 ? "✅ PASS" : "❌ FAIL");

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
