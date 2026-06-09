/**
 * parentService.js — Parent Module API client (V1)
 * ──────────────────────────────────────────────────────────────────
 * Thin wrapper over the shared axios instance (Firebase token attached
 * automatically by the request interceptor in authService).
 *
 *   getParentProfile()  → { parent, children }
 *   getChildren()       → { children }
 *   getChild(studentId) → { child }
 */

import { api } from "../../../services/authService";

export async function getParentProfile() {
  const { data } = await api.get("/api/parent/me");
  return data;
}

export async function getChildren() {
  const { data } = await api.get("/api/parent/children");
  return data;
}

export async function getChild(studentId) {
  const { data } = await api.get(`/api/parent/child/${studentId}`);
  return data;
}

// Phase 2 — Home Feed
export async function getFeed() {
  const { data } = await api.get("/api/parent/feed");
  return data;
}

// Phase 3 — Attendance (read-only view for one linked child)
export async function getChildAttendance(studentId, month) {
  const { data } = await api.get(`/api/parent/child/${studentId}/attendance`, {
    params: month ? { month } : {},
  });
  return data;
}

// Phase 4 — Memories (photos/videos for linked children)
export async function getMemories(studentId) {
  const { data } = await api.get("/api/parent/memories", {
    params: studentId ? { studentId } : {},
  });
  return data;
}

// Phase 5 — Fees (read-only, for linked children)
export async function getFees(studentId) {
  const { data } = await api.get("/api/parent/fees", {
    params: studentId ? { studentId } : {},
  });
  return data;
}

// Daily Care · Food Menu (read-only)
export async function getFoodMenu(date) {
  const { data } = await api.get("/api/parent/food-menu", { params: date ? { date } : {} });
  return data;
}

// Daily Care · Consumption Log (read-only, one linked child)
export async function getConsumption(studentId, date) {
  const params = {};
  if (studentId) params.studentId = studentId;
  if (date) params.date = date;
  const { data } = await api.get("/api/parent/consumption", { params });
  return data;
}

// Daily Care · Nap Tracker (read-only, one linked child)
export async function getNaps(studentId, date) {
  const params = {};
  if (studentId) params.studentId = studentId;
  if (date) params.date = date;
  const { data } = await api.get("/api/parent/naps", { params });
  return data;
}

// Home — unified child-specific activity timeline (+ nearest upcoming holiday)
export async function getActivity(studentId) {
  const { data } = await api.get("/api/parent/activity", { params: studentId ? { studentId } : {} });
  return data;
}

// Daily Care · Holiday Calendar (read-only, school-scoped)
export async function getHolidays(year) {
  const { data } = await api.get("/api/parent/holidays", { params: year ? { year } : {} });
  return data;
}

export default { getParentProfile, getChildren, getChild, getFeed, getActivity, getChildAttendance, getMemories, getFees, getFoodMenu, getConsumption, getNaps, getHolidays };
