# KUE BOXS Care — Finance Product Requirements Document

**Prepared for:** CTO, Head of Product, UX Lead
**Date:** 2026-07-21
**Status:** Product strategy — the blueprint for the Finance redesign. No code, APIs, or database changes are proposed here; this is the philosophy and shape every future engineering decision should be checked against.
**Precedes:** `docs/engineering-audit/FINANCE_MODULE_AUDIT.md` (what exists today, Phase 1 discovery).

---

## Deliverable 1 — Finance Vision

### Why does Finance exist in KUE BOXS Care?

Every preschool and daycare runs on two things: trust from parents, and cash to keep the lights on. Finance is the one module where both are simultaneously at stake on every single transaction — get it wrong, and you don't just lose money, you lose the relationship with a family that trusts you with their child every day. That makes preschool/daycare finance fundamentally different from finance in any other kind of business software: it is not a back-office function, it is a daily touchpoint in an emotional relationship.

Finance exists in KUE BOXS Care to make that relationship *easier*, not harder. Concretely:

- **It exists so an owner never has to personally remember who owes what.** In most Indian preschools today, that memory lives in the owner's head, a register, or a WhatsApp thread. That doesn't scale past a handful of children and it fails silently — an owner discovers a family stopped paying three months ago, not three days ago.
- **It exists so a parent never has to ask "how much do I owe" or "did you get my payment."** Every day that question goes unanswered is a small erosion of trust. Every day it's answered instantly and correctly is a small deposit of trust.
- **It exists so daycare and school billing — which run on completely different rhythms — can coexist for the same child without anyone stitching them together by hand.** This is the specific, underserved problem in the Indian market (see below).
- **It exists so accountants get real numbers without owners needing to become accountants**, and owners get plain-English answers without accountants needing to explain a ledger.

### What problems should it solve?

1. **The "who owes what" problem** — replacing personal memory, registers, and WhatsApp threads with one always-current, always-visible answer.
2. **The manual-invoice problem** — recurring fees should never require someone to sit down and re-type the same invoice every month for every child.
3. **The dual-billing problem** — a school that also runs a daycare has two fundamentally different billing rhythms (fixed term-based tuition vs. continuous, sometimes attendance-based daycare charges) that today get forced into the same single-invoice shape or handled outside the system entirely.
4. **The awkward-reminder problem** — chasing payment from a parent you'll see at pickup in an hour is socially uncomfortable. Automation should absorb that discomfort without making the relationship feel transactional or cold.
5. **The "is this real money" problem** — owners need to distinguish billed revenue from actually-collected cash, in real time, to make payroll/rent decisions with confidence instead of anxiety.
6. **The compliance-without-a-CA problem** — GST and receipt compliance shouldn't require every small preschool owner to hire an accountant just to stay legal.

### What should make it different from other preschool ERPs?

Most competitors fall into one of two camps: US-market childcare billing tools (Illumine, KinderPass) that are polished but not built for the Indian regulatory, payment, and communication reality (GST, UPI, WhatsApp-first parent communication); or general school ERPs (Educore-class, ERPNext) with a fee module bolted onto a system designed for K-12 term billing, where daycare's continuous/attendance-driven billing is an awkward afterthought.

**KUE BOXS Care's differentiation is treating "one child can be billed under multiple concurrent rhythms — term-based tuition, continuous daycare, ad hoc transport, seasonal activities — on one coherent account" as the central design problem, not a workaround.** No competitor reviewed treats this as a first-class concept. That is the wedge.

The second differentiator is emotional register, not just functionality: KUE BOXS Care already has an established brand philosophy elsewhere in the product (the "child-as-hero" warmth of Gate Register) — Finance should extend that same warmth into money conversations, which every competitor treats as cold and transactional.

### What should owners feel after using it?

**Relief, not control.** Not "I have a powerful finance system," but "I don't think about billing anymore." The measure of success is an owner who, when asked "how's collection this month," pulls out their phone and answers in five seconds with total confidence — and who has forgotten what it felt like to chase a parent for money in person.

