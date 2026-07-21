# KUE BOXS Care — Finance Business Rules Engine
## Chapter 1: Admission & Enrollment

**Prepared for:** CTO
**Date:** 2026-07-21
**Status:** Design only — no code, no database changes, no PRs. This chapter is the source of truth Billing, Invoices, Payments, Collections, Parent Portal, Reports, and future Finance Automation/AI must all be built against. Development should not begin until this design is reviewed and approved.
**Precedes:** `KUE_BOXS_FINANCE_PRD.md` (product vision, principles, module architecture) and `docs/engineering-audit/FINANCE_MODULE_AUDIT.md` (what the Finance module looks like today). This chapter is where those two documents meet the Admissions/Students side of the platform.
**Method:** Direct code reads of the admission wizard, student service, family service, parent-account resolution, and a repo-wide grep for any existing ledger/balance/wallet/credit concept — not inference from the Finance-only audit.

---

## Part 1 — Review of the Existing System

### Current admission flow
Admission runs through a single unified wizard, `StudentWizard` (`yellowdot-frontend/src/pages/Students/StudentWizard/`), six steps: **Student Info → Parent Details → Medical (optional) → Pickup Authorization (optional) → Fees (optional) → Documents (optional)**.

The Fees step already exists in the UI and captures `feeTemplate`/`feeNotes` — but **this data is discarded**. The submission handler only sends `student_name, dob, class, gender, center, join_date`, and father/mother contact fields to `POST /add-student`; the Fees step's own values never leave the browser. The code's own comment confirms this is longstanding, not a regression: *"Fees/Documents were never persisted to any API in the original either."*

**The only cross-module side effect of admission today is a Family link** (`familyMode: "none" | "existing" | "new"`, via `familyService`) — admission can create or attach a family record, but this never touches Finance in any way. A repo-wide grep confirmed `services/invoiceAutomation.js` and `recurringBilling.js` have zero references to student creation — admission and Finance are today fully, completely decoupled.

### Student record — current fields
Written by `studentService.create()` on the backend: `studentId` (format `YD001`, atomic counter), `schoolId`, `centerId`/`center` (legacy alias), `studentName`, `dob`, `class`, `admissionDate`, `gender`, `fatherName/WhatsApp/Email`, `motherName/WhatsApp/Email`, `status` (hardcoded to `"Active"` on create), `profileImage`, `parentRegistered`, `qrEnabled`, timestamps. **No fee-related field of any kind exists on the student record.**

A schema gap worth flagging up front: `familyId`, `isSibling`, and `siblingOrder` **are** written onto the student document when a family link is made, but the student read-mapper never projects them back out — meaning even today's existing sibling data is invisible through the student API.

### Student lifecycle / status
`STATUSES = ["Active","Inactive","Alumni"]` exists as a concept, but only as a plain string field with **no server-side enum enforcement** (any value is accepted) and **zero side effects on change** — updating status just sets the field, nothing else happens. There is no dedicated Withdrawal or Graduation flow anywhere; status can only be changed via a legacy quick-edit modal, and the current `StudentWizard`'s edit mode doesn't even expose a status field.

**Deletion is a genuine, permanent hard delete** (`ref.delete()` on the Firestore document), with no cascade cleanup — a deleted student is left dangling in their family's `studentIds` array, in pickup-authorization records, and in any invoices. This is inconsistent with the platform's own precedent: the Staff module already soft-deletes (flips status, clears active flag, sets a `deletedAt` marker) — Students simply never got the same treatment.

### Finance triggers, ledger creation
**None exist.** Nothing about admission, status change, or deletion touches Finance today.

A repo-wide grep for `ledger`, `balance`, `wallet`, `credit` confirms there is no stored ledger, wallet, or running-balance entity anywhere, for either a student or a family. The only things that exist are: (a) a `balance` field computed and stored *per invoice* (`totalAmount − paidAmount`, recalculated on every payment), and (b) a purely client-side, in-memory "ledger" built by the frontend from already-fetched invoices and payments, that is never persisted anywhere. This fully corroborates the Finance Module Audit's earlier finding and rules out any hidden existing ledger concept.

