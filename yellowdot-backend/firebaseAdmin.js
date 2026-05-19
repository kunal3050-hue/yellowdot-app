/**
 * firebaseAdmin.js — Firebase Admin SDK initialization
 * ──────────────────────────────────────────────────────
 * Exports:
 *   admin  — Firebase Admin instance
 *   db     — Firestore database
 *   auth   — Firebase Admin Auth
 *
 * Configuration via environment variables:
 *   FIREBASE_SERVICE_ACCOUNT  — JSON string of service account credentials
 *   GOOGLE_APPLICATION_CREDENTIALS — path to service account JSON file
 *
 * Set FIREBASE_SERVICE_ACCOUNT in .env:
 *   FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"yellowdot-app",...}'
 */

const admin = require("firebase-admin");

if (!admin.apps.length) {
  const svcEnv = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (svcEnv) {
    try {
      const serviceAccount = JSON.parse(svcEnv);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId:  serviceAccount.project_id || "yellowdot-app",
      });
    } catch (e) {
      console.error("[firebase-admin] Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:", e.message);
      process.exit(1);
    }
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // Path to service account JSON file
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId:  "yellowdot-app",
    });
  } else {
    // Local dev fallback — connect to Firestore emulator if FIRESTORE_EMULATOR_HOST is set
    console.warn(
      "[firebase-admin] No credentials found.\n" +
      "  Set FIREBASE_SERVICE_ACCOUNT (JSON string) or GOOGLE_APPLICATION_CREDENTIALS (file path).\n" +
      "  Falling back to application default credentials."
    );
    admin.initializeApp({ projectId: "yellowdot-app" });
  }

  console.log("[firebase-admin] Initialized for project: yellowdot-app");
}

const db   = admin.firestore();
const auth = admin.auth();

// Firestore settings — disable deprecated date behaviour
db.settings({ ignoreUndefinedProperties: true });

module.exports = { admin, db, auth };
