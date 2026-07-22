# KUE BOXS Care — Finance Foundation
## Production Rollout Plan

**Date:** 2026-07-21 (revised same date: Phase 0 split into Technical Readiness / Operational Readiness, per review)
**Status:** Approved, with one structural change incorporated (Phase 0 split into 0A/0B below). No rollout has begun. `FINANCE_FOUNDATION_ENABLED` remains unset everywhere. Nothing in this document should be executed until each phase's own work is separately approved, following the same rhythm as every prior planning document in this project.
**Depends on:** the Finance Foundation architecture, now considered complete (`ADR-0001`, `ADR-0002`), validated twice end-to-end (`08_SPRINT3_VALIDATION.md`, `10_SPRINT4_VALIDATION.md`) with zero open defects. This plan does not propose any further Finance *feature* work — per your own instruction, "no further architectural work should be undertaken unless a future requirement genuinely requires it and is documented through a new ADR." Everything below is about **introducing** the already-complete platform safely, not building more of it.

**Rollout flow:**

```
Technical Readiness (0A)
        ↓
Operational Readiness (0B)
        ↓
Internal Staff Testing (1)
        ↓
Single-School Pilot (2)
        ↓
Gradual Expansion (3)
        ↓
General Availability (4)
```

---

## Two findings that materially shape this plan — read before the phases below

Rollout planning surfaced two real, concrete gaps that engineering validation had no reason to catch, because they aren't Finance *logic* defects — they're **rollout-readiness** gaps. Both are stated honestly here rather than glossed over, matching this project's standing practice. Splitting Phase 0 into Technical vs. Operational Readiness (below) exists specifically because these two findings are different *kinds* of gap — one is platform capability, the other is people-and-process — and conflating them made the original single Phase 0 harder to track.

### Finding 1 — There is no staff-facing UI yet

Every Finance Foundation sprint (1 through 4) was explicitly backend-only, by deliberate constraint, every time: "zero frontend/UI changes" is a fact repeated across every sprint's own scope. The 17 API endpoints that exist (`/api/finance/*`) are real, tested, and correct — but there is no screen a non-engineering staff member could open to record a payment, generate an invoice, or request a refund. **"Internal staff testing" and "pilot rollout to one centre," as commonly understood, cannot happen yet** — there is nothing for a real member of staff to click. This is not a Finance defect; it is the natural, expected consequence of a backend-first build strategy that was never asked to include UI work. It has to be named as a prerequisite, not discovered partway through a "staff testing" phase that turns out to be impossible. This is an **Operational Readiness** gap (Phase 0B) — it blocks people from using the platform, not the platform's own correctness.

### Finding 2 — The feature flag is global, not per-school or per-centre

`requireFinanceFoundationFlag` checks a single process-wide environment variable (`FINANCE_FOUNDATION_ENABLED`). It has no concept of *which* school or centre is asking — turning it on turns Finance Foundation on for **every** tenant simultaneously. There is no existing mechanism to enable it for one pilot centre while every other school stays on the legacy flow. Checked against the actual tenant model (`tenantService.js`: `tenants/{tenantId}.branches: [{branchId, centerId, ...}]`) and the real per-request scoping (`requestScope.js`: `schoolId` comes from `req.user.schoolId`, `centerId` is a per-user/per-record attribute, not a settings-level partition key) — **Finance Foundation's own data model is schoolId-scoped throughout** (one `financeSettings` doc per school; no per-centre Finance settings exist anywhere). A true *centre*-level pilot doesn't map onto the current architecture at all. A *school*-level pilot does, cleanly, extending the existing tenant model — the natural, minimal fix is a per-school override read from the tenant's own document, checked in addition to the existing env var (which becomes the platform-wide kill switch / default-off gate, exactly as it is today). This is a **Technical Readiness** gap (Phase 0A) — it's a platform capability that has to exist before selective rollout is even possible, independent of who is using it.

**Recommendation on scope, not yet built:** treat "one centre" as **one single-branch pilot school** for this rollout (the closest honest match to what the architecture actually supports), and treat "a per-school Finance Foundation toggle" as a small, additive Technical Readiness item (Phase 0A below) — genuinely new, narrowly-scoped rollout infrastructure, not a Finance feature, and small enough not to need its own ADR under the freeze's own rules (extends `tenantService.js`, doesn't reshape any frozen Service Contract or Event).

---

