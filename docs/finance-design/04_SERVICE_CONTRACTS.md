# KUE BOXS Care — Finance Foundation Service Contracts

**Date:** 2026-07-21 (LedgerEntryService added in a follow-up review pass; FinanceInvoiceService, FinanceRulesEngine, and FinanceBillingEngineService added in Sprint 3, M3.2/M3.3/M3.4 — same date)
**Status:** Frozen as of this document — the stable engineering interface for `LedgerEntryService`, `StudentLedgerService`, `BillingPlanService`, `FamilyAccountService`, `FinanceSettingsService`, `FinanceInvoiceService`, `FinanceRulesEngine`, and `FinanceBillingEngineService`. Per the Sprint 1 review's Recommended Improvement 3: implementation details (Firestore collection shapes, internal field names, transaction mechanics) are deliberately **not** part of this contract — they may change; the contract below should not, without a version note here.

Each service's actual code lives at `yellowdot-backend/services/<name>.js`. This document is the interface future code (Billing Automation, Collections, Parent Portal, Reports, AI Finance) should be written against — not the implementation.

**A note on honesty over completeness in this document:** where the current code doesn't yet do something the contract logically implies it should (an entry taxonomy that's smaller than the eventual canonical list, an idempotency guarantee that isn't enforced yet), this document says so explicitly rather than describing an aspirational state as if it were already true. One such gap (a missing domain event) was found and fixed while writing the LedgerEntryService contract below — see its Audit Requirements section.

---

## LedgerEntryService

**Responsibilities.** The only service permitted to create Ledger Entries, and therefore the only service permitted to change a Student Ledger's `currentBalance` — every financial movement on the platform, from any caller, for any reason, must ultimately pass through here. No other service writes to the `ledgerEntries` collection or mutates a ledger's balance field directly. This is the foundational primitive `StudentLedgerService`'s own contract already depends on ("a ledger's currentBalance... only ever changes as a side effect of a Ledger Entry being created").

**Public methods.** Named to match the actual codebase, per the instruction to keep names consistent with what already exists rather than force a naming scheme that isn't real:

| Method | Inputs | Outputs | Error behavior |
|---|---|---|---|
| `createEntry(studentId, data, { schoolId, centerId, actorUserId })` — the codebase's real name for what a generic contract might call `appendEntry` | `studentId` required; `data.type` required (one of the Supported Entry Types below); `data.amount` required, positive finite number; `data.signedAmountOverride` required only when `data.type === "adjustment"`; `data.feeComponentId`/`description`/`sourceType`/`sourceId` optional | `{ entry, newBalance }` — the created entry and the ledger's balance immediately after it | See Error Behaviour table below |
| `listForLedger(studentId, { schoolId, limit })` — the codebase's real name for what a generic contract might call `listEntries` | `limit` optional, default 100 | Array of entries for that ledger, newest first, empty array if no ledger exists | Never throws for a missing/foreign ledger |

**Methods that do not exist today, documented honestly rather than invented:**
- `getEntry(entryId)` — no single-entry-by-ID lookup exists. Every current consumer reads a ledger's full ordered list via `listForLedger`, not one entry in isolation. Worth adding once a Financial Timeline detail view needs to deep-link to a specific entry.
- `getBalance(studentId)` — deliberately does not exist on this service. A ledger's balance is a property of the Student Ledger record itself (`StudentLedgerService.getLedger()`'s `currentBalance` field) — this service only ever produces the *delta* that changes it, never re-exposes the running total as its own query surface. This is an intentional separation of concerns, not an oversight.
- `exists(entryId)` — no dedicated existence check. Use `listForLedger` (or the future `getEntry`) instead.

**Supported Entry Types.**

Currently enforced by the code (`ENTRY_TYPES`) — every value below is a real, validated type today:

| Type | Effect on balance |
|---|---|
| `charge` | Increases (a fee becomes due) |
| `lateFee` | Increases |
| `payment` | Decreases (money received, allocated) |
| `discount` | Decreases |
| `scholarship` | Decreases |
| `refund` | Decreases (money paid back out) |
| `creditApplied` | Decreases (an existing Credit Note redeemed) |
| `adjustment` | Either direction — the only type where the caller supplies the sign explicitly via `signedAmountOverride`, since a manual correction can go either way |

**Recommended additions to the canonical taxonomy — not yet implemented:**
- `deposit` — a Security Deposit charge is currently just an ordinary `charge`, distinguishable only via `feeComponentId`, not its own type. Worth promoting to a real type once Deposit-specific netting logic (Withdrawal settlement) is built.
- `writeOff` — does not exist. Writing off an uncollectible balance is a distinct business event from a discount or a refund and shouldn't be forced into either.
- `openingBalance` — does not exist. Needed specifically for the future migration/backfill work (Domain Architecture Chapter 2, Part 9) to represent a student's reconstructed starting balance without it looking like an ordinary charge.

This document is the place to track that taxonomy going forward — add here first, then to the `ENTRY_TYPES` enum, in the same change.

**Idempotency.** **Enforced as of Sprint 3, M3.1.** When a caller supplies both `data.sourceType` and `data.sourceId` (already-existing fields, not a new concept), `createEntry` checks — inside the same Firestore transaction that would otherwise write the entry — for an existing entry with the same `(schoolId, studentLedgerId, sourceType, sourceId)`. If found, it returns that existing entry and the ledger's *current* balance unchanged (`{ entry, newBalance, duplicate: true }`), writes a `ledgerEntry.duplicate.<type>` audit log entry (for retry visibility), and does **not** re-publish `LedgerEntryCreated` — no new financial fact occurred, so no event should claim one did. When `sourceType`/`sourceId` are not both supplied — every Sprint 1/2 caller today — behavior is unchanged from before this fix: always creates a new entry. **Every Sprint 3+ retry-capable producer (invoice generation, a future payment gateway webhook, the billing scheduler) is required to always supply both fields.**

