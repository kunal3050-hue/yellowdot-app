/**
 * notificationService.js — Parent Module · Notification API client
 * ─────────────────────────────────────────────────────────────────
 * Thin wrapper over the shared axios instance.
 */

import { api } from "../../../services/authService";

export async function getNotifications({ childId, type, limit, before } = {}) {
  const params = {};
  if (childId) params.childId = childId;
  if (type)    params.type    = type;
  if (limit)   params.limit   = limit;
  if (before)  params.before  = before;
  const { data } = await api.get("/api/parent/notifications", { params });
  return data; // { notifications }
}

export async function getUnreadCount() {
  const { data } = await api.get("/api/parent/notifications/unread-count");
  return data.count ?? 0;
}

export async function markRead(notificationId) {
  const { data } = await api.patch(`/api/parent/notifications/${notificationId}/read`);
  return data;
}

export async function markAllRead() {
  const { data } = await api.patch("/api/parent/notifications/read-all");
  return data;
}

export async function registerFcmToken(token) {
  const { data } = await api.post("/api/parent/notifications/fcm-token", { token });
  return data;
}

export default { getNotifications, getUnreadCount, markRead, markAllRead, registerFcmToken };
