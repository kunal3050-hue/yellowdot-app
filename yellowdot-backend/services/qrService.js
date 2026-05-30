/**
 * qrService.js — Centralized QR Code engine for Yellow Dot
 * ─────────────────────────────────────────────────────────
 * Single source of truth for all QR code generation and validation.
 *
 * V1: Static center QR — no rotation, no expiry.
 *
 * Architecture is future-ready for:
 *   - Rotating QR (token + expiry fields)
 *   - Classroom QR (classId in payload)
 *   - Visitor QR (type: "visitor")
 *   - Encrypted QR (encrypt payloadJson before encoding)
 *
 * Firestore: qrConfigs/{centerId}
 */

const QRCode  = require("qrcode");
const { db }  = require("../firebaseAdmin");

// ── Constants ───────────────────────────────────────────────────────────────

const QR_VERSION           = 1;
const QR_CONFIGS_COLLECTION = "qrConfigs";

// QR types — V1 only uses "center"; others are stubs for future modules
const QR_TYPES = {
  CENTER:    "center",
  CLASSROOM: "classroom",  // future
  VISITOR:   "visitor",    // future
  STAFF:     "staff",      // future
};

// ── QR image generation options ─────────────────────────────────────────────

const QR_OPTS = {
  errorCorrectionLevel: "H",   // High — tolerates ~30% damage (prints well)
  type:                 "image/png",
  width:                800,   // px — sharp at both screen & print
  margin:               2,
  color: { dark: "#0D0D0D", light: "#FFFFFF" },
};

// ── Payload builders ─────────────────────────────────────────────────────────

/**
 * Build the JSON payload embedded inside the QR code.
 * Keep it minimal — every byte adds QR density.
 */
function buildCenterPayload(centerId) {
  return {
    type:     QR_TYPES.CENTER,
    centerId,
    v:        QR_VERSION,
  };
}

// Future builders (stubs):
// function buildClassroomPayload(centerId, classId) { ... }
// function buildVisitorPayload(centerId)             { ... }
// function buildRotatingPayload(centerId, token, exp) { ... }

// ── Generation ───────────────────────────────────────────────────────────────

/**
 * Generate (or regenerate) a static center QR code.
 * Stores config + base64 PNG in Firestore.
 *
 * @param {string} centerId     — e.g. "ydseawoods-main"
 * @param {string} centerName   — display name shown below the QR
 * @param {string} generatedBy  — userId of the admin triggering generation
 * @returns {Promise<QRResult>}
 */
async function generateCenterQR(centerId, centerName, generatedBy) {
  if (!centerId || typeof centerId !== "string") {
    throw new Error("centerId is required and must be a string");
  }

  // Firestore document IDs cannot safely include path separators.
  // If centerId ever contains '/' (e.g. 'school/branch'), generation will fail.
  if (centerId.includes("/") || centerId.includes("\\")) {
    throw new Error(`Invalid centerId '${centerId}': must not contain '/' or '\\'`);
  }

  const payload = buildCenterPayload(centerId);
  const payloadStr = JSON.stringify(payload);

  console.log("[QR SERVICE] generateCenterQR start", {
    centerId,
    centerName,
    generatedBy: generatedBy || "system",
    payload: payload,
    payloadJson: payloadStr,
    payloadStrLen: payloadStr.length,
  });

  // ── Step 1: Generate QR image (fast, no DB) ──────────────────────────────
  let qrDataUrl;
  try {
    qrDataUrl = await QRCode.toDataURL(payloadStr, QR_OPTS);
    console.log("[QR SERVICE] QR image generated", {
      centerId,
      qrDataUrlLen: qrDataUrl?.length,
    });
  } catch (imgErr) {
    console.error("[QR SERVICE] QR image generation failed", {
      centerId,
      message: imgErr?.message,
      stack:   imgErr?.stack,
    });
    throw new Error(`QR image generation failed: ${imgErr?.message}`);
  }

  const now        = new Date().toISOString();
  const resolvedName = centerName || _friendlyName(centerId);
  const doc = {
    centerId,
    centerName:   resolvedName,
    type:         QR_TYPES.CENTER,
    version:      QR_VERSION,
    payload,
    payloadJson:  payloadStr,
    qrDataUrl,
    isActive:     true,
    generatedAt:  now,
    generatedBy:  generatedBy || "system",
    updatedAt:    now,
    // Future fields — not used in V1, kept for schema compatibility
    rotatesEvery: null,
    expiresAt:    null,
    encrypted:    false,
    classId:      null,
  };

  // ── Step 2: Persist to Firestore (separate from image generation) ─────────
  let saved      = false;
  let saveError  = null;

  try {
    console.log("[QR SERVICE] writing Firestore doc", {
      collection:    QR_CONFIGS_COLLECTION,
      docId:         centerId,
      docSizeApprox: JSON.stringify({ ...doc, qrDataUrl: "[omitted]" }).length,
    });

    // Full overwrite so a regenerate always produces a fresh document
    await db.collection(QR_CONFIGS_COLLECTION).doc(centerId).set(doc, { merge: false });
    saved = true;

    console.log("[QR SERVICE] Firestore write complete", { docId: centerId });
    console.log(`[QR] Generated center QR for ${centerId} by ${generatedBy || "system"}`);
  } catch (dbErr) {
    saveError = dbErr?.message || "Firestore write failed";
    console.error("[QR SERVICE] Firestore save failed (QR image still valid)", {
      centerId,
      message: dbErr?.message,
      code:    dbErr?.code,
      name:    dbErr?.name,
    });
    // Do NOT throw — return partial success so the frontend can still show the QR
  }

  return {
    centerId,
    centerName:  resolvedName,
    qrDataUrl,
    payload,
    generatedAt: now,
    version:     QR_VERSION,
    saved,
    saveError:   saveError || undefined,
  };
}

