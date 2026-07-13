/**
 * studentAccess.js — centralized ownership/tenant verification for student
 * CRUD (GET /students/:id, PUT /update-student/:id, DELETE /delete-student/:id).
 *
 * Pure, dependency-free: takes the already-fetched student record
 * ({ studentId, schoolId } or null) and the authenticated req.user --
 * never touches Firestore itself, so it's directly unit-testable, and
 * never relies on the studentId string itself being unguessable -- the
 * schoolId/ownership check is what makes ID-guessing harmless, not
 * secrecy of the ID format.
 *
 * Returns a verdict, not an HTTP response, so each call site can keep its
 * own existing response shape/wording:
 *   { allowed: true }
 *   { allowed: false, reason: "not_found" | "wrong_child" | "forbidden" }
 */

const STAFF_ROLES = [
  "developer", "super_admin", "admin", "center_admin",
  "teacher", "accountant", "reception",
];

function isStaffRole(role) {
  return STAFF_ROLES.includes(role);
}

function checkStudentAccess(req, student) {
  if (!student) return { allowed: false, reason: "not_found" };

  const role = req.user?.role;
  const callerSchoolId = req.user?.schoolId;

  if (role === "parent") {
    // Tenant mismatch first -- hides cross-tenant existence behind
    // "not_found" rather than confirming it via a 403.
    if (callerSchoolId !== student.schoolId) return { allowed: false, reason: "not_found" };
    const linkedId = req.user.student?.studentId;
    if (linkedId !== student.studentId) return { allowed: false, reason: "wrong_child" };
    return { allowed: true };
  }

  if (!isStaffRole(role)) return { allowed: false, reason: "forbidden" };
  if (callerSchoolId !== student.schoolId) return { allowed: false, reason: "not_found" };
  return { allowed: true };
}

module.exports = { isStaffRole, checkStudentAccess };
