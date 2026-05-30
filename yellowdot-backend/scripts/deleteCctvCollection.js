/**
 * deleteCctvCollection.js — one-off cleanup of the legacy CCTV `cameras` collection
 * ─────────────────────────────────────────────────────────────────────────────
 * The CCTV module was removed from the app. No code reads the `cameras`
 * Firestore collection anymore, but the stored documents remain. This script
 * deletes them.
 *
 * SAFETY:
 *   • Dry-run by default — lists what WOULD be deleted, deletes nothing.
 *   • Pass --confirm to actually delete.
 *   • Batched deletes (max 400/batch) to stay within Firestore limits.
 *
 * Usage (from yellowdot-backend/):
 *   node scripts/deleteCctvCollection.js            # dry run (safe)
 *   node scripts/deleteCctvCollection.js --confirm  # performs deletion
 */

require("dotenv").config();
const { db } = require("../firebaseAdmin");

const COLLECTION = "cameras";
const BATCH_SIZE = 400;
const CONFIRM = process.argv.includes("--confirm");

async function run() {
  console.log("═══════════════════════════════════════════════");
  console.log("  Legacy CCTV `cameras` collection cleanup");
  console.log("  Mode:", CONFIRM ? "DELETE (live)" : "DRY RUN (no changes)");
  console.log("═══════════════════════════════════════════════\n");

  const snap = await db.collection(COLLECTION).get();

  if (snap.empty) {
    console.log(`Collection "${COLLECTION}" is already empty. Nothing to do.`);
    process.exit(0);
  }

  console.log(`Found ${snap.size} document(s) in "${COLLECTION}":`);
  snap.docs.forEach(d => {
    const c = d.data() || {};
    console.log(`  - ${d.id}  (name="${c.cameraName || ""}", classroom="${c.classroom || ""}")`);
  });
  console.log("");

  if (!CONFIRM) {
    console.log("DRY RUN — no documents deleted.");
    console.log("Re-run with --confirm to permanently delete the above documents.");
    process.exit(0);
  }

  let deleted = 0;
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    docs.slice(i, i + BATCH_SIZE).forEach(d => batch.delete(d.ref));
    await batch.commit();
    deleted += Math.min(BATCH_SIZE, docs.length - i);
    console.log(`  Deleted ${deleted}/${docs.length}…`);
  }

  console.log(`\nDone. Deleted ${deleted} document(s) from "${COLLECTION}".`);
  process.exit(0);
}

run().catch(e => {
  console.error("Error:", e.message);
  process.exit(1);
});
