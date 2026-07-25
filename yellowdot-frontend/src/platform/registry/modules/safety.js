/**
 * safety.js — Module Registry: gate security, pickup and surveillance
 * PLATFORM ARCHITECTURE §5
 */
import { defineModule } from "../defineModule.js";

export const incidentsModule = defineModule({
  id: "incidents",
  label: "Incident Reports",
  icon: "AlertTriangle",
  category: "presence_safety",
  capability: "incidents.view",
  actions: ["view", "create", "edit", "approve"],
  keywords: ["incident", "accident", "injury", "report", "safety", "escalation"],
  routes: [
    {
      path: "/incidents", routeKey: "incidents", label: "Incident Reports", icon: "AlertTriangle",
      nav: [{ category: "presence_safety", order: 10 }],
      grid: { section: "security", label: "Incident Reports", icon: "AlertTriangle",
              description: "Log and track safety incidents and follow-ups." },
    },
  ],
});

export const pickupAuthorizationModule = defineModule({
  id: "pickup_auth",
  label: "Pickup Authorization",
  icon: "Car",
  category: "presence_safety",
  capability: "pickup_auth.view",
  featureFlag: "PICKUP_REQUEST",
  actions: ["view", "create", "edit", "approve"],
  keywords: ["pickup", "authorization", "guardian", "collect", "approval"],
  routes: [
    {
      path: "/pickup-authorization", routeKey: "pickup-authorization",
      label: "Pickup Authorization", icon: "Car",
      grid: { section: "security", label: "Pickup Authorization", icon: "Car",
              description: "Manage the people authorised to pick up each child." },
    },
  ],
});

export const pickupHistoryModule = defineModule({
  id: "pickup_history",
  label: "Pickup History",
  icon: "History",
  category: "presence_safety",
  capability: "pickup_auth.view",
  featureFlag: "PICKUP_REQUEST",
  actions: ["view", "export"],
  keywords: ["pickup history", "collected", "past pickups", "log"],
  routes: [
    {
      path: "/pickup-history", routeKey: "pickup-history", label: "Pickup History", icon: "History",
      capability: "pickup_auth.view",
      grid: { section: "security", label: "Pickup History", icon: "History",
              description: "Review past pickup records and timings." },
    },
  ],
});

export const qrManagementModule = defineModule({
  id: "qr_management",
  label: "QR Management",
  icon: "QrCode",
  category: "presence_safety",
  capability: "pickup_auth.view",
  featureFlag: "GATE_MANAGEMENT",
  actions: ["view", "create", "manage"],
  keywords: ["qr", "code", "gate", "scan", "check-in code"],
  routes: [
    {
      path: "/qr-management", routeKey: "qr-management", label: "QR Management", icon: "QrCode",
      capability: "pickup_auth.view",
      grid: { section: "security", label: "QR Management", icon: "QrCode",
              description: "Generate and print gate check-in QR codes." },
    },
  ],
});

export const staffCheckoutModule = defineModule({
  id: "staff_checkout",
  label: "Staff Checkout",
  icon: "DoorOpen",
  category: "presence_safety",
  capability: "pickup_auth.view",
  featureFlag: "GATE_MANAGEMENT",
  actions: ["view", "mark"],
  keywords: ["staff checkout", "gate", "release", "handover"],
  routes: [
    { path: "/staff-checkout", routeKey: "staff-checkout", label: "Staff Checkout",
      capability: "pickup_auth.view" },
  ],
});

export const cctvModule = defineModule({
  id: "cctv",
  label: "CCTV",
  icon: "Video",
  category: "surveillance",
  capability: "cctv.view",
  actions: ["view", "manage"],
  keywords: ["cctv", "camera", "surveillance", "live view", "monitoring"],
  routes: [
    {
      path: "/cctv", routeKey: "cctv", label: "CCTV", icon: "Video",
      nav: [{ category: "surveillance", order: 10 }],
      grid: { section: "security", label: "CCTV", icon: "Camera",
              description: "Manage camera coverage and surveillance zones." },
    },
  ],
});

/**
 * ⚠️ Parent Check-In has NO route, despite six surfaces linking to it, and the
 * whole Families module is unrouted too. Both are recorded in
 * ../knownGaps.js — deliberately NOT given fabricated route entries here,
 * because the registry must describe the app as it actually is.
 */

export default [
  incidentsModule, pickupAuthorizationModule, pickupHistoryModule,
  qrManagementModule, staffCheckoutModule, cctvModule,
];
