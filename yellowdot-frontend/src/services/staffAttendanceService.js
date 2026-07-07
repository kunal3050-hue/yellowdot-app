/**
 * staffAttendanceService.js — Front-end API client for Staff Attendance + Shifts.
 */

import { api } from "./authService";

const staffAttendanceService = {
  list(params = {}) {
    return api.get("/api/staff-attendance", { params }).then(r => r.data);
  },
  today(params = {}) {
    return api.get("/api/staff-attendance/today", { params }).then(r => r.data);
  },
  dashboard(params = {}) {
    return api.get("/api/staff-attendance/dashboard", { params }).then(r => r.data);
  },
  staffMonth(staffId, { year, month } = {}) {
    return api.get(`/api/staff-attendance/staff/${staffId}/month`, { params: { year, month } }).then(r => r.data);
  },

  checkIn(payload)  { return api.post("/api/staff-attendance/check-in",  payload).then(r => r.data); },
  checkOut(payload) { return api.post("/api/staff-attendance/check-out", payload).then(r => r.data); },
  markStatus(payload) { return api.post("/api/staff-attendance/mark",    payload).then(r => r.data); },

  selfCheckIn(payload = {})  { return api.post("/api/staff-attendance/self/check-in",  payload).then(r => r.data); },
  selfCheckOut(payload = {}) { return api.post("/api/staff-attendance/self/check-out", payload).then(r => r.data); },
  qrToggle(payload)          { return api.post("/api/staff-attendance/qr", payload).then(r => r.data); },

  update(id, data) { return api.put(`/api/staff-attendance/${id}`, data).then(r => r.data); },
  remove(id)       { return api.delete(`/api/staff-attendance/${id}`).then(r => r.data); },

  dailyReport(date)   { return api.get("/api/staff-attendance/reports/daily",   { params: { date } }).then(r => r.data); },
  monthlyReport(year, month) { return api.get("/api/staff-attendance/reports/monthly", { params: { year, month } }).then(r => r.data); },

  // Shifts
  listShifts(params = {})        { return api.get("/api/staff-shifts", { params }).then(r => r.data); },
  createShift(data)              { return api.post("/api/staff-shifts", data).then(r => r.data); },
  updateShift(shiftId, data)     { return api.put(`/api/staff-shifts/${shiftId}`, data).then(r => r.data); },
  removeShift(shiftId)           { return api.delete(`/api/staff-shifts/${shiftId}`).then(r => r.data); },
};

export default staffAttendanceService;

export const ATTENDANCE_STATUSES = [
  { value: "present",  label: "Present",  color: "#059669", bg: "#f0fdf4", border: "#bbf7d0" },
  { value: "absent",   label: "Absent",   color: "#7a2018", bg: "#fee2e2", border: "#fecaca" },
  { value: "half_day", label: "Half Day", color: "#b45309", bg: "#fffbeb", border: "#fde68a" },
  { value: "leave",    label: "Leave",    color: "#92400e", bg: "#fef3c7", border: "#fde68a" },
  { value: "holiday",  label: "Holiday",  color: "#4a3f2a", bg: "#fff7e0", border: "#fde68a" },
  { value: "wfh",      label: "WFH",      color: "#1f1f1f", bg: "#f5f0e2", border: "#e0d4b8" },
  { value: "weekend",  label: "Weekend",  color: "#7a6e5e", bg: "#f5f0e2", border: "#e0d4b8" },
];

export const STATUS_META = Object.fromEntries(ATTENDANCE_STATUSES.map(s => [s.value, s]));
