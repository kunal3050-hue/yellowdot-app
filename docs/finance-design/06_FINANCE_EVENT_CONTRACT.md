# KUE BOXS Care — Finance Event Contract

**Date:** 2026-07-21
**Status:** Frozen. This is the single source of truth for every Finance domain event — future consumers (Billing Automation, Collections, Parent Portal, Reports, Notifications, AI Finance, External Integrations) must implement against the contract below, never by inferring a payload shape from `services/financeEventPublisher.js` or from reading a producer service's source.
**Governs:** `services/financeEventPublisher.js` and every service that calls `publish()` — currently `studentLedgerService.js`, `ledgerEntryService.js`, `billingPlanService.js`, `familyAccountService.js`, `financeSettingsService.js`.

---

## How events actually work today (read this before consuming any event)

- **Transport**: a single, in-process Node `EventEmitter` (`financeEvents`, exported alongside `EVENTS` and `publish()`). There is no message broker, no persistence, no cross-process delivery. A consumer must run **in the same Node process** as the publisher (i.e., inside this same Express backend) to receive anything — this is not yet, and cannot yet, notify a separate service or a different deployment.
- **No consumers exist yet.** Every event listed below is emitted into an EventEmitter with zero registered listeners. This document exists so the *first* consumer is built against a real, agreed contract rather than one inferred from source.
- **Delivery is fire-and-forget, at-most-once, best-effort.** `publish()` catches a throwing listener and logs it (`[financeEventPublisher] listener error for "<event>": ...`) — the event is still considered "emitted" the moment `emit()` runs. There is no retry, no dead-letter queue, no redelivery. If a future consumer needs stronger guarantees than "the process didn't crash while handling this," it must not rely on the event stream alone (see Audit Relationship, per event, below).
- **Every payload automatically gains two fields**, added by `publish()` itself on top of whatever the producer passes: `eventName` (the event's own name, redundant with the listener registration but useful if one handler subscribes to multiple events) and `emittedAt` (ISO timestamp, when `publish()` ran — not necessarily identical to any `createdAt` field inside the payload, though today they're effectively simultaneous since publishing happens immediately after the triggering write commits).

---

## StudentLedgerCreated

| Field | Value |
|---|---|
| **Purpose** | Announces that a new Student Ledger now exists and is ready to receive Ledger Entries. |
| **Producer** | `services/studentLedgerService.js`, `createLedger()` |
| **Trigger Conditions** | Only on a genuine, first-time creation. `createLedger()` is itself idempotent — calling it again for a student who already has a ledger returns the existing one and does **not** re-publish this event. |
| **Consumers (intended, none registered yet)** | Billing Automation (a plan can now be attached), Reports (a new active-ledger count) |
| **Payload Schema** | `{ schoolId: string, centerId: string, studentId: string, familyId: string, actorUserId: string, eventName: "StudentLedgerCreated", emittedAt: ISO-8601 string }` — `familyId` is `""` if the student wasn't linked to a family at ledger-creation time. |
| **Idempotency Key** | `studentId` — a ledger is created at most once per student, ever, so `studentId` alone is sufficient for a consumer to deduplicate if it somehow observes this twice (e.g., a future multi-instance deployment). |
| **Ordering Guarantees** | None beyond "emitted synchronously, immediately after the Firestore write that created the ledger commits, within the same request." No guarantee relative to any *other* student's `StudentLedgerCreated` event, and no guarantee relative to events from other services in a concurrent request. |
| **Versioning Strategy** | See "Versioning Policy" below — applies platform-wide, not repeated per event. |
| **Retry Expectations** | None. At-most-once, no redelivery. See "How events actually work today" above. |
| **Audit Relationship** | A corresponding `financeAuditLogs` entry (`action: "studentLedger.create"`, `entityType: "studentLedger"`) is written *before* this event publishes. The audit log is the durable, queryable record; the event is a real-time notification only — a consumer that missed this event can still reconstruct "was a ledger created, and when" from the audit log or by reading the `studentLedgers` document directly. |

---

## LedgerEntryCreated

