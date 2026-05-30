/**
 * sidebarConfig.js — Yellow Dot centralized sidebar menu configuration
 * ─────────────────────────────────────────────────────────────────────
 * Single source of truth for:
 *   - Menu groups and items (for all staff roles)
 *   - Parent-only simplified menu
 *   - Per-item: path, routeKey, icon name, badge type
 *   - Section collapse defaults
 *   - Developer-only section
 *
 * Icon names map to the ICONS object in Sidebar.jsx.
 * routeKey values must match ROUTES in permissions.js exactly.
 *
 * Adding a new page:
 *   1. Add its routeKey to ROUTES in permissions.js
 *   2. Add its permissions to ROLE_PERMISSIONS in permissions.js
 *   3. Add its route in App.jsx
 *   4. Add its menu item here
 */

import { ROUTES } from "./permissions";

// ── Badge types ───────────────────────────────────────────────────────────────
// Items can carry a static badge or a dynamic badge key resolved at runtime.
export const BADGE_TYPES = {
  LIVE:    "live",    // pulsing red "LIVE" pill
  NEW:     "new",     // blue "NEW" pill
  COUNT:   "count",   // numeric count badge (value from badgeCounts map)
  SOON:    "soon",    // yellow "SOON" pill
};

// ── Staff menu groups ─────────────────────────────────────────────────────────
// Each group is shown as a labeled, optionally-collapsible section.
// Items filtered by can(routeKey) at render time.
//
// Fields:
//   id          — unique group identifier (used for localStorage persistence)
//   label       — displayed section label
//   collapsible — whether the header can be clicked to collapse the section
//   defaultOpen — initial open state (overridden by localStorage)
//   devOnly     — only shown when isBypassRole(effectiveRole) is true
//   items[]
//     id         — unique item identifier
//     label      — nav item label
//     path       — router path to navigate to (null = action-only items)
//     routeKey   — permission key from ROUTES (undefined = always visible)
//     icon       — key into the ICONS map in Sidebar.jsx
//     exact      — if true, active only on exact path match (use for "/")
//     badge      — static badge: one of BADGE_TYPES values
//     badgeKey   — dynamic badge: key into runtime badgeCounts map
//     matchPaths — extra paths that also trigger the active state

