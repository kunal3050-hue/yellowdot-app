import { api } from "./authService";

function qs(params) {
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

const pickupHistoryService = {
  // GET /api/pickup-history?date=&studentId=&approvalStatus=
  getHistory: (params = {}) =>
    request(`/api/pickup-history${qs(params)}`),

  // GET /api/pickup-history/:id  (includes selfie)
  getEntry: (id) =>
    request(`/api/pickup-history/${encodeURIComponent(id)}`),

  // POST /api/pickup-history
  addHistory: (data) =>
    request("/api/pickup-history", {
      method: "POST",
      body:   JSON.stringify(data),
    }),
};

export default pickupHistoryService;
