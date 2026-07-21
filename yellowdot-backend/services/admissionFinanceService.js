/**
 * admissionFinanceService.js — Sprint 2: Admission Integration
 * ────────────────────────────────────────────────────────────────────
 * Wires the Admission Finance Engine's first real trigger points (Chapter 1
 * / Domain Architecture): the moment a student is admitted, and the moment
 * a student is linked to a family. Nothing else.
 *
 * Explicitly OUT of scope here (per Sprint 2 instructions): invoice
 * generation, recurring billing, payment automation, collections, parent
 * finance portal, production migration. This file only ever creates a
 * Student Ledger, ensures a Family Account exists, and — only when a fee
 * template is actually supplied — creates a Billing Plan in `draft` status
 * (billingPlanService already defaults new plans to draft; nothing here
 * or anywhere else activates one, so "recurring billing remains disabled"
 * holds regardless of what this file does).
 *
 * Resilience contract: every exported function here is designed to be
 * called from an existing, working endpoint (admission, family linking)
 * that must keep behaving exactly as it does today. A failure anywhere in
 * this file must NEVER surface as a failure of that underlying operation —
 * every step is individually caught and logged, matching the existing
 * "fire-and-forget, don't fail the caller" pattern already used in
 * server.js for auto-creating pickup-authorization records on admission.
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
 * (if familyId is already known at admission time) and optionally creates
 * a draft Billing Plan (only if feeTemplateId is supplied — the current
 * admission UI does not send one yet, so in practice this step is a no-op
 * today; it activates naturally once that's wired up, without needing any
 * change here).
 */
async function onStudentAdmitted({ studentId, schoolId, centerId, familyId = "", feeTemplateId = "", amount, actorUserId = "system" } = {}) {
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
      // amount is optional context only (for the Money-typed log line below) —
      // billingPlanService itself is the source of truth for the plan's real
      // amount, which it reads from the fee template, not from this value.
      if (amount !== undefined) {
        const asMoney = new Money(amount);
        console.log(`[admissionFinanceService] draft billing plan for ${studentId}: ${asMoney.toString()} (${feeTemplateId})`);
      }
      outcome.billingPlan = await billingPlanSvc.create(
        { studentLedgerId: studentId, feeTemplateId },
        { schoolId, centerId, actorUserId }
      );
    } catch (err) {
      _logFailure("billingPlanService.create", err);
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
