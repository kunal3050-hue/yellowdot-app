# ADR-0002: Refund Ledger Entry Sign Convention

**Status:** Proposed — awaiting review and approval. **No implementation change has been made.** `ledgerEntryService.js`'s `FIXED_SIGN` map is unchanged as of this ADR.
**Date:** 2026-07-21
**Deciders:** Pending — this ADR is submitted for your review per your explicit instruction not to change the implementation until it is reviewed and approved.

## Context

`ledgerEntryService.js`'s `FIXED_SIGN` map — frozen since Sprint 1, part of the original `ENTRY_TYPES` enum — assigns each entry type a fixed direction for its effect on a Student Ledger's `currentBalance`:

```js
const FIXED_SIGN = {
  charge:         +1,
  lateFee:        +1,
  payment:        -1,
  discount:       -1,
  scholarship:    -1,
  refund:         -1,
  creditApplied:  -1,
};
```

`currentBalance` is the platform's "amount currently owed by the family" figure — every Finance Foundation screen, report, and reconciliation check built since Sprint 1 (Sprint 3's and Sprint 4's own validation suites included) treats it that way: a `charge` (+1) means the family owes more; a `payment` (-1) means they owe less, because money was received.

Sprint 4, M4.5 (Refund & Reversal Workflow) is the **first milestone to actually exercise the `refund` type in a real scenario** (the Sprint 4 Validation Report's Scenarios 7–8). Processing it correctly, per its frozen sign, surfaced a semantic question that had never been exercised before: a Refund is money the school pays back **out** to a family (`02_DOMAIN_ARCHITECTURE.md`'s own definition, distinct from money "held as credit"). Under the "balance = amount owed" convention, giving money back should logically make the family owe **more** again — the same direction as a `charge` (+1) — not less, which is what the current, frozen `-1` produces.

**A concrete illustration from the validation run:** Child A's ledger, already fully paid down to `0`, received two refunds (₹300 then ₹1,500) against the *same, already-settled* payment. Under the current `-1` sign, the ledger ended at **`-1,800`** — the ledger itself now claims the school owes the family ₹1,800, purely as an artifact of processing two refunds against an invoice that was otherwise fully settled.

**A second, independent signal pointing the same direction:** M4.5's own **Reversal** logic (`financeRefundReversalService.reversePayment()`), built in the same milestone by the same author, deliberately posts its offsetting entries with `type: "adjustment"` and an **explicit `signedAmountOverride: +alloc.amount`** — a positive value, chosen specifically to "undo the earlier payment entry's negative effect." Reversal and Refund both represent money the family is getting back; they were given **opposite** signs (Reversal: `+1` chosen deliberately; Refund: `-1` inherited from the frozen enum) without anyone having compared the two side by side until this validation pass did.

## Current Behaviour

A `refund` entry's `signedAmount = amount × (−1)`, always negative. Posting a refund **decreases** `currentBalance` — moving it further from "family owes nothing" toward "family is owed money" (a negative balance), regardless of whether the underlying invoice was already fully paid, partially paid, or unpaid.

## Alternative Behaviour

Flip `refund`'s sign to `+1`, matching `charge` and matching the `+1` Reversal already independently chose. A `refund` entry's `signedAmount = amount × (+1)`, always positive. Posting a refund **increases** `currentBalance` — modeling "money previously counted as received via a payment is now being given back, so the family's payable balance goes back up by that amount."

## Financial Implications of Each

**Current (`-1`):**
- A processed refund can drive a ledger balance negative even when the underlying invoice is fully settled — producing a **second, disconnected "credit" concept** alongside the Family Account's own explicit `creditBalance` field (the mechanism M4.2/M4.4 already use for overpayments and their consumption). A family could end up with money effectively owed to them sitting in two unreconciled places: a negative Student Ledger balance *and/or* a Family Account credit balance, depending on which mechanism produced it, with no automatic bridge between the two.
- A negative ledger balance reads, to a staff member scanning an "outstanding balance" list, as ambiguous — is this family in credit because they overpaid, or because they were refunded, or is this a data error? Under the current sign, all three look identical.

**Alternative (`+1`):**
- A processed refund correctly re-opens the amount the family owes, symmetric with how a `charge` behaves and with how Reversal already behaves. `currentBalance` stays a single, trustworthy "amount currently owed" figure with no second meaning to disambiguate.
- The immediate UX/operational question this raises — "why does this family suddenly owe money again right after we processed their refund?" — is a **communication** question (the parent-facing or staff-facing screen should clearly label this as "refund processed, invoice reopened" rather than leave a bare number), not a data-correctness one. The underlying accounting is the more defensible of the two.

## Recommended Decision

**Flip `refund`'s `FIXED_SIGN` from `-1` to `+1`.** This resolves the internal inconsistency between Refund and Reversal (both represent money returning to a family; both should move a ledger balance the same direction), keeps `currentBalance` a single, unambiguous "amount owed" figure with no second, disconnected credit concept living on the ledger itself, and requires no change to any other entry type — `charge`, `payment`, `discount`, `scholarship`, `creditApplied`, `lateFee`, and `adjustment` are all unaffected and remain correct as-is. (`creditApplied`'s `-1` in particular is **not** in question here — spending existing Family Account credit against a charge correctly reduces what's owed, symmetric with `payment`.)

