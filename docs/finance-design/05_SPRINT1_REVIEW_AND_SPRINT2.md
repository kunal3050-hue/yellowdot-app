# KUE BOXS Care — Finance Foundation
## Sprint 1 Review Fixes + Sprint 2 (Admission Integration)

**Date:** 2026-07-21
**Status:** Implemented, tested, not yet deployed. Feature-flagged off by default (unchanged from Sprint 1).

---

## Part A — Sprint 1 Review: Mandatory Changes

### Mandatory Change 1 — Route registration moved out of middleware-only gating

`server.js` no longer unconditionally mounts the four Finance Foundation routers and relies solely on per-request middleware to 404 disabled requests. The mounting itself is now conditional:

```js
if (process.env.FINANCE_FOUNDATION_ENABLED === "true") {
  app.use(ledgerRoutes);
  app.use(billingPlanRoutes);
  app.use(familyAccountRoutes);
  app.use(financeSettingsRoutes);
}
```

`requireFinanceFoundationFlag` remains inside each route file as a second, defense-in-depth layer, per the review's own instruction ("the middleware may still remain as an additional safety layer"). Verified with a dedicated test (`test/financeFoundationSprint2.test.js`) that constructs a minimal Express app using the real `ledgerRoutes` module and confirms the router is absent from the routing tree entirely when the flag is unset, and present when it's `"true"`.

### Mandatory Change 2 — Finance Event Publisher

New `services/financeEventPublisher.js` — an in-process `EventEmitter`, no broker, no persistence, matching the instruction exactly ("no listeners required, no automation required, no message broker required, an internal event publisher... is sufficient"). No new infrastructure was introduced; the platform has none of this kind today, so a plain `EventEmitter` is the only choice consistent with "reuse, extend, never rebuild."

Four events, emitted from exactly the point each already-existing service completes the corresponding write:

| Event | Emitted from |
|---|---|
| `StudentLedgerCreated` | `studentLedgerService.createLedger()` — only on genuine creation, not on the idempotent "already exists" return path |
| `BillingPlanCreated` | `billingPlanService.create()` |
| `FamilyAccountCreated` | `familyAccountService.ensureFinanceAccount()` — only when a new finance facet is actually created, not when an existing one is returned |
| `FinanceSettingsChanged` | `financeSettingsService.updateSettings()` |

A publish-time listener failure is caught and logged inside `publish()` itself — it can never surface as a failure of the financial write that triggered it. No listener exists yet (by design); the contract is established so a future consumer (Billing Automation, Collections, Parent Portal, Reports, Notifications, AI Finance) can subscribe without any change to the publishing side.

---

## Part B — Sprint 1 Review: Recommended Improvements

### Recommended Improvement 1 — FinanceTransaction abstraction

New `services/financeTransaction.js`, exporting `runFinanceTransaction(descriptor, work)` — wraps a Firestore transaction, then (only after it commits) writes the audit log entry and publishes a domain event if one is specified in the descriptor. This is the exact shape already hand-written inside `ledgerEntryService.createEntry()`.

