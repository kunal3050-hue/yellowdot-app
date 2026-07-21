/**
 * financeBillingEngineService.js — Finance Foundation: Manual Billing Engine
 * (Sprint 3, M3.4)
 * ────────────────────────────────────────────────────────────────────
 * The staff-triggered "generate this plan's next invoice now" operation —
 * per the Sprint 3 approval: "Staff selects a Student or Billing Plan.
 * Staff clicks Generate Invoice. System creates: Invoice, Invoice Lines,
 * Ledger Entries, Audit Log." Deliberately manual/on-demand only — no
 * scheduler, no automatic recurring billing, nothing here fires on its
 * own. That is M3.5, explicitly deferred.
 *
 * Orchestrates three already-frozen services rather than owning any
 * storage of its own:
 *   1. financeRulesEngine   — pure joining-date proration + sibling discount
 *   2. financeInvoiceService — writes the Invoice + Invoice Lines
 *   3. ledgerEntryService    — posts the matching Ledger Entry (charge)
 *
 * Idempotency: a Billing Plan generates at most one Invoice per period —
 * enforced via financeInvoiceService.findByPlanAndPeriod() BEFORE any
 * write. If an Invoice for this (planId, periodStart) already exists,
 * this function does not create a second one. Crucially, the Ledger
 * Entry step is *always* attempted (even on that already-existing-invoice
 * path) using the invoice's own sourceId as the idempotency key —
 * ledgerEntryService.createEntry()'s own (schoolId, studentLedgerId,
 * sourceType, sourceId) dedup (M3.1) then decides whether a new entry is
 * actually needed. This self-heals the one real partial-failure risk in
 * this two-write orchestration (an Invoice created but its Ledger Entry
 * failing before it could be posted, e.g. a transient error) without
 * requiring a cross-service Firestore transaction — a retry of the exact
 * same call always converges to "one Invoice, one matching Ledger Entry,"
 * never a duplicate of either.
 */
const { db }         = require("../firebaseAdmin");
const auditSvc       = require("./financeAuditService");
const billingPlanSvc = require("./billingPlanService");
const invoiceSvc     = require("./financeInvoiceService");
const ledgerEntrySvc = require("./ledgerEntryService");
const settingsSvc    = require("./financeSettingsService");
const familyService  = require("./familyService");
const rulesEngine    = require("./financeRulesEngine");

const SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";

async function _getFeeTemplate(feeTemplateId, schoolId) {
  const snap = await db.collection("feeTemplates").doc(feeTemplateId).get();
  if (!snap.exists) return null;
  const d = snap.data();
  if (d.schoolId && d.schoolId !== schoolId) return null; // hide, don't reveal
  return {
    templateId:   feeTemplateId,
    templateName: d.templateName || "",
    amount:       Number(d.amount) || 0,
  };
}

/** Reads the raw student doc directly rather than through studentService's
 * own read-mapper, which is already known (Chapter 1's audit) to silently
 * drop siblingOrder — this needs the real value, not the mapped one. */
async function _getStudentInfo(studentId, schoolId) {
  const snap = await db.collection("students").doc(studentId).get();
  if (!snap.exists) return { studentName: "", admissionDate: "", siblingOrder: 0 };
  const d = snap.data();
  if (d.schoolId && d.schoolId !== schoolId) return { studentName: "", admissionDate: "", siblingOrder: 0 };
  return {
    studentName:   d.name || d.studentName || "",
    admissionDate: d.admissionDate || "",
    siblingOrder:  Number(d.siblingOrder) || 0,
  };
}

/**
 * generateInvoiceForPlan — the single entry point for M3.4. Given an
 * active Billing Plan and the billing period being invoiced, produces a
 * correct, itemized, idempotent Invoice + Ledger Entry pair.
 */
