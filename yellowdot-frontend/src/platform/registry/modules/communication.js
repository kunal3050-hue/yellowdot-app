/**
 * communication.js — Module Registry: parent- and staff-facing communication
 * PLATFORM ARCHITECTURE §5
 *
 * All five share the "notifications" permission module in rbacConfig, whose
 * MODULE_ROUTE_MAP entry is currently an EMPTY ARRAY — PLATFORM_ARCHITECTURE
 * §0.3 gap 1. Granting "Notifications → view" today therefore grants access to
 * nothing; these routeKeys reach users only through STATIC_ROLE_PERMS. The
 * mapping is filled in §12 Phase 1; capabilities below name the target state.
 */
import { defineModule } from "../defineModule.js";

export const holidaysModule = defineModule({
  id: "holidays",
  label: "Holidays",
  icon: "CalendarDays",
  category: "communications",
  capability: "notifications.view",
  actions: ["view", "create", "edit", "delete"],
  keywords: ["holiday", "calendar", "closure", "vacation", "break"],
  routes: [
    {
      path: "/holidays", routeKey: "holidays", label: "Holidays", icon: "CalendarDays",
      nav: [{ category: "communications", order: 10 }],
      grid: { section: "communication", label: "Holidays", icon: "CalendarDays",
              description: "Plan and publish the academic holiday calendar." },
    },
  ],
});

export const noticesModule = defineModule({
  id: "notices",
  label: "Notices",
  icon: "Bell",
  category: "communications",
  capability: "notifications.view",
  actions: ["view", "create", "edit", "delete"],
  keywords: ["notice", "circular", "bulletin"],
  routes: [
    {
      path: "/notices", routeKey: "notices", label: "Notices", icon: "Bell",
      nav: [{ category: "communications", order: 20 }],
      grid: { section: "communication", label: "Notices", icon: "Bell",
              description: "Share important notices with staff and parents." },
    },
  ],
});

export const announcementsModule = defineModule({
  id: "announcements",
  label: "Announcements",
  icon: "Megaphone",
  category: "communications",
  capability: "notifications.view",
  actions: ["view", "create", "edit", "delete"],
  keywords: ["announcement", "broadcast", "message", "alert"],
  routes: [
    {
      path: "/announcements", routeKey: "announcements", label: "Announcements", icon: "Megaphone",
      nav: [{ category: "communications", order: 30 }],
      grid: { section: "communication", label: "Announcements", icon: "Megaphone",
              description: "Broadcast school-wide announcements instantly." },
    },
  ],
});

export const eventsModule = defineModule({
  id: "events",
  label: "Events",
  icon: "CalendarCheck",
  category: "communications",
  capability: "notifications.view",
  actions: ["view", "create", "edit", "delete"],
  keywords: ["event", "celebration", "function", "activity", "calendar"],
  routes: [
    {
      path: "/events", routeKey: "events", label: "Events", icon: "CalendarCheck",
      nav: [{ category: "communications", order: 40 }],
    },
  ],
});

export const ptmModule = defineModule({
  id: "ptm",
  label: "PTM",
  icon: "UsersRound",
  category: "communications",
  capability: "notifications.view",
  actions: ["view", "create", "edit"],
  keywords: ["ptm", "parent teacher meeting", "conference", "appointment"],
  routes: [
    {
      path: "/ptm", routeKey: "ptm", label: "PTM", icon: "UsersRound",
      nav: [{ category: "communications", order: 50 }],
      grid: { section: "parents", label: "PTM", icon: "Handshake",
              description: "Schedule and manage parent-teacher meetings." },
    },
  ],
});

export default [
  holidaysModule, noticesModule, announcementsModule, eventsModule, ptmModule,
];
