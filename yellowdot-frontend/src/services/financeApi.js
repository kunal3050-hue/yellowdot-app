/**
 * financeApi.js — Front-end API client for the Finance Platform module.
 *
 * Mirrors the REST surface exposed by yellowdot-backend/routes/ledgerRoutes.js,
 * billingPlanRoutes.js, familyAccountRoutes.js, financeSettingsRoutes.js,
 * financeBillingEngineRoutes.js, financePaymentRoutes.js, financeRefundRoutes.js,
 * financeAuditRoutes.js, financeInvoiceRoutes.js. Every one of these routes is
 * gated behind FINANCE_FOUNDATION_ENABLED server-side and the
 * "finance-foundation" / "finance-refund-approval" permission keys — this
 * client makes no assumptions beyond what those routes already enforce.
 *
 * Billing Plans / Payments / Refunds / Invoices all support two list modes:
 * pass a scoping id (studentId/familyId) for the original per-entity list,
 * or omit it for a school-wide browse (both server-side functions are
 * additive extensions added specifically to support this UI — see
 * docs/finance-design/13_FINANCE_UI_DESIGN_SYSTEM.md).
 *
 * All requests go through the shared axios instance (carries Firebase ID
 * token, same as every other *Service.js in this folder).
 */

import { api } from "./authService";

const financeApi = {
  // ── Student Ledger ───────────────────────────────────────────────────
  ledger: {
    create(studentId, familyId) {
      return api.post("/api/finance/ledgers", { studentId, familyId }).then(r => r.data);
    },
    get(studentId) {
      return api.get(`/api/finance/ledgers/${studentId}`).then(r => r.data);
    },
    setStatus(studentId, status) {
      return api.put(`/api/finance/ledgers/${studentId}/status`, { status }).then(r => r.data);
    },
    listEntries(studentId, limit = 100) {
      return api.get(`/api/finance/ledgers/${studentId}/entries`, { params: { limit } }).then(r => r.data);
    },
    createEntry(studentId, entry) {
      return api.post(`/api/finance/ledgers/${studentId}/entries`, entry).then(r => r.data);
    },
  },

  // ── Billing Plans ────────────────────────────────────────────────────
  billingPlans: {
    create(data) {
      return api.post("/api/finance/billing-plans", data).then(r => r.data);
    },
    listForStudent(studentId) {
      return api.get("/api/finance/billing-plans", { params: { studentId } }).then(r => r.data);
    },
    // studentId omitted -> school-wide browse (additive listForSchool server-side)
    list(params = {}) {
      return api.get("/api/finance/billing-plans", { params }).then(r => r.data);
    },
    getOne(planId) {
      return api.get(`/api/finance/billing-plans/${planId}`).then(r => r.data);
    },
    setStatus(planId, status) {
      return api.put(`/api/finance/billing-plans/${planId}/status`, { status }).then(r => r.data);
    },
    generateInvoice(planId, periodStart, periodEnd) {
      return api.post(`/api/finance/billing-plans/${planId}/generate-invoice`, { periodStart, periodEnd }).then(r => r.data);
    },
  },

  // ── Family Account (finance facet) ───────────────────────────────────
  familyAccount: {
    list() {
      return api.get("/api/finance/family-accounts").then(r => r.data);
    },
    get(familyId) {
      return api.get(`/api/finance/family-accounts/${familyId}`).then(r => r.data);
    },
    ensure(familyId) {
      return api.post(`/api/finance/family-accounts/${familyId}`).then(r => r.data);
    },
    adjustCredit(familyId, delta, reason) {
      return api.post(`/api/finance/family-accounts/${familyId}/credit`, { delta, reason }).then(r => r.data);
    },
  },

  // ── Payments ──────────────────────────────────────────────────────────
  payments: {
    record(data) {
      return api.post("/api/finance/payments", data).then(r => r.data);
    },
    listForFamily(familyId) {
      return api.get("/api/finance/payments", { params: { familyId } }).then(r => r.data);
    },
    // familyId omitted -> school-wide browse (additive listForSchool server-side)
    list(params = {}) {
      return api.get("/api/finance/payments", { params }).then(r => r.data);
    },
    getOne(paymentId) {
      return api.get(`/api/finance/payments/${paymentId}`).then(r => r.data);
    },
    allocate(paymentId, body = {}) {
      return api.post(`/api/finance/payments/${paymentId}/allocate`, body).then(r => r.data);
    },
    reverse(paymentId, reason) {
      return api.post(`/api/finance/payments/${paymentId}/reverse`, { reason }).then(r => r.data);
    },
  },

  // ── Refunds & Reversals ──────────────────────────────────────────────
  refunds: {
    request(paymentId, amount, reason) {
      return api.post("/api/finance/refunds", { paymentId, amount, reason }).then(r => r.data);
    },
    list(params = {}) {
      return api.get("/api/finance/refunds", { params }).then(r => r.data);
    },
    getOne(refundId) {
      return api.get(`/api/finance/refunds/${refundId}`).then(r => r.data);
    },
    approve(refundId) {
      return api.post(`/api/finance/refunds/${refundId}/approve`).then(r => r.data);
    },
    reject(refundId, reason) {
      return api.post(`/api/finance/refunds/${refundId}/reject`, { reason }).then(r => r.data);
    },
  },

  // ── Invoices (Finance Foundation, source: "billingPlan") ─────────────
  invoices: {
    listForStudent(studentId) {
      return api.get("/api/finance/invoices", { params: { studentId } }).then(r => r.data);
    },
    // studentId omitted -> school-wide browse
    list(params = {}) {
      return api.get("/api/finance/invoices", { params }).then(r => r.data);
    },
    getOne(invoiceId) {
      return api.get(`/api/finance/invoices/${invoiceId}`).then(r => r.data);
    },
  },

  // ── Finance Settings ─────────────────────────────────────────────────
  settings: {
    get() {
      return api.get("/api/finance/settings").then(r => r.data);
    },
    update(data) {
      return api.put("/api/finance/settings", data).then(r => r.data);
    },
  },

  // ── Audit Log (read-only) ────────────────────────────────────────────
  auditLog: {
    list(params = {}) {
      return api.get("/api/finance/audit-logs", { params }).then(r => r.data);
    },
  },
};

export default financeApi;
