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
    "nap-tracker", "food-menu", "food-consumption", "cctv-settings", "live-cctv",
    "parent-checkin", "pickup-authorization", "pickup-history",
    "profile", "settings", "user-management", "roles-permissions",
    "holidays", "notices", "announcements", "qr-management",
  ],

  center_owner: [
    "dashboard", "students", "attendance", "fees", "invoice", "analytics",
    "nap-tracker", "food-menu", "food-consumption", "cctv-settings", "live-cctv",
    "parent-checkin", "pickup-authorization", "pickup-history",
    "profile", "settings", "user-management", "roles-permissions",
    "holidays", "notices", "announcements", "qr-management",
  ],

  center_admin: [
    "dashboard", "students", "attendance", "fees", "invoice", "analytics",
    "nap-tracker", "food-menu", "food-consumption", "cctv-settings", "live-cctv",
    "parent-checkin", "pickup-authorization", "pickup-history",
    "profile", "settings", "user-management", "roles-permissions",
    "holidays", "notices", "announcements", "qr-management",
  ],

  teacher: [
    "dashboard", "attendance", "nap-tracker", "food-menu", "food-consumption",
    "students", "parent-checkin", "profile",
    "holidays", "notices", "announcements",
  ],

  accountant: [
    "dashboard", "fees", "invoice", "analytics", "students", "profile",
  ],

  reception: [
    "dashboard", "students", "attendance", "parent-checkin",
    "pickup-authorization", "pickup-history", "profile",
  ],

  cctv_viewer: ["live-cctv", "cctv-settings", "profile"],

  parent: [
    "dashboard", "live-cctv", "parent-checkin", "pickup-history", "fees", "profile",
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
  cctv_viewer:  "/live-cctv",
  parent:       "/parent-home",
};

module.exports = { BYPASS_ROLES, ROLE_PERMISSIONS, ROLE_HOME, isBypassRole };
