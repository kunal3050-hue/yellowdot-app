/**
 * staffService.js — Front-end API client for the Staff Management module.
 *
 * Mirrors the REST surface exposed by yellowdot-backend/routes/staffRoutes.js.
 * All requests go through the shared axios instance (carries Firebase ID token).
 */

import { api } from "./authService";

const staffService = {
  // ── List + counts + dashboard ─────────────────────────────────────

  getAll(params = {}) {
    return api.get("/api/staff", { params }).then(r => r.data);
  },

  search(q, params = {}) {
    return api.get("/api/staff", { params: { search: q, ...params } }).then(r => r.data);
  },

  count() {
    return api.get("/api/staff/count").then(r => r.data);
  },

  dashboard(params = {}) {
    return api.get("/api/staff/dashboard", { params }).then(r => r.data);
  },

  recentActivity(limit = 20) {
    return api.get("/api/staff/recent-activity", { params: { limit } }).then(r => r.data);
  },

  // ── Self ───────────────────────────────────────────────────────────

  getSelf() {
    return api.get("/api/staff/me").then(r => r.data);
  },

  // ── Single record ─────────────────────────────────────────────────

  getOne(staffId) {
    return api.get(`/api/staff/${staffId}`).then(r => r.data);
  },

  getTimeline(staffId, limit = 50) {
    return api.get(`/api/staff/${staffId}/timeline`, { params: { limit } }).then(r => r.data);
  },

  // ── Mutations ─────────────────────────────────────────────────────

  create(data) {
    return api.post("/api/staff", data).then(r => r.data);
  },

  update(staffId, data) {
    return api.put(`/api/staff/${staffId}`, data).then(r => r.data);
  },

  remove(staffId) {                            // soft delete
    return api.delete(`/api/staff/${staffId}`).then(r => r.data);
  },

  restore(staffId) {
    return api.post(`/api/staff/${staffId}/restore`).then(r => r.data);
  },

  // ── Login account linkage ────────────────────────────────────────

  invite(staffId) {
    return api.post(`/api/staff/${staffId}/invite`).then(r => r.data);
  },

  linkUser(staffId, uid) {
    return api.post(`/api/staff/${staffId}/link-user`, { uid }).then(r => r.data);
  },

  unlinkUser(staffId) {
    return api.post(`/api/staff/${staffId}/unlink-user`).then(r => r.data);
  },

  setUserDisabled(staffId, disabled) {
    return api.post(`/api/staff/${staffId}/disable-user`, { disabled }).then(r => r.data);
  },
};

export default staffService;

// ── Local enum constants (kept in sync with backend staffService.js) ───────
export const STAFF_ENUMS = {
  employmentTypes: [
    { value: "full_time",  label: "Full-Time" },
    { value: "part_time",  label: "Part-Time" },
    { value: "contract",   label: "Contract" },
    { value: "intern",     label: "Intern" },
    { value: "consultant", label: "Consultant" },
  ],
  employmentStatuses: [
    { value: "draft",         label: "Draft" },
    { value: "active",        label: "Active" },
    { value: "inactive",      label: "Inactive" },
    { value: "on_leave",      label: "On Leave" },
    { value: "notice_period", label: "Notice Period" },
    { value: "resigned",      label: "Resigned" },
    { value: "terminated",    label: "Terminated" },
    { value: "retired",       label: "Retired" },
  ],
  loginStatuses: [
    { value: "not_linked",      label: "Not Linked" },
    { value: "invitation_sent", label: "Invitation Sent" },
    { value: "active",          label: "Active" },
    { value: "disabled",        label: "Disabled" },
  ],
  categories: [
    { value: "teaching",       label: "Teaching" },
    { value: "non_teaching",   label: "Non-Teaching" },
    { value: "administration", label: "Administration" },
    { value: "management",     label: "Management" },
    { value: "support",        label: "Support Staff" },
  ],
  genders: [
    { value: "male",                label: "Male" },
    { value: "female",              label: "Female" },
    { value: "other",               label: "Other" },
    { value: "prefer_not_to_say",   label: "Prefer not to say" },
  ],
  maritalStatus: [
    { value: "single",   label: "Single" },
    { value: "married",  label: "Married" },
    { value: "divorced", label: "Divorced" },
    { value: "widowed",  label: "Widowed" },
    { value: "other",    label: "Other" },
  ],
  bloodGroups: ["A+","A-","B+","B-","AB+","AB-","O+","O-","Unknown"],
};

export const EMPLOYMENT_STATUS_META = {
  draft:         { label: "Draft",          color: "#7a6e5e", bg: "#f5f0e2", border: "#e0d4b8" },
  active:        { label: "Active",         color: "#059669", bg: "#f0fdf4", border: "#bbf7d0" },
  on_leave:      { label: "On Leave",       color: "#b45309", bg: "#fffbeb", border: "#fde68a" },
  notice_period: { label: "Notice Period",  color: "#92400e", bg: "#fef3c7", border: "#fde68a" },
  resigned:      { label: "Resigned",       color: "#7a6e5e", bg: "#f5f0e2", border: "#e0d4b8" },
  terminated:    { label: "Terminated",     color: "#7a2018", bg: "#fee2e2", border: "#fecaca" },
  inactive:      { label: "Inactive",       color: "#7a6e5e", bg: "#f5f0e2", border: "#e0d4b8" },
  retired:       { label: "Retired",        color: "#4a3f2a", bg: "#fffbeb", border: "#fde68a" },
};

export const LOGIN_STATUS_META = {
  not_linked:      { label: "Not Linked",      color: "#7a6e5e", bg: "#f5f0e2", border: "#e0d4b8", dot: "#a3957e" },
  invitation_sent: { label: "Invitation Sent", color: "#b45309", bg: "#fffbeb", border: "#fde68a", dot: "#d97706" },
  active:          { label: "Active",          color: "#059669", bg: "#f0fdf4", border: "#bbf7d0", dot: "#059669" },
  disabled:        { label: "Disabled",        color: "#7a2018", bg: "#fee2e2", border: "#fecaca", dot: "#DC2626" },
};