### Family module — what actually exists today
A real `families` collection already exists, with a working frontend (`Families.jsx`, `FamilyProfile.jsx`) and a real backend service. A family record has `studentIds: []`, contact/guardian fields, and a `billingPreference` field (default `"separate"`) — **but that field is never enforced anywhere**; it's read and written, never branched on. There is no balance, wallet, or credit concept on the family record. The only financial thing a family record offers today is `getFeesSummary()`, a **live, computed** aggregation over the invoices collection at request time — not a stored consolidated view.

**One genuinely reusable piece already exists and works well: sibling discounts.** A tenant-wide settings document already stores configurable per-birth-order discount percentages (defaults: 10% for the 2nd child, 15% for the 3rd, 20% for the 4th+), with a working editor already built into `FamilyProfile.jsx`. This is the one area of this whole chapter where real groundwork exists and should be extended, not rebuilt.

### Parent account creation
There is no invite or self-signup flow. Parent access is **entirely implicit and email-match-based**: admission captures a parent's email onto the student record; someone must *separately* create a matching Firebase Auth account (through the unrelated staff-account creation flow); on login, the system matches the authenticated email against student records and assigns the `parent` role and a lazily-provisioned `parents/{uid}` record on the fly. **This linkage is per-student only — it has no awareness of the family record at all.** A parent of two siblings today is matched to each child independently through two separate email lookups, not through one family relationship.

### Center/branch model
`centerId` on a student is a free-form string, copied verbatim from whatever the client sends, sourced from a hardcoded list **duplicated across two frontend files**. A real, formal branch entity *does* exist — but only at the platform/tenant level, editable only by Super Admin, and **completely disconnected** from the `centerId` string used everywhere else. Today, "branch" is really two unrelated concepts wearing the same name.

---

## Part 2 — Gap Analysis

