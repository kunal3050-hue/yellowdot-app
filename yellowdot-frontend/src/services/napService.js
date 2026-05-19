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

const napService = {
  // ── Students ─────────────────────────────────────────────────
  getStudents: () => request("/students"),

  // ── Active naps ──────────────────────────────────────────────
  getActiveNaps: () => request("/naps/active"),

  // ── Stats — accepts optional { date } ────────────────────────
  getStats: (params = {}) => request(`/naps/stats/today${qs(params)}`),

  // ── History — accepts { date?, class?, student? } ────────────
  getNapHistory: (params = {}) => request(`/naps/history${qs(params)}`),

  // ── Start nap ────────────────────────────────────────────────
  startNap: (data) =>
    request("/naps/start", { method: "POST", body: JSON.stringify(data) }),

  // ── Wake up ──────────────────────────────────────────────────
  wakeUp: (data) =>
    request("/naps/wakeup", { method: "POST", body: JSON.stringify(data) }),
};

export default napService;
