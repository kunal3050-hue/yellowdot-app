/**
 * journeyService.js — Child Journey Module · Staff API client
 */

import { api } from "./authService";

export async function getEntries({ studentId, classId, kind, academicYear, limit } = {}) {
  const { data } = await api.get("/api/journey", {
    params: {
      ...(studentId    && { studentId }),
      ...(classId      && { classId }),
      ...(kind         && { kind }),
      ...(academicYear && { academicYear }),
      ...(limit        && { limit }),
    },
  });
  return data;
}

export async function createEntry(payload) {
  const { data } = await api.post("/api/journey", payload);
  return data;
}

export async function updateEntry(id, payload) {
  const { data } = await api.put(`/api/journey/${id}`, payload);
  return data;
}

export async function deleteEntry(id) {
  const { data } = await api.delete(`/api/journey/${id}`);
  return data;
}

// Parent: fetch a child's unified journey timeline
export async function getParentJourney({ childId, kind, academicYear, limit } = {}) {
  const { data } = await api.get("/api/parent/journey", {
    params: {
      childId,
      ...(kind         && { kind }),
      ...(academicYear && { academicYear }),
      ...(limit        && { limit }),
    },
  });
  return data;
}

export default { getEntries, createEntry, updateEntry, deleteEntry, getParentJourney };