| Field | Value |
|---|---|
| **Purpose** | Announces that a new, immutable financial fact has been recorded against a Student Ledger, and its balance has changed accordingly. |
| **Producer** | `services/ledgerEntryService.js`, `createEntry()` |
| **Trigger Conditions** | After the Firestore transaction that writes the entry *and* updates the ledger's `currentBalance` has committed successfully. Never fires if `createEntry()` throws (invalid type/amount, missing/frozen/archived ledger, cross-tenant mismatch). |
| **Consumers (intended, none registered yet)** | Collections (outstanding-balance recalculation), Reports, Parent Portal (real-time balance display), AI Finance (anomaly detection on entry patterns) |
| **Payload Schema** | `{ schoolId, centerId, studentLedgerId: string, entryId: string, type: one of the ENTRY_TYPES enum ("charge"\|"lateFee"\|"payment"\|"discount"\|"scholarship"\|"refund"\|"creditApplied"\|"adjustment"), amount: number (always positive), signedAmount: number (the actual signed effect on balance), newBalance: number (the ledger's balance immediately after this entry), actorUserId, eventName: "LedgerEntryCreated", emittedAt }` |
| **Idempotency Key** | **Resolved as of Sprint 3, M3.1**: `(schoolId, studentLedgerId, sourceType, sourceId)`. `createEntry()` now checks this combination transactionally before posting; a duplicate call (matching key) does **not** re-publish this event at all — it returns the existing entry with `duplicate: true` and stops, so a consumer only ever sees `LedgerEntryCreated` for a genuinely new financial fact. Producers that omit `sourceType`/`sourceId` (legacy manual calls) get no dedup protection and should not be retry-capable. |
| **Ordering Guarantees** | Same as above — in-process, synchronous-at-emit-time only. Within one ledger, entries are chronologically ordered by `createdAt` (and the transaction serializes concurrent writes to the same ledger), but this event stream itself provides no cross-ledger ordering. |
| **Versioning Strategy** | See "Versioning Policy" below. |
| **Retry Expectations** | None — see "How events actually work today." |
| **Audit Relationship** | A `financeAuditLogs` entry (`action: "ledgerEntry.create.<type>"`, `entityType: "ledgerEntry"`) is written before this event publishes, carrying `{studentId, amount, signedAmount, newBalance}` in its `meta`. Combined with the entry document's own permanent, immutable record, this is the durable source of truth — this event is a notification of it, not a substitute for it. |

---

## BillingPlanCreated

| Field | Value |
|---|---|
| **Purpose** | Announces that a new recurring-billing plan has been defined for a student, in `draft` status. |
| **Producer** | `services/billingPlanService.js`, `create()` |
| **Trigger Conditions** | Every successful call — `create()` is not idempotent the way `createLedger()`/`ensureFinanceAccount()` are; each call makes a genuinely new plan. Fails (and never publishes) if the referenced Student Ledger doesn't exist or isn't `active`. |
| **Consumers (intended, none registered yet)** | Billing Automation (the eventual scheduler that reads active plans — this event does not itself activate anything, since every new plan starts `draft`), Reports (Invoice Automation % tracking, per the Finance PRD's KPI) |
| **Payload Schema** | `{ schoolId, centerId, planId: string, studentLedgerId: string, feeTemplateId: string, actorUserId, eventName: "BillingPlanCreated", emittedAt }` |
| **Idempotency Key** | `planId` — unique per call, no dedup concern since creation is intentionally not idempotent (a student can legitimately have multiple plans, e.g. tuition + daycare). |
| **Ordering Guarantees** | Same in-process caveat as above. |
| **Versioning Strategy** | See "Versioning Policy" below. |
| **Retry Expectations** | None. |
| **Audit Relationship** | A `financeAuditLogs` entry (`action: "billingPlan.create"`, `entityType: "billingPlan"`) is written first, carrying `{studentLedgerId, feeTemplateId}` in `meta`. |

---

## FamilyAccountCreated

| Field | Value |
|---|---|
| **Purpose** | Announces that a family's finance facet (shared credit/wallet balance) has been initialized for the first time. |
| **Producer** | `services/familyAccountService.js`, `ensureFinanceAccount()` |
| **Trigger Conditions** | Only when a *new* finance facet is actually created. `ensureFinanceAccount()` is idempotent — if a family already has one, it's returned unchanged and this event does **not** re-publish. |
| **Consumers (intended, none registered yet)** | Parent Portal (family account view becomes available), Reports |
| **Payload Schema** | `{ schoolId, familyId: string, actorUserId, eventName: "FamilyAccountCreated", emittedAt }` — deliberately no `centerId`, since a family's finance facet is not itself center-scoped (a family's students may span centers). |
| **Idempotency Key** | `familyId` — a finance facet is created at most once per family, ever. |
| **Ordering Guarantees** | Same in-process caveat as above. |
| **Versioning Strategy** | See "Versioning Policy" below. |
| **Retry Expectations** | None. |
| **Audit Relationship** | A `financeAuditLogs` entry (`action: "familyAccount.create"`, `entityType: "familyAccount"`) is written first. |

