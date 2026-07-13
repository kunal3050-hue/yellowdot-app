/**
 * studentRecordAccess.js — access control for a student's medical record
 * and private staff notes (students/{id}/medical, students/{id}/notes).
 *
 * Pure, dependency-free: takes the already-fetched `student` record
 * ({ studentId, schoolId } or null) and the authenticated req.user --
 * never touches Firestore itself, so it's directly unit-testable.
 *
 * Role model matches firestore.rules' existing (client-SDK-facing) rules
 * for these same subcollections:
 *   medical — isStaff() same-school, OR isParent() own child same-school.
 *   notes   — isStaff() same-school only. No parent access at all --
 *             these are private staff observations, not shared with parents.
 */

const STAFF_ROLES = [
  "developer", "super_admin", "admin", "center_admin",
  "teacher", "accountant", "reception",
];

function isStaffRole(role) {
  return STAFF_ROLES.includes(role);
}

const NOT_FOUND = { status: 404, body: { success: false, error: "Student not found." } };
const FORBIDDEN = { status: 403, body: { success: false, error: "You do not have access to this resource." } };
const OWN_CHILD_ONLY = { status: 403, body: { success: false, error: "You can only access your own child's records." } };

function checkMedicalAccess(req, student) {
  if (!student) return NOT_FOUND;
  const role = req.user?.role;
  const callerSchoolId = req.user?.schoolId;

  if (isStaffRole(role)) {
    // Tenant hide: report "not found" rather than 403, so a foreign-school
    // ID doesn't confirm another tenant's student exists.
    if (callerSchoolId !== student.schoolId) return NOT_FOUND;
    return null;
  }

  if (role === "parent") {
    // Tenant mismatch first, same as the staff branch above -- hide
    // cross-tenant existence with 404 rather than confirming it via 403.
    if (callerSchoolId !== student.schoolId) return NOT_FOUND;
    const linkedId = req.user.student?.studentId;
    if (linkedId !== student.studentId) return OWN_CHILD_ONLY;
    return null;
  }

  return FORBIDDEN;
}

function checkNotesAccess(req, student) {
  if (!student) return NOT_FOUND;
  const role = req.user?.role;
  if (!isStaffRole(role)) return FORBIDDEN;
  if (req.user?.schoolId !== student.schoolId) return NOT_FOUND;
  return null;
}

module.exports = { isStaffRole, checkMedicalAccess, checkNotesAccess };
