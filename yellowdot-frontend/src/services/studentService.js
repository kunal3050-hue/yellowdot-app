/**
 * studentService.js — Student data layer
 * ─────────────────────────────────────────────────────────────────
 * Thin wrapper over the existing /students REST endpoint. No new
 * backend routes (PLATFORM ARCHITECTURE §10 — reuse before adding).
 *
 *   GET /students[?search=]  → { success, students } | Student[]
 *
 * This file existed as a ZERO-BYTE placeholder, which is part of why
 * callers reached for `api.get("/students")` directly — there was no
 * service to use. Filled in §12 Phase 3.
 *
 * The endpoint is inconsistent: some responses are the bare array,
 * others wrap it in { success, students }. Both shapes are handled here
 * once, rather than at each of the six call sites that re-do it today.
 */

import { api } from "./authService";

/** Normalise both response shapes to a plain array. */
export function unwrapStudents(res) {
  if (Array.isArray(res)) return res;
  return res?.students || [];
}

/**
 * Raw response, envelope intact.
 * Use when the caller must distinguish "request failed" from "no students" —
 * useDashboardStats does exactly that, to show "—" rather than "0" when the
 * endpoint is unreachable.
 */
export async function getStudentsRaw(params = {}) {
  const { data } = await api.get("/students", { params });
  return data;
}

/** Student list, with both envelope shapes normalised away. */
export async function getStudents(params = {}) {
  return unwrapStudents(await getStudentsRaw(params));
}

/** Search by name/id — same endpoint, server-side filter. */
export async function searchStudents(search) {
  return getStudents({ search });
}

export default { getStudents, getStudentsRaw, searchStudents, unwrapStudents };
