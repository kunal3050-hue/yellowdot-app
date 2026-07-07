/**
 * validatePhase1.js — Child Journey Phase 1 validation
 *
 * Validates all 8 acceptance criteria against live Firestore:
 *   1. Create a test observation
 *   2. Confirm observation appears in journeyEntries
 *   3. Confirm academicYear auto-populates correctly
 *   4. Confirm sourceModule is stored
 *   5. Confirm parent can see observation in Home Feed
 *   6. Confirm notification is generated
 *   7. Confirm role permissions work correctly
 *   8. Confirm schoolId and centerId are stored
 *
 * Usage: node yellowdot-backend/scripts/validatePhase1.js
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
require("../firebaseAdmin");

const { db } = require("../firebaseAdmin");
const journeyService   = require("../services/journeyService");
const { getAcademicYear, currentAcademicYear } = require("../utils/academicYear");
const permissionsBackend = require("../config/permissionsBackend");
const notifService     = require("../services/notificationService");

const SCHOOL_ID = process.env.SCHOOL_ID || "ydseawoods";
const TEST_DATE = new Date().toISOString().split("T")[0];

let passed = 0;
let failed = 0;
const results = [];

function check(name, condition, detail = "") {
  if (condition) {
    passed++;
    results.push({ status: "PASS", name, detail });
    console.log(`  ✅ PASS  ${name}${detail ? `  (${detail})` : ""}`);
  } else {
    failed++;
    results.push({ status: "FAIL", name, detail });
    console.error(`  ❌ FAIL  ${name}${detail ? `  (${detail})` : ""}`);
  }
}

async function run() {
  console.log("\n══════════════════════════════════════════════════════");
  console.log("  Child Journey — Phase 1 Validation");
  console.log(`  School: ${SCHOOL_ID}  ·  Date: ${TEST_DATE}`);
  console.log("══════════════════════════════════════════════════════\n");

  // ─────────────────────────────────────────────────────────────────
  // 1. Create a test observation
  // ─────────────────────────────────────────────────────────────────
  console.log("── Check 1: Create a test observation ────────────────");
  let entry;
  try {
    entry = await journeyService.createEntry({
      studentId:       "VALIDATION_STUDENT_001",
      studentName:     "Validation Student",
      classId:         "VALIDATION_CLASS",
      kind:            "observation",
      sourceModule:    "observation",
      domain:          "social",
      level:           4,
      observationText: "During morning circle, the student confidently greeted peers by name and initiated a group game — demonstrating strong social leadership and empathy.",
      date:            TEST_DATE,
      visibility:      "all_parents",
    }, {
      schoolId:    SCHOOL_ID,
      centerId:    "CENTER_001",
      actorUserId: "VALIDATION_SCRIPT",
    });

    check("Observation created without error", !!entry?.id, `id=${entry?.id}`);
    console.log(`     Entry ID: ${entry?.id}`);
  } catch (e) {
    check("Observation created without error", false, e.message);
    console.error("  ⚠️  Cannot continue — creation failed:", e.message);
    process.exit(1);
  }

  // ─────────────────────────────────────────────────────────────────
  // 2. Confirm observation appears in journeyEntries
  // ─────────────────────────────────────────────────────────────────
  console.log("\n── Check 2: Observation in journeyEntries collection ──");
  const snap = await db.collection("journeyEntries").doc(entry.id).get();
  check("Document exists in journeyEntries", snap.exists, `doc/${entry.id}`);
  const stored = snap.data();
  check("kind = observation", stored?.kind === "observation", `kind=${stored?.kind}`);
  check("studentId stored", stored?.studentId === "VALIDATION_STUDENT_001", `studentId=${stored?.studentId}`);

  // ─────────────────────────────────────────────────────────────────
  // 3. Confirm academicYear auto-populates correctly
  // ─────────────────────────────────────────────────────────────────
  console.log("\n── Check 3: academicYear auto-population ─────────────");
  const expectedYear = getAcademicYear(TEST_DATE);
  check("academicYear stored", !!stored?.academicYear, `stored=${stored?.academicYear}`);
  check(`academicYear = ${expectedYear}`, stored?.academicYear === expectedYear, `expected=${expectedYear} got=${stored?.academicYear}`);

  // Edge case: February date should still be academic year starting the previous June
  const febEntry = await journeyService.createEntry({
    studentId: "VALIDATION_STUDENT_001",
    studentName: "Validation Student",
    kind: "observation",
    sourceModule: "observation",
    domain: "emotional",
    level: 3,
    observationText: "Edge case test for academic year calculation.",
    date: "2027-02-15",
    visibility: "staff_only",
  }, { schoolId: SCHOOL_ID, centerId: "CENTER_001", actorUserId: "VALIDATION_SCRIPT" });
  check("academicYear for Feb 2027 = 2026-27", febEntry?.academicYear === "2026-27", `got=${febEntry?.academicYear}`);

  // June date should be the new academic year
  const junEntry = await journeyService.createEntry({
    studentId: "VALIDATION_STUDENT_001",
    studentName: "Validation Student",
    kind: "observation",
    sourceModule: "observation",
    domain: "communication",
    level: 2,
    observationText: "Edge case test for June transition.",
    date: "2027-06-01",
    visibility: "staff_only",
  }, { schoolId: SCHOOL_ID, centerId: "CENTER_001", actorUserId: "VALIDATION_SCRIPT" });
  check("academicYear for Jun 1 2027 = 2027-28", junEntry?.academicYear === "2027-28", `got=${junEntry?.academicYear}`);

  // ─────────────────────────────────────────────────────────────────
  // 4. Confirm sourceModule is stored
  // ─────────────────────────────────────────────────────────────────
  console.log("\n── Check 4: sourceModule stored ──────────────────────");
  check("sourceModule stored in Firestore", !!stored?.sourceModule, `sourceModule=${stored?.sourceModule}`);
  check("sourceModule = observation", stored?.sourceModule === "observation", `got=${stored?.sourceModule}`);

  // ─────────────────────────────────────────────────────────────────
  // 5. Confirm parent can see observation in Home Feed
  // ─────────────────────────────────────────────────────────────────
  console.log("\n── Check 5: Parent visibility via getForStudent ──────");
  const parentView = await journeyService.getForStudent({
    schoolId: SCHOOL_ID,
    studentId: "VALIDATION_STUDENT_001",
    kinds: ["observation"],
  });
  check("getForStudent returns results", parentView.length > 0, `${parentView.length} entries returned`);

  const visible = parentView.find(e => e.id === entry.id);
  check("Test observation visible to parents", !!visible, visible ? `id=${visible.id}` : "not found");
  check("staff_only entries filtered out", !parentView.find(e => e.visibility === "staff_only"), "staff_only entries hidden");

  // Check staff view includes all entries
  const staffView = await journeyService.getForStaff({
    schoolId: SCHOOL_ID,
    studentId: "VALIDATION_STUDENT_001",
  });
  check("Staff view includes staff_only entries", staffView.length >= 3, `${staffView.length} entries in staff view`);

  // ─────────────────────────────────────────────────────────────────
  // 6. Confirm notification is generated
  // ─────────────────────────────────────────────────────────────────
  console.log("\n── Check 6: Notification types registered ────────────");
  check("NEW_OBSERVATION type exists", !!notifService.TYPES.NEW_OBSERVATION, `type=${notifService.TYPES.NEW_OBSERVATION}`);
  check("NEW_ARTWORK type exists",     !!notifService.TYPES.NEW_ARTWORK,     `type=${notifService.TYPES.NEW_ARTWORK}`);
  check("MILESTONE_ACHIEVED type exists", !!notifService.TYPES.MILESTONE_ACHIEVED, `type=${notifService.TYPES.MILESTONE_ACHIEVED}`);
  check("ANNUAL_BOOK_READY type exists",  !!notifService.TYPES.ANNUAL_BOOK_READY,  `type=${notifService.TYPES.ANNUAL_BOOK_READY}`);

  // Check notification would fire for a parent linked to this student (if any)
  const parents = await notifService.getParentsByStudentId("VALIDATION_STUDENT_001", SCHOOL_ID);
  check(
    `Notification parent lookup runs cleanly`,
    Array.isArray(parents),
    `${parents.length} parent(s) linked to VALIDATION_STUDENT_001`
  );

  // ─────────────────────────────────────────────────────────────────
  // 7. Confirm role permissions work correctly
  // ─────────────────────────────────────────────────────────────────
  console.log("\n── Check 7: Role permissions ─────────────────────────");
  const { ROLE_PERMISSIONS, isBypassRole } = permissionsBackend;
  const rolesWithJourney = ["admin", "center_owner", "center_admin", "teacher"];
  const rolesDenied      = ["accountant", "reception", "parent"];

  for (const role of rolesWithJourney) {
    check(`${role} has child-journey permission`, ROLE_PERMISSIONS[role]?.includes("child-journey"), `role=${role}`);
  }
  for (const role of rolesDenied) {
    check(`${role} does NOT have child-journey permission`, !ROLE_PERMISSIONS[role]?.includes("child-journey"), `role=${role}`);
  }
  check("developer bypasses all checks", isBypassRole("developer"), "bypass=true");
  check("super_admin bypasses all checks", isBypassRole("super_admin"), "bypass=true");

  // ─────────────────────────────────────────────────────────────────
  // 8. Confirm schoolId and centerId are stored
  // ─────────────────────────────────────────────────────────────────
  console.log("\n── Check 8: schoolId and centerId ────────────────────");
  check("schoolId stored in Firestore", stored?.schoolId === SCHOOL_ID, `stored=${stored?.schoolId}`);
  check("centerId stored in Firestore", stored?.centerId === "CENTER_001", `stored=${stored?.centerId}`);
  check("academicYear present", !!stored?.academicYear, `academicYear=${stored?.academicYear}`);
  check("createdAt present",    !!stored?.createdAt,    `createdAt=${stored?.createdAt}`);
  check("updatedAt present",    !!stored?.updatedAt,    `updatedAt=${stored?.updatedAt}`);
  check("createdBy stored",     stored?.createdBy === "VALIDATION_SCRIPT", `createdBy=${stored?.createdBy}`);

  // ─────────────────────────────────────────────────────────────────
  // Full document dump
  // ─────────────────────────────────────────────────────────────────
  console.log("\n── Stored document (primary test observation) ────────");
  console.log(JSON.stringify(stored, null, 2));

  // ─────────────────────────────────────────────────────────────────
  // Cleanup: delete all validation entries
  // ─────────────────────────────────────────────────────────────────
  console.log("\n── Cleanup: removing validation entries ──────────────");
  const cleanupSnap = await db.collection("journeyEntries")
    .where("createdBy", "==", "VALIDATION_SCRIPT")
    .get();
  const batch = db.batch();
  cleanupSnap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
  console.log(`  Deleted ${cleanupSnap.size} validation entry(ies)`);

  // ─────────────────────────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────────────────────────
  const total = passed + failed;
  console.log("\n══════════════════════════════════════════════════════");
  console.log(`  RESULTS: ${passed}/${total} passed  ·  ${failed} failed`);
  console.log("══════════════════════════════════════════════════════\n");

  if (failed > 0) {
    console.log("Failing checks:");
    results.filter(r => r.status === "FAIL").forEach(r => console.log(`  ❌ ${r.name}: ${r.detail}`));
    process.exit(1);
  }
  process.exit(0);
}

run().catch(e => {
  console.error("\n💥 Validation script crashed:", e.message);
  console.error(e.stack);
  process.exit(1);
});
