/**
 * FinanceNav.jsx — the finance module's three screens.
 *
 * Three tabs, matching the three collections behind them. The previous
 * module had a twelve-tab strip duplicated by twelve sidebar entries; this
 * is the whole navigation surface now.
 */

import { NavLink } from "react-router-dom";

const TABS = [
  { to: "/finance",          label: "Fees",     end: true },
  { to: "/finance/invoices", label: "Invoices" },
  { to: "/finance/payments", label: "Payments" },
];

export default function FinanceNav() {
  return (
    <div style={{ display: "flex", gap: 4, marginBottom: 18, borderBottom: "1px solid var(--yd-border)" }}>
      {TABS.map(t => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          style={({ isActive }) => ({
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: 700,
            textDecoration: "none",
            color: isActive ? "var(--yd-charcoal)" : "var(--yd-text-3)",
            borderBottom: `2px solid ${isActive ? "var(--yd-yellow)" : "transparent"}`,
            marginBottom: -1,
          })}
        >
          {t.label}
        </NavLink>
      ))}
    </div>
  );
}