---

## FinanceSettingsChanged

| Field | Value |
|---|---|
| **Purpose** | Announces that a school's Finance Settings (GST number, default policies, late-fee configuration, approval thresholds) have been updated — the signal a future Rules Engine or any cache should react to. |
| **Producer** | `services/financeSettingsService.js`, `updateSettings()` |
| **Trigger Conditions** | **Every** successful `updateSettings()` call — unlike the four creation events above, this one is not "only on genuine change" in a diffed sense; it fires whenever the update function runs, even if the resulting merged document happens to be identical to before (no field-level diff is performed to suppress a no-op update). Document this as a real behavior for consumers: this event means "an update call was made," not necessarily "a value actually changed." |
| **Consumers (intended, none registered yet)** | The future Rules Engine (invalidate any cached settings read), Reports |
| **Payload Schema** | `{ schoolId, actorUserId, changed: string[] (the field names present in the incoming update body — not necessarily fields whose value differs from before), eventName: "FinanceSettingsChanged", emittedAt }` |
| **Idempotency Key** | **No single natural key** the way creation events have one — a school's settings can legitimately change many times, so `schoolId` alone does not identify a unique occurrence. If a consumer ever needs to deduplicate delivery (not currently possible with the in-process EventEmitter, but worth stating for future-proofing), use `(schoolId, emittedAt)` as a technical composite key. |
| **Ordering Guarantees** | Same in-process caveat as above — notably, if two updates to the same school's settings happen close together, a consumer must not assume it will observe them in the same order they were requested unless it's also reading `financeSettings/{schoolId}.updatedAt` to confirm which write is actually latest. |
| **Versioning Strategy** | See "Versioning Policy" below. |
| **Retry Expectations** | None. |
| **Audit Relationship** | A `financeAuditLogs` entry (`action: "financeSettings.update"`, `entityType: "financeSettings"`) is written first, carrying the same `changed` field list. |

---

## InvoiceGenerated

