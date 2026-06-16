/**
 * academicsService.js (frontend)
 * API client for the Academics module — Class Management.
 */

import { api } from "./authService";

const getClasses = () =>
  api.get("/api/academics/classes").then(r => r.data.classes || []);

export default { getClasses };
