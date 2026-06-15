import { api } from "./authService";

const unwrap = (res, key) =>
  res?.success ? (res[key] || []) : (Array.isArray(res) ? res : []);

export const recordPayment = (paymentData) =>
  api.post("/record-payment", paymentData).then(r => r.data);

/**
 * Fetch payments, optionally scoped by student or invoice.
 * Returns the full set for the school when no filter is given —
 * used by the Collection Dashboard for school-wide aggregation.
 *
 *   GET /api/payments[?studentId=&invoiceNumber=]  → { success, payments }
 */
export async function fetchAllPayments({ studentId, invoiceNumber } = {}) {
  const qs = new URLSearchParams();
  if (studentId)     qs.set("studentId", studentId);
  if (invoiceNumber) qs.set("invoiceNumber", invoiceNumber);
  const url = "/api/payments" + (qs.toString() ? `?${qs.toString()}` : "");
  const res = await api.get(url).then(r => r.data);
  return unwrap(res, "payments");
}