## Phase 0A — Technical Readiness

**What this phase is:** platform capabilities that must exist before *any* rollout activity, independent of who is using the system. None of this is Finance business logic — it's rollout infrastructure sitting alongside the already-complete Finance Foundation.

| Item | What it is | Why it blocks everything after it |
|---|---|---|
| **Per-school feature flag** | Add `financeFoundationEnabled: boolean` to the `tenants/{tenantId}` document (extends the existing tenant model, no new collection); `requireFinanceFoundationFlag` checks `process.env.FINANCE_FOUNDATION_ENABLED === "true"` **AND** the requesting user's tenant has this field `true` — the env var stays the platform-wide default-off kill switch, the tenant field becomes the actual per-school on/off control. | Without this, "enable for internal testing first" and "pilot rollout to one centre" are not technically possible — the flag is all-or-nothing today. |
| **Rollout monitoring** | A scheduled job (daily, per school with the flag on) that re-runs the exact reconciliation check already proven in both validation suites (`ledger.currentBalance == sum of its entries' signedAmount`) against real data, plus a spot-check that every Payment/Refund/Invoice created in the last 24h has a matching `financeAuditLogs` entry. Alerts (even a simple internal Slack/email notification) on any mismatch. | Without this, a real data-integrity problem during the pilot would only be found by accident, not by design — unacceptable for a financial system. |
| **Health checks** | A lightweight, on-demand readiness check per tenant with the flag on — confirms `financeSettings` exists and is readable, the last scheduled reconciliation run completed without error, and the Finance Foundation routes are actually registered for that tenant (a direct check against the same route-tree property Sprint 3/4's own validation suites already inspect, not a new mechanism). Callable manually before/during a rollout wave, not just as a passive background job. | Distinct from ongoing monitoring (which watches for problems continuously) — this is a deliberate, on-demand "are we actually ready to flip this tenant on" check, run *before* every enablement, not just after. |
| **Rollback infrastructure** | Formalizes what's already an architectural property (below) into an actual, runnable mechanism: a single, named script/command that flips a specific tenant's `financeFoundationEnabled` back to `false` and confirms (via the health check above) that the tenant's Finance routes are no longer registered — not a manual multi-step Firestore-console edit under pressure. | Rollback being *theoretically* instant and safe (per the architecture) is different from it being *operationally* instant — under real incident pressure, "which field, which document, who's authorized" needs to already be a rehearsed, one-command action, not reconstructed live. |

**None of Phase 0A has been built.** Building it is a separate, explicit next step requiring your go-ahead, same as every prior piece of Finance work.

---

## Phase 0B — Operational Readiness

**What this phase is:** preparing people and process, not infrastructure. Depends on Phase 0A existing (there's no point training staff on a UI that can't yet be selectively enabled for them), but is otherwise independent work — the UI, docs, and training materials don't need the per-school flag to be *built*, only to be *available* before anyone actually starts using them for real.

| Item | What it is | Why it blocks everything after it |
|---|---|---|
| **Minimal staff-facing UI** | The smallest usable set of screens: (a) record a payment against a family, (b) view a family's ledger/outstanding invoices, (c) generate a manual invoice from an active Billing Plan (M3.4's endpoint already exists), (d) request/approve/reject a refund, (e) view a payment/refund's status and receipt number. Every one of these already has a tested, working API — this is UI work only, not new backend logic. | Without this, no real staff member can use Finance Foundation at all; "internal staff testing" would otherwise mean engineers calling REST endpoints on staff's behalf, which validates nothing about real usability. |
| **User documentation** | A short, scenario-based staff guide — reusing the exact realistic scenarios already validated twice (record a payment, allocate across siblings, request a refund, etc.) as real walkthroughs with real screenshots once the UI exists, not abstract API documentation. | Staff testing (Phase 1) and pilot staff (Phase 2) need something concrete to follow — "figure it out" is not an acceptable onboarding plan for a financial workflow. |
| **Staff training** | A short, live walkthrough session (not just handing over the document above) for the first cohort of internal testers, who then become the trainers/champions for the pilot school's own staff in Phase 2. | Financial workflows carry real consequences for getting them wrong — a document alone doesn't confirm understanding the way a live walkthrough with questions does. |
| **Pilot preparation** | Selecting the actual pilot school ahead of time (single branch/centre, moderate transaction volume, an engaged admin/accountant willing to give direct feedback, ideally not simultaneously onboarding to the platform generally), and setting up the operational-support pieces described below (named point of contact, feedback log) *before* Phase 2 starts, not scrambled together once it has. | Doing this during Phase 2 itself wastes the pilot's own limited window on setup instead of on actually testing the workflows. |