| Field | Value |
|---|---|
| **Purpose** | Announces that a new itemized Invoice has been created — the signal the eventual Billing Engine orchestration (M3.4), Collections, Reports, and Parent Portal should react to. |
| **Producer** | `services/financeInvoiceService.js`, `createInvoice()` |
| **Trigger Conditions** | After the Invoice document has been written to Firestore. Never fires if `createInvoice()` throws (missing `studentId`, missing/empty `lines`, or an invalid line). `createInvoice()` does not itself post a Ledger Entry — a consumer that expects a matching `LedgerEntryCreated` for the same financial fact should expect it from a separate call (M3.4's orchestration), not from this event alone. |
| **Consumers (intended, none registered yet)** | The Billing Engine orchestration itself (M3.4 — calls `createInvoice()` directly rather than listening for this event, but a future out-of-process consumer could), Collections, Reports (Invoice Automation % tracking, per the Finance PRD's KPI), Parent Portal (new-invoice notification) |
| **Payload Schema** | `{ schoolId, centerId, invoiceId: string ("FINV######"), invoiceNumber: string ("BINV-YYYYMM-#####"), studentId: string, billingPlanId: string (empty string if not billing-plan-sourced), totalAmount: number, lineCount: number, actorUserId, eventName: "InvoiceGenerated", emittedAt }` |
| **Idempotency Key** | **None today.** `createInvoice()` is not idempotent — each call always creates a new Invoice with a freshly allocated `invoiceId`/`invoiceNumber`, the same way `BillingPlanCreated`'s producer is not idempotent. A retry-capable caller (the future M3.4 orchestration, if it retries) is responsible for its own dedup — e.g., checking whether an Invoice already exists for the given `(studentLedgerId, billingPeriod)` before calling `createInvoice()` again — this service itself performs no such check. |
| **Ordering Guarantees** | Same in-process caveat as above. |
| **Versioning Strategy** | See "Versioning Policy" below. |
| **Retry Expectations** | None — see "How events actually work today." |
| **Audit Relationship** | A `financeAuditLogs` entry (`action: "financeInvoice.create"`, `entityType: "invoice"`) is written first, carrying `{studentId, totalAmount, lineCount, billingPlanId}` in its `meta`. Combined with the Invoice document itself, this is the durable source of truth — this event is a notification of it, not a substitute for it. |

---

## PaymentRecorded

| Field | Value |
|---|---|
| **Purpose** | Announces that a new Payment has been recorded against a Family Account — the signal Collections, Reports, and Parent Portal should react to. Does not itself mean the payment has been allocated to any Student Ledger yet — see `PaymentAllocated` for that. |
| **Producer** | `services/financePaymentService.js`, `recordPayment()` |
| **Trigger Conditions** | After the Payment document has been written to Firestore, always in `Recorded` status. Never fires if `recordPayment()` throws (missing `familyId`, missing/non-positive `amount`, invalid `paymentMode`). |
| **Consumers (intended, none registered yet)** | The Payment Allocation Engine (M4.2 — calls `recordPayment()` directly rather than listening for this event, but a future out-of-process consumer could), Collections, Reports, Parent Portal (payment-confirmation notification) |
| **Payload Schema** | `{ schoolId, centerId, paymentId: string ("FPAY######"), familyId: string, amount: number, paymentMode: string, actorUserId, eventName: "PaymentRecorded", emittedAt }` |
| **Idempotency Key** | **None today.** `recordPayment()` is not idempotent — each call always creates a new Payment with a freshly allocated `paymentId`, the same way `InvoiceGenerated`'s producer is not idempotent. A retry-capable caller is responsible for its own dedup before calling `recordPayment()` again — this service performs no such check itself. |
| **Ordering Guarantees** | Same in-process caveat as above. |
| **Versioning Strategy** | See "Versioning Policy" below. |
| **Retry Expectations** | None — see "How events actually work today." |
| **Audit Relationship** | A `financeAuditLogs` entry (`action: "financePayment.record"`, `entityType: "payment"`) is written first, carrying `{familyId, amount, paymentMode}` in its `meta`. Combined with the Payment document itself, this is the durable source of truth. |

---

## PaymentAllocated

| Field | Value |
|---|---|
| **Purpose** | Announces that a Payment's allocation call has resolved (fully or partially) — settling Ledger Entries created, any overpayment routed to Family Account credit, and the Payment's own status transitioned accordingly. |
| **Producer** | `services/financePaymentAllocationService.js`, `allocatePayment()` |
| **Trigger Conditions** | After every successful `allocatePayment()` call — including a call that only *partially* resolves a Payment (leaving it `PartiallyAllocated`) and a call that resumes a previously `PartiallyAllocated` Payment. Never fires if `allocatePayment()` throws (payment not found, wrong status, unknown strategy, invalid manual allocations). |
| **Consumers (intended, none registered yet)** | Ledger Service (already updated synchronously by this same call, not reactively), Collections (outstanding-balance recalculation), Reports |
| **Payload Schema** | `{ schoolId, centerId, paymentId: string, familyId: string, allocations: { studentLedgerId, amount }[] (only THIS call's newly-resolved allocations, not the payment's full history), creditApplied: number, status: string (the Payment's status after this call — "Allocated" or "PartiallyAllocated"), actorUserId, eventName: "PaymentAllocated", emittedAt }` |
| **Idempotency Key** | **Not applicable in the traditional sense** — `allocatePayment()` is explicitly designed to be callable more than once for the same `paymentId` (to resume a `PartiallyAllocated` payment), and each call's event payload reflects only that call's newly-resolved portion. A consumer that wants the Payment's cumulative state should read the Payment document itself (`financePaymentService.getPayment()`), not accumulate this event's payloads. The underlying Ledger Entries this event corresponds to ARE idempotent (`sourceType: "payment", sourceId: paymentId`, per M3.1). |
| **Ordering Guarantees** | Same in-process caveat as above. |
| **Versioning Strategy** | See "Versioning Policy" below. |
| **Retry Expectations** | None — see "How events actually work today." |
| **Audit Relationship** | A `financeAuditLogs` entry (`action: "financePayment.allocate"`, `entityType: "payment"`) is written first, carrying `{strategy, allocatedThisCall, creditApplied, newStatus}` in its `meta`. Combined with the Payment document's own `allocations`/`creditAppliedAmount` fields and every settled Ledger Entry's own audit trail, this is the durable source of truth. |

---

## RefundProcessed

| Field | Value |
|---|---|
| **Purpose** | Announces that a Refund has actually been processed — money paid back out, a `refund` Ledger Entry posted, and the originating Payment's `refundedAmount`/status updated accordingly. Does NOT fire for a `Requested` refund still awaiting approval, or a `Rejected` one — only for `Processed`. |
| **Producer** | `services/financeRefundReversalService.js`, `_processRefund()` (called from both `requestRefund()`'s auto-approve path and `approveRefund()`) |
| **Trigger Conditions** | After the `refund` Ledger Entry has been posted and the Refund document marked `Processed`. Never fires for a `Requested`-but-not-yet-approved refund, nor a `Rejected` one. |
| **Consumers (intended, none registered yet)** | Collections, Reports, Parent Portal (refund-confirmation notification) |
| **Payload Schema** | `{ schoolId, centerId, refundId: string ("FREF######"), paymentId: string, familyId: string, studentId: string, amount: number, actorUserId, eventName: "RefundProcessed", emittedAt }` |
| **Idempotency Key** | **None today** — a Refund, once created, is processed exactly once by construction (there is no retry path that re-processes an already-`Processed` refund; `approveRefund()` itself rejects a non-`Requested` refund). The underlying Ledger Entry this event corresponds to is nonetheless idempotent (`sourceType: "refund", sourceId: refundId`, per M3.1), as defense in depth. |
| **Ordering Guarantees** | Same in-process caveat as above. |
| **Versioning Strategy** | See "Versioning Policy" below. |
| **Retry Expectations** | None — see "How events actually work today." |
| **Audit Relationship** | A `financeAuditLogs` entry (`action: "financeRefund.process"`, `entityType: "refund"`) is written first, carrying `{paymentId, amount, newBalance, newStatus}` in its `meta`. Separate `financeRefund.request`/`financeRefund.approve` audit entries record the earlier workflow steps. |

---

## PaymentReversed

| Field | Value |
|---|---|
| **Purpose** | Announces that a Payment has been reversed (e.g. a bounced cheque) — every ledger it had settled restored via offsetting entries, any granted credit clawed back, and the Payment itself transitioned to `Reversed`. |
| **Producer** | `services/financeRefundReversalService.js`, `reversePayment()` |
| **Trigger Conditions** | After every offsetting Ledger Entry has been posted and the Payment's status successfully transitioned to `Reversed`. Never fires if the Payment's current status doesn't allow a `Reversed` transition (already `Refunded`/`PartiallyRefunded`/`Reversed` — an explicit non-goal, not a bug) or if clawing back already-spent credit fails. |
| **Consumers (intended, none registered yet)** | Collections (outstanding-balance recalculation — a reversed payment means the family owes again), Reports |
| **Payload Schema** | `{ schoolId, centerId, paymentId: string, familyId: string, reason: string, actorUserId, eventName: "PaymentReversed", emittedAt }` |
| **Idempotency Key** | **Not applicable** — `Reversed` is a terminal state in `FinancePaymentStateMachine` (no outgoing transitions), so a Payment can only ever be reversed once; a second `reversePayment()` call for the same `paymentId` is rejected by `assertTransition()` before any Ledger Entry is posted. |
| **Ordering Guarantees** | Same in-process caveat as above. |
| **Versioning Strategy** | See "Versioning Policy" below. |
| **Retry Expectations** | None — see "How events actually work today." |
| **Audit Relationship** | A `financeAuditLogs` entry (`action: "financePayment.reverse"`, `entityType: "payment"`) is written first, carrying `{reason, allocationsReversed, creditClawedBack}` in its `meta`. Combined with every offsetting Ledger Entry's own audit trail, this is the durable source of truth. |

---

## Versioning Policy (applies to every event above)

No payload carries an explicit schema-version field today — this is a real gap, documented honestly rather than assumed away. **Recommended, not yet implemented**: add a `schemaVersion: 1` field to every payload (either inside `publish()` itself, so it's automatic like `eventName`/`emittedAt`, or per-producer) before the first real consumer is built. Going forward, under the Architecture Freeze below:

- An **additive** change (a new optional field) does not require a version bump or an ADR — it's backward compatible by definition.
- A **breaking** change (renaming, removing, or changing the type/meaning of an existing field) requires both an ADR (see below) and either a version bump (`schemaVersion: 2`) or, if the meaning of the event itself has fundamentally changed, a new event name entirely (e.g. `LedgerEntryCorrected` rather than overloading `LedgerEntryCreated`) — never a silent, same-name, same-version reshape of an existing payload.

---

# Architecture Freeze — Effective This Milestone

With the Finance Event Contract complete, the Finance Platform architecture is frozen as of this document. The full set of governing artifacts:

1. **Product Vision** — `KUE_BOXS_FINANCE_PRD.md`
2. **Business Rules** — `docs/finance-design/01_ADMISSION_ENROLLMENT_ENGINE.md`
3. **Domain Architecture** — `docs/finance-design/02_DOMAIN_ARCHITECTURE.md`
4. **Engineering Blueprint** — the same document's Parts 5–8 (API/Firestore/Security/Performance)
5. **Service Contracts** — `docs/finance-design/04_SERVICE_CONTRACTS.md`
6. **Security Model** — `docs/finance-design/02_DOMAIN_ARCHITECTURE.md` Part 7, grounded in `SECURITY_ARCHITECTURE.md`
7. **Migration Strategy** — `docs/finance-design/02_DOMAIN_ARCHITECTURE.md` Part 9
8. **Foundation Implementation** — Sprint 1 + Sprint 1 review fixes + Sprint 2 (commits `4d3c6d7`, `0bc26f8`, `7466229`)
9. **Event Contract** — this document

**Governance rules, effective immediately:**

1. **No architectural changes without an Architecture Decision Record (ADR).** A change to a frozen contract's *shape* (a service's public method signature, an event's payload schema, a Firestore collection's ownership rule) requires an ADR before it's made, not a retroactive note after.
2. **New functionality extends existing contracts; it does not modify them.** A new Finance capability should add a new method, a new event, or a new collection — matching the "extends vs. new" discipline already applied throughout this architecture — rather than reshape something already frozen.
3. **Any breaking contract change must be versioned and documented through an ADR**, per the Versioning Policy above.

**Process**: ADRs live in `docs/finance-design/adr/`, one file per decision (`NNNN-short-title.md`, zero-padded sequential numbering), using the template at `docs/finance-design/adr/TEMPLATE.md`. The freeze decision itself is recorded as the first entry, `docs/finance-design/adr/0001-freeze-finance-foundation-architecture.md` — demonstrating the format with a real decision rather than an empty template.

---

*This document is frozen per the Architecture Freeze above. Any change to an event's payload shape, trigger condition, or the addition/removal of an event requires an ADR in `docs/finance-design/adr/` first.*
