import { api } from "./authService";

/**
 * cctvService.js — CCTV V2 Phase 1 API client (camera metadata).
 * No streaming endpoints — management + test-connection only.
 */

function qs(params = {}) {
  const q = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== "" && v != null))
  ).toString();
  return q ? `?${q}` : "";
}

const request = (path, options = {}) => {
  const { method = "GET", body } = options;
  const data = body ? JSON.parse(body) : undefined;
  return api({ method, url: path, data }).then(r => r.data);
};

const cctvService = {
  // GET /api/cctv/cameras?classroom=
  getCameras: (params = {}) => request(`/api/cctv/cameras${qs(params)}`),

  // GET /api/cctv/cameras/:id
  getCamera: (id) => request(`/api/cctv/cameras/${encodeURIComponent(id)}`),

  // POST /api/cctv/cameras
  addCamera: (data) =>
    request("/api/cctv/cameras", { method: "POST", body: JSON.stringify(data) }),

  // PUT /api/cctv/cameras/:id
  updateCamera: (id, data) =>
    request(`/api/cctv/cameras/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(data) }),

  // DELETE /api/cctv/cameras/:id
  deleteCamera: (id) =>
    request(`/api/cctv/cameras/${encodeURIComponent(id)}`, { method: "DELETE" }),

  // POST /api/cctv/cameras/test  { streamUrl } | { cameraId }
  // Phase 1: TCP reachability only (no stream verification).
  testConnection: (payload) =>
    request("/api/cctv/cameras/test", { method: "POST", body: JSON.stringify(payload) }),
};

export default cctvService;