**Not adopted by the five existing Sprint 1 services** in this pass — they are already implemented, tested, and verified with zero regressions, and rewiring working code to a new abstraction without being asked carries real risk for no immediate benefit, per the review's own "does not need to be fully adopted immediately." It genuinely has no natural call site in Sprint 2's new code either (`admissionFinanceService.js` orchestrates calls to other services, each of which already owns its own transaction — there's no new, direct multi-document write in Sprint 2 that would need wrapping). It remains available, real, and unit-tested (`test/financeFoundationSprint2.test.js`) for the first future service that genuinely needs one atomic transaction across multiple documents.

### Recommended Improvement 2 — Domain Value Objects

New `domain/valueObjects.js` (a new top-level folder, deliberately separate from `services/` — these are pure, dependency-free types, not Firestore-backed services): `Money`, `Percentage`, `BillingPeriod`, `LedgerBalance`, `FeeAmount`. All immutable (`Object.freeze()`'d instances, every operation returns a new instance).

**Not adopted inside the five Sprint 1 services** (same reasoning as above — they already work correctly with plain numbers, and rewiring them isn't this pass's job). `admissionFinanceService.js` uses `Money` in one place (a diagnostic log line for a draft billing plan's amount) since that's new code with nothing to risk — a small, honest proof that the type is real and usable, not a forced full adoption.

### Recommended Improvement 3 — Frozen Service Contracts

`docs/finance-design/04_SERVICE_CONTRACTS.md` — documents `StudentLedgerService`, `BillingPlanService`, `FamilyAccountService`, and `FinanceSettingsService`: responsibilities, public methods, inputs/outputs, error behavior, and domain invariants, without exposing implementation detail. This is the stable interface future Finance work (and this sprint's own `admissionFinanceService.js`) is written against.

---

## Part C — Sprint 2: Admission Integration

**Scope, exactly as instructed:** Admission → Family Account creation, Admission → Student Ledger creation, Admission → Billing Plan creation, Admission → Domain Event publication, Admission → Finance audit trail. Nothing else — no invoice generation, no recurring billing, no payment automation, no Collections, no Parent Finance Portal, no production migration.

### New: `services/admissionFinanceService.js`

Two entry points, both designed around one hard resilience contract: **a failure anywhere inside this file must never surface as a failure of the real, working endpoint that calls it.**

- **`onStudentAdmitted({ studentId, schoolId, centerId, familyId, feeTemplateId, actorUserId })`** — called once, right after a student record is created.
  - Always creates the Student Ledger.
  - If `familyId` is already known at admission time, ensures the Family Account facet exists (idempotent).
  - If `feeTemplateId` is supplied, creates a Billing Plan — always in `draft` status, since nothing anywhere activates one yet. **In practice, this step is a no-op today**: the current admission UI (`StudentWizard`) does not send a `feeTemplateId` — its Fees step still discards that data, exactly as found in Chapter 1's audit. The integration point is real and ready; it activates the moment that field is wired up, without any change needed here.
  - Each step is individually try/caught — a Family Account failure never blocks the Billing Plan attempt, and vice versa. Only a Ledger creation failure short-circuits the rest (there's nothing to safely attach a plan or family link to without a ledger).

- **`onStudentLinkedToFamily({ familyId, studentId, schoolId, actorUserId })`** — called after a student is linked to a family. Ensures the family's Finance Account facet exists. This is the correct trigger point for Family Account creation, not `onStudentAdmitted` — Chapter 1's own audit found that family linking happens through a *separate* endpoint (`POST /api/families/:familyId/students/:studentId`) from student creation, not bundled into the admission payload itself.

### Call sites (both feature-flagged, both fire-and-forget with logged-not-thrown failures)

- **`server.js`, `POST /add-student`**: right after the existing auto-pickup-creation block (same file, same established "fire-and-forget, don't fail the caller" pattern already used there), and before the response is sent. Reads `familyId`/`feeTemplateId` from the request body if present — today they never are, so in production this currently only ever creates the ledger.
- **`routes/familyRoutes.js`, `POST /api/families/:familyId/students/:studentId`**: right after the existing `svc.addStudent(...)` call succeeds, before the response is sent.

Both call sites are gated behind `FINANCE_FOUNDATION_ENABLED === "true"` — with the flag unset (as it is everywhere right now), neither endpoint's behavior changes at all from what existed before this sprint.

### Verification

- All new/modified files pass `node --check`; the full require graph (including `server.js` with both new call sites) boots cleanly against this environment's real Firebase credentials with zero errors.
- 17 new tests in `test/financeFoundationSprint2.test.js`: event publisher contract, all five value objects' arithmetic/validation/immutability, `runFinanceTransaction`'s commit-then-audit-then-publish ordering (with `db.runTransaction` and `financeAuditService.logFinanceAudit` safely mocked — never touches real Firestore), the conditional route-registration behavior, and `admissionFinanceService`'s both entry points including their failure-isolation behavior (a family-account failure doesn't block the billing-plan step; a ledger failure short-circuits cleanly; neither ever throws upward).
- Full existing backend suite re-run after all of the above: see the accompanying commit for the exact pass count. No previously-passing test was modified.

### What's still explicitly NOT done (unchanged from Sprint 1's boundary, now doubly true)

Invoice generation, recurring billing, payment automation, Collections, Parent Finance Portal, production data migration, and any change to `invoices`/`payments`/`feeTemplates` behavior. The fee-template IDOR and the `isFinance()` Firestore-rule discrepancy (both flagged in the Finance Module Audit and Sprint 1's report) remain open — still recommended as an independent fast-follow, not addressed in this pass either, since neither sprint's scope included touching existing invoice/payment code.

---

*Reflects commit state as of 2026-07-21. Not yet deployed to production; `FINANCE_FOUNDATION_ENABLED` is unset everywhere.*