This vision is the guiding philosophy every future Finance feature must be checked against: **does this remove work from the owner, does it make money visible and honest, and does it protect the parent relationship?** If a proposed feature doesn't clearly serve one of those three, it doesn't belong in Finance yet.

---

## Deliverable 2 — Product Principles

**1. Automation First.**
Any fee that recurs should never require a human to re-create it. The default state of a billing plan is "runs itself"; manual invoice creation is the exception (a one-time activity fee, a correction), not the primary workflow. *Why it matters:* manual repetition is where trust leaks — a forgotten invoice, a wrong amount typed twice, a missed reminder. Automation isn't a convenience feature here, it's the core value proposition competitors haven't fully delivered on either (see the audit's finding that KUE BOXS Care's own automation scaffolding was built and never wired up).

**2. Simple Before Complex.**
A single-owner-operated 30-child playschool must be able to run 100% of daily finance without ever opening a settings screen or learning a new vocabulary. Complexity — GST slabs, multi-branch consolidation, discount governance — is progressively revealed as a school grows, never front-loaded. *Why it matters:* the majority of the addressable market in India is small, owner-operated schools. If the product feels like enterprise accounting software on day one, it loses exactly the customer it needs most.

**3. One Source of Truth.**
There is exactly one ledger per child (or family — see the open question in Deliverable 8) that every screen reads from. No feature is allowed to compute its own version of "outstanding fees" or "collected this month." *Why it matters:* the current implementation has three separate dashboards computing overlapping, sometimes-inconsistent numbers — this is precisely the failure mode that erodes an owner's trust in the software itself.

**4. Parent Transparency.**
A parent should never have to ask a human "how much do I owe" or "did you get my payment." Every state change — invoice raised, payment received, discount applied, refund processed — is visible to the parent the moment it happens, in the channel they actually check (WhatsApp-first, given how Indian parents communicate with schools today, not email-first). *Why it matters:* transparency is the cheapest possible way to reduce disputes and awkward front-desk conversations, and it directly serves the "protect the relationship" pillar of the Vision.

**5. Owner-Focused Insights, Accountant-Ready Detail.**
The owner thinks in plain-English questions ("how much cash came in," "who hasn't paid"), not journal entries. Every report should answer a question an owner would actually ask out loud. But beneath that simplicity, the same data must be exportable at accountant-grade detail (GST summaries, full ledgers) on demand. *Why it matters:* forcing an owner to interpret a ledger to answer "did we make rent this month" is a UX failure even if the underlying data is perfectly accurate.

**6. Mobile-First Experience.**
Most Indian preschool owners run the school from a phone between classroom duties, not from a desk. Every core finance action — record a cash handoff, check who's overdue, send a reminder — must be a thumb-friendly, sub-30-second action on a phone. *Why it matters:* if the "quick" action requires a desktop, it won't get done in the moment, and the whole automation promise collapses back into "I'll do it later" (which, in practice, means never).

**7. Minimal Manual Work.**
Every manual data-entry step is a place accuracy and trust can leak. Manual entry should be the deliberate exception (recording that cash physically changed hands), never the default mechanism for creating invoices or sending reminders. *Why it matters:* this is the operational expression of Automation First — it's the test you apply when reviewing any new feature ("does this add a manual step, or remove one?").

**8. Scalable Across Single and Multi-Branch Schools.**
The same product must feel effortless for a single 30-child playschool and coherent for a 12-branch chain — without forking into a "lite" and "enterprise" product. Multi-branch complexity (consolidated reporting, branch-scoped roles) layers on top of the same core model; it never requires re-learning a different one. *Why it matters:* KUE BOXS Care needs a growth path that doesn't force a customer to migrate to a different product as they succeed — that's a retention and expansion strategy, not just a technical nicety.