async function generateInvoiceForPlan(planId, {
  schoolId = SCHOOL_ID, centerId = "", actorUserId = "system", periodStart, periodEnd,
} = {}) {
  if (!planId) { const e = new Error("planId is required."); e.code = "VALIDATION"; throw e; }
  if (!periodStart || !periodEnd) {
    const e = new Error("periodStart and periodEnd are required."); e.code = "VALIDATION"; throw e;
  }

  const plan = await billingPlanSvc.getPlan(planId, { schoolId });
  if (!plan) { const e = new Error("Billing plan not found."); e.code = "NOT_FOUND"; throw e; }
  if (plan.status !== "active") {
    const e = new Error(`Billing plan is ${plan.status} — must be active to generate an invoice.`); e.code = "VALIDATION"; throw e;
  }

  const studentId       = plan.studentLedgerId;
  const resolvedCenterId = centerId || plan.centerId || "";

  let invoice = await invoiceSvc.findByPlanAndPeriod(planId, periodStart, { schoolId });
  const invoiceWasExisting = Boolean(invoice);

  if (!invoice) {
    const template = await _getFeeTemplate(plan.feeTemplateId, schoolId);
    if (!template) { const e = new Error("Fee template not found for this billing plan."); e.code = "VALIDATION"; throw e; }

    const studentInfo = await _getStudentInfo(studentId, schoolId);
    const [settings, discountRulesDoc] = await Promise.all([
      settingsSvc.getSettings(schoolId),
      familyService.getDiscountRules(schoolId),
    ]);

    const evaluated = rulesEngine.evaluateBillingPlanInvoice({
      lines: [{ feeComponentId: template.templateId, label: template.templateName, amount: template.amount }],
      joiningDatePolicy: plan.joiningDatePolicy,
      // No admission date on record defaults to "already enrolled" (full
      // period owed) rather than blocking generation on missing data.
      joiningDate:  studentInfo.admissionDate || periodStart,
      periodStart, periodEnd,
      siblingOrder: studentInfo.siblingOrder,
      discountRules: discountRulesDoc.rules,
      discountApprovalThreshold: settings.discountApprovalThreshold,
    });

    if (evaluated.requiresApproval) {
      await auditSvc.logFinanceAudit({
        schoolId, actorUserId,
        action: "billingEngine.requiresApproval", entityType: "billingPlan", entityId: planId,
        meta: { discountPercent: evaluated.discountPercent, periodStart, periodEnd },
      });
      const e = new Error("This invoice's discount requires manual approval before it can be generated.");
      e.code = "REQUIRES_APPROVAL"; throw e;
    }

    invoice = await invoiceSvc.createInvoice({
      studentId, studentName: studentInfo.studentName,
      studentLedgerId: studentId, billingPlanId: planId,
      periodStart, periodEnd,
      lines: evaluated.lines,
    }, { schoolId, centerId: resolvedCenterId, actorUserId });
  }

  let ledgerEntry = null;
  let newBalance  = null;
  let ledgerWasDuplicate = false;

  if (invoice.totalAmount > 0) {
    const posted = await ledgerEntrySvc.createEntry(studentId, {
      type: "charge",
      amount: invoice.totalAmount,
      description: `Invoice ${invoice.invoiceNumber}`,
      sourceType: "invoice",
      sourceId: invoice.invoiceId,
    }, { schoolId, centerId: resolvedCenterId, actorUserId });
    ledgerEntry = posted.entry;
    newBalance  = posted.newBalance;
    ledgerWasDuplicate = posted.duplicate;
  }
  // A fully-discounted (zero-total) invoice creates no Ledger Entry —
  // ledgerEntryService.createEntry() requires a positive amount by
  // design (Domain Invariant: a Ledger Entry represents a real financial
  // movement), and there is none to represent here.

  await auditSvc.logFinanceAudit({
    schoolId, actorUserId,
    action: invoiceWasExisting ? "billingEngine.duplicate" : "billingEngine.generateInvoice",
    entityType: "billingPlan", entityId: planId,
    meta: { invoiceId: invoice.invoiceId, totalAmount: invoice.totalAmount, periodStart, periodEnd },
  });

  return {
    invoice, ledgerEntry, newBalance,
    duplicate: invoiceWasExisting && ledgerWasDuplicate,
  };
}

module.exports = { generateInvoiceForPlan };
