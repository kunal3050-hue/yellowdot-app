/**
 * finance.js — Module Registry: legacy Finance + the Finance Platform
 * PLATFORM ARCHITECTURE §5
 *
 * ⚠️ These two groups are MUTUALLY EXCLUSIVE at runtime. Sidebar.jsx's
 * financeEnabled filter shows the legacy "finance" category only while the
 * Finance Platform flag is off, and "finance_platform" only while it is on —
 * never both (the nav-consolidation requirement, commit e580474). The registry
 * records both and defers the choice to the flag, exactly as today.
 *
 * ⚠️ KNOWN GAP — PLATFORM_ARCHITECTURE §0.3 gap 2. The eleven finance-platform
 * routeKeys appear in NO rbacConfig PERMISSION_CATEGORIES module and in NO
 * MODULE_ROUTE_MAP entry, so a school cannot restrict Finance per-role through
 * the Roles UI at all; access survives only via the STATIC_ROLE_PERMS baseline
 * union in roleService.js. The `finance.*` capabilities below are therefore
 * ASPIRATIONAL — they name what the Roles UI must gain in §12 Phase 1. The
 * `routeKey` on each route is what actually enforces access today.
 */
import { defineModule } from "../defineModule.js";

// ── Legacy Finance ───────────────────────────────────────────────────────────

export const feesModule = defineModule({
  id: "fees",
  label: "Fees",
  icon: "CreditCard",
  category: "finance",
  capability: "fees.view",
  featureFlag: "FEES",
  actions: ["view", "create", "edit", "delete", "approve"],
  keywords: ["fees", "dues", "fee structure", "outstanding", "balance"],
  routes: [
    {
      path: "/fees", routeKey: "fees", label: "Fees", icon: "CreditCard",
      nav: [{ category: "finance", order: 10 }],
      grid: { section: "finance", label: "Fees", icon: "CreditCard",
              description: "Set fee structures and track dues by student." },
    },
    {
      path: "/collections", routeKey: "fees", label: "Collections", icon: "BarChart2",
      capability: "payments.view",
      nav: [
        { category: "finance",          order: 20, label: "Collections", icon: "BarChart2" },
        { category: "finance_platform", order: 60, label: "Collections", icon: "TrendingUp" },
      ],
      grid: { section: "finance", label: "Payments", icon: "Wallet",
              description: "Review recent payments received from parents." },
    },
    { path: "/record-payment/:invoiceNumber", routeKey: "fees", capability: "payments.create" },
  ],
});

export const invoicesModule = defineModule({
  id: "invoices",
  label: "Invoices",
  icon: "FileText",
  category: "finance",
  capability: "invoices.view",
  featureFlag: "INVOICES",
  actions: ["view", "create", "edit", "delete", "approve"],
  keywords: ["invoice", "bill", "billing", "receipt", "statement"],
  routes: [
    {
      path: "/invoice", routeKey: "invoice", label: "Invoices", icon: "FileText",
      nav: [{ category: "finance", order: 30,
              matchPaths: ["/invoice/new", "/invoice/templates", "/invoice-view"] }],
      grid: { section: "finance", label: "Invoices", icon: "FileText",
              description: "Generate invoices and record payments." },
    },
    { path: "/invoice/new",                 routeKey: "invoice", capability: "invoices.create" },
    { path: "/invoice/templates",           routeKey: "invoice", capability: "invoices.edit" },
    { path: "/invoice-view/:invoiceNumber", routeKey: "invoice" },
    { path: "/generate-invoice",            routeKey: "invoice", capability: "invoices.create" },
    { path: "/receipt/:receiptId",          routeKey: "invoice", capability: "receipts.view" },
  ],
});

// ── Finance Platform ─────────────────────────────────────────────────────────
// One module per screen, mirroring the per-screen routeKey convention in
// permissions.js (FINANCE_DASHBOARD … FINANCE_AUDIT).

