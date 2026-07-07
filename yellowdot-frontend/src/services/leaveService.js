/**
 * leaveService.js — Front-end API client for Leave Management.
 */

import { api } from "./authService";

const leaveService = {
  // Types
  listTypes(params = {})        { return api.get("/api/leave-types", { params }).then(r => r.data); },
  createType(data)              { return api.post("/api/leave-types", data).then(r => r.data); },
  updateType(id, data)          { return api.put(`/api/leave-types/${id}`, data).then(r => r.data); },
  removeType(id)                { return api.delete(`/api/leave-types/${id}`).then(r => r.data); },

  // Balances
  myBalances(year)              { return api.get("/api/leave-balances/me", { params: { year } }).then(r => r.data); },
  balancesForStaff(staffId, year) { return api.get(`/api/leave-balances/staff/${staffId}`, { params: { year } }).then(r => r.data); },

  // Requests
  listRequests(params = {})     { return api.get("/api/leave-requests", { params }).then(r => r.data); },
  getRequest(id)                { return api.get(`/api/leave-requests/${id}`).then(r => r.data); },
  apply(data)                   { return api.post("/api/leave-requests", data).then(r => r.data); },
  approve(id, comment)          { return api.post(`/api/leave-requests/${id}/approve`, { comment }).then(r => r.data); },
  reject(id, comment)           { return api.post(`/api/leave-requests/${id}/reject`,  { comment }).then(r => r.data); },
  cancel(id)                    { return api.post(`/api/leave-requests/${id}/cancel`).then(r => r.data); },
  remove(id)                    { return api.delete(`/api/leave-requests/${id}`).then(r => r.data); },

  // Aggregates
  calendar(fromDate, toDate)    { return api.get("/api/leave-calendar",  { params: { fromDate, toDate } }).then(r => r.data); },
  dashboard()                   { return api.get("/api/leave-dashboard").then(r => r.data); },
  report(year)                  { return api.get("/api/leave-reports",   { params: { year } }).then(r => r.data); },
};

export default leaveService;

export const LEAVE_STATUS_META = {
  pending:   { label: "Pending",   color: "#b45309", bg: "#fffbeb", border: "#fde68a" },
  approved:  { label: "Approved",  color: "#059669", bg: "#f0fdf4", border: "#bbf7d0" },
  rejected:  { label: "Rejected",  color: "#7a2018", bg: "#fee2e2", border: "#fecaca" },
  cancelled: { label: "Cancelled", color: "#7a6e5e", bg: "#f5f0e2", border: "#e0d4b8" },
};

export const GENDER_RESTRICTIONS = [
  { value: "any",    label: "Any" },
  { value: "female", label: "Female only" },
  { value: "male",   label: "Male only" },
];
