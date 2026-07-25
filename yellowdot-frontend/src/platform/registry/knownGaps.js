/**
 * knownGaps.js — defects the registry found and is deliberately NOT hiding
 * ─────────────────────────────────────────────────────────────────────
 * PLATFORM ARCHITECTURE §12 Phase 0
 *
 * Building the registry required describing the app exactly as it is. Doing so
 * surfaced pre-existing defects that predate this work. They are recorded here,
 * reported on every `npm run verify:registry` run, and NOT silently fixed —
 * each is its own change with its own commit, per the stabilisation rules.
 *
 * This list is also the verifier's allowlist: a gate that is red on day one
 * gets ignored, so these known items warn, while any NEW orphan fails the
 * build. Removing an entry here after fixing it is part of that fix.
 */

/** Nav targets and granted routeKeys that have no <Route> anywhere. */
export const KNOWN_ORPHANS = [
  {
    id: "families",
    routeKey: "families",
    expectedPath: "/families",
    severity: "high",
    summary: "The entire Family & Sibling Management module is unreachable.",
    detail:
      "pages/Families.jsx and pages/FamilyProfile.jsx are complete and shipped, " +
      "ROUTES.FAMILIES is granted to admin/center_admin/center_owner in permissions.js, " +
      "rbacConfig maps family_management → ['families'], and the backend /api/families " +
      "endpoints are live (LiveDashboard.jsx calls /api/families/count). But App.jsx " +
      "declares no route and imports neither component, and there is no sidebar or grid " +
      "entry. FamilyProfile.jsx itself navigates to '/families', which cannot resolve.",
    fix: "Add routes for /families and /families/:familyId, plus a People sidebar entry.",
  },
  {
    id: "parent_checkin",
    routeKey: "parent-checkin",
    expectedPath: "/parent-checkin",
    severity: "medium",
    summary: "Parent Check-In is linked from six surfaces but has no route.",
    detail:
      "pages/ParentCheckIn.jsx exists. Links point at /parent-checkin from " +
      "sidebarConfig PARENT_MENU, Topbar's command palette, QuickNav.jsx, " +
      "dev/ModuleExplorer, a Link in pages/Attendance.jsx, and the home-route " +
      "dropdown in RolesPermissions. No <Route> is defined in App.jsx or " +
      "parentRoutes.jsx, and App.jsx never imports the component.",
    fix: "Either restore the route or remove the six links. ROUTES.PARENT_CHECKIN " +
         "is granted to the parent role, so a route is the likelier intent.",
  },
];

export const KNOWN_ORPHAN_PATHS = new Set(KNOWN_ORPHANS.map(o => o.expectedPath));
export const KNOWN_ORPHAN_ROUTEKEYS = new Set(KNOWN_ORPHANS.map(o => o.routeKey));

/**
 * Permission modules in rbacConfig whose MODULE_ROUTE_MAP entry is an empty
 * array — granting them grants access to nothing (PLATFORM_ARCHITECTURE
 * §0.3 gap 1). Closed in §12 Phase 1 by filling the map from the registry.
 */
export const UNMAPPED_PERMISSION_MODULES = [
  "medical",        // MODULE_ROUTE_MAP: medical → []
  "notifications",  // MODULE_ROUTE_MAP: notifications → []
  "documents",      // MODULE_ROUTE_MAP: documents → []
];

/**
 * routeKeys that gate an ACTION, not a page — correctly having no route.
 *
 * These are the narrower half of a view/act pair: a user holding the view key
 * reaches the screen, and the act key decides whether the approve/manage
 * control is enabled. All three are enforced server-side, which is what makes
 * them real rather than decorative:
 *   staff-leave-approve      → leaveRoutes.js:18 (authorizeRoute on approve)
 *   staff-attendance-manage  → staffAttendanceRoutes.js:34
 *   finance-refund-approval  → financeRefundRoutes.js:25
 *
 * In the target capability model (§2a) these become `<module>.approve` /
 * `<module>.manage` rather than separate route keys — which is exactly the
 * kind of thing the granular matrix already expresses well.
 */
export const ACTION_ONLY_ROUTEKEYS = new Set([
  "staff-leave-approve",
  "staff-attendance-manage",
  "finance-refund-approval",
]);
