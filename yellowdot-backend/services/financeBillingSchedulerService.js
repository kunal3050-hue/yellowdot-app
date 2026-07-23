/**
 * financeBillingSchedulerService.js — Recurring Billing Engine (M3.5 / M3.5.1)
 * ────────────────────────────────────────────────────────────────────
 * Automates what a human already does manually via
 * `POST /api/finance/billing-plans/:planId/generate-invoice`
 * (financeBillingEngineService.generateInvoiceForPlan). This file adds NO
 * new billing logic of its own — it discovers which Billing Plans are due,
 * computes the period, and calls the exact same, already-frozen
 * orchestration (Rules Engine → Invoice → Ledger Entry → Audit) that the
 * manual flow uses, including its new optional `dryRun` mode for previews
 * (financeBillingEngineService.js). Proration, sibling discounts, and the
 * discountApprovalThreshold gate all keep working exactly as already
 * validated in Sprint 3/4 — this file never touches that logic.
 *
 * ── Billing frequency ────────────────────────────────────────────────────
 * `monthly` / `quarterly` / `halfYearly` / `yearly` are all auto-billed,
 * each on its own calendar-aligned window (currentPeriodForCadence below —
 * quarters are Jan-Mar/Apr-Jun/Jul-Sep/Oct-Dec, halves are Jan-Jun/Jul-Dec,
 * years are Jan-Dec — chosen for consistency with how `monthly` already
 * worked, rather than an anniversary-of-start-date scheme). `"termly"` has
 * no term-boundary model anywhere in this codebase (Billing Plan carries no
 * term start/end), and `"oneTime"` plans are — by definition — a single
 * manual charge, not a recurring one. Both remain manual-only via the
 * existing Generate Invoice screen/endpoint, exactly as they are today.
 * This is a deliberate scope boundary, not an oversight.
 *
 * ── Multi-tenant ─────────────────────────────────────────────────────────
 * A run iterates every eligible tenant (`tenantService.getAll()`, status
 * "active" or "trial"), optionally narrowed to a specific `schoolIds` list
 * (used by the scheduled tick below — a manual/preview run always targets
 * every eligible school, exactly as before). Every finance-service call the
 * scheduler makes passes `schoolId` explicitly — it never relies on any
 * service's `process.env.SCHOOL_ID` default, which would silently only
 * ever bill one school.
 *
 * ── Idempotency / duplicate protection ────────────────────────────────────
 * Fully inherited, not reimplemented: `generateInvoiceForPlan` already
 * dedupes on `(planId, periodStart)` via `financeInvoiceService
 * .findByPlanAndPeriod`, and its Ledger Entry step dedupes independently
 * via `(schoolId, studentLedgerId, sourceType, sourceId)` (M3.1). A retried
 * or overlapping call for the same plan+period converges safely — this
 * file adds no new dedup layer at the invoice level. A duplicate outcome is
 * tracked in its OWN `duplicatesSkipped` run counter, distinct from
 * `invoicesGenerated` (a real, previously-existing miscount this pass
 * fixed — see the M3.5.1 verification report).
 *
 * ── Skips ────────────────────────────────────────────────────────────────
 * A plan is skipped (never attempted) when: not "active" status, an
 * unsupported cadence (termly/oneTime), not yet started / already ended
 * (startDate/endDate vs. the computed period), or its student's status is
 * not "Active" (Inactive/Alumni — this app's vocabulary for "archived").
 * Every skip is logged with its specific reason — see logPlanResult calls.
 *
 * ── Distributed locking / crash recovery ──────────────────────────────────
 * A single Firestore document (`financeSchedulerLocks/global`) acquired
 * via a transaction is this platform's coordination point — the "single
 * VPS, no multi-instance orchestration" reality documented in this
 * project's own Domain Architecture means there is no fleet of app
 * servers to coordinate across, but the SAME two real risks a distributed
 * lock protects against still exist here: (a) a manual "Run Now" click
 * overlapping a live scheduled tick, and (b) the process crashing mid-run
 * and leaving a stale in-progress state. A TTL (30 min) on the lock means a
 * crash never permanently wedges the scheduler — the next attempt (the
 * next tick, a manual run, or the startup catch-up check below) proceeds
 * once the TTL expires, with zero special-cased crash-recovery code.
 *
 * ── Recovery after server restart ─────────────────────────────────────────
 * `maybeRunCatchUp()`, called once at server startup (see server.js),
 * checks — per school — whether that school's OWN configured schedule was
 * due at any point today but never actually ran (server was down through
 * it); if so, it catches up exactly once per school. A school that already
 * ran today (scheduled OR manual) is never double-run.
 *
 * ── Retry handling ─────────────────────────────────────────────────────────
 * Per-plan, not per-run: one plan's transient failure (network blip,
 * momentary Firestore unavailability — anything `generateInvoiceForPlan`
 * throws WITHOUT a `.code`) is retried up to 3 attempts with backoff before
 * being recorded as a failure. Business-rule stops (`VALIDATION`,
 * `NOT_FOUND`, `REQUIRES_APPROVAL`) are never retried — retrying them
 * cannot change the outcome, and `REQUIRES_APPROVAL` is an expected,
 * already-audited stop (see financeBillingEngineService), not an error.
 * One plan's failure never aborts the run — every other plan is still
 * attempted, and both the error AND an audit trail entry are recorded.
 *
 * ── Time zone / DST ────────────────────────────────────────────────────────
 * All local-date math goes through `Intl.DateTimeFormat` (localDateParts/
 * localDateString/localHour below) rather than manual UTC-offset
 * arithmetic — this delegates to the platform's own ICU timezone database,
 * which is DST-correct by construction (a "local hour" or "local day" read
 * this way is always right for that zone, across a DST transition, with no
 * special-casing needed here). No new date-library dependency added.
 *
 * ── Configurable schedule (M3.5.1) ──────────────────────────────────────
 * Each school picks its OWN schedule from Finance Settings
 * (financeSettingsService.js's `schedulerSchedule`/`schedulerHour` fields):
 * "daily" (every day at the configured hour), "monthlyFirst" (1st of the
 * month), or "quarterlyFirst" (1st of Jan/Apr/Jul/Oct) — see
 * isScheduleDueNow(). Nothing is hardcoded to a single daily time: the
 * platform-level cron trigger itself runs HOURLY (registerCronJob below)
 * and, on each tick, asks every school "is your configured schedule due
 * right now?" — only schools that answer yes are included in that tick's
 * run (`schoolIds` filter on `_processRun`). A manual "Run Now" (real or
 * preview) always targets every eligible school regardless of their
 * individual schedules, exactly as before this change.
 *
 * ── Dry Run / Preview mode (M3.5.1) ────────────────────────────────────
 * `mode: "preview"` runs the exact same discovery/eligibility/evaluation
 * path as a real run, calling `generateInvoiceForPlan(..., { dryRun: true
 * })` so the SAME rules engine decides "would this generate, would it
 * require approval, is it a duplicate" — never a second, drifting copy of
 * that logic. Nothing in the actual Finance business data (invoices,
 * ledger entries, billing plan state) is ever written in preview mode. A
 * run record + per-plan results ARE still written (to the scheduler's own
 * bookkeeping collections only, financeSchedulerRuns/financeSchedulerPlanResults)
 * so a preview can be reviewed in the same run-history UI as a real run —
 * clearly tagged `mode: "preview"` throughout. The per-school
 * FinanceAuditService entry (which documents real actions for compliance)
 * is deliberately skipped in preview mode — a preview is not an action.
 *
 * ── Monitoring / execution logs ────────────────────────────────────────────
 * `financeSchedulerRuns/{runId}` (summary + status + duration + execution
 * mode) plus a separate top-level `financeSchedulerPlanResults` collection
 * (one doc per plan outcome, tagged with `runId`) — a separate collection
 * rather than an array field on the run doc specifically so a run touching
 * a large number of plans across many schools never approaches Firestore's
 * 1MB document size limit; a flat collection with a `runId` field rather
 * than a subcollection so the exact same query shape (`where("field","==",x)`)
 * this whole module already uses everywhere else applies here too.
 */
