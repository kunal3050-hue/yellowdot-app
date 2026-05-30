/**
 * securityService.js — Smart Child Security System API client
 */

import { api } from "./authService";

const securityService = {
  // ── Child status ──────────────────────────────────────────────────
  // status: "PRESENT" | "CHECKED_OUT" | "NOT_ARRIVED"
  getChildStatus: (studentId) =>
    api.get(`/api/child-status/${studentId}`).then(r => r.data),

  // ── CCTV access (parent only) ─────────────────────────────────────
  // Returns { accessGranted, childStatus, cameras?, reason? }
  getCctvAccess: () =>
    api.get("/api/cctv-access").then(r => r.data),

  // ── Pickup requests ───────────────────────────────────────────────
  getPickupRequests: (params = {}) =>
    api.get("/api/pickup-requests", { params }).then(r => r.data),

  createPickupRequest: (data) =>
    api.post("/api/pickup-request", data).then(r => r.data),

  approvePickupRequest: (id) =>
    api.put(`/api/pickup-requests/${id}/approve`).then(r => r.data),

  rejectPickupRequest: (id, reason) =>
    api.put(`/api/pickup-requests/${id}/reject`, { reason }).then(r => r.data),
};

export default securityService;
