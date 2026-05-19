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

const foodMenuService = {
  // POST /api/food-menu  { date, branch, meals[] }
  saveMenu: (data) =>
    request("/api/food-menu", {
      method: "POST",
      body:   JSON.stringify(data),
    }),

  // GET /api/food-menu?date=&branch=
  getMenus: (params = {}) =>
    request(`/api/food-menu${qs(params)}`),

  // PUT /api/food-menu/:date  { branch, meals[] }
  updateMenu: (date, data) =>
    request(`/api/food-menu/${encodeURIComponent(date)}`, {
      method: "PUT",
      body:   JSON.stringify(data),
    }),

  // DELETE /api/food-menu/:date
  deleteMenu: (date) =>
    request(`/api/food-menu/${encodeURIComponent(date)}`, {
      method: "DELETE",
    }),
};

export default foodMenuService;