**Immutability.** Ledger Entries are permanently append-only, enforced at three independent layers so no single mistake can violate it:
1. **Service layer** — no update or delete function is exported. This isn't a documented restriction on an existing capability; the capability doesn't exist as a callable operation at all.
2. **Firestore rules layer** — the `ledgerEntries` collection rule sets `allow update, delete: if false` unconditionally, regardless of role.
3. **Design convention** — any correction is represented as a *new* entry (typically an `adjustment` with an opposite-signed `signedAmountOverride`), never an edit to a past one.

**Audit Requirements.** Every successful `createEntry()` call:
- Writes one `financeAuditLogs` record (`financeAuditService.logFinanceAudit()`), action `ledgerEntry.create.<type>`, with `entityType: "ledgerEntry"`, the entry's own ID as `entityId`, and `meta: { studentId, amount, signedAmount, newBalance }`.
- Publishes `LedgerEntryCreated` via the Finance Event Publisher (`services/financeEventPublisher.js`). **This was missing until this contract was written** — the Sprint 1 review's Mandatory Change 2 specified four events and did not include one for Ledger Entry itself; since this contract's own Audit Requirements section (by design) states every entry publishes an event, the gap was closed by adding `LEDGER_ENTRY_CREATED` to `EVENTS` and one `publish()` call, mirroring the exact pattern already proven for the other four events — not a new mechanism.
- Records `actorUserId` on both the entry document (`createdBy`) and the audit log entry.
- Records `createdAt` (ISO timestamp) on the entry. There is no `updatedAt`/`updatedBy` — the entry is never updated.
- The immutable entry plus the audit log entry it always produces together form the permanent, non-reconstructable record of "this financial fact happened, and who/when caused it."

**Domain Invariants.**
- One Ledger Entry represents one immutable financial fact.
- A Student Ledger's balance is derived *exclusively* from the sum of its entries' signed amounts — this service is the only writer of that field, and always writes the entry and the balance update in the same Firestore transaction, so the two can never drift apart.
- A Ledger Entry cannot exist without a valid, `active`-status Student Ledger.
- Every Ledger Entry is tenant-scoped from creation; a cross-tenant post attempt is rejected as "not found," never a distinguishable error.
- A Ledger Entry's `schoolId` never changes after creation — true by construction, since no update path exists at all.
- Every entry should reference the action that caused it via `sourceType`/`sourceId` — these fields exist and are supported today, but are not yet *enforced* as required at the API level; disciplined use by every future caller is a recommendation, not yet a guarantee this service itself makes.

**Error Behaviour.**

| Scenario | Behavior |
|---|---|
| Invalid entry type | `{ code: "VALIDATION" }`, thrown before any Firestore access |
| Missing, zero, or negative amount | `{ code: "VALIDATION" }`, thrown before any Firestore access |
| `adjustment` without `signedAmountOverride` | `{ code: "VALIDATION" }`, thrown before any Firestore access |
| No Student Ledger exists for the given student | `{ code: "VALIDATION" }`, thrown inside the transaction |
| Ledger belongs to a different school | `{ code: "NOT_FOUND" }` — hide, don't reveal, matching the platform's cross-tenant convention |
| Ledger is `frozen` or `archived` | `{ code: "VALIDATION" }` ("cannot post new entries") |
| Duplicate idempotency key (both `sourceType`/`sourceId` supplied and matching an existing entry) | Returns the existing entry, `duplicate: true` — never throws, never creates a second entry (see Idempotency above) |

---

## StudentLedgerService

**Responsibilities.** Owns the existence and lifecycle of one Student Ledger per student. The single point of truth for "does this student have a ledger, and what's its current balance and status." Delegates entry-level detail to Ledger Entry (a separate concern, not part of this contract).

**Public methods**

| Method | Inputs | Outputs | Error behavior |
|---|---|---|---|
| `getLedger(studentId, { schoolId })` | `studentId: string`, `schoolId: string` | The ledger object, or `null` if none exists **or** it belongs to a different school (tenant mismatch is never distinguishable from "doesn't exist" — by design). | Never throws for a missing/foreign ledger — returns `null`. |
| `createLedger(studentId, { schoolId, centerId, familyId, actorUserId })` | `studentId: string` (required), rest optional | The created ledger, status `active`, balance `0`. **Idempotent**: calling again for a student who already has one returns the existing ledger unchanged — never creates a duplicate, never throws. | Throws `{ code: "VALIDATION" }` if `studentId` is missing. |
| `setStatus(studentId, status, { schoolId, actorUserId })` | `status` must be one of `STATUSES` | The ledger with its new status, or `null` if no ledger exists for that student/school. | Throws `{ code: "VALIDATION" }` for an unrecognized status. |
| `listEntries(studentId, { schoolId, limit })` | `limit` optional, default 100 | An array of Ledger Entries for that student, newest first. Empty array if the ledger doesn't exist. | Never throws for a missing ledger. |

**Domain invariants**
- Exactly one ledger ever exists per student, for the lifetime of that student record — enforced by `createLedger`'s idempotency, not by the caller remembering not to call it twice.
- A ledger's `currentBalance` is never set directly through this service — it only ever changes as a side effect of a Ledger Entry being created (see the `LedgerEntryService` contract above).
- Status values: `active` (accepting new entries), `frozen` (settlement in progress — new entries rejected), `archived` (permanent, read-only). There is no path back from `archived`.

