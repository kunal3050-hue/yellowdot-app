/**
 * dailyCare.js — Module Registry: attendance and the daily care loop
 * PLATFORM ARCHITECTURE §5
 */
import { defineModule } from "../defineModule.js";

/**
 * Student attendance, including the Gate Register.
 *
 * Both routes now sit side by side in the sidebar's Safety & Compliance
 * group — fixed 2026-07-30 per the staff UX review (C4/C5/T1). Previously
 * /attendance had no sidebar entry and no MainLayout wrapper at all,
 * reachable only via the Control Center grid, direct URL or search.
 */
export const attendanceModule = defineModule({
  id: "attendance",
  label: "Attendance",
  icon: "CalendarCheck",
  category: "presence_safety",
  capability: "attendance.view",
  featureFlag: "ATTENDANCE",
  actions: ["view", "mark", "edit", "export"],
  keywords: ["attendance", "present", "absent", "roll call", "check in", "gate", "register"],
  surfaces: { care: { order: 10, roles: { teacher: 10, reception: 30 } } },
  routes: [
    {
      // Staff review C4/C5/T1 (2026-07-30): no sidebar entry at all, and no
      // MainLayout wrapper (fixed in App.jsx) — this was the single
      // highest-frequency screen for a Teacher and the hardest to find.
      path: "/attendance", routeKey: "attendance", label: "Student Attendance", icon: "CalendarCheck",
      nav: [{ category: "presence_safety", order: 15 }],
      grid: { section: "attendance", label: "Student Attendance", icon: "CalendarCheck",
              description: "Mark attendance and monitor today's presence." },
    },
    {
      path: "/child-presence", routeKey: "attendance", label: "Gate Register", icon: "UserCheck",
      nav: [{ category: "presence_safety", order: 20 }],
      grid: { section: "attendance", label: "Gate Register", icon: "DoorOpen",
              description: "Track live check-ins, pickups and gate activity." },
    },
    // One-off migration utility — intentionally unlisted in every nav surface.
    { path: "/pickup-migration", routeKey: "attendance", capability: "attendance.edit" },
  ],
});

export const napTrackerModule = defineModule({
  id: "nap_tracking",
  label: "Nap Tracker",
  icon: "Moon",
  category: "daily_ops",
  capability: "nap_tracking.view",
  featureFlag: "DAILY_CARE",
  actions: ["view", "mark", "edit"],
  keywords: ["nap", "sleep", "rest", "bedtime"],
  routes: [
    {
      path: "/nap-tracker", routeKey: "nap-tracker", label: "Nap Tracker", icon: "Moon",
      nav: [{ category: "daily_ops", order: 10 }],
      grid: { section: "daily_care", label: "Nap Tracker", icon: "Moon",
              description: "Log sleep schedules and nap times." },
    },
  ],
});

export const foodMenuModule = defineModule({
  id: "food_menu",
  label: "Food Menu",
  icon: "Utensils",
  category: "daily_ops",
  capability: "food_menu.view",
  featureFlag: "DAILY_CARE",
  actions: ["view", "create", "edit", "delete"],
  keywords: ["food", "menu", "meal", "lunch", "breakfast", "snack", "diet"],
  routes: [
    {
      path: "/food-menu", routeKey: "food-menu", label: "Food Menu", icon: "Utensils",
      nav: [{ category: "daily_ops", order: 20 }],
      grid: { section: "daily_care", label: "Food Menu", icon: "Utensils",
              description: "Plan daily and weekly meal menus." },
    },
  ],
});

/**
 * Consumption logging. Shares the "food_menu" permission module in rbacConfig
 * (MODULE_ROUTE_MAP maps food_menu → ["food-menu", "food-consumption"]), so its
 * capability deliberately points at food_menu rather than inventing a new one
 * the Roles UI has no switch for.
 */
export const foodConsumptionModule = defineModule({
  id: "food_consumption",
  label: "Consumption Log",
  icon: "ClipboardList",
  category: "daily_ops",
  capability: "food_menu.view",
  featureFlag: "DAILY_CARE",
  actions: ["view", "mark", "edit"],
  keywords: ["consumption", "ate", "food log", "intake", "meal log"],
  routes: [
    {
      path: "/food-consumption", routeKey: "food-consumption", label: "Consumption Log", icon: "ClipboardList",
      capability: "food_menu.view",
      nav: [{ category: "daily_ops", order: 30 }],
      grid: { section: "daily_care", label: "Food Consumption", icon: "ClipboardList",
              description: "Record what each child ate today." },
    },
  ],
});

/**
 * Care & Hygiene — labelled "Daily Care" wherever it sits near the Care tab,
 * per the accepted naming tradeoff in ACTION_CENTER_ARCHITECTURE_PLAN §7.
 */
export const careHygieneModule = defineModule({
  id: "care_hygiene",
  label: "Care & Hygiene",
  icon: "Heart",
  category: "daily_ops",
  capability: "care_hygiene.view",
  featureFlag: "DAILY_CARE",
  actions: ["view", "mark", "edit"],
  keywords: ["care", "hygiene", "diaper", "nappy", "water", "cleanliness"],
  surfaces: { care: { order: 20, roles: { teacher: 20 } } },
  routes: [
    {
      path: "/care-hygiene", routeKey: "care-hygiene", label: "Care & Hygiene", icon: "Heart",
      nav: [{ category: "daily_ops", order: 40 }],
      grid: { section: "daily_care", label: "Care & Hygiene", icon: "Heart",
              description: "Log diaper changes and hygiene routines." },
    },
  ],
});

export default [
  attendanceModule, napTrackerModule, foodMenuModule,
  foodConsumptionModule, careHygieneModule,
];
