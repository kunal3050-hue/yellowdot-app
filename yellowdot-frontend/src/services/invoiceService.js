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
  const qs = new URLSearchParams();
  if (studentId) qs.set("studentId", studentId);
  if (status)    qs.set("status", status);
  const url = "/api/invoices" + (qs.toString() ? `?${qs.toString()}` : "");
  const res = await api.get(url).then(r => r.data);
  return unwrap(res, "invoices");
}
