/**
 * ptmService.js — Frontend API client for PTM (Parent-Teacher Meetings)
 */

import { api } from "./authService";

export async function getPtms() {
  const { data } = await api.get("/api/ptm");
  return data;
}

export async function createPtm(payload) {
  const { data } = await api.post("/api/ptm", payload);
  return data;
}

export async function updatePtm(id, payload) {
  const { data } = await api.put(`/api/ptm/${id}`, payload);
  return data;
}

export async function deletePtm(id) {
  const { data } = await api.delete(`/api/ptm/${id}`);
  return data;
}

export async function getSlots(ptmId) {
  const { data } = await api.get(`/api/ptm/${ptmId}/slots`);
  return data;
}

export async function generateSlots(ptmId, payload) {
  const { data } = await api.post(`/api/ptm/${ptmId}/slots/generate`, payload);
  return data;
}

export async function deleteSlot(ptmId, slotId) {
  const { data } = await api.delete(`/api/ptm/${ptmId}/slots/${slotId}`);
  return data;
}

export async function getBookings(ptmId) {
  const { data } = await api.get(`/api/ptm/${ptmId}/bookings`);
  return data;
}

export async function updateBookingStatus(bookingId, status) {
  const { data } = await api.patch(`/api/ptm/bookings/${bookingId}/status`, { status });
  return data;
}

export async function getNotes(ptmId, studentId) {
  const { data } = await api.get(`/api/ptm/${ptmId}/notes/${studentId}`);
  return data;
}

export async function saveNotes(ptmId, studentId, payload) {
  const { data } = await api.put(`/api/ptm/${ptmId}/notes/${studentId}`, payload);
  return data;
}

export async function getStats(ptmId) {
  const { data } = await api.get(`/api/ptm/${ptmId}/stats`);
  return data;
}

export async function getTeachers() {
  const { data } = await api.get("/api/ptm/teachers");
  return data;
}

export default { getPtms, createPtm, updatePtm, deletePtm, getSlots, generateSlots, deleteSlot, getBookings, updateBookingStatus, getNotes, saveNotes, getStats, getTeachers };
