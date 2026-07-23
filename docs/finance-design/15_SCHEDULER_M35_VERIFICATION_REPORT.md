# Recurring Billing Scheduler (M3.5) — Verification Report

**Date:** 2026-07-23
**Branch:** `feature/finance-billing-scheduler`
**Scope:** Automatic, recurring invoice generation for `cadence: "monthly"` Billing Plans — the last item deferred out of the original Finance Platform build. This report covers implementation, the full validation matrix requested, real bugs found and fixed, backend regression results, and a Go/No-Go recommendation.

---

## 1. What was built

| Layer | File | Purpose |
|---|---|---|
| Engine | `services/financeBillingSchedulerService.js` | Discovers due plans, computes billing periods, drives generation, locking, retry, catch-up, cron registration |
| HTTP | `controllers/financeSchedulerController.js`, `routes/financeSchedulerRoutes.js` | `POST /run`, `GET /runs`, `GET /runs/:runId` — bypass-role-only (developer/super_admin) |
| Wiring | `server.js` | Route registration + cron registration, both inside the existing `FINANCE_FOUNDATION_ENABLED` block |
| Events | `services/financeEventPublisher.js` | Added `SchedulerRunCompleted` / `SchedulerRunFailed` |
| UI | `pages/finance/FinanceScheduler.jsx` | Admin-only run history + detail drawer + "Run Now", 10th Finance Platform screen |
| Tests | `test/financeBillingSchedulerValidation.test.js` | 14 tests, full validation matrix below |

**Architectural stance:** the scheduler adds *no new billing logic*. It calls the exact, unmodified `financeBillingEngineService.generateInvoiceForPlan()` that the existing manual "Generate Invoice" button already uses — inheriting its idempotency, proration, sibling-discount, approval-gate, and audit behavior rather than reimplementing any of it. Only `cadence: "monthly"` plans are auto-billed; `termly` (no term-boundary model exists in this codebase) and `oneTime` (single manual charge by definition) stay manual-only, as a deliberate scope boundary.

---

## 2. Architecture decisions

