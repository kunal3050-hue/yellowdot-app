/**
 * permissionsBackend.js — Backend RBAC config (mirrors frontend permissions.js)
 * Keep in sync with src/config/permissions.js on the frontend.
 */

const BYPASS_ROLES = new Set(["developer", "super_admin"]);

function isBypassRole(role) {
  return BYPASS_ROLES.has(role);
}

// Finance Platform UI routeKeys — frontend-only page-gating keys (see the
// matching comment in services/roleService.js's STATIC_ROLE_PERMS).
const FINANCE_UI_ROUTE_KEYS = [
  "finance-dashboard", "finance-ledger", "finance-billing-plans",
  "finance-invoices", "finance-payments", "finance-family-account",
  "finance-refunds", "finance-settings", "finance-audit",
];

const ROLE_PERMISSIONS = {
  developer:    ["*"],
  super_admin:  ["*"],

  admin: [
    "dashboard", "students", "attendance", "fees", "invoice", "analytics",
    "nap-tracker", "food-menu", "food-consumption", "care-hygiene",
    "parent-checkin", "pickup-authorization", "pickup-history", "staff-checkout",
    "profile", "settings", "user-management", "roles-permissions",
    "holidays", "notices", "announcements", "qr-management", "cctv",
    "academics-classes", "academics-batches",
    "academics-teacher-allocation", "academics-classroom-allocation",
    "academics-student-allocation",
    "families",
    "child-journey",
    "staff-dashboard", "staff-management", "departments", "designations",
    "staff-attendance", "staff-attendance-manage", "staff-shifts",
    "staff-leave", "staff-leave-approve", "staff-leave-types",
    "staff-payroll", "staff-payroll-process",
    "staff-performance", "staff-performance-manage",
    "finance-foundation", "finance-refund-approval", ...FINANCE_UI_ROUTE_KEYS,
  ],

  center_owner: [
    "dashboard", "students", "attendance", "fees", "invoice", "analytics",
    "nap-tracker", "food-menu", "food-consumption", "care-hygiene",
    "parent-checkin", "pickup-authorization", "pickup-history", "staff-checkout",
    "profile", "settings", "user-management", "roles-permissions",
    "holidays", "notices", "announcements", "qr-management", "cctv",
    "academics-classes", "academics-batches",
    "academics-teacher-allocation", "academics-classroom-allocation",
    "academics-student-allocation",
    "families",
    "child-journey",
    "staff-dashboard", "staff-management", "departments", "designations",
    "staff-attendance", "staff-attendance-manage", "staff-shifts",
    "staff-leave", "staff-leave-approve", "staff-leave-types",
    "staff-payroll", "staff-payroll-process",
    "staff-performance", "staff-performance-manage",
    "finance-foundation", "finance-refund-approval", ...FINANCE_UI_ROUTE_KEYS,
  ],

  center_admin: [
    "dashboard", "students", "attendance", "fees", "invoice", "analytics",
    "nap-tracker", "food-menu", "food-consumption", "care-hygiene",
    "parent-checkin", "pickup-authorization", "pickup-history", "staff-checkout",
    "profile", "settings", "user-management", "roles-permissions",
    "holidays", "notices", "announcements", "qr-management", "cctv",
    "academics-classes", "academics-batches",
    "academics-teacher-allocation", "academics-classroom-allocation",
    "academics-student-allocation",
    "families",
    "child-journey",
    "staff-dashboard", "staff-management", "departments", "designations",
    "staff-attendance", "staff-attendance-manage", "staff-shifts",
    "staff-leave", "staff-leave-approve", "staff-leave-types",
    "staff-payroll", "staff-payroll-process",
    "staff-performance", "staff-performance-manage",
    "finance-foundation", ...FINANCE_UI_ROUTE_KEYS,
  ],

  teacher: [
    "dashboard", "attendance", "nap-tracker", "food-menu", "food-consumption",
    "care-hygiene",
    "students", "parent-checkin", "staff-checkout", "cctv",
    "profile", "holidays", "notices", "announcements",
    "academics-classes", "academics-batches",
    "academics-student-allocation",
    "child-journey",
    "staff-attendance", "staff-leave", "staff-payroll", "staff-performance",
  ],

  accountant: [
    "dashboard", "fees", "invoice", "analytics", "students", "profile",
    "finance-foundation", "finance-refund-approval", ...FINANCE_UI_ROUTE_KEYS,
  ],

  reception: [
    "dashboard", "students", "attendance", "parent-checkin",
    "pickup-authorization", "pickup-history", "staff-checkout", "profile",
  ],

  // Parent Module V1 — CCTV & self check-in intentionally excluded.
  parent: [
    "dashboard", "profile", "fees",
  ],
};

// Platform Architecture Freeze, Task 1 follow-up (2026-08-12): teacher and
// accountant no longer get a special-cased destination here. Every staff
// role now falls through to the same "/" default (ROLE_HOME[role] || "/"
// in authRoutes.js), which RootRedirect (App.jsx) resolves to /staff-mobile
// for every non-parent, non-super_admin role — the same path every other
// staff role already took. This does not touch any capability, permission,
// or role definition; it only removes two hard-coded login destinations.
const ROLE_HOME = {
  developer:    "/",
  super_admin:  "/",
  admin:        "/",
  center_admin: "/",
  reception:    "/",
  parent:       "/parent-home",
};

module.exports = { BYPASS_ROLES, ROLE_PERMISSIONS, ROLE_HOME, isBypassRole };
