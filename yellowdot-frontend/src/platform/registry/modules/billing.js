/**
 * billing.js — Module Registry · Billing & Payments
 * ─────────────────────────────────────────────────────────────────────
 * PLATFORM ARCHITECTURE §5 — see docs/platform-architecture/PLATFORM_ARCHITECTURE.md
 *
 * ── One routeKey, three capability tiers ──────────────────────────────────────
 * Every route here sits behind the single `billing` routeKey: reaching the
 * module at all is `billing.view`. The tiers inside it are capabilities on the
 * individual routes, not separate routeKeys, which is the same shape the
 * Certificates module uses and for the same reason — splitting the write
 * screens onto their own routeKeys would put the gate in the sidebar instead
 * of on the action, and the front desk would lose the screen it needs most.
 *
 *   billing.view    read what a family owes, and a bill (front desk and up)
 *   billing.create  record a payment received; raise an invoice
 *   billing.edit    maintain the fee catalogue (the accountant tier)
 *   billing.delete  THE REVERSAL TIER — void an invoice, credit one, reverse a
 *                   payment, read the audit trail, change the payee. Not a row
 *                   delete: nothing in this module is ever hard-deleted.
 *
 * The API enforces the same four tiers independently in routes/billingRoutes.js
 * with authorize(), so hiding a button is never the only thing standing between
 * a role and someone else's money.
 *
 * The parent-facing view (/parent-fees) is deliberately absent from here: parent
 * routes live in src/modules/parent/routes/parentRoutes.jsx, which this registry
 * does not describe, and verify-registry.mjs reads that file separately.
 */

import { defineModule } from "../defineModule.js";

export const billingModule = defineModule({
  id: "billing",
  label: "Billing & Payments",
  icon: "Wallet",
  category: "billing",
  capability: "billing.view",
  actions: ["view", "create", "edit", "delete"],
  keywords: [
    "billing", "payments", "fees", "fee", "invoice", "invoices", "receipt",
    "receipts", "outstanding", "balance", "collection", "collections", "due",
    "overdue", "upi", "cash", "cheque", "credit note", "refund", "tuition",
    "daycare fee", "transport fee", "fee plan", "fee structure", "money",
  ],
  routes: [
    {
      path: "/billing", routeKey: "billing", label: "Billing", icon: "Wallet",
      nav: [{ category: "billing", order: 10, exact: true }],
      grid: { section: "students", label: "Billing", icon: "Wallet",
              description: "Fee plans, invoices, payments and who still owes what." },
    },
    {
      path: "/billing/invoices", routeKey: "billing", label: "Invoices", icon: "Receipt",
      nav: [{
        category: "billing", order: 20,
        // A receipt is reached from an invoice, so the Invoices item stays lit
        // while one is open rather than the sidebar losing its place.
        matchPaths: ["/billing/invoices", "/billing/receipts"],
      }],
    },
    {
      path: "/billing/plans", routeKey: "billing", label: "Fee Plans", icon: "ListChecks",
      nav: [{ category: "billing", order: 30 }],
    },
    // Detail routes: reached from the list screens, so no nav entry and no
    // grid card. Both read-tier — the write affordances on them are gated by
    // capability inside the page, and again by the API.
    { path: "/billing/invoices/:invoiceId", routeKey: "billing" },
    { path: "/billing/receipts/:paymentId", routeKey: "billing" },
  ],
});

export default [billingModule];
