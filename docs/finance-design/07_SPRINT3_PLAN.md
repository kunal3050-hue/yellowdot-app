# KUE BOXS Care — Finance Foundation
## Sprint 3 Plan: Billing Engine & Invoice Generation

**Date:** 2026-07-21
**Status:** Approved. **M3.1 (LedgerEntry Idempotency) is complete** — see `04_SERVICE_CONTRACTS.md`'s Idempotency section and `06_FINANCE_EVENT_CONTRACT.md`'s `LedgerEntryCreated` entry for the frozen, resolved contract. **M3.2 (Invoice Domain) is complete** — `FinanceInvoiceService`, frozen contract, `InvoiceGenerated` event. **M3.3 (Rules Engine touchpoints) is complete** — `services/financeRulesEngine.js`, a pure/deterministic module (Joining Date policy + Sibling Discount application; Scholarship application explicitly deferred until a real Scholarship entity exists), frozen contract below. M3.4 remains to be implemented; M3.5 remains explicitly deferred.
**Depends on:** everything frozen per `docs/finance-design/06_FINANCE_EVENT_CONTRACT.md`'s Architecture Freeze — this plan proposes *extending* those contracts, and flags the one place (Invoice/Invoice Line) where a genuinely new entity is needed, which itself should get its own contract addition to `04_SERVICE_CONTRACTS.md` once built, not a silent bolt-on.

---

## Entry Criterion (must close before any Sprint 3 code lands)

**LedgerEntry Idempotency.** Agreed as a hard prerequisite, not a nice-to-have: Sprint 3's Billing Engine is exactly the "retry-capable producer" the Ledger Entry contract already warned about — a billing run that crashes partway through and gets retried, or a scheduler tick that fires twice due to a process restart, must never double-charge a student. This has to close before the engine that generates invoices automatically exists, not after.

**Proposed design** (for review, not yet built):
- Add an optional `idempotencyKey` parameter to `ledgerEntryService.createEntry()`. When supplied, `createEntry` first checks whether an entry already exists for `(schoolId, studentLedgerId, sourceType, sourceId)` — the natural key already available today via the entry's existing `sourceType`/`sourceId` fields, not a new concept — and if one does, returns the existing entry/balance unchanged rather than creating a duplicate (mirroring the exact "idempotent by construction" pattern `createLedger()` and `ensureFinanceAccount()` already use, not inventing a new mechanism).
- When `idempotencyKey` is *not* supplied (the existing manual/staff-initiated call shape), behavior is unchanged — this keeps Sprint 1/2's existing callers and their 41 passing tests untouched. Every Sprint 3 producer (invoice generation specifically) is required to always supply one.
- This closes the exact gap flagged in `04_SERVICE_CONTRACTS.md`'s Idempotency section for `LedgerEntryService`, and resolves `06_FINANCE_EVENT_CONTRACT.md`'s "not currently well-defined" idempotency key for `LedgerEntryCreated` — once built, that event's payload gains a stable idempotency key: `(schoolId, sourceType, sourceId)`.
- Recommend this ship as its own small, isolated commit **before** the invoice-generation code that depends on it, with its own tests (duplicate-call-returns-existing-entry, no-key-call-behaves-as-today) — same "one concern per commit" discipline as every prior round.

---

## Sprint 3 Scope — what "Billing Engine & Invoice Generation" concretely means

Two genuinely new entities are required — both were designed conceptually in `02_DOMAIN_ARCHITECTURE.md` Part 1 but do not exist as real code yet:

