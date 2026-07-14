/**
 * qrRoutes.js — QR Code management endpoints
 * ────────────────────────────────────────────
 * GET  /api/qr/center/:centerId           — fetch existing QR config
 * POST /api/qr/center/:centerId/generate  — generate / regenerate QR
 * POST /api/qr/validate                   — validate a scanned QR payload
 *
 * The validate endpoint is called by every future module that consumes QR
 * scans (staff attendance, parent check-in, visitor management, etc.)
 */

const express  = require("express");
const router   = express.Router();
const { authenticate, authorize, staffOnly } = require("../middleware/authMiddleware");
const qrSvc    = require("../services/qrService");

// ── GET /api/qr/center/:centerId ─────────────────────────────────────────────
// Returns the stored QR configuration and base64 PNG for a center.
// Any authenticated staff member can read it.
router.get("/api/qr/center/:centerId", authenticate, staffOnly, async (req, res) => {
  try {
    const { centerId } = req.params;
    if (!(await qrSvc.centerBelongsToSchool(centerId, req.user?.schoolId))) {
      return res.status(404).json({ hasQR: false, centerId, message: "Center not found." });
    }
    const config = await qrSvc.getCenterQR(centerId);

    if (!config) {
      return res.status(200).json({
        hasQR:    false,
        centerId,
        message:  "No QR code generated yet for this center.",
      });
    }

    return res.json({ hasQR: true, ...config });
  } catch (err) {
    console.error("[QR GET] error", {
      centerId: req.params?.centerId,
      message: err?.message,
      code: err?.code,
      name: err?.name,
      stack: err?.stack,
    });
    return res.status(500).json({
      error: err?.message || "Failed to fetch QR configuration.",
      code:  "QR_GET_FAILED",
      details: { name: err?.name, code: err?.code },
    });
  }
});

// ── POST /api/qr/center/:centerId/generate ───────────────────────────────────
// Generate or regenerate a static center QR code.
// Only admin-level roles can trigger generation.
router.post(
  "/api/qr/center/:centerId/generate",
  authenticate,
  authorize("admin", "center_admin", "center_owner", "super_admin", "developer"),
  async (req, res) => {
    const { centerId } = req.params;
    const { centerName } = req.body || {};

    if (!(await qrSvc.centerBelongsToSchool(centerId, req.user?.schoolId))) {
      return res.status(404).json({ success: false, error: "Center not found." });
    }

    const authHeader = req.headers?.authorization || "";
    const hasBearer = authHeader.startsWith("Bearer ");

    console.log("[QR GENERATE] route hit", {
      method: req.method,
      path: req.originalUrl,
      centerId,
      hasAuthHeader: !!authHeader,
      hasBearer,
      authHeaderPreview: hasBearer ? `${authHeader.slice(0, 24)}...` : authHeader,
    });

    console.log("[QR GENERATE] request", {
      centerId,
      centerName,
      user: {
        userId: req.user?.userId,
        role: req.user?.role,
        centerId: req.user?.centerId,
      },
      requestPayload: req.body,
    });

    try {
      const result = await qrSvc.generateCenterQR(
        centerId,
        centerName,
        req.user.userId,
      );

      // result.saved = true if Firestore write succeeded; false if it failed
      // In either case, result.qrDataUrl is valid — image generation always succeeds first.
      const responseBody = {
        success:    true,
        hasQR:      true,
        saved:      result.saved,
        saveError:  result.saveError || null,
        ...result,
      };
      console.log("[QR GENERATE] response body", {
        ...responseBody,
        qrDataUrl: "[base64 omitted from log]",
      });
      return res.json(responseBody);
    } catch (err) {
      // Only reaches here if QR IMAGE generation itself failed (not a DB error).
      console.error("[QR GENERATE] image generation failed", {
        centerId,
        centerName,
        userId: req.user?.userId,
        role:   req.user?.role,
        message: err?.message,
        code:    err?.code,
        name:    err?.name,
        stack:   err?.stack,
      });

      return res.status(500).json({
        success: false,
        error:   err?.message || "Failed to generate QR code.",
        code:    "QR_GENERATE_FAILED",
        details: { name: err?.name, code: err?.code },
      });
    }
  },
);

// ── POST /api/qr/validate ────────────────────────────────────────────────────
// Validate the raw string / parsed object that came from scanning a QR code.
// Called by: staff attendance scanner, parent check-in, visitor management.
// Requires authentication so scanning always happens from a logged-in device.
router.post("/api/qr/validate", authenticate, async (req, res) => {
  try {
    const { payload } = req.body;
    if (!payload) {
      return res.status(400).json({ valid: false, error: "payload is required" });
    }

    const result = await qrSvc.validateQRPayload(payload);
    return res.json(result);
  } catch (err) {
    console.error("[QR VALIDATE]", err.message);
    return res.status(500).json({ valid: false, error: "QR validation failed." });
  }
});

module.exports = router;
