/**
 * incidentService.js — Frontend API client for Incident Reports
 */

import { api } from "./authService";

export async function getIncidents(params = {}) {
  const { data } = await api.get("/api/incidents", { params });
  return data;
}

export async function getDashboard() {
  const { data } = await api.get("/api/incidents/dashboard");
  return data;
}

export async function getStaff() {
  const { data } = await api.get("/api/incidents/staff");
  return data;
}

export async function getIncident(id) {
  const { data } = await api.get(`/api/incidents/${id}`);
  return data;
}

export async function createIncident(payload) {
  const { data } = await api.post("/api/incidents", payload);
  return data;
}

export async function updateIncident(id, payload) {
  const { data } = await api.put(`/api/incidents/${id}`, payload);
  return data;
}

export async function deleteIncident(id) {
  const { data } = await api.delete(`/api/incidents/${id}`);
  return data;
}

export async function updateStatus(id, status) {
  const { data } = await api.patch(`/api/incidents/${id}/status`, { status });
  return data;
}

export async function getAuditLog(id) {
  const { data } = await api.get(`/api/incidents/${id}/audit`);
  return data;
}

export default { getIncidents, getDashboard, getStaff, getIncident, createIncident, updateIncident, deleteIncident, updateStatus, getAuditLog };
