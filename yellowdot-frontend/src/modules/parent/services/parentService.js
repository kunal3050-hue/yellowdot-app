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

export default { getParentProfile, getChildren, getChild, getFeed, getChildAttendance, getMemories, getFees, getFoodMenu };