**9. Design for the Relationship, Not Just the Transaction.**
A fee reminder should read like a caring nudge from a school that knows your child, never like a collections notice from a bank. This is a direct extension of the emotional register already established in KUE BOXS Care's Gate Register redesign — Finance is the module most at risk of feeling cold, and therefore the one that most needs deliberate warmth. *Why it matters:* every competitor treats billing communication as purely functional; making it feel human is a genuine differentiator, not a decoration.

---

## Deliverable 3 — Module Architecture

*A note before the breakdown: underlying every module below is a single conceptual **Student/Family Ledger** — not a screen in its own right, but the one running account every module reads from and writes to. It is the literal embodiment of Principle 3 (One Source of Truth). Every module description below assumes it writes to, and reads from, this one ledger — never its own private copy of the numbers.*

### Finance Dashboard
**Purpose:** the owner's single "state of the school's money" view — the first thing Finance opens to.
**Responsibilities:** today/week/month collected, total outstanding, overdue count and aging, upcoming dues in the next 7 days, a single collection-health signal, and shortcuts into the action that matters right now (record a payment, send a reminder, raise an invoice).
**Belongs here:** cross-module aggregate KPIs, attention-worthy alerts ("12 invoices overdue"), navigation shortcuts.
**Does not belong here:** transaction-level editing, invoice-creation forms, per-child ledger detail (link out to it instead), configuration of any kind.

