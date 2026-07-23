/**
 * financeBillingSchedulerService.js — Recurring Billing Scheduler (M3.5)
 * ────────────────────────────────────────────────────────────────────
 * Automates what a human already does manually via
 * `POST /api/finance/billing-plans/:planId/generate-invoice`
 * (financeBillingEngineService.generateInvoiceForPlan). This file adds NO
 * new billing logic of its own — it discovers which Billing Plans are due,
 * computes the period, and calls the exact same, already-frozen
 * orchestration (Rules Engine → Invoice → Ledger Entry → Audit) that the
 * manual flow uses. Proration, sibling discounts, and the
 * discountApprovalThreshold gate all keep working exactly as already
 * validated in Sprint 3/4 — this file never touches that logic.
 *
 * ── Scope decision, stated plainly ──────────────────────────────────────
 * Only `cadence: "monthly"` plans are auto-billed. `"termly"` has no
 * term-boundary model anywhere in this codebase (Billing Plan carries no
 * term start/end), and `"oneTime"` plans are — by definition — a single
 * manual charge, not a recurring one. Both remain manual-only via the
 * existing Generate Invoice screen/endpoint, exactly as they are today.
 * This is a deliberate scope boundary, not an oversight.
 *
 * ── Multi-tenant ─────────────────────────────────────────────────────────
 * One run iterates every tenant (`tenantService.getAll()`) with
 * status "active" or "trial", and within each tenant every active Billing
 * Plan for that `schoolId`. Every finance-service call the scheduler makes
 * passes `schoolId` explicitly — it never relies on any service's
 * `process.env.SCHOOL_ID` default, which would silently only ever bill one
 * school.
 *
 * ── Idempotency / duplicate protection ────────────────────────────────────
 * Fully inherited, not reimplemented: `generateInvoiceForPlan` already
 * dedupes on `(planId, periodStart)` via `financeInvoiceService
 * .findByPlanAndPeriod`, and its Ledger Entry step dedupes independently
 * via `(schoolId, studentLedgerId, sourceType, sourceId)` (M3.1). A retried
 * or overlapping call for the same plan+period converges safely — this
 * file adds no new dedup layer at the invoice level.
 *
 * ── Distributed locking / crash recovery ──────────────────────────────────
 * A single Firestore document (`financeSchedulerLocks/global`) acquired
 * via a transaction is this platform's coordination point — the "single
 * VPS, no multi-instance orchestration" reality documented in this
 * project's own Domain Architecture means there is no fleet of app
 * servers to coordinate across, but the SAME two real risks a distributed
 * lock protects against still exist here: (a) a manual "Run Now" click
 * overlapping a live cron tick, and (b) the process crashing mid-run and
 * leaving a stale in-progress state. A TTL (30 min) on the lock means a
 * crash never permanently wedges the scheduler — the next attempt (cron
 * tomorrow, a manual run, or the startup catch-up check below) proceeds
 * once the TTL expires, with zero special-cased crash-recovery code.
 *
 * ── Recovery after server restart ─────────────────────────────────────────
 * `maybeRunCatchUp()`, called once at server startup (see server.js),
 * checks the most recent run's date (in the scheduler's own timezone) — if
 * no run happened today AND the current local time is past the scheduled
 * hour, it runs once immediately. If a run (cron OR manual) already
 * happened today, it does nothing — never double-runs.
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
 * attempted.
 *
 * ── Time zone handling ────────────────────────────────────────────────────
 * The cron trigger itself fires once, at a single configured wall-clock
 * time (01:00 Asia/Kolkata — see server.js's `cron.schedule(...,
 * { timezone: "Asia/Kolkata" })`), matching this platform's only real
 * tenants today (`tenantService`'s own `timezone` default is
 * "Asia/Kolkata"). Within that one trigger, EVERY school's "current
 * month" boundary is computed using THAT school's own `tenant.timezone`
 * field (`localDateParts`/`currentMonthlyPeriod` below, via
 * `Intl.DateTimeFormat` — no new date-library dependency added), so the
 * period math stays correct even for a future tenant in a different
 * timezone, even though the trigger itself is a single daily tick.
 *
 * ── Monitoring / execution logs ────────────────────────────────────────────
 * `financeSchedulerRuns/{runId}` (summary + status) plus a separate
 * top-level `financeSchedulerPlanResults` collection (one doc per plan
 * outcome, tagged with `runId`) — a separate collection rather than an
 * array field on the run doc specifically so a run touching a large
 * number of plans across many schools never approaches Firestore's 1MB
 * document size limit; a flat collection with a `runId` field rather than
 * a subcollection so the exact same query shape (`where("field","==",x)`)
 * this whole module already uses everywhere else applies here too.
 */
