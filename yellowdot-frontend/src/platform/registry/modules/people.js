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

/**
 * Login accounts. NOTE the naming trap: the permission module is "staff"
 * (rbacConfig PERMISSION_CATEGORIES → administration → staff, "Staff (Login
 * Users)"), which is a DIFFERENT thing from the HR "staff_management" module
 * in staffHr.js. Capability is pinned explicitly so the two never merge.
 */
export const userManagementModule = defineModule({
  id: "user_management",
  label: "Login Users",
  icon: "Briefcase",
  category: "people",
  capability: "staff.view",
  actions: ["view", "create", "edit", "delete"],
  keywords: ["users", "login", "accounts", "access", "credentials"],
  routes: [
    {
      path: "/user-management", routeKey: "user-management", label: "Login Users", icon: "Briefcase",
      capability: "staff.view",
      nav: [{ category: "people", order: 20, matchPaths: ["/user-management/"] }],
      grid: { section: "staff", label: "User Management", icon: "UserCog",
              description: "Manage staff login accounts and access." },
    },
  ],
});

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

export default [studentsModule, userManagementModule, rolesPermissionsModule];
