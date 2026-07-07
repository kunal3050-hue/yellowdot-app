/**
 * payrollService.js — Front-end API client for Payroll.
 */

import { api } from "./authService";
import API_BASE_URL from "./api";

const payrollService = {
  // Components
  listComponents(params = {})   { return api.get("/api/salary-components", { params }).then(r => r.data); },
  createComponent(data)         { return api.post("/api/salary-components", data).then(r => r.data); },
  updateComponent(id, data)     { return api.put(`/api/salary-components/${id}`, data).then(r => r.data); },
  removeComponent(id)           { return api.delete(`/api/salary-components/${id}`).then(r => r.data); },

  // Structures
  listStructures()              { return api.get("/api/salary-structures").then(r => r.data); },
  createStructure(data)         { return api.post("/api/salary-structures", data).then(r => r.data); },
  updateStructure(id, data)     { return api.put(`/api/salary-structures/${id}`, data).then(r => r.data); },
  removeStructure(id)           { return api.delete(`/api/salary-structures/${id}`).then(r => r.data); },

  // Staff salary
  listStaffSalary(params = {})  { return api.get("/api/staff-salary", { params }).then(r => r.data); },
  getStaffSalary(staffId)       { return api.get(`/api/staff-salary/${staffId}`).then(r => r.data); },
  upsertStaffSalary(staffId, data) { return api.put(`/api/staff-salary/${staffId}`, data).then(r => r.data); },
  removeStaffSalary(staffId)    { return api.delete(`/api/staff-salary/${staffId}`).then(r => r.data); },

  // Runs
  listRuns()                    { return api.get("/api/payroll-runs").then(r => r.data); },
  getRun(id)                    { return api.get(`/api/payroll-runs/${id}`).then(r => r.data); },
  processRun(year, month)       { return api.post("/api/payroll-runs/process", { year, month }).then(r => r.data); },
  lockRun(id)                   { return api.post(`/api/payroll-runs/${id}/lock`).then(r => r.data); },
  reopenRun(id)                 { return api.post(`/api/payroll-runs/${id}/reopen`).then(r => r.data); },
  bankReport(runId)             { return api.get("/api/payroll-runs/bank-report", { params: { runId } }).then(r => r.data); },

  // Payslips
  listPayslips(params = {})     { return api.get("/api/payslips", { params }).then(r => r.data); },
  getPayslip(id)                { return api.get(`/api/payslips/${id}`).then(r => r.data); },
  myPayslips()                  { return api.get("/api/payslips/me").then(r => r.data); },
  payslipPdfUrl(id)             { return `${API_BASE_URL}/api/payslips/${id}/pdf`; },
};

export default payrollService;

export const RUN_STATUS_META = {
  draft:     { label: "Draft",     color: "#7a6e5e", bg: "#f5f0e2", border: "#e0d4b8" },
  processed: { label: "Processed", color: "#059669", bg: "#f0fdf4", border: "#bbf7d0" },
  locked:    { label: "Locked",    color: "#1f1f1f", bg: "#fff7e0", border: "#fde68a" },
  reversed:  { label: "Reversed",  color: "#7a2018", bg: "#fee2e2", border: "#fecaca" },
};