const cron = require("node-cron");
const { db } = require("../firebaseAdmin");
const tenantSvc        = require("./tenantService");
const billingPlanSvc   = require("./billingPlanService");
const billingEngineSvc = require("./financeBillingEngineService");
const settingsSvc      = require("./financeSettingsService");
const studentSvc       = require("./studentService");
const auditSvc         = require("./financeAuditService");
const eventPublisher   = require("./financeEventPublisher");

const RUNS_COL         = () => db.collection("financeSchedulerRuns");
const PLAN_RESULTS_COL = () => db.collection("financeSchedulerPlanResults");
const LOCK_DOC         = () => db.collection("financeSchedulerLocks").doc("global");
const LOCK_TTL_MS = 30 * 60 * 1000; // 30 minutes — see "Distributed locking" above
const DEFAULT_TIMEZONE = "Asia/Kolkata";
const SCHEDULED_HOUR   = 1; // default hour (01:00 local) when a school hasn't configured one
const RETRY_MAX_ATTEMPTS = 3;
const RETRY_BACKOFF_MS   = [1000, 3000];

// Calendar-window size (in months) for each auto-billed cadence.
const CADENCE_MONTHS = { monthly: 1, quarterly: 3, halfYearly: 6, yearly: 12 };
const BILLABLE_CADENCES = new Set(Object.keys(CADENCE_MONTHS));

