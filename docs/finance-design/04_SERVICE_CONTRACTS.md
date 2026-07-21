# KUE BOXS Care — Finance Foundation Service Contracts

**Date:** 2026-07-21 (LedgerEntryService added in a follow-up review pass, same date)
**Status:** Frozen as of this document — the stable engineering interface for `LedgerEntryService`, `StudentLedgerService`, `BillingPlanService`, `FamilyAccountService`, and `FinanceSettingsService`. Per the Sprint 1 review's Recommended Improvement 3: implementation details (Firestore collection shapes, internal field names, transaction mechanics) are deliberately **not** part of this contract — they may change; the contract below should not, without a version note here.

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

*This document defines the contract only. See each service's own file for implementation, and `test/financeFoundation.test.js` / `test/financeFoundationSprint2.test.js` for the executable proof of the error-behavior claims above.*
