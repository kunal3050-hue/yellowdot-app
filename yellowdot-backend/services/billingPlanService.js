/**
 * billingPlanService.js — Finance Foundation: Billing Plan
 * ────────────────────────────────────────────────────────────────────
 * Collection: billingPlans/{planId}
 *
 * Sprint 1 scope: the Billing Plan record and its lifecycle only.
 * Deliberately NOT wired to any scheduler/automation — "do not enable
 * recurring billing" — no invoice is ever generated from a plan yet.
 * References an existing feeTemplates document by ID rather than a new
 * Fee Component collection (out of Sprint 1 scope; feeTemplates already
 * plays that role today).
 */
const { db }              = require("../firebaseAdmin");
const { logFinanceAudit } = require("./financeAuditService");
const ledgerSvc           = require("./studentLedgerService");
const { publish, EVENTS } = require("./financeEventPublisher");

const SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";
const col       = () => db.collection("billingPlans");
const nowISO    = () => new Date().toISOString();

const STATUSES        = new Set(["draft", "active", "paused", "ended"]);
const JOINING_POLICIES = new Set(["fullMonth", "prorated", "nextCycle"]);
const CADENCES        = new Set(["monthly", "termly", "oneTime"]);

function docToBillingPlan(snap) {
  const d  = snap.data ? snap.data() : snap;
  const id = snap.id   || d.planId || "";
  return {
    planId:            d.planId            || id,
    schoolId:          d.schoolId          || SCHOOL_ID,
    centerId:          d.centerId          || "",
    studentLedgerId:   d.studentLedgerId   || "",
    feeTemplateId:     d.feeTemplateId     || "",
    cadence:           CADENCES.has(d.cadence) ? d.cadence : "monthly",
    joiningDatePolicy: JOINING_POLICIES.has(d.joiningDatePolicy) ? d.joiningDatePolicy : "fullMonth",
    startDate:         d.startDate         || "",
    endDate:           d.endDate           || "",
    status:            STATUSES.has(d.status) ? d.status : "draft",
    notes:             d.notes             || "",
    createdAt:         d.createdAt         || "",
    updatedAt:         d.updatedAt         || "",
    createdBy:         d.createdBy         || "",
    updatedBy:         d.updatedBy         || "",
  };
}

async function _nextPlanId() {
  const ref = db.collection("_counters").doc("billingPlans");
  let n = 1;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    n = snap.exists ? (snap.data().count || 0) + 1 : 1;
    tx.set(ref, { count: n }, { merge: true });
  });
  return `BPL${String(n).padStart(6, "0")}`;
}

function _validate(data) {
  const errors = [];
  if (!data.studentLedgerId) errors.push("studentLedgerId is required.");
  if (!data.feeTemplateId)   errors.push("feeTemplateId is required.");
  if (data.cadence && !CADENCES.has(data.cadence)) errors.push(`Invalid cadence "${data.cadence}".`);
  if (data.joiningDatePolicy && !JOINING_POLICIES.has(data.joiningDatePolicy)) {
    errors.push(`Invalid joiningDatePolicy "${data.joiningDatePolicy}".`);
  }
  if (errors.length) { const e = new Error(errors.join(" ")); e.code = "VALIDATION"; throw e; }
}

async function getPlan(planId, { schoolId = SCHOOL_ID } = {}) {
  const snap = await col().doc(planId).get();
  if (!snap.exists) return null;
  const plan = docToBillingPlan(snap);
  if (plan.schoolId !== schoolId) return null; // hide, don't reveal
  return plan;
}

async function listForStudent(studentId, { schoolId = SCHOOL_ID } = {}) {
  const snap = await col()
    .where("schoolId",        "==", schoolId)
    .where("studentLedgerId", "==", studentId)
    .get();
  return snap.docs.map(docToBillingPlan);
}

/**
 * create() requires an existing, active ledger for the student — a
 * Billing Plan without a ledger to post against is a data-integrity
 * failure, per Domain Architecture Part 1's "system invariant" framing.
 */
async function create(data, { schoolId = SCHOOL_ID, centerId = "", actorUserId = "system" } = {}) {
  _validate(data);

  const ledger = await ledgerSvc.getLedger(data.studentLedgerId, { schoolId });
  if (!ledger) { const e = new Error("No ledger exists for this student."); e.code = "VALIDATION"; throw e; }
  if (ledger.status !== "active") { const e = new Error(`Ledger is ${ledger.status} — cannot attach a plan.`); e.code = "VALIDATION"; throw e; }

  const planId = await _nextPlanId();
  const doc = {
    planId,
    schoolId,
    centerId:          centerId || ledger.centerId || "",
    studentLedgerId:   data.studentLedgerId,
    feeTemplateId:     data.feeTemplateId,
    cadence:           data.cadence           || "monthly",
    joiningDatePolicy: data.joiningDatePolicy || "fullMonth",
    startDate:         data.startDate         || "",
    endDate:           data.endDate           || "",
    status:            "draft", // Sprint 1: created in draft; activation is a deliberate separate step
    notes:             data.notes             || "",
    createdAt:         nowISO(),
    updatedAt:         nowISO(),
    createdBy:         actorUserId,
  };
  await col().doc(planId).set(doc);

  await logFinanceAudit({
    schoolId, actorUserId,
    action: "billingPlan.create", entityType: "billingPlan", entityId: planId,
    meta: { studentLedgerId: data.studentLedgerId, feeTemplateId: data.feeTemplateId },
  });

  publish(EVENTS.BILLING_PLAN_CREATED, {
    schoolId, centerId: doc.centerId, planId,
    studentLedgerId: data.studentLedgerId, feeTemplateId: data.feeTemplateId, actorUserId,
  });

  return doc;
}

/** Status transitions only (draft→active, active↔paused, *→ended). No invoice is ever generated here. */
async function setStatus(planId, status, { schoolId = SCHOOL_ID, actorUserId = "system" } = {}) {
  if (!STATUSES.has(status)) { const e = new Error(`Invalid status "${status}".`); e.code = "VALIDATION"; throw e; }

  const plan = await getPlan(planId, { schoolId });
  if (!plan) return null;

  await col().doc(planId).update({ status, updatedAt: nowISO(), updatedBy: actorUserId });

  await logFinanceAudit({
    schoolId, actorUserId,
    action: `billingPlan.${status}`, entityType: "billingPlan", entityId: planId,
  });

  return { ...plan, status };
}

module.exports = { getPlan, listForStudent, create, setStatus, STATUSES, JOINING_POLICIES, CADENCES };