---

## BillingPlanService

**Responsibilities.** Owns the recurrence rule connecting a Fee Component (`feeTemplates`) to a specific student's ledger. Sprint 1/2 scope: the plan record and its status lifecycle only — **no automation reads or acts on a Billing Plan yet**, regardless of its status.

**Public methods**

| Method | Inputs | Outputs | Error behavior |
|---|---|---|---|
| `getPlan(planId, { schoolId })` | `planId: string` | The plan, or `null` if absent/foreign-tenant. | Never throws for a missing/foreign plan. |
| `listForStudent(studentId, { schoolId })` | `studentId: string` | Array of plans for that student (any status). | Never throws. |
| `create(data, { schoolId, centerId, actorUserId })` | `data.studentLedgerId` and `data.feeTemplateId` required; `data.cadence`, `data.joiningDatePolicy` optional (defaults `monthly` / `fullMonth`) | The created plan, always in `draft` status — activation is always a separate, deliberate call. | Throws `{ code: "VALIDATION" }` if required fields are missing/invalid, **or if no active ledger exists for `studentLedgerId`** — a plan can never be created "floating," unattached to a real ledger. |
| `setStatus(planId, status, { schoolId, actorUserId })` | `status` one of `STATUSES` | The plan with its new status, or `null` if not found. | Throws `{ code: "VALIDATION" }` for an unrecognized status. |