export const SIDEBAR_GROUPS = [
  // ── Overview ───────────────────────────────────────────────────────────────
  {
    id:          "overview",
    label:       "Overview",
    collapsible: false,       // always expanded, no toggle
    defaultOpen: true,
    items: [
      {
        id:       "live_dashboard",
        label:    "Live Dashboard",
        path:     "/live-dashboard",
        routeKey: ROUTES.DASHBOARD,
        icon:     "Home",
      },
      {
        id:       "quick_nav",
        label:    "Quick Navigation",
        path:     "/quick-nav",
        routeKey: ROUTES.DASHBOARD,
        icon:     "Grid",
      },
    ],
  },

  // ── People ─────────────────────────────────────────────────────────────────
  {
    id:          "people",
    label:       "People",
    collapsible: true,
    defaultOpen: true,
    items: [
      {
        id:         "students",
        label:      "Students",
        path:       "/students",
        routeKey:   ROUTES.STUDENTS,
        icon:       "Users",
        matchPaths: ["/add-student", "/edit-student", "/student-profile"],
      },
      {
        id:         "staff",
        label:      "Staff",
        path:       "/user-management",
        routeKey:   ROUTES.USER_MANAGEMENT,
        icon:       "Briefcase",
        matchPaths: ["/user-management/"],
      },
      {
        id:       "roles_permissions",
        label:    "Roles & Permissions",
        path:     "/roles-permissions",
        routeKey: ROUTES.ROLES_PERMISSIONS,
        icon:     "Shield",
      },
    ],
  },

  // ── Finance ────────────────────────────────────────────────────────────────
  {
    id:          "finance",
    label:       "Finance",
    collapsible: true,
    defaultOpen: true,
    items: [
      {
        id:       "fees",
        label:    "Fees",
        path:     "/fees",
        routeKey: ROUTES.FEES,
        icon:     "CreditCard",
      },
      {
        id:         "invoices",
        label:      "Invoices",
        path:       "/invoice",
        routeKey:   ROUTES.INVOICE,
        icon:       "FileText",
        matchPaths: ["/invoice/new", "/invoice/templates", "/invoice-view"],
      },
      {
        id:       "analytics",
        label:    "Analytics",
        path:     "/analytics",
        routeKey: ROUTES.ANALYTICS,
        icon:     "BarChart2",
      },
    ],
  },

  // ── Daily Ops ──────────────────────────────────────────────────────────────
  {
    id:          "daily_ops",
    label:       "Daily Ops",
    collapsible: true,
    defaultOpen: true,
    items: [
      {
        id:       "nap_tracker",
        label:    "Nap Tracker",
        path:     "/nap-tracker",
        routeKey: ROUTES.NAP_TRACKER,
        icon:     "Moon",
      },
      {
        id:       "food_menu",
        label:    "Food Menu",
        path:     "/food-menu",
        routeKey: ROUTES.FOOD_MENU,
        icon:     "Utensils",
      },
      {
        id:       "food_log",
        label:    "Consumption Log",
        path:     "/food-consumption",
        routeKey: ROUTES.FOOD_CONSUMPTION,
        icon:     "ClipboardList",
      },
    ],
  },

  // ── Communications ────────────────────────────────────────────────────────
  {
    id:          "communications",
    label:       "Communications",
    collapsible: true,
    defaultOpen: true,
    items: [
      {
        id:       "holidays",
        label:    "Holidays",
        path:     "/holidays",
        routeKey: ROUTES.HOLIDAYS,
        icon:     "CalendarDays",
      },
      {
        id:       "notices",
        label:    "Notices",
        path:     "/notices",
        routeKey: ROUTES.NOTICES,
        icon:     "Bell",
      },
      {
        id:       "announcements",
        label:    "Announcements",
        path:     "/announcements",
        routeKey: ROUTES.ANNOUNCEMENTS,
        icon:     "Megaphone",
      },
    ],
  },

  // ── Presence & Safety ──────────────────────────────────────────────────────
  // Groups all in-person attendance and safety items.
  // Future additions: Staff Attendance QR, Visitor Management.
  {
    id:          "presence_safety",
    label:       "Presence & Safety",
    collapsible: true,
    defaultOpen: true,
    items: [
      {
        id:       "attendance",
        label:    "Attendance",
        path:     "/attendance",
        routeKey: ROUTES.ATTENDANCE,
        icon:     "Calendar",
      },
      {
        id:       "parent_entry",
        label:    "Parent Entry",
        path:     "/parent-checkin",
        routeKey: ROUTES.PARENT_CHECKIN,
        icon:     "CheckSquare",
      },
      {
        id:         "pickup",
        label:      "Pickup",
        path:       "/pickup-authorization",
        routeKey:   ROUTES.PICKUP_AUTHORIZATION,
        icon:       "Car",
        matchPaths: ["/pickup-authorization", "/pickup-history"],
      },
      {
        id:       "staff_checkout",
        label:    "Staff Checkout",
        path:     "/staff-checkout",
        routeKey: ROUTES.STAFF_CHECKOUT,
        icon:     "LogOut",
      },
      {
        id:       "qr_management",
        label:    "QR Management",
        path:     "/qr-management",
        routeKey: ROUTES.QR_MANAGEMENT,
        icon:     "QrCode",
      },
    ],
  },

  // ── Security ───────────────────────────────────────────────────────────────
  {
    id:          "security",
    label:       "Security",
    collapsible: true,
    defaultOpen: false,       // collapsed by default — less frequently used
    items: [
      {
        id:       "live_cctv",
        label:    "Live CCTV",
        path:     "/live-cctv",
        routeKey: ROUTES.LIVE_CCTV,
        icon:     "Video",
        badge:    BADGE_TYPES.LIVE,
      },
      {
        id:       "cctv_settings",
        label:    "CCTV Settings",
        path:     "/cctv-settings",
        routeKey: ROUTES.CCTV_SETTINGS,
        icon:     "Camera",
      },
    ],
  },

  // ── System ─────────────────────────────────────────────────────────────────
  {
    id:          "system",
    label:       "System",
    collapsible: true,
    defaultOpen: true,
    items: [
      {
        id:         "settings",
        label:      "Settings",
        path:       "/settings",
        routeKey:   ROUTES.SETTINGS,
        icon:       "Settings",
        matchPaths: ["/settings/"],
      },
    ],
  },

  // ── Developer ──────────────────────────────────────────────────────────────
  // Only rendered for isBypassRole roles (developer, super_admin).
  {
    id:          "developer",
    label:       "Developer",
    collapsible: true,
    defaultOpen: true,
    devOnly:     true,        // hidden for all non-bypass roles
    items: [
      // Role switcher is handled inline in DevPanel, not as a nav route.
      // Placeholder item to keep the group non-empty for rendering logic.
      {
        id:       "_dev_placeholder",
        label:    "Role Switcher",
        path:     null,       // no navigation — triggers dev panel
        icon:     "Sliders",
        devAction: "toggleDevPanel",
      },
      {
        id:       "module_explorer",
        label:    "Module Explorer",
        path:     "/dev/modules",
        routeKey: ROUTES.DEV_TOOLS,
        icon:     "Grid",
      },
    ],
  },
];

// ── Parent simplified menu ────────────────────────────────────────────────────
// Replaces the full grouped menu when effectiveRole === "parent".
// No sections, no collapsible — just a flat list of relevant links.
export const PARENT_MENU = [
  {
    id:       "checkin",
    label:    "Parent Check-In",
    path:     "/parent-checkin",
    routeKey: ROUTES.PARENT_CHECKIN,
    icon:     "CheckSquare",
  },
  {
    id:       "pickup",
    label:    "Pickup History",
    path:     "/pickup-history",
    routeKey: ROUTES.PICKUP_HISTORY,
    icon:     "Car",
  },
  {
    id:       "fees",
    label:    "My Fees",
    path:     "/fees",
    routeKey: ROUTES.FEES,
    icon:     "CreditCard",
  },
  {
    id:       "cctv",
    label:    "Live Camera",
    path:     "/live-cctv",
    routeKey: ROUTES.LIVE_CCTV,
    icon:     "Video",
    badge:    "live",
  },
];

// ── Section open-state localStorage helpers ───────────────────────────────────
const LS_KEY = "yd_sidebar_open";

export function getStoredSections() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "{}");
  } catch {
    return {};
  }
}

export function storeSectionState(groupId, isOpen) {
  try {
    const current = getStoredSections();
    localStorage.setItem(LS_KEY, JSON.stringify({ ...current, [groupId]: isOpen }));
  } catch { /* non-critical */ }
}

// ── Resolve initial open state for a group ────────────────────────────────────
// Stored user preference takes precedence over defaultOpen.
export function resolveInitialOpen(group) {
  const stored = getStoredSections();
  if (Object.prototype.hasOwnProperty.call(stored, group.id)) {
    return stored[group.id];
  }
  return group.defaultOpen ?? true;
}
