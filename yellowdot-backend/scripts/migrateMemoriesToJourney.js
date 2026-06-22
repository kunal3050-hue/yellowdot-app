/**
 * migrateMemoriesToJourney.js — One-time migration
 *
 * Copies all docs from `memories/{id}` → `journeyEntries/{id}`.
 *   - Same Firestore document ID preserved
 *   - type "video" → kind "video"; all others → kind "photo"
 *   - academicYear computed from doc.date or doc.createdAt
 *   - visibility defaults to "all_parents"
 *
 * Run ONCE before Phase 2 deployment:
 *   node yellowdot-backend/scripts/migrateMemoriesToJourney.js
 *
 * Safe to re-run: merges with { merge: true } so existing journeyEntries
 * docs are not overwritten if the script is run again.
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
require("../firebaseAdmin");

const { db } = require("../firebaseAdmin");
const { getAcademicYear } = require("../utils/academicYear");

async function run() {
  const memoriesSnap = await db.collection("memories").get();

  if (memoriesSnap.empty) {
    console.log("No documents found in memories collection. Nothing to migrate.");
    return;
  }

  console.log(`Found ${memoriesSnap.size} memory doc(s). Starting migration…`);

  const BATCH_SIZE = 400;
  let batch        = db.batch();
  let count        = 0;
  let batchCount   = 0;

  for (const memDoc of memoriesSnap.docs) {
    const m  = memDoc.data();
    const id = memDoc.id;

    const rawDate    = m.date || (m.createdAt ? m.createdAt.slice(0, 10) : null);
    const academicYear = rawDate ? getAcademicYear(rawDate) : "2024-25";

    const entry = {
      schoolId:        m.schoolId        || process.env.SCHOOL_ID || "ydseawoods",
      centerId:        m.centerId        || "",
      academicYear,
      studentId:       m.studentId       || "",
      studentName:     m.studentName     || "",
      classId:         m.classId         || "",
      date:            rawDate           || "",
      kind:            m.type === "video" ? "video" : "photo",
      visibility:      "all_parents",
      mediaUrl:        m.mediaUrl        || "",
      thumbnailUrl:    m.thumbnailUrl    || m.mediaUrl || "",
      caption:         m.caption         || "",
      // Observation fields — not applicable
      domain:          "",
      level:           0,
      observationText: "",
      // Artwork fields — not applicable
      artworkCategory: "",
      artworkTitle:    "",
      // Milestone fields — not applicable
      milestoneId:     "",
      milestoneTitle:  "",
      milestoneCategory: "",
      momentNote:      "",
      autoDetected:    false,
      sourceModule:    "memories",
      createdBy:       m.createdBy       || "migration",
      createdAt:       m.createdAt       || new Date().toISOString(),
      updatedAt:       m.updatedAt       || new Date().toISOString(),
    };

    const destRef = db.collection("journeyEntries").doc(id);
    batch.set(destRef, entry, { merge: true });
    count++;
    batchCount++;

    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      console.log(`  ✓ Committed batch of ${batchCount} docs (${count} total so far)`);
      batch      = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
    console.log(`  ✓ Committed final batch of ${batchCount} docs`);
  }

  console.log(`\nMigration complete. ${count} memories → journeyEntries.`);
  console.log("Next step: update parentActivityFeedService.js to query journeyService instead of memoriesService for photo/video kinds (Phase 2).");
}

run().catch(e => { console.error("Migration failed:", e); process.exit(1); });
