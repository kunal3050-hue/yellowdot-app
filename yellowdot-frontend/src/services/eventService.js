/**
 * eventService.js — Staff API client for Events
 */

import { api } from "./authService";

export async function getEvents() {
  const { data } = await api.get("/api/events");
  return data;
}

export async function createEvent(payload) {
  const { data } = await api.post("/api/events", payload);
  return data;
}

export async function updateEvent(id, payload) {
  const { data } = await api.put(`/api/events/${id}`, payload);
  return data;
}

export async function deleteEvent(id) {
  const { data } = await api.delete(`/api/events/${id}`);
  return data;
}

export async function getEventRsvps(id) {
  const { data } = await api.get(`/api/events/${id}/rsvps`);
  return data;
}

export default { getEvents, createEvent, updateEvent, deleteEvent, getEventRsvps };
