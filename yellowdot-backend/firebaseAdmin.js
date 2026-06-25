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

  // True when running inside Google Cloud (Cloud Functions, Cloud Run, etc.)
  // These environments have a project service account attached automatically,
  // so Application Default Credentials work without any explicit key file.
  const IS_GCP = !!(
    process.env.FUNCTION_TARGET ||   // Firebase Functions v1
    process.env.K_SERVICE       ||   // Cloud Run / Functions v2
    process.env.GOOGLE_CLOUD_PROJECT // GCP managed env
  );

  if (svcEnv) {
    // Explicit JSON string — used on Railway / Render
    try {
      const serviceAccount = JSON.parse(svcEnv);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId:  serviceAccount.project_id || "yellowdot-app",
      });
      console.log("[firebase-admin] Initialized with FIREBASE_SERVICE_ACCOUNT credentials.");
    } catch (e) {
      console.error("[firebase-admin] Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:", e.message);
      process.exit(1);
    }
  } else if (IS_GCP) {
    // Cloud Functions / Cloud Run — runtime injects the project service account automatically
    admin.initializeApp({ projectId: process.env.GOOGLE_CLOUD_PROJECT || "yellowdot-app" });
    console.log("[firebase-admin] Initialized with GCP Application Default Credentials.");
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // File path — read and parse eagerly so any JSON error surfaces at startup,
    // not lazily on the first Firestore/Auth API call.
    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    let serviceAccount;
    try {
      const fs  = require("fs");
      let raw   = fs.readFileSync(credPath, "utf8").trim();
      // Guard against Railway-style escaped JSON written to disk ({\"type\":...})
      if (raw.startsWith('"') || raw.startsWith("'")) {
        raw = JSON.parse(raw);   // unwrap outer string literal
      }
      if (typeof raw === "string" && raw.includes('\\"')) {
        raw = raw.replace(/\\"/g, '"');
      }
      serviceAccount = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (serviceAccount.type !== "service_account") {
        throw new Error(`Expected type=service_account, got: ${serviceAccount.type}`);
      }
    } catch (e) {
      console.error(`[firebase-admin] Failed to read/parse GOOGLE_APPLICATION_CREDENTIALS at ${credPath}:`, e.message);
      process.exit(1);
    }
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId:  serviceAccount.project_id || "yellowdot-app",
    });
    console.log("[firebase-admin] Initialized with GOOGLE_APPLICATION_CREDENTIALS file.");
  } else {
    console.warn(
      "[firebase-admin] No credentials found.\n" +
      "  Set FIREBASE_SERVICE_ACCOUNT (JSON string) in production,\n" +
      "  or GOOGLE_APPLICATION_CREDENTIALS (file path) for local dev.\n" +
      "  Falling back to Application Default Credentials."
    );
    admin.initializeApp({ projectId: "yellowdot-app" });
  }
}

const db   = admin.firestore();
const auth = admin.auth();

// Firestore settings — disable deprecated date behaviour
db.settings({ ignoreUndefinedProperties: true });

module.exports = { admin, db, auth };
