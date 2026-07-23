/**
 * financeRefundReversalService.js — Finance Foundation: Refund &
 * Reversal Workflow (Sprint 4, M4.5)
 * ────────────────────────────────────────────────────────────────────
 * Two related but distinct actions, per `02_DOMAIN_ARCHITECTURE.md`'s
 * own Refund entity design:
 *
 * REFUND (money paid back out): Requested → Approved/Rejected →
 * Processed, gated by the existing (never-yet-enforced until now)
 * `financeSettings.refundApprovalThreshold` field. A new
 * `financeRefunds` collection formalizes this workflow — Domain
 * Architecture Chapter 2 explicitly named this "a workflow that today
 * has no entity, route, or controller at all," so unlike Payment
 * (which extends the existing `payments` collection), Refund has no
 * legacy collection to extend.
 *
 * REVERSAL (a Payment turns out to be invalid — e.g. a bounced cheque):
 * never edits or deletes the original Payment or its Ledger Entries —
 * posts new, offsetting Ledger Entries (one per ledger the Payment had
 * allocated) and transitions the Payment to `Reversed`.
 *
 * Approver authority is validated at the ROUTE layer (a separate,
 * narrower `finance-refund-approval` permission — see
 * `financeRefundRoutes.js`), never trusted from anything the client
 * sends in the request body — matching `02_DOMAIN_ARCHITECTURE.md`'s
 * own citation of `userService.js`'s `ASSIGNABLE_ROLES` capping pattern
 * as the model to follow.
 */
const { db }           = require("../firebaseAdmin");
const auditSvc         = require("./financeAuditService");
const eventPublisher   = require("./financeEventPublisher");
const paymentSvc       = require("./financePaymentService");
const stateMachine     = require("./financePaymentStateMachine");
const ledgerEntrySvc   = require("./ledgerEntryService");
const settingsSvc      = require("./financeSettingsService");
const familyAccountSvc = require("./familyAccountService");

const SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";
const col       = () => db.collection("financeRefunds");
const nowISO    = () => new Date().toISOString();

const REFUND_STATUSES = new Set(["Requested", "Approved", "Rejected", "Processed"]);

function _round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

async function _nextRefundId() {
  const ref = db.collection("_counters").doc("financeRefunds");
  let n = 1;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    n = snap.exists ? (snap.data().count || 0) + 1 : 1;
    tx.set(ref, { count: n }, { merge: true });
  });
  return `FREF${String(n).padStart(6, "0")}`;
}

function docToRefund(snap) {
  const d  = snap.data ? snap.data() : snap;
  const id = snap.id   || d.refundId || "";
  return {
    refundId:    d.refundId    || id,
    paymentId:   d.paymentId   || "",
    familyId:    d.familyId    || "",
    studentId:   d.studentId   || "",
    amount:      Number(d.amount || 0),
    reason:      d.reason      || "",
    status:      REFUND_STATUSES.has(d.status) ? d.status : "Requested",
    requestedBy: d.requestedBy || "",
    approvedBy:  d.approvedBy  || "",
    schoolId:    d.schoolId    || SCHOOL_ID,
    centerId:    d.centerId    || "",
    createdAt:   d.createdAt   || "",
    updatedAt:   d.updatedAt   || "",
  };
}

async function getRefund(refundId, { schoolId = SCHOOL_ID } = {}) {
  const snap = await col().doc(refundId).get();
  if (!snap.exists) return null;
  const refund = docToRefund(snap);
  if (refund.schoolId !== schoolId) return null; // hide, don't reveal
  return refund;
}

/**
 * listForSchool — school-wide browse. Refund never had a list endpoint at
 * all (only get-by-id) — this is new, additive read surface for a staff-
 * facing Refunds screen (Requests / History tabs) and the Dashboard's
 * "Pending Refund Approvals" KPI. Single-field equality query on schoolId;
 * `status`/`familyId`/`studentId` filtered in-memory.
 */
async function listForSchool({ schoolId = SCHOOL_ID, status, familyId, studentId, limit = 200 } = {}) {
  const snap = await col().where("schoolId", "==", schoolId).get();
  let refunds = snap.docs.map(docToRefund);
  if (status)    refunds = refunds.filter(r => r.status === status);
  if (familyId)  refunds = refunds.filter(r => r.familyId === familyId);
  if (studentId) refunds = refunds.filter(r => r.studentId === studentId);
  refunds.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return refunds.slice(0, Number(limit) || 200);
}

