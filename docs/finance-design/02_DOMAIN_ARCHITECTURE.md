# KUE BOXS Care — Finance Domain Architecture
## Chapter 2: Engineering Blueprint (Final Design Before Coding)

**Prepared for:** CTO
**Date:** 2026-07-21
**Status:** Design only — no production code, no schema migration, no PRs. This is the engineering blueprint every Finance developer must build against; it must not need re-litigating once implementation starts.
**Precedes/depends on:** `KUE_BOXS_FINANCE_PRD.md` (vision/principles), `docs/finance-design/01_ADMISSION_ENROLLMENT_ENGINE.md` (business rules — Chapter 1), `docs/engineering-audit/FINANCE_MODULE_AUDIT.md` (current state), `SECURITY_ARCHITECTURE.md` (the platform's canonical, mandatory-read authorization source of truth — read in full before writing this chapter, per that document's own instruction), and `docs/production-ops/09_CTO_CONTEXT_V3.md` (infrastructure reality).
**Governing constraint:** reuse everything possible, extend, never rebuild. Every entity, pattern, and convention below is explicitly marked as either **extends existing** or **genuinely new** — a genuinely-new item still had to justify why nothing existing could be stretched to cover it.

---

## Part 1 — Domain Model

*Every entity below is a conceptual design, not a schema. Entities marked **(extends)** build on a collection that already exists in production; entities marked **(new)** have no existing equivalent and are justified against Chapter 1's business rules.*

### Family Account **(extends `families`)**
**Purpose:** the financial facet of the family record that already exists — the consolidating lens described in Chapter 1.
**Responsibilities:** consolidated outstanding balance, shared credit/wallet, payment-allocation preference — computed/maintained *from* the Student Ledgers beneath it, never a competing number.
**Relationships:** one per existing `families` document → many Student Ledgers.
**Ownership:** created/reused by the Admission Finance Service the instant a first (or subsequent) child is admitted — reusing the family-linking mechanism (`familyMode: none/existing/new`) that already works today.
**Lifecycle:** Created → Active (≥1 active student) → Dormant (all students archived, balance/credit history retained) — never deleted, matching the family module's own existing `active` boolean pattern rather than inventing a new status field.

### Student Ledger **(new)**
**Purpose:** the single, persistent, itemized source of truth for one student's entire financial history — the biggest structural gap identified in both prior audits (no such entity exists today; only a per-invoice `balance` field and a transient client-side computed view).
**Responsibilities:** own every Ledger Entry for the student; compute the running balance every other Finance surface reads from.
**Relationships:** one per Student (1:1); many per Family Account; has many Ledger Entries, Billing Plans, and Invoices.
**Ownership:** created automatically at Admission Confirmed by the Admission Finance Service.
**Lifecycle:** Created → Active → Frozen (during Withdrawal/Graduation settlement, to block new charges mid-settlement) → Archived (permanent, read-only).

### Ledger Entry **(new)**
**Purpose:** the atomic, immutable unit of financial truth.
**Responsibilities:** type (charge/payment/discount/scholarship/adjustment/refund), amount, the Fee Component it relates to, and a reference to whatever document caused it (invoice, payment, credit note, refund).
**Relationships:** belongs to exactly one Student Ledger.
**Ownership:** never created directly by a user — always a side effect of a higher-level action. **This mirrors and extends an already-existing platform convention**: `firestore.rules` already treats the `payments` collection as effectively immutable ("payments are generally immutable — only admins may correct," update/delete gated to `isAdmin()` alone). Ledger Entries take that same principle one step further and make it absolute: no update or delete path exists at all — a correction is always a new, offsetting entry.
**Lifecycle:** Created once, immutable forever.

### Billing Plan **(new)**
**Purpose:** the recurrence rule connecting the Fee Component catalog to an automatic, scheduled charge for one student.
**Responsibilities:** cadence (a Billing Cycle reference), attached Fee Components, start/end window, pause/resume state, joining-date/proration policy.
**Relationships:** belongs to one Student Ledger; references Fee Components; generates Invoices.
**Ownership:** created by the Admission Finance Service at admission; amendable later by staff, always producing an audit trail entry.
**Lifecycle:** Draft (under review in the Admission Finance Summary) → Active → Paused → Ended — never deleted, since a past Billing Plan explains why a past invoice looked the way it did.

### Invoice **(extends `invoices`)**
**Purpose:** the actual bill, extended from today's single flat-amount shape into a container of Invoice Lines.
**Responsibilities:** aggregate lines into a total; own its status lifecycle; support void-with-reason.
**Relationships:** belongs to one Student Ledger; generated by a Billing Plan or manually; has many Invoice Lines; settled by Payments.
**Ownership:** Billing Automation Engine (recurring) or staff (manual/one-time).
**Lifecycle:** reuses the **existing, already-correct** status enum from `services/invoiceService.js` (`Paid/Pending/Partial/Overdue/Cancelled`) rather than inventing a new one.

