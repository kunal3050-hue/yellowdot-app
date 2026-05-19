import { api } from "./authService";

const request = (path, options = {}) => {
  const { method = "GET", body } = options;
  const data = body ? JSON.parse(body) : undefined;
  return api({ method, url: path, data }).then(r => r.data);
};

const streamService = {
  // GET /api/stream/status?cameraId=  — single-camera status
  // GET /api/stream/status            — all statuses (array)
  getStatus: (cameraId) =>
    request(`/api/stream/status${cameraId ? `?cameraId=${encodeURIComponent(cameraId)}` : ""}`),

  // POST /api/stream/start  { cameraId }
  startStream: (cameraId) =>
    request("/api/stream/start", {
      method: "POST",
      body:   JSON.stringify({ cameraId }),
    }),

  // POST /api/stream/stop  { cameraId }  — stops specific camera
  // POST /api/stream/stop  {}            — stops all (fallback)
  stopStream: (cameraId) =>
    request("/api/stream/stop", {
      method: "POST",
      body:   JSON.stringify(cameraId ? { cameraId } : {}),
    }),
};

export default streamService;
