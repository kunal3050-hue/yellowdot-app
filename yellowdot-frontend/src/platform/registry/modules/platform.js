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
  routes: [
    { path: "/super-admin/tenants", routeKey: "tenant-management", label: "Preschools", icon: "Building2",
      nav: [{ category: "super_admin", order: 10, matchPaths: ["/super-admin/tenants/"] }] },
    { path: "/super-admin/tenants/new",        routeKey: "tenant-management", capability: "tenant_management.create" },
    { path: "/super-admin/tenants/:tenantId",  routeKey: "tenant-management" },
    { path: "/super-admin/analytics", routeKey: "tenant-management", label: "Platform Analytics", icon: "BarChart2",
      nav: [{ category: "super_admin", order: 20 }] },
    { path: "/super-admin/audit",     routeKey: "tenant-management", label: "Audit Logs", icon: "ScrollText",
      nav: [{ category: "super_admin", order: 30 }] },
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
