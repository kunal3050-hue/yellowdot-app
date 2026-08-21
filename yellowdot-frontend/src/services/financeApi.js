/**
 * financeApi.js — client for the fees / invoices / payments API
 * ─────────────────────────────────────────────────────────────────
 * Mirrors yellowdot-backend/routes/financeRoutes.js. One flat client, no
 * per-entity namespaces — there are only three resources.
 *
 * Every call goes through the shared axios instance, which carries the
 * Firebase ID token (same as every other *Service.js in this folder).
 */

import { api } from "./authService";

const unwrap = (r) => r.data;

const financeApi = {
  // ── Fee templates ────────────────────────────────────────────────
  templates: {
    list:   (activeOnly = false) =>
      api.get(`/api/fee-templates${activeOnly ? "?active=true" : ""}`).then(unwrap),
    create: (data)             => api.post("/api/fee-templates", data).then(unwrap),
    update: (templateId, data) => api.put(`/api/fee-templates/${templateId}`, data).then(unwrap),
    remove: (templateId)       => api.delete(`/api/fee-templates/${templateId}`).then(unwrap),
  },

  // ── Invoices ─────────────────────────────────────────────────────
  invoices: {
    list:   (params = {}) => api.get("/api/invoices", { params }).then(unwrap),
    create: (data)        => api.post("/api/invoices", data).then(unwrap),
    remove: (invoiceId)   => api.delete(`/api/invoices/${invoiceId}`).then(unwrap),
  },

  // ── Payments ─────────────────────────────────────────────────────
  payments: {
    list: (params = {}) => api.get("/api/payments", { params }).then(unwrap),
    // Resolves to { success, payment, invoice } — the updated invoice comes
    // back with the payment, so callers never re-fetch to learn whether this
    // settled it.
    record: (data) => api.post("/api/payments", data).then(unwrap),
  },

  // ── Overview + generation ────────────────────────────────────────
  summary:  ()             => api.get("/api/finance/summary").then(unwrap),
  generate: (body = {})    => api.post("/api/finance/generate", body).then(unwrap),
};

export default financeApi;