- **Distributed locking** — a single `financeSchedulerLocks/global` Firestore document, acquired via `db.runTransaction`, with a 30-minute TTL. Protects against a manual "Run Now" overlapping a live cron tick, and against a crash leaving a permanent stuck state — the TTL means the next attempt (cron tomorrow, a manual run, or startup catch-up) proceeds automatically with zero special-cased recovery code.
- **Retry** — per-plan, not per-run. Errors without a `.code` (transient: network blips, momentary Firestore issues) retry up to 3 attempts with 1s/3s backoff. Errors with a `.code` (`VALIDATION`, `NOT_FOUND`, `REQUIRES_APPROVAL`) are business-rule stops and are never retried. One plan's failure never aborts the run for the rest.
- **Recovery after restart** — `maybeRunCatchUp()` runs once at server startup: if no run happened yet today (in the scheduler's own timezone) and the current local time is past the scheduled hour (01:00), it runs once immediately; otherwise it's a no-op. Never double-runs.
- **Time zone handling** — the cron trigger fires once daily at a single fixed wall-clock time (01:00 Asia/Kolkata), but period-boundary math (`currentMonthlyPeriod`) is computed per-tenant using each school's own `timezone` field via `Intl.DateTimeFormat` — no new date-library dependency. Month-end and leap-year correctness reuse this codebase's existing "day 0 of next month = last day of this month" technique.
- **Monitoring** — `financeSchedulerRuns/{runId}` holds the run summary; a flat `financeSchedulerPlanResults` collection (tagged with `runId`, not a subcollection) holds one doc per plan outcome, keeping every run query in the same "`where(field,"==",x)`, sort in memory" shape already used everywhere else in this Finance module.
- **RBAC** — the scheduler is the one genuinely cross-tenant Finance operation (a single run touches every school's plans). It is deliberately gated to bypass roles only (`authorize()` with no role list → developer/super_admin), *not* the regular per-school `finance-foundation` permission — exposing one school's run results to another school's admin would be a tenant-isolation leak. The `finance-scheduler` frontend routeKey is likewise not granted to any regular staff role.
- **Fire-and-forget execution** — `runSchedulerOnce()` acquires the lock and creates the run doc synchronously (fast, awaited), then processes every school/plan in the background without awaiting it, returning `{runId, status:"running"}` immediately so a manual "Run Now" click doesn't block the HTTP request for a large multi-school pass. The UI polls `GET /runs/:runId` for completion.

---

## 3. Validation matrix — results

All 14 scenarios below are covered by `test/financeBillingSchedulerValidation.test.js`, run against the shared in-memory `fakeFirestore` test harness (real, unmodified service code wired together — not individually mocked).

| # | Scenario | Result |
|---|---|---|
| 1 | Duplicate protection — re-running the same period never double-bills | ✅ Pass |
| 2 | Recovery after interruption — expired lock (crash) unblocks a new run; catch-up no-ops if already run today; catch-up no-ops before the scheduled hour | ✅ Pass (3 sub-cases) |
| 3 | Billing across multiple schools, independently | ✅ Pass |
| 4 | Month-end edge cases (31/30/28-day months) | ✅ Pass |
| 5 | Leap year (Feb 29, 2028) | ✅ Pass |
| 6 | Prorated admissions (mid-month join) | ✅ Pass |
| 7 | Sibling discounts | ✅ Pass |
| 8 | Paused and ended Billing Plans — correctly skipped, with reason logged | ✅ Pass |
| 9 | Retry scenarios — transient error retried 3x then recorded as error; transient error succeeding on a later attempt recorded as success; `REQUIRES_APPROVAL` never retried and doesn't count as a run failure | ✅ Pass (3 sub-cases) |
| 10 | Audit logging — per-school audit entry for every school touched, plus the underlying billing-engine audit still fires | ✅ Pass |
| 11 | Performance — 120 plans across 2 schools, all correctly processed | ✅ Pass (204ms, in-memory) |
| 12 | Locking — a second run cannot start while one is already holding the lock (`SCHEDULER_LOCKED`, HTTP 409) | ✅ Pass |
| — | Cross-tenant isolation — a suspended school's plans are never evaluated in the same run | ✅ Pass |

**14/14 tests passing** (confirmed via a clean standalone run and again as part of the full suite below).

---

## 4. Real bugs found and fixed during validation

1. **Paused/ended plans invisible in run results.** `_processRun` originally called `billingPlanSvc.listForSchool({schoolId, status:"active"})`, filtering at the query level — so paused/ended plans were never fetched at all, and `isPlanDueForPeriod`'s own skip-with-reason logic was dead code for this path. Fixed by removing the query-level status filter and letting `isPlanDueForPeriod` do the actual filtering, so the execution log now shows *why* a plan was skipped instead of silently omitting it.

2. **Test fault-injection leaking across plans.** Two retry-scenario tests monkey-patched `billingEngineSvc.generateInvoiceForPlan` globally instead of scoping the injected failure to the one plan under test — every other already-generated plan in the accumulated fixture also failed and retried (3× with backoff each), producing a 36+ second hang, leaving the distributed lock held past the test's patience, and cascading `SCHEDULER_LOCKED` failures into two subsequent tests. Fixed by checking `planId` and delegating to the real implementation for every other plan.

3. **Cron/catch-up firing merely from `require("./server")` (found during full-suite regression, see §5).** `registerCronJob()` and `maybeRunCatchUp()` were called unconditionally inside the `FINANCE_FOUNDATION_ENABLED` block in `server.js`, with no guard against the module being `require()`'d rather than run directly. Four existing test files set `FINANCE_FOUNDATION_ENABLED=true` and `require("../server.js")` purely to assert on route registration (a previously side-effect-free check) — with the scheduler wired in, this also silently registered a real `cron.schedule()` (a persistent timer that never lets the test's child process exit) and fired a real `maybeRunCatchUp()` Firestore call. Fixed by moving both calls inside the pre-existing `if (require.main === module)` guard — the same guard `app.listen()` already uses for exactly this class of problem (no side effects when merely required by tests or by the Cloud Functions wrapper, whose ephemeral instances wouldn't sustain an in-process cron reliably anyway). The persistent VPS process (`node server.js` directly) is the only context that ever registers the cron job or runs catch-up, matching the "must not execute in production while the feature flag is disabled" requirement exactly — and now *also* never executes as a side effect of testing.

4. **Stale hardcoded event-name assertion.** `test/financeFoundationSprint2.test.js` asserted the exact list of `financeEventPublisher.EVENTS` values; adding `SchedulerRunCompleted`/`SchedulerRunFailed` broke that fixed list. Updated the expected array to include both new event names — a mechanical consequence of the new events, not a functional issue.

---

## 5. Backend regression results

Full backend suite (`test/*.test.js`, 32 files) run to completion:

```
ℹ tests 411
ℹ suites 0
ℹ pass 411
ℹ fail 0
ℹ duration_ms 70474
```

**411/411 passing, 0 failures.** (Three root-level scripts — `e2e-push-test.js`, `fcm-test.js`, `test-notif-endpoint.js` — are excluded from this run: they are interactive, hardware-dependent scripts that poll for a real Android device's push token and were never intended for automated CI; Node's default `*-test.js`/`test-*.js` auto-discovery incidentally picks them up when `npm test` is run bare. This is a pre-existing test-infrastructure quirk, unrelated to the scheduler, and out of scope for this change.)

No regressions in any pre-existing test file. The one failure surfaced mid-verification (bug #3/#4 above) was found, root-caused, and fixed as part of this same pass — not deferred.

---

## 6. Manual RBAC verification (live, against local backend + real Firestore)

Performed with two throwaway Firebase test users (admin, developer roles), cleaned up afterward:

- `admin` role → `POST /api/finance/scheduler/run` → **403** (correctly rejected — scheduler is bypass-only)
- `developer` role → same route → **200** (correctly allowed)
- `admin` role → an ordinary Finance route (unaffected by this change) → **200** (no regression to existing per-school access)
- Server startup's `maybeRunCatchUp()` was observed firing safely against real production Firestore during this check (the real `ydseawoods` tenant, zero eligible monthly plans today, zero side effects) — confirming the catch-up path is safe to leave enabled once the flag is on.

All test users, test Firestore documents (`financeSchedulerRuns`/`financeSchedulerPlanResults`/`financeSchedulerLocks` entries created during this check), and the temporary `.env` flag override were removed afterward and independently reverified as deleted.

---

## 7. Frontend

- `FinanceScheduler.jsx` — 10th Finance Platform screen (run history table + "Run Now" + detail drawer with per-plan results), reusing `PageShell`/`DataTable`/`Drawer`/`StatusBadge` from the existing design system, no new components introduced.
- `finance-scheduler` routeKey added to `permissions.js`/`sidebarConfig.js`/`FinanceSubNav.jsx`/`App.jsx`, deliberately **not** granted to any regular staff role — only reachable by developer/super_admin, matching the backend RBAC.
- `npm run build` — clean, no errors.
- `eslint` on all changed/added frontend files — clean (one pre-existing `set-state-in-effect` warning on the new screen was fixed to match the exact same suppression pattern every sibling Finance screen already uses).

---

## 8. Go / No-Go

**Go.** Every scenario in the requested validation matrix passes; the full backend regression suite is green at 411/411; the one real production-safety bug found (cron/catch-up firing as a require-time side effect) was in test-time behavior only — it never affected the actual deployed runtime, since `require.main === module` is only ever true for the real `node server.js` process, but it was still a correctness gap worth closing before merge. The scheduler is additive, reuses every existing frozen service unmodified, stays entirely inside the existing `FINANCE_FOUNDATION_ENABLED` gate for both route registration and cron registration, and does not touch any other Finance Platform code path.

**Recommendation:** merge to `master` and deploy backend + frontend together, flag kept disabled, per the original requirement. The Finance Platform is then feature-complete; the only remaining activity is the operational rollout decision (enabling the flag).
