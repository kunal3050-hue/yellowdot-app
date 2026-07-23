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
        label:    "Control Center",
        path:     "/quick-navigation",
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
        id:         "login_users",
        label:      "Login Users",
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

  // ── Staff Management (Phase 1) ────────────────────────────────────────────
  {
    id:          "staff_management",
    label:       "Staff Management",
    collapsible: true,
    defaultOpen: true,
    items: [
      {
        id:       "staff_dashboard",
        label:    "Dashboard",
        path:     "/staff/dashboard",
        routeKey: ROUTES.STAFF_DASHBOARD,
        icon:     "Home",
      },
      {
        id:         "staff_employees",
        label:      "Employees",
        path:       "/staff/employees",
        routeKey:   ROUTES.STAFF_MANAGEMENT,
        icon:       "UserCheck",
        matchPaths: ["/staff/employees/"],
      },
      {
        id:       "staff_departments",
        label:    "Departments",
        path:     "/staff/departments",
        routeKey: ROUTES.DEPARTMENTS,
        icon:     "Building2",
      },
      {
        id:       "staff_designations",
        label:    "Designations",
        path:     "/staff/designations",
        routeKey: ROUTES.DESIGNATIONS,
        icon:     "BookOpen",
      },
    ],
  },

  // ── Staff Attendance (Phase 2) ────────────────────────────────────────────
  {
    id:          "staff_attendance",
    label:       "Staff Attendance",
    collapsible: true,
    defaultOpen: true,
    items: [
      {
        id:       "attendance_dashboard",
        label:    "Dashboard",
        path:     "/staff/attendance",
        routeKey: ROUTES.STAFF_ATTENDANCE,
        icon:     "CheckSquare",
        exact:    true,
      },
      {
        id:       "attendance_today",
        label:    "Today",
        path:     "/staff/attendance/today",
        routeKey: ROUTES.STAFF_ATTENDANCE,
        icon:     "UserCheck",
      },
      {
        id:       "attendance_calendar",
        label:    "Calendar",
        path:     "/staff/attendance/calendar",
        routeKey: ROUTES.STAFF_ATTENDANCE,
        icon:     "CalendarDays",
      },
      {
        id:       "attendance_history",
        label:    "History",
        path:     "/staff/attendance/history",
        routeKey: ROUTES.STAFF_ATTENDANCE,
        icon:     "History",
      },
      {
        id:       "attendance_reports",
        label:    "Reports",
        path:     "/staff/attendance/reports",
        routeKey: ROUTES.STAFF_ATTENDANCE,
        icon:     "BarChart2",
      },
      {
        id:       "staff_shifts",
        label:    "Shifts",
        path:     "/staff/shifts",
        routeKey: ROUTES.STAFF_SHIFTS,
        icon:     "Moon",
      },
    ],
  },

  // ── Leave Management (Phase 3) ─────────────────────────────────────
  {
    id:          "staff_leave",
    label:       "Leave Management",
    collapsible: true,
    defaultOpen: true,
    items: [
      { id: "leave_dashboard", label: "Dashboard",    path: "/staff/leave",            routeKey: ROUTES.STAFF_LEAVE,        icon: "Heart", exact: true },
      { id: "leave_apply",     label: "Apply Leave",  path: "/staff/leave/apply",      routeKey: ROUTES.STAFF_LEAVE,        icon: "CheckSquare" },
      { id: "leave_approvals", label: "Approvals",    path: "/staff/leave/approvals",  routeKey: ROUTES.STAFF_LEAVE,        icon: "UserCheck" },
      { id: "leave_calendar",  label: "Calendar",     path: "/staff/leave/calendar",   routeKey: ROUTES.STAFF_LEAVE,        icon: "CalendarDays" },
      { id: "leave_reports",   label: "Reports",      path: "/staff/leave/reports",    routeKey: ROUTES.STAFF_LEAVE,        icon: "BarChart2" },
      { id: "leave_types",     label: "Leave Types",  path: "/staff/leave/types",      routeKey: ROUTES.STAFF_LEAVE_TYPES,  icon: "BookOpen" },
    ],
  },

  // ── Payroll (Phase 4) ──────────────────────────────────────────────
  {
    id:          "staff_payroll",
    label:       "Payroll",
    collapsible: true,
    defaultOpen: true,
    items: [
      { id: "payroll_dashboard",  label: "Dashboard",     path: "/staff/payroll",            routeKey: ROUTES.STAFF_PAYROLL,         icon: "CreditCard", exact: true },
      { id: "payroll_run",        label: "Run Payroll",   path: "/staff/payroll/run",        routeKey: ROUTES.STAFF_PAYROLL_PROCESS, icon: "FileText" },
      { id: "payroll_staff",      label: "Staff Salaries",path: "/staff/payroll/staff",      routeKey: ROUTES.STAFF_PAYROLL_PROCESS, icon: "Users" },
      { id: "payroll_structures", label: "Structures",    path: "/staff/payroll/structures", routeKey: ROUTES.STAFF_PAYROLL_PROCESS, icon: "Layers" },
      { id: "payroll_components", label: "Components",    path: "/staff/payroll/components", routeKey: ROUTES.STAFF_PAYROLL_PROCESS, icon: "Grid" },
      { id: "payroll_history",    label: "History",       path: "/staff/payroll/history",    routeKey: ROUTES.STAFF_PAYROLL,         icon: "History" },
      { id: "payroll_bank",       label: "Bank Report",   path: "/staff/payroll/bank",       routeKey: ROUTES.STAFF_PAYROLL,         icon: "BarChart2" },
    ],
  },

  // ── Performance Management (Phase 5) ───────────────────────────────
  {
    id:          "staff_performance",
    label:       "Performance",
    collapsible: true,
    defaultOpen: true,
    items: [
      { id: "perf_dashboard", label: "Dashboard",       path: "/staff/performance",           routeKey: ROUTES.STAFF_PERFORMANCE,        icon: "BarChart2", exact: true },
      { id: "perf_reviews",   label: "Reviews",         path: "/staff/performance/reviews",   routeKey: ROUTES.STAFF_PERFORMANCE,        icon: "FileText" },
      { id: "perf_goals",     label: "Goals",           path: "/staff/performance/goals",     routeKey: ROUTES.STAFF_PERFORMANCE,        icon: "CheckSquare" },
      { id: "perf_feedback",  label: "Parent Feedback", path: "/staff/performance/feedback",  routeKey: ROUTES.STAFF_PERFORMANCE,        icon: "Megaphone" },
      { id: "perf_awards",    label: "Awards & Promotions", path: "/staff/performance/awards",routeKey: ROUTES.STAFF_PERFORMANCE,        icon: "Heart" },
      { id: "perf_timeline",  label: "Timeline & AI",   path: "/staff/performance/timeline",  routeKey: ROUTES.STAFF_PERFORMANCE,        icon: "History" },
      { id: "perf_kpis",      label: "KPIs",            path: "/staff/performance/kpis",      routeKey: ROUTES.STAFF_PERFORMANCE_MANAGE, icon: "Grid" },
    ],
  },

  // ── Academics ──────────────────────────────────────────────────────────────
  {
    id:          "academics",
    label:       "Academics",
    collapsible: true,
    defaultOpen: true,
    items: [
      {
        id:       "academics_classes",
        label:    "Classes",
        path:     "/academics/classes",
        routeKey: ROUTES.ACADEMICS_CLASSES,
        icon:     "BookOpen",
      },
      {
        id:       "academics_batches",
        label:    "Batches",
        path:     "/academics/batches",
        routeKey: ROUTES.ACADEMICS_BATCHES,
        icon:     "Layers",
      },
      {
        id:       "academics_teacher_allocation",
        label:    "Teacher Allocation",
        path:     "/academics/teacher-allocation",
        routeKey: ROUTES.ACADEMICS_TEACHER_ALLOCATION,
        icon:     "Briefcase",
      },
      {
        id:       "academics_classroom_allocation",
        label:    "Classroom Allocation",
        path:     "/academics/classroom-allocation",
        routeKey: ROUTES.ACADEMICS_CLASSROOM_ALLOCATION,
        icon:     "Grid",
      },
      {
        id:       "academics_student_allocation",
        label:    "Student Enrollment",
        path:     "/academics/student-allocation",
        routeKey: ROUTES.ACADEMICS_STUDENT_ALLOCATION,
        icon:     "UserCheck",
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
        id:       "collections",
        label:    "Collections",
        path:     "/collections",
        routeKey: ROUTES.FEES,   // reuses Fees permission — no new route key
        icon:     "BarChart2",
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

  // ── Finance Platform ─────────────────────────────────────────────────────────
  // New Finance Foundation UI — additive, sits alongside the legacy Finance
  // group above (untouched). Gated by FINANCE_FOUNDATION_ENABLED server-side;
  // frontend routeKeys mirror backend's "finance-foundation" role grant
  // (admin/center_admin/center_owner/accountant), see permissions.js.
  {
    id:          "finance_platform",
    label:       "Finance Platform",
    collapsible: true,
    defaultOpen: false,
    items: [
      {
        id:       "finance_dashboard",
        label:    "Finance Dashboard",
        path:     "/finance/dashboard",
        routeKey: ROUTES.FINANCE_DASHBOARD,
        icon:     "LayoutDashboard",
      },
      {
        id:       "finance_ledger",
        label:    "Student Ledger",
        path:     "/finance/ledger",
        routeKey: ROUTES.FINANCE_LEDGER,
        icon:     "BookOpen",
      },
      {
        id:       "finance_billing_plans",
        label:    "Billing Plans",
        path:     "/finance/billing-plans",
        routeKey: ROUTES.FINANCE_BILLING_PLANS,
        icon:     "Repeat",
      },
      {
        id:       "finance_invoices",
        label:    "Invoices",
        path:     "/finance/invoices",
        routeKey: ROUTES.FINANCE_INVOICES,
        icon:     "FileText",
      },
      {
        id:       "finance_payments",
        label:    "Payments",
        path:     "/finance/payments",
        routeKey: ROUTES.FINANCE_PAYMENTS,
        icon:     "Wallet",
      },
      {
        id:       "finance_family_account",
        label:    "Family Account",
        path:     "/finance/family-account",
        routeKey: ROUTES.FINANCE_FAMILY_ACCOUNT,
        icon:     "Users",
      },
      {
        id:       "finance_refunds",
        label:    "Refunds",
        path:     "/finance/refunds",
        routeKey: ROUTES.FINANCE_REFUNDS,
        icon:     "Undo2",
      },
      {
        id:       "finance_settings",
        label:    "Finance Settings",
        path:     "/finance/settings",
        routeKey: ROUTES.FINANCE_SETTINGS,
        icon:     "Settings2",
      },
      {
        id:       "finance_audit",
        label:    "Finance Audit Log",
        path:     "/finance/audit-log",
        routeKey: ROUTES.FINANCE_AUDIT,
        icon:     "ScrollText",
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
      {
        id:       "care_hygiene",
        label:    "Care & Hygiene",
        path:     "/care-hygiene",
        routeKey: ROUTES.CARE_HYGIENE,
        icon:     "Heart",
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
      {
        id:       "events",
        label:    "Events",
        path:     "/events",
        routeKey: ROUTES.EVENTS,
        icon:     "CalendarCheck",
      },
      {
        id:       "ptm",
        label:    "PTM",
        path:     "/ptm",
        routeKey: ROUTES.PTM,
        icon:     "UsersRound",
      },
    ],
  },

  // ── Child Journey ─────────────────────────────────────────────────────────
  {
    id:          "child_journey",
    label:       "Child Journey",
    collapsible: true,
    defaultOpen: true,
    items: [
      {
        id:         "child_journey_dashboard",
        label:      "Child Journey",
        path:       "/child-journey",
        routeKey:   ROUTES.CHILD_JOURNEY,
        icon:       "BookOpen",
        matchPaths: ["/child-journey/"],
      },
    ],
  },

  // ── Safety & Compliance ────────────────────────────────────────────────────
  // Permanently expanded — child-safety-critical (Incident Reports, Gate
  // Register). A collapsed state here silently hides both items with zero
  // code/RBAC/deploy signal; see the Gate Register visibility investigation
  // (2026-07-14) for the incident this prevents.
  {
    id:          "presence_safety",
    label:       "Safety & Compliance",
    collapsible: false,
    defaultOpen: true,
    items: [
      {
        id:       "incidents",
        label:    "Incident Reports",
        path:     "/incidents",
        routeKey: ROUTES.INCIDENTS,
        icon:     "AlertTriangle",
      },
      {
        id:       "child_presence",
        label:    "Gate Register",
        path:     "/child-presence",
        routeKey: ROUTES.ATTENDANCE,
        icon:     "UserCheck",
      },
    ],
  },

  // ── Surveillance ─────────────────────────────────────────────────────────────
  // Dedicated infrastructure/security module. Future: Live View, Parent
  // Access, Audit Logs. Kept top-level (not under Presence & Safety).
  {
    id:          "surveillance",
    label:       "Surveillance",
    collapsible: true,
    defaultOpen: true,
    items: [
      {
        id:       "cctv",
        label:    "CCTV",
        path:     "/cctv",
        routeKey: ROUTES.CCTV,
        icon:     "Video",
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

  // ── Super Admin ────────────────────────────────────────────────────────────
  // Only rendered when role === super_admin or developer.
  {
    id:          "super_admin",
    label:       "Super Admin",
    collapsible: true,
    defaultOpen: true,
    superAdminOnly: true,  // handled in Sidebar.jsx same as devOnly
    items: [
      {
        id:       "tenant_management",
        label:    "Preschools",
        path:     "/super-admin/tenants",
        routeKey: ROUTES.TENANT_MANAGEMENT,
        icon:     "Building2",
        matchPaths: ["/super-admin/tenants/"],
      },
      {
        id:       "tenant_analytics",
        label:    "Platform Analytics",
        path:     "/super-admin/analytics",
        routeKey: ROUTES.TENANT_MANAGEMENT,
        icon:     "BarChart2",
      },
      {
        id:       "tenant_audit",
        label:    "Audit Logs",
        path:     "/super-admin/audit",
        routeKey: ROUTES.TENANT_MANAGEMENT,
        icon:     "ScrollText",
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