- **Invoice, extended.** The existing `invoices` collection (real, in production, used by the current manual invoice flow) needs multi-line-item support added. This is additive to the existing schema (a new `lines` subcollection or embedded array — decided at implementation time, following whichever the Firestore Architecture section recommends), not a breaking change to the fields that already exist (`invoiceNumber`, `studentId`, `amount`, `gst`, `discount`, `totalAmount`, `paidAmount`, `balance`, `status` all stay exactly as they are for backward compatibility with the current manual Invoice/InvoiceView/PaymentDrawer pages, which this sprint does not touch).
- **Invoice Line, new.** One line per Fee Component charged on an invoice — this is the concrete fix for the "single flat amount" limitation the original Finance Module Audit identified, and the mechanism that finally lets daycare and tuition coexist on one bill (the PRD's stated differentiator).

**The Billing Engine itself, scoped narrowly for this sprint:**
1. **Activate a Billing Plan** (`draft` → `active`) — the plan entity already exists (Sprint 1); this sprint adds the actual transition logic and whatever validation should gate it (e.g., does the plan's `feeTemplateId` still reference an active fee template).
2. **Generate one Invoice, on demand, from an active Billing Plan** — given a plan, produce a real, multi-line Invoice against the correct Student Ledger, applying:
   - The plan's `joiningDatePolicy` (full month / prorated / next cycle) — the Rules Engine touchpoint designed in `02_DOMAIN_ARCHITECTURE.md` Part 3, not yet built in any form.
   - Eligible Discounts (the existing sibling-discount mechanism, extended per the Domain Architecture's "reuse this exact mechanism" decision) and Scholarships, evaluated per Fee Component eligibility.
   - A resulting Ledger Entry (`type: "charge"`) posted via the now-idempotent `createEntry()`, keyed by `(schoolId, sourceType: "invoice", sourceId: <invoiceId>)`.
3. **Emit the domain events already specified**: `InvoiceGenerated` is not yet in the Event Contract (it was scoped for a later milestone in `02_DOMAIN_ARCHITECTURE.md` Part 2's original event list, alongside `PaymentReceived`/`PaymentAllocated`) — adding it requires an ADR per the Architecture Freeze, since it's a new event, not a payload change to an existing one. (Adding a *new* event doesn't require an ADR per the freeze's own rules — only breaking changes to *existing* contracts do. Flagged here so the plan is explicit either way: this is additive, no ADR blocks it, but it should still be specified in `06_FINANCE_EVENT_CONTRACT.md` in the same commit that adds it, per that document's own closing instruction.)

**Explicitly out of scope for Sprint 3** (recommend splitting into a later Sprint 3b or Sprint 4, given the Domain Architecture's own risk framing):
- **The actual recurring scheduler/automation** that calls "generate an invoice" *without* a human triggering it. `02_DOMAIN_ARCHITECTURE.md` Part 4 already calls this "the highest-blast-radius milestone in the whole system" and mandates a preview-only mode for at least one full billing cycle before any school gets real automated generation. Sprint 3 as scoped here builds the generation logic and proves it correct via on-demand, staff-initiated calls first — the unattended scheduler is a distinct, later piece of work that should not be bundled into the same review/rollout as the generation logic itself.
- Payment automation, Collections, Parent Finance Portal, production migration — unchanged from every prior sprint's explicit exclusions.
- GST-proper tax engine, refunds, credit notes — real, designed, but not this sprint's focus per the user's own scoping to "Billing Engine and Invoice Generation."

---

## Constraints (reaffirmed, unchanged from every prior sprint)

- No production behavior change until feature-flagged on — the existing `FINANCE_FOUNDATION_ENABLED` flag extends naturally to gate the new invoice-generation endpoint(s); no new flag needed unless a reason emerges during implementation.
- Full backward compatibility — the current manual Invoice/InvoiceView/PaymentDrawer flow (real, in production, used today) is not modified. Multi-line invoices are additive; a legacy single-amount invoice remains valid and readable exactly as-is.
- Continued reuse — `feeTemplates` (not a new Fee Component collection), the existing sibling-discount mechanism, the existing `invoices`/`payments` collections, and the now-idempotent `ledgerEntryService.createEntry()` are all extended, not replaced.
- No migration until explicitly approved — no existing invoice/payment record is touched or backfilled by this sprint's work.

---

## Deferred by agreement — Event Delivery Guarantees

Recorded per your message, not forgotten: the in-process, fire-and-forget, no-retry event pipeline remains correct and sufficient *while events have no external consumers*. The moment Sprint 4+ introduces a real asynchronous consumer (Billing Automation reacting to `InvoiceGenerated`, Collections reacting to `LedgerEntryCreated`, or any external integration), delivery semantics (at-least-once vs. exactly-once), retry policy, dead-letter handling, replay strategy, consumer-side idempotency requirements, and operational monitoring all need their own design pass — and, per the Architecture Freeze, that redesign of the event pipeline's guarantees would itself warrant an ADR, since it changes how every existing event's delivery contract behaves. Until then, the audit log stays the authoritative reconciliation source, as agreed.

---

## Proposed Milestones

**M3.1 — LedgerEntry Idempotency (entry criterion, blocks everything below)**
*Deliverables:* `idempotencyKey`-aware `createEntry()`, updated `04_SERVICE_CONTRACTS.md` Idempotency section, updated `06_FINANCE_EVENT_CONTRACT.md`'s `LedgerEntryCreated` idempotency-key field, new tests (duplicate-key-returns-existing, no-key-preserves-current-behavior). *Dependencies:* none. *Risks:* low — purely additive to a well-tested, already-frozen function; the "no key supplied" path must be proven byte-for-byte unchanged for Sprint 1/2's existing 41 tests. *Rollout:* ships alone, before anything in M3.2.

**M3.2 — Invoice & Invoice Line entities**
*Deliverables:* Invoice Line data model (subcollection or embedded, decided at build time), extension of the existing `invoiceService.js`/`invoices` collection to support lines without breaking any existing single-amount reader. *Dependencies:* none beyond M3.1 conceptually (doesn't depend on it functionally, but should land after it so all subsequent work is idempotency-safe from the start). *Risks:* the highest-care item is proving the legacy manual-invoice pages genuinely don't notice the schema extension — a real regression check against `Invoice.jsx`/`InvoiceView.jsx`/`PaymentDrawer.jsx`, not just the backend test suite. *Rollout:* additive schema change, no flag needed for the shape itself, but new write paths stay behind `FINANCE_FOUNDATION_ENABLED` until M3.4.

**M3.3 — Rules Engine touchpoints: joining-date policy + discount/scholarship application at generation time**
*Deliverables:* the actual evaluation logic for `fullMonth`/`prorated`/`nextCycle`, and applying the existing sibling-discount mechanism (extended to Sprint 1's Discount design) against eligible Invoice Lines. *Dependencies:* M3.2. *Risks:* proration math correctness — needs a dedicated scenario-based test matrix (every policy × every component's proration-eligibility flag), not just happy-path coverage. *Rollout:* pure logic, exercised only through M3.4's on-demand endpoint.

**M3.4 — On-demand invoice generation from an active Billing Plan**
*Deliverables:* the staff-triggered "generate this plan's next invoice now" operation — plan activation, the actual Invoice+Lines+Ledger Entry creation (idempotent, per M3.1), the `InvoiceGenerated` event (new — additive, specified in `06_FINANCE_EVENT_CONTRACT.md` in the same commit). *Dependencies:* M3.1, M3.2, M3.3. *Risks:* this is the first place Sprint 3 actually writes a real, itemized invoice — treat it with the same "verify against a representative sample before broad use" discipline as Sprint 1's ledger backfill got. *Rollout:* behind `FINANCE_FOUNDATION_ENABLED`, staff-initiated only — still no scheduler, no automatic firing, per the explicit non-goal above. *Success criteria:* a staff member can activate a plan and generate a correct, itemized, idempotent invoice end-to-end, with zero change observable in the existing manual invoice flow.

**(Future, not this sprint) M3.5 — Recurring scheduler / automation.** Deliberately deferred, per the Domain Architecture's own risk framing — proposed as its own future sprint with its own review, preview-mode rollout, and explicit approval, not bundled into M3.1–M3.4's review.

---

*This document is a plan only. No Sprint 3 code has been written. Development should not begin on any milestone above until this plan is explicitly approved.*
