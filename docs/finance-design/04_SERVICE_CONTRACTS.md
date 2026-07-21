# KUE BOXS Care — Finance Foundation Service Contracts

**Date:** 2026-07-21
**Status:** Frozen as of this document — the stable engineering interface for `StudentLedgerService`, `BillingPlanService`, `FamilyAccountService`, and `FinanceSettingsService`. Per the Sprint 1 review's Recommended Improvement 3: implementation details (Firestore collection shapes, internal field names, transaction mechanics) are deliberately **not** part of this contract — they may change; the contract below should not, without a version note here.

Each service's actual code lives at `yellowdot-backend/services/<name>.js`. This document is the interface future code (Billing Automation, Collections, Parent Portal, Reports, AI Finance) should be written against — not the implementation.

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
- A ledger's `currentBalance` is never set directly through this service — it only ever changes as a side effect of a Ledger Entry being created (see Ledger Entry's contract, once documented).
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
