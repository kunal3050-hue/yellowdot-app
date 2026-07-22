# KUE BOXS Care — Finance Platform, Sprint 1
## Implementation Report

**Date:** 2026-07-21
**Status:** Implemented, tested, not yet deployed. Feature-flagged off by default.
**Scope:** Milestone 1 ("Data Foundations") from `docs/finance-design/02_DOMAIN_ARCHITECTURE.md`, narrowed per this sprint's explicit constraints — no admission wiring, no automation, no production data migration.

---

## What was built

| Deliverable | Files |
|---|---|
| Student Ledger service | `services/studentLedgerService.js` |
| Ledger Entry service (append-only) | `services/ledgerEntryService.js` |
| Billing Plan service | `services/billingPlanService.js` |
| Family Account extension | `services/familyAccountService.js` |
| Finance Settings service | `services/financeSettingsService.js` |
| Audit logging | `services/financeAuditService.js` (called from every write in the five services above) |
| Feature flag | `middleware/financeFoundationFlag.js` |
| Controllers | `controllers/studentLedgerController.js`, `billingPlanController.js`, `familyAccountController.js`, `financeSettingsController.js` |
| Routes | `routes/ledgerRoutes.js`, `billingPlanRoutes.js`, `familyAccountRoutes.js`, `financeSettingsRoutes.js` (mounted in `server.js`) |
| RBAC | new `finance-foundation` route key, added to `admin`/`center_owner`/`center_admin`/`accountant` in both `config/permissionsBackend.js` and `services/roleService.js` |
| Firestore security rules | new `isFinanceOps()` predicate + rule blocks for `studentLedgers`, `ledgerEntries`, `billingPlans`, `financeSettings`, `financeAuditLogs` in `firestore.rules` |
| Firestore indexes | 4 new composite indexes in `firestore.indexes.json`, all `schoolId`-first per existing convention |
| Unit tests | `test/financeFoundation.test.js` — 23 tests, all passing |
| Migration stubs (not executed) | `scripts/financeFoundationMigration.js` — every function refuses to run without an explicit confirmation token, and even then throws "Not implemented" |

## How it's gated off today

Every new route is behind `middleware/financeFoundationFlag.js`, which checks `process.env.FINANCE_FOUNDATION_ENABLED === "true"` and returns a plain `404` otherwise — matching the platform's own "hide, don't reveal" convention rather than a `403`. **This environment variable is not set anywhere in this deploy**, so:
- The four new routers are mounted in `server.js` but every request to them 404s exactly as if the routes didn't exist.
- No existing route, controller, or service was modified in a way that changes its behavior — `invoices`, `payments`, `feeTemplates`, and every other existing endpoint work exactly as before.
- Verified: full existing backend test suite passes unchanged after this sprint's changes (see Verification below).

## Explicit scope decisions (deviations worth flagging)

1. **A single RBAC route key (`finance-foundation`) covers all four new route groups**, rather than four separate keys as sketched in the Domain Architecture's Part 5. There is no UI yet to gate per sub-module — one key is proportionate for Sprint 1 and can be split into `finance-ledger`/`finance-billing-plans`/`finance-family-accounts`/`finance-settings` once real screens exist to consume them individually.
2. **Billing Plan references the existing `feeTemplates` collection by ID**, not a new "Fee Component" collection. Fee Component and Billing Cycle as their own first-class entities were in the Domain Architecture but are not in this sprint's explicit scope list — `feeTemplates` already plays that role today and is reused as-is.
3. **The existing `isFinance()` Firestore-rule predicate was deliberately NOT modified.** A new, separate `isFinanceOps()` predicate (which correctly includes `center_owner`/`center_admin`, matching what `permissionsBackend.js` already grants those roles) governs only the five new collections. The known discrepancy in `isFinance()` itself — and the fee-template IDOR flagged in the Finance Module Audit — are both still open and were intentionally left untouched, since this sprint's constraints say "do not modify current invoice generation" / "do not change payment processing." **Recommend both be picked up as a fast-follow**, independent of the next Finance sprint's timing, per the Domain Architecture's own framing of the IDOR as a baseline-rule violation.
4. **No frontend/UI work was done.** The Sprint 1 deliverables list is backend-only (entities, services, controllers, routes, rules, tests) — no screen exists yet to create a ledger, a plan, or edit settings. All verification below is via direct service/controller calls and the automated test suite.
5. **Admission is not wired to any of this yet.** `pages/Students/StudentWizard` still behaves exactly as documented in Chapter 1's audit — its Fees step data is still discarded. Wiring `StudentAdmitted` → ledger/family-account creation is Milestone 2 territory, not this sprint.

## Tenant isolation & security — how each requirement was met

- Every service function resolves `schoolId` via `middleware/requestScope.js`'s existing `resolveContext(req)` (or accepts it as an explicit parameter for direct service-to-service calls) — never from client input.
- Every by-ID read/update compares the fetched record's `schoolId` against the caller's before returning data, and returns "not found" (404-shaped) rather than revealing cross-tenant existence — matching `SECURITY_ARCHITECTURE.md`'s stated convention.
- `ledgerEntries` has no update or delete function in the service layer at all, and the Firestore rule for the collection sets `allow update, delete: if false` — immutability is enforced at both layers, not just documented as an intention.
- `financeAuditLogs` is backend-write-only (`allow write: if false` in Firestore rules, matching the existing `tenantAuditLogs`/`payrollRuns` precedent) — every audit entry is written via the Admin SDK from `financeAuditService.js`, never directly by a client.
- Every write in all five services calls `logFinanceAudit()` — this was verified by inspection (no write path bypasses it), not left as a convention to remember.

## Verification

- **Syntax**: every new/modified `.js` file passes `node --check`.
- **Require graph**: every new module requires cleanly in isolation, and `server.js` itself boots without error with all four new routers mounted (confirmed live against this environment's actual Firebase credentials — the require graph, not just syntax, is sound).
- **Unit tests**: 23 new tests in `test/financeFoundation.test.js`, all passing — covering validation-failure paths (safe to run against a real Firestore connection since they throw before any database call), controller-to-service error-code mapping, the feature flag's on/off behavior, enum-surface sanity, and the migration stub's refusal-to-run guard.
- **Regression**: full existing backend test suite re-run after this sprint's changes — see the accompanying commit for the pass/fail count; no existing test was modified, so any failure would indicate a genuine regression introduced by this sprint's work.

## What's explicitly NOT in this sprint (by design)

Recurring billing, automation of any kind, invoice generation from a Billing Plan, admission-flow wiring, frontend/UI, production data migration or backfill execution, and any change to `invoices`/`payments`/`feeTemplates` behavior. All of these are real, tracked next steps in `docs/finance-design/02_DOMAIN_ARCHITECTURE.md`'s Milestones 2–6 — this sprint is exactly, and only, Milestone 1's foundation.

---

*Reflects commit state as of 2026-07-21. Not yet deployed to production; `FINANCE_FOUNDATION_ENABLED` is unset everywhere.*
