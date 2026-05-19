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

const foodConsumptionService = {
  // GET /api/food-consumption?date=&class=
  getConsumption: (params = {}) =>
    request(`/api/food-consumption${qs(params)}`),

  // POST /api/food-consumption
  saveConsumption: (data) =>
    request("/api/food-consumption", {
      method: "POST",
      body:   JSON.stringify(data),
    }),

  // PUT /api/food-consumption  (same append-only upsert)
  updateConsumption: (data) =>
    request("/api/food-consumption", {
      method: "PUT",
      body:   JSON.stringify(data),
    }),
};

export default foodConsumptionService;
