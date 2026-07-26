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

/**
 * ⛔ UNREACHABLE MODULES — the largest defect found so far, surfaced by
 * verify-permissions.mjs in §12 Phase 1.
 *
 * 17 routeKeys gating ~40 shipped screens cannot be granted to ANY non-bypass
 * role. This is not a configuration problem and no Firestore edit can fix it:
 *
 *   effective(role) = deriveRouteKeys(roleDoc.permissions) ∪ STATIC_ROLE_PERMS[role]
 *
 * `deriveRouteKeys` can only ever emit keys that appear as VALUES in
 * roleService.js's MODULE_ROUTE_MAP. These 17 appear in neither that map nor
 * in STATIC_ROLE_PERMS, so both terms of the union exclude them — for every
 * role, under every possible role document.
 *
 * Meanwhile ProtectedRoute sends can(routeKey)===false straight to
 * /unauthorized, and the sidebar hides the item. Developer and super_admin are
 * unaffected because isBypassRole() short-circuits every check before it — the
 * most likely reason this survived: the modules work perfectly when tested as
 * a developer, and only fail for real staff.
 *
 * Both non-authoritative maps (backend config/permissionsBackend.js and
 * frontend config/permissions.js) DO grant these keys per role, so intent is
 * well evidenced — roleService.js's copy is simply stale, missing whole
 * modules shipped after it was written.
 *
 * Closing this is the substance of §12 Phase 1. It WIDENS access, so it is a
 * reviewed change, not a silent one.
 */
export const UNREACHABLE_ROUTEKEYS = [
  "care-hygiene", "child-journey", "events", "incidents", "ptm",
  "qr-management", "staff-checkout", "academics-student-allocation",
  "staff-attendance", "staff-shifts", "staff-leave", "staff-leave-types",
  "staff-payroll", "staff-payroll-process",
  "staff-performance", "staff-performance-manage",
  "tenant-management",   // super-admin only in practice, and they bypass — lowest impact
  "dev-tools",           // developer only, and they bypass — no user impact
  "finance-scheduler",   // bypass-only BY DESIGN (see permissions.js) — not a defect
];

/** Of the above, the ones with genuine user impact (excludes bypass-only keys). */
export const UNREACHABLE_WITH_IMPACT = UNREACHABLE_ROUTEKEYS.filter(
  k => !["finance-scheduler", "dev-tools", "tenant-management"].includes(k)
);

/**
 * ⛔ ROLES WHOSE CAPABILITY-GATED SURFACES COME UP EMPTY
 *
 * Found by verify-roles.mjs during integration validation (2026-07-26).
 *
 * This is a NEW class of problem created by capability-gated surfaces, and it
 * is why Dashboard and Care must not become the default landing page yet:
 *
 *   - existing screens gate on can(routeKey), which resolves from
 *     STATIC_ROLE_PERMS and therefore works for every role
 *   - Dashboard and Care gate on capabilities, which resolve ONLY from the
 *     Firestore role document's permission matrix
 *
 * A role with no seeded role document has routeKeys but an EMPTY matrix, so
 * navigation works while the new surfaces render completely blank.
 *
 * roleService.js SYSTEM_ROLES seeds: admin, center_admin, teacher, accountant,
 * reception. It does NOT seed center_owner, even though that role exists in
 * permissions.js, permissionsBackend.js, STATIC_ROLE_PERMS and ROLE_LABELS.
 *
 * Fixing this WIDENS capabilities, so it is held for review alongside the
 * Phase 1 access diff rather than applied unilaterally.
 */
export const ROLES_WITHOUT_MATRIX = ["center_owner"];

/**
 * Capabilities no real (non-bypass) staff role currently holds, so the
 * surfaces that depend on them are visible only to developer/super_admin.
 *
 * Same root cause as UNREACHABLE_ROUTEKEYS: these modules have no entry in
 * rbacConfig PERMISSION_CATEGORIES, so no role document can grant them. The
 * consequence for the new surfaces is that Incidents never appears on a real
 * teacher's or principal's Dashboard or Care feed.
 */
export const CAPABILITIES_NO_STAFF_ROLE_HOLDS = [
  "incidents.view",
  "care_hygiene.view",
  "observations.view",   // Child Journey
];

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
