// Re-exports the same base URL used by the shared axios instance in authService.js.
// Kept for any component that needs the raw backend URL string.
const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

export default API_BASE_URL;