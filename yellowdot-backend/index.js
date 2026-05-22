/**
 * index.js — Firebase Cloud Functions entry point
 * ─────────────────────────────────────────────────────────────────
 * Wraps the Express app from server.js as an HTTP Cloud Function.
 * Firebase Hosting rewrites /api/** to this function, so the browser
 * always calls yellowdot-app.web.app/api/... (same origin, no CORS).
 *
 * Local dev:  run `npm start` in yellowdot-backend (starts server.js directly)
 * Production: firebase deploy --only functions  (uses this file)
 */

require("dotenv").config();          // load .env vars before anything else
require("./firebaseAdmin");          // ensure Admin SDK is initialized once

const functions = require("firebase-functions");
const app       = require("./server");

// Expose the Express app as a single Cloud Function named "api".
// Firebase Hosting rewrite: { "source": "/api/**", "function": "api" }
exports.api = functions.https.onRequest(app);
