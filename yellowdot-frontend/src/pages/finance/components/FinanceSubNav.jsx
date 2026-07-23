/**
 * FinanceSubNav — shared cross-page tab strip for the Finance Platform module
 * ─────────────────────────────────────────────────────────────────────────
 * The one genuinely new piece of navigation this module introduces (see
 * docs/finance-design/13_FINANCE_UI_DESIGN_SYSTEM.md §2) — everything else
 * about it is a thin composition of the existing `Tabs` component (pill
 * variant) plus this app's standard `can(routeKey)` RBAC pattern. Ties the
 * 9 independently-routed Finance screens together into one felt product;
 * each screen still has its own sidebar entry and route, this just makes
 * moving between them feel like staying inside one module.
 *
 * @prop {string} active   id of the current screen (see TABS below)
 */
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../contexts/AuthContext";
import { ROUTES } from "../../../config/permissions";
import Tabs from "../../../components/ui/Tabs";
import financePendingRefundsBadge from "../hooks/useFinancePendingRefundsBadge";

// Order mirrors the consolidated FINANCE sidebar group (sidebarConfig.js) —
// Collections and Reports are the legacy Collections.jsx/Analytics.jsx
// screens pulled in unchanged (see the consolidation note at the top of each
// file), reusing their existing routeKey so RBAC stays exactly as it was.
const TAB_DEFS = [
  { id: "dashboard",       label: "Dashboard",         path: "/finance/dashboard",       routeKey: ROUTES.FINANCE_DASHBOARD },
  { id: "ledger",          label: "Student Ledger",    path: "/finance/ledger",          routeKey: ROUTES.FINANCE_LEDGER },
  { id: "billing-plans",   label: "Billing Plans",     path: "/finance/billing-plans",   routeKey: ROUTES.FINANCE_BILLING_PLANS },
  { id: "invoices",        label: "Invoices",          path: "/finance/invoices",        routeKey: ROUTES.FINANCE_INVOICES },
  { id: "payments",        label: "Payments",          path: "/finance/payments",        routeKey: ROUTES.FINANCE_PAYMENTS },
  { id: "collections",     label: "Collections",       path: "/collections",             routeKey: ROUTES.FEES },
  { id: "family-account",  label: "Family Accounts",   path: "/finance/family-account",  routeKey: ROUTES.FINANCE_FAMILY_ACCOUNT },
  { id: "refunds",         label: "Refunds",           path: "/finance/refunds",         routeKey: ROUTES.FINANCE_REFUNDS },
  { id: "reports",         label: "Reports",           path: "/analytics",               routeKey: ROUTES.ANALYTICS },
  { id: "scheduler",       label: "Recurring Billing", path: "/finance/scheduler",       routeKey: ROUTES.FINANCE_SCHEDULER },
  { id: "settings",        label: "Settings",          path: "/finance/settings",        routeKey: ROUTES.FINANCE_SETTINGS },
  { id: "audit-log",       label: "Audit Log",         path: "/finance/audit-log",       routeKey: ROUTES.FINANCE_AUDIT },
];

export default function FinanceSubNav({ active }) {
  const navigate = useNavigate();
  const { can } = useAuth();
  const pendingRefunds = financePendingRefundsBadge();

  const tabs = TAB_DEFS
    .filter(t => can(t.routeKey))
    .map(t => ({
      id:    t.id,
      label: t.label,
      count: t.id === "refunds" && can(ROUTES.FINANCE_REFUND_APPROVAL) && pendingRefunds > 0
        ? pendingRefunds
        : undefined,
    }));

  function handleChange(id) {
    const tab = TAB_DEFS.find(t => t.id === id);
    if (tab && tab.id !== active) navigate(tab.path);
  }

  if (tabs.length === 0) return null;

  return (
    <div className="yd-finance-subnav">
      <Tabs tabs={tabs} activeTab={active} onChange={handleChange} variant="pill" />
    </div>
  );
}
