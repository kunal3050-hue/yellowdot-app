/**
 * qrApi.js — Frontend client for the Yellow Dot QR Management API
 * ─────────────────────────────────────────────────────────────────
 * Mirrors the backend /api/qr/* endpoints.
 * Uses the shared authenticated axios instance from authService.
 */

import { api } from "./authService";

const qrApi = {
  /**
   * Fetch the existing QR config and base64 PNG for a center.
   * Returns { hasQR: false } if no QR has been generated yet.
   */
  get: (centerId) =>
    api.get(`/api/qr/center/${encodeURIComponent(centerId)}`).then(r => r.data),

  /**
   * Generate (or regenerate) the QR code for a center.
   * @param {string} centerId
   * @param {string} centerName  — display name to embed in the QR config
   */
  generate: (centerId, centerName) =>
    api.post(`/api/qr/center/${encodeURIComponent(centerId)}/generate`, { centerName })
       .then(r => r.data),

  /**
   * Validate a raw QR payload string (from a camera scan).
   * Returns { valid, type, centerId, centerName, version, error? }
   */
  validate: (payload) =>
    api.post("/api/qr/validate", { payload }).then(r => r.data),
};

export default qrApi;
