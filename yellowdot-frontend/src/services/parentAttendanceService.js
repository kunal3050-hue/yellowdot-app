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

const parentAttendanceService = {
  // GET /api/parent-attendance/validate-gate?qr=YD-SEAWOODS-GATE-1
  validateGate: (qr) =>
    request(`/api/parent-attendance/validate-gate?qr=${encodeURIComponent(qr)}`),

  // GET /api/parent-attendance?date=&studentId=&gate=
  getRecords: (params = {}) =>
    request(`/api/parent-attendance${qs(params)}`),

  // POST /api/parent-attendance
  create: (data) =>
    request("/api/parent-attendance", {
      method: "POST",
      body:   JSON.stringify(data),
    }),
};

export default parentAttendanceService;
