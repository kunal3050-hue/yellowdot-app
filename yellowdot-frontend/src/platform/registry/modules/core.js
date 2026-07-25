/**
 * core.js — Module Registry: shell, identity and cross-cutting modules
 * PLATFORM ARCHITECTURE §5
 *
 * Route surface placement:
 *   nav[]  — sidebar entries for this path (an ARRAY: /analytics and
 *            /collections each legitimately appear under TWO sidebar groups,
 *            once under legacy Finance and once under Finance Platform)
 *   grid   — the Control Center card for this path, if it has one
 *   omit both — reachable by deep link or in-page navigation only
 */
import { defineModule } from "../defineModule.js";

/** Unauthenticated + session-bootstrap routes. No routeKey by design. */
export const authModule = defineModule({
  id: "auth",
  label: "Authentication",
  icon: "Shield",
  category: "system",
  capability: "auth.view",
  actions: ["view"],
  internal: true,          // never rendered in any nav surface
  keywords: ["login", "sign in", "logout"],
  routes: [
    { path: "/login",              public: true },
    { path: "/profile-incomplete", public: true },
    { path: "/unauthorized",       public: true },
    { path: "/select-center",      public: true },
    { path: "/impersonate",        public: true },
    // RootRedirect — resolves the post-login landing page. Becomes /dashboard
    // for every non-parent role in §12 Phase 8 (frozen decision Q3).
    { path: "/",                   public: true },
  ],
});

/**
 * Dashboard — the insights surface (§6).
 * Today this routeKey backs three overlapping pages: /live-dashboard,
 * /quick-nav and /quick-navigation. Phase 8 collapses them onto /dashboard
 * and leaves the rest as redirects.
 */
export const dashboardModule = defineModule({
  id: "dashboard",
  label: "Dashboard",
  icon: "Home",
  category: "overview",
  capability: "dashboard.view",
  featureFlag: "LIVE_DASHBOARD",
  actions: ["view"],
  keywords: ["dashboard", "home", "overview", "today", "stats", "kpi"],
  routes: [
    {
      path: "/live-dashboard", routeKey: "dashboard", label: "Live Dashboard", icon: "Home",
      nav: [{ category: "overview", order: 10 }],
      grid: { section: "dashboard", label: "Live Dashboard", icon: "LayoutDashboard",
              description: "See today's activity, alerts and school-wide stats at a glance." },
    },
    {
      path: "/quick-navigation", routeKey: "dashboard", label: "Control Center", icon: "Grid",
      nav: [{ category: "overview", order: 20 }],
    },
    // Legacy alias kept alive for bookmarks; not in any nav surface.
    { path: "/quick-nav", routeKey: "dashboard" },
  ],
});

export const analyticsModule = defineModule({
  id: "analytics",
  label: "Analytics",
  icon: "BarChart2",
  category: "finance",
  capability: "analytics.view",
  actions: ["view", "export"],
  keywords: ["analytics", "reports", "trends", "revenue", "enrolment"],
  routes: [
    {
      path: "/analytics", routeKey: "analytics", label: "Analytics", icon: "BarChart2",
      // Two sidebar homes — "Analytics" under legacy Finance, "Reports" under
      // Finance Platform. Mutually exclusive at runtime via the finance flag.
      nav: [
        { category: "finance",           order: 40, label: "Analytics" },
        { category: "finance_platform",  order: 90, label: "Reports", icon: "BarChart2" },
      ],
      grid: { section: "reports_analytics", label: "Analytics", icon: "TrendingUp",
              description: "Attendance, revenue and enrolment trends over time." },
    },
  ],
});

export const profileModule = defineModule({
  id: "profile",
  label: "Profile",
  icon: "UserCheck",
  category: "system",
  capability: "profile.view",
  actions: ["view", "edit"],
  internal: true,          // reached from the topbar avatar, not the sidebar
  keywords: ["profile", "my account", "me"],
  routes: [
    { path: "/profile", routeKey: "profile" },
  ],
});

export const settingsModule = defineModule({
  id: "settings",
  label: "Settings",
  icon: "Settings",
  category: "system",
  capability: "settings.view",
  actions: ["view", "edit"],
  keywords: ["settings", "configuration", "branding", "preferences", "school details"],
  routes: [
    {
      path: "/settings", routeKey: "settings", label: "Settings", icon: "Settings",
      nav: [{ category: "system", order: 10, matchPaths: ["/settings/"] }],
      grid: { section: "settings", label: "Settings", icon: "Settings",
              description: "Configure branding, preferences and school details." },
    },
    { path: "/settings/security", routeKey: "settings" },
  ],
});

export default [
  authModule, dashboardModule, analyticsModule, profileModule, settingsModule,
];
