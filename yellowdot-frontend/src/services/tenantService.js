/**
 * tenantService.js — Frontend API client for tenant management
 * Super Admin only.
 */

import { getAuth } from "firebase/auth";

const BASE = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

async function _authHeaders() {
  const user = getAuth().currentUser;
  if (!user) throw new Error("Not authenticated");
  const token = await user.getIdToken();
  return {
    "Content-Type": "application/json",
    Authorization:  `Bearer ${token}`,
  };
}

async function _req(method, path, body) {
  const headers = await _authHeaders();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const tenantService = {
  list:   (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return _req("GET", `/api/tenants${qs ? `?${qs}` : ""}`);
  },
  get:    (tenantId) => _req("GET",    `/api/tenants/${tenantId}`),
  create: (data)     => _req("POST",   "/api/tenants", data),
  update: (id, data) => _req("PUT",    `/api/tenants/${id}`, data),
  delete: (id)       => _req("DELETE", `/api/tenants/${id}`),

  setStatus: (id, status, reason) =>
    _req("POST", `/api/tenants/${id}/status`, { status, reason }),

  impersonate: (id) => _req("POST", `/api/tenants/${id}/impersonate`),

  addBranch:    (id, branch) => _req("POST",   `/api/tenants/${id}/branches`, branch),
  removeBranch: (id, bId)    => _req("DELETE", `/api/tenants/${id}/branches/${bId}`),

  upsertAcademicYear: (id, year) => _req("POST", `/api/tenants/${id}/academic-years`, year),

  analytics: () => _req("GET", "/api/tenants/analytics"),
  auditLogs: (tenantId, limit = 50) => {
    const path = tenantId
      ? `/api/tenants/${tenantId}/audit-logs?limit=${limit}`
      : `/api/tenants/audit-logs?limit=${limit}`;
    return _req("GET", path);
  },
};