function nowISO() { return new Date().toISOString(); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Timezone-correct local date math (no new dependency — Intl only) ───────

function localDateParts(timezone, date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
  });
  const parts = fmt.formatToParts(date);
  const get = (t) => Number(parts.find(p => p.type === t).value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

function localDateString(timezone, date = new Date()) {
  const { year, month, day } = localDateParts(timezone, date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function localHour(timezone, date = new Date()) {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "2-digit", hour12: false }).format(date));
}

/**
 * currentPeriodForCadence — the calendar window (month/quarter/half-year/
 * year) containing `referenceDate`, in `timezone`, for the given cadence.
 * Uses the same "day 0 of next month = last day of this month" technique
 * already used for the original monthly-only version (and elsewhere in
 * this codebase, e.g. the demo seed script), which JS Date resolves
 * correctly across month-end and leap years (Feb 29) without any
 * special-casing — generalized here to windows wider than one month by
 * picking the right start/end MONTH first, then applying the same
 * last-day trick to the end month only.
 */
function currentPeriodForCadence(cadence, timezone, referenceDate = new Date()) {
  const months = CADENCE_MONTHS[cadence];
  if (!months) { const e = new Error(`Unsupported billing cadence "${cadence}".`); e.code = "VALIDATION"; throw e; }

  const { year, month } = localDateParts(timezone, referenceDate); // month is 1-indexed
  const windowIndex = Math.floor((month - 1) / months); // 0-indexed window number within the year
  const startMonth = windowIndex * months + 1;
  const endMonth   = startMonth + months - 1;
  const lastDay = new Date(year, endMonth, 0).getDate(); // day 0 of next month after endMonth = last day of endMonth
  const pad = (n) => String(n).padStart(2, "0");
  return {
    periodStart: `${year}-${pad(startMonth)}-01`,
    periodEnd:   `${year}-${pad(endMonth)}-${pad(lastDay)}`,
  };
}

/** Back-compat convenience wrapper — the original name, monthly only. */
function currentMonthlyPeriod(timezone, referenceDate = new Date()) {
  return currentPeriodForCadence("monthly", timezone, referenceDate);
}

// ── Eligibility ──────────────────────────────────────────────────────────

/**
 * isPlanDueForPeriod — pure eligibility check for a plan against an
 * ALREADY-COMPUTED period (see currentPeriodForCadence). `studentStatusById`
 * is an optional Map(studentId -> status); when provided, a plan whose
 * student is not "Active" (Inactive/Alumni — this app's "archived") is
 * skipped. Omitting it (as some direct unit tests do) skips that check
 * entirely, matching the pre-M3.5.1 behavior.
 */
function isPlanDueForPeriod(plan, periodStart, periodEnd, { studentStatusById } = {}) {
  if (plan.status !== "active")            return { eligible: false, reason: "not_active" };
  if (!BILLABLE_CADENCES.has(plan.cadence)) return { eligible: false, reason: "unsupported_cadence" };
  if (plan.startDate && plan.startDate > periodEnd)   return { eligible: false, reason: "not_started" };
  if (plan.endDate   && plan.endDate   < periodStart) return { eligible: false, reason: "plan_ended" };
  if (studentStatusById && studentStatusById.get(plan.studentLedgerId) !== "Active") {
    return { eligible: false, reason: "student_archived" };
  }
  return { eligible: true };
}

function isRetryable(err) {
  return !err.code; // VALIDATION / NOT_FOUND / REQUIRES_APPROVAL all carry a .code and are never retried
}