## Impact on Reports

Any future report or dashboard that sums `currentBalance` across invoices/ledgers to show "total outstanding" would, under the **current** `-1` sign, understate a family's true outstanding balance (or show a misleading negative figure) for any family that has ever received a refund — without a report author realizing they need to special-case refunded ledgers. Under the **recommended** `+1` sign, `currentBalance` remains directly summable and trustworthy with no special-casing required.

## Impact on Ledger Balances

Only `refund`-type entries are affected. Every ledger with no refund history is completely unaffected by this decision, in either direction. For a ledger that *has* had a refund posted, the sign choice determines whether that refund's effect was to decrease or increase `currentBalance` — nothing else about the ledger's math changes.

## Impact on Reconciliation

**Reconciliation math itself is unaffected by this decision.** The invariant validated in both Sprint 3's and Sprint 4's validation suites — "a ledger's `currentBalance` always equals the exact sum of its own entries' `signedAmount` values" — holds regardless of which sign `refund` uses; it is an internal-consistency check, not an external "is this the correct real-world number" check. What the sign choice changes is whether a human (or a report) reading that reconciled number interprets it correctly as "amount owed." This ADR is about the **meaning** of a correctly-reconciled number, not about reconciliation correctness itself.

## Backward Compatibility Considerations

**Zero migration cost if decided now.** `refund` has never been posted against a real Firestore database — `FINANCE_FOUNDATION_ENABLED` remains unset everywhere, and Sprint 4's validation ran entirely against a throwaway in-memory fake, never real Firestore. There is currently no production Refund data anywhere to reinterpret or backfill. This is the lowest-risk possible moment to make this decision — before the feature flag is ever turned on. Deferring this decision until after real refund data exists would require either a data migration (flipping the sign on every historical refund entry and every affected ledger's `currentBalance`) or a `schemaVersion`-style disambiguation per entry, either of which is real, avoidable engineering cost. **Recommend resolving this ADR before any production rollout**, exactly as flagged in `10_SPRINT4_VALIDATION.md`'s own recommendation.

## Consequences

- **Easier**: `currentBalance` remains a single, unambiguous "amount owed" figure across every entry type, including `refund`; Refund and Reversal become internally consistent with each other; future Collections/Aging reports need no special-casing for refunded invoices.
- **Harder / requires attention**: any staff- or parent-facing screen that surfaces a ledger balance immediately after a refund should clearly label the reopened amount as "refund processed — invoice reopened" (or similar) rather than present a bare number, so the direction change doesn't read as confusing. This is a UX follow-up, not a data-model one, and is out of scope for this ADR itself (no such screen exists yet — Finance Foundation remains backend-only).
- **Blast radius of the fix itself is minimal**: a one-line change to `FIXED_SIGN.refund` in `ledgerEntryService.js`. `financeRefundReversalService.js` requires **no change at all** — it never specifies a sign itself for `type: "refund"` (only `type: "adjustment"`, used by Reversal, accepts an explicit `signedAmountOverride`); the refund's direction is entirely delegated to `LedgerEntryService`'s own `FIXED_SIGN` map. Every M4.5 unit test mocks `ledgerEntryService.createEntry()` directly and asserts only the *amount* passed in, never the resulting sign, so no test needs to change. The Sprint 4 Validation Report's own scenarios (7, 8, 12) were written sign-agnostically (comparing before/after equality or invariants, not hardcoded absolute balances) specifically so this exact class of decision could be made without invalidating them — re-running `test/financePaymentLifecycleValidation.test.js` after the flip is expected to still pass without any test edits, and should be done to confirm before this ADR is marked Accepted.
- **No version bump or Event Contract change required** — `RefundProcessed`'s payload doesn't expose `signedAmount` directly (only `amount`, which is unsigned by definition), so this change is invisible to that event's contract.
- **Follow-up required in the same commit as implementing this decision** (once approved): update `04_SERVICE_CONTRACTS.md`'s `LedgerEntryService` "Supported Entry Types" table (the `refund` row's "Effect on balance" column) and this ADR's own `Status` line to `Accepted`.

## Alternatives Considered

- **Leave `refund` at `-1`, treat a negative ledger balance as an intentional, documented "ledger-level credit" concept, distinct from the Family Account's `creditBalance`.** Rejected as the recommendation (though not impossible) — it would require building and documenting an entirely new "what does a negative student-ledger balance mean, and how does it relate to Family Account credit" reconciliation story that doesn't exist today, for no benefit over simply keeping `currentBalance` unambiguous. Two independent "family is owed money" concepts is strictly more complex than one.
- **Introduce a distinct entry type (e.g. `refundToCredit` at `-1` vs. `refundCashOut` at `+1`) instead of changing `refund`'s existing sign.** Considered because it would avoid touching a frozen enum value at all — purely additive. Not recommended as the primary fix because it doesn't resolve the actual question (what does *processing money back out* do to the ledger) and adds a second concept for a distinction (cash vs. credit-routed refund) that `financeRefundReversalService.js` doesn't currently model or need. Worth revisiting only if a future milestone needs to distinguish *how* a refund was paid out, which is not the question this ADR answers.
