/**
 * designationService.js — Front-end API client for Designations.
 */

import { api } from "./authService";

const designationService = {
  getAll(params = {}) {
    return api.get("/api/designations", { params }).then(r => r.data);
  },
  getOne(designationId) {
    return api.get(`/api/designations/${designationId}`).then(r => r.data);
  },
  create(data) {
    return api.post("/api/designations", data).then(r => r.data);
  },
  update(designationId, data) {
    return api.put(`/api/designations/${designationId}`, data).then(r => r.data);
  },
  remove(designationId) {
    return api.delete(`/api/designations/${designationId}`).then(r => r.data);
  },
};

export default designationService;