| Business Rule (new engine) | Current System | Required Change | Impact |
|---|---|---|---|
| Financial Account is created automatically the moment admission is confirmed | Admission creates nothing financial at all — even the wizard's own Fees-step data is silently discarded | Wire admission confirmation to trigger Family Account creation/reuse + Student Ledger creation + Billing Plan activation as one atomic business event | **Critical** — foundational; nothing else in this chapter works without it |
| One Family Account is created once per family and reused for every subsequent sibling | The `families` collection and admission-time family linking (new/existing/none) already work; `billingPreference` exists but is inert | Extend the existing, working family-linking mechanism with a real financial layer — do not rebuild family linking itself | **High** — genuine extension, not a rebuild |
| Every student has an independent, itemized, persistent Ledger | No ledger entity exists anywhere; only a per-invoice `balance` field and a transient client-side computed view | Introduce a real, stored per-student ledger as the system's source of truth | **Critical** — the single largest structural gap; nearly every other rule depends on this existing |
| Billing Plans activate automatically at admission, from the chosen components and joining-date policy | No billing-plan concept exists; the wizard already has a Fees UI step whose data is captured and then thrown away | Build the billing-plan concept, and — notably — simply wire the *already-built* Fees step to it instead of discarding its data | **Critical**, but with an unusually cheap first step (real UI groundwork already exists, just disconnected) |
| The first invoice generates automatically per the joining-date policy | 100% manual invoice creation, via two separate duplicate flows, fully decoupled from admission | Auto-generate the first invoice as a direct, immediate consequence of admission confirmation | **Critical** |
| Parent Portal access activates as a deliberate part of the admission moment | Access is an implicit, fragile side effect of a staff member separately creating a matching-email account through an unrelated flow; resolution is per-student, not family-aware | Make portal activation an explicit, deliberate admission step, ideally invite-based rather than silent email matching, and make resolution family-aware | **High** — the current mechanism is a real, ongoing "why can't I log in" support burden |
| Student lifecycle has enforced states (Active/Withdrawal/Graduation/Archive) with defined transition side effects | `STATUSES` exists as an unvalidated string with zero side effects on change; no dedicated Withdrawal/Graduation flow exists; the current wizard doesn't even expose status | Real enum enforcement, and a dedicated Withdrawal/Graduation workflow that triggers billing cancellation and settlement | **High** |
| Archive means retain everything, forever, read-only | The opposite is true today: student deletion is a genuine, permanent Firestore hard-delete with no cascade cleanup of family/pickup/invoice references | Replace hard-delete with the Archive lifecycle stage, mirroring the soft-delete pattern the Staff module already uses | **Critical** — this is arguably a live data-loss/data-integrity bug today, not merely a gap |
| Every admission component (Tuition, Daycare, Transport, Meals, Activities, Books, Uniform, Registration, Admission Fee, Deposit) has its own recurrence/refundability/proration/discount-eligibility policy | No fee components exist on a student at all; the only "fee" concept today is a single flat amount on a manually-created invoice | Build the component-policy model from the ground up | **Critical** — foundational alongside the Ledger |
| Sibling discounts apply automatically within the new billing engine | A real, working, configurable sibling-discount mechanism already exists (tenant settings + editor UI) | Reuse this mechanism as-is; wire it to auto-apply during billing-plan activation instead of being a manual/reference-only setting | **Medium** — the one area with strong existing groundwork to build on |
| Branch/center scoping is consistent and real, supporting future multi-branch billing consolidation | `centerId` is a free-form, duplicated, unvalidated string; a real branch entity exists but only at platform level, disconnected from it | Unify these into one real, validated branch concept before multi-branch billing consolidation (an open question already flagged in the Finance PRD) can work correctly | **Medium (High if multi-branch is prioritized soon)** |
| Parent access is family-aware (a parent of siblings sees one unified account) | Parent-to-student linkage is derived per-student via email match; there is no relationship to the family record at all in the auth/resolution layer | Parent resolution must become family-aware, not just student-aware — a direct prerequisite for the Family Account UX in Part 4 | **High** — blocks the Family Account experience under today's auth mechanism |
| The student API surface is complete and internally consistent | `familyId`/`isSibling`/`siblingOrder` are written to Firestore but silently dropped by the student read-mapper — even today's existing sibling data is invisible through the API | Fix this mapping gap as a prerequisite before building ledger/family features on top of student data | **Medium**, but a genuine fix-this-first item |

---

## Part 3 — New Architecture

### Student Lifecycle

```
Enquiry
  ↓
Admission Confirmed
  ↓
Financial Account Created
  ↓
Student Ledger Created
  ↓
Billing Plans Activated
  ↓
First Invoice Generated
  ↓
Parent Portal Activated
  ↓
Active Student
  ↓
Withdrawal  /  Graduation
  ↓
Archive
```

**Enquiry.** A prospective family expresses interest. This stage is deliberately *pre-financial* — nothing described in this chapter exists yet, and nothing should. Finance's engine begins at exactly one moment: admission confirmation.

**Admission Confirmed.** The single trigger event for everything that follows. The business rule here is strict: nothing financial exists before this moment, and everything financial exists within a defined, immediate window after it — not "eventually," not "when someone remembers to create an invoice."

**Financial Account Created.** The moment admission is confirmed, the system determines whether this family already has a Family Account (an existing sibling enrolled) or needs a new one. This is a matching decision, not a guess — it should be made explicitly during admission (the "is this a new family or an existing one" choice the current Family-linking UI already makes the admitting staff answer), not inferred silently. If existing, the new student is *attached* to that account; a duplicate account is never created for the same family.

**Student Ledger Created.** Regardless of whether the family is new or existing, every student gets their own ledger the instant admission is confirmed. This is a system invariant: **a student in Active status without a ledger should be considered a data-integrity failure**, not an edge case to handle gracefully.

