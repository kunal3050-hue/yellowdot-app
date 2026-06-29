/**
 * familyService.js — Front-end API client for the Family Management module (V2).
 */

import { api } from "./authService";

const familyService = {
  // ── List & search ──────────────────────────────────────────────────

  getAll(params = {}) {
    return api.get("/api/families", { params }).then(r => r.data);
  },

  search(q, params = {}) {
    return api.get("/api/families/search", { params: { q, ...params } }).then(r => r.data);
  },

  count() {
    return api.get("/api/families/count").then(r => r.data);
  },

  // ── Single family ──────────────────────────────────────────────────

  getOne(familyId) {
    return api.get(`/api/families/${familyId}`).then(r => r.data);
  },

  getFamilyForStudent(studentId) {
    return api.get(`/api/students/${studentId}/family`).then(r => r.data);
  },

  // ── Mutations ──────────────────────────────────────────────────────

  create(data) {
    return api.post("/api/families", data).then(r => r.data);
  },

  update(familyId, data) {
    return api.put(`/api/families/${familyId}`, data).then(r => r.data);
  },

  remove(familyId) {
    return api.delete(`/api/families/${familyId}`).then(r => r.data);
  },

  // ── Student linking ────────────────────────────────────────────────

  linkStudent(familyId, studentId) {
    return api.post(`/api/families/${familyId}/students/${studentId}`).then(r => r.data);
  },

  unlinkStudent(familyId, studentId) {
    return api.delete(`/api/families/${familyId}/students/${studentId}`).then(r => r.data);
  },

  // ── V2: Notes ─────────────────────────────────────────────────────

  getNotes(familyId) {
    return api.get(`/api/families/${familyId}/notes`).then(r => r.data);
  },

  addNote(familyId, content) {
    return api.post(`/api/families/${familyId}/notes`, { content }).then(r => r.data);
  },

  deleteNote(familyId, noteId) {
    return api.delete(`/api/families/${familyId}/notes/${noteId}`).then(r => r.data);
  },

  // ── V2: Documents ─────────────────────────────────────────────────

  getDocuments(familyId) {
    return api.get(`/api/families/${familyId}/documents`).then(r => r.data);
  },

  addDocument(familyId, data) {
    return api.post(`/api/families/${familyId}/documents`, data).then(r => r.data);
  },

  deleteDocument(familyId, docId) {
    return api.delete(`/api/families/${familyId}/documents/${docId}`).then(r => r.data);
  },

  // ── V2: Timeline ──────────────────────────────────────────────────

  getTimeline(familyId) {
    return api.get(`/api/families/${familyId}/timeline`).then(r => r.data);
  },

  // ── V2: Fees summary ──────────────────────────────────────────────

  getFeesSummary(familyId) {
    return api.get(`/api/families/${familyId}/fees-summary`).then(r => r.data);
  },

  // ── V2: Sibling discount rules ────────────────────────────────────

  getDiscountRules() {
    return api.get("/api/sibling-discount-rules").then(r => r.data);
  },

  updateDiscountRules(rules) {
    return api.put("/api/sibling-discount-rules", { rules }).then(r => r.data);
  },
};

export default familyService;