const financePlatformScreen = ({ id, label, path, routeKey, icon, order, capability, keywords }) =>
  defineModule({
    id, label, icon,
    category: "finance_platform",
    capability,
    featureFlag: "FINANCE_FOUNDATION",
    actions: ["view"],
    keywords,
    routes: [
      { path, routeKey, label, icon, capability,
        nav: [{ category: "finance_platform", order }] },
    ],
  });

export const financeDashboardModule = financePlatformScreen({
  id: "finance_dashboard", label: "Dashboard", path: "/finance/dashboard",
  routeKey: "finance-dashboard", icon: "LayoutDashboard", order: 10,
  capability: "finance.view", keywords: ["finance dashboard", "revenue", "collection"],
});

export const financeLedgerModule = financePlatformScreen({
  id: "finance_ledger", label: "Student Ledger", path: "/finance/ledger",
  routeKey: "finance-ledger", icon: "BookOpen", order: 20,
  capability: "finance_ledger.view", keywords: ["ledger", "statement", "account", "transactions"],
});

export const financeBillingPlansModule = financePlatformScreen({
  id: "finance_billing_plans", label: "Billing Plans", path: "/finance/billing-plans",
  routeKey: "finance-billing-plans", icon: "Repeat", order: 30,
  capability: "finance_billing_plans.view", keywords: ["billing plan", "recurring", "subscription"],
});

export const financeInvoicesModule = financePlatformScreen({
  id: "finance_invoices", label: "Invoices", path: "/finance/invoices",
  routeKey: "finance-invoices", icon: "FileText", order: 40,
  capability: "finance_invoices.view", keywords: ["finance invoice", "bill"],
});

export const financePaymentsModule = financePlatformScreen({
  id: "finance_payments", label: "Payments", path: "/finance/payments",
  routeKey: "finance-payments", icon: "Wallet", order: 50,
  capability: "finance_payments.view", keywords: ["payment", "receipt", "collection"],
});

export const financeFamilyAccountModule = financePlatformScreen({
  id: "finance_family_account", label: "Family Accounts", path: "/finance/family-account",
  routeKey: "finance-family-account", icon: "Users", order: 70,
  capability: "finance_family_account.view", keywords: ["family account", "sibling", "household"],
});

export const financeRefundsModule = defineModule({
  id: "finance_refunds",
  label: "Refunds",
  icon: "Undo2",
  category: "finance_platform",
  capability: "finance_refunds.view",
  featureFlag: "FINANCE_FOUNDATION",
  // The one finance screen with a genuine approval action — backend enforces
  // "finance-refund-approval" separately and excludes center_admin from it.
  actions: ["view", "approve"],
  keywords: ["refund", "reversal", "credit note"],
  routes: [
    { path: "/finance/refunds", routeKey: "finance-refunds", label: "Refunds", icon: "Undo2",
      nav: [{ category: "finance_platform", order: 80 }] },
  ],
});

export const financeSchedulerModule = financePlatformScreen({
  id: "finance_scheduler", label: "Recurring Billing", path: "/finance/scheduler",
  routeKey: "finance-scheduler", icon: "Clock", order: 100,
  capability: "finance_scheduler.view", keywords: ["scheduler", "recurring billing", "automation"],
});

export const financeSettingsModule = financePlatformScreen({
  id: "finance_settings", label: "Finance Settings", path: "/finance/settings",
  routeKey: "finance-settings", icon: "Settings2", order: 110,
  capability: "finance_settings.view", keywords: ["finance settings", "fee template", "component"],
});

export const financeAuditModule = financePlatformScreen({
  id: "finance_audit", label: "Audit Log", path: "/finance/audit-log",
  routeKey: "finance-audit", icon: "ScrollText", order: 120,
  capability: "finance_audit.view", keywords: ["audit", "finance log", "history", "trail"],
});

export default [
  feesModule, invoicesModule,
  financeDashboardModule, financeLedgerModule, financeBillingPlansModule,
  financeInvoicesModule, financePaymentsModule, financeFamilyAccountModule,
  financeRefundsModule, financeSchedulerModule, financeSettingsModule, financeAuditModule,
];
