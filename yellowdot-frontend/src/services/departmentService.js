/**
 * departmentService.js — Front-end API client for Departments.
 */

import { api } from "./authService";

const departmentService = {
  getAll(params = {}) {
    return api.get("/api/departments", { params }).then(r => r.data);
  },
  getOne(deptId) {
    return api.get(`/api/departments/${deptId}`).then(r => r.data);
  },
  create(data) {
    return api.post("/api/departments", data).then(r => r.data);
  },
  update(deptId, data) {
    return api.put(`/api/departments/${deptId}`, data).then(r => r.data);
  },
  remove(deptId) {
    return api.delete(`/api/departments/${deptId}`).then(r => r.data);
  },
};

export default departmentService;