async function generateWithRetry(planId, ctx) {
  let lastErr;
  for (let attempt = 1; attempt <= RETRY_MAX_ATTEMPTS; attempt++) {
    try {
      return await billingEngineSvc.generateInvoiceForPlan(planId, ctx);
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || attempt === RETRY_MAX_ATTEMPTS) throw err;
      await sleep(RETRY_BACKOFF_MS[attempt - 1] || 3000);
    }
  }
  throw lastErr;
}

// ── Locking ──────────────────────────────────────────────────────────────

async function acquireLock(runId) {
  const ref = LOCK_DOC();
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      const d = snap.data();
      const stillHeld = !d.released && d.expiresAt && new Date(d.expiresAt).getTime() > Date.now();
      if (stillHeld) {
        const e = new Error(`Scheduler is already running (locked by run ${d.runId}, acquired ${d.acquiredAt}).`);
        e.code = "SCHEDULER_LOCKED";
        throw e;
      }
    }
    tx.set(ref, {
      runId, acquiredAt: nowISO(), expiresAt: new Date(Date.now() + LOCK_TTL_MS).toISOString(), released: false,
    });
  });
}

async function releaseLock(runId) {
  await LOCK_DOC().set({ runId, released: true, releasedAt: nowISO() }, { merge: true });
}

// ── Execution log ────────────────────────────────────────────────────────

async function logPlanResult(runId, entry) {
  await PLAN_RESULTS_COL().add({ ...entry, runId, loggedAt: nowISO() });
}

async function listRuns({ limit = 50 } = {}) {
  // financeSchedulerRuns is the one Finance collection with no natural
  // schoolId to filter by (a run spans every school) — a bare collection
  // .get() plus an in-memory sort, same "no .orderBy(), sort in JS"
  // convention every other Finance Foundation "list" function already
  // uses to avoid needing a Firestore composite index.
  const snap = await RUNS_COL().get();
  return snap.docs
    .map(d => ({ runId: d.id, ...d.data() }))
    .sort((a, b) => (b.startedAt || "").localeCompare(a.startedAt || ""))
    .slice(0, limit);
}

async function getRunDetail(runId) {
  const doc = await RUNS_COL().doc(runId).get();
  if (!doc.exists) return null;
  const resultsSnap = await PLAN_RESULTS_COL().where("runId", "==", runId).get();
  const planResults = resultsSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.loggedAt || "").localeCompare(b.loggedAt || ""));
  return { runId: doc.id, ...doc.data(), planResults };
}

// ── Core run ─────────────────────────────────────────────────────────────

/**
 * runSchedulerOnce — acquires the lock and creates the run doc
 * SYNCHRONOUSLY (fast — this is what the caller awaits), then processes
 * every eligible school/plan in the BACKGROUND (fire-and-forget, matching
 * this codebase's existing financeEventPublisher fire-and-forget
 * convention) so a manual "Run Now" call returns immediately with a runId
 * to poll rather than blocking the HTTP request for a potentially large
 * multi-school pass (see the "large datasets" validation scenario).
 *
 * `mode`: "manual" | "scheduled" | "preview" — the execution-mode field
 * requested for the Job Run record, set explicitly by each caller rather
 * than inferred, so it always reads correctly regardless of `triggeredBy`'s
 * finer-grained source label (manual/cron/startup-recovery/preview).
 * `schoolIds`: optional array — when provided, only these schools are
 * processed (used by the scheduled tick to target just the schools whose
 * own configured schedule is due right now); omitted (null) means "every
 * eligible school," the pre-M3.5.1 behavior, used by manual and preview runs.
 */
async function runSchedulerOnce({
  triggeredBy = "cron", mode = "scheduled", actorUserId = "scheduler",
  schoolIds = null, referenceDate = new Date(),
} = {}) {
  const runId = `SCHED-${Date.now()}`;
  await acquireLock(runId); // throws SCHEDULER_LOCKED if a run is already in progress

  // Recorded as `referenceDate` (defaults to "now") rather than always the
  // literal wall-clock instant — the run genuinely happened AT that
  // reference point, and this keeps _schoolsThatRanForDate's "did this
  // school already run today" check consistent with whatever instant drove
  // this run's period/eligibility math (matters for deterministic tests of
  // the scheduled tick and catch-up paths; in real usage referenceDate is
  // always `new Date()` anyway, so this is a no-op there).
  const startedAt = referenceDate.toISOString();
  await RUNS_COL().doc(runId).set({
    runId, triggeredBy, mode, actorUserId, startedAt, status: "running",
    schoolIds: schoolIds || [],
    schoolsProcessed: 0, plansEvaluated: 0, invoicesGenerated: 0,
    duplicatesSkipped: 0, plansSkipped: 0, plansFailed: 0,
  });

  _processRun(runId, { actorUserId, mode, schoolIds, referenceDate, startedAtMs: Date.now() }).catch(err => {
    console.error(`[financeBillingScheduler] run ${runId} crashed:`, err.message);
  });

  return { runId, status: "running", startedAt };
}

