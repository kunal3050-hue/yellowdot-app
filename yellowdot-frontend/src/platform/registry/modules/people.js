/**
 * people.js — Module Registry: students, families and access administration
 * PLATFORM ARCHITECTURE §5
 */
import { defineModule } from "../defineModule.js";

export const studentsModule = defineModule({
  id: "students",
  label: "Students",
  icon: "Users",
  category: "people",
  capability: "students.view",
  featureFlag: "STUDENTS",
  actions: ["view", "create", "edit", "delete", "export"],
  keywords: ["students", "children", "admission", "enrol", "enroll", "profile", "roster"],
  // C4, Care experience review (2026-07-31): removed by explicit decision.
  // Students is a browse/reference screen, not a work-queue destination —
  // it was cluttering Care's "do the work" grid for every role that could
  // view it (Teacher, Reception, ...), not just the ones surfaces.care had
  // an order for. Stays reachable via the sidebar as normal.
  routes: [
    {
      path: "/students", routeKey: "students", label: "Students", icon: "Users",
      nav: [{ category: "people", order: 10,
              matchPaths: ["/add-student", "/edit-student", "/student-profile"] }],
      grid: { section: "students", label: "Students", icon: "Users",
              description: "Manage admissions, profiles and student records." },
    },
    {
      path: "/students/new", routeKey: "students", capability: "students.create",
      grid: { section: "admissions", label: "Add Student", icon: "UserPlus",
              description: "Start a new admission and build the student's profile." },
    },
    { path: "/add-student",          routeKey: "students", capability: "students.create" },
    { path: "/edit-student/:id",     routeKey: "students", capability: "students.edit" },
    { path: "/student-profile/:id",  routeKey: "students" },
  ],
});

/*
 * The "Login Users" module (/user-management) was removed here.
 *
 * It and Employees (staffHr.js, /staff/employees) were two people-shaped
 * screens: `users` was the login and RBAC record, `staff` the HR record that
 * Departments, Designations, Attendance, Shifts, Leave, Payroll and
 * Performance hang off. Employees is now the single list, with login as an
 * attribute of an employee — staff carries linkedUserId / loginStatus, and
 * POST /api/staff/:id/invite creates the Firebase user from an employee
 * record.
 *
 * This route could only go once every login actually had an employee record;
 * removing it earlier would have left accounts with no screen that could
 * administer them, including the duplicate that had to be cleaned up through
 * this very page. scripts/backfillStaffFromUsers.js did that migration.
 *
 * The `staff` PERMISSION still exists (rbacConfig → administration → staff)
 * and still grants staff.view/create/edit/delete — it just no longer claims a
 * route, the same shape `analytics` and `medical` already use there.
 *
 * The /api/users routes are deliberately still served. Nothing in the UI calls
 * them now, but they keep the login records reachable if something has to be
 * inspected or repaired without a screen.
 */

export const rolesPermissionsModule = defineModule({
  id: "roles_permissions",
  label: "Roles & Permissions",
  icon: "Shield",
  category: "people",
  capability: "roles_permissions.view",
  actions: ["view", "manage"],
  keywords: ["roles", "permissions", "rbac", "access control", "capability"],
  routes: [
    {
      path: "/roles-permissions", routeKey: "roles-permissions", label: "Roles & Permissions", icon: "Shield",
      nav: [{ category: "people", order: 30 }],
      grid: { section: "staff", label: "Roles & Permissions", icon: "Shield",
              description: "Control what each role can see and do." },
    },
  ],
});

export default [studentsModule, rolesPermissionsModule];
