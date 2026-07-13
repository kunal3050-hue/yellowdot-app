/**
 * incidentAccess.js — tenant verification for the staff-side incident
 * report routes (GET/PUT/DELETE /api/incidents/:id, PATCH .../status,
 * GET .../audit, GET .../acknowledgement).
 *
 * Pure, dependency-free: takes the already-fetched incident record
 * ({ schoolId, ... } or null) and the authenticated req.user. Role is
 * already enforced at the router level (staffOnly blocks "parent" and
 * "unknown" before any handler here runs) -- this only decides tenant
 * membership, so a staff member at one school can't reach another
 * school's incident by ID, guessable or not.
 */
function checkIncidentAccess(req, incident) {
  if (!incident) return { allowed: false, reason: "not_found" };
  if (req.user?.schoolId !== incident.schoolId) return { allowed: false, reason: "not_found" };
  return { allowed: true };
}

module.exports = { checkIncidentAccess };
