/**
 * permissions.js — Yellow Dot centralized RBAC configuration
 * ────────────────────────────────────────────────────────────
 * Single source of truth for:
 *   - Which roles exist
 *   - Which routes each role can access
 *   - Which roles bypass ALL permission checks
 *   - Role display labels
 *   - Role home routes
 *   - Role hierarchy order
 *
 * Import this anywhere you need role/permission logic.
 * The backend (authService.js) mirrors these values — keep them in sync.
 */

// ── Roles that bypass every permission check ──────────────────────────────────
// If a user's role is in this set, can() returns true immediately.
// They will NEVER hit /unauthorized regardless of routeKey.
export const BYPASS_ROLES = new Set(["developer", "super_admin"]);

/**
 * Check if a role bypasses all permission checks.
 * This is the FIRST check that must run in any permission validation.
 * @param {string} role
 * @returns {boolean}
 */
export function isBypassRole(role) {
  return BYPASS_ROLES.has(role);
}

// ── Route keys (must match backend ROLE_PERMISSIONS keys exactly) ─────────────
export const ROUTES = {
  DASHBOARD:             "dashboard",
  STUDENTS:              "students",
  ATTENDANCE:            "attendance",
  FEES:                  "fees",
  INVOICE:               "invoice",
  ANALYTICS:             "analytics",
  NAP_TRACKER:           "nap-tracker",
  FOOD_MENU:             "food-menu",
  FOOD_CONSUMPTION:      "food-consumption",
  CARE_HYGIENE:          "care-hygiene",
  PARENT_CHECKIN:        "parent-checkin",
  PICKUP_AUTHORIZATION:  "pickup-authorization",
  PICKUP_HISTORY:        "pickup-history",
  PROFILE:               "profile",
  SETTINGS:              "settings",
  USER_MANAGEMENT:       "user-management",
  ROLES_PERMISSIONS:     "roles-permissions",
  DEV_TOOLS:             "dev-tools",
  HOLIDAYS:              "holidays",
  NOTICES:               "notices",
  ANNOUNCEMENTS:         "announcements",
  EVENTS:                "events",
  PTM:                   "ptm",
  INCIDENTS:             "incidents",
  QR_MANAGEMENT:                 "qr-management",
  STAFF_CHECKOUT:                "staff-checkout",
  CCTV:                          "cctv",
  ACADEMICS_CLASSES:             "academics-classes",
  ACADEMICS_BATCHES:             "academics-batches",
  ACADEMICS_TEACHER_ALLOCATION:  "academics-teacher-allocation",
  ACADEMICS_CLASSROOM_ALLOCATION:"academics-classroom-allocation",
  ACADEMICS_STUDENT_ALLOCATION:  "academics-student-allocation",
  FAMILIES:                      "families",
  CHILD_JOURNEY:                 "child-journey",
  TENANT_MANAGEMENT:             "tenant-management",
};