**None of Phase 0B has been built.** Same status as 0A — planned, not started.

---

## Phase 1 — Internal Staff Testing

**Environment:** the real, single production Firebase project (`yellowdot-app` — there is no separate staging project today) — but scoped to a **dedicated internal-test tenant**, not any real school. Creating an additional tenant costs nothing on a multi-tenant SaaS platform and is the cleanest way to exercise real production infrastructure (real Firestore, real Cloud Functions, real Firebase Auth) without any risk to a real school's data.

**Who:** actual non-engineering staff (ops/finance team members), not developers — the whole point is testing the Phase 0B UI and real operational workflows, which engineering-only testing cannot validate.

**What:** staff work through the same realistic scenarios already proven in `08_SPRINT3_VALIDATION.md`/`10_SPRINT4_VALIDATION.md` (new admission billing, proration, sibling discount, payment recording, partial/overpayment, credit consumption, refund request/approval, reversal) — but through the actual UI, on the actual internal-test tenant, not via API calls.

**Duration:** suggest 1–2 weeks, long enough to cover a realistic mix of scenarios, short enough to keep momentum.

**Exit criteria before Phase 2:** every core workflow completed by staff without engineering intervention; zero data-integrity issues found by Phase 0A's monitoring during this window; any UI friction points identified and fixed.

---

## Phase 2 — Single-School Pilot

**Selection criteria for the pilot school:** already decided during Phase 0B's pilot-preparation work — single branch/centre (per Finding 2's scoping clarification above), moderate rather than peak transaction volume, an engaged school admin/accountant willing to give direct feedback, and ideally a school already comfortable with the platform generally.

**Enablement:** flip the Phase 0A per-school tenant field `true` for that one tenant only, using the rollback-infrastructure tooling's counterpart (an equally deliberate "enable" command, not just its rollback half) so enabling and disabling are both single, auditable actions. Every other school continues on the legacy manual invoice/payment flow, completely unaffected — this is the central safety property the whole Finance Foundation architecture has been built around since Sprint 1 ("the application should behave exactly as it does today" for everyone not explicitly opted in).

**Scope during the pilot:** Finance Foundation runs **alongside**, not in place of, the legacy flow. No historical data is migrated (see "Data Migration" below) — the pilot school's existing invoices/payments stay exactly as they are; only new activity during the pilot window uses the new system, at the school's own pace.

**Duration:** suggest 4–6 weeks — long enough to span at least one full billing cycle (a real month of tuition/daycare invoicing, at least one real payment/refund cycle).

**Monitoring:** daily reconciliation (Phase 0A) specifically for this tenant; the direct feedback channel and named point of contact set up during Phase 0B's pilot preparation; a weekly internal check-in reviewing audit logs and any support requests.

---

## Phase 3 — Gradual Expansion

Only after Phase 2's success criteria (below) are met. Expand in small waves (e.g., 2–3 schools at a time), never "all schools at once," repeating the same monitoring rigor for each wave, and running Phase 0A's health check before every wave's enablement. Each wave's own success should be confirmed before starting the next — this is the same "one milestone, verified, before the next" discipline used throughout Sprints 1–4, applied to rollout waves instead of code milestones.

---

## Phase 4 — General Availability

Finance Foundation is considered generally available once every currently-active school has either been onboarded (per the wave process above) or made a deliberate choice to stay on the legacy flow for the time being — general availability means the *option* is fully rolled out and proven, not that every school has necessarily switched. At this point Finance Foundation graduates from "rollout in progress" to "a normal, supported platform capability" — ongoing monitoring (below) continues indefinitely as standard operations, not as a rollout-specific activity.

---

## Monitoring & Rollback Strategy

