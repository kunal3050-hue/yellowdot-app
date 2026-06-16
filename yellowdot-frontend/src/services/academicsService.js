/**
 * academicsService.js (frontend)
 * API client for the Academics module — Class Management.
 *
 * Tries GET /api/academics/classes first. Falls back to the same seed data
 * that AcademicsClasses.jsx uses locally, so the Holidays dropdown always
 * shows the correct classes even when the backend route is not yet deployed.
 */

import { api } from "./authService";

// Mirrors AcademicsClasses.jsx SEED_CLASSES (active only, id + name + ageGroup).
// Keep in sync when Class Management adds real Firestore persistence.
const SEED_CLASSES = [
  { id: "1", name: "Playgroup",  ageGroup: "2–3 years"  },
  { id: "2", name: "Nursery",    ageGroup: "3–4 years"  },
  { id: "3", name: "Junior KG",  ageGroup: "4–5 years"  },
  { id: "4", name: "Senior KG",  ageGroup: "5–6 years"  },
  { id: "5", name: "Daycare",    ageGroup: "1–5 years"  },
  { id: "6", name: "Abacus",     ageGroup: "5–10 years" },
];

const getClasses = () =>
  api.get("/api/academics/classes")
    .then(r => r.data.classes || [])
    .catch(() => SEED_CLASSES);   // backend route not deployed yet → use seed

export default { getClasses };