**Domain invariants**
- Status values: `draft` (created, not yet activated) → `active` → `paused` (temporary) → `ended` (permanent). A plan is never deleted — its history explains why a past invoice looked the way it did.
- Creating a plan against a ledger that is not `active` (e.g. `frozen`, `archived`) is rejected.
- `feeTemplateId` references the existing `feeTemplates` collection — this service does not validate that the template itself exists (that's a Sprint 3+ concern once Fee Component becomes its own governed entity).

---

## FamilyAccountService

**Responsibilities.** Owns the *financial facet* of an existing Family record — not the family itself (that remains `familyService.js`'s responsibility, untouched by this service). Provides the consolidated credit/wallet balance described in the Domain Architecture's Family Account design.

**Public methods**

| Method | Inputs | Outputs | Error behavior |
|---|---|---|---|
| `getFinanceAccount(familyId, { schoolId })` | `familyId: string` | The finance facet (`creditBalance`, `paymentAllocationPreference`, `studentIds`), or `null` if the family doesn't exist or belongs to a different school. | Never throws for a missing/foreign family. |
| `ensureFinanceAccount(familyId, { schoolId, actorUserId })` | `familyId: string` | The finance facet — created with defaults (`creditBalance: 0`) if this is the first call for this family, returned unchanged if one already exists. **Idempotent.** | Throws `{ code: "VALIDATION" }` if the family doesn't exist; throws `{ code: "NOT_FOUND" }` if it belongs to a different school. |
| `adjustCreditBalance(familyId, delta, { schoolId, actorUserId, reason })` | `delta: number`, non-zero, positive (credit issued) or negative (credit consumed) | `{ familyId, creditBalance }` — the new balance after the adjustment. | Throws `{ code: "VALIDATION" }` for a zero/non-numeric delta, or if the resulting balance would go negative. Runs inside a Firestore transaction — safe against two concurrent adjustments racing. |

**Domain invariants**
- A family's credit balance never goes negative — an over-consumption attempt is rejected outright, not silently clamped to zero.
- This service never computes a family's total *outstanding* balance across its students' invoices — that aggregation is out of scope until real invoice data flows through Billing Plans (Sprint 3+); today this service only owns the shared credit/wallet number, nothing derived from invoices.
- Ensuring a finance account is safe to call repeatedly (e.g., once per admission, once per family-link) — it will never overwrite an existing balance.

---

## FinanceSettingsService

**Responsibilities.** The configuration surface every future Rules Engine touchpoint (billing frequency, due dates, grace periods, late fees, discount/refund approval thresholds) will read from. Sprint 1/2 scope: storage and retrieval only — **nothing in the codebase yet reads these values to change behavior.**

**Public methods**

| Method | Inputs | Outputs | Error behavior |
|---|---|---|---|
| `getSettings(schoolId)` | `schoolId: string` | Always returns a usable settings object — sane defaults (`defaultJoiningDatePolicy: "fullMonth"`, `lateFeeEnabled: false`, etc.) if the school has never configured anything. | Never throws — there is no "not configured" error state by design. |
| `updateSettings(schoolId, data, { actorUserId })` | Partial update object; unrecognized/immutable fields (`schoolId`, `createdAt`) are stripped before merging | The full, merged settings object after the update. | Throws `{ code: "VALIDATION" }` for an invalid `defaultJoiningDatePolicy` or `defaultAllocationPolicy` value. |

**Domain invariants**
- One settings document per school, always addressable by `schoolId` directly (no query needed) — this collection is schoolId-scoped from its very first field, unlike the platform's pre-existing, known-non-scoped `settings/{section}` collection.
- A caller can never accidentally reassign a settings document to a different school — `schoolId` and `createdAt` are always stripped from the incoming update body before merge, regardless of what the caller sends.
- Every update fires a `FinanceSettingsChanged` domain event (see the Event Publisher contract) — any future consumer that caches or depends on these values should subscribe rather than poll.

---

## FinanceInvoiceService

**Responsibilities.** Creates itemized Invoices (an Invoice header plus one or more Invoice Lines) by extending the platform's existing `invoices` Firestore collection — the same collection `services/invoiceService.js` already reads and writes for the manual Invoice/InvoiceView/PaymentDrawer flow — rather than introducing a parallel collection. Every document this service writes populates all of `invoiceService.js`'s existing legacy fields (computed as the aggregate of the invoice's lines) plus new, purely additive fields (`lines`, `source`, `billingPlanId`, `studentLedgerId`), so the existing manual-flow screens can read a Finance-Foundation-generated invoice exactly like any other, with zero change to them. `services/invoiceService.js` itself is not imported or modified by this service.

This service does **not** post a Ledger Entry, activate a Billing Plan, or apply any Rules Engine policy (joining-date proration, discounts, scholarships) — it only turns an already-decided set of lines into an Invoice record. Orchestrating "decide what to bill, then create the Invoice, then post the matching Ledger Entry, then log it" is `FinanceBillingEngineService`'s job (Sprint 3, M3.4 — see its own contract below), which calls `createInvoice()` as one step in its own orchestration.

**Public methods**

| Method | Inputs | Outputs | Error behavior |
|---|---|---|---|
| `createInvoice(data, { schoolId, centerId, actorUserId })` | `data.studentId` required; `data.lines` required, non-empty array, each line requires `feeComponentId` and a non-negative `amount` (optional `label`/`gst`/`discount`); `data.billingPlanId`/`studentLedgerId`/`studentName`/`invoiceDate`/`dueDate`/`notes`/`source`/`periodStart`/`periodEnd` all optional | The created Invoice document: legacy-compatible aggregate fields (`amount`, `gst`, `discount`, `totalAmount`, `paidAmount: 0`, `balance: totalAmount`, `status: "Pending"`) computed as the sum of the normalized `lines`, plus `invoiceId` (`FINV######`), `invoiceNumber` (`BINV-YYYYMM-#####`), and the `lines` array itself with each line's `total` computed (`amount + gst - discount`) | See Error Behaviour table below |
| `getInvoice(invoiceId, { schoolId })` | `invoiceId: string`, `schoolId: string` | The invoice, or `null` if it doesn't exist **or** belongs to a different school (tenant mismatch is never distinguishable from "doesn't exist" — hide, don't reveal, matching every other Finance Foundation service's convention) | Never throws for a missing/foreign invoice — returns `null` |
| `listForStudent(studentId, { schoolId, limit })` | `limit` optional, default 100 | Invoices for that student **created by this service specifically** (`source === "billingPlan"`), newest first. Does not include invoices created through the legacy manual flow — those remain queryable only through `invoiceService.js`'s own general-purpose readers. | Never throws for a student with no such invoices — returns `[]` |
| `findByPlanAndPeriod(billingPlanId, periodStart, { schoolId })` — **added in Sprint 3, M3.4** as the Billing Engine's idempotency lookup | `billingPlanId: string`, `periodStart: string` | The matching invoice, or `null`. `(schoolId, billingPlanId, periodStart)` is a sufficient key since one plan generates at most one invoice per period. | Never throws — a missing `billingPlanId`/`periodStart` or no match both simply return `null` |

**Why two ID/number sequences instead of reusing the legacy ones.** `invoiceId` uses a distinct `FINV######` prefix (vs. legacy `INV-<timestamp>`) and `invoiceNumber` uses a distinct `BINV-YYYYMM-#####` prefix (vs. legacy `INV-YYYYMM-#####`), each generated from this service's own atomic `_counters` documents. This guarantees zero collision risk with `invoiceService.js`'s own ID generation without requiring any coordination between the two services, and makes a Billing-Engine-generated invoice immediately recognizable to anyone reading raw data.

**Domain invariants**
- Every invoice this service creates is itemized — there is no path to create an Invoice with zero lines; the aggregate header fields are always a derived sum of `lines`, never entered independently.
- `source` defaults to `"billingPlan"`. Nothing calls this service with `source: "manual"` today — the existing manual flow continues to go through `invoiceService.js` entirely, untouched. The field exists so a future caller (e.g., a Rules-Engine-driven auto-invoice) can distinguish itself without a schema change.
- An Invoice document, once created, is not updated by this service — there is no `updateInvoice`/`recordPayment`/`voidInvoice` method here. Payment application and status transitions remain the legacy `invoiceService.js`'s responsibility for every invoice regardless of which service created it; this service's contract is creation only.
- Tenant-scoped from creation; a cross-tenant read is rejected as "not found," never a distinguishable error, matching every other Finance Foundation service.

**Error Behaviour.**

| Scenario | Behavior |
|---|---|
| Missing `studentId` | `{ code: "VALIDATION" }`, thrown before any Firestore access |
| Missing or empty `lines` | `{ code: "VALIDATION" }`, thrown before any Firestore access |
| A line missing `feeComponentId`, or with a negative `amount` | `{ code: "VALIDATION" }`, thrown before any Firestore access |
| Invoice belongs to a different school (`getInvoice`) | Returns `null` — hide, don't reveal |
| No invoice found for the given ID (`getInvoice`) | Returns `null` |

**Audit & Event.** Every successful `createInvoice()` call writes one `financeAuditLogs` record (action `financeInvoice.create`, `entityType: "invoice"`, `meta: { studentId, totalAmount, lineCount, billingPlanId }`) and publishes `InvoiceGenerated` via the Finance Event Publisher — see its contract in `06_FINANCE_EVENT_CONTRACT.md`.

---

## FinanceRulesEngine

**Responsibilities.** The single place billing-decision logic (Joining Date policy, Sibling Discount application) is evaluated during invoice generation — per the Sprint 3 approval's explicit instruction to "keep the Rules Engine deterministic and isolated." Deliberately built as **pure functions only**: every function takes plain data in and returns plain data out, with no Firestore reads or writes and no dependency on any other service's internals. The caller (M3.4's Manual Billing Engine) owns fetching Finance Settings (`financeSettingsService.getSettings`) and the sibling-discount rules (`familyService.getDiscountRules`) and passing the resolved values in as plain arguments.

**This is intentionally different in shape from every other service in this document** — it has no Firestore collection, no audit log calls, and no domain events of its own, because it does not perform any action; it only computes a decision that another service (the future Billing Engine) will act on and audit under its own name.

**Public methods**

| Method | Inputs | Outputs | Error behavior |
|---|---|---|---|
| `resolveJoiningDateFactor({ policy, joiningDate, periodStart, periodEnd })` | `policy` one of `"fullMonth"`\|`"prorated"`\|`"nextCycle"`; three ISO-parseable dates | A number in `[0, 1]` — the fraction of the period's fee actually owed. Joining at/before `periodStart` always returns `1`; joining after `periodEnd` always returns `0`, regardless of policy — the three policies only diverge for a mid-period join. | Throws `{ code: "VALIDATION" }` for an unrecognized policy, an unparseable date, or `periodEnd` before `periodStart` |
| `resolveSiblingDiscountPercent({ siblingOrder, discountRules })` | `siblingOrder` (a student's birth-order position within their family, as already written by `familyService.js`); `discountRules` — the existing sibling-discount rule array (`{ siblingOrder, discountPercent, label }[]`) from `familyService.getDiscountRules()`, unchanged shape | The matched `discountPercent`, or `0` for a first child or when no rule matches. A student whose `siblingOrder` exceeds every defined rule receives the highest-defined rule's rate (e.g. a rule set defining 2nd/3rd/"4th Child+" gives the 4th-child rate to a 5th, 6th, ... child too) | Never throws — an empty/missing rule set simply resolves to `0` |
| `applySiblingDiscount({ lines, siblingOrder, discountRules, discountApprovalThreshold })` | `lines` non-empty array of invoice lines (each with at least `amount`); `discountApprovalThreshold` from Finance Settings (`0` = no threshold configured) | `{ lines, discountPercent, requiresApproval }`. When `discountPercent` is `0`, `lines` is returned as the same reference, unmodified. When a threshold is configured and the resolved percentage is at or above it, `requiresApproval: true` is returned and **lines are left untouched** — this engine has no authority to silently apply a discount policy says a human must approve. Otherwise each line gets a computed `discount` field (`amount * discountPercent / 100`, rounded to 2 decimals). | Throws `{ code: "VALIDATION" }` for empty/missing `lines` |
| `evaluateBillingPlanInvoice({ lines, joiningDatePolicy, joiningDate, periodStart, periodEnd, siblingOrder, discountRules, discountApprovalThreshold })` | Composition of the above — the single entry point M3.4 is expected to call | `{ lines, joiningDateFactor, discountPercent, requiresApproval }`. Proration is applied **before** the discount, so a discount is always computed against the amount actually owed for the period, never the full undiscounted period fee. | Throws whatever the underlying `resolveJoiningDateFactor`/`applySiblingDiscount` calls throw |

**Scope, honestly stated — Scholarship application is NOT implemented.** The Sprint 3 approval's M3.3 description lists "Scholarship application" as an example of Rules Engine behavior, but no Scholarship entity or collection exists anywhere in the codebase yet (Domain Architecture Chapter 2, Part 1 tags Scholarship as a "new" entity still to be built, and the original Finance audit found zero references to scholarships anywhere in the app). Inventing a Scholarship rule against a data shape that doesn't exist would mean guessing at a design that hasn't been made yet — this is flagged as necessary follow-up work once the Scholarship entity itself is designed and built, not silently skipped or faked.

**Domain invariants**
- Every function is pure and synchronous — same inputs always produce the same output, with no I/O of any kind. This is what "deterministic and isolated" means in practice, not just in name.
- Rules are effective-dated implicitly by the caller supplying the actual `periodStart`/`periodEnd`/`joiningDate` for the invoice being generated — this engine has no concept of "today," so a past invoice can always be recomputed identically for audit/reconciliation purposes, and a future policy change can never retroactively alter one.
- A discount that requires approval is never partially or silently applied — `applySiblingDiscount`/`evaluateBillingPlanInvoice` return an explicit `requiresApproval: true` flag and leave the lines exactly as they were; there is no approval workflow to route into yet (not built in any sprint so far), so the caller (M3.4) is responsible for deciding what to do with that flag (e.g. surface it to staff rather than auto-generating the invoice).

---

## FinanceBillingEngineService

**Responsibilities.** The staff-triggered "generate this Billing Plan's next invoice now" operation (Sprint 3, M3.4) — per the Sprint 3 approval: "Staff selects a Student or Billing Plan. Staff clicks Generate Invoice. System creates: Invoice, Invoice Lines, Ledger Entries, Audit Log." This is the first service in the Finance Foundation that owns no collection of its own — it orchestrates three already-frozen services (`FinanceRulesEngine` for the billing decision, `FinanceInvoiceService` for the Invoice write, `LedgerEntryService` for the matching charge) rather than writing anything directly.

**Explicitly manual, not automated.** Nothing in this service fires on its own — there is no scheduler, no cron job, no `setInterval`, and it is never called except from the staff-triggered HTTP endpoint (`POST /api/finance/billing-plans/:planId/generate-invoice`, gated behind `FINANCE_FOUNDATION_ENABLED`). Recurring/automatic invoice generation is M3.5, explicitly deferred and not part of this service's scope.

**Public methods**

| Method | Inputs | Outputs | Error behavior |
|---|---|---|---|
| `generateInvoiceForPlan(planId, { schoolId, centerId, actorUserId, periodStart, periodEnd })` | `planId` required; `periodStart`/`periodEnd` required (the billing period being invoiced, ISO date strings) | `{ invoice, ledgerEntry, newBalance, duplicate }`. `ledgerEntry`/`newBalance` are `null` when the resolved invoice total is `0` (a fully-discounted period creates no Ledger Entry — there is no financial movement to represent). `duplicate: true` only when BOTH the invoice already existed for this plan/period AND the ledger entry was itself a dedup no-op (see Idempotency below). | See Error Behaviour table below |

**Orchestration steps** (in order): 1) fetch the Billing Plan, require `status === "active"`; 2) check `FinanceInvoiceService.findByPlanAndPeriod()` for an existing invoice this exact call would otherwise duplicate; 3) if none exists — fetch the referenced fee template, the student's `admissionDate`/`siblingOrder` (read directly from the `students` collection, not through `studentService`'s own read-mapper, which is already known to silently drop `siblingOrder`), Finance Settings, and the sibling-discount rules; run `FinanceRulesEngine.evaluateBillingPlanInvoice()`; if it returns `requiresApproval: true`, stop and throw — no Invoice is created; otherwise call `FinanceInvoiceService.createInvoice()`; 4) if the invoice's `totalAmount > 0`, call `LedgerEntryService.createEntry()` with `sourceType: "invoice"`, `sourceId: invoice.invoiceId`; 5) write one `financeAuditLogs` record for the orchestration itself (`action: "billingEngine.generateInvoice"` or `"billingEngine.duplicate"`).

