/**
 * communicationService.js (frontend)
 * API client for holidays, notices, and announcements.
 */

import { api } from "./authService";

// ── Holidays ──────────────────────────────────────────────────────────────────
const getHolidays      = (year)     => api.get("/api/holidays",  { params: year ? { year } : {} }).then(r => r.data.holidays || []);
const createHoliday    = (data)     => api.post("/api/holidays",  data).then(r => r.data.holiday);
const updateHoliday    = (id, data) => api.put(`/api/holidays/${id}`,  data).then(r => r.data.holiday);
const deleteHoliday    = (id)       => api.delete(`/api/holidays/${id}`).then(r => r.data);

// ── Notices ───────────────────────────────────────────────────────────────────
const getNotices       = (params={})=> api.get("/api/notices",   { params }).then(r => r.data.notices || []);
const createNotice     = (data)     => api.post("/api/notices",   data).then(r => r.data.notice);
const updateNotice     = (id, data) => api.put(`/api/notices/${id}`,   data).then(r => r.data.notice);
const deleteNotice     = (id)       => api.delete(`/api/notices/${id}`).then(r => r.data);

// ── Announcements ─────────────────────────────────────────────────────────────
const getAnnouncements = (params={})=> api.get("/api/announcements", { params }).then(r => r.data.announcements || []);
const createAnnouncement=(data)     => api.post("/api/announcements", data).then(r => r.data.announcement);
const updateAnnouncement=(id, data) => api.put(`/api/announcements/${id}`, data).then(r => r.data.announcement);
const deleteAnnouncement=(id)       => api.delete(`/api/announcements/${id}`).then(r => r.data);

export default {
  getHolidays, createHoliday, updateHoliday, deleteHoliday,
  getNotices,  createNotice,  updateNotice,  deleteNotice,
  getAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement,
};
