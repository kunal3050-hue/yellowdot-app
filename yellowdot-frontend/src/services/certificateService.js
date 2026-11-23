/**
 * certificateService.js — Certificates API client (staff)
 *
 * Uses the shared axios `api` instance from authService so the Firebase token
 * is injected by the request interceptor. Same shape as careService.js.
 *
 * Note on `classId`: everywhere else in this app a student's class travels as
 * its NAME string (students carry `class: "Playgroup"`, attendance rows the
 * same), so that is what goes in both `classId` and `className`. The two
 * fields are kept separate on the record regardless — `className` is what gets
 * printed and frozen onto the document, `classId` is what the register filters
 * by — so introducing real class ids later does not need a data migration of
 * certificates already issued.
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

/** The issuance register, newest award first. */
export async function listCertificates(params = {}) {
  const res = await api({ method: "GET", url: `/api/certificates${qs(params)}` });
  return res.data;
}

/** Counts for the KPI row. */
export async function getSummary(params = {}) {
  const res = await api({ method: "GET", url: `/api/certificates/summary${qs(params)}` });
  return res.data;
}

/** One certificate. */
export async function getCertificate(certificateId) {
  const res = await api({ method: "GET", url: `/api/certificates/${certificateId}` });
  return res.data;
}

/** Children whose attendance over a range meets the threshold. */
export async function getAttendanceEligibility(params = {}) {
  const res = await api({
    method: "GET",
    url: `/api/certificates/eligibility/attendance${qs(params)}`,
  });
  return res.data;
}

/** Issue a single certificate. */
export async function issueCertificate(payload) {
  const res = await api({ method: "POST", url: "/api/certificates", data: payload });
  return res.data;
}

/**
 * Issue one certificate per student, sharing type/title/citation/date/
 * template/signatory. Returns { issued, skipped, batchId } — `skipped` lists
 * children who already hold that certificate for the year.
 */
export async function issueBulk(payload) {
  const res = await api({ method: "POST", url: "/api/certificates/bulk", data: payload });
  return res.data;
}

/** Edit a draft, or promote it with { status: "issued" }. */
export async function updateCertificate(certificateId, patch) {
  const res = await api({ method: "PATCH", url: `/api/certificates/${certificateId}`, data: patch });
  return res.data;
}

/** Soft revoke — the row stays in the register. */
export async function revokeCertificate(certificateId, reason) {
  const res = await api({
    method: "POST",
    url: `/api/certificates/${certificateId}/revoke`,
    data: { reason },
  });
  return res.data;
}

export default {
  listCertificates,
  getSummary,
  getCertificate,
  getAttendanceEligibility,
  issueCertificate,
  issueBulk,
  updateCertificate,
  revokeCertificate,
};