**Billing Plans Activated.** Based on the components chosen at admission (tuition plus any optional add-ons) and the joining-date policy selected, billing plans are instantiated onto the ledger. Critically, this should never be a silent action — the person running admission should see a plain-English preview ("this child will be billed ₹X starting [date], recurring monthly") and explicitly confirm it, not discover it after the fact.

**First Invoice Generated.** Depending on the joining-date policy (see below), this happens either immediately or automatically on the next scheduled billing run. The very first invoice for any family is treated as intentionally different in tone from every invoice after it — it should read as a welcome, not a bill, bundling Registration/Admission/Deposit (if applicable) with the first period's recurring fees so the family understands exactly what they're paying for.

**Parent Portal Activated.** Access is granted the moment the Financial Account exists — not before, since there's nothing yet to show; not later, since a family shouldn't have to ask for access after they've already paid. It should be bundled with the first invoice into one coherent "welcome" moment, not two disconnected system notifications.

**Active Student.** The steady state: billing plans run themselves, invoices generate on schedule, payments post automatically to the ledger. A leave-of-absence (a family pausing daycare for a month) is handled as a *pause within* this state, not a separate lifecycle stage — the student is still enrolled, simply not being billed for the paused component.

**Withdrawal / Graduation.** Two deliberately distinct exits — described in full below, since they differ in ways that matter to both the family relationship and the financial mechanics.

**Archive.** The final resting state. The ledger becomes read-only; every billing plan is guaranteed terminated; every historical invoice, payment, and receipt is retained in full, forever. Archive is a status, never a deletion — a family should be able to look up a receipt from three years ago just as easily as one from last week.

### Family Financial Account

One Family Account can hold multiple students, each with their own independent ledger underneath. The Family Account is a **consolidating lens**, not a competing source of truth — every rupee is still traceable to a specific student and fee component; the family view aggregates that, it doesn't replace it. This is the direct, literal application of the "One Source of Truth" principle from the Finance PRD.

What the Family Account actually provides:
- **A single consolidated Outstanding Balance** — the sum across every enrolled child's ledger, shown as one number, with each child's contribution visible underneath so the total is never opaque.
- **A single unified Payment History** — every payment the family has ever made, across every child, in one timeline. A parent should never have to remember which child's screen shows which payment.
- **A shared Credit Balance / Wallet** — if a payment overshoots what was owed, or a refund is issued, that credit sits at the family level, available against *any* child's next due amount, not stranded against one specific child.
- **Pay-for-one-or-all-in-one-transaction** — a parent settling two children's tuition should be able to do it in a single payment action, not two separate ones.

**How money actually flows** is the key business-rule insight of this whole section: **billing flows down** (school → family → the specific student ledger a fee belongs to — even a shared cost like a transport route is still allocated to the individual child's ledger, never lumped at the family level), while **payment flows up, then back down** (the parent pays the Family Account as one action; the system then allocates that payment into the correct student ledger(s) it's meant to settle).

That allocation needs an explicit rule, not an assumption: either the parent specifies the split when paying for multiple children at once, or a default allocation policy applies automatically for simple cases (e.g., a single-child, single-invoice payment allocates itself trivially). This should be a configurable business rule, spelled out before implementation, not something engineering infers on its own.

Family-level credit should always be the default, since it's simpler to explain and report on. Student-level credit is reserved only for genuinely student-specific situations — most notably a scholarship that must, by its own terms, stay tied to one named child (an external sponsor's award, for instance).

### Student Ledger

Every fee component — Tuition, Daycare, Transport, Meals, Activities, Books, Uniform — is its own line in a student's ledger, never flattened into a single number. Adjustments, discounts, and scholarships applied to that student are ledger entries too, not invisible overrides — read top to bottom, the ledger is a complete, honest account of everything that has ever happened to that child's finances. This directly satisfies the PRD's transparency principle: click any total, and see exactly what it's made of.

