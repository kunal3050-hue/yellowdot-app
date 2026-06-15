/**
 * careService.js — Care & Hygiene API client (staff)
 * Uses the shared axios `api` instance from authService so tokens
 * are injected automatically via the request interceptor.
 */

import { api } from "./authService";

function qs(params) {
  const q = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ""))
  ).toString();
  return q ? `?${q}` : "";
}

export async function logCare(payload) {
  const res = await api({ method: "POST", url: "/api/care", data: payload });
  return res.data;
}

export async function getCareHistory(params = {}) {
  const res = await api({ method: "GET", url: `/api/care/history${qs(params)}` });
  return res.data;
}

export async function getCareSummary(params = {}) {
  const res = await api({ method: "GET", url: `/api/care/summary${qs(params)}` });
  return res.data;
}
