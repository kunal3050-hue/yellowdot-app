import { api } from "./authService";

function qs(params) {
  const q = new URLSearchParams(
    Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== "" && v != null)
    )
  ).toString();
  return q ? `?${q}` : "";
}

const request = (path, options = {}) => {
  const { method = "GET", body } = options;
  const data = body ? JSON.parse(body) : undefined;
  return api({ method, url: path, data }).then(r => r.data);
};

const attendanceService = {
  // ── Records ─────────────────────────────────────────────────────
  // GET /api/attendance?date=&class=
  getAttendance: (params = {}) =>
    request(`/api/attendance${qs(params)}`),

  // POST /api/attendance/mark  { studentId, studentName, class, status, date, method }
  markAttendance: (data) =>
    request("/api/attendance/mark", {
      method: "POST",
      body:   JSON.stringify(data),
    }),

  // PUT /api/attendance/:id/checkout  { checkOut? }
  checkOut: (entryId, checkOut) =>
    request(`/api/attendance/${encodeURIComponent(entryId)}/checkout`, {
      method: "PUT",
      body:   JSON.stringify(checkOut ? { checkOut } : {}),
    }),

  // ── Stats ────────────────────────────────────────────────────────
  // GET /api/attendance/summary?date=&class=
  getSummary: (params = {}) =>
    request(`/api/attendance/summary${qs(params)}`),

  // GET /api/attendance/inside?date=&class=
  getInsideNow: (params = {}) =>
    request(`/api/attendance/inside${qs(params)}`),

  // GET /api/attendance/history?from=&to=&class=&studentId=
  getHistory: (params = {}) =>
    request(`/api/attendance/history${qs(params)}`),

  // ── QR ───────────────────────────────────────────────────────────
  // POST /api/attendance/qr-scan  { qrData }
  processQRScan: (qrData) =>
    request("/api/attendance/qr-scan", {
      method: "POST",
      body:   JSON.stringify({ qrData }),
    }),

  // GET /api/qr/:studentId
  getStudentQR: (studentId) =>
    request(`/api/qr/${encodeURIComponent(studentId)}`),

  // GET /api/qr/batch?class=
  getBatchQR: (params = {}) =>
    request(`/api/qr/batch${qs(params)}`),
};

export default attendanceService;
