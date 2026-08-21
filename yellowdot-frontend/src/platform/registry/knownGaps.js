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
 * ── UPDATE (2026-07-29): the non-HR portion of this list is FIXED ──────────
 * `care-hygiene`, `child-journey`, `events`, `incidents`, `ptm`,
 * `qr-management`, `staff-checkout`, `academics-student-allocation` and
 * `families` were restored by applying the reviewed
 * `review/phase1-safe-access.patch` to STATIC_ROLE_PERMS, and by adding
 * `incidents`/`care_hygiene`/`observations` to MODULE_ROUTE_MAP (both
 * copies) and to rbacConfig PERMISSION_CATEGORIES, so a role document can
 * now express these capabilities too. Removed from the list below.
 *
 * What remains is EVERY HR/Payroll/Performance key, held back deliberately
 * (architecture §2c.1): both existing maps grant `teacher` `staff-payroll`
 * and `staff-performance` meaning "see my own", but the keys are all-or-
 * nothing — applying them as written would hand every teacher the whole
 * module school-wide. That needs the self/team/all scope model AND
 * scope-aware backend endpoints before it is safe, which has not happened
 * yet. See PHASE1_ACCESS_DIFF.md §4.
 *
 * `effective(role) = deriveRouteKeys(roleDoc.permissions) ∪ STATIC_ROLE_PERMS[role]`
 * — `deriveRouteKeys` can only ever emit keys that appear as VALUES in
 * roleService.js's MODULE_ROUTE_MAP, so a key missing from both terms is
 * unreachable for every role under every possible role document, not a
 * configuration problem a Firestore edit could fix.
 *
 * Developer and super_admin were never affected — `isBypassRole()` short-
 * circuits every check before it, which is almost certainly why this
 * survived: the modules worked when tested as a developer.
 */
export const UNREACHABLE_ROUTEKEYS = [
  "staff-attendance", "staff-shifts", "staff-leave", "staff-leave-types",
  "staff-payroll", "staff-payroll-process",
  "staff-performance", "staff-performance-manage",
  "tenant-management",   // super-admin only in practice, and they bypass — lowest impact
  "dev-tools",           // developer only, and they bypass — no user impact
];

/** Of the above, the ones with genuine user impact (excludes bypass-only keys). */
export const UNREACHABLE_WITH_IMPACT = UNREACHABLE_ROUTEKEYS.filter(
  k => !["dev-tools", "tenant-management"].includes(k)
);

/**
 * ⛔ ROLES WHOSE CAPABILITY-GATED SURFACES COME UP EMPTY
 *
 * ── FIXED 2026-07-29 ────────────────────────────────────────────────────
 * `center_owner` is now seeded in roleService.js SYSTEM_ROLES, mirroring
 * `admin` exactly (see the inline comment on that entry for why). Kept as an
 * empty array, not deleted, so the shape survives if a future role is added
 * to permissions.js without a matching seed — the exact mistake this caught.
 *
 * Original finding, for context: this was a NEW class of problem created by
 * capability-gated surfaces — existing screens gate on can(routeKey), which
 * resolves from STATIC_ROLE_PERMS and works for every role; Dashboard and
 * Care gate on capabilities, which resolve ONLY from the Firestore role
 * document's permission matrix. A role with no seeded document has routeKeys
 * but an EMPTY matrix, so navigation worked while the new surfaces rendered
 * completely blank.
 */
export const ROLES_WITHOUT_MATRIX = [];

/**
 * Capabilities no real (non-bypass) staff role held, so the surfaces that
 * depend on them were visible only to developer/super_admin.
 *
 * ── FIXED 2026-07-29 ────────────────────────────────────────────────────
 * All three now have a PERMISSION_CATEGORIES entry (rbacConfig.js) and are
 * granted in SYSTEM_ROLES to teacher/admin/center_admin/center_owner (the
 * same role set the reviewed routeKey-level patch already used, kept
 * consistent on purpose). Kept as an empty array for the same reason as
 * ROLES_WITHOUT_MATRIX above — it is the gate's memory of this failure mode.
 */
export const CAPABILITIES_NO_STAFF_ROLE_HOLDS = [];

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
 *
 * In the target capability model (§2a) these become `<module>.approve` /
 * `<module>.manage` rather than separate route keys — which is exactly the
 * kind of thing the granular matrix already expresses well.
 */
export const ACTION_ONLY_ROUTEKEYS = new Set([
  "staff-leave-approve",
  "staff-attendance-manage",
]);
