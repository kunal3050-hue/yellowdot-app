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

  // POST /api/cctv/cameras/verify  { cameraId } | inline camera fields
  // DEFAULT Test Camera action — real RTSP: auth + channel + stream.
  verifyCamera: (payload) =>
    request("/api/cctv/cameras/verify", { method: "POST", body: JSON.stringify(payload) }),

  // POST /api/cctv/cameras/test  { streamUrl } | { ip, port } | { cameraId }
  // Hidden developer diagnostic: TCP reachability only (no auth/stream).
  testConnection: (payload) =>
    request("/api/cctv/cameras/test", { method: "POST", body: JSON.stringify(payload) }),

  // POST /api/cctv/cameras/:id/live-token — Staff Live View.
  // Returns engine HLS/WebRTC URL + short-lived token (or 503 ENGINE_NOT_PROVISIONED).
  getLiveToken: (id) =>
    request(`/api/cctv/cameras/${encodeURIComponent(id)}/live-token`, { method: "POST", body: JSON.stringify({}) }),

  // POST /api/cctv/cameras/:id/live-stop
  stopLive: (id, sessionId) =>
    request(`/api/cctv/cameras/${encodeURIComponent(id)}/live-stop`, { method: "POST", body: JSON.stringify({ sessionId }) }),
};

export default cctvService;
