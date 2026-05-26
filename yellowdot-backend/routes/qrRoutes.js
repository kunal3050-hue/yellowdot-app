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
    console.error("[QR GET]", err.message);
    return res.status(500).json({ error: "Failed to fetch QR configuration." });
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
    try {
      const { centerId }  = req.params;
      const { centerName } = req.body;   // optional override for display name

      const result = await qrSvc.generateCenterQR(
        centerId,
        centerName,
        req.user.userId,
      );

      return res.json({ success: true, hasQR: true, ...result });
    } catch (err) {
      console.error("[QR GENERATE]", err.message);
      return res.status(500).json({ error: "Failed to generate QR code." });
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
