/**
 * admissionFinanceService.js — Sprint 2 admission integration + M3.6
 * automatic recurring-billing setup on admission.
 * ────────────────────────────────────────────────────────────────────
 * Wires the Admission Finance Engine's real trigger points: the moment a
 * student is admitted, and the moment a student is linked to a family.
 *
 * This file only ever creates a Student Ledger, ensures a Family Account
 * exists, and — only when a fee template is actually supplied — creates a
 * Billing Plan AND activates it (M3.6: "no additional staff actions"
 * requirement). Everything downstream of that (payment automation,
 * collections, parent finance portal, production migration) remains out
 * of scope here, unchanged.
 *
 * Idempotency (M3.6): a retried/duplicate call for the same student must
 * never create a second Billing Plan, and must never re-attempt an
 * already-active plan. `billingPlanSvc.listForStudent()` is checked
 * BEFORE creating — if a plan already exists for this student, that plan
 * is reused instead. If it exists but is still `draft` (e.g. a prior call
 * created it but failed before activating), activation is retried — the
 * exact same "a retry of the same call always converges" self-healing
 * property `financeBillingEngineService.generateInvoiceForPlan` already
 * uses for its own two-write orchestration, applied here to this file's
 * own two-write (create + activate) sequence.
 *
 * Resilience contract: every exported function here is designed to be
 * called from an existing, working endpoint (admission, family linking)
 * that must keep behaving exactly as it does today. A failure anywhere in
 * this file must NEVER surface as a failure of that underlying operation —
 * every step is individually caught and logged, matching the existing
 * "fire-and-forget, don't fail the caller" pattern already used in
 * server.js for auto-creating pickup-authorization records on admission.
 * If activation fails after a plan is created, the plan is simply left in
 * `draft` — a graceful, staff-visible fallback (Billing Plans screen),
 * not a crash — and self-heals on the next retried call, per above.
 */
const studentLedgerSvc     = require("./studentLedgerService");
const familyAccountSvc     = require("./familyAccountService");
const billingPlanSvc       = require("./billingPlanService");
const { Money }            = require("../domain/valueObjects");

// NOTE: financeTransaction.js's runFinanceTransaction() is not used here —
// every step below already delegates to a service (studentLedgerService,
// familyAccountService, billingPlanService) that owns its own transaction
// and audit logging internally. There is no new, direct multi-document
// Firestore write happening in this file that would need its own wrapped
// transaction. It remains available for the first future service that
// genuinely needs one (see Sprint 2 report).

function _logFailure(step, err) {
  console.error(`[admissionFinanceService] ${step} failed (admission itself is unaffected):`, err.message);
}

/**
 * onStudentAdmitted — call once, right after a student record is created.
 *
 * Always creates the Student Ledger. Optionally ensures a Family Account
 * (if familyId is already known at admission time). If a fee template was
 * selected at admission, creates a Billing Plan AND activates it — the
 * student is fully prepared for recurring billing with zero further staff
 * action, per M3.6. `admissionDate` (when supplied) becomes the plan's own
 * `startDate`, and the plan is prorated by default — a mid-cycle admission
 * should only ever be charged for the remaining days of the current
 * period, not a full one (the exact scenario financeRulesEngine's
 * proration already exists to handle correctly).
 */
async function onStudentAdmitted({
  studentId, schoolId, centerId, familyId = "", feeTemplateId = "",
  admissionDate = "", amount, actorUserId = "system",
} = {}) {
  const outcome = { ledger: null, familyAccount: null, billingPlan: null };

  try {
    outcome.ledger = await studentLedgerSvc.createLedger(studentId, { schoolId, centerId, familyId, actorUserId });
  } catch (err) {
    _logFailure("studentLedgerService.createLedger", err);
    return outcome; // no ledger means nothing downstream can safely proceed
  }

  if (familyId) {
    try {
      outcome.familyAccount = await familyAccountSvc.ensureFinanceAccount(familyId, { schoolId, actorUserId });
    } catch (err) {
      _logFailure("familyAccountService.ensureFinanceAccount", err);
    }
  }

  if (feeTemplateId) {
    try {
      // Idempotent: a retried/duplicate call for this exact student must
      // never create a second plan — reuse whatever already exists.
      const existingPlans = await billingPlanSvc.listForStudent(studentId, { schoolId });
      let plan = existingPlans[0] || null;

      if (!plan) {
        // amount is optional context only (for the Money-typed log line
        // below) — billingPlanService itself is the source of truth for
        // the plan's real amount, which it reads from the fee template,
        // not from this value.
        if (amount !== undefined) {
          const asMoney = new Money(amount);
          console.log(`[admissionFinanceService] auto billing plan for ${studentId}: ${asMoney.toString()} (${feeTemplateId})`);
        }
        plan = await billingPlanSvc.create(
          {
            studentLedgerId: studentId, feeTemplateId,
            cadence: "monthly", joiningDatePolicy: "prorated",
            startDate: admissionDate || "",
          },
          { schoolId, centerId, actorUserId }
        );
      }

      // Self-heals a prior partial failure (created but never activated) —
      // a retry with the plan already active is a safe, cheap no-op skip.
      if (plan.status === "draft") {
        plan = await billingPlanSvc.setStatus(plan.planId, "active", { schoolId, actorUserId });
      }

      outcome.billingPlan = plan;
    } catch (err) {
      _logFailure("billingPlanService.create/activate", err);
    }
  }

  return outcome;
}

/**
 * onStudentLinkedToFamily — call after a student is linked to an existing
 * or newly-created family (POST /api/families/:familyId/students/:studentId).
 * Ensures the family has a Finance Account facet; idempotent, so calling
 * this for a family that already has one is a safe no-op.
 */
async function onStudentLinkedToFamily({ familyId, studentId, schoolId, actorUserId = "system" } = {}) {
  try {
    return await familyAccountSvc.ensureFinanceAccount(familyId, { schoolId, actorUserId });
  } catch (err) {
    _logFailure("familyAccountService.ensureFinanceAccount (via family link)", err);
    return null;
  }
}

module.exports = { onStudentAdmitted, onStudentLinkedToFamily };