**Idempotency.** A Billing Plan generates at most one Invoice per period, keyed on `(schoolId, billingPlanId, periodStart)` via `FinanceInvoiceService.findByPlanAndPeriod()`, checked **before** any write. The Ledger Entry step is **always** attempted — even on the "invoice already existed" path — using the invoice's own `invoiceId` as the Ledger Entry's `sourceId`; `LedgerEntryService.createEntry()`'s own M3.1 dedup then decides whether a new entry is actually needed. This is deliberate: it self-heals the one real partial-failure risk in this two-write orchestration (an Invoice created but its Ledger Entry failing to post, e.g. a transient error) without requiring a cross-service Firestore transaction — retrying the exact same call always converges to "one Invoice, one matching Ledger Entry," never a duplicate of either, and never an Invoice permanently unbacked by its charge.

**Domain invariants**
- Never creates a second Invoice for the same `(billingPlanId, periodStart)` — checked before any write, not cleaned up after the fact.
- Never posts a Ledger Entry with a zero or negative amount — `LedgerEntryService.createEntry()`'s own domain invariant (a Ledger Entry represents a real financial movement) is respected by skipping the post entirely for a fully-discounted invoice, rather than working around it.
- Never silently applies a discount a school's Finance Settings say requires manual approval — `requiresApproval: true` from the Rules Engine always aborts generation before any write, never proceeds with an unapproved amount.
- Every call — success, duplicate, or requires-approval — writes at least one `financeAuditLogs` entry, so "why does/doesn't an invoice exist for this plan and period" is always answerable from the audit trail alone.