async function _processRun(runId, { actorUserId, mode, schoolIds, referenceDate, startedAtMs }) {
  const summary = {
    schoolsProcessed: 0, plansEvaluated: 0, invoicesGenerated: 0,
    duplicatesSkipped: 0, plansSkipped: 0, plansFailed: 0,
  };
  const processedSchoolIds = [];
  const isPreview = mode === "preview";

  try {
    const tenants = await tenantSvc.getAll({});
    let eligibleTenants = tenants.filter(t => t.status === "active" || t.status === "trial");
    if (schoolIds) eligibleTenants = eligibleTenants.filter(t => schoolIds.includes(t.tenantId));

    for (const tenant of eligibleTenants) {
      const schoolId  = tenant.tenantId;
      const timezone  = tenant.timezone || DEFAULT_TIMEZONE;

      // Fetched once per school (not once per plan) — builds a studentId ->
      // status map so per-plan eligibility can cheaply skip archived
      // (Inactive/Alumni) students without an extra read per plan. A
      // failure here degrades gracefully: the school's plans are still
      // evaluated, just without the archived-student check for this run.
      let studentStatusById = null;
      try {
        const students = await studentSvc.getAll({ schoolId });
        studentStatusById = new Map(students.map(s => [s.studentId, s.status]));
      } catch { /* archived-student check skipped for this school this run */ }

      let plans;
      try {
        // No status filter here — every plan (draft/active/paused/ended) is
        // fetched and passed through isPlanDueForPeriod() below, so a
        // paused/ended plan is correctly evaluated-and-skipped (and shows
        // up in the execution log with its reason), rather than silently
        // never appearing in the run's results at all.
        plans = await billingPlanSvc.listForSchool({ schoolId });
      } catch (err) {
        summary.plansFailed += 1;
        await logPlanResult(runId, { schoolId, outcome: "error", error: `Failed to list billing plans: ${err.message}` });
        continue;
      }

      summary.schoolsProcessed += 1;
      processedSchoolIds.push(schoolId);
      let schoolInvoicesGenerated = 0;

      for (const plan of plans) {
        summary.plansEvaluated += 1;

        // Cheap pre-check avoids computing a period for a cadence that
        // isn't a calendar-window one at all (termly/oneTime).
        if (plan.status !== "active" || !BILLABLE_CADENCES.has(plan.cadence)) {
          summary.plansSkipped += 1;
          await logPlanResult(runId, {
            schoolId, planId: plan.planId, studentLedgerId: plan.studentLedgerId,
            outcome: "skipped", reason: plan.status !== "active" ? "not_active" : "unsupported_cadence",
          });
          continue;
        }

        const { periodStart, periodEnd } = currentPeriodForCadence(plan.cadence, timezone, referenceDate);
        const elig = isPlanDueForPeriod(plan, periodStart, periodEnd, { studentStatusById });
        if (!elig.eligible) {
          summary.plansSkipped += 1;
          await logPlanResult(runId, {
            schoolId, planId: plan.planId, studentLedgerId: plan.studentLedgerId,
            outcome: "skipped", reason: elig.reason,
          });
          continue;
        }

        try {
          const result = await generateWithRetry(plan.planId, {
            schoolId, centerId: plan.centerId, actorUserId, periodStart, periodEnd,
            dryRun: isPreview,
          });

          if (isPreview) {
            if (result.duplicate) {
              summary.duplicatesSkipped += 1;
              await logPlanResult(runId, {
                schoolId, planId: plan.planId, studentLedgerId: plan.studentLedgerId,
                outcome: "wouldSkipDuplicate", invoiceId: result.invoice?.invoiceId,
              });
            } else if (result.requiresApproval) {
              summary.plansSkipped += 1;
              await logPlanResult(runId, {
                schoolId, planId: plan.planId, studentLedgerId: plan.studentLedgerId,
                outcome: "wouldRequireApproval", totalAmount: result.totalAmount,
              });
            } else {
              summary.invoicesGenerated += 1;
              schoolInvoicesGenerated += 1;
              await logPlanResult(runId, {
                schoolId, planId: plan.planId, studentLedgerId: plan.studentLedgerId,
                outcome: "wouldGenerate", totalAmount: result.totalAmount,
              });
            }
          } else if (result.duplicate) {
            summary.duplicatesSkipped += 1;
            await logPlanResult(runId, {
              schoolId, planId: plan.planId, studentLedgerId: plan.studentLedgerId,
              outcome: "duplicate", invoiceId: result.invoice?.invoiceId, newBalance: result.newBalance ?? null,
            });
          } else {
            summary.invoicesGenerated += 1;
            schoolInvoicesGenerated += 1;
            await logPlanResult(runId, {
              schoolId, planId: plan.planId, studentLedgerId: plan.studentLedgerId,
              outcome: "generated", invoiceId: result.invoice?.invoiceId, newBalance: result.newBalance ?? null,
            });
          }
        } catch (err) {
          if (err.code === "REQUIRES_APPROVAL") {
            // Preview mode never reaches here — generateInvoiceForPlan's
            // dryRun path returns requiresApproval:true instead of throwing.
            summary.plansSkipped += 1;
            await logPlanResult(runId, {
              schoolId, planId: plan.planId, studentLedgerId: plan.studentLedgerId,
              outcome: "requiresApproval", error: err.message,
            });
          } else {
            summary.plansFailed += 1;
            await logPlanResult(runId, {
              schoolId, planId: plan.planId, studentLedgerId: plan.studentLedgerId,
              outcome: "error", error: err.message, errorCode: err.code || "UNKNOWN",
            });
          }
        }
      }

      // Per-school audit entry — keeps every school's OWN Audit Log screen
      // honest about automated activity touching its data, without ever
      // writing a cross-tenant "platform" audit entry (this app's audit
      // trail is schoolId-scoped throughout; the scheduler must not break
      // that invariant even though it operates across schools). Skipped in
      // preview mode — a preview is not a real action, and the Finance
      // Audit Log's whole purpose is a compliance record of real ones.
      if (!isPreview) {
        await auditSvc.logFinanceAudit({
          schoolId, actorUserId,
          action: "scheduler.run.school", entityType: "schedulerRun", entityId: runId,
          meta: { plansEvaluated: plans.length, invoicesGenerated: schoolInvoicesGenerated },
        });
      }
    }

    const status = summary.plansFailed > 0 ? "completed_with_errors" : "completed";
    const completedAt = nowISO();
    await RUNS_COL().doc(runId).update({
      ...summary, completedAt, status, schoolIds: processedSchoolIds,
      durationMs: Date.now() - startedAtMs,
    });
    if (!isPreview) {
      eventPublisher.publish(eventPublisher.EVENTS.SCHEDULER_RUN_COMPLETED, { runId, ...summary, status });
    }
  } catch (err) {
    await RUNS_COL().doc(runId).update({
      status: "failed", completedAt: nowISO(), errorSummary: err.message,
      durationMs: Date.now() - startedAtMs,
    });
    if (!isPreview) {
      eventPublisher.publish(eventPublisher.EVENTS.SCHEDULER_RUN_FAILED, { runId, error: err.message });
    }
  } finally {
    await releaseLock(runId);
  }
}