// ── Retrieval ────────────────────────────────────────────────────────────────

/**
 * Fetch the stored QR config for a center.
 * Returns null if no QR has been generated yet.
 */
async function getCenterQR(centerId) {
  const snap = await db.collection(QR_CONFIGS_COLLECTION).doc(centerId).get();
  return snap.exists ? snap.data() : null;
}

// ── Validation ───────────────────────────────────────────────────────────────

/**
 * Validate the raw string/object scanned from a QR code.
 *
 * Used by every module that consumes QR scans
 * (staff attendance, parent check-in, visitor, etc.)
 *
 * @param {string|object} rawPayload — the decoded QR content
 * @returns {Promise<ValidationResult>}
 *
 * ValidationResult: { valid, type, centerId, centerName, version, config, error }
 */
async function validateQRPayload(rawPayload) {
  // ── 1. Parse JSON ─────────────────────────────────────────────────────────
  let parsed;
  try {
    parsed = typeof rawPayload === "string" ? JSON.parse(rawPayload) : rawPayload;
  } catch {
    return { valid: false, error: "Invalid QR format: not valid JSON" };
  }

  // ── 2. Required fields ────────────────────────────────────────────────────
  if (!parsed.type) {
    return { valid: false, error: "Invalid QR: missing type field" };
  }
  if (!parsed.centerId) {
    return { valid: false, error: "Invalid QR: missing centerId field" };
  }

  // ── 3. Version check ──────────────────────────────────────────────────────
  if (parsed.v && parsed.v > QR_VERSION) {
    return { valid: false, error: `Unsupported QR version: ${parsed.v}. Update the app.` };
  }

  // ── 4. Verify against Firestore config ───────────────────────────────────
  const snap = await db.collection(QR_CONFIGS_COLLECTION).doc(parsed.centerId).get();

  if (!snap.exists) {
    return { valid: false, error: `No QR config found for center: ${parsed.centerId}` };
  }

  const config = snap.data();

  if (!config.isActive) {
    return { valid: false, error: `QR code is deactivated for center: ${parsed.centerId}` };
  }

  // ── 5. Type-specific validation (future hook) ─────────────────────────────
  // V1 center QR has no expiry/token check.
  // Future rotating QR: check config.expiresAt > Date.now(), verify token, etc.

  return {
    valid:      true,
    type:       parsed.type,
    centerId:   parsed.centerId,
    centerName: config.centerName || parsed.centerId,
    version:    parsed.v || 1,
    config,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convert a centerId like "ydseawoods-main" to "Ydseawoods Main"
 * for display when no explicit center name is provided.
 */
function _friendlyName(centerId) {
  return (centerId || "")
    .split("-")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  generateCenterQR,
  getCenterQR,
  validateQRPayload,
  buildCenterPayload,
  QR_VERSION,
  QR_TYPES,
  QR_CONFIGS_COLLECTION,
};