const cron = require("node-cron");
const { db } = require("../firebaseAdmin");
const tenantSvc        = require("./tenantService");
const billingPlanSvc   = require("./billingPlanService");
const billingEngineSvc = require("./financeBillingEngineService");
const auditSvc         = require("./financeAuditService");
const eventPublisher   = require("./financeEventPublisher");

const RUNS_COL         = () => db.collection("financeSchedulerRuns");
const PLAN_RESULTS_COL = () => db.collection("financeSchedulerPlanResults");
const LOCK_DOC         = () => db.collection("financeSchedulerLocks").doc("global");
const LOCK_TTL_MS = 30 * 60 * 1000; // 30 minutes — see "Distributed locking" above
const DEFAULT_TIMEZONE = "Asia/Kolkata";
const SCHEDULED_HOUR   = 1; // 01:00 local — matches server.js's cron expression
const RETRY_MAX_ATTEMPTS = 3;
const RETRY_BACKOFF_MS   = [1000, 3000];

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
 * currentMonthlyPeriod — the calendar month containing `referenceDate`, in
 * `timezone`. Uses the same "day 0 of next month = last day of this month"
 * technique already used elsewhere in this codebase (e.g. the demo seed
 * script), which JS Date resolves correctly across month-end and leap
 * years (Feb 29) without any special-casing.
 */
function currentMonthlyPeriod(timezone, referenceDate = new Date()) {
  const { year, month } = localDateParts(timezone, referenceDate);
  const lastDay = new Date(year, month, 0).getDate(); // `month` is 1-indexed; Date's 0-indexed month param = next month, day 0 = last day of `month`
  const pad = (n) => String(n).padStart(2, "0");
  return {
    periodStart: `${year}-${pad(month)}-01`,
    periodEnd:   `${year}-${pad(month)}-${pad(lastDay)}`,
  };
}

// ── Eligibility ──────────────────────────────────────────────────────────