// ── Configurable schedule (M3.5.1) ──────────────────────────────────────

/**
 * isScheduleDueNow — true if `schedule` (as configured in Finance Settings
 * for one school) should fire during the hour containing `referenceDate`,
 * in `timezone`. The platform-level cron tick that calls this runs hourly
 * (see registerCronJob), so "due now" only needs to check "is this the
 * matching hour" — no cron-expression parser needed for the three
 * supported presets.
 */
function isScheduleDueNow(schedule, hour, timezone, referenceDate = new Date()) {
  if (localHour(timezone, referenceDate) !== hour) return false;
  const { day, month } = localDateParts(timezone, referenceDate);
  if (schedule === "daily")          return true;
  if (schedule === "monthlyFirst")   return day === 1;
  if (schedule === "quarterlyFirst") return day === 1 && [1, 4, 7, 10].includes(month);
  return false;
}

/** Every schoolId that already had a run (of any trigger) covering "today", in that run's own local calendar day at UTC start-of-run. */
async function _schoolsThatRanForDate(dateStrByTimezoneFn) {
  const recentRuns = await listRuns({ limit: 200 });
  const ranToday = new Set();
  for (const run of recentRuns) {
    if (run.mode === "preview") continue; // a preview should never suppress a real scheduled run
    const runStarted = new Date(run.startedAt);
    for (const schoolId of run.schoolIds || []) {
      if (dateStrByTimezoneFn(schoolId, runStarted)) ranToday.add(schoolId);
    }
  }
  return ranToday;
}

