/**
 * permissionsBackend.js — Backend RBAC config (mirrors frontend permissions.js)
 * Keep in sync with src/config/permissions.js on the frontend.
 */

const BYPASS_ROLES = new Set(["developer", "super_admin"]);

function isBypassRole(role) {
  return BYPASS_ROLES.has(role);
}

const ROLE_PERMISSIONS = {
  developer:    ["*"],
  super_admin:  ["*"],

  admin: [
    "dashboard", "students", "attendance", "fees", "invoice", "analytics",
    "nap-tracker", "food-menu", "food-consumption",
    "parent-checkin", "pickup-authorization", "pickup-history", "staff-checkout",
    "profile", "settings", "user-management", "roles-permissions",
    "holidays", "notices", "announcements", "qr-management", "cctv",
  ],

  center_owner: [
    "dashboard", "students", "attendance", "fees", "invoice", "analytics",
    "nap-tracker", "food-menu", "food-consumption",
    "parent-checkin", "pickup-authorization", "pickup-history", "staff-checkout",
    "profile", "settings", "user-management", "roles-permissions",
    "holidays", "notices", "announcements", "qr-management", "cctv",
  ],

  center_admin: [
    "dashboard", "students", "attendance", "fees", "invoice", "analytics",
    "nap-tracker", "food-menu", "food-consumption",
    "parent-checkin", "pickup-authorization", "pickup-history", "staff-checkout",
    "profile", "settings", "user-management", "roles-permissions",
    "holidays", "notices", "announcements", "qr-management", "cctv",
  ],

  teacher: [
    "dashboard", "attendance", "nap-tracker", "food-menu", "food-consumption",
    "students", "parent-checkin", "staff-checkout", "cctv",
    "profile", "holidays", "notices", "announcements",
  ],

  accountant: [
    "dashboard", "fees", "invoice", "analytics", "students", "profile",
  ],

  reception: [
    "dashboard", "students", "attendance", "parent-checkin",
    "pickup-authorization", "pickup-history", "staff-checkout", "profile",
  ],

  parent: [
    "dashboard", "parent-checkin", "pickup-history", "fees", "profile",
  ],
};

const ROLE_HOME = {
  developer:    "/",
  super_admin:  "/",
  admin:        "/",
  center_admin: "/",
  teacher:      "/attendance",
  accountant:   "/invoice",
  reception:    "/",
  parent:       "/parent-home",
};

module.exports = { BYPASS_ROLES, ROLE_PERMISSIONS, ROLE_HOME, isBypassRole };
