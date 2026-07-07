/**
 * test-notif-endpoint.js
 * ─────────────────────
 * 1. Reads Firestore directly to show notification documents
 * 2. Creates a Firebase custom token for the parent UID
 * 3. Exchanges it for an ID token via REST API
 * 4. Tests GET /api/parent/notifications on Railway
 */
require("dotenv").config();

const { db, auth, admin } = require("./firebaseAdmin");

const PARENT_UID   = "wAUEaJBvi1W84JLyWBYIn268uUi1";
const RAILWAY_URL  = "https://backend-production-3608.up.railway.app";
const WEB_API_KEY  = process.env.FIREBASE_WEB_API_KEY; // from .env

async function step1_firestore() {
  console.log("\n══ STEP 1: Firestore — notifications collection ══════════════════");

  const snap = await db.collection("notifications")
    .where("parentId", "==", PARENT_UID)
    .get();

  console.log(`Found ${snap.size} notification(s) for parent ${PARENT_UID}`);
  snap.docs.forEach(d => {
    console.log("\n  ID:", d.id);
    console.log("  Data:", JSON.stringify(d.data(), null, 4));
  });

  console.log("\n══ STEP 1b: Parent document ══════════════════════════════════════");
  const parentDoc = await db.collection("parents").doc(PARENT_UID).get();
  if (parentDoc.exists) {
    console.log("Parent doc found:", JSON.stringify(parentDoc.data(), null, 4));
  } else {
    console.log("Parent doc DOES NOT EXIST — will be provisioned on first API call");
  }
}

async function step2_customToken() {
  console.log("\n══ STEP 2: Firebase custom token ══════════════════════════════════");
  try {
    const customToken = await auth.createCustomToken(PARENT_UID, {
      role: "parent",
    });
    console.log("Custom token created (first 40 chars):", customToken.slice(0, 40) + "...");
    return customToken;
  } catch (e) {
    console.error("Custom token creation failed:", e.message);
    console.log("→ IAM API may not be enabled. Skipping HTTP endpoint test.");
    return null;
  }
}

async function step3_exchangeToken(customToken) {
  if (!customToken) return null;
  if (!WEB_API_KEY) {
    console.log("FIREBASE_WEB_API_KEY not in .env — cannot exchange token. Skipping.");
    return null;
  }
  console.log("\n══ STEP 3: Exchange custom token for ID token ══════════════════════");
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${WEB_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    }
  );
  const json = await res.json();
  if (!res.ok) {
    console.error("Token exchange failed:", JSON.stringify(json));
    return null;
  }
  console.log("ID token obtained (first 20 chars):", json.idToken?.slice(0, 20) + "...");
  return json.idToken;
}

async function step4_httpEndpoint(idToken) {
  if (!idToken) {
    console.log("\n══ STEP 4: HTTP endpoint test — SKIPPED (no ID token) ══════════════");
    return;
  }
  console.log("\n══ STEP 4: HTTP endpoint test ══════════════════════════════════════");
  const url = `${RAILWAY_URL}/api/parent/notifications`;
  console.log("GET", url);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  const body = await res.json();
  console.log("HTTP status:", res.status);
  console.log("Response body:", JSON.stringify(body, null, 4));
}

(async () => {
  try {
    await step1_firestore();
    const customToken = await step2_customToken();
    const idToken = await step3_exchangeToken(customToken);
    await step4_httpEndpoint(idToken);
  } catch (e) {
    console.error("Fatal:", e.message, e.stack);
  } finally {
    process.exit(0);
  }
})();