**Rollback is already a proven, near-zero-risk property of this architecture — stated with real confidence, not just planned as an intention:**
- **Instant and total.** Flipping the tenant-level flag (Phase 0A) or the global env var back off immediately stops the routes from even being registered in the Express routing tree for that tenant (Sprint 1's Mandatory Change 1) — not just a 404 at the middleware layer, but genuinely absent from the routing table.
- **Zero data loss.** Every Finance Foundation write is additive to collections the legacy flow either doesn't touch (`studentLedgers`, `ledgerEntries`, `billingPlans`, `financeSettings`, `payments`/`invoices` with a `source: "financeFoundation"` marker distinguishing them from legacy records) — turning the flag off does not delete or hide any data, it only stops new Finance Foundation activity. A rolled-back school's staff simply resume using the legacy flow exactly as before; existing Finance Foundation records remain in Firestore, inert, available for whenever rollout resumes.
- **No customer-visible downtime.** Because there is no staff UI dependency inverted the other way (the legacy flow's own screens are completely untouched by any Finance Foundation code, per every sprint's explicit constraint), turning Finance Foundation off for a school does not break anything else that school uses.
- **Operationalized, not just architectural, as of Phase 0A.** The rollback-infrastructure deliverable turns the above into a single rehearsed command rather than a live-incident Firestore edit.

**Ongoing monitoring (beyond Phase 0A's daily job):**
- Weekly manual review of `financeAuditLogs` for every tenant with the flag on — confirm the audit trail is complete and legible, not just present.
- Track the two operational health signals every prior validation suite already proved trustworthy: reconciliation match rate (should be 100%, always) and the ratio of `VALIDATION`/`NOT_FOUND` error responses on Finance routes (a sudden spike signals either a UI bug feeding malformed requests or a real attempted misuse).

**Rollback trigger criteria (any one of these triggers an immediate rollback for the affected tenant, not a "let's discuss"):**
- Any reconciliation mismatch (a ledger's balance disagreeing with the sum of its own entries) — this should be structurally impossible per the architecture, so its occurrence means investigate immediately and roll back that tenant while investigating.
- Any staff-reported financial discrepancy a spot-check confirms is real.
- Any audit log gap (a financial write with no corresponding audit entry).

---

## Data Migration

**Explicitly out of scope for this rollout, by design — not deferred by oversight.** Every pilot and rollout-wave school starts Finance Foundation "clean," with no historical invoice/payment data backfilled into the new Student Ledger / Invoice / Payment model. This matches the constraint every single sprint since Sprint 1 has stated: "do not migrate production data." A future, separately-approved migration effort (the Domain Architecture's own Chapter 2, Part 9 and its M6 "Legacy cutover" milestone) is a distinct, later initiative with its own reconciliation-audit requirements — not part of introducing Finance Foundation to new schools going forward. If and when real migration is approved, it should get its own plan document with the same rigor as this one, not be folded into rollout waves.

---

## User Training

Built once, in Phase 0B (the UI has to exist before there's anything to train staff on); delivered repeatedly after that. Phase 1's internal testers are the first cohort trained — they become the trainers/champions for Phase 2's pilot school's own staff, who in turn become a reference point for each Phase 3 expansion wave's staff before their own flag flips on.

## Operational Support

- A named internal point of contact for Finance Foundation questions during Phases 1–3 (not a generic support ticket queue), set up during Phase 0B — given the financial stakes, a slow or generic response during early rollout risks eroding trust in the new system before it's earned any.
- The Phase 0A rollback-infrastructure command as the actual answer to "who do we even ask" — rollback should never be blocked on reconstructing a procedure under pressure.
- A running log of pilot-school feedback, reviewed weekly during Phase 2 — feature requests get triaged separately from genuine defects; a defect during the pilot phase should be treated with the same urgency as anything already caught in a validation suite.

---

## Success Criteria for Wider Rollout (gate before Phase 3 expansion, and before declaring Phase 4 General Availability)

- **Zero reconciliation mismatches** across the entire pilot window, for every tenant with the flag on.
- **Zero confirmed data-integrity incidents** (a staff-reported discrepancy that turns out to be real).
- **Staff self-sufficiency**: pilot-school staff complete core workflows (record payment, allocate, request refund) without engineering support after their initial training.
- **Neutral-to-positive staff feedback** — no workflow regression versus the legacy flow staff were already used to.
- **100% audit trail completeness** confirmed via a manual spot-check across a sample of pilot-period transactions, not just an automated check (a human should look at real records, not only trust the daily job).

---

*This document is a plan only. No rollout has begun, no Phase 0A/0B work has been built, and `FINANCE_FOUNDATION_ENABLED` remains unset everywhere. Development or rollout activity should not begin on any phase above until this plan — and, in practice, each phase's own work — is explicitly approved.*