/**
 * requestRefund — creates a Refund request against an already-Allocated
 * (or previously PartiallyRefunded) Payment. Auto-approves and
 * immediately processes when the amount is below
 * `financeSettings.refundApprovalThreshold` (0 = no threshold
 * configured, matching the exact "auto-apply below, require sign-off
 * above" semantics `discountApprovalThreshold` already uses for M3.3).
 */
async function requestRefund(paymentId, amount, { schoolId = SCHOOL_ID, centerId = "", actorUserId = "system", reason = "" } = {}) {
  if (!paymentId) { const e = new Error("paymentId is required."); e.code = "VALIDATION"; throw e; }
  const roundedAmount = _round2(amount);
  if (!isFinite(roundedAmount) || roundedAmount <= 0) {
    const e = new Error("amount must be a positive number."); e.code = "VALIDATION"; throw e;
  }

  const payment = await paymentSvc.getPayment(paymentId, { schoolId });
  if (!payment) { const e = new Error("Payment not found."); e.code = "NOT_FOUND"; throw e; }

  const refundableStatuses = new Set([stateMachine.STATES.ALLOCATED, stateMachine.STATES.PARTIALLY_REFUNDED]);
  if (!refundableStatuses.has(payment.status)) {
    const e = new Error(`Payment is ${payment.status} — cannot be refunded.`); e.code = "VALIDATION"; throw e;
  }

  const refundableRemaining = _round2(payment.amount - (payment.refundedAmount || 0));
  if (roundedAmount > refundableRemaining) {
    const e = new Error(`Refund amount exceeds the refundable remainder (${refundableRemaining}).`); e.code = "VALIDATION"; throw e;
  }

  const settings = await settingsSvc.getSettings(schoolId);
  const threshold = Number(settings.refundApprovalThreshold) || 0;
  const requiresApproval = threshold > 0 && roundedAmount >= threshold;

  const refundId = await _nextRefundId();
  const doc = {
    refundId, paymentId,
    familyId:  payment.familyId,
    studentId: payment.studentId,
    amount:    roundedAmount,
    reason,
    status:      requiresApproval ? "Requested" : "Approved",
    requestedBy: actorUserId,
    approvedBy:  requiresApproval ? "" : actorUserId,
    schoolId, centerId,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };
  await col().doc(refundId).set(doc);

  await auditSvc.logFinanceAudit({
    schoolId, actorUserId,
    action: "financeRefund.request", entityType: "refund", entityId: refundId,
    meta: { paymentId, amount: roundedAmount, requiresApproval },
  });

  if (!requiresApproval) {
    return _processRefund(doc, { schoolId, centerId, actorUserId });
  }
  return { refund: doc, processed: false };
}

/**
 * approveRefund — moves a `Requested` Refund to `Approved` and
 * immediately processes it. The caller's authority to approve is
 * enforced entirely at the route layer (a narrower permission than the
 * general `finance-foundation` key) — this function trusts
 * `actorUserId` only as an audit-trail attribution, never as an
 * authorization signal.
 */
async function approveRefund(refundId, { schoolId = SCHOOL_ID, centerId = "", actorUserId = "system" } = {}) {
  const refund = await getRefund(refundId, { schoolId });
  if (!refund) { const e = new Error("Refund not found."); e.code = "NOT_FOUND"; throw e; }
  if (refund.status !== "Requested") {
    const e = new Error(`Refund is ${refund.status} — only a Requested refund can be approved.`); e.code = "VALIDATION"; throw e;
  }

  const updated = { ...refund, status: "Approved", approvedBy: actorUserId, updatedAt: nowISO() };
  await col().doc(refundId).update({ status: "Approved", approvedBy: actorUserId, updatedAt: nowISO() });

  await auditSvc.logFinanceAudit({
    schoolId, actorUserId,
    action: "financeRefund.approve", entityType: "refund", entityId: refundId,
    meta: { paymentId: refund.paymentId, amount: refund.amount },
  });

  return _processRefund(updated, { schoolId, centerId, actorUserId });
}

async function rejectRefund(refundId, { schoolId = SCHOOL_ID, actorUserId = "system", reason = "" } = {}) {
  const refund = await getRefund(refundId, { schoolId });
  if (!refund) { const e = new Error("Refund not found."); e.code = "NOT_FOUND"; throw e; }
  if (refund.status !== "Requested") {
    const e = new Error(`Refund is ${refund.status} — only a Requested refund can be rejected.`); e.code = "VALIDATION"; throw e;
  }

  await col().doc(refundId).update({ status: "Rejected", updatedAt: nowISO() });

  await auditSvc.logFinanceAudit({
    schoolId, actorUserId,
    action: "financeRefund.reject", entityType: "refund", entityId: refundId,
    meta: { paymentId: refund.paymentId, amount: refund.amount, reason },
  });

  return { ...refund, status: "Rejected" };
}

