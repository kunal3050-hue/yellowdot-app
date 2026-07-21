# KUE BOXS Care — Finance Foundation
## Sprint 3 Validation: Manual Billing Engine Realistic Scenario Testing

**Date:** 2026-07-21
**Status:** Complete. All 9 requested scenarios pass. No defects found. Recommendation: proceed to Sprint 4 planning (Payments).
**Requested by:** "I recommend validating the Manual Billing Engine with realistic scenarios before introducing any automation... The goal is to prove that invoices, ledger entries, balances, and audit logs remain perfectly consistent under normal operational use."

---

## What this validation is, and isn't

Every prior Finance Foundation test file (`test/financeFoundation*.test.js`, `test/financeInvoiceService.test.js`, `test/financeRulesEngine.test.js`, `test/financeBillingEngineService.test.js`) mocks each service's *collaborators* individually — the right tool for exhaustively proving one function's error-handling and edge-case behavior in isolation, and the approach used throughout Sprints 1–3.

This validation is different on purpose: `test/financeBillingEngineValidation.test.js` runs the **real, unmodified service code** — `studentLedgerService`, `billingPlanService`, `ledgerEntryService`, `financeInvoiceService`, `financeRulesEngine`, `financeBillingEngineService`, `financeSettingsService`, `familyService.getDiscountRules`, `financeAuditService` — wired together exactly as they are in production, against one shared in-memory fake Firestore (`test/helpers/fakeFirestore.js`) built specifically for this file. No Firestore emulator exists in this project; the fake is a deliberately minimal stand-in (`==` filters only, no real transactional concurrency — nothing here runs concurrently in a test) that gives every service its real Firestore-shaped API surface without ever touching production data. Real Firestore is never touched: `db.collection`/`db.runTransaction` are redirected for this one file's run and restored afterward.

This proves **cross-service integration correctness** under realistic, ordinary use — a different and complementary kind of confidence than the per-milestone unit tests, not a replacement for them.

---

## Scenario results

| # | Scenario | Result |
|---|---|---|
| 1 | New admission, full-month billing | **Pass.** A student admitted 2026-06-01 (well before the July billing period) generates an invoice for the full ₹3,100 fee template amount, with a matching Ledger Entry and ledger balance of ₹3,100. |
| 2 | Mid-month admission, prorated billing | **Pass.** A student admitted 2026-07-16 (16 of 31 days into the July period) resolves a proration factor of 16/31, producing a pre-discount line amount of ₹1,600 — computed by the real `financeRulesEngine.resolveJoiningDateFactor`, not a stand-in. |
| 3 | Sibling discount | **Pass.** The same mid-month student, as a 2nd child (`siblingOrder: 2`), receives the platform's real default sibling-discount rule (10%) via `familyService.getDiscountRules()`, applied on top of the prorated amount: ₹1,600 → ₹1,440 total. Proration-before-discount ordering (frozen in `04_SERVICE_CONTRACTS.md`) is confirmed correct in a real multi-step scenario, not just a unit test with hand-picked numbers. |
| 4 | Manual invoice regeneration (idempotency) | **Pass.** Calling `generateInvoiceForPlan` a second time for the same plan and period returns the *same* invoice (`duplicate: true`), posts no second Ledger Entry, and leaves the ledger balance unchanged. Confirmed directly against the fake Firestore's own store: exactly one invoice document exists for that `(billingPlanId, periodStart)`, not two. |
| 5 | Multiple students in the same family | **Pass.** Two siblings sharing `familyId: "FAM-1"` are billed independently and correctly: Child A (first child, full month) ends at ₹3,100; Child B (second child, prorated + discounted) ends at ₹1,440. Each ledger is confirmed to have a distinct `studentId` with no cross-contamination of balances. |
| 6 | Ledger balance reconciliation | **Pass.** After a second month's charge for Child A (July + August), the ledger's `currentBalance` (₹6,200) is confirmed to equal the exact sum of that ledger's own Ledger Entries' `signedAmount` values, read back independently via `ledgerEntryService.listForLedger()`. This is the core financial-integrity invariant the whole Ledger Entry design exists to guarantee, and it holds under a real multi-invoice sequence. |
| 7 | Audit log verification | **Pass.** Every step of the flow — ledger creation, billing plan creation and activation, invoice creation, ledger entry creation, and the billing engine's own orchestration (including the Scenario 4 duplicate) — is independently retrievable from `financeAuditLogs` via `financeAuditService.listForEntity()`, keyed correctly by `entityType`/`entityId`. "Why does/doesn't an invoice exist for this plan and period" is answerable from the audit trail alone, as the `FinanceBillingEngineService` contract claims. |
| 8 | Cross-tenant isolation | **Pass.** A second school (`school-other`) attempting to read the first school's Billing Plan or Student Ledger gets `null` (hide-don't-reveal, not a distinguishable error), and attempting to generate an invoice against the first school's plan ID fails as `{code: "NOT_FOUND"}` — never succeeding, never leaking data, and never mutating the real school's ledger balance. |
| 9 | Permission / RBAC verification | **Pass.** Two checks: (a) with `FINANCE_FOUNDATION_ENABLED=true`, the real Express route tree (recursively searched, since Finance Foundation routes are mounted as sub-routers) shows `POST /api/finance/billing-plans/:planId/generate-invoice` with the identical 4-guard-plus-controller stack depth as the already-verified sibling `billingPlanRoutes.js` route — confirming no guard was accidentally dropped when this route was added. (b) `authorizeRoute("finance-foundation")` and `staffOnly`, called directly, correctly reject an unauthenticated request (401), a staff member without the `finance-foundation` permission (403), and a parent regardless of permissions (403), while allowing a staff member who does have the permission through. |

---

## Defects found

**None.** No behavior described above required a code change to the already-committed M3.1–M3.4 implementation. The one issue encountered was in the *test infrastructure itself* — the initial route-lookup helper only searched `app.router.stack` for directly-registered routes, missing that every Finance Foundation route is an `express.Router()` instance mounted via `app.use(router)` and therefore lives inside a mounted sub-router's own `.stack`. Fixed by making the lookup recursive before any assertion was written against it; this was caught and corrected before this report was written, not left as a known gap.

---

## What this validation does not cover

Per the user's own instruction, this validation stays scoped to the Manual Billing Engine as already built — it deliberately does **not** exercise:
- Payments, receipts, or any credit-balance handling (no such service exists yet — that's the proposed Sprint 4 scope).
- The `REQUIRES_APPROVAL` path (a discount at/above `discountApprovalThreshold`) — already covered by `test/financeBillingEngineService.test.js`'s unit tests; not repeated here since this file's purpose is realistic *normal* operation, not exhaustive edge-case re-coverage.
- Scholarship application — still not implemented anywhere in the codebase (documented gap, `financeRulesEngine`'s own contract).
- Any scheduler/automation — M3.5 remains untouched and out of scope.

---

## Recommendation

The Manual Billing Engine is validated as internally consistent across realistic new-admission, proration, discount, regeneration, multi-sibling, reconciliation, audit, tenant-isolation, and permission scenarios. Per the user's own stated gate, Sprint 4 (Payments) may now begin planning — implementation should wait for that plan's explicit review and approval, following the same rhythm as every prior sprint in this project.

---

*Executable proof: `test/financeBillingEngineValidation.test.js` (10 tests, all passing) and its supporting fixture `test/helpers/fakeFirestore.js`. Full backend regression: 325/327 passing — the 2 failures are the same pre-existing, unrelated FCM integration scripts (`e2e-push-test.js`, `fcm-test.js`) every run this session has shown, confirmed via `git log` as untouched by any Finance Foundation work.*
