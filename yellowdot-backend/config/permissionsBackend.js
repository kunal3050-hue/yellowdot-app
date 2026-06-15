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
    "nap-tracker", "food-menu", "food-consumption", "care-hygiene",
    "parent-checkin", "pickup-authorization", "pickup-history", "staff-checkout",
    "profile", "settings", "user-management", "roles-permissions",
    "holidays", "notices", "announcements", "qr-management", "cctv",
    "academics-classes", "academics-batches",
    "academics-teacher-allocation", "academics-classroom-allocation",
    "academics-student-allocation",
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
  ],

  teacher: [
    "dashboard", "attendance", "nap-tracker", "food-menu", "food-consumption",
    "care-hygiene",
    "students", "parent-checkin", "staff-checkout", "cctv",
    "profile", "holidays", "notices", "announcements",
    "academics-classes", "academics-batches",
    "academics-student-allocation",
  ],

  accountant: [
    "dashboard", "fees", "invoice", "analytics", "students", "profile",
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