### Admission Components

Rather than a fixed rule per fee type, each component varies along a small set of **policy dimensions** — this framework is what lets new fee types be added later without redesigning the rules each time:

- **Recurrence** — one-time (Registration, Admission, Deposit, Books, Uniform) vs. recurring (Tuition, Daycare, Transport, Meals) vs. variable (Activities, which may be either).
- **Refundability** — fully refundable, non-refundable, partially refundable, or conditionally refundable (a Security Deposit is typically refundable minus damages/dues; a Registration Fee is typically not refundable at all, since it compensates for work already done).
- **Proration eligibility** — does the component prorate for a mid-cycle join or exit, or is it charged flat regardless of timing? Recurring fees typically prorate; one-time admission-adjacent fees typically don't.
- **Discount/scholarship eligibility** — which components can a discount or scholarship actually reduce? A scholarship almost certainly shouldn't discount a Security Deposit, for instance — this must be configurable per component, not applied blanket across an entire invoice, which is itself a real gap versus today's single flat discount field.
- **Timing of first charge** — charged at the moment admission is confirmed (Registration, Admission, Deposit, Uniform, Books) vs. charged on the first regular billing cycle (Tuition, Daycare, Transport, Meals).

### Joining Date Policies

- **Full Month** — the family is charged the full period's fee regardless of the actual join date within the cycle. Simplest option; some schools deliberately choose this for cash-flow predictability and to avoid proration complexity entirely.
- **Prorated** — the fee is calculated proportionally from the join date to the end of the current billing cycle. The proration method itself should be configurable per component (a calendar-day formula suits Tuition; Daycare's already-different, attendance-driven rhythm may call for a different basis).
- **Next Billing Cycle** — the child attends starting now, but formal billing begins only from the *next* cycle's start — effectively, the remainder of the current cycle is on the house. This is typically the right choice for joins very close to a cycle's end, and it's a deliberate choice to be generous in a family's very first interaction with the school, rather than nickel-and-dime a few days.

Each school picks its own default policy in Finance Settings, with the ability to override per admission for a specific negotiated arrangement — any such override requires an explicit reason and sign-off, since ad hoc exceptions are exactly where an audit trail matters most.

### Cancellation Rules

This covers a family that confirmed admission — and may have already paid registration/admission fees or a deposit — but decides not to proceed before the child ever actually starts, distinct from a Withdrawal (below), which happens after active enrollment.

- **Registration retained** — kept by the school regardless of cancellation timing; this is near-universal practice, since it compensates for enquiry/paperwork/seat-holding cost already spent.
- **Admission retained** — whether the (usually larger) admission fee is kept should depend on *when* cancellation happens relative to term start: a configurable, time-based cutoff (full refund well before term start, partial refund closer to it, fully retained once term has begun), not one fixed rule.
- **Deposit refunded** — the default should be full refund unless there are dues to net against; the netting itself is a calculation step shared with the Withdrawal Final Settlement process below.
- **Credit note** — instead of a cash refund, the amount owed back can be held as family-level credit, usable against a future admission or a sibling's ongoing fees. This should carry a configurable expiry (e.g., 12 months) — indefinite, un-expiring credit is a long-term reconciliation liability, not a kindness.
- **Future admission credit** — a specific variant of a credit note, explicitly conditional on the family re-admitting within a defined window, distinct from a generic credit because it's tied to a future event rather than immediately usable.

### Withdrawal

The mid-enrollment exit, after a child has been actively attending.

- **Final Settlement** is the umbrella process triggered the moment a withdrawal is confirmed, and nothing else proceeds until it produces one unambiguous number: the family either owes more, or is owed money back. That single number is what actually gets communicated to the parent — ambiguity here, at the most emotionally sensitive moment in the relationship, is exactly where trust breaks.
- **Outstanding dues** as of the withdrawal date are calculated and either invoiced as a final bill or netted directly against a refundable deposit, per school policy.
- **Refund calculation** combines: any prorated "unused" portion of prepaid fees (using the *same* proration method the school already applies on joining — symmetry matters, and any deliberate asymmetry should be an explicit, stated choice, not an oversight), plus the security deposit minus damages/dues, minus any other outstanding dues. The net of all three is the actual settlement figure.
- **Deposit settlement** is its own explicit step: the deposit is checked against damage claims or fee netting, and only the remainder is refunded.
- **Invoice closure** — every outstanding invoice is formally closed (paid, written off, or folded into the settlement figure); none should linger in "Pending" limbo after a child has left, since a stale invoice would falsely surface in an outstanding-fees report years later.
- **Billing cancellation** — every active billing plan for the student is terminated, not paused, as of the withdrawal date.
- **Archive** follows once settlement is complete and communicated — data retained in full, ledger read-only.

### Graduation — and why it differs from Withdrawal

Graduation shares the *same* underlying settlement mechanics as Withdrawal, but the two are deliberately different business events, for reasons that matter:

- **Intent and tone.** Withdrawal is typically unplanned from the school's perspective and carries real risk of an awkward or disputed exit. Graduation is an expected, positive, planned event — it should never feel like a financial transaction to the family, even though the same settlement math runs underneath.
- **Financial shape differs in practice.** Graduation usually lands at a natural academic-year boundary, where the year's billing is already essentially complete — proration/refund scenarios are rare. Withdrawal can happen at any point in the cycle and much more often involves real proration and refund math.
- **The relationship implication differs.** A graduating family is a natural moment for warm, celebratory communication — and, where the school has other programs or branches, a genuine opportunity to stay connected. A withdrawal deserves care and dignity, but is not a celebration.
- **Sibling/family continuity** — in both cases, the Family Account and any remaining siblings' ledgers and billing plans must be completely unaffected by one child's exit. The technical requirement is identical; the business framing is not — a withdrawal of one sibling is sometimes worth a check-in conversation about the whole family's continued enrollment, in a way graduation never calls for.

The design implication: **the same Final Settlement engine serves both, but the parent-facing experience must diverge sharply** — Graduation should route to a warmer, lighter-weight confirmation (a farewell/certificate moment) while Withdrawal routes to the more careful, dispute-aware Settlement Screen described in Part 4.

---

## Part 4 — UX (screens only, not built)

**Admission Finance Summary.** Appears as the final step of admission, before commit — after the rest of the admission form (name, class, etc.) is complete. Shows the chosen components with their policies, the exact first-invoice preview (amount and date) driven by the joining-date policy, whether this attaches to a new or existing Family Account, and any sibling-discount eligibility. One confirmation action here fires everything downstream: ledger creation, billing-plan activation, first invoice, and portal invite. *Journey:* the admitting staff member completes the rest of the wizard as today, then reviews this one plain-English summary, and confirms — nothing financial happens silently before this screen, and everything happens immediately after it.

**Family Account.** The consolidated view — one outstanding balance, each enrolled child's contribution to that total listed underneath (never opaque), the shared wallet/credit balance if any, and a single "Pay Now" action letting the parent settle one child, several, or the full family total in one transaction. *Journey:* a parent with two children opens this screen once, sees everything they owe across both kids in one place, and pays once.

**Student Ledger.** Per-child, fully itemized — every fee component as its own line, every payment/adjustment/discount/scholarship in chronological order, with a running balance. *Journey:* the screen an accountant or a curious parent drills into from the Family Account when they want to understand exactly where a number came from.

**Financial Timeline.** A chronological, human-readable narrative ("Feb 1 — Invoice raised, ₹12,000" / "Feb 3 — Payment received, ₹8,000 via UPI" / "Feb 10 — Sibling discount applied"), not a table. This is the explainability surface — the screen to open when a parent disputes a number, because it tells the *story* of the balance rather than just its current state.

**Settlement Screen.** Shared by Withdrawal and Cancellation. Shows the Final Settlement calculation transparently — outstanding dues, prorated refund/credit, deposit netting, and the resulting net figure — and requires explicit staff confirmation before anything finalizes. Generates the parent-facing settlement statement. *Journey:* deliberately careful and unhurried, since this is the highest-dispute-risk moment in the whole Finance experience.

**Graduation Screen.** Runs the same underlying settlement, but is designed to feel entirely different — celebratory framing, warmer language, a farewell/certificate moment, and a lighter-weight confirmation reflecting that this is a low-risk, expected, positive event rather than a dispute-prone one.

---

## Part 5 — Technical Design (conceptual — entities and relationships, not implementation)

*This section names the conceptual shape engineering will need — entities, relationships, services, and domain events — without specifying actual database schema, API contracts, or code. It exists so the design can be reviewed as a whole before any implementation decisions are locked in.*

**New conceptual entities** (in addition to the existing `students`, `families`, `invoices`, `payments`, `feeTemplates`):
- **Family Account** — the financial extension of the existing `families` record: consolidated balance, shared credit/wallet, payment-allocation preferences. Conceptually a natural extension of the family entity that already exists, not a parallel one.
- **Student Ledger** — one per student, the persistent, itemized record every fee/payment/adjustment/discount/scholarship entry belongs to. The new source of truth this entire chapter depends on.
- **Ledger Entry** — an individual line within a Student Ledger (a fee charge, a payment allocation, a discount application, a manual adjustment) — the atomic unit of the ledger's "complete honest history."
- **Billing Plan** — the recurrence rule attaching one or more Fee Structure items to a specific student, with its own cadence, start/end window, and pause/resume state.
- **Admission Lifecycle Event** — a record of each lifecycle transition (Admission Confirmed, Withdrawal, Graduation, Archived) with its effective date and the settlement/side-effects it triggered — the audit trail this whole design depends on for trust and correctness.

**Key relationships:** one Family Account has many Students; each Student has exactly one Student Ledger; each Student Ledger has many Ledger Entries and many Billing Plans; a Billing Plan generates Invoices; a Payment can allocate across one or more Ledger Entries/Invoices, potentially spanning multiple students within one family.

**Conceptual services** (responsibility, not implementation): an **Admission Finance Service** (owns the Financial-Account-Created → Ledger-Created → Billing-Plans-Activated → First-Invoice-Generated sequence as one coordinated business transaction), a **Family Ledger Consolidation Service** (computes/maintains the family-level aggregate view, credit allocation), a **Lifecycle Service** (owns Withdrawal/Graduation/Archive transitions and the Final Settlement calculation), and the existing Invoice/Payment services, extended rather than replaced.

**Domain events** other modules (Billing, Collections, Parent Portal, Reports, future AI Finance/Automation) should be able to react to, without needing to know how this chapter's internals work: `StudentAdmitted`, `LedgerCreated`, `BillingPlanActivated`, `InvoiceGenerated`, `PortalActivated`, `PaymentAllocated`, `StudentWithdrawn`, `StudentGraduated`, `SettlementCompleted`, `StudentArchived`. This event list is itself part of the design contract — any future module (an AI collections assistant, for instance) should be able to build entirely on these events without needing special-case knowledge of the Admission engine.

---

## Part 6 — Migration Strategy

Existing schools already have real invoices and payments in the current single-amount shape, with no ledger, family-account, or billing-plan entities behind them. The migration must never lose or alter a single historical financial record.

- **Additive, not destructive.** New entities (Ledger, Family Account) are *constructed from* existing invoice/payment history for currently-active students — a read-based reconstruction, never a rewrite of the original records.
- **Old invoices remain valid as-is.** A historical single-amount invoice is simply representable as a ledger with one line item — it never needs to be "translated" or guessed at.
- **Staged rollout, not a cutover.** New admissions go through the new engine first, while existing active students are backfilled once the reconstruction has been verified. No school experiences a forced, all-at-once switch.
- **Legacy support during transition.** Schools or students not yet migrated continue operating under the current manual-invoice flow without interruption until their backfill is complete and verified.
- **Rollback is safe by construction.** Because the new engine only adds structure on top of untouched original records, rolling back means simply disabling the new automation and screens — nothing about the underlying financial history was ever altered, so there is nothing to "undo" at the data layer.
- **No data loss** is the standing constraint every migration step must satisfy: additive reconstruction, never deletion or overwrite, at every stage.

---

## Part 7 — Implementation Plan

*Milestones and sequencing only — no day/week estimates, per the instruction to keep this at the design level.*

**M1 — Data Foundations.** Build the Student Ledger and Family Account as real, stored, additive entities, plus the one-time reconstruction for existing active students.
*Dependencies:* none — this is the foundation everything else sits on. *Risks:* correctness of reconstruction against messy or incomplete historical records. *Testing:* reconstruct ledgers for a representative sample of existing schools and verify every total matches today's computed dashboards exactly, before anything downstream is built on top. *Rollout:* shadow mode first — new entities exist and are cross-checked against today's numbers, but no UI depends on them yet. *Constraints:* must never touch or alter an original invoice/payment record.

**M2 — Admission Engine for new admissions.** Wire the full lifecycle (Enquiry → … → Active Student) for newly admitted students only; existing active students stay on the current flow until M1's backfill is verified.
*Dependencies:* M1. *Risks:* staff adoption of the new Admission Finance Summary step is as much a training/UX risk as a technical one. *Testing:* shadow a real admission end-to-end in a staging environment before any school sees it live. *Rollout:* pilot with a small number of schools first, gather feedback, then broaden.

**M3 — Billing Plans & recurring automation.** The engine that actually generates invoices automatically on schedule, from the entities M1/M2 established.
*Dependencies:* M1, M2. *Risks:* the highest-blast-radius milestone in this whole plan — a bug here could over- or under-bill many families at once. *Testing:* run in preview-only mode (the system shows what it *would* generate, without creating anything) for at least one full billing cycle before it's allowed to actually generate invoices. *Rollout:* staged, per-school opt-in — never a forced global switch-on.

**M4 — Family Account & Student Ledger UX.** The parent- and staff-facing Family Account, Student Ledger, and Financial Timeline screens.
*Dependencies:* M1 (needs real ledger data to render). *Risks:* parent confusion if an old per-invoice view and the new consolidated view coexist inconsistently during transition. *Testing:* real usability testing with actual parents and owners before general rollout — "does this feel simple and trustworthy" is the whole point of this chapter, and that can't be verified by engineering testing alone. *Rollout:* alongside or shortly after M2.

**M5 — Withdrawal, Graduation & Settlement.** The exit flows and the Final Settlement engine.
*Dependencies:* M1–M4 (needs a working ledger and a working billing-plan-cancellation mechanism). *Risks:* this is the milestone most worth a real accountant or legal review before rollout, since it directly determines money owed back to families. *Testing:* dedicated scenario coverage for every configurable cancellation/withdrawal policy combination, not just the straightforward case. *Rollout:* last of the five, and lower-frequency than day-to-day billing, so there is no pressure to rush it ahead of the others being stable.

**M6 — Legacy cutover completion.** Migrate the remaining backlog of not-yet-migrated active students onto the new engine, and retire the old manual-invoice-only flow.
*Dependencies:* all prior milestones. *Risks:* this is where "no data loss" gets its final, full-scale test. *Testing:* a full reconciliation audit comparing pre- and post-migration totals for every school before the old flow is considered retired. *Rollout:* gated on stability evidence from every earlier milestone having run cleanly in production for a meaningful stretch — not tied to a calendar date.

---

*This document is a design artifact only. No code, database schema, or API contracts were implemented in producing it — Part 5's entities/relationships/events are conceptual, to support design review, not final technical specifications. Development should not begin until this chapter is explicitly reviewed and approved.*