// ── Permission map: role → array of allowed routeKeys ─────────────────────────
// Bypass roles (developer, super_admin) don't need entries here but are
// included with ["*"] so the backend token carries the correct value.
export const ROLE_PERMISSIONS = {
  developer: ["*"],     // bypass — entry exists for JWT payload only

  super_admin: ["*"],   // bypass — same

  admin: [              // alias for center_admin
    ROUTES.DASHBOARD, ROUTES.STUDENTS, ROUTES.ATTENDANCE, ROUTES.FEES,
    ROUTES.INVOICE, ROUTES.ANALYTICS, ROUTES.NAP_TRACKER, ROUTES.FOOD_MENU,
    ROUTES.FOOD_CONSUMPTION, ROUTES.CARE_HYGIENE,
    ROUTES.PARENT_CHECKIN, ROUTES.PICKUP_AUTHORIZATION, ROUTES.PICKUP_HISTORY,
    ROUTES.STAFF_CHECKOUT,
    ROUTES.PROFILE, ROUTES.SETTINGS, ROUTES.USER_MANAGEMENT, ROUTES.ROLES_PERMISSIONS,
    ROUTES.HOLIDAYS, ROUTES.NOTICES, ROUTES.ANNOUNCEMENTS, ROUTES.EVENTS, ROUTES.PTM, ROUTES.INCIDENTS, ROUTES.QR_MANAGEMENT, ROUTES.CCTV,
    ROUTES.ACADEMICS_CLASSES, ROUTES.ACADEMICS_BATCHES,
    ROUTES.ACADEMICS_TEACHER_ALLOCATION, ROUTES.ACADEMICS_CLASSROOM_ALLOCATION,
    ROUTES.ACADEMICS_STUDENT_ALLOCATION,
    ROUTES.FAMILIES,
    ROUTES.CHILD_JOURNEY,
  ],

  center_admin: [
    ROUTES.DASHBOARD, ROUTES.STUDENTS, ROUTES.ATTENDANCE, ROUTES.FEES,
    ROUTES.INVOICE, ROUTES.ANALYTICS, ROUTES.NAP_TRACKER, ROUTES.FOOD_MENU,
    ROUTES.FOOD_CONSUMPTION, ROUTES.CARE_HYGIENE,
    ROUTES.PARENT_CHECKIN, ROUTES.PICKUP_AUTHORIZATION, ROUTES.PICKUP_HISTORY,
    ROUTES.STAFF_CHECKOUT,
    ROUTES.PROFILE, ROUTES.SETTINGS, ROUTES.USER_MANAGEMENT, ROUTES.ROLES_PERMISSIONS,
    ROUTES.HOLIDAYS, ROUTES.NOTICES, ROUTES.ANNOUNCEMENTS, ROUTES.EVENTS, ROUTES.PTM, ROUTES.INCIDENTS, ROUTES.QR_MANAGEMENT, ROUTES.CCTV,
    ROUTES.ACADEMICS_CLASSES, ROUTES.ACADEMICS_BATCHES,
    ROUTES.ACADEMICS_TEACHER_ALLOCATION, ROUTES.ACADEMICS_CLASSROOM_ALLOCATION,
    ROUTES.ACADEMICS_STUDENT_ALLOCATION,
    ROUTES.FAMILIES,
    ROUTES.CHILD_JOURNEY,
  ],

  // center_owner — same privilege as center_admin; separate role for clarity
  center_owner: [
    ROUTES.DASHBOARD, ROUTES.STUDENTS, ROUTES.ATTENDANCE, ROUTES.FEES,
    ROUTES.INVOICE, ROUTES.ANALYTICS, ROUTES.NAP_TRACKER, ROUTES.FOOD_MENU,
    ROUTES.FOOD_CONSUMPTION, ROUTES.CARE_HYGIENE,
    ROUTES.PARENT_CHECKIN, ROUTES.PICKUP_AUTHORIZATION, ROUTES.PICKUP_HISTORY,
    ROUTES.STAFF_CHECKOUT,
    ROUTES.PROFILE, ROUTES.SETTINGS, ROUTES.USER_MANAGEMENT, ROUTES.ROLES_PERMISSIONS,
    ROUTES.HOLIDAYS, ROUTES.NOTICES, ROUTES.ANNOUNCEMENTS, ROUTES.EVENTS, ROUTES.PTM, ROUTES.INCIDENTS, ROUTES.QR_MANAGEMENT, ROUTES.CCTV,
    ROUTES.ACADEMICS_CLASSES, ROUTES.ACADEMICS_BATCHES,
    ROUTES.ACADEMICS_TEACHER_ALLOCATION, ROUTES.ACADEMICS_CLASSROOM_ALLOCATION,
    ROUTES.ACADEMICS_STUDENT_ALLOCATION,
    ROUTES.FAMILIES,
    ROUTES.CHILD_JOURNEY,
  ],

  teacher: [
    ROUTES.DASHBOARD, ROUTES.ATTENDANCE, ROUTES.NAP_TRACKER, ROUTES.FOOD_MENU,
    ROUTES.FOOD_CONSUMPTION, ROUTES.CARE_HYGIENE, ROUTES.STUDENTS, ROUTES.PARENT_CHECKIN,
    ROUTES.STAFF_CHECKOUT, ROUTES.CCTV,    // Live View — classroom-scoped in resolver
    ROUTES.PROFILE, ROUTES.HOLIDAYS, ROUTES.NOTICES, ROUTES.ANNOUNCEMENTS, ROUTES.EVENTS, ROUTES.PTM, ROUTES.INCIDENTS,
    ROUTES.ACADEMICS_CLASSES, ROUTES.ACADEMICS_BATCHES,
    ROUTES.ACADEMICS_STUDENT_ALLOCATION,
    ROUTES.CHILD_JOURNEY,
  ],

  accountant: [
    ROUTES.DASHBOARD, ROUTES.FEES, ROUTES.INVOICE, ROUTES.ANALYTICS,
    ROUTES.STUDENTS, ROUTES.PROFILE,
  ],

  reception: [
    ROUTES.DASHBOARD, ROUTES.STUDENTS, ROUTES.ATTENDANCE, ROUTES.PARENT_CHECKIN,
    ROUTES.PICKUP_AUTHORIZATION, ROUTES.PICKUP_HISTORY,
    ROUTES.STAFF_CHECKOUT,
    ROUTES.PROFILE,
  ],

  // Parent Module V1 — CCTV & self check-in intentionally excluded.
  parent: [
    ROUTES.DASHBOARD, ROUTES.PROFILE, ROUTES.FEES,
  ],
};

