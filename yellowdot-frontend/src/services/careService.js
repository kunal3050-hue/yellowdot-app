/**
 * careService.js — Care & Hygiene API client (staff)
 */

import { auth } from "../firebase/firebase";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

async function getHeaders() {
  const token = await auth.currentUser?.getIdToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * Log a care event.
 * @param {{ studentId, studentName, class, type, notes, date }} payload
 */
export async function logCare(payload) {
  const res = await fetch(`${BASE}/api/care`, {
    method:  "POST",
    headers: await getHeaders(),
    body:    JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to log care event.");
  return data;
}

/**
 * Fetch care history.
 * @param {{ studentId?, date?, from?, to?, type?, limit? }} params
 */
export async function getCareHistory(params = {}) {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ""))
  ).toString();
  const res = await fetch(`${BASE}/api/care/history${qs ? `?${qs}` : ""}`, {
    headers: await getHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to load care history.");
  return data;
}

/**
 * Fetch daily summary.
 * @param {{ date? }} params
 */
export async function getCareSummary(params = {}) {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ""))
  ).toString();
  const res = await fetch(`${BASE}/api/care/summary${qs ? `?${qs}` : ""}`, {
    headers: await getHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to load care summary.");
  return data;
}
