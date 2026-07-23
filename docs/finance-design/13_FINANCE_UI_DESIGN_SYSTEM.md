# KUE BOXS Care — Finance Platform
## Finance UI Design System

**Date:** 2026-07-23
**Status:** Proposed — implementation must not begin until this is approved, per explicit instruction.
**Depends on:** the frozen Finance Platform backend (`04_SERVICE_CONTRACTS.md`, `06_FINANCE_EVENT_CONTRACT.md`, ADR-0001/0002) and the existing **KUE BOXS Design System v2** (`KUE_BOXS_DESIGN_SYSTEM.md`, `KUE_BOXS_LAYOUT_STANDARD.md`, repo root) — this document does not invent a new visual language, it specifies how the 9 Finance screens compose the *existing* one, so the module reads as one product built by one team, not 9 independently-styled pages.

**Grounding note:** every component named below was read directly from `yellowdot-frontend/src/components/ui/` and `styles/tokens.css` before being prescribed here — nothing in this doc is aspirational or invented. Where a genuine gap exists (a status string the shared `StatusBadge` doesn't know yet, for instance), it's called out explicitly as an **additive extension**, never a fork.

---

## 1. Guiding rule

**One rule governs every decision below: if a DS v2 component already does the job, reuse it exactly as-is. Only add something new where a genuine Finance-specific need has no existing analog** (a sub-navigation strip across 9 related screens is the one clear case; there is no precedent for it elsewhere in the app, so it's a small, new, shared primitive rather than a per-page reinvention).

Reference skeleton for every screen (the same skeleton `StaffDirectory.jsx` already uses):

```
PageShell
 ├─ header:  PageHeader (title, breadcrumb, primary action)
 ├─ kpis:    KpiRow (optional — Dashboard, Ledger, Family Account only)
 ├─ filters: FilterBar   — OR — DataTable's own built-in toolbar (never both)
 ├─ children: DataTable  — OR — a form (FormSection/Field/FormGrid) for Settings
 └─ panel:   Drawer      — for detail views, record/allocate forms, refund requests
```

---

## 2. Navigation

**No new sidebar pattern.** Each of the 9 screens gets its own `sidebarConfig.js` entry and its own `routeKey`, exactly like every other module (Staff, Students) — there is no precedent anywhere in this app for a single mega-page hosting sub-modules, and inventing one here would make Finance the one inconsistent module.

**What is new, and genuinely needed:** a shared `FinanceSubNav` component — a horizontal pill-tab strip (Dashboard · Ledger · Billing Plans · Invoices · Payments · Family Account · Refunds · Settings · Audit Log) rendered as the first thing inside every Finance page's `PageHeader` area. This is what makes 9 separate routes *feel* like one product instead of 9 unrelated pages reached only via the sidebar — the same problem `ViewSwitcher` solved for view-mode consistency, applied to cross-page identity instead.

- RBAC-aware: each tab checks `can(routeKey)` and hides itself if the current user can't reach that screen (identical pattern to `ModuleCard` in Control Center).
- The Refunds tab additionally reflects whether the user has `finance-refund-approval` (a small "Approvals" badge/count appears only for approvers — see §6).
- Active tab uses the Finance accent color (§10), matching how Control Center already colors each category.
- Lives at `src/pages/finance/components/FinanceSubNav.jsx`, imported by all 9 pages — one file to update if a screen is ever added/renamed/reordered.

## 3. Page layout

Every screen is `PageShell` with the slot order in §1. Concretely:

| Screen | header | kpis | filters | children | panel |
|---|---|---|---|---|---|
| Dashboard | title + refresh | ✅ 6 KPI cards | — | Recent Payments / Recent Invoices (two `DataTable`s or a 2-col grid) | — |
| Student Ledger | title + student/family picker | ✅ Current Balance | ✅ (Date/Type/Student/Family) | `DataTable` — ledger history | — |
| Billing Plans | title + primary "Create Plan" | — | DataTable toolbar | `DataTable` | Drawer — create/edit plan |
| Invoices | title + primary "Generate Invoice" | — | DataTable toolbar | `DataTable` | Drawer — invoice detail / generate form |
| Payments | title + primary "Record Payment" | — | DataTable toolbar | `DataTable` | Drawer — record / allocate / receipt |
| Family Account | title + family picker | ✅ Credit / Outstanding | — | `DataTable` — linked students + payment history | Drawer — apply credit |
| Refunds | title | — | DataTable toolbar (tab: Requests / History) | `DataTable` | Drawer — request / approve / reject |
| Settings | title | — | — | `FormSection`/`FormGrid` (no table) | — |
| Audit Log | title | — | ✅ (User/Student/Family/Entity/Date/Action) | `DataTable` | Drawer — entry detail (read-only) |

`--yd-content-max: 1120px` (existing token) bounds every page's max width, matching every other module — Finance does not get a wider canvas than Students/Staff.

## 4. Summary cards (KPIs)

Reuse `KpiCard`/`KpiRow` from `./Charts` exactly as `LiveDashboard.jsx`/Control Center already do — no new KPI component.

**Finance Dashboard** (6 cards, 3-up desktop / 2-up tablet / 1-up mobile, matching `KpiRow`'s existing responsive behavior):
1. Outstanding Receivables — `trend` = vs. last month, `icon` = Wallet
2. Collected Today — `icon` = TrendingUp
3. Collected This Month — `comparison` vs. last month
4. Overdue Invoices — count + amount in `trendLabel`, `icon` = AlertTriangle, uses `--yd-danger` accent when > 0
5. Pending Refund Approvals — only rendered/counted for users with `finance-refund-approval`; `icon` = Undo2
6. Family Credits (total outstanding credit balance across families) — `icon` = PiggyBank

**Student Ledger** (1 large card, not a row): Current Balance, using `KpiCard`'s `size="lg"` if supported, else the same card at full width — color-coded: `--yd-danger` text if balance > 0 (owed), `--yd-success` if ≤ 0 (credit/settled). This is the one place a KPI card's color deviates from its usual "good news is green" default, because a positive ledger balance means money is *owed*, not earned — documented here so it's an intentional read, not a copy-paste mistake.

**Family Account** (2 cards): Credit Balance, Outstanding Amount — same color-coding logic as above.

All KPI data must come from real aggregation of already-fetched data (client-side reduction over `GET /api/finance/payments`, `/ledgers`, `/refunds`, etc. — see `financeApi.js`) or a lightweight new aggregate — **never hardcoded/sample values**. If a KPI has no cheap real source (e.g., "Collected Today" requires filtering the payments list by date client-side, which is fine at pilot-school data volumes), compute it client-side and say so in code comments; do not invent a fake number the way `LiveDashboard`'s "Staff Present" placeholder had to (documented gap in that page, not a pattern to repeat).

## 5. Data tables

Every list screen uses `DataTable` exactly as `StaffDirectory.jsx` does — search, filter, sort, export, pagination all come from its built-in toolbar. Nothing bespoke.

Fixed conventions across all 6 Finance tables (Billing Plans, Invoices, Payments, Refunds, Audit Log, and the ledger-history table):
- `tableId` is unique per screen (`finance-ledger`, `finance-billing-plans`, `finance-invoices`, `finance-payments`, `finance-refunds`, `finance-audit`) — this is the DataTable's column-prefs/localStorage key, must not collide with any existing `tableId` in the app.
- `entityLabel` set to the plural noun ("ledger entries", "billing plans", "invoices", "payments", "refunds", "audit entries") — feeds DataTable's own empty/count copy.
- `exportFormats={["csv", "excel", "print"]}` on every screen except Audit Log, which is `["csv"]` only — an audit trail export as a formatted "print" document invites misrepresentation of raw log data; CSV-only keeps it strictly a data export.
- Money columns render right-aligned with `font-variant-numeric: tabular-nums` and the ₹ symbol (matching `FeesCard.jsx`'s existing convention) — never a raw unformatted number.
- Every row that represents an immutable financial fact (Ledger Entry, a Payment once Recorded, any Audit entry) has **no edit and no delete row-action**, ever — only "View" and, where applicable, a single explicit domain action (Reverse, Refund, Allocate) that itself creates a new record rather than mutating the old one. This isn't a UI style choice, it's a direct reflection of the backend's append-only guarantee (`ledgerEntries` Firestore rule: `allow update, delete: if false`) — the UI must never visually imply an edit is possible where the backend has none.

For the Ledger History table specifically, entry `type` renders via the extended `StatusBadge` (see §6) rather than plain text, so a scanning eye can tell a charge from a payment from a refund at a glance — mirroring how `StaffDirectory` uses `StatusBadge` for employment status.

## 6. Status badges

Reuse `StatusBadge` exactly — **do not** build a Finance-specific badge component. `STATUS_LABEL_GROUP` in `components/ui/StatusBadge.jsx` already covers `Paid/Pending/Partial/Overdue/Cancelled/Completed` (invoice-shaped statuses) for free.

**Additive entries needed** (new status strings the backend actually returns that the dictionary doesn't know yet — a one-time, backward-compatible dictionary extension, same class of change as when `Completed` was added for Staff):

| New status string | Where it comes from | Proposed group |
|---|---|---|
| `Draft`, `Active`, `Paused`, `Ended` | Billing Plan status | neutral / success / warning / neutral |
| `Recorded`, `Allocated`, `PartiallyAllocated`, `Refunded`, `PartiallyRefunded`, `Reversed` | Payment state machine (`financePaymentStateMachine.js`) | info / success / warning / danger / warning / danger |
| `Requested`, `Approved`, `Rejected`, `Processed` | Refund status | warning / success (reuse existing `approved`→success) / danger (reuse existing `rejected`→danger) / success |
| `charge`, `payment`, `discount`, `scholarship`, `adjustment`, `refund`, `lateFee`, `creditApplied` | Ledger Entry `type` (lowercase, distinct from the *status*-shaped values above) | danger (money owed increases) for `charge`/`lateFee`/`refund`; success (money owed decreases) for `payment`/`discount`/`scholarship`/`creditApplied`; neutral for `adjustment` (sign varies) |

This mapping is a direct visual encoding of ADR-0002's own sign convention (§ledger entry `FIXED_SIGN`) — entries that *increase* what's owed get the "attention" color family, entries that *decrease* it get the "resolved" family, which is more meaningful to a staff member scanning a ledger than an arbitrary color choice would be.

## 7. Buttons

Reuse `Button` exactly (`variant`/`size`/`leftIcon` props, already used everywhere). Finance-specific convention, not a new component:
- Exactly one `primary` (solid, saturated) action per page, placed in `PageHeader`'s `primaryAction` slot — "Create Billing Plan", "Generate Invoice", "Record Payment", "Request Refund". Every other action is `outline` or `ghost`, matching the "one primary action wins attention" rule already established for Gate Register.
- Destructive/high-consequence actions (Reverse Payment, Reject Refund, End Billing Plan) use `variant="danger"` if it exists in `Button.jsx`'s variant set (verify at build time — if absent, add it once as a shared `Button` variant, not a one-off inline-styled button) and always sit behind a confirmation `Modal`, never fire on a single click.
- The refund **Approve** action is only ever rendered for users where `can("finance-refund-approval")` is true — never rendered-but-disabled for others, matching the platform's existing hide-don't-reveal RBAC convention (same as how Finance routes 404 rather than 403 when the flag is off).

## 8. Filters

Reuse `FilterBar` for the two screens not built on `DataTable`'s own toolbar (Student Ledger, Audit Log — both need cross-entity filters — Date/Type/Student/Family, and User/Student/Family/Entity/Date/Action respectively — that go beyond a single-table column filter). Every other list screen (Billing Plans, Invoices, Payments, Refunds) uses `DataTable`'s built-in toolbar filters exclusively — per `FilterBar`'s own header comment, the two must never be stacked on one page.

Date-range filters everywhere use `FilterBar`'s existing `type: "dateRange"` filter shape — no new date-picker component.

## 9. Search

`DataTable`'s built-in search (backed by `SearchBar` internally) on every table screen. `FilterBar`'s `search`/`onSearch` prop on Ledger/Audit Log. No Finance-specific search behavior — deliberately not integrated into the global Control Center "Students/Parents/Staff search coming soon" placeholder groups, since that's out of this module's scope.

## 10. Forms

`FormSection` / `Field` / `FormGrid` for every form (Create/Edit Billing Plan, Record Payment, Request Refund, Finance Settings). No bespoke `<form>` markup anywhere — this is what made Staff/Students forms consistent and Finance should match.

- Money inputs: plain `Input` with `type="number"`, `inputMode="decimal"`, a ₹ prefix glyph (matching whatever prefix convention `Input.jsx` already supports — reuse, don't invent a new "money input" component for a first pass).
- Enum fields (billing cadence, joining-date policy, payment mode, entry type) use `Select` with the exact literal values the backend expects (`monthly|termly|oneTime`, `fullMonth|prorated|nextCycle`, `Cash|UPI|BankTransfer|Cheque|Card|Other` — note `BankTransfer` has no space in the wire value, though its displayed label is "Bank Transfer") — client and server enums must match byte-for-byte since the backend does not coerce. Caught during demo-data seeding: the seed script initially sent `"Bank Transfer"` and was correctly rejected by `financePaymentService.js`'s validation.
- Multi-step flows (Record Payment → Allocate → Receipt is naturally 3 steps) are the one clear candidate for `Wizard` — reuse it rather than building a bespoke stepper, matching its existing use elsewhere.

## 11. Dialogs

- `Modal` for confirmations only (Reverse Payment, End Billing Plan, Reject Refund) — short, single-decision, no scrolling content.
- `Drawer` for everything else that isn't a full page (Create/Edit Billing Plan, Record Payment, Allocate Payment, Invoice detail, Refund request/approve, Ledger entry detail, Audit entry detail) — per the existing Design System's own standing rule that Drawer is the platform's Side Panel standard, not Modal, for anything with real form content or detail to show.

## 12. Empty states

Reuse `EmptyState` exactly, one per table/list, with Finance-specific but honest copy (not generic "No records found" everywhere):

| Screen | title | description | action |
|---|---|---|---|
| Ledger (new student, no entries yet) | "No ledger entries yet" | "Charges will appear here once a billing plan generates an invoice." | — (no action; nothing to create directly on a ledger) |
| Billing Plans (none for this student) | "No billing plans yet" | "Create one to start generating invoices for this student." | "Create Billing Plan" |
| Invoices (none generated) | "No invoices generated yet" | "Generate one from an active billing plan." | "Generate Invoice" |
| Payments (none recorded) | "No payments recorded yet" | "Record the family's first payment to begin." | "Record Payment" |
| Refunds (none requested) | "No refund requests" | "Refund requests will appear here once submitted." | — |
| Audit Log (no matches) | uses `variant="filtered"` when filters are active, `variant="default"` otherwise | — | — |

`variant="filtered"` (already built into `EmptyState`) is used whenever a search/filter is active and returns zero rows, everywhere — never the "first-time" empty copy in that case, since that would misleadingly suggest the whole dataset is empty.

## 13. Loading states

- Full-page initial load: `LoadingPage` (already used app-wide).
- Table loading: `DataTable`'s own `loading` prop → renders `SkeletonTable` internally — never a spinner-over-table.
- KPI row loading: each `KpiCard`'s own `loading` prop (already supported) — cards skeleton individually rather than the whole row being replaced, so cards that resolve first can appear first.
- Drawer/form submit loading: `Button`'s own busy/disabled state (existing pattern) — never a full-page overlay for a single-record save.

## 14. Error states

- Full-page fetch failure: `PageError` (from `LoadingPage.jsx`) with a retry action.
- Row-level/action failure (a payment record fails to save, an allocation fails): `useToast()` error toast — matches how every other module in this app already surfaces action-level failures, not a new error-banner component.
- Backend error codes that are *meaningful to a staff member*, not just "something went wrong" — map specific known codes to specific copy:
  - `REQUIRES_APPROVAL` (invoice generation blocked by discount threshold) → "This invoice needs manager approval before it can be generated" (not a generic failure).
  - Refund `finance-refund-approval` 403 → shouldn't be reachable in the first place (§7), but if hit, "You don't have permission to approve refunds" rather than a raw 403 message.
  - Any `NOT_FOUND`/tenant-isolation `null` response → treated as "not found", never as a distinguishable error (matches the backend's own hide-don't-reveal convention — the UI must not accidentally leak "this exists but you can't see it" through a different error message than a genuine 404).

## 15. Colors

**No new palette.** Every color is one of the existing `tokens.css` semantic groups (`--yd-success/-soft/-border`, `--yd-warning/…`, `--yd-danger/…`, `--yd-info/…`, `--yd-neutral/…`) plus `--yd-yellow*` for brand accents — identical to what `StatusBadge`/`KpiCard` already draw from.

**Finance module accent**: reuse the **green already assigned to the "Finance" category in Control Center** (`ACCENT.finance` in `pages/quickNavigation/modules.js`, `#16A34A`) as the one consistent accent for `FinanceSubNav`'s active-tab state, the Finance sidebar group's icon color, and any Finance-specific chart/sparkline default color. Introducing a *second*, different "Finance blue" or similar just for these 9 screens would contradict the one place the app currently has a Finance identity already — reuse it rather than compete with it.

Semantic (success/warning/danger/info) stays semantic everywhere — a payment status is never colored using the Finance accent, only using the true status-family color, exactly as `StatusBadge` already enforces app-wide.

## 16. Icons

`lucide-react` throughout (the app's one icon library since the P1.4 global migration — no other icon source anywhere). Proposed set, chosen to be immediately recognizable and not already overloaded elsewhere in the sidebar:

| Screen/concept | Icon |
|---|---|
| Finance Dashboard | `LayoutDashboard` |
| Student Ledger | `BookOpen` |
| Billing Plans | `Repeat` |
| Invoices | `FileText` |
| Payments | `Wallet` |
| Family Account | `Users` |
| Refunds | `Undo2` |
| Finance Settings | `Settings2` |
| Audit Log | `ScrollText` |
| Outstanding/owed (semantic) | `AlertCircle` |
| Credit/available (semantic) | `PiggyBank` |

## 17. Responsive behavior

Same breakpoint ladder the rest of the app already standardized on (Control Center's explicit 1/2/4/5-column ladder; `KpiRow`'s own existing responsive stacking; `DataTable`'s existing mobile card-collapse behavior, if built — verify during implementation and reuse it rather than hand-rolling a Finance-specific mobile table view). `FinanceSubNav` collapses to a horizontally-scrollable pill strip (no wrap, no hidden overflow menu) below the tablet breakpoint, matching how `Tabs.jsx` already handles overflow elsewhere in the app if that behavior exists there — reuse `Tabs.jsx`'s scroll mechanics rather than reimplementing them if it already solves this.

---

## 18. What this document deliberately does not do

- It does not redesign or re-theme any existing DS v2 component. Every extension listed (StatusBadge dictionary entries, a possible `Button` danger variant if missing) is additive and backward-compatible — no existing caller's rendering changes.
- It does not propose new backend endpoints beyond the one already-flagged gap (Audit Log has no REST route yet — a thin wrapper over the existing read-only service, tracked separately, not a design decision this document needs to make).
- It does not decide implementation order — that's a separate, purely mechanical concern once this is approved (dependencies are obvious: the shared `financeApi.js` client and `FinanceSubNav` come first since every screen needs both; the 9 screens themselves have no hard ordering dependency on each other).

---

## Approval

This document should be reviewed and approved before any Finance UI code is written, per instruction. Once approved, implementation proceeds as a single feature branch (`feature/finance-platform-ui`) covering all 9 screens plus the shared foundation (API client, RBAC keys, sidebar entries, `FinanceSubNav`), with one integration test pass, one verification report, and one deployment at the end — no partial merges, feature flag remains disabled throughout and after.
