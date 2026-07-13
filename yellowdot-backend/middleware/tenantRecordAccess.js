/**
 * tenantRecordAccess.js — generic staff-side tenant check, reusable for any
 * record with a schoolId field (events, PTMs, and their sub-resources once
 * resolved back to a parent record with schoolId).
 *
 * Pure, dependency-free: takes the already-fetched record ({schoolId, ...}
 * or null) and the authenticated req.user. Role is assumed already enforced
 * by router-level middleware (staffOnly/blockUnknown) before this runs --
 * this only decides tenant membership, so a staff member at one school
 * can't reach another school's record by ID, guessable or not.
 */
function checkTenantAccess(req, record) {
  if (!record) return { allowed: false, reason: "not_found" };
  if (req.user?.schoolId !== record.schoolId) return { allowed: false, reason: "not_found" };
  return { allowed: true };
}

module.exports = { checkTenantAccess };
