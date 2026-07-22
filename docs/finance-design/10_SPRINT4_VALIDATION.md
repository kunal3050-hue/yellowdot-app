# KUE BOXS Care — Finance Foundation
## Sprint 4 Validation: Complete Payment Lifecycle Realistic Scenario Testing

**Date:** 2026-07-21
**Status:** Complete. 14 of 14 requested scenarios pass. One test-infrastructure defect found and fixed before any assertion depended on it. One pre-existing (Sprint 1) ledger-sign-convention ambiguity surfaced by real usage — flagged for an ADR, not silently resolved. **Recommendation: ready for production rollout behind the feature flag**, subject to the two items in "Recommendation" below.
**Requested by:** "Please perform a comprehensive Sprint 4 validation pass using the real Finance services wired together, similar to the Sprint 3 realistic-scenario validation... The objective is to validate the complete payment lifecycle as one coherent system."

---

## Approach

Same discipline as `08_SPRINT3_VALIDATION.md`: `test/financePaymentLifecycleValidation.test.js` runs the **real, unmodified service code** — `financePaymentService`, `financePaymentAllocationService`, `financeAllocationStrategies`, `financeCreditConsumptionService`, `financeRefundReversalService`, `financeInvoiceService`, `ledgerEntryService`, `studentLedgerService`, `familyAccountService`, `financeSettingsService`, `financeAuditService` — wired together exactly as in production, against the same shared in-memory fake Firestore (`test/helpers/fakeFirestore.js`) built for Sprint 3's validation. No individual service function is mocked. Real Firestore is never touched.

One family (`FAM-V1`) with two children (Child A, Child B) is carried through a single continuous narrative — new invoices, payments, allocations, credit, refunds, and a reversal — so every scenario builds on genuinely accumulated state, the same way Sprint 3's two-sibling narrative did.

---

## Scenario results

| # | Scenario | Result |
|---|---|---|
| 1 | Full payment against a single invoice | **Pass.** A ₹3,000 payment allocated (manual, single ledger) against Child A's ₹3,000 July invoice pays it off exactly — ledger balance 0, Payment status `Allocated`. |
| 2 | Partial payment + remaining outstanding balance | **Pass.** A ₹1,200 payment against Child B's ₹2,000 invoice reaches `Allocated` itself (the whole payment was placed where intended) while the **ledger** correctly retains an outstanding ₹800 — confirming "payment fully allocated" and "invoice fully paid" are correctly distinct concepts. |
| 3 | One payment allocated across multiple invoices, same family | **Pass.** With Child A owing ₹1,000 (August) and Child B owing ₹800 (July remainder), a single ₹1,800 payment via `oldestDueFirst` settles **both** ledgers to zero in one call — real proof that the Allocation Engine spans a family, not just one child. |
| 4 | Overpayment becomes Family Account credit | **Pass.** A ₹700 payment against Child A's ₹500 September invoice leaves ₹200 leftover, auto-routed to the Family Account's credit balance (₹200) via the real `adjustCreditBalance()` — not a mock. |
| 5 | Existing credit automatically consumed by a later invoice | **Pass.** A new ₹150 October invoice for Child B is fully covered by `applyAvailableCredit()` pulling from the family's ₹200 credit — **no fresh payment needed at all** — leaving ₹50 credit for future use. |
| 6 | Receipt numbering + uniqueness | **Pass.** All four payments recorded during this run have correctly-formatted (`FRCPT-YYYYMM-#####`), unique, strictly-increasing receipt numbers. |
| 7 | Refund below the approval threshold | **Pass.** A ₹300 refund against Child A's fully-allocated payment (threshold set to ₹1,000) auto-processes immediately — no approval step, `Refund` status `Processed` in the same call. |
| 8 | Refund above the approval threshold + approval workflow | **Pass.** A ₹1,500 refund request on the same payment correctly stays `Requested` (confirmed genuinely pending via a separate read) until an explicit `approveRefund()` call processes it. A **separate** above-threshold request on a different payment was instead **rejected** — confirmed the ledger and the payment's `refundedAmount` were completely untouched by the rejection. A request exceeding a payment's refundable remainder was separately confirmed to fail validation outright, distinct from the Requested→Rejected workflow. |
| 9 | Payment reversal — immutable ledger history preserved | **Pass.** Reversing Child B's earlier ₹1,200 payment appended exactly one new offsetting entry; the original `payment` entry was confirmed **byte-for-byte identical** before and after (real object-equality check, not just "still exists"); the ledger balance was restored by exactly +1,200. |
| 10 | Ledger balance reconciliation | **Pass.** After every payment, allocation, credit consumption, refund, and reversal above, both children's ledger `currentBalance` still equals the exact sum of their own entries' `signedAmount` values. |
| 11 | Complete audit trail for every financial action | **Pass.** Every action left a retrievable `financeAuditLogs` entry: `financePayment.record`, `financePayment.allocate`, `financePayment.reverse`, `financeRefund.request`, `financeRefund.approve`, `financeRefund.process`, `financeCredit.apply`, `familyAccount.adjustCredit`, and every `ledgerEntry.create.*` action. |
| 12 | Tenant isolation | **Pass.** A second school could not read the family's Payment, Ledger, or Family Account (all `null`/hidden), and every cross-tenant mutation attempt (allocate, refund, reverse) failed as `NOT_FOUND` — confirmed the real school's ledger balance was completely unaffected by every attempt. |
| 13 | RBAC / `finance-refund-approval` permission | **Pass.** The real Express route tree confirms `POST /api/finance/refunds/:refundId/approve` carries the same 4-guard-plus-controller depth as every other Finance Foundation route; `ROLE_PERMISSIONS` confirms only `admin`/`center_owner`/`accountant` (not `center_admin`) hold `finance-refund-approval`; `authorizeRoute()` called directly confirms it rejects a `center_admin`-shaped request and allows an `accountant`-shaped one. |
| 14 | Idempotency for repeated payment/allocation requests | **Pass, two angles.** (a) Retrying `allocatePayment()` on an already-`Allocated` payment is rejected before touching the ledger — the balance is unchanged. (b) A raw retry of the exact same Invoice-sourced Ledger Entry (same `sourceType`/`sourceId`) is detected by `LedgerEntryService`'s own M3.1 dedup and returns `duplicate: true` without a second balance change. |