/**
 * runScheduledTick — called once per hour by the cron trigger. Asks every
 * eligible school "is your own configured schedule due this hour, and have
 * you not already run today" and, if any qualify, kicks off ONE run scoped
 * to just those schools (`schoolIds` filter). A no-op (no run started) when
 * nothing is due — the common case for all but one hour a day per school.
 */
async function runScheduledTick(referenceDate = new Date()) {
  const tenants = await tenantSvc.getAll({});
  const eligibleTenants = tenants.filter(t => t.status === "active" || t.status === "trial");

  const tenantTimezone = {};
  eligibleTenants.forEach(t => { tenantTimezone[t.tenantId] = t.timezone || DEFAULT_TIMEZONE; });

  const alreadyRanToday = await _schoolsThatRanForDate((schoolId, runStarted) => {
    const tz = tenantTimezone[schoolId] || DEFAULT_TIMEZONE;
    return localDateString(tz, runStarted) === localDateString(tz, referenceDate);
  });

  const dueSchoolIds = [];
  for (const tenant of eligibleTenants) {
    const schoolId = tenant.tenantId;
    if (alreadyRanToday.has(schoolId)) continue;
    const timezone = tenantTimezone[schoolId];
    const settings = await settingsSvc.getSettings(schoolId);
    const schedule = settings.schedulerSchedule || "daily";
    const hour     = settings.schedulerHour ?? SCHEDULED_HOUR;
    if (isScheduleDueNow(schedule, hour, timezone, referenceDate)) dueSchoolIds.push(schoolId);
  }

  if (dueSchoolIds.length === 0) return { skipped: true, reason: "no_schools_due" };
  return runSchedulerOnce({ triggeredBy: "cron", mode: "scheduled", actorUserId: "scheduler", schoolIds: dueSchoolIds, referenceDate });
}

/**
 * maybeRunCatchUp — called once at server startup. For every eligible
 * school whose own configured schedule was due at some point today but
 * hasn't run yet (server was down through it), catches up exactly once;
 * a school that already ran today (scheduled or manual) is left alone.
 */
async function maybeRunCatchUp(referenceDate = new Date()) {
  const tenants = await tenantSvc.getAll({});
  const eligibleTenants = tenants.filter(t => t.status === "active" || t.status === "trial");

  const tenantTimezone = {};
  eligibleTenants.forEach(t => { tenantTimezone[t.tenantId] = t.timezone || DEFAULT_TIMEZONE; });

  const alreadyRanToday = await _schoolsThatRanForDate((schoolId, runStarted) => {
    const tz = tenantTimezone[schoolId] || DEFAULT_TIMEZONE;
    return localDateString(tz, runStarted) === localDateString(tz, referenceDate);
  });

  const dueSchoolIds = [];
  for (const tenant of eligibleTenants) {
    const schoolId = tenant.tenantId;
    if (alreadyRanToday.has(schoolId)) continue;
    const timezone = tenantTimezone[schoolId];
    const settings = await settingsSvc.getSettings(schoolId);
    const schedule = settings.schedulerSchedule || "daily";
    const hour     = settings.schedulerHour ?? SCHEDULED_HOUR;
    // "due at some point today" — the configured hour has already passed,
    // and (for monthly/quarterly presets) today is the matching day.
    const pastHour = localHour(timezone, referenceDate) >= hour;
    const dayMatches =
      schedule === "daily" ? true :
      schedule === "monthlyFirst" ? localDateParts(timezone, referenceDate).day === 1 :
      schedule === "quarterlyFirst" ? (localDateParts(timezone, referenceDate).day === 1 && [1, 4, 7, 10].includes(localDateParts(timezone, referenceDate).month)) :
      false;
    if (pastHour && dayMatches) dueSchoolIds.push(schoolId);
  }

  if (dueSchoolIds.length === 0) return { skipped: true, reason: "nothing_due" };
  return runSchedulerOnce({ triggeredBy: "startup-recovery", mode: "scheduled", actorUserId: "scheduler", schoolIds: dueSchoolIds, referenceDate });
}