### Invoice Line **(new)**
**Purpose:** one itemized charge within an Invoice, tied to a specific Fee Component — the concrete fix for the audit's "single flat amount" finding, and the mechanism that lets daycare and tuition genuinely coexist on one bill.
**Responsibilities:** amount, tax treatment, line-level discount/scholarship (fixing the "discount blanket-applied to the whole invoice" gap), reference to the Billing Plan or manual reason that created it.
**Relationships:** belongs to one Invoice; references one Fee Component.
**Ownership/Lifecycle:** created with its parent Invoice; immutable once Issued — corrections go through a Credit Note against the specific line.

### Payment **(extends `payments`)**
**Purpose:** the record of money that changed hands.
**Responsibilities:** amount, method, the Family Account paid against, allocation across one or more Invoices/Student Ledgers.
**Relationships:** belongs to one Family Account (the key change from today: payments become family-scoped, not only invoice-scoped); has many Payment Allocations (a new, thin join entity between a Payment and the Invoice(s)/Ledger(s) it settles).
**Ownership:** Reception/Parent/Accountant today; a future gateway webhook later.
**Lifecycle:** Pending (gateway) → Confirmed → Allocated → Reversed (via a new offsetting Ledger Entry, never an edit — see below, and matching the existing `payments` immutability rule above).

### Receipt **(extends the existing receipt-numbering mechanism)**
**Purpose:** the parent-facing, immutable proof of payment.
**Responsibilities:** itemized breakdown; sequential numbering.
**Relationships:** one per Payment.
**Ownership/Lifecycle:** auto-generated the instant a Payment confirms. **Reuses the already-correct, transaction-safe `RCPT-YYYYMM-NNNN` counter mechanism** in `invoiceService.js` verbatim — this needs no change at all.

### Credit Note **(new)**
**Purpose:** money owed back to a family, held as credit rather than paid out — covers Chapter 1's "credit note" and "future admission credit" cancellation outcomes.
**Responsibilities:** amount, reason, expiry policy, optional conditional tie to a future re-admission event.
**Relationships:** belongs to one Family Account.
**Ownership:** created by the Lifecycle Service during settlement, or manually by an Accountant with a reason.
**Lifecycle:** Issued → Applied (fully/partially consumed) → Expired → Closed.

### Refund **(new — formalizes a workflow that today has no entity, route, or controller at all)**
**Purpose:** money actually paid back out, as opposed to held as credit.
**Responsibilities:** amount, reason, approval chain (threshold-based, per Chapter 1), method, linkage to the originating Payment/Invoice.
**Relationships:** belongs to one Family Account.
**Ownership:** requested by any authorized role, approved per configured threshold, executed by Accountant/Owner.
**Lifecycle:** Requested → Approved/Rejected → Processed → Closed. Every transition produces a Ledger Entry.

### Deposit **(new component type, not a new collection)**
**Purpose:** the Security Deposit fee category, which behaves differently from ordinary fees (refundable by default, netted at Withdrawal).
**Responsibilities:** amount, refundability status, damage/netting notes at settlement.
**Relationships:** a specifically-tagged Ledger Entry/Invoice Line, findable unambiguously by the Settlement engine.
**Lifecycle:** Held → Netted/Refunded → Closed.

### Scholarship **(new — confirmed to not exist anywhere today)**
**Purpose:** a formally governed aid program, deliberately distinct from a Discount.
**Responsibilities:** program/fund definition; per-student award tracking; approval workflow; total-value reporting.
**Relationships:** an Award references one Student Ledger and reduces specific eligible Invoice Lines.
**Ownership:** programs configured by Owner/Accountant; individual awards go through their own approval path (possibly starting from a teacher nomination, per Chapter 1).
**Lifecycle:** Program: Active/Closed. Award: Nominated/Applied → Approved → Active → Expired/Ended.

### Discount **(extends the existing sibling-discount mechanism)**
**Purpose:** routine, named, recurring reductions — sibling, staff, referral, early-bird.
**Responsibilities:** rule definitions, eligibility, approval thresholds, per-component applicability.
**Relationships:** a Discount Rule is a Finance Setting; a Discount Application is a Ledger Entry.
**Ownership:** **this is the one entity in the whole domain model with real, working precedent already in production** — the tenant-wide sibling-discount-rules settings document and its editor in `FamilyProfile.jsx`. The design here extends that exact mechanism to also cover staff/referral/early-bird types, rather than building a parallel discount system.
**Lifecycle:** Rule: Active/Inactive. Application: applied automatically at invoice time by the Billing Automation Engine, reversible by a later Ledger Entry if eligibility changes.