async function _processRefund(refund, { schoolId, centerId, actorUserId }) {
  const { newBalance } = await ledgerEntrySvc.createEntry(refund.studentId, {
    type: "refund",
    amount: refund.amount,
    description: `Refund ${refund.refundId} for payment ${refund.paymentId}`,
    sourceType: "refund",
    sourceId: refund.refundId,
  }, { schoolId, centerId, actorUserId });

  await col().doc(refund.refundId).update({ status: "Processed", updatedAt: nowISO() });

  const payment = await paymentSvc.appendRefund(refund.paymentId, refund.amount, { schoolId });
  const newStatus = payment.refundedAmount >= payment.amount
    ? stateMachine.STATES.REFUNDED
    : stateMachine.STATES.PARTIALLY_REFUNDED;

  let finalPayment = payment;
  if (newStatus !== payment.status) {
    finalPayment = await paymentSvc.transitionStatus(refund.paymentId, newStatus, {
      schoolId, actorUserId, meta: { refundId: refund.refundId, amount: refund.amount },
    });
  }

  await auditSvc.logFinanceAudit({
    schoolId, actorUserId,
    action: "financeRefund.process", entityType: "refund", entityId: refund.refundId,
    meta: { paymentId: refund.paymentId, amount: refund.amount, newBalance, newStatus },
  });

  eventPublisher.publish(eventPublisher.EVENTS.REFUND_PROCESSED, {
    schoolId, centerId, refundId: refund.refundId, paymentId: refund.paymentId,
    familyId: refund.familyId, studentId: refund.studentId, amount: refund.amount, actorUserId,
  });

  return { refund: { ...refund, status: "Processed" }, payment: finalPayment, newBalance, processed: true };
}

/**
 * reversePayment — never edits or deletes the original Payment or its
 * Ledger Entries. Posts one offsetting `adjustment` Ledger Entry per
 * ledger this Payment had settled (undoing each `payment` entry's
 * effect), claws back any credit this Payment's overpayment had granted
 * (fails naturally, via `adjustCreditBalance`'s own existing guard, if
 * that credit has since been spent elsewhere — a known, accepted
 * limitation, not silently ignored), and transitions the Payment to
 * `Reversed`.
 */
async function reversePayment(paymentId, { schoolId = SCHOOL_ID, centerId = "", actorUserId = "system", reason = "" } = {}) {
  if (!paymentId) { const e = new Error("paymentId is required."); e.code = "VALIDATION"; throw e; }

  const payment = await paymentSvc.getPayment(paymentId, { schoolId });
  if (!payment) { const e = new Error("Payment not found."); e.code = "NOT_FOUND"; throw e; }

  // Validate early — matches the state machine's own transition map;
  // transitionStatus() re-validates this too, but failing fast here
  // avoids posting any offsetting Ledger Entries for a Payment that
  // can never actually reach Reversed (e.g. already Refunded).
  stateMachine.assertTransition(payment.status, stateMachine.STATES.REVERSED);

  for (const alloc of payment.allocations) {
    await ledgerEntrySvc.createEntry(alloc.studentLedgerId, {
      type: "adjustment",
      amount: alloc.amount,
      signedAmountOverride: alloc.amount, // undoes the earlier "payment" entry's negative effect
      description: `Reversal of payment ${paymentId}`,
      sourceType: "reversal",
      sourceId: paymentId,
    }, { schoolId, centerId, actorUserId });
  }

  if (payment.creditAppliedAmount > 0) {
    await familyAccountSvc.adjustCreditBalance(payment.familyId, -payment.creditAppliedAmount, {
      schoolId, actorUserId, reason: `Reversal of payment ${paymentId}`,
    });
  }

  const updated = await paymentSvc.transitionStatus(paymentId, stateMachine.STATES.REVERSED, {
    schoolId, actorUserId, meta: { reason },
  });

  await auditSvc.logFinanceAudit({
    schoolId, actorUserId,
    action: "financePayment.reverse", entityType: "payment", entityId: paymentId,
    meta: { reason, allocationsReversed: payment.allocations.length, creditClawedBack: payment.creditAppliedAmount },
  });

  eventPublisher.publish(eventPublisher.EVENTS.PAYMENT_REVERSED, {
    schoolId, centerId, paymentId, familyId: payment.familyId, reason, actorUserId,
  });

  return updated;
}

module.exports = { requestRefund, approveRefund, rejectRefund, getRefund, listForSchool, reversePayment, REFUND_STATUSES };
