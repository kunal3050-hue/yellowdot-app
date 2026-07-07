/**
 * performanceService.js — Front-end API client for Performance Management.
 */

import { api } from "./authService";

const performanceService = {
  // KPIs
  listKpis(params = {})           { return api.get("/api/performance-kpis", { params }).then(r => r.data); },
  createKpi(data)                 { return api.post("/api/performance-kpis", data).then(r => r.data); },
  updateKpi(id, data)             { return api.put(`/api/performance-kpis/${id}`, data).then(r => r.data); },
  removeKpi(id)                   { return api.delete(`/api/performance-kpis/${id}`).then(r => r.data); },

  // Reviews
  listReviews(params = {})        { return api.get("/api/performance-reviews", { params }).then(r => r.data); },
  getReview(id)                   { return api.get(`/api/performance-reviews/${id}`).then(r => r.data); },
  saveReview(data)                { return api.post("/api/performance-reviews", data).then(r => r.data); },
  removeReview(id)                { return api.delete(`/api/performance-reviews/${id}`).then(r => r.data); },

  // Goals
  listGoals(params = {})          { return api.get("/api/performance-goals", { params }).then(r => r.data); },
  saveGoal(data)                  { return api.post("/api/performance-goals", data).then(r => r.data); },
  removeGoal(id)                  { return api.delete(`/api/performance-goals/${id}`).then(r => r.data); },

  // Parent feedback
  listFeedback(params = {})       { return api.get("/api/parent-feedback", { params }).then(r => r.data); },
  createFeedback(data)            { return api.post("/api/parent-feedback", data).then(r => r.data); },
  removeFeedback(id)              { return api.delete(`/api/parent-feedback/${id}`).then(r => r.data); },
  feedbackSummary(staffId)        { return api.get(`/api/parent-feedback/staff/${staffId}/summary`).then(r => r.data); },

  // Promotions
  listPromotions(params = {})     { return api.get("/api/staff-promotions", { params }).then(r => r.data); },
  createPromotion(data)           { return api.post("/api/staff-promotions", data).then(r => r.data); },
  removePromotion(id)             { return api.delete(`/api/staff-promotions/${id}`).then(r => r.data); },

  // Awards
  listAwards(params = {})         { return api.get("/api/staff-awards", { params }).then(r => r.data); },
  createAward(data)               { return api.post("/api/staff-awards", data).then(r => r.data); },
  removeAward(id)                 { return api.delete(`/api/staff-awards/${id}`).then(r => r.data); },

  // Timeline + dashboard + AI summary
  timeline(staffId, limit = 100)  { return api.get(`/api/performance-timeline/${staffId}`, { params: { limit } }).then(r => r.data); },
  dashboard()                     { return api.get("/api/performance-dashboard").then(r => r.data); },
  aiSummary(staffId)              { return api.get(`/api/performance-ai-summary/${staffId}`).then(r => r.data); },
};

export default performanceService;

export const REVIEW_STATUS_META = {
  draft:        { label: "Draft",        color: "#7a6e5e", bg: "#f5f0e2", border: "#e0d4b8" },
  submitted:    { label: "Submitted",    color: "#b45309", bg: "#fffbeb", border: "#fde68a" },
  acknowledged: { label: "Acknowledged", color: "#059669", bg: "#f0fdf4", border: "#bbf7d0" },
};
export const GOAL_STATUS_META = {
  not_started: { label: "Not Started", color: "#7a6e5e", bg: "#f5f0e2", border: "#e0d4b8" },
  in_progress: { label: "In Progress", color: "#b45309", bg: "#fffbeb", border: "#fde68a" },
  completed:   { label: "Completed",   color: "#059669", bg: "#f0fdf4", border: "#bbf7d0" },
  overdue:     { label: "Overdue",     color: "#7a2018", bg: "#fee2e2", border: "#fecaca" },
  cancelled:   { label: "Cancelled",   color: "#7a6e5e", bg: "#f5f0e2", border: "#e0d4b8" },
};
