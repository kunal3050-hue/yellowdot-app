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
  get: (centerId) => {
    console.log("[qrApi] GET /api/qr/center/:centerId", { centerId });
    return api
      .get(`/api/qr/center/${encodeURIComponent(centerId)}`)
      .then(r => {
        console.log("[qrApi] GET response body", r?.data);
        return r.data;
      })
      .catch(err => {
        console.error("[qrApi] GET raw error", err);
        console.error("[qrApi] GET error details", {
          status: err?.response?.status,
          data: err?.response?.data,
          message: err?.message,
        });
        throw err;
      });
  },

  /**
   * Generate (or regenerate) the QR code for a center.
   * @param {string} centerId
   * @param {string} centerName  — display name to embed in the QR config
   */
  generate: (centerId, centerName) => {
    const payload = { centerName };
    console.log("[qrApi] POST /api/qr/center/:centerId/generate", {
      centerId,
      requestPayload: payload,
    });
    return api
      .post(`/api/qr/center/${encodeURIComponent(centerId)}/generate`, payload)
      .then(r => {
        console.log("[qrApi] POST response body", r?.data);
        return r.data;
      })
      .catch(err => {
        console.error("[qrApi] POST raw error", err);
        console.error("[qrApi] POST error details", {
          status: err?.response?.status,
          data: err?.response?.data,
          message: err?.message,
        });
        throw err;
      });
  },

  /**
   * Validate a raw QR payload string (from a camera scan).
   * Returns { valid, type, centerId, centerName, version, error? }
   */
  validate: (payload) =>
    api.post("/api/qr/validate", { payload }).then(r => r.data),
};

export default qrApi;
