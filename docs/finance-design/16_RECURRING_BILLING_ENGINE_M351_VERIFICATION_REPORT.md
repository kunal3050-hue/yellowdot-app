# Recurring Billing Engine (M3.5.1) — Verification Report

**Date:** 2026-07-23
**Branch:** `feature/finance-recurring-billing-engine`
**Scope:** Completes the Recurring Billing Engine on top of the M3.5 scheduler already shipped — multi-frequency billing (Monthly/Quarterly/Half-Yearly/Yearly), archived-student skipping, Dry Run / Preview mode, a per-school configurable schedule (Finance Settings, no hardcoded time), a Recurring Billing dashboard, and a fixed run-record miscount. This report covers what was built, the full requested validation matrix, real bugs found and fixed during testing, backend regression results, and a Go/No-Go recommendation.

---

## 1. Relationship to the existing M3.5 scheduler

The Recurring Billing Scheduler (M3.5) was already built, tested, and deployed earlier in this project (`docs/finance-design/15_SCHEDULER_M35_VERIFICATION_REPORT.md`) — a working engine that auto-billed `cadence: "monthly"` Billing Plans once daily. This pass is an **extension of that same engine**, not a rebuild: `financeBillingSchedulerService.js`, its controller/routes, and `FinanceScheduler.jsx` all continue to exist at the same paths and are evolved in place. Every item below was either genuinely missing from the M3.5 build or a real gap found while extending it — nothing here duplicates work that already existed.

**Reused, unmodified:** `BillingPlanService`, `FinanceInvoiceService`, `FinanceRulesEngine`, `LedgerEntryService`, `FinanceAuditService`, Payment Allocation, Refund logic, existing RBAC (`authorize()` bypass-only gate), and the existing `FINANCE_FOUNDATION_ENABLED` feature flag (route/cron registration gating unchanged). `FinanceBillingEngineService.generateInvoiceForPlan` gained one new **optional** parameter (`dryRun`, default `false`) — every existing call site and test is untouched and behaves identically; this is additive, not a redesign.

---

## 2. What was built

