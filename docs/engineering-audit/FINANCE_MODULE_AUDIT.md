# KUE BOXS Care — Finance Module Audit (Phase 1: Discovery & Audit)

**Prepared for:** CTO
**Date:** 2026-07-21
**Scope:** Every finance-related frontend page/component, backend route/service, Firestore schema, permission mapping, and competitive positioning against leading preschool/daycare ERPs.
**Method:** Static repository inspection (three parallel research passes across frontend, backend, and navigation/permissions/mobile CSS, plus direct reads of the core schema/security files), cross-referenced with public feature documentation for Illumine, KinderPass, MyClassCampus, and ERPNext (Educore's own site did not surface detailed feature docs in this pass — comparisons for it are inferred from general Indian school-ERP fee-software norms and flagged as such).
**This is an audit only — no redesign, no code changes, no PRs. It is intended as the foundation document for the Finance redesign.**

---

## Executive Summary

1. **🔴 Critical security gap, independent of the redesign timeline.** `PUT`/`DELETE /api/fee-templates/:templateId` perform no tenant check at all — any authenticated staff account from *any* school can overwrite or delete another school's fee structure, because `templateId` is a guessable `TPL-${Date.now()}` value and the lookup never compares `schoolId`. Every other finance endpoint (invoices, payments, fee-template reads) is correctly tenant-scoped via a shared `resolveContext`/`scopeFinanceQuery` pattern — this one pair of routes was simply missed by the earlier hardening pass.
2. **No billing automation exists — it's scaffolding only.** `services/invoiceAutomation.js`, `services/paymentTracking.js`, `services/recurringBilling.js`, and root-level `invoiceScheduler.js` are all **empty stub files**. Every invoice today is created manually, one student at a time. This is the single largest gap versus every competitor reviewed.
3. **No single canonical Finance Dashboard.** Finance KPIs are computed independently in three places (`LiveDashboard.jsx`, `Collections.jsx`, `Analytics.jsx`) with overlapping numbers and no shared source of truth.
4. **Almost the entire Finance UI predates the KUE BOXS Design System v2.** Of 11 top-level finance pages/components, exactly one (`FeesCard.jsx`, embedded in Student Profile) uses real DS v2 components.
5. **Refunds, scholarships, and GST are effectively absent.** No refund workflow exists anywhere in the backend. Scholarships have zero references in the entire codebase. GST is a single flat amount field, not a tax engine.
6. **Payment collection is UPI-QR only, not a full gateway.** `PaymentDrawer.jsx` generates a UPI QR code from school settings — real, but there is no integrated payment gateway (Razorpay/PayU-style checkout with card/net-banking/webhook reconciliation) found anywhere in the codebase.
7. **A live route is dead-on-arrival**: `RecordPayment.jsx` (`/record-payment/:invoiceNumber`) is registered and permission-guarded, but has zero in-app navigation path to it, and its internal component is still named `function InvoiceView()` — a leftover copy-paste bug.
8. **Test coverage has a gap exactly where the bug lives.** `test/m12TenantIsolation.test.js` claims "HR/finance/admin" coverage but never actually tests invoices, payments, or fee-templates.

---

## 1. Current Finance Features & Workflows

### Staff-facing workflows

| Workflow | Entry point | Steps |
|---|---|---|
| Create a single invoice | Sidebar → Finance → Invoices → "New Invoice", or the Live Dashboard's "Generate Invoice" quick action | Two **separate, non-identical** implementations exist for this — see §6. Both: pick student → pick fee type/class → enter amount/GST/discount → set due date → save. Status is auto-computed (`Pending`/`Partial`/`Paid`/`Overdue`/`Cancelled`) from amount vs. paid vs. due date, not set manually. |
| Manage fee structures/templates | Sidebar → Finance → Invoices → Templates tab (`/invoice/templates`) | Create/edit/deactivate a reusable fee template (name, fee type, amount, billing cycle, applicable classes, an `autoGenerate` flag). **The `autoGenerate` flag is stored but nothing ever reads it** — no scheduler exists to act on it (see §6). |
| Collect a payment | From the invoice list (`Invoice.jsx`) or invoice detail (`InvoiceView.jsx`) via `PaymentDrawer`/`PaymentCollectDrawer` | Open drawer → shows a UPI QR code (pulled from school settings) or manual entry → record payment mode/transaction ID/amount → system auto-generates a sequential receipt number (`RCPT-YYYYMM-NNNN`, resets monthly per school) → invoice's `paidAmount`/`balance`/`status` recalculated from the sum of all payments against it. |
| View/print a receipt | `ReceiptView.jsx` (`/receipt/:receiptId`), linked from Invoice/InvoiceView/PaymentCollectDrawer | Print-styled detail view. **No server-generated PDF** — see §5. |
| Review collections | Sidebar → Finance → Collections (`/collections`) | KPI cards (Today/Week/Month/Academic-Year/Outstanding/Overdue), a monthly trend chart, a class-wise collection chart (including "Daycare" as one selectable class), recent-payments and outstanding-invoices tables, CSV/Excel/print export. All computed **client-side** from the full invoice/payment set — no backend aggregation endpoint. |
| Review analytics | Sidebar → Finance → Analytics (`/analytics`) | Bar + pie charts (Recharts) over invoices/payments. Overlaps heavily with Collections above — no clear separation of what each page is for. |
| Per-student ledger | Student Profile → Fees tab | The **one** finance surface built on the current Design System: 4 `KpiCard`s (Total Due/Paid/Overdue/Upcoming) + a payment-history `LineChart`, with a detailed ledger table below. |

### Parent-facing workflows

| Workflow | Entry point | Notes |
|---|---|---|
| View "My Fees" | Sidebar (parent flat menu) → Fees | Backed by `GET /api/parent/fees`, which is well-isolated — resolves the parent's own `studentId` server-side and explicitly checks ownership before allowing any `?studentId=` override. |
| Pay a fee | Same page, via the QR/manual payment flow | Parent-initiated, staff-recorded pattern (no evidence of a fully self-service parent checkout with a payment gateway callback — payments appear to be recorded by staff after collection, not automatically confirmed by a gateway webhook). |

**No workflow exists at all for:** scholarships, refunds, discount approval (beyond a flat per-invoice discount field and a separate sibling-discount modal that lives in the Family module, not Finance), recurring/subscription billing, or bulk/batch invoicing by class.

---

## 2. Database Schema & Finance-Related Models

Firestore, four collections, confirmed by direct read of `yellowdot-backend/services/invoiceService.js`. All are **document-shaped, not relational** — there is no formal schema enforcement beyond the parsing/coercion functions in this one service file.

### `invoices`
| Field | Type | Notes |
|---|---|---|
| `invoiceId` | string | Doc ID. Format `INV-${Date.now()}` — a predictable timestamp, though not exploitable here since lookups query by `schoolId`+`invoiceNumber`, not raw doc ID. |
| `invoiceNumber` | string | Human-facing, format `INV-YYYYMM-#####`. |
| `studentId`, `studentName`, `class` | string | Denormalized student info — no live reference/join to the Students collection; if a student's name/class changes later, existing invoices keep the stale copy. |
| `feeType`, `billingCycle` | string | Free-form, not validated against `feeTemplates`. |
| `durationFrom`, `durationTo`, `invoiceDate`, `dueDate` | string (`YYYY-MM-DD`) | Regex-validated on write (`parseDate`), otherwise stored as empty string. |
| `amount`, `gst`, `discount` | number | Single flat numbers, not itemized line items. `totalAmount = amount + gst - discount`, computed server-side on every write. |
| `paidAmount`, `balance` | number | `paidAmount` is recalculated as the *sum of all linked payments* every time a payment is recorded (`_recalcInvoicePaid`), not stored authoritatively on the invoice itself. |
| `status` | enum | One of `Paid`/`Pending`/`Partial`/`Overdue`/`Cancelled` — auto-computed from amount/paid/due-date via `computeStatus()`, not client-settable except for explicitly marking `Cancelled`. |
| `fatherWhatsApp`, `motherWhatsApp` | string | Present on the schema but no code path was found that actually sends a WhatsApp message using them — likely intended for a reminder feature that was never built. |
| `notes` | string | Free text. |
| `schoolId`, `centerId`/`center` | string | Tenant/branch scope — `centerId` and `center` are both written (duplicate field, minor cleanup candidate). |
| `createdAt`, `updatedAt`, `createdBy`, `updatedBy` | string (ISO) / string (userId) | Full audit trail exists at the field level, but there is no separate audit-log/history collection — an update overwrites the previous values with no versioned record of what changed. |

### `payments`
| Field | Type | Notes |
|---|---|---|
| `paymentId` | string | Doc ID, format `PAY-${Date.now()}`. |
| `receiptNumber` | string | Format `RCPT-YYYYMM-NNNN`, generated via a Firestore transaction on a `counters` doc keyed `rcpt-{schoolId}-{YYYYMM}` — genuinely safe against duplicate numbers under concurrent writes, resets every calendar month per school. |
| `invoiceNumber`, `studentId`, `studentName` | string | Links back to the invoice; no formal foreign-key enforcement (Firestore has none), so an orphaned `invoiceNumber` is possible if an invoice is later deleted. |
| `amount` | number | |
| `paymentMode` | string | Free-form, defaults to `"Cash"` if omitted — no enum validation, so values like `"cash"`/`"Cash"`/`"CASH"` could all exist simultaneously and fragment reporting. |
| `transactionId`, `bankName` | string | Present for digital payments; no gateway-transaction-status field (no `pending`/`confirmed`/`failed` state — implies payments are recorded as a fait accompli by staff, not tracked through a gateway lifecycle). |
| `paymentDate` | string | |
| `lateFeeAmount`, `discountAmt` | number | Late-fee/discount-at-time-of-payment fields exist on the schema, but there is no UI or automated rule found anywhere that populates them — likely manual entry only, if used at all. |
| `staffName` | string | Defaults to the actor's user ID if not supplied. |
| `notes` | string | |
| `schoolId`, `centerId`/`center` | string | Tenant/branch scope. |
| `createdAt`, `updatedAt`, `createdBy` | string | |

### `feeTemplates`
| Field | Type | Notes |
|---|---|---|
| `templateId` | string | Doc ID, format `TPL-${Date.now()}` — **this is the field the unpatched IDOR exploits** (see §7). |
| `templateName`, `feeType`, `description` | string | |
| `amount` | number | Single flat template amount — no per-class amount variance within one template. |
| `billingCycle` | string | Free-form (not an enum). |
| `applicableClasses` | array | |
| `autoGenerate` | boolean | **Written but never read anywhere else in the codebase** — a clear signal that recurring/automated invoice generation was designed for but never implemented. |
| `active` | boolean | Soft-delete flag; `deleteTemplate` still hard-deletes the Firestore doc though (the two mechanisms coexist, slightly inconsistent). |
| `schoolId`, `centerId` | string | |
| `createdAt`, `updatedAt`, `createdBy`, `updatedBy` | string | |

### `counters`
Shared, generic — one doc per `rcpt-{schoolId}-{YYYYMM}` key, holding just `{ seq, schoolId, period, updatedAt }`. Used exclusively by the receipt-numbering transaction; not finance-exclusive as a mechanism, but only finance code currently uses it.

**No `refunds`, `ledger`, `discounts`, or `scholarships` collections exist.** Receipts are not their own collection — a receipt is just a `receiptNumber` string field embedded in a `payments` doc.

---

## 3. APIs, Services, and Controllers

Layout note: unlike most of the backend (which uses `routes/` + `controllers/` per feature), almost every finance HTTP endpoint is defined **inline in `server.js`**, not in a dedicated route file. `routes/invoiceRoutes.js` + `controllers/invoiceController.js` exist but are empty, unmounted stubs — dead weight in the tree.

| Method | Path | Handler | Tenant-safe? |
|---|---|---|---|
| GET | `/api/invoices` | inline, `server.js:337` → `invoiceService.getAllInvoices` | ✅ |
| POST | `/api/invoices` | inline, `server.js` | ✅ |
| PUT | `/api/invoices/:invoiceNumber` | inline → `updateInvoice` | ✅ |
| DELETE | `/api/invoices/:invoiceNumber` | inline → `deleteInvoice` | ✅ |
| GET/POST | `/save-invoice`, `/invoices`, `/invoice/:invoiceNumber`, `/record-payment`, `/payments` | inline legacy shims, `server.js:396–468` | ✅ (same underlying service calls) |
| GET | `/api/payments` | inline → `getAllPayments` | ✅ |
| POST | `/api/payments` | inline → `recordPayment` | ✅ |
| GET | `/api/fee-templates` | inline → `getAllTemplates` | ✅ |
| POST | `/api/fee-templates` | inline → `createTemplate` | ✅ |
| **PUT** | **`/api/fee-templates/:templateId`** | inline → `updateTemplate` | **❌ No schoolId check at all** |
| **DELETE** | **`/api/fee-templates/:templateId`** | inline → `deleteTemplate` | **❌ No schoolId check at all** |
| GET | `/payment-receipt/:invoiceNumber` | inline, `server.js:774` | N/A — literal `501 Not Implemented` stub |
| GET | `/api/parent/fees` | `routes/parentRoutes.js:178` → `services/parentFeesService.js` | ✅ — plus explicit ownership check |

**Core service:** `services/invoiceService.js` (452 lines) — the entire finance domain's business logic lives in this one file: ID/number generation, amount/date/status parsing, invoice/payment/template CRUD, and the payment-triggered invoice recalculation (`_recalcInvoicePaid`).

**Shared middleware:** `middleware/requestScope.js` (48 lines) — three small, directly-unit-tested helpers:
- `resolveContext(req)` — pulls `schoolId` only from `req.user.schoolId` (never client input), which is what makes every *other* finance route tenant-safe.
- `scopeFinanceQuery(req, requestedStudentId)` — forces a `parent` role to only ever query their own linked child, ignoring any client-supplied `studentId`.
- `checkInvoiceOwnership(req, invoice)` — for a single fetched invoice, returns a 404 (not 403, to avoid confirming existence) if a parent tries to view another family's invoice.

**Confirmed dead/stub files** (no active routes, safe to remove, listed here for completeness — see §6 for why they matter):
`routes/invoiceRoutes.js`, `controllers/invoiceController.js`, root-level `invoiceService.js` and `invoiceScheduler.js` (both empty, shadowing the real service), `services/invoiceAutomation.js`, `services/paymentTracking.js`, `services/recurringBilling.js`, `_legacy/routes/paymentRoutes.js` + `_legacy/controllers/paymentController.js` (unauthenticated, Google-Sheets-backed, unreachable).

**Frontend service layer** (all confirmed to call real endpoints, no mock data anywhere): `services/financeService.js`, `services/invoiceService.js`, `services/paymentService.js`, `services/parentFeesService.js` (backend).

---

## 4. Current UI/UX Flow (references — no screenshots)

*Note: this audit was performed by static code inspection. The in-browser dev sandbox used for other parts of this session cannot authenticate against a live backend, and its screenshot tool is non-functional in this environment (a known, previously-documented limitation) — so this section uses route maps and code-derived flow descriptions instead of visual captures. A follow-up live walkthrough with real credentials would be the natural next step before final sign-off on the redesign brief.*

**Route map** (all under the authenticated app shell, self-rendering `<Sidebar/>` directly rather than the `<MainLayout>` wrapper most other feature areas use — an architectural inconsistency, not a bug):

```
/fees                          Fees.jsx           — per-student fee list + class filter
/collections                   Collections.jsx    — KPI/chart/export "Collection Dashboard"
/invoice                       Invoice.jsx         — invoice list/management hub (accountant's default landing page)
/invoice/new                   NewInvoice.jsx      — invoice creation flow #1
/invoice/templates             FeeTemplates.jsx    — fee structure CRUD
/invoice-view/:invoiceNumber   InvoiceView.jsx     — invoice detail/print + inline payment collection
/receipt/:receiptId            ReceiptView.jsx     — receipt detail/print
/generate-invoice              GenerateInvoice.jsx — invoice creation flow #2 (duplicate; no sidebar entry)
/record-payment/:invoiceNumber RecordPayment.jsx   — registered, but unreachable from any in-app nav (dead route)
/analytics                     Analytics.jsx       — chart-based "Financial Analytics Dashboard"
```

**Sidebar → Finance group** (4 items, all resolving correctly): Fees, Collections (reuses the Fees permission), Invoices, Analytics.

**Quick Navigation → Finance category** (3 cards, all resolving correctly): Fees, Invoices, Payments (→ `/collections`).

**Typical staff journey today** (invoice → payment → receipt): Sidebar → Invoices → find/select student's invoice → open payment drawer → record payment (QR or manual) → system generates receipt number → navigate to Receipt view to print/share. This works end-to-end, but requires manual navigation through 3–4 separate pages for what competitor products handle as a single guided flow.

**UX pattern observed across every standalone page:** dense tables, hand-rolled stat cards, no consistent page header/breadcrumb, no consistent filter bar, no consistent empty/loading states — i.e., the module still reads as "traditional ERP software," which is the exact framing the redesign brief is trying to move away from.

---

## 5. Implementation Status

| Feature | Status | Evidence |
|---|---|---|
| Invoice CRUD | ✅ Complete | Full service + routes, tenant-safe |
| Payment recording + auto-recalc | ✅ Complete | `recordPayment`/`_recalcInvoicePaid` |
| Sequential receipt numbering | ✅ Complete | Transaction-safe, monthly-per-school |
| Fee templates (create/read) | ✅ Complete | Tenant-safe |
| Fee templates (update/delete) | 🟡 Functional but insecure | No tenant check — see §7 |
| Parent fee view | ✅ Complete, well-isolated | `parentFeesService.js` |
| Collections dashboard | 🟡 Partial | Feature-rich, but client-computed, legacy-styled, no DS v2 |
| Analytics dashboard | 🟡 Partial | Real charts, overlaps with Collections, no DS v2 |
| Per-student ledger (Fees tab) | ✅ Complete | Only DS-v2-compliant finance surface |
| Email invoice delivery | 🔴 Stubbed | UI shows "coming soon" toast |
| PDF/receipt generation (server) | 🔴 Stubbed | Literal `501` response |
| Recurring/automated billing | 🔴 Not started | All related service files are empty |
| Bulk invoice generation | 🔴 Not started | No batch-by-class flow exists |
| Discounts (first-class feature) | 🔴 Not started | Ad hoc field only; sibling discount lives outside Finance |
| Scholarships | 🔴 Not started | Zero references anywhere |
| Refunds | 🔴 Not started | No route/controller/service |
| GST/tax engine | 🔴 Not started | Flat field only |
| Payment gateway (card/net-banking) | 🔴 Not started | Only UPI-QR generation found |
| WhatsApp/SMS/email reminders | 🔴 Not started | `fatherWhatsApp`/`motherWhatsApp` fields exist on invoices but nothing sends to them |
| Cheque-payment tracking | 🔴 Not started | — |

---

## 6. Technical Debt & Architectural Issues

- **Two competing invoice-creation flows** (`NewInvoice.jsx` vs. `GenerateInvoice.jsx`), styled inconsistently (one uses the app's `yd-*` token convention, the other raw arbitrary Tailwind hex values), both wired to the same `invoice` permission.
- **Two ledger implementations**, one dead: `components/finance/ParentLedger.jsx` (724 lines, more feature-complete) is not imported anywhere; `components/ParentLedger.jsx` is the one actually in use.
- **Name-shadowing risk**: `Invoice.jsx` locally redefines `StatusBadge`, `Drawer`, and `InvoiceCard` — names that collide with real, unrelated Design System v2 components. The DS v2's own `InvoiceCard` (`components/ui/InvoiceCard.jsx`) is exported from the design system's public API but used nowhere.
- **`autoGenerate` flag on fee templates is dead data** — written on every template, read by nothing. Same for `fatherWhatsApp`/`motherWhatsApp` on invoices and `lateFeeAmount`/`discountAmt` on payments — schema fields with no code path that populates or consumes them meaningfully.
- **No accounting/audit-log layer** — invoice/payment updates overwrite fields in place with only a single `updatedAt`/`updatedBy` marker, no versioned change history.
- **Client-side-only aggregation** in `Collections.jsx` (memoized, explicitly capped for 1,000+ students) — a scaling ceiling baked into the component instead of a backend aggregation endpoint.
- **Client generates its own PDFs** (`jsPDF`/`html2canvas` in `PaymentCollectDrawer.jsx` and `GenerateInvoice.jsx`) while the server's equivalent endpoint (`/payment-receipt/:invoiceNumber`) is a `501` stub — a real product inconsistency, not just a missing feature.
- **`RecordPayment.jsx` is orphaned** — registered and guarded, zero in-app nav path to it, internal component still literally named `function InvoiceView()`.
- **Dead files sitting in the tree**: two 0-byte pages (`Payments.jsx`, `Reports.jsx`), an empty unmounted route/controller pair, unauthenticated legacy Google-Sheets payment code, and duplicate empty service-file shadows at the backend repo root.
- **Architectural inconsistency**: Finance pages self-render `<Sidebar/>` instead of using `<MainLayout>` like most other feature areas.
- **No pagination/virtualization** on large lists (`Invoice.jsx`'s 1,789-line page, `Collections.jsx`'s tables).

---

## 7. Security & Permission Review

**🔴 Confirmed vulnerability**: `PUT`/`DELETE /api/fee-templates/:templateId` (`services/invoiceService.js`, `updateTemplate`/`deleteTemplate`) look up the document purely via `tplCol().doc(templateId)` — no `schoolId` comparison anywhere in either function, unlike every sibling function in the same file. Because `templateId` is generated as `TPL-${Date.now()}` (a predictable millisecond timestamp, not a random/opaque ID), an authenticated `admin`/`center_admin`/`accountant`/`super_admin`/`developer` account from a *different* school could feasibly enumerate or guess another tenant's template ID and mutate or delete it. This is the same bug class fixed for payroll/leave/performance/department/designation/role/user routes in the earlier hardening pass — fee-templates were not included in that pass.

**What's actually done well:**
- `resolveContext(req)` sources `schoolId` exclusively from the server-verified `req.user.schoolId` — never from client-supplied input — and every other finance read/write path uses it.
- `scopeFinanceQuery` hard-codes parent-role queries to the caller's own linked child, ignoring any client-supplied `studentId`.
- `checkInvoiceOwnership` returns a 404 (not 403) on a cross-family invoice access attempt, correctly avoiding confirming that the other record exists.
- Every finance route (except the two above) requires authentication and an explicit role check (`authorize(admin/center_admin/accountant/super_admin/developer[/teacher for payments])`).

**Permission mapping** (`config/permissions.js`): `admin`, `center_admin`, `center_owner`, `accountant` → full Finance access. `teacher`, `reception` → none. `parent` → `fees` only (not `invoice`/`analytics`). No Finance routeKey is left unmapped/falling through to an unintended default.

**Test coverage gap**: `test/financeAccessControl.test.js` unit-tests the `requestScope.js` helpers directly, and `test/parentFees.test.js` covers the parent-facing service — both good. But `test/m12TenantIsolation.test.js`, despite its own header comment claiming "HR/finance/admin" scope, contains **zero tests for invoices, payments, or fee-templates**. No test exists for `updateTemplate`/`deleteTemplate` at all — precisely where the live bug is.

---

## 8. Comparison with Leading Preschool ERPs

Cross-referenced against current public documentation for Illumine, KinderPass, MyClassCampus, and ERPNext's Education domain (Educore's own site did not surface detailed public feature documentation in this pass; comparisons involving it are inferred from general Indian school-fee-software conventions and flagged as such below). Full source list at the end of this document.

| Capability | Market standard | KUE BOXS Care today |
|---|---|---|
| Recurring/plan-based billing, reusable templates | Illumine, KinderPass, ERPNext | Not implemented — automation files are empty stubs |
| Bulk invoice generation (class/school-wide) | Standard on Educore-class ERPs *(inferred)* | Not implemented — one student at a time |
| Multi-program billing (different rates per activity) | Illumine | Not implemented — single flat amount per invoice |
| Pause/resume/end a billing plan | Illumine | N/A, no plans exist |
| Late-fee automation | Illumine | Field exists (`lateFeeAmount`) but nothing computes/applies it automatically |
| Payment gateway (UPI/card/net-banking) | Universal | UPI-QR generation only, no integrated gateway/checkout |
| Autopay | Illumine, KinderPass | Not implemented |
| Cheque tracking (received→deposited→cleared→bounced) | MyClassCampus | Not implemented |
| WhatsApp/SMS/email reminders | Standard *(inferred for Educore-class products)* | `fatherWhatsApp`/`motherWhatsApp` fields exist but unused; only a single notification fires at payment time |
| Named discount categories (scholarship/staff/referral) | MyClassCampus | Ad hoc discount field only; sibling discount lives outside Finance |
| Refund/credit processing | Illumine | Not implemented anywhere |
| GST-compliant receipts + tax summary export | Standard *(inferred)* | Flat `gst` field, no rate table/CGST-SGST/HSN |
| Double-entry accounting, cost centers, bank reconciliation | ERPNext | Not implemented — no accounting layer at all |
| One-click digital PDF receipt | Universal | Server stub returns `501`; client fakes it independently in two places |
| Real-time receivables/collection-efficiency reporting | ERPNext, KinderPass | Client-side recompute only, no efficiency metric |

**Bottom line**: the gap isn't visual polish, it's the complete absence of a billing-automation layer, which is the core value proposition every competitor leads with.

---

## 9. Missing Capabilities — Ranked by Business Impact

**🔴 Critical**
1. Fee-template cross-tenant IDOR fix (security, independent of redesign timing).
2. Recurring/automated billing (single largest competitive and operational gap — everything today is manual).
3. Refund workflow (currently zero — a real parent-trust and dispute-resolution gap).

**🟠 High**
4. Named discount/scholarship categories with an approval workflow.
5. Integrated payment gateway (card/net-banking) beyond UPI-QR.
6. GST-proper tax handling (rate table, CGST/SGST) — compliance exposure grows with scale.
7. Bulk invoice generation by class/cohort.
8. Server-side PDF/receipt generation (retiring the client-side `jsPDF` duplication).
9. One canonical Finance Dashboard (retiring the LiveDashboard/Collections/Analytics overlap).
10. Design System v2 migration across all standalone finance pages.

**🟡 Medium**
11. WhatsApp/SMS/email reminder automation (fields already exist on the invoice schema, unused).
12. Cheque-payment tracking workflow.
13. Backend ledger/collection-report aggregation endpoints (retiring client-side-only compute).
14. Consolidating the two duplicate invoice-creation flows.
15. Backfilling tenant-isolation test coverage for invoices/payments/fee-templates.
16. Mobile-responsive pass across Fees/Collections/Analytics/InvoiceView.
17. Basic accounting rigor (chart of accounts, cost centers) — scope grows with multi-branch usage.

**🟢 Low**
18. Multi-campus/cost-center consolidated reporting (matters once genuinely multi-branch at scale).
19. Forecasting/predictive finance analytics.
20. Custom receipt numbering per department/trust.
21. Dead-file cleanup (0-byte pages, unused DS component, legacy Google-Sheets code, empty stub services) — low risk, low effort, but should not be forgotten.

---

## 10. Recommended Roadmap

**Phase 1 — Critical fixes (can start immediately, independent of visual redesign)**
- Patch the fee-template IDOR.
- Backfill tenant-isolation tests for invoices/payments/fee-templates.
- Decide and resolve the two duplicate invoice-creation flows and the orphaned `RecordPayment.jsx` route.
- Delete confirmed-dead files.

**Phase 2 — UX modernization**
- Migrate finance pages onto Design System v2, starting with the highest-traffic surfaces (`Invoice.jsx`, `Fees.jsx`, `Collections.jsx`).
- Build one canonical Finance Dashboard.
- Full mobile-responsive pass.
- Resolve the `MainLayout`-vs-self-rendered-`Sidebar` inconsistency.

**Phase 3 — Analytics, reporting & billing automation**
- Build the recurring/automated billing engine (the biggest single item in this audit).
- Move ledger/collection-report computation to backend aggregation endpoints.
- Replace the PDF-receipt stub with real server-side generation.
- Add overdue-aging, collection-efficiency, and discount/scholarship KPIs.

**Phase 4 — Accounting depth & AI insights**
- Build the GST-compliant tax engine.
- Build discount/scholarship approval workflows and end-to-end refund processing.
- Integrate a real payment gateway (beyond UPI-QR) with autopay.
- Add forecasting/projection analytics and proactive reminder automation.

---

## Sources (competitive comparison, §8)
- [School Fee Management Software India 2026 | EduGradUP](https://schoolsoftwareindia.com/fee-management-software)
- [Fee Collection & Billing | illumine Help Center](https://help.illumine.app/en/articles/10085613-fee-collection-billing)
- [illumine's Billing System Overview](https://help.illumine.app/en/articles/10337646-illumine-s-billing-system-overview)
- [Automated Preschool & Childcare Billing System | illumine](https://illumine.app/blog/automated-preschool-and-childcare-billing-system)
- [MyClassCampus Fee Management System](https://xaviers.myclasscampus.com/home/school-coaching-fees-management-software)
- [KinderPass Features](https://kinderpass.com/features)
- [The 6-Step Guide to Seamless Child Care Billing | KinderPass](https://kinderpass.com/blog/6-step-guide-to-seamless-child-care-billing/)
- [ERPNext Fee Schedule Documentation](https://docs.erpnext.com/docs/user/manual/en/fee-schedule)
- [ERPNext for Educational Institutions Implementation Guide](https://www.ksolves.com/blog/erpnext/erpnext-for-educational-institutions)

---

*This report reflects the state of the repository at commit `d191d68` (2026-07-21). No files were modified in producing it. Supersedes the earlier draft of this same document, which used an 8-section structure; this version consolidates that material into the 10-section CTO format requested for Phase 1 of the Finance redesign.*
