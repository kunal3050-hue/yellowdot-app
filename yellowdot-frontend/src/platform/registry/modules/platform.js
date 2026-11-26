/**
 * platform.js — Module Registry: Super Admin and developer tooling
 * PLATFORM ARCHITECTURE §5
 *
 * These operate one level up from the school-level modules — tenants, not
 * students — which is why Super Admin's Care surface is structurally different
 * rather than merely filtered (ACTION_CENTER_ARCHITECTURE_PLAN §4b).
 */
import { defineModule } from "../defineModule.js";

export const tenantManagementModule = defineModule({
  id: "tenant_management",
  label: "Preschools",
  icon: "Building2",
  category: "super_admin",
  capability: "tenant_management.view",
  actions: ["view", "create", "edit", "manage"],
  keywords: ["tenant", "preschool", "school", "onboarding", "subscription", "branch"],
  surfaces: { care: { order: 300, roles: { super_admin: 10 } } },
  // Moved from /super-admin/* to /platform/*: these act across tenants and now
  // live in their own shell (PlatformLayout) behind their own guard
  // (PlatformRoute). The old paths remain in App.jsx as redirects.
  //
  // Only the first carries a nav placement. Analytics and Audit are reached
  // from the console's own rail; repeating them in the school sidebar would
  // undo the separation.
  routes: [
    // `ungated` here means what it means everywhere in this registry: App.jsx
    // declares no routeKey on the route. It does NOT mean unprotected — these
    // sit behind PlatformRoute, which gates on role rather than on a routeKey,
    // because routeKey gating is exactly what cannot express this today
    // (tenant-management is in knownGaps as unreachable for every non-bypass
    // role). The backend guards /api/tenants independently regardless.
    { path: "/platform/tenants", routeKey: "tenant-management", ungated: true, label: "Platform Console", icon: "Building2",
      nav: [{ category: "super_admin", order: 10, matchPaths: ["/platform/"] }] },
    { path: "/platform/tenants/new",        routeKey: "tenant-management", ungated: true, capability: "tenant_management.create" },
    { path: "/platform/tenants/:tenantId",  routeKey: "tenant-management", ungated: true },
    { path: "/platform/analytics",          routeKey: "tenant-management", ungated: true },
    { path: "/platform/audit",              routeKey: "tenant-management", ungated: true },

    // The console's own front door. Public like the school /login: it has to
    // be reachable by someone not yet signed in.
    { path: "/platform/login", public: true },

    // Redirects kept so existing links, history and bookmarks still work.
    // They carry no guard of their own — they only forward to the paths above,
    // which do.
    { path: "/super-admin/tenants",           routeKey: "tenant-management", ungated: true },
    { path: "/super-admin/tenants/new",       routeKey: "tenant-management", ungated: true },
    { path: "/super-admin/tenants/:tenantId", routeKey: "tenant-management", ungated: true },
    { path: "/super-admin/analytics",         routeKey: "tenant-management", ungated: true },
    { path: "/super-admin/audit",             routeKey: "tenant-management", ungated: true },
  ],
});

/**
 * Developer tooling. Note the drift the verifier reports on /dev/modules:
 * sidebarConfig gates it on routeKey "dev-tools", but App.jsx declares the
 * route with NO routeKey at all — so the page itself is ungated while its nav
 * entry is gated. Recorded as it actually is (routeKey on the nav placement,
 * `ungated: true` on the route) rather than papered over.
 */
export const devToolsModule = defineModule({
  id: "dev_tools",
  label: "Developer Tools",
  icon: "Grid",
  category: "developer",
  capability: "dev_tools.view",
  actions: ["view"],
  devOnly: true,
  keywords: ["developer", "dev tools", "module explorer", "playground", "debug"],
  routes: [
    { path: "/dev/modules", routeKey: "dev-tools", label: "Module Explorer", icon: "Grid",
      ungated: true,   // App.jsx declares no routeKey on this route — see above
      nav: [{ category: "developer", order: 20 }] },
    { path: "/dev/datatable-playground",  routeKey: "dev-tools", ungated: true },
    { path: "/dev/component-playground",  routeKey: "dev-tools", ungated: true },
  ],
});

export default [tenantManagementModule, devToolsModule];
