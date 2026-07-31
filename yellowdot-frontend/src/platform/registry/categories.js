/**
 * categories.js — Module Registry category definitions
 * ─────────────────────────────────────────────────────────────────────
 * PLATFORM ARCHITECTURE §5 — see docs/platform-architecture/PLATFORM_ARCHITECTURE.md
 *
 * A category is the grouping unit shared by every surface:
 *   - the sidebar renders one collapsible group per category
 *   - the Care destination grid groups cards by category
 *   - Care's task filter chips are derived from categories
 *   - the accent colour is the category's visual landmark
 *
 * Accents are lifted verbatim from pages/quickNavigation/modules.js ACCENT so
 * the registry is colour-identical to the shipped Control Center grid. Per the
 * design system, these are SECONDARY/organisational colours only — primary
 * actions and focus rings still use the one KUE BOXS yellow brand accent.
 *
 * `sidebar` mirrors the current sidebarConfig.js group metadata exactly
 * (collapsible / defaultOpen / order / visibility), so navigation can later be
 * derived from this file without any behavioural change.
 */

export const CATEGORIES = [
  {
    id: "overview", label: "Overview", order: 10,
    accent: { bg: "#EFF6FF", icon: "#2563EB", border: "#BFDBFE" },
    sidebar: { collapsible: false, defaultOpen: true },
  },
  {
    id: "people", label: "People", order: 20,
    accent: { bg: "#FFFBEB", icon: "#D97706", border: "#FDE68A" },
    sidebar: { collapsible: true, defaultOpen: true },
  },
  {
    id: "staff_management", label: "Staff Management", order: 30,
    accent: { bg: "#F0F9FF", icon: "#0284C7", border: "#BAE6FD" },
    sidebar: { collapsible: true, defaultOpen: true },
  },
  {
    id: "staff_attendance", label: "Staff Attendance", order: 40,
    accent: { bg: "#F0F9FF", icon: "#0284C7", border: "#BAE6FD" },
    sidebar: { collapsible: true, defaultOpen: true },
  },
  {
    id: "staff_leave", label: "Leave Management", order: 50,
    accent: { bg: "#F0F9FF", icon: "#0284C7", border: "#BAE6FD" },
    sidebar: { collapsible: true, defaultOpen: true },
  },
  {
    id: "staff_payroll", label: "Payroll", order: 60,
    accent: { bg: "#F0F9FF", icon: "#0284C7", border: "#BAE6FD" },
    sidebar: { collapsible: true, defaultOpen: true },
  },
  {
    id: "staff_performance", label: "Performance", order: 70,
    accent: { bg: "#F0F9FF", icon: "#0284C7", border: "#BAE6FD" },
    sidebar: { collapsible: true, defaultOpen: true },
  },
  {
    id: "academics", label: "Academics", order: 80,
    accent: { bg: "#EEF2FF", icon: "#4F46E5", border: "#C7D2FE" },
    sidebar: { collapsible: true, defaultOpen: true },
  },
  {
    // Legacy Finance — rendered ONLY while the Finance Platform flag is off.
    // Sidebar.jsx's financeEnabled filter guarantees these two are never both shown.
    id: "finance", label: "Finance", order: 90,
    accent: { bg: "#F0FDF4", icon: "#16A34A", border: "#BBF7D0" },
    sidebar: { collapsible: true, defaultOpen: true, hiddenWhenFlag: "FINANCE_FOUNDATION" },
  },
  {
    // Finance Platform — labelled simply "Finance" in the UI; replaces the group above.
    id: "finance_platform", label: "Finance", order: 91,
    accent: { bg: "#F0FDF4", icon: "#16A34A", border: "#BBF7D0" },
    sidebar: { collapsible: true, defaultOpen: true, requiresFlag: "FINANCE_FOUNDATION" },
  },
  {
    id: "daily_ops", label: "Daily Ops", order: 100,
    accent: { bg: "#FFF7ED", icon: "#EA580C", border: "#FED7AA" },
    sidebar: { collapsible: true, defaultOpen: true },
  },
  {
    id: "communications", label: "Communications", order: 110,
    accent: { bg: "#FDF2F8", icon: "#DB2777", border: "#FBCFE8" },
    sidebar: { collapsible: true, defaultOpen: true },
  },
  {
    id: "child_journey", label: "Child Journey", order: 120,
    accent: { bg: "#F5F3FF", icon: "#7C3AED", border: "#DDD6FE" },
    sidebar: { collapsible: true, defaultOpen: true },
  },
  {
    // Permanently expanded — child-safety-critical. A collapsed state here
    // silently hides Incident Reports and the Gate Register with zero signal;
    // see the Gate Register visibility investigation (2026-07-14).
    id: "presence_safety", label: "Safety & Compliance", order: 130,
    accent: { bg: "#FEF2F2", icon: "#DC2626", border: "#FECACA" },
    sidebar: { collapsible: false, defaultOpen: true },
  },
  {
    id: "surveillance", label: "Surveillance", order: 140,
    accent: { bg: "#FEF2F2", icon: "#DC2626", border: "#FECACA" },
    sidebar: { collapsible: true, defaultOpen: true },
  },
  {
    id: "system", label: "System", order: 150,
    accent: { bg: "#F8FAFC", icon: "#475569", border: "#E2E8F0" },
    sidebar: { collapsible: true, defaultOpen: true },
  },
  {
    id: "super_admin", label: "Super Admin", order: 160,
    accent: { bg: "#ECFEFF", icon: "#0891B2", border: "#A5F3FC" },
    sidebar: { collapsible: true, defaultOpen: true, superAdminOnly: true },
  },
  {
    id: "developer", label: "Developer", order: 170,
    accent: { bg: "#F8FAFC", icon: "#475569", border: "#E2E8F0" },
    sidebar: { collapsible: true, defaultOpen: true, devOnly: true },
  },
];

export const CATEGORIES_BY_ID = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));
