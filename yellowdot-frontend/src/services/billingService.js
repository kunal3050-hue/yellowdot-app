/**
 * billingService.js — Billing & Payments API client (staff)
 *
 * Uses the shared axios `api` instance from authService so the Firebase token
 * is injected by the request interceptor. Same shape as certificateService.js.
 *
 * Every function here maps to one endpoint on routes/billingRoutes.js. Nothing
 * in this file computes a balance, a total or a status: those are all derived
 * server-side and read off the response, which is the point. The audit's worst
 * structural finding was three screens each computing their own version of what
 * a family owed, and the fix is that the client never does the arithmetic.
 */

import { api } from "./authService";

function qs(params) {
  const q = new URLSearchParams(
    Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""),
    ),
  ).toString();
  return q ? `?${q}` : "";
}

// ── Dashboard and rollups ────────────────────────────────────────────────────

/** The KPI row: collected today and this month, outstanding, overdue, aging. */
export async function getSummary(params = {}) {
  const res = await api({ method: "GET", url: `/api/billing/summary${qs(params)}` });
  return res.data;
}

/** Who owes what — per child, rolled up per family, plus school totals. */
export async function getOutstanding(params = {}) {
  const res = await api({ method: "GET", url: `/api/billing/outstanding${qs(params)}` });
  return res.data;
}

// ── Fee plans ────────────────────────────────────────────────────────────────

export async function listPlans(params = {}) {
  const res = await api({ method: "GET", url: `/api/billing/plans${qs(params)}` });
  return res.data;
}

export async function createPlan(payload) {
  const res = await api({ method: "POST", url: "/api/billing/plans", data: payload });
  return res.data;
}

export async function updatePlan(planId, patch) {
  const res = await api({ method: "PATCH", url: `/api/billing/plans/${planId}`, data: patch });
  return res.data;
}

/** Deactivates rather than deletes — invoice lines reference the plan. */
export async function deactivatePlan(planId) {
  const res = await api({ method: "DELETE", url: `/api/billing/plans/${planId}` });
  return res.data;
}

// ── Invoices ─────────────────────────────────────────────────────────────────

export async function listInvoices(params = {}) {
  const res = await api({ method: "GET", url: `/api/billing/invoices${qs(params)}` });
  return res.data;
}

/** One invoice with its payments attached. */
export async function getInvoice(invoiceId) {
  const res = await api({ method: "GET", url: `/api/billing/invoices/${invoiceId}` });
  return res.data;
}

/** Raise one invoice. `lines` is an array of { planId? , label?, feeType?, amount? }. */
export async function createInvoice(payload) {
  const res = await api({ method: "POST", url: "/api/billing/invoices", data: payload });
  return res.data;
}

/**
 * The monthly run. Pass `dryRun: true` first: it writes nothing and returns
 * exactly what a real run would do, so the screen can show the count, the
 * total, who is skipped and who matched no plan before anything is billed.
 */
export async function generateInvoices(payload) {
  const res = await api({ method: "POST", url: "/api/billing/invoices/generate", data: payload });
  return res.data;
}

/** Withdraw an invoice. The row stays in the register; the reason is required. */
export async function voidInvoice(invoiceId, reason) {
  const res = await api({
    method: "POST", url: `/api/billing/invoices/${invoiceId}/void`, data: { reason },
  });
  return res.data;
}

/** Reduce what is owed, with a reason. Cannot go below what has been paid. */
export async function addCreditNote(invoiceId, { amount, reason }) {
  const res = await api({
    method: "POST", url: `/api/billing/invoices/${invoiceId}/credit-note`, data: { amount, reason },
  });
  return res.data;
}

// ── Payments ─────────────────────────────────────────────────────────────────

export async function listPayments(params = {}) {
  const res = await api({ method: "GET", url: `/api/billing/payments${qs(params)}` });
  return res.data;
}

/**
 * Record money that has already changed hands. Returns { payment, invoice } —
 * the settled invoice comes back in the same response because the server wrote
 * both in one transaction, so the screen never has to re-fetch to find out
 * whether the bill is now paid.
 */
export async function recordPayment(payload) {
  const res = await api({ method: "POST", url: "/api/billing/payments", data: payload });
  return res.data;
}

/** Unwind a payment, with a reason. The row stays, marked reversed. */
export async function reversePayment(paymentId, reason) {
  const res = await api({
    method: "POST", url: `/api/billing/payments/${paymentId}/reverse`, data: { reason },
  });
  return res.data;
}

/** The receipt payload: the payment, its invoice and the school's details. */
export async function getReceipt(paymentId) {
  const res = await api({ method: "GET", url: `/api/billing/receipts/${paymentId}` });
  return res.data;
}

// ── Settings and audit ───────────────────────────────────────────────────────

export async function getSettings() {
  const res = await api({ method: "GET", url: "/api/billing/settings" });
  return res.data;
}

export async function updateSettings(payload) {
  const res = await api({ method: "PUT", url: "/api/billing/settings", data: payload });
  return res.data;
}

/** The money trail. Admin-tier on the server. */
export async function listAudit(params = {}) {
  const res = await api({ method: "GET", url: `/api/billing/audit${qs(params)}` });
  return res.data;
}

export default {
  getSummary,
  getOutstanding,
  listPlans,
  createPlan,
  updatePlan,
  deactivatePlan,
  listInvoices,
  getInvoice,
  createInvoice,
  generateInvoices,
  voidInvoice,
  addCreditNote,
  listPayments,
  recordPayment,
  reversePayment,
  getReceipt,
  getSettings,
  updateSettings,
  listAudit,
};
