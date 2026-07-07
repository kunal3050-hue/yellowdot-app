require("dotenv").config();
const { db } = require("./firebaseAdmin");

const PARENT_UID = "wAUEaJBvi1W84JLyWBYIn268uUi1";

(async () => {
  const snap = await db.collection("parents").doc(PARENT_UID).get();
  const d = snap.data() || {};

  console.log("\n══ PARENT DOCUMENT — parents/" + PARENT_UID + " ══");
  console.log("  uid:               ", d.uid);
  console.log("  email:             ", d.email);
  console.log("  schoolId:          ", d.schoolId);
  console.log("  studentIds:        ", JSON.stringify(d.studentIds));
  console.log("  fcmToken:          ", d.fcmToken ? d.fcmToken.slice(0, 20) + "..." + d.fcmToken.slice(-8) : "NULL ← not registered");
  console.log("  fcmTokenUpdatedAt: ", d.fcmTokenUpdatedAt || "NULL ← never set");
  console.log("  createdAt:         ", d.createdAt);

  process.exit(0);
})();