| Area | Change |
|---|---|
| Billing frequency | `billingPlanService.js`'s `CADENCES` extended with `quarterly`/`halfYearly`/`yearly` (alongside the existing `monthly`/`termly`/`oneTime`); `FinanceBillingPlans.jsx`'s cadence dropdown updated to match |
| Period calculation | `currentPeriodForCadence(cadence, timezone, referenceDate)` generalizes the old monthly-only `currentMonthlyPeriod` to calendar-aligned quarters (Jan-Mar/Apr-Jun/Jul-Sep/Oct-Dec), halves (Jan-Jun/Jul-Dec), and full years — `currentMonthlyPeriod` kept as a thin wrapper for backward compatibility |
| Archived students | Each school's students are fetched once per run (not once per plan) and mapped `studentId → status`; a plan whose student is not `"Active"` (this app's vocabulary for archived — `"Inactive"`/`"Alumni"`) is skipped with reason `student_archived` |
| Dry Run / Preview | `financeBillingEngineService.generateInvoiceForPlan(planId, { ..., dryRun: true })` runs the exact same lookup → proration → discount → approval evaluation and returns before either write; the scheduler's `mode: "preview"` uses this end to end, still creating a run record (tagged `mode: "preview"`) so results are reviewable in the same UI, but skipping the per-school `FinanceAuditService` entry and, of course, every real invoice/ledger write |
| Manual run | Already existed (`Run Now`) — unchanged |
| Configurable schedule | `financeSettingsService.js` gained `schedulerSchedule` (`"daily"` / `"monthlyFirst"` / `"quarterlyFirst"`, a curated preset enum rather than free-form cron) and `schedulerHour` (0-23), both per-school. The platform cron trigger itself now runs **hourly** (`registerCronJob`) rather than once daily; each tick (`runScheduledTick`) asks every eligible school "is your own configured schedule due this hour," and only those schools are processed (`_processRun`'s new `schoolIds` filter) — nothing about *when* billing happens is hardcoded |
| Job Run record | Added `mode` (`manual`/`scheduled`/`preview`, set explicitly per caller — not inferred), `durationMs`, `schoolIds` (which schools this run actually touched), and a distinct `duplicatesSkipped` counter |
| Dashboard | `GET /api/finance/scheduler/dashboard` (`getDashboardSummary()`) returns last successful run, next scheduled run (soonest across every school's own schedule), total invoices generated, last failure, and a scheduler health heuristic; surfaced as `KpiRow` tiles on `FinanceScheduler.jsx` |
| Notifications | None added — explicitly out of scope per the request |

---

## 3. Architecture decisions

- **Calendar-aligned periods, not anniversary-of-start-date.** Quarters/halves/years are calendar-aligned (Jan-Mar, Jan-Jun, Jan-Dec) rather than aligned to each plan's own `startDate`, for consistency with how `monthly` already worked before this change — a deliberate choice to avoid a second period-alignment convention living alongside the first.
- **`dryRun` as a parameter, not a parallel implementation.** The alternative — computing a preview independently inside the scheduler — would have meant re-fetching the fee template/student/settings/discount-rules and re-calling the rules engine in a second place, i.e. duplicating exactly the business logic the task explicitly said not to duplicate. Adding one optional parameter with two early-return points (before either write) keeps 100% of the real evaluation logic in the one place it already lived.
- **Preview still writes scheduler bookkeeping, never business data.** "Without writing anything" is honored for the actual financial data (invoices, ledger entries, billing plan state, the compliance-facing Finance Audit Log) — the scheduler's own `financeSchedulerRuns`/`financeSchedulerPlanResults` collections ARE still written for a preview, tagged `mode: "preview"` throughout, so `Run Now (Preview)` can show its results in the exact same run-detail Drawer a real run uses rather than a bespoke one-off view.
- **Curated schedule presets, not free-form cron strings.** "Do not hardcode schedules" is satisfied by making the schedule genuinely configurable per school from Finance Settings — not by accepting arbitrary cron syntax from the UI, which would need its own validation/safety story for comparatively little benefit given the three examples given (daily, monthly, quarterly) are exactly the three presets built.
- **Hourly platform tick, per-school due-check.** A single school-specific cron trigger isn't possible with one process-wide `cron.schedule()` call, so the platform tick runs hourly and each school's own `isScheduleDueNow(schedule, hour, timezone)` decides whether it's that school's moment — this is what makes "different schools, different schedules" real rather than cosmetic.
- **`referenceDate` threading, one real bug found because of it.** `runSchedulerOnce`/`_processRun`/`runScheduledTick`/`maybeRunCatchUp` all accept an explicit `referenceDate` (defaulting to `new Date()`) for deterministic testing — this surfaced a genuine bug (see §5) where the run's own recorded `startedAt` used the real wall clock instead of the reference instant, which would have made the "did this school already run today" check silently inconsistent whenever a run's true start and its logical reference instant diverged.

---

## 4. Validation matrix — results

All scenarios covered by `test/financeBillingSchedulerValidation.test.js` (26 tests, run against the shared in-memory `fakeFirestore` harness — real, unmodified service code wired together).

| # | Scenario | Result |
|---|---|---|
| 1 | Monthly billing | ✅ Pass (inherited from M3.5, re-verified) |
| 2 | Quarterly billing (calendar quarters, incl. a leap-year Q1) | ✅ Pass |
| 3 | Half-Yearly billing | ✅ Pass |
| 4 | Yearly billing | ✅ Pass |
| 5 | Admission mid-month (proration) | ✅ Pass |
| 6 | Paused plans | ✅ Pass |
| 7 | Ended plans | ✅ Pass |
| 8 | Duplicate prevention (+ `duplicatesSkipped` counted separately from `invoicesGenerated`) | ✅ Pass |
| 9 | Retry after failure (transient error retried 3×, then error; succeeds on 2nd attempt recorded as generated) | ✅ Pass |
| 10 | Multiple schools | ✅ Pass |
| 11 | Tenant isolation (suspended school never evaluated) | ✅ Pass |
| 12 | Leap year (Feb 29) | ✅ Pass |
| 13 | Month-end (28/29/30/31-day months) | ✅ Pass |
| 14 | Timezone handling | ✅ Pass |
| 15 | Daylight saving resilience | ✅ Pass — `America/New_York` around both the March "spring forward" and November "fall back" 2026 transitions, confirming `Intl`-based local-hour/date math never drifts (this platform's real tenants are `Asia/Kolkata`, which has no DST, but the underlying date math is proven correct for any zone) |
| — | Archived students (Inactive/Alumni) skipped | ✅ Pass |
| — | Sibling discounts | ✅ Pass |
| — | Distributed locking (concurrent run rejected; expired lock from a crash never blocks) | ✅ Pass |
| — | Audit logging (per-school + underlying billing-engine audit) | ✅ Pass |
| — | Preview mode: reports would-generate/would-skip-duplicate/would-require-approval, writes zero real Finance data, writes zero compliance audit entries | ✅ Pass (2 scenarios) |
| — | Configurable per-school schedule: `isScheduleDueNow` unit coverage for all 3 presets; `runScheduledTick` only processes the school(s) actually due, a second tick at the same instant is correctly a no-op | ✅ Pass (3 scenarios) |
| — | Performance (120 plans, 2 schools) | ✅ Pass (~120-300ms, in-memory) |
| — | Dashboard summary | ✅ Pass |

**26/26 tests passing.**

---

## 5. Real bugs found and fixed during validation

1. **Run's `startedAt` ignored the passed `referenceDate`.** `runSchedulerOnce` stamped every run with the literal wall-clock `new Date()` regardless of the `referenceDate` parameter used for its period/eligibility math. Invisible in production (where `referenceDate` is always "now" anyway) but made the new per-school "already ran today" check for the scheduled tick silently unreliable whenever a caller (or a test) used a non-default reference instant — found via a test asserting a second tick at the same simulated instant is a no-op, which failed because the first run's `startedAt` didn't match the simulated day. Fixed by stamping `startedAt` from `referenceDate` itself.
2. **Two test-authoring bugs, not product bugs**, both caught and fixed during this same pass: (a) a UTC→IST manual conversion error in the schedule test fixtures (off by exactly one calendar day — the same class of mistake this codebase's own `Intl`-based date math exists specifically to avoid, ironically reproduced by hand in a test); (b) an incorrect assumption that a fresh Billing Plan has zero pre-existing audit entries for its own entityId, when `billingPlanService.create()`/`setStatus()` already write their own (`billingPlan.create`/`billingPlan.active`) — fixed by comparing before/after counts instead of assuming zero.

No real bugs were found in the reused services (`BillingPlanService`, `FinanceInvoiceService`, `FinanceRulesEngine`, `LedgerEntryService`, `FinanceAuditService`) — consistent with them being frozen, already-validated code this pass never modified.

---

## 6. Backend regression results

Full backend suite (`test/*.test.js`, scoped to exclude the pre-existing interactive/hardware-dependent FCM scripts at the repo root, per this project's own established convention):

```
ℹ tests 423
ℹ pass 423
ℹ fail 0
ℹ duration_ms 48428
```

**423/423 passing, 0 failures**, including all pre-existing Finance Foundation, billing engine, payment lifecycle, and RBAC/tenant-isolation suites — confirming the `dryRun` parameter addition and cadence-set expansion introduced no regressions anywhere else in the platform.

---

## 7. Frontend

- `FinanceScheduler.jsx` — added a `KpiRow` dashboard (5 tiles), a `Run Now (Preview)` button that polls the started run and auto-opens its results in the existing detail Drawer, new run-table columns (mode, duration, duplicates), and a `Preview only — nothing was saved` banner in the detail Drawer when viewing a preview run.
- `FinanceSettings.jsx` — new "Recurring Billing Schedule" section (schedule preset + hour, both per-school).
- `StatusBadge.jsx` — extended with preview-outcome, execution-mode, and scheduler-health badge colors/labels (checked for key collisions against the existing shared dictionary before adding).
- `npm run build` — clean. `eslint` on every changed file — clean.

---

## 8. Deployment

Not yet deployed — this report is produced before deployment, per the requested sequence (implement → validate → report → deploy). See the commit that follows this report for the merge and deployment record.

## 9. Go / No-Go

**Go.** Every item in the requested scope is implemented and covered by the requested validation matrix; the full backend regression suite is green at 423/423; the two bugs found during testing were fixed (one real, in the new code; two were test-authoring mistakes, also fixed); no reused service was modified in a way that could regress existing behavior (confirmed both by the unmodified-call-site argument and by the regression suite itself). The engine remains entirely inside the existing `FINANCE_FOUNDATION_ENABLED` gate for both route and cron registration, unchanged from M3.5.

**Recommendation:** merge to `master` and deploy backend + frontend together, flag kept disabled, per the request.