// ── Home route after login ─────────────────────────────────────────────────────
export const ROLE_HOME = {
  developer:    "/super-admin/tenants",
  super_admin:  "/super-admin/tenants",
  admin:        "/",
  center_admin: "/",
  center_owner: "/",
  teacher:      "/child-presence",
  accountant:   "/invoice",
  reception:    "/",
  parent:       "/parent-home",
};

// ── Display labels ─────────────────────────────────────────────────────────────
export const ROLE_LABELS = {
  developer:    "Developer",
  super_admin:  "Super Admin",
  admin:        "Admin",
  center_admin: "Center Admin",
  center_owner: "Center Owner",
  teacher:      "Teacher",
  accountant:   "Accountant",
  reception:    "Reception",
  parent:       "Parent",
};

// ── Role hierarchy (highest privilege first) ──────────────────────────────────
// Used by the developer debug panel role switcher.
export const ROLE_HIERARCHY = [
  "developer",
  "super_admin",
  "admin",
  "center_admin",
  "center_owner",
  "teacher",
  "accountant",
  "reception",
  "parent",
];

// ── Core permission check ─────────────────────────────────────────────────────

/**
 * The canonical permission check used everywhere in the frontend.
 *
 * Rules (evaluated in order):
 *   1. developer / super_admin → ALWAYS true  (no further checks)
 *   2. permissions includes "*" → true
 *   3. permissions includes routeKey → true
 *   4. otherwise → false
 *
 * @param {string}   role        — current effective role
 * @param {string[]} permissions — array from JWT / AuthContext
 * @param {string}   routeKey    — the key to check
 * @returns {boolean}
 */
export function checkPermission(role, permissions, routeKey) {
  // Rule 1 — bypass roles never get blocked
  if (isBypassRole(role)) return true;

  // Rule 2 — wildcard grant
  if (permissions?.includes("*")) return true;

  // Rule 3 — explicit route grant
  if (routeKey && permissions?.includes(routeKey)) return true;

  return false;
}

/**
 * Get permissions for a given role (for dev panel simulation).
 * @param {string} role
 * @returns {string[]}
 */
export function getPermissionsForRole(role) {
  return ROLE_PERMISSIONS[role] || [];
}
