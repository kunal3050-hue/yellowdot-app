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

// Daily Care · Holiday Calendar (read-only, class-filtered)
// Pass studentId so the backend can resolve the child's classId and filter
// class-specific holidays accordingly.
export async function getHolidays(year, studentId) {
  const params = {};
  if (year)      params.year      = year;
  if (studentId) params.studentId = studentId;
  const { data } = await api.get("/api/parent/holidays", { params });
  return data;
}

// Notices (read-only, filtered to child's class)
export async function getNotices(studentId) {
  const params = {};
  if (studentId) params.studentId = studentId;
  const { data } = await api.get("/api/parent/notices", { params });
  return data;
}

// Events (class-filtered, with RSVP status)
export async function getEvents(studentId) {
  const params = {};
  if (studentId) params.studentId = studentId;
  const { data } = await api.get("/api/parent/events", { params });
  return data;
}

export async function submitRsvp(eventId, studentId, response) {
  const { data } = await api.post(`/api/parent/events/${eventId}/rsvp`, { studentId, response });
  return data;
}

// Care & Hygiene (read-only, one linked child)
// PTM (Parent-Teacher Meetings)
export async function getPtms(studentId) {
  const params = {};
  if (studentId) params.studentId = studentId;
  const { data } = await api.get("/api/parent/ptm", { params });
  return data;
}

export async function bookPtmSlot(ptmId, studentId, slotId) {
  const { data } = await api.post(`/api/parent/ptm/${ptmId}/book`, { studentId, slotId });
  return data;
}

export async function reschedulePtmBooking(bookingId, newSlotId) {
  const { data } = await api.patch(`/api/parent/ptm/bookings/${bookingId}/reschedule`, { newSlotId });
  return data;
}

export async function cancelPtmBooking(bookingId) {
  const { data } = await api.delete(`/api/parent/ptm/bookings/${bookingId}`);
  return data;
}

export async function getCareLog(studentId, date) {
  const params = {};
  if (studentId) params.studentId = studentId;
  if (date) params.date = date;
  const { data } = await api.get("/api/parent/care", { params });
  return data;
}

// Notifications
export async function getNotifications(params = {}) {
  const { data } = await api.get("/api/parent/notifications", { params });
  return data;
}

// Incident Reports (read-only, own children only)
export async function getIncidents() {
  const { data } = await api.get("/api/parent/incidents");
  return data;
}

export async function acknowledgeIncident(incidentId, notes = "") {
  const { data } = await api.post(`/api/parent/incidents/${incidentId}/acknowledge`, {
    acknowledgementNotes: notes,
  });
  return data;
}

export async function getUnreadNotificationCount() {
  const { data } = await api.get("/api/parent/notifications/unread-count");
  return data.count ?? 0;
}

export async function markNotificationRead(id) {
  const { data } = await api.patch(`/api/parent/notifications/${id}/read`);
  return data;
}

export async function markAllNotificationsRead() {
  const { data } = await api.patch("/api/parent/notifications/read-all");
  return data;
}

export default { getParentProfile, getChildren, getChild, getFeed, getActivity, getChildAttendance, getMemories, getFees, getFoodMenu, getConsumption, getNaps, getHolidays, getNotices, getEvents, submitRsvp, getPtms, bookPtmSlot, reschedulePtmBooking, cancelPtmBooking, getNotifications, getUnreadNotificationCount, markNotificationRead, markAllNotificationsRead };