### Fee Structures
**Purpose:** the reusable catalog of everything a school can charge for — tuition, admission, daycare (with its own tiering, e.g., per-hour/per-day/per-month), transport, activities, exam fees — defined once per class, program, or branch.
**Responsibilities:** defining fee items and their amounts, applicability rules (which class/program/branch), and effective date ranges (so a fee revision next academic year doesn't quietly change what's owed for the current one).
**Belongs here:** the "menu" — what *can* be charged.
**Does not belong here:** what *is* actually being charged to a specific child (that's Billing Plans), discount logic (a discount modifies what's charged, it doesn't define the fee itself), and payment collection.

### Billing Plans
**Purpose:** the bridge between the fee catalog and what actually happens, automatically, for a specific child — this is where the "Automation First" principle physically lives.
**Responsibilities:** attaching one or more fee-structure items to a student or family with a cadence (monthly, termly, one-time), a start/end window (e.g., "daycare add-on, February through May"), automatic generation on schedule, pause/resume (for extended leave), and proration rules for mid-cycle joins or withdrawals.
**Belongs here:** recurrence logic, per-student customization of the catalog, and the plan's own lifecycle (active/paused/ended).
**Does not belong here:** the actual invoice documents themselves (Invoices), or collecting payment.

### Invoices
**Purpose:** the actual bill — an itemized, immutable financial document generated either manually or by a Billing Plan.
**Responsibilities:** itemization (tuition + daycare + transport as separate line items on one bill, not one flattened amount), a status lifecycle, adjustments via credit note rather than silent edits, and voiding with a mandatory reason and audit trail.
**Belongs here:** the generated document and its line items and status.
**Does not belong here:** defining fee amounts (Fee Structures), the recurrence rule that created it (Billing Plans), or recording that it's been paid (Payments).

### Collections
**Purpose:** the operational, action-oriented view of "who owes money and what are we doing about it" — a work queue, not a second dashboard.
**Responsibilities:** overdue lists and aging buckets, reminder triggers (manual and scheduled), lightweight follow-up notes ("called the parent, they'll pay Friday"), and collection-efficiency reporting by class or branch.
**Belongs here:** action-oriented views and workflows built *around* outstanding money.
**Does not belong here:** raising invoices, recording payments directly (route into Payments instead), or recomputing its own version of the numbers already shown on the Finance Dashboard — this module and the Dashboard must visibly agree, always.

### Payments
**Purpose:** the record of money that has actually changed hands, by whatever method.
**Responsibilities:** recording cash, UPI, card, cheque, bank-transfer, or autopay payments; reconciling a payment against one or more invoices (a single payment might cover part of one bill or span several); partial-payment support; and tracking method and status (including a pending/failed state for gateway payments, not just a binary paid/unpaid).
**Belongs here:** the transaction record itself.
**Does not belong here:** generating the receipt document (Receipts), creating the invoice, or initiating a refund (a refund is a governed reversal, not a "negative payment").

### Receipts
**Purpose:** the parent-facing proof of payment — a trust artifact as much as a document.
**Responsibilities:** automatic generation on every payment, sequential and compliant numbering, an itemized breakdown, and easy sharing (WhatsApp, email, download) — plus a GST-compliant format wherever tax applies.
**Belongs here:** presentation and generation, tied one-to-one with a payment.
**Does not belong here:** any payment or invoice logic itself — a receipt only ever reflects what already happened.

### Discounts
**Purpose:** governed, named reductions to what a family owes — sibling discount, staff-child discount, early-bird, referral, and similar recurring categories.
**Responsibilities:** defining discount types and eligibility rules, whether approval is required (and at what threshold), application to specific billing plans or invoices, and expiry.
**Belongs here:** the rules and governance of *why* a family is paying less, on an ongoing basis.
**Does not belong here:** scholarships (see below — a distinct, more formally governed category), or a one-off negotiated adjustment on a single invoice (that's a credit note on the Invoice itself, not a standing Discount).

### Scholarships
**Purpose:** distinct from Discounts by design — a structured, often externally-visible commitment (need-based aid, merit scholarship, community sponsorship) that a school wants to track and report on separately, for its own impact story, trust-board reporting, or compliance if tied to any external program.
**Responsibilities:** defining scholarship programs or funds, an application/nomination and approval workflow, per-student award tracking, and reporting on total scholarship value granted.
**Belongs here:** structured, trackable, reportable aid programs.
**Does not belong here:** routine sibling or staff discounts (those live in Discounts), or payment collection.

### Refunds
**Purpose:** money owed *back* to a family — withdrawal, overpayment, a cancelled admission, or correcting an error.
**Responsibilities:** capturing the refund request and reason, an approval workflow with amount-based escalation, choosing the refund method (original payment method vs. a new bank transfer), linking back to the originating invoice/payment, and a full audit trail.
**Belongs here:** the governed, reverse-money-flow process.
**Does not belong here:** being handled as a quiet negative payment — a refund is inherently higher-risk than collecting money and deserves its own explicit status lifecycle and sign-off, never a shortcut.

### Reports
**Purpose:** turning the ledger into decisions — for the owner, the accountant, and eventually multi-branch leadership.
**Responsibilities:** collection summaries, outstanding/aging reports, GST/tax reports, discount and scholarship summaries, branch comparisons, export formats, and scheduled/emailed delivery.
**Belongs here:** read-only aggregation and export across every other module's data.
**Does not belong here:** any mutation of financial records whatsoever — a report can never change what actually happened.

### Finance Settings
**Purpose:** the infrequent configuration layer beneath everything else.
**Responsibilities:** GST registration details, receipt numbering format, payment gateway configuration, discount/refund approval thresholds, reminder cadence and message templates, and branch-level finance configuration.
**Belongs here:** one-time or rarely-touched setup.
**Does not belong here:** day-to-day operational data — if an owner finds themselves in Settings every week, something in the rest of the module has failed the "Simple Before Complex" principle.

---

## Deliverable 4 — User Roles

| Role | Responsibilities | Permissions | Typical workflow |
|---|---|---|---|
| **Owner** | Ultimate accountability for the school's finances; in a single-branch school, often personally performs day-to-day work too. | Full access to everything; the only role that can approve exceptions above the highest threshold (large discounts, large refunds). | Opens the Finance Dashboard first thing, glances at collection health, approves anything flagged for their attention, otherwise trusts the system to run itself. |
| **Super Admin** (KUE BOXS Care's own platform team) | Cross-tenant platform support and configuration — not part of any single school's daily operation. | Support-level access only, gated behind an explicit reason/audit trail; should never casually browse a school's financial detail. | Only engages when a school raises a support ticket that genuinely requires platform-level intervention. |
| **Accountant** | The finance specialist — configures fee structures, reconciles collections, runs compliance reports, manages exceptions at scale. | Full operational access to Fee Structures, Billing Plans, Invoices, Payments, Discounts, Refunds (within policy), and all Reports. | Sets up fee structures each academic year, runs the monthly reconciliation, prepares GST filings, approves routine refunds within policy. |
| **Center Admin** (multi-branch) | Owner-equivalent authority scoped to a single branch. | Everything an Owner can do, but limited to their own branch; cannot see other branches' data. | Runs their branch exactly as a single-school Owner would, escalating only cross-branch or above-threshold decisions upward. |
| **Reception** | Front-line, day-to-day operational execution. | Can record a payment received at the desk, print/share a receipt, and answer "how much does this family owe" — cannot create or edit fee structures, cannot approve discounts or refunds. | Takes a cash or UPI payment from a parent at pickup, records it in seconds, hands over (or shares) the receipt. |
| **Teacher** | Effectively no general finance access. | Narrow, specific visibility only where it gates something operational — e.g., whether a child's transport or activity fee is current, if that affects program participation. Never general ledger or invoice access. | Glances at a single "is this child's daycare fee current" indicator before allowing participation in an add-on activity, if the school's policy requires it. |
| **Parent** | Self-service payer and record-keeper for their own family. | Full read access to their own child(ren)'s ledger only; can pay, download receipts/invoices, see applied discounts/scholarships, and request/track a refund. Zero visibility into any other family's data or any internal staff notes. | Gets notified an invoice is due, opens the portal, sees the itemized breakdown, pays their preferred way, receives a receipt automatically — no staff interaction needed for the common case. |

---

## Deliverable 5 — Core Workflows

**New Admission → First Invoice.** Once an admission is confirmed, Finance already knows the child's class and chosen programs — nothing gets re-entered. The relevant fee structures (tuition, admission fee, and any add-ons chosen at enrollment like daycare or transport) are suggested automatically; the accountant or owner confirms or adjusts, especially for proration if the child is joining mid-term. The first invoice is generated as a distinctly warm "welcome" bill, not a routine monthly one — the family's very first bill should feel like part of onboarding, not a cold transaction.

**Monthly Billing.** On a configured date, every active billing plan generates that month's invoices automatically, across every enrolled child, without anyone touching it — unless a plan needs a mid-cycle change (a withdrawal, a new add-on). Parents receive their invoice on a predictable schedule they come to expect. The owner sees one summary of "this month's billing run," not two hundred individual invoice-creation actions.

**Parent Payment.** The parent is notified an invoice is due, opens their view, sees the full itemized breakdown, and pays through whichever method they prefer (UPI, card, autopay). A receipt is generated and delivered automatically, and the ledger updates in real time — no staff involvement required for the common case.

**Partial Payment.** A parent pays less than the full amount owed — a very common pattern in India (tuition now, daycare later, for example). The system tracks the partial payment transparently against the invoice, the remaining balance carries forward clearly, and any subsequent reminder reflects only what's actually still owed, never double-counting.

**Refund.** Triggered by a withdrawal, an overpayment, or a correction. The requester states a reason, and the request routes to the right approver based on amount — reception cannot approve a refund, an accountant or owner can within policy, and anything above a larger threshold needs sign-off from both. Once approved, the refund is processed (ideally back through the original payment method), the parent is notified with a clear explanation, and the ledger reflects the reversal with a full audit trail.

**Student Withdrawal.** Initiated wherever the student's enrollment is closed out. Finance is notified automatically: active billing plans pause or end, any outstanding balance is settled (or a final invoice/refund is triggered), and any discounts or scholarships tied to that student are closed out cleanly. The family receives a clear final statement for their own records.

**Daycare Billing.** This is the workflow that most differentiates KUE BOXS Care from school-only ERPs. Daycare runs on a fundamentally different rhythm — continuous or attendance-driven rather than fixed-term — and sometimes needs to reconcile against actual attendance (a school may or may not choose to prorate for absent days, and that policy should be configurable per school). Crucially, daycare charges should combine onto the *same* invoice as a child's regular tuition when applicable, rather than requiring a completely separate billing system.

**Transport Billing.** Usually route- or zone-based, with its own start/stop cycle independent of the academic term (a family might add or drop transport mid-year). It should behave as an add-on line item on the regular invoice, not require standing up a parallel invoicing process.

**Activity Billing.** Typically one-off or short-cycle (a term of an extra-curricular class, a field trip) — closer in shape to a one-time invoice than a recurring billing plan. Families should be able to opt in per activity without the system forcing the overhead of a full recurring plan for something that happens once or twice a year.

**Scholarship Approval.** A need or merit case is raised — by a teacher noticing a family's situation, by a parent applying directly, or at owner discretion — and goes through a deliberately more formal approval path than a routine discount, since it may require documentation and visibility to a trust board or external funder. Once approved, it applies automatically to the relevant billing plan going forward, and is tracked separately so the school can report on its own impact.

---

## Deliverable 6 — Success Metrics

### Operational KPIs

- **Collection Rate** (collected ÷ billed, this period) — the single most important number an owner checks; it's the direct answer to "is billing actually turning into cash."
- **Outstanding Fees** (total ₹ currently unpaid) — real-time cash-flow visibility that directly informs payroll and rent decisions, which run on thin margins at most schools.
- **Collection Efficiency** (the trend of Collection Rate over time) — distinguishes "we had one slow month" from "we are structurally bad at collecting," which calls for a different response entirely.
- **Average Payment Delay** (days between due date and actual payment) — tells you whether reminders and policy are actually working, independent of the raw collection number.
- **Invoice Automation %** (invoices generated by a billing plan vs. created manually) — the truest test of whether "Automation First" is landing in daily practice, not just in the pitch. This is the one KPI that, if it stays low, means the redesign has failed at its central premise.

### Business KPIs

- **Parent Payment Adoption** (share of payments made through parent self-service vs. staff-recorded cash/cheque) — a direct proxy for how much manual staff time is actually being saved, and how modern the parent experience genuinely feels in practice.
- **Time Saved** (estimated staff-hours no longer spent on manual invoicing, reminders, and reconciliation) — the ROI story that justifies the automation investment to the owner.
- **Revenue Visibility** (how confidently and quickly an owner can answer "what will I collect next month") — a forecasting-confidence metric, not just a historical-accuracy one.
- **Reminder Effectiveness** (share of overdue invoices paid within a set window of an automated reminder, versus without one) — proves reminders are actually recovering money, not merely irritating parents.
- **Dispute/Correction Rate** (share of invoices later voided or corrected after generation) — a data-quality and trust signal distinct from the collection metrics above; a rising rate here means something upstream (fee structures, billing plans) is misconfigured or unclear, well before it shows up as a collection problem.

---

## Deliverable 7 — MVP vs Advanced vs Enterprise

### MVP — must-have for launch

| Capability | Why it's MVP |
|---|---|
| Fee Structures (core categories: tuition, admission, daycare, transport) | No school can operate without a basic fee catalog. |
| Billing Plans (recurring monthly generation, pause/resume, mid-cycle proration) | This is the automation promise itself — without it, KUE BOXS Care is no improvement on the current implementation. |
| Invoices (multi-line-item, status lifecycle, void with reason) | The itemization fix is what actually enables daycare + tuition to coexist on one bill — the core differentiator. |
| Payments (cash/UPI-QR/cheque/bank-transfer, partial-payment support) | Every school needs to record money changing hands from day one, in whatever form parents actually pay. |
| Receipts (auto-generated, shareable) | A missing or manual receipt is an immediate, visible trust failure — this cannot be deferred. |
| Collections (overdue list, basic reminders) | The most common daily action an owner takes; must exist from day one. |
| Finance Dashboard (today/month collected, outstanding, overdue) | The single view that replaces the owner's mental model of "who owes what." |
| Discounts (basic named types: sibling, staff) | These are near-universal in Indian preschools; deferring them would force a workaround immediately. |
| Basic Reports (collection summary, outstanding/aging) | The minimum an owner or accountant needs to make a weekly decision. |
| Finance Settings (GST number, receipt format, reminder templates) | One-time setup a school needs before its first invoice goes out. |
| Parent self-service view + payment | Central to Parent Transparency — without it, the module hasn't actually changed the parent experience at all. |

### Advanced — needed for growing schools

| Capability | Why it's Advanced, not MVP |
|---|---|
| Scholarships as a distinct governed program | Only becomes necessary once a school has enough scale or external funding relationships to need formal tracking — a small school can handle this as a manual discount initially. |
| Refunds with a formal approval workflow | Real, but low-frequency early on; a small school can absorb an ad hoc process until volume demands governance. |
| GST-proper tax engine (rate tables, CGST/SGST, HSN) | Compliance depth that matters more as revenue and formality grow — early-stage schools can operate with the simpler flat-tax MVP approach while this is built out (pending the open regulatory question in Deliverable 8). |
| Payment gateway beyond UPI-QR (card/net-banking/autopay) | UPI-QR alone covers the dominant Indian payment habit at MVP; broader gateway support matters more as parent expectations rise with scale. |
| Activity/transport billing as distinct fee categories with independent cycles | A refinement on top of the MVP's basic categories, valuable once a school runs enough distinct add-on programs to need it. |
| Advanced Collections (aging buckets, follow-up tracking, efficiency reporting) | Meaningful once a school has enough volume that "just look at the list" stops being sufficient. |
| Scheduled/exportable reports | An accountant's convenience feature once reporting cadence becomes routine, not existential at MVP. |
| WhatsApp/SMS reminder automation with configurable cadence | An enhancement on top of the MVP's basic reminder capability, once a school wants to tune tone and timing rather than accept sensible defaults. |

### Enterprise — needed only by large chains

| Capability | Why it's Enterprise-only |
|---|---|
| Multi-branch/cost-center consolidated reporting | Irrelevant to any single-branch school; only matters once an owner is comparing performance across locations. |
| Center Admin role with branch-scoped permissions | Only exists as a concept once there's more than one branch to scope against. |
| Chart-of-accounts-style accounting rigor, bank reconciliation | This is genuine accounting-department territory, well beyond what an owner-operator needs day to day. |
| Forecasting/predictive analytics | A sophistication layer that only pays off once there's enough historical data and organizational scale to act on a forecast meaningfully. |
| Custom receipt numbering per branch/trust entity | A compliance nuance that only matters for larger, more formally structured organizations (trusts, franchises). |
| Enterprise-scale invoice-generation performance across thousands of students | Simply not a constraint any single school will hit; premature to design for at MVP. |

---

## Deliverable 8 — Risks & Open Questions

These must be resolved — ideally with real domain expertise, not internal assumption — before engineering begins on the corresponding capability.

- **Multi-campus billing.** Does a family with children at two branches of the same chain get one consolidated invoice/ledger, or two separate ones? This decision shapes the scope of "One Source of Truth" and should be settled before any multi-branch work starts.
- **GST compliance.** Are preschool and daycare fees GST-exempt, partially exempt, or fully taxable under current Indian regulation — and does the answer change between core education, daycare, and add-ons like transport? This needs confirmation from a qualified chartered accountant, not an internal assumption, before the tax engine is designed.
- **Regional tax differences.** Does the platform need to support schools across states with differing local levies, or is GST the only tax surface in scope? This depends on how broad the target market is meant to be.
- **Offline collections.** In smaller towns, cash and cheque may remain dominant for years. How much should the product optimize for low-connectivity, offline-first operation — and how does an owner reconcile a batch of cash collected at pickup when connectivity is unreliable?
- **Payment gateway strategy.** Which gateway partner, and does KUE BOXS Care become a payment facilitator (with its own compliance obligations) or stay a pure pass-through integrator? This is a business decision with real legal weight, not just a technical choice.
- **Refund policy.** Is there one platform-wide default refund policy (notice period, prorated percentage, non-refundable admission fee), or does every school configure its own? This is a business and legal question that should be settled before the Refunds workflow is finalized.
- **Scholarship governance.** Does scholarship data need to be visible or exportable to an external trust board or funder in some schools, implying an audit-grade record-keeping requirement? This affects how formally the Scholarships module needs to be built even at launch.
- **Family vs. student billing unit.** Is the ledger fundamentally per-child or per-family? Sibling discounts are inherently family-level, but a parent still wants to know each child's status individually. This single decision affects nearly every workflow described above and should be made explicitly and early, not left implicit.
- **Mid-cycle withdrawal proration policy.** Is there one default rule for what a family owes or is owed back when a child leaves mid-month or mid-term, or is this per-school configuration? Needed before the Withdrawal workflow can be finalized.
- **Migration of existing data.** Schools already using the current, simpler Finance implementation will have historical invoices and payments in the old single-amount shape. Does history stay "frozen" in its original form, or is there a migration path into the new itemized/billing-plan model? This needs a decision before the new model launches, not after.

---

## One-Page Finance Product Blueprint Summary

**Why Finance exists:** to protect the trust between a school and the families it serves, by making money visible, honest, and effortless — for the owner who shouldn't have to remember who owes what, and for the parent who should never have to ask.

**The wedge:** KUE BOXS Care is the only platform built around the reality that one child can be billed on multiple concurrent rhythms — fixed-term tuition, continuous daycare, ad hoc transport, seasonal activities — on a single coherent account, rather than forcing daycare into a school-billing shape or vice versa.

**The nine principles every feature must honor:** Automation First · Simple Before Complex · One Source of Truth · Parent Transparency · Owner-Focused Insights, Accountant-Ready Detail · Mobile-First · Minimal Manual Work · Scalable Across Single and Multi-Branch · Design for the Relationship, Not Just the Transaction.

**The shape:** twelve modules — Finance Dashboard, Fee Structures, Billing Plans, Invoices, Collections, Payments, Receipts, Discounts, Scholarships, Refunds, Reports, Finance Settings — all reading and writing one Student/Family Ledger, never computing their own private version of the truth.

**The test of success:** an owner who, asked "how's collection this month," answers in five seconds from their phone with total confidence — and has forgotten what it felt like to personally chase a parent for money. Measured concretely by Collection Rate, Invoice Automation %, and Parent Payment Adoption climbing together, not in isolation.

**What ships first (MVP):** billing plans that actually automate, multi-line-item invoices that let daycare and tuition live on one bill, real-time parent self-service, and a dashboard that replaces the owner's mental notebook. **What waits:** formal scholarship governance, deep GST tooling, multi-branch consolidation, and forecasting — real, but not what makes or breaks the first version.

**What must be decided before a line of Finance code is written:** whether the ledger is per-child or per-family, what GST actually requires for this specific business (education vs. daycare vs. transport), the refund policy, and the payment gateway strategy. These are business and regulatory decisions, not engineering ones — and the redesign should not proceed past planning until they have real answers.

---

*This document is a product strategy artifact only. No code, APIs, database schema, or engineering estimates are proposed here, by design. It should be read alongside `docs/engineering-audit/FINANCE_MODULE_AUDIT.md` (what exists today) as the two foundations for the Finance redesign.*