**14 of 14 requested scenarios: Pass.**

---

## Defects found

**One test-infrastructure defect, found and fixed before it could hide a real result.** `test/helpers/fakeFirestore.js` did not originally support Firestore's dotted-path field update convention (e.g. `{"financeAccount.creditBalance": 200}`), which `familyAccountService.adjustCreditBalance()` relies on for both the credit-grant and credit-consumption directions. The fake was silently creating a bogus flat key instead of updating the nested field, which made Scenario 4's credit balance read back as `0`. This is exactly the kind of gap this validation style exists to catch — Sprint 3's validation never exercised `adjustCreditBalance()` at all (Sprint 3 had no Payment/Credit machinery yet), so the gap was latent and undiscovered until this run. **Fixed** by adding proper dotted-path merge support to the fake (`applyDottedFields()`), matching real Firestore's actual nested-field-update semantics — re-verified against both this suite and Sprint 3's own validation suite (still 10/10 passing) before proceeding. **No production code changed as a result of this fix** — `familyAccountService.js` itself was already correct; only the test double needed correcting.

**One finding in already-frozen Sprint 1 code, surfaced by this being the first real usage of the `refund` entry type.** `ledgerEntryService.js`'s `FIXED_SIGN` map (frozen since Sprint 1) gives `refund` the same sign as `payment` (`-1`, decreasing the ledger's `currentBalance`). Under this platform's own "balance = amount owed" convention (charges `+1` increase what's owed, payments `-1` decrease it), a refund — money paid back **out** to a family, per `02_DOMAIN_ARCHITECTURE.md`'s own definition — arguably ought to **increase** what's owed again (mirroring `charge`, `+1`), since money previously counted as received is being given back. As implemented and frozen, processing a refund instead pushes the ledger balance further down (potentially negative), which reads as "the school now owes the family money" rather than "the family owes more again." **This is not a defect introduced by M4.5** — `financeRefundReversalService.js` faithfully reuses the existing, frozen sign exactly as the Architecture Freeze requires (no unilateral change without an ADR) — but M4.5 is the first milestone to actually exercise the `refund` type in practice, and this validation is the first place the resulting ledger direction was checked against real numbers rather than assumed. **Recommended before turning `FINANCE_FOUNDATION_ENABLED` on for real refund processing:** a short ADR confirming the intended sign for `refund` (and, by the same logic, double-checking `creditApplied`'s `-1`, which is more clearly correct since consuming credit does reduce what's owed) — a one-line, reviewable decision, not a re-architecture.

No other defects found. Every other scenario's numbers, states, and audit entries matched expectations exactly on the first correct run.

---

## Known limitations (carried forward, not newly discovered)

- **Credit-consumption ordering tradeoff** (documented in `04_SERVICE_CONTRACTS.md`'s `FinanceCreditConsumptionService` contract): the Ledger Entry posts before the Family Account credit balance is decremented; a failure between the two steps is a rare, accepted gap, not silently claimed as fully solved.
- **Scholarship application** remains unimplemented (no Scholarship entity exists anywhere in the codebase) — unaffected by Sprint 4.
- **Recurring billing scheduler (M3.5) and payment gateway integration** remain entirely out of scope, per every prior sprint's explicit deferral.
- **`oldestDueFirst` is ledger-granularity, not true per-invoice-due-date FIFO** (already documented in `04_SERVICE_CONTRACTS.md`) — unaffected by this validation, which exercised it correctly within that documented scope.

---

## Recommendation

The Payment Lifecycle is validated as internally consistent — payments, allocations, credit, refunds, reversal, audit trail, tenant isolation, and RBAC all behave as one coherent system, exactly as Sprint 3's Billing Engine was shown to be. **Recommend proceeding toward production rollout behind `FINANCE_FOUNDATION_ENABLED`**, conditioned on:

1. **Resolve the `refund` sign-convention question via a short ADR** before any real refund is processed in production — this is a business-correctness question (what should a refund actually do to a ledger balance), not an engineering blocker, and should take a reviewer minutes, not a redesign.
2. Continue treating `discountApprovalThreshold`/`refundApprovalThreshold` and every other Finance Setting as school-configurable, not hardcoded defaults, when rollout actually begins.

Per your own instruction, recurring billing (scheduler) and payment gateway integration should not begin planning until this validation — now complete — was reviewed.

---

*Executable proof: `test/financePaymentLifecycleValidation.test.js` (16 tests, all passing) and the corrected `test/helpers/fakeFirestore.js`. Full Finance Foundation suite: 166/166 passing. Full backend regression: 399/401 passing — the 2 failures are the same pre-existing, unrelated FCM integration scripts (`e2e-push-test.js`, `fcm-test.js`) every run this session has shown, confirmed via `git log` as untouched by any Finance Foundation work.*