**Error Behaviour.**

| Scenario | Behavior |
|---|---|
| Missing `planId` | `{ code: "VALIDATION" }`, thrown before any Firestore access |
| Missing `periodStart` or `periodEnd` | `{ code: "VALIDATION" }`, thrown before any Firestore access |
| Billing Plan not found (missing or cross-tenant) | `{ code: "NOT_FOUND" }` — hide, don't reveal, matching `BillingPlanService.getPlan()`'s own convention |
| Billing Plan is not `active` (`draft`/`paused`/`ended`) | `{ code: "VALIDATION" }` |
| Referenced fee template not found (missing or cross-tenant) | `{ code: "VALIDATION" }` |
| Resolved discount requires manual approval (Finance Settings' `discountApprovalThreshold`) | `{ code: "REQUIRES_APPROVAL" }` — no Invoice or Ledger Entry created |

---

## FinancePaymentStateMachine

**Responsibilities.** Defines the Payment lifecycle explicitly (Sprint 4 Review, Recommendation 2) rather than treating `payment.status` as a free-form string. Pure and synchronous — no Firestore, no side effects, matching the `FinanceRulesEngine` precedent.

**States.** `Pending` (reserved for a future gateway-confirmed flow — no Sprint 4 caller ever creates a Payment in this state), `Recorded`, `Allocated`, `PartiallyAllocated`, `Refunded`, `PartiallyRefunded`, `Reversed`.

**Public methods**

| Method | Inputs | Outputs | Error behavior |
|---|---|---|---|
| `canTransition(from, to)` | two state strings | `true`/`false` | Never throws — returns `false` for an unknown state or a transition not in the map |
| `assertTransition(from, to)` | two state strings | `true` | Throws `{ code: "VALIDATION" }` for an unknown state or a transition not in the map |

**Transition map.** `Pending→Recorded`; `Recorded→{Allocated, PartiallyAllocated, Reversed}`; `PartiallyAllocated→{Allocated, Reversed}`; `Allocated→{PartiallyRefunded, Refunded, Reversed}`; `PartiallyRefunded→{Refunded}`. `Refunded` and `Reversed` are terminal (no outgoing transitions) — **reversing an already-(partially-)refunded Payment is an explicit non-goal**, not silently allowed: money already paid back out via a refund makes a clean reversal a genuinely harder problem than "catch a bad payment early," which is what `Reversed` models.

**Domain invariants**
- Every payment-mutating service (`FinancePaymentService.transitionStatus`, and every later milestone that changes a Payment's status) calls `assertTransition()` before persisting a new status — an invalid transition is rejected in the service layer itself, never left to the caller to have remembered the rules correctly.
- A same-state "transition" (the new status equals the current status) is not a transition at all — callers should skip calling `transitionStatus` entirely in that case rather than expect a self-loop; none is defined in the map.

---

## FinancePaymentService

**Responsibilities.** Creates and manages Payment records (Sprint 4, M4.1) by extending the platform's existing `payments` Firestore collection — the same collection `services/invoiceService.js` already reads and writes for the manual PaymentDrawer/RecordPayment flow — rather than introducing a parallel collection, following the exact pattern `FinanceInvoiceService` proved for Invoices. `services/invoiceService.js` itself is not imported or modified by this service.

A Finance-Foundation-recorded Payment is **family-scoped** (`familyId`, not just `studentId`) and carries an `allocations: []` array plus a `creditAppliedAmount` running total — the concrete fields `FinancePaymentAllocationService` (M4.2) reads and appends to. Every Payment document still carries a best-effort `studentId` so any existing per-student payment-history read that only looks at that field is not broken by this addition.

**Public methods**

| Method | Inputs | Outputs | Error behavior |
|---|---|---|---|
| `recordPayment(data, { schoolId, centerId, actorUserId })` | `data.familyId` required; `data.amount` required, positive finite number; `data.paymentMode` optional, one of `PAYMENT_MODES` (defaults `"Cash"`); `data.studentId`/`studentName`/`transactionId`/`paymentDate`/`notes` all optional | The created Payment document — `paymentId` (`FPAY######`), `receiptNumber: ""` (populated by M4.3, not this milestone), `status: "Recorded"`, `allocations: []`, `creditAppliedAmount: 0` | See Error Behaviour table below |
| `getPayment(paymentId, { schoolId })` | `paymentId: string`, `schoolId: string` | The payment, or `null` if it doesn't exist **or** belongs to a different school (hide, don't reveal) | Never throws for a missing/foreign payment — returns `null` |
| `listForFamily(familyId, { schoolId, limit })` | `limit` optional, default 100 | Payments for that family **created by this service specifically** (`source === "financeFoundation"`), newest first | Never throws for a family with no such payments — returns `[]` |
| `transitionStatus(paymentId, toStatus, { schoolId, actorUserId, meta })` | `toStatus` must be a valid transition per `FinancePaymentStateMachine` from the payment's current status | The updated payment | Throws whatever `assertTransition()` throws; `{ code: "NOT_FOUND" }` for a cross-tenant payment; `{ code: "VALIDATION" }` for a missing payment |
| `appendAllocations(paymentId, newAllocations, creditAppliedThisCall, { schoolId })` — internal, used by `FinancePaymentAllocationService` (M4.2), not part of the "record a payment" public surface | Merges into the existing `allocations` array and adds to `creditAppliedAmount` — never replaces either | The updated payment | Throws `{ code: "VALIDATION" }`/`{ code: "NOT_FOUND" }` matching the same conventions as every other method here |

**Domain invariants**
- Every Payment created by this service starts in `Recorded` — never any other status — matching the platform's existing `firestore.rules` comment on `payments`: "generally immutable — only admins may correct." Only `transitionStatus`/`appendAllocations` (both state-machine- or append-only-guarded) ever change a Payment after creation.
- `source` is always `"financeFoundation"` for a Payment this service creates — the legacy manual flow continues to go through `invoiceService.recordPayment()` entirely, untouched.
- Distinct `FPAY######` ID prefix (own atomic counter) guarantees zero collision risk with the legacy service's own ID generation, matching the `FINV`/`BINV` precedent from M3.2.
- Tenant-scoped from creation; a cross-tenant read is rejected as "not found," never a distinguishable error.

**Error Behaviour.**

| Scenario | Behavior |
|---|---|
| Missing `familyId` | `{ code: "VALIDATION" }`, thrown before any Firestore access |
| Missing, zero, or negative `amount` | `{ code: "VALIDATION" }`, thrown before any Firestore access |
| Invalid `paymentMode` | `{ code: "VALIDATION" }`, thrown before any Firestore access |
| Payment belongs to a different school (`getPayment`, `transitionStatus`, `appendAllocations`) | `null` (`getPayment`) or `{ code: "NOT_FOUND" }` (the others) — hide, don't reveal |
| Invalid status transition (`transitionStatus`) | Whatever `FinancePaymentStateMachine.assertTransition()` throws — `{ code: "VALIDATION" }` |

---

## FinanceAllocationStrategies

**Responsibilities.** A registry of pure Payment-allocation strategies (Sprint 4 Review, Recommendation 1) — every strategy shares the identical signature `strategy({ paymentAmount, outstandingLedgers, manualAllocations }) → { allocations, leftoverAmount }`, so `FinancePaymentAllocationService` never branches on strategy name beyond one registry lookup. A future strategy is a new function plus one registry entry, never a change to the allocation engine itself.

**Public methods**

| Method | Inputs | Outputs | Error behavior |
|---|---|---|---|
| `oldestDueFirst({ paymentAmount, outstandingLedgers })` | `outstandingLedgers: { studentId, currentBalance, createdAt }[]` | `{ allocations: { studentLedgerId, amount }[], leftoverAmount }` — sweeps the payment amount across ledgers ordered by `createdAt` ascending until either the amount or every ledger's balance is exhausted | Never throws — an empty `outstandingLedgers` simply returns the full amount as `leftoverAmount` |
| `manual({ paymentAmount, manualAllocations })` | `manualAllocations: { studentLedgerId, amount }[]`, required, non-empty | `{ allocations, leftoverAmount }` — passes the caller's explicit split through after validation; whatever isn't explicitly allocated is `leftoverAmount` | Throws `{ code: "VALIDATION" }` for an empty/missing list, a missing `studentLedgerId`, a non-positive `amount`, or a total exceeding `paymentAmount` |
| `resolveStrategy(name)` | `name: string` | The matching strategy function | Throws `{ code: "VALIDATION" }` for an unregistered name |

**Domain invariants**
- `oldestDueFirst` ordering is honestly documented as **ledger-granularity** ("the obligation open longest"), not true per-invoice due-date FIFO — per-invoice aging isn't surfaced at the family level yet.
- Neither strategy has any opinion on what happens to `leftoverAmount` — that decision (auto-credit vs. leave unresolved) belongs to the calling engine, not the strategy, since it depends on caller intent.
- Every function here is pure and synchronous — no Firestore, no side effects, same inputs always produce the same outputs.

---

## FinancePaymentAllocationService

**Responsibilities.** Allocates a recorded Payment across its Family Account's outstanding Student Ledgers (Sprint 4, M4.2), using `FinanceAllocationStrategies` for the actual split decision. Partial payments and overpayments are not separate code paths — they fall out of the same `allocatePayment()` call depending on which strategy resolves and how much `leftoverAmount` it returns.

**Public methods**

| Method | Inputs | Outputs | Error behavior |
|---|---|---|---|
| `allocatePayment(paymentId, { schoolId, centerId, actorUserId, strategyOverride, manualAllocations, applyLeftoverToCredit })` | `paymentId` required; payment must currently be `Recorded` or `PartiallyAllocated`; `strategyOverride` optional (defaults to the Family Account's own `paymentAllocationPreference`); `manualAllocations` required only when the resolved strategy is `"manual"`; `applyLeftoverToCredit` (default `false`) only affects the `manual` strategy's leftover | `{ payment, allocations, creditApplied, leftoverAmount }` | See Error Behaviour table below |

**Behavior by strategy.**
- **`oldestDueFirst` is self-resolving.** Any `leftoverAmount` it returns is **always** auto-routed to the Family Account's credit balance via the already-existing `adjustCreditBalance()` — a payment allocated this way always reaches `Allocated` in one call, regardless of whether it exactly matched, under-matched, or overpaid the family's outstanding balance.
- **`manual` respects explicit staff intent.** A deliberately partial split leaves its `leftoverAmount` **unresolved** (not auto-credited) unless the caller explicitly passes `applyLeftoverToCredit: true` — the Payment lands in `PartiallyAllocated` and can be resumed by calling `allocatePayment()` again for the same `paymentId`, allocating only whatever remains unresolved from all prior calls combined.

**Idempotency.** Every settled ledger gets one `type: "payment"` Ledger Entry via the already-idempotent `LedgerEntryService.createEntry()` (M3.1), keyed `sourceType: "payment", sourceId: paymentId` — the studentLedgerId is already part of that dedup key, so reusing the same `paymentId` as `sourceId` across every ledger a single payment settles carries no collision risk.

**Domain invariants**
- A Payment already `Allocated` cannot be allocated again — `allocatePayment()` rejects it before any read of outstanding ledgers, since there is nothing left to resolve.
- A Payment's `allocations` array and `creditAppliedAmount` only ever grow (via `FinancePaymentService.appendAllocations`) — a resumed, previously `PartiallyAllocated` payment never loses a prior call's work.
- The Payment's status transition (`Recorded`/`PartiallyAllocated` → `PartiallyAllocated`/`Allocated`) is skipped entirely when the new status equals the current status (no self-loop is defined in `FinancePaymentStateMachine`), and applied via `FinancePaymentService.transitionStatus()` otherwise — an invalid transition is impossible by construction, not just by convention.

**Error Behaviour.**

| Scenario | Behavior |
|---|---|
| Missing `paymentId` | `{ code: "VALIDATION" }`, thrown before any Firestore access |
| Payment not found (missing or cross-tenant) | `{ code: "NOT_FOUND" }` |
| Payment status is not `Recorded`/`PartiallyAllocated` (e.g. already `Allocated`) | `{ code: "VALIDATION" }` |
| Family Account not found for the payment's `familyId` | `{ code: "VALIDATION" }` |
| Unregistered allocation strategy name | `{ code: "VALIDATION" }` (from `FinanceAllocationStrategies.resolveStrategy`) |
| `manual` strategy with missing/invalid `manualAllocations` | `{ code: "VALIDATION" }` (from `FinanceAllocationStrategies.manual`) |

---

*This document defines the contract only. See each service's own file for implementation, and `test/financeFoundation.test.js` / `test/financeFoundationSprint2.test.js` / `test/financeFoundationSprint3.test.js` / `test/financeInvoiceService.test.js` / `test/financeRulesEngine.test.js` / `test/financeBillingEngineService.test.js` / `test/financePaymentStateMachine.test.js` / `test/financePaymentService.test.js` / `test/financeAllocationStrategies.test.js` / `test/financePaymentAllocationService.test.js` for the executable proof of the error-behavior claims above.*