### Billing Cycle **(new)**
**Purpose:** the calendar/period definition a Billing Plan's recurrence anchors to.
**Responsibilities:** recurrence pattern and concrete occurrence dates, independent of any one student; can vary per fee category (daycare's continuous rhythm vs. tuition's termly one, per the PRD's core differentiator).
**Ownership:** Owner/Accountant, in Finance Settings.
**Lifecycle:** effective-dated versions, never overwritten in place — a changed cycle definition must not retroactively alter why a past invoice looked the way it did.

### Fee Component **(extends `feeTemplates`)**
**Purpose:** the catalog "menu" — formalizes what the existing `feeTemplates` collection already represents.
**Responsibilities:** category, amount/tiering, the policy dimensions from Chapter 1 (recurrence/refundability/proration/discount-eligibility/timing), applicability, effective date range.
**Ownership:** Owner/Accountant.
**Lifecycle:** Active → Superseded (a fee revision is a new effective-dated version, same principle as Billing Cycle) → Retired.

### Finance Settings **(new — but deliberately NOT modeled on the existing, flawed `settings/{section}` pattern)**
**Purpose:** the configuration layer the Rules Engine (Part 3) reads from.
**Relationships:** referenced read-only by nearly every other entity's logic.
**Ownership:** Owner/Accountant, scoped per school.
**Design note — a deliberate correction, not a repeat of existing debt:** the platform's existing `settings/{section}` collection is explicitly documented in `firestore.rules` as **not yet `schoolId`-scoped**, a known piece of technical debt tolerated only because the backend is currently its sole writer. Finance Settings must not repeat this — it should be schoolId-scoped from day one (see Part 6).
**Lifecycle:** rarely changes; every change is itself logged, since a threshold/policy change silently alters automation behavior for every family going forward.

---

## Part 2 — Event Architecture

**General principles:**
- Every event carries `schoolId` — non-negotiable, matching the platform-wide tenant model.
- Events are the *only* way modules outside Finance's own core (Collections, Reports, Parent Portal, future AI Finance/Automation) learn what happened — no other module reads Finance's internal Firestore collections directly. This is the boundary that lets the platform scale to thousands of schools without every module becoming coupled to Finance's internals.
- **Idempotency is non-negotiable for financial events specifically** — every event carries a unique, deterministic key derived from the action that caused it, so a consumer that sees the same event twice (retry, at-least-once delivery) can safely no-op the second time. Double-processing `PaymentReceived` would be a real, dangerous bug (double-crediting an account).
- **Failure isolation** — one consumer's failure never blocks the producer or any other consumer; failures retry independently with a bounded limit, then land in a dead-letter/manual-review path, so a broken downstream integration (e.g., a WhatsApp service outage) can never stop invoices from generating.

| Event | Producer | Consumers | Side Effects | Idempotency Key |
|---|---|---|---|---|
| `StudentAdmitted` | Admission Finance Service | Family Account Service, Ledger Service, Reports | Family Account created/reused; Student Ledger created | `studentId` |
| `LedgerCreated` | Ledger Service | Billing Plan Service, Reports | none beyond own creation | `studentId` |
| `BillingPlanActivated` | Billing Plan Service | Invoice Generation Service, Parent Portal, Reports | schedules next `InvoiceGenerated` | `billingPlanId` + version |
| `InvoiceGenerated` | Billing Automation Engine / staff | Ledger Service, Parent Notification Service, Collections, Reports | parent notified, ledger updated | `invoiceId`, and for recurring generation additionally `billingPlanId` + billing-period (so a scheduler retry can never double-generate one period's invoice) |
| `InvoiceCancelled` | Staff (void) / Lifecycle Service (withdrawal closure) | Ledger Service, Collections, Reports | a reversing Ledger Entry — original never deleted | `invoiceId` + cancellation timestamp |
| `PaymentReceived` | Reception/Parent/Accountant, or a future gateway webhook | Family Account Service, Receipt Service | Receipt generated immediately | gateway transaction ID, or generated `paymentId` with a duplicate-entry guard |
| `PaymentAllocated` | Payment Allocation Service | Ledger Service, Collections, Reports | settling Ledger Entries created; invoice status updates | `paymentId` (partial re-allocation of a remainder is a distinct, tracked action) |
| `RefundCreated` | Lifecycle Service / approved manual Refund | Ledger Service, Family Account Service, Parent Notification | money actually leaves the account | `refundId`, gated by its own approval state machine |
| `CreditApplied` | Credit Note Service | Ledger Service, Family Account Service | reduces the amount due on the target invoice | `creditNoteId` + target `invoiceId` |
| `StudentWithdrawn` | Lifecycle Service | Billing Plan Service, Ledger Service, Family Account Service | terminates plans, freezes ledger, kicks off Final Settlement | `studentId` + effective date |
| `StudentGraduated` | Lifecycle Service | same as above, distinct event type so tone/consumer logic can branch | same settlement mechanics, different downstream handling | `studentId` + effective date |
| `SettlementCompleted` | Lifecycle Service | Family Account Service, Reports, Parent Notification | closing statement sent | `studentId` + settlement event |
| `StudentArchived` | Lifecycle Service | Ledger Service, Reports | ledger flips read-only | `studentId` |

---

## Part 3 — Finance Rules Engine

**No hardcoded logic. Every rule below is data (Finance Settings), evaluated at defined points in the lifecycle — never a scattered `if` embedded in a service.** Rules are effective-dated: a policy change never retroactively alters a past invoice.

- **Billing Frequency** — per Billing Cycle, configurable per fee category (tuition might be termly, daycare monthly — the PRD's core differentiator, made literal here).
- **Due Date Rules** — days-after-generation or fixed day-of-month, configurable per school and per component.
- **Grace Periods** — a configurable window after due date before late-fee/reminder escalation triggers. Gates escalation only — it does not redefine "on time" for reporting purposes (Average Payment Delay still measures against the real due date).
- **Late Fees** — configurable formula (flat/percentage), configurable cap, configurable trigger timing, and — critically — a first-class "disabled" state. Many schools will choose not to charge late fees at all, per the PRD's relationship-first principle; that must be a clean configuration, not a zero-value workaround.
- **Discounts** — rule types/eligibility/component-applicability from Chapter 1, plus an approval-threshold rule (auto-apply below X%, require sign-off above).
- **Scholarships** — program definitions and award-approval configuration (who nominates, who approves, whether documentation is mandatory), per program.
- **Deposits** — refundability default, netting rule (automatic vs. requiring explicit staff review each time).
- **Refunds** — approval-threshold tiers, default processing method, tied to the Cancellation Policy defaults below.
- **Cancellation Policies** — Chapter 1's rules (registration retained, admission retained/refunded by cutoff, deposit refunded, credit note, future-admission credit) as school-level defaults, overridable per admission with mandatory reason.
- **Joining Date Policies** — Full Month / Prorated / Next Cycle as a school-wide default with per-component override and a configurable proration formula.
- **Withdrawal Policies** — exit-proration symmetry with entry-proration (default: mirrored, explicitly overridable), notice-period requirements and any shortfall fee.

Every automation touchpoint (billing generation, late-fee calculation, discount application, settlement calculation) reads Finance Settings for the applicable rule rather than embedding its own logic — this is the concrete mechanism that satisfies "no hardcoded logic," and the reason Finance Settings must be a real, schoolId-scoped, well-structured collection rather than an afterthought (see Part 1's explicit correction of the existing `settings/{section}` debt).

---

## Part 4 — Automation Engine

**Scheduling strategy.** A single, centralized scheduler evaluates every Active Billing Plan and triggers the automations below on a recurring cadence, staggered across a window rather than firing all at once (avoiding a load spike at platform scale). **This would be the first real scheduled/background-job infrastructure in the entire backend** — confirmed by direct research: `node-cron` is already an installed dependency with zero current usage anywhere in the codebase, and two files that look like a prior attempt at exactly this (`services/invoiceAutomation.js`, `services/recurringBilling.js`) exist but are dead, orphaned, and `require()`'d nowhere. **The design choice here is to revive and implement inside those existing files rather than create new ones** — this is what "reuse, extend, never rebuild" means concretely at the file level. An in-process `node-cron` scheduler is also the only choice consistent with the platform's actual infrastructure (single VPS, plain `docker run`, no queue, no Kubernetes, per the CTO Context document) — proposing new infrastructure (a message queue, a separate worker service) would itself violate the "never rebuild" instruction without a much stronger justification than this chapter provides.

- **Monthly Billing / Invoice Generation** — the highest-blast-radius automation in the whole system: for every due Billing Plan, generate Invoices + Invoice Lines, apply eligible Discounts/Scholarships per the Rules Engine, emit `InvoiceGenerated`. Must run in preview-only mode (shows what it *would* generate, without creating anything) for at least one full cycle per school before being allowed to actually create invoices — this is a rollout requirement, not an optional nicety, given how much revenue correctness rides on it.
- **Reminder Scheduling** — a separate, lower-risk job keyed off Due Date + Grace Period, reading outstanding invoices and sending reminders via the school's configured channel/cadence (WhatsApp-first).
- **Late Fee Calculation** — runs after grace-period expiry per the configured formula, appends a distinct, visible Late Fee Invoice Line — never silently inflates the original invoice.
- **Auto Receipts** — triggered directly by `PaymentReceived`, not batched — immediate, since a receipt is a trust artifact.
- **Parent Notifications** — one centralized Notification Service subscribing to Finance events, rather than every Finance service deciding independently whether/how to notify — keeps tone and channel consistent, directly serving the PRD's "design for the relationship" principle.
- **Payment Allocation** — automatic for the simple case (deterministic, oldest-due-first default), with an explicit manual-override path for complex multi-child payments per Chapter 1's Family Account design.

**Retry strategy.** Each Billing Plan's invoice generation is processed independently within a scheduler run — one malformed plan must never block or roll back any other student's plan in the same run. Failures retry with backoff up to a bounded limit, then land in a manual-review queue rather than retrying forever or failing silently.

**Error handling.** Any automation failure that could result in a *missing* financial action (an invoice that should have been generated but wasn't) must surface as a visible alert on the Finance Dashboard — silence is the worst failure mode for a billing system, since a missed invoice quietly becomes lost revenue.

**Audit logging.** Every automated action (which scheduler run, which plan, what was generated, which rule fired) is logged with enough detail to answer "why did this invoice have this amount" months later — directly required by the Ledger Entry design (every entry traces to its originating action) and mirrors the existing `_logAudit()` pattern already used by `tenantService.js` for tenant mutations.

---

## Part 5 — API Architecture

**No implementation — naming, versioning, responsibilities, and service boundaries only.**

**The Finance module is today the one real architectural outlier in the backend** — almost every other feature follows a `routes/<feature>Routes.js` → `controllers/<feature>Controller.js` → `services/<feature>Service.js` layering (confirmed via `staffRoutes.js`/`staffController.js`/`staffService.js`), but Finance's routes are defined inline in `server.js`, with `routes/invoiceRoutes.js`/`controllers/invoiceController.js` existing as unused, never-`require()`'d dead files. **This chapter's design brings Finance into line with the rest of the platform's own convention** — that *is* the "extend, don't rebuild" move here, since the target pattern already exists and is well-proven elsewhere.

**Proposed structure** (naming matches existing sibling modules exactly):
- `routes/financeAdmissionRoutes.js`, `routes/billingPlanRoutes.js`, `routes/ledgerRoutes.js`, `routes/familyAccountRoutes.js`, `routes/creditNoteRoutes.js`, `routes/refundRoutes.js`, `routes/scholarshipRoutes.js`, `routes/financeSettingsRoutes.js` — plus the *existing* `invoices`/`payments`/`feeTemplates` endpoints, relocated out of `server.js` into a proper `routes/invoiceRoutes.js`/`controllers/invoiceController.js` pair (finally using the files that already exist but sit dead).
- Each router follows the existing wiring convention verbatim: `const canManage = [authenticate, staffOnly, authorizeRoute(ROUTE_KEY)];` then `router.get/post/put/delete(path, ...canManage, ctrl.handler)`.
- Each controller follows the existing thin-HTTP-wrapper convention: a local `_ctx(req)` (or the shared `resolveContext` already used by Finance) to build `{schoolId, centerId, actorUserId}`, a shared error-mapping helper, try/catch on every handler, `checkTenantAccess`/`scopeFinanceQuery`/`checkInvoiceOwnership` (all already existing, all reused) for by-ID and parent-scoped routes.
- Each service stays a pure Firestore data-layer function set — no `req`/`res` — following the existing `docToX()` mapper, `Set`-based enum validation, atomic-counter ID generation, and soft-delete-via-status-flip conventions already established in `staffService.js`.

**Versioning.** No part of the existing backend uses a version prefix (no `/v1/` found anywhere) — introducing one for Finance alone would be a new convention, not an extension of an existing one. This chapter follows the existing platform convention (unversioned `/api/...` paths) rather than unilaterally introducing versioning; if API versioning is ever wanted platform-wide, that's a cross-cutting decision for a future, separate design, not something Finance should originate on its own.

**Naming convention** for new endpoints, matching the existing `/api/<resource>` shape: `/api/billing-plans`, `/api/ledger` (student-scoped, `?studentId=`), `/api/family-accounts/:familyId`, `/api/credit-notes`, `/api/refunds`, `/api/scholarships`, `/api/finance-settings`. Existing `/api/invoices`, `/api/payments`, `/api/fee-templates` paths are unchanged — only their *implementation location* moves out of `server.js`.

**Service boundaries.** Each service owns exactly one entity family from Part 1 and is the only code path allowed to write it — e.g., only the Ledger Service ever writes a Ledger Entry, regardless of which controller triggered it, matching the "Ledger Entry is never created directly" ownership rule from Part 1.

---

## Part 6 — Firestore Architecture

**New/extended collections** (all `schoolId`-scoped from the first field on every composite index, matching the existing convention exactly — every current composite index in `firestore.indexes.json` puts `schoolId` first):

| Collection | Extends / New | Key fields for indexing |
|---|---|---|
| `invoices` | extends | `schoolId, studentId, status, dueDate` |
| `invoiceLines` | new (subcollection of `invoices/{invoiceId}/lines` OR top-level with `invoiceId` — recommend subcollection, since lines are never queried independently of their invoice) | n/a (fetched with parent) |
| `payments` | extends | `schoolId, familyAccountId, studentId, paymentDate` |
| `feeTemplates` (Fee Components) | extends | `schoolId, active, applicableClasses` (array-contains) |
| `studentLedgers` | new | `schoolId, studentId` (unique, one per student) |
| `ledgerEntries` | new | `schoolId, studentLedgerId, createdAt` (for the Financial Timeline view); `schoolId, studentLedgerId, type` (for per-type reporting) |
| `billingPlans` | new | `schoolId, studentLedgerId, status, nextDueDate` (the scheduler's own primary query) |
| `familyAccounts` | new (financial facet of `families`, likely `families/{familyId}/financeAccount` as a subdocument rather than a new top-level collection — keeps the existing family entity as the single owner) | `schoolId, familyId` |
| `creditNotes` | new | `schoolId, familyAccountId, status, expiresAt` |
| `refunds` | new | `schoolId, familyAccountId, status` |
| `scholarshipPrograms` / `scholarshipAwards` | new | `schoolId, active` / `schoolId, studentId, status` |
| `financeSettings/{schoolId}` | new — **deliberately schoolId-as-document-ID scoped**, correcting the existing `settings/{section}` debt rather than repeating it | n/a (fetched by direct doc ID) |

**Document ownership.** Exactly one service per collection may write to it (Part 5's service-boundary rule) — this is enforced both at the application layer (only that service's functions touch the collection) and at the Firestore-rules layer (below).

**Indexes.** None exist for any finance/admission-adjacent collection today (confirmed: zero composite indexes reference `invoices`, `payments`, `feeTemplates`, `students`, or `families` in the current `firestore.indexes.json`). New composites needed, all following the existing `schoolId ASC, <field> ASC/DESC` shape: `ledgerEntries(schoolId, studentLedgerId, createdAt DESC)`, `billingPlans(schoolId, status, nextDueDate ASC)` (the scheduler's core query), `invoices(schoolId, studentId, status)`, `payments(schoolId, familyAccountId, paymentDate DESC)`, `refunds(schoolId, status)`.

**Relationships.** Modeled as reference fields (`studentLedgerId`, `familyAccountId`, `invoiceId`) rather than nested documents, matching the existing platform-wide pattern (e.g. `payments.invoiceNumber` referencing `invoices`) — Firestore has no native foreign keys, so referential integrity is enforced at the service layer, exactly as it already is for every existing relationship in this codebase.

**Scalability.** The `ledgerEntries` collection is the one most likely to grow large per school over years of operation — the `schoolId, studentLedgerId, createdAt` composite makes the per-student Financial Timeline query cheap regardless of total collection size; the reporting layer (Part 8) must never do a full-collection scan for aggregate numbers.

**Security (Firestore rules).** Follows the existing `sameSchool()`/`writingSameSchool()`/role-predicate idiom exactly. Two specific, deliberate rules based directly on existing precedent:
- `ledgerEntries`: **no client update or delete rule at all** (`allow update, delete: if false`) — only server-side (Admin SDK, which Firestore rules don't gate) may write them, extending the *exact* precedent `payments` already sets ("payments are generally immutable — only admins may correct"), taken to its logical conclusion for the ledger.
- A **discrepancy in the existing rules is surfaced here and must be fixed as part of this work, not carried forward**: the current `isFinance()` predicate (`developer, super_admin, admin, accountant`) does not include `center_owner`/`center_admin`, even though `permissionsBackend.js` already grants those roles the `fees`/`invoice` route keys. Every new Finance collection's rules should use a corrected predicate that matches the backend's actual permission grants — and the existing `invoices`/`payments`/`feeTemplates` rules should be corrected in the same pass, since the mismatch already exists there today.

**Multi-tenant isolation.** Every new collection carries `schoolId` as a first-class field (never inferred), and every by-ID route follows the platform's `checkTenantAccess()` pattern (see Part 7) rather than a bespoke check — reusing, not reinventing, the one mechanism the rest of the platform already relies on.

---

## Part 7 — Security

*This section is built directly against `SECURITY_ARCHITECTURE.md`'s Tenant Security Baseline and its "how to secure a new module" checklist — not a parallel security model. Every new Finance route must satisfy the same five baseline rules and pass the same ten-point checklist already required of every other module on the platform.*

**Reused, not reinvented:**
- `middleware/requestScope.js`'s `resolveContext`, `scopeFinanceQuery`, `checkInvoiceOwnership` — already the canonical Finance-scoping pattern (documented in `SECURITY_ARCHITECTURE.md` §10 as the "Billing security model") — apply verbatim to every new Finance route (Ledger, Family Account, Billing Plan, Credit Note, Refund, Scholarship), not just the existing invoice/payment ones.
- `middleware/tenantRecordAccess.js`'s `checkTenantAccess(req, record)` for every new by-ID endpoint.
- The existing 404-for-cross-tenant / 403-for-same-tenant-ownership-violation convention, applied without exception to Family Account and Ledger access.
- The `_stripImmutable()` pattern (`communicationService.js`) for every update handler — a Billing Plan or Finance Settings update must strip `schoolId` from the client-supplied body before merging, exactly as every other module's update handlers already must.

**New, specific to Finance's domain:**
- **The fee-template IDOR must be fixed as a prerequisite, framed by the platform's own stated logic, not just as a Finance-specific bug.** `SECURITY_ARCHITECTURE.md` §3 explicitly accepts that student IDs are shared/guessable across tenants *because* the tenant check makes ID-guessing irrelevant to authorization. The fee-template `PUT`/`DELETE` endpoints are exactly the case where that compensating tenant check is missing — by the platform's own stated standard, this is a live violation of baseline rule 1, not a stylistic gap, and should be the first Finance security fix made, independent of anything else in this chapter.
- **The `isFinance()` Firestore-rule discrepancy (Part 6) must be corrected in the same pass** that adds new Finance collection rules — otherwise the new collections would inherit a role gate inconsistent with the backend's own permission grants.
- **Ledger Entries need a stronger-than-usual immutability guarantee** — no application code path may ever update or delete one; corrections are always a new offsetting entry. This should be enforced at both the service layer (no `update`/`delete` function exported for Ledger Entries at all — literally does not exist as a callable operation) and the Firestore-rules layer (Part 6).
- **Family Account access needs an ownership check equivalent to `checkInvoiceOwnership`, extended to the family level** — a parent must be verifiable as belonging to the Family Account, not just to one linked student, before the consolidated view (Part 4 of Chapter 1) can be shown safely. This directly depends on Chapter 1's flagged prerequisite: parent resolution must become family-aware (it is purely per-student via email match today).
- **Refund and Credit Note approval must reuse the `ASSIGNABLE_ROLES`-style capping pattern** already established for role assignment (`userService.js`) — a threshold-based approval chain must validate the approver's authority server-side against their actual role/permission, never trust a client assertion that "an owner approved this."

**Every new Finance endpoint must pass the existing 10-point module-security checklist verbatim** (router-level role gate → by-ID tenant check before any operation → server-derived `schoolId` only → 404/403 convention → schoolId-filtered list queries → the full test matrix (same-tenant allowed, cross-tenant blocked, parent-own-record allowed, parent-other-record blocked, unauthenticated blocked, and a mock-service test proving a blocked cross-tenant target never reaches the service layer) → live verification across at least two tenants before considering any milestone done → role-field capping wherever applicable → `_stripImmutable()` on every update handler → a bespoke existence-check for the rare collection with no `schoolId` field of its own). This is not a new checklist for Finance — it is the existing one, applied without exception.

---

## Part 8 — Performance

**Query strategy.** Every list/aggregate query filters by `schoolId` first (Part 6's indexing), directly addressing the audit's finding that `Collections.jsx` recomputes everything client-side with an explicit scaling cap at 1,000+ students — the new architecture moves that aggregation to the backend and to precomputed values (below), removing the ceiling entirely.

**Aggregation.** Family Account balances and Finance Dashboard KPIs should be **incrementally maintained**, not recomputed from scratch on every read: each Ledger Entry write updates a small set of denormalized summary fields (on the Family Account and a per-school daily/monthly rollup) at write time, so a dashboard load is a handful of direct document reads, not a full scan-and-sum over every invoice and payment a school has ever had.

**Caching.** Finance Settings and Rules Engine configuration are read constantly (every invoice generation, every discount check) but change rarely — this is exactly the shape the platform already caches elsewhere (`tenantMiddleware.js`'s 60-second in-memory tenant cache, `roleService.js`'s 60-second permission-matrix cache). Finance Settings should use the same short-TTL in-process cache pattern, not a new caching mechanism.

**Background jobs.** The billing scheduler (Part 4) is the platform's first, so it must be designed conservatively: staggered execution across schools (never all at once), each school's run isolated from every other's failure, and its own dedicated audit log — since there is no existing operational experience running anything like it on this infrastructure to fall back on.

**Pagination.** `Invoice.jsx`'s current 1,789-line, full-list-rendering pattern has no pagination or virtualization — any new invoice/ledger list view must paginate server-side from the start (cursor-based, using the `createdAt`/`dueDate` composite indexes from Part 6), not repeat the existing pattern at greater scale.

**Reporting strategy.** Collection reports, aging reports, and GST summaries should read from the same incrementally-maintained rollups that power the Dashboard (above), with on-demand recomputation reserved for genuinely ad hoc, one-off report requests — never the default path for a report an owner opens daily.

---

## Part 9 — Migration

*Expands Chapter 1's migration strategy with concrete scope.*

**Existing schools.** Every currently-active school continues operating unaffected until its own migration step completes — no forced, simultaneous cutover across the platform.

**Existing invoices.** Represented, without rewriting, as a Student Ledger with exactly one Invoice Line per historical invoice (the single flat `amount`/`gst`/`discount` becomes one line) — the reconstruction is additive and read-based; the original `invoices` documents are never altered.

**Existing payments.** Similarly reconstructed into Ledger Entries and, retroactively, associated with the correct Family Account (derived from the student's existing family link) — again additive, never a rewrite of the original `payments` documents.

**Existing families.** The `families` collection itself needs no structural change — the Family Account is a financial facet layered onto the existing document (Part 1), so existing family records simply gain this facet the first time any of their students is migrated.

**Rollback.** Because every migration step is additive (new entities constructed *from* untouched original records), rollback is simply disabling the new automation/UI and reverting to the current manual-invoice flow — no data "undo" is needed, since nothing original was ever changed. This mirrors the platform's own existing infrastructure-level rollback precedent (the CTO Context document's git-SHA-tagged Docker rollback for backend deploys) at the application level: keep the old path fully intact and switched-off-but-present, never delete it, until the new path has proven itself.

**Recovery.** If a school's backfill reconstruction is later found to be wrong (a discrepancy between the reconstructed ledger and the school's actual historical totals), the reconstruction can simply be discarded and re-run from the original, untouched `invoices`/`payments` records — the source data was never at risk.

**Verification.** Before any school is considered "migrated," a full reconciliation audit compares every reconstructed Student Ledger's total against that school's existing computed dashboard numbers, invoice by invoice — any mismatch blocks that school's migration until resolved, never waved through.

---

## Part 10 — Implementation Roadmap

*Engineering milestones — deliverables, dependencies, risks, test strategy, rollout strategy, and success criteria for each. No day/week estimates.*

**M1 — Data Foundations**
*Deliverables:* Student Ledger, Ledger Entry, and Family Account entities implemented per Parts 1/6; the reconstruction/backfill process for existing active students. *Dependencies:* none. *Risks:* reconstruction correctness against messy historical data. *Test strategy:* reconstruct a representative sample of existing schools and verify every total matches today's computed numbers exactly. *Rollout:* shadow mode — entities exist and are cross-checked, but no UI depends on them yet. *Success criteria:* zero discrepancy between reconstructed and existing totals across the sample set, and the fee-template IDOR (Part 7) fixed before this milestone is considered closed, since it's an independent prerequisite riding alongside the same body of work.

**M2 — Admission Engine for new admissions**
*Deliverables:* the full lifecycle (Enquiry → Active Student) wired for newly admitted students. *Dependencies:* M1. *Risks:* staff adoption of the new Admission Finance Summary step. *Test strategy:* shadow a real admission end-to-end in staging before any school sees it live. *Rollout:* pilot with a small number of schools, then broaden. *Success criteria:* Invoice Automation % (a PRD success metric) begins climbing for newly admitted students specifically, without any manual invoice-creation step.

**M3 — Billing Plans & recurring automation**
*Deliverables:* the billing scheduler (reviving `invoiceAutomation.js`/`recurringBilling.js`), Billing Cycle/Fee Component policy evaluation, the Rules Engine (Part 3). *Dependencies:* M1, M2. *Risks:* the highest-blast-radius milestone — a bug here could over- or under-bill many families simultaneously. *Test strategy:* mandatory preview-only mode for at least one full billing cycle per school before any invoice is actually created automatically. *Rollout:* staged, per-school opt-in, never a forced global switch. *Success criteria:* a full preview cycle runs clean (matches manual expectations) for every piloting school before automation is switched from preview to live for that school.

**M4 — Family Account & Student Ledger UX**
*Deliverables:* the Family Account, Student Ledger, and Financial Timeline screens (Chapter 1, Part 4). *Dependencies:* M1 (real ledger data to render); the family-aware parent-resolution fix (Chapter 1's flagged prerequisite). *Risks:* parent confusion if the old per-invoice view and new consolidated view coexist inconsistently. *Test strategy:* real usability testing with actual parents/owners, not engineering testing alone — "does this feel simple and trustworthy" is the PRD's own bar. *Rollout:* alongside or shortly after M2. *Success criteria:* Parent Payment Adoption (a PRD KPI) trends upward for families exposed to the new consolidated view.

**M5 — Withdrawal, Graduation & Settlement**
*Deliverables:* the Final Settlement engine, Refund and Credit Note entities/workflows, the Settlement and Graduation screens. *Dependencies:* M1–M4. *Risks:* financial and legal correctness of refund/settlement math — worth a real accountant/legal review before rollout, given it directly determines money owed back to families. *Test strategy:* dedicated scenario coverage for every configurable cancellation/withdrawal policy combination, not just the happy path. *Rollout:* last, given its dependency on everything else being stable, and its lower day-to-day frequency versus routine billing. *Success criteria:* every configured policy combination produces a settlement figure that matches a manually-calculated expectation, across the full test matrix.

**M6 — Legacy cutover completion**
*Deliverables:* migration of the remaining not-yet-migrated active-student backlog onto the new engine; retirement of the old manual-invoice-only flow. *Dependencies:* all prior milestones. *Risks:* this is where "no data loss" gets its final, full-scale test. *Test strategy:* a full reconciliation audit comparing pre- and post-migration totals for every school before the old flow is considered retired. *Rollout:* gated on stability evidence from every earlier milestone having run cleanly in production for a meaningful stretch — not tied to a calendar date. *Success criteria:* every school fully migrated with a clean reconciliation audit, and the old manual-invoice-only code path formally decommissioned (not just unused — removed, per the audit's broader "dead code" findings elsewhere in this module).

---

*This document is a design artifact only. No production code, schema migrations, or PRs were created in producing it. Development should not begin until this chapter — and Chapter 1 — are both explicitly reviewed and approved.*