/**
 * Registers the platform-level HOURLY cron trigger. Caller (server.js)
 * only invokes this inside the FINANCE_FOUNDATION_ENABLED block —
 * cron.schedule() must never be called at all when the flag is off. Fires
 * every hour on the hour; runScheduledTick() itself decides which (if any)
 * schools are actually due this hour based on their own configured
 * schedule — nothing about WHEN billing happens is hardcoded here.
 */
function registerCronJob() {
  return cron.schedule("0 * * * *", () => {
    runScheduledTick()
      .catch(err => console.error("[financeBillingScheduler] scheduled tick failed:", err.message));
  }, { timezone: DEFAULT_TIMEZONE });
}

// ── Dashboard ────────────────────────────────────────────────────────────

/**
 * computeNextDue — the next datetime (ISO string) at/after `referenceDate`
 * when `schedule`+`hour` will next fire, in `timezone`. Walks forward an
 * hour at a time (cheap, no I/O) until isScheduleDueNow matches; capped at
 * ~400 days as a defensive bound against an unforeseen bug ever looping
 * forever, though every supported preset resolves within a few months.
 */
function computeNextDue(schedule, hour, timezone, referenceDate = new Date()) {
  let cursor = new Date(referenceDate.getTime());
  for (let i = 0; i < 24 * 400; i++) {
    cursor = new Date(cursor.getTime() + 60 * 60 * 1000);
    if (isScheduleDueNow(schedule, hour, timezone, cursor)) return cursor.toISOString();
  }
  return null;
}

/**
 * getDashboardSummary — the 5 tiles requested for the Recurring Billing
 * screen. Platform-wide (this scheduler is inherently cross-tenant, same
 * as the rest of this module): "next scheduled run" is the SOONEST
 * upcoming run across every eligible school's own schedule, not a single
 * shared time. "Scheduler health" is a simple, explicitly-documented
 * heuristic — not a fancy SLA computation: "attention" if the distributed
 * lock is held past its own TTL (a run likely crashed without releasing
 * it), "degraded" if the most recent run is a failure more recent than the
 * most recent success, "unknown" if the scheduler has never run at all,
 * "healthy" otherwise.
 */
async function getDashboardSummary() {
  const recentRuns = await listRuns({ limit: 200 });
  const lastSuccessfulRun = recentRuns.find(r => r.status === "completed" || r.status === "completed_with_errors") || null;
  const lastFailure       = recentRuns.find(r => r.status === "failed") || null;
  const totalInvoicesGenerated = recentRuns.reduce((sum, r) => sum + (Number(r.invoicesGenerated) || 0), 0);

  const tenants = await tenantSvc.getAll({});
  const eligibleTenants = tenants.filter(t => t.status === "active" || t.status === "trial");
  let nextScheduledRun = null;
  for (const tenant of eligibleTenants) {
    const timezone = tenant.timezone || DEFAULT_TIMEZONE;
    const settings = await settingsSvc.getSettings(tenant.tenantId);
    const schedule = settings.schedulerSchedule || "daily";
    const hour     = settings.schedulerHour ?? SCHEDULED_HOUR;
    const next = computeNextDue(schedule, hour, timezone);
    if (next && (!nextScheduledRun || next < nextScheduledRun)) nextScheduledRun = next;
  }

  const lockSnap = await LOCK_DOC().get();
  const lockData = lockSnap.exists ? lockSnap.data() : null;
  const lockStuck = Boolean(lockData && !lockData.released && lockData.expiresAt && new Date(lockData.expiresAt).getTime() < Date.now());

  let health = "healthy";
  if (lockStuck) health = "attention";
  else if (!recentRuns.length) health = "unknown";
  else if (lastFailure && (!lastSuccessfulRun || lastFailure.startedAt > lastSuccessfulRun.startedAt)) health = "degraded";

  return { lastSuccessfulRun, nextScheduledRun, totalInvoicesGenerated, lastFailure, health };
}

module.exports = {
  runSchedulerOnce, runScheduledTick, maybeRunCatchUp, registerCronJob,
  listRuns, getRunDetail, getDashboardSummary,
  // exported for tests only
  currentMonthlyPeriod, currentPeriodForCadence, isPlanDueForPeriod, isScheduleDueNow,
  computeNextDue, localDateString, localDateParts, localHour,
};
