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

const pickupAuthorizationService = {
  // GET /api/pickup-authorization?studentId=&status=
  getPersons: (params = {}) =>
    request(`/api/pickup-authorization${qs(params)}`),

  // POST /api/pickup-authorization
  addPerson: (data) =>
    request("/api/pickup-authorization", {
      method: "POST",
      body:   JSON.stringify(data),
    }),

  // PUT /api/pickup-authorization/:id
  updatePerson: (id, data) =>
    request(`/api/pickup-authorization/${encodeURIComponent(id)}`, {
      method: "PUT",
      body:   JSON.stringify(data),
    }),

  // DELETE /api/pickup-authorization/:id
  deletePerson: (id) =>
    request(`/api/pickup-authorization/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
};

export default pickupAuthorizationService;
