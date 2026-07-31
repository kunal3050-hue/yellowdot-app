/**
 * invoiceService.js — Invoice data layer
 * ─────────────────────────────────────────────────────────────────
 * Thin wrapper over the existing /api/invoices REST endpoint
 * (defined in yellowdot-backend/server.js). No new backend routes.
 *
 *   GET /api/invoices[?studentId=&status=]  → { success, invoices }
 * ─────────────────────────────────────────────────────────────────
 */

import { api } from "./authService";

const unwrap = (res, key) =>
  res?.success ? (res[key] || []) : (Array.isArray(res) ? res : []);

/**
 * Fetch invoices, optionally scoped by student or status.
 * Returns the full set for the school when no filter is given —
 * used by the Collection Dashboard for school-wide aggregation.
 */
export async function fetchAllInvoices({ studentId, status } = {}) {
  return unwrap(await getInvoicesRaw({ studentId, status }), "invoices");
}

/**
 * Same request, envelope intact.
 *
 * Callers that must tell "the request failed" apart from "there are no
 * invoices" need the raw `{ success, invoices }` — unwrap() collapses both to
 * an empty array. useDashboardStats relies on that distinction to render "—"
 * instead of a misleading ₹0 when Finance is unreachable.
 */
export async function getInvoicesRaw({ studentId, status } = {}) {
  const qs = new URLSearchParams();
  if (studentId) qs.set("studentId", studentId);
  if (status)    qs.set("status", status);
  const url = "/api/invoices" + (qs.toString() ? `?${qs.toString()}` : "");
  return api.get(url).then(r => r.data);
}