function isPlanDueForPeriod(plan, periodStart, periodEnd) {
  if (plan.status !== "active")     return { eligible: false, reason: "not_active" };
  if (plan.cadence !== "monthly")   return { eligible: false, reason: "unsupported_cadence" };
  if (plan.startDate && plan.startDate > periodEnd)   return { eligible: false, reason: "not_started" };
  if (plan.endDate   && plan.endDate   < periodStart) return { eligible: false, reason: "plan_ended" };
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
 */
async function runSchedulerOnce({ triggeredBy = "cron", actorUserId = "scheduler" } = {}) {
  const runId = `SCHED-${Date.now()}`;
  await acquireLock(runId); // throws SCHEDULER_LOCKED if a run is already in progress

  const startedAt = nowISO();
  await RUNS_COL().doc(runId).set({
    runId, triggeredBy, actorUserId, startedAt, status: "running",
    schoolsProcessed: 0, plansEvaluated: 0, invoicesGenerated: 0, plansSkipped: 0, plansFailed: 0,
  });

  _processRun(runId, { triggeredBy, actorUserId }).catch(err => {
    console.error(`[financeBillingScheduler] run ${runId} crashed:`, err.message);
  });

  return { runId, status: "running", startedAt };
}

async function _processRun(runId, { actorUserId }) {
  const summary = { schoolsProcessed: 0, plansEvaluated: 0, invoicesGenerated: 0, plansSkipped: 0, plansFailed: 0 };

  try {
    const tenants = await tenantSvc.getAll({});
    const eligibleTenants = tenants.filter(t => t.status === "active" || t.status === "trial");

    for (const tenant of eligibleTenants) {
      const schoolId  = tenant.tenantId;
      const timezone  = tenant.timezone || DEFAULT_TIMEZONE;
      const { periodStart, periodEnd } = currentMonthlyPeriod(timezone);

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
      let schoolInvoicesGenerated = 0;

      for (const plan of plans) {
        summary.plansEvaluated += 1;
        const elig = isPlanDueForPeriod(plan, periodStart, periodEnd);
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
          });
          summary.invoicesGenerated += 1;
          schoolInvoicesGenerated += 1;
          await logPlanResult(runId, {
            schoolId, planId: plan.planId, studentLedgerId: plan.studentLedgerId,
            outcome: result.duplicate ? "duplicate" : "generated",
            invoiceId: result.invoice?.invoiceId, newBalance: result.newBalance ?? null,
          });
        } catch (err) {
          if (err.code === "REQUIRES_APPROVAL") {
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
      // that invariant even though it operates across schools).
      await auditSvc.logFinanceAudit({
        schoolId, actorUserId,
        action: "scheduler.run.school", entityType: "schedulerRun", entityId: runId,
        meta: { periodStart, periodEnd, plansEvaluated: plans.length, invoicesGenerated: schoolInvoicesGenerated },
      });
    }

    const status = summary.plansFailed > 0 ? "completed_with_errors" : "completed";
    await RUNS_COL().doc(runId).update({ ...summary, completedAt: nowISO(), status });
    eventPublisher.publish(eventPublisher.EVENTS.SCHEDULER_RUN_COMPLETED, { runId, ...summary, status });
  } catch (err) {
    await RUNS_COL().doc(runId).update({ status: "failed", completedAt: nowISO(), errorSummary: err.message });
    eventPublisher.publish(eventPublisher.EVENTS.SCHEDULER_RUN_FAILED, { runId, error: err.message });
  } finally {
    await releaseLock(runId);
  }
}

/**
 * maybeRunCatchUp — called once at server startup. If the server was down
 * through the scheduled hour, this catches up exactly once; if a run
 * (cron OR manual) already happened today, it's a no-op.
 */
async function maybeRunCatchUp(referenceDate = new Date()) {
  const todayStr = localDateString(DEFAULT_TIMEZONE, referenceDate);
  const allRuns = await listRuns({ limit: 1 });
  const lastRun = allRuns[0] || null;
  const lastRunDateStr = lastRun ? localDateString(DEFAULT_TIMEZONE, new Date(lastRun.startedAt)) : null;

  if (lastRunDateStr === todayStr) {
    return { skipped: true, reason: "already_ran_today" };
  }
  if (localHour(DEFAULT_TIMEZONE, referenceDate) < SCHEDULED_HOUR) {
    return { skipped: true, reason: "before_scheduled_hour" };
  }
  return runSchedulerOnce({ triggeredBy: "startup-recovery", actorUserId: "scheduler" });
}

/** Registers the daily cron trigger. Caller (server.js) only invokes this
 * inside the FINANCE_FOUNDATION_ENABLED block — cron.schedule() must never
 * be called at all when the flag is off. */
function registerCronJob() {
  return cron.schedule("0 1 * * *", () => {
    runSchedulerOnce({ triggeredBy: "cron", actorUserId: "scheduler" })
      .catch(err => console.error("[financeBillingScheduler] cron trigger failed:", err.message));
  }, { timezone: DEFAULT_TIMEZONE });
}

module.exports = {
  runSchedulerOnce, maybeRunCatchUp, registerCronJob,
  listRuns, getRunDetail,
  // exported for tests only
  currentMonthlyPeriod, isPlanDueForPeriod, localDateString, localDateParts, localHour,
};
