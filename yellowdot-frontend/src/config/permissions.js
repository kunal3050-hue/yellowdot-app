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
  LIVE_CCTV:             "live-cctv",
  CCTV_SETTINGS:         "cctv-settings",
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
  QR_MANAGEMENT:         "qr-management",
  STAFF_CHECKOUT:        "staff-checkout",
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
    ROUTES.FOOD_CONSUMPTION, ROUTES.CCTV_SETTINGS, ROUTES.LIVE_CCTV,
    ROUTES.PARENT_CHECKIN, ROUTES.PICKUP_AUTHORIZATION, ROUTES.PICKUP_HISTORY,
    ROUTES.STAFF_CHECKOUT,
    ROUTES.PROFILE, ROUTES.SETTINGS, ROUTES.USER_MANAGEMENT, ROUTES.ROLES_PERMISSIONS,
    ROUTES.HOLIDAYS, ROUTES.NOTICES, ROUTES.ANNOUNCEMENTS, ROUTES.QR_MANAGEMENT,
  ],

  center_admin: [
    ROUTES.DASHBOARD, ROUTES.STUDENTS, ROUTES.ATTENDANCE, ROUTES.FEES,
    ROUTES.INVOICE, ROUTES.ANALYTICS, ROUTES.NAP_TRACKER, ROUTES.FOOD_MENU,
    ROUTES.FOOD_CONSUMPTION, ROUTES.CCTV_SETTINGS, ROUTES.LIVE_CCTV,
    ROUTES.PARENT_CHECKIN, ROUTES.PICKUP_AUTHORIZATION, ROUTES.PICKUP_HISTORY,
    ROUTES.STAFF_CHECKOUT,
    ROUTES.PROFILE, ROUTES.SETTINGS, ROUTES.USER_MANAGEMENT, ROUTES.ROLES_PERMISSIONS,
    ROUTES.HOLIDAYS, ROUTES.NOTICES, ROUTES.ANNOUNCEMENTS, ROUTES.QR_MANAGEMENT,
  ],

  // center_owner — same privilege as center_admin; separate role for clarity
  center_owner: [
    ROUTES.DASHBOARD, ROUTES.STUDENTS, ROUTES.ATTENDANCE, ROUTES.FEES,
    ROUTES.INVOICE, ROUTES.ANALYTICS, ROUTES.NAP_TRACKER, ROUTES.FOOD_MENU,
    ROUTES.FOOD_CONSUMPTION, ROUTES.CCTV_SETTINGS, ROUTES.LIVE_CCTV,
    ROUTES.PARENT_CHECKIN, ROUTES.PICKUP_AUTHORIZATION, ROUTES.PICKUP_HISTORY,
    ROUTES.STAFF_CHECKOUT,
    ROUTES.PROFILE, ROUTES.SETTINGS, ROUTES.USER_MANAGEMENT, ROUTES.ROLES_PERMISSIONS,
    ROUTES.HOLIDAYS, ROUTES.NOTICES, ROUTES.ANNOUNCEMENTS, ROUTES.QR_MANAGEMENT,
  ],

  teacher: [
    ROUTES.DASHBOARD, ROUTES.ATTENDANCE, ROUTES.NAP_TRACKER, ROUTES.FOOD_MENU,
    ROUTES.FOOD_CONSUMPTION, ROUTES.STUDENTS, ROUTES.PARENT_CHECKIN,
    ROUTES.STAFF_CHECKOUT,
    ROUTES.PROFILE, ROUTES.HOLIDAYS, ROUTES.NOTICES, ROUTES.ANNOUNCEMENTS,
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

  cctv_viewer: [
    ROUTES.LIVE_CCTV, ROUTES.CCTV_SETTINGS, ROUTES.PROFILE,
  ],

  parent: [
    ROUTES.DASHBOARD, ROUTES.LIVE_CCTV, ROUTES.PARENT_CHECKIN,
    ROUTES.PICKUP_HISTORY, ROUTES.FEES, ROUTES.PROFILE,
  ],
};

// ── Home route after login ─────────────────────────────────────────────────────
export const ROLE_HOME = {
  developer:    "/",
  super_admin:  "/",
  admin:        "/",
  center_admin: "/",
  center_owner: "/",
  teacher:      "/attendance",
  accountant:   "/invoice",
  reception:    "/",
  cctv_viewer:  "/live-cctv",
  parent:       "/parent-checkin",
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
  cctv_viewer:  "CCTV Viewer",
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
  "cctv_viewer",
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
