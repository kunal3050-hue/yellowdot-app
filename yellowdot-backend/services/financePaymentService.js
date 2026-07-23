/**
 * financePaymentService.js — Finance Foundation: Payment (Sprint 4, M4.1)
 * ────────────────────────────────────────────────────────────────────
 * Extends the EXISTING `payments` Firestore collection — the same one
 * `services/invoiceService.js` already reads and writes for the manual
 * PaymentDrawer/RecordPayment flow — rather than introducing a parallel
 * collection, following the exact pattern `financeInvoiceService.js`
 * proved for Invoices in Sprint 3, M3.2. `services/invoiceService.js`
 * itself is not imported or modified by this file at all.
 *
 * A Finance-Foundation-recorded Payment is family-scoped (`familyId`,
 * not just `studentId`/`invoiceNumber`) and multi-target
 * (`allocations: []`, populated by M4.2, empty here) — this is the
 * concrete change from today's model, where a payment is always tied to
 * exactly one invoice. Every document still carries `studentId` (best
 * effort, the primarily-affected child, optional) so existing per-student
 * payment-history reads that only look at that field are not broken by
 * this addition.
 *
 * Distinct `FPAY######` ID prefix (own atomic counter) guarantees zero
 * collision risk with the legacy service's own `PAY-<timestamp>`-style
 * IDs, mirroring the `FINV`/`BINV` precedent from M3.2.
 *
 * Receipt numbering (Sprint 4, M4.3): every new Payment is generated with
 * a sequential `FRCPT-YYYYMM-#####` receipt number, via this file's own
 * atomic, month-scoped counter (`_nextReceiptNumber`) — mirroring
 * `financeInvoiceService.js`'s own `BINV-YYYYMM-#####` counter rather
 * than importing `invoiceService.js`'s unexported `genReceiptNumber()`,
 * consistent with the "never import invoiceService.js" precedent from
 * M3.2. No separate PDF/document is generated — this is the receipt
 * *record* only; the platform's existing (separately-flagged) PDF
 * architecture gap remains its own tech-debt item, untouched here.
 *
 * Payment status is governed by `financePaymentStateMachine.js`
 * (Sprint 4 Review, Recommendation 2) — every Payment is created in
 * `Recorded`; every subsequent status change (by this service's own
 * `transitionStatus`, or by M4.2's Allocation Engine / M4.5's Refund &
 * Reversal Workflow) is validated against the explicit transition map
 * before being persisted, never assumed correct by the caller.
 */
const { db }         = require("../firebaseAdmin");
const auditSvc       = require("./financeAuditService");
const stateMachine   = require("./financePaymentStateMachine");
const eventPublisher = require("./financeEventPublisher");

const SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";
const col       = () => db.collection("payments");
const nowISO    = () => new Date().toISOString();

const PAYMENT_MODES = new Set(["Cash", "UPI", "Cheque", "BankTransfer", "Card", "Other"]);

async function _nextPaymentId() {
  const ref = db.collection("_counters").doc("financePayments");
  let n = 1;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    n = snap.exists ? (snap.data().count || 0) + 1 : 1;
    tx.set(ref, { count: n }, { merge: true });
  });
  return `FPAY${String(n).padStart(6, "0")}`;
}

/**
 * _nextReceiptNumber — Sprint 4, M4.3: its own atomic, month-scoped
 * counter (mirroring `financeInvoiceService._nextInvoiceNumber()`'s
 * `BINV-YYYYMM-#####` pattern) rather than importing `invoiceService.js`'s
 * unexported `genReceiptNumber()` — the "never import invoiceService.js"
 * precedent established in M3.2 takes priority over reusing that
 * specific function literally, per `02_DOMAIN_ARCHITECTURE.md`'s
 * original (pre-Sprint-3) note. Distinct `FRCPT-` prefix guarantees zero
 * collision with the legacy `RCPT-YYYYMM-####` sequence.
 */
async function _nextReceiptNumber(schoolId) {
  const d   = new Date();
  const ym  = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
  const key = `frcpt-${schoolId}-${ym}`;
  const ref = db.collection("_counters").doc(key);
  let seq = 1;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    seq = snap.exists ? (snap.data().seq || 0) + 1 : 1;
    tx.set(ref, { seq, schoolId, period: ym, updatedAt: nowISO() }, { merge: true });
  });
  return `FRCPT-${ym}-${String(seq).padStart(5, "0")}`;
}

function docToFinancePayment(snap) {
  const d  = snap.data ? snap.data() : snap;
  const id = snap.id   || d.paymentId || "";
  return {
    paymentId:     d.paymentId     || id,
    receiptNumber: d.receiptNumber || "",
    familyId:      d.familyId      || "",
    studentId:     d.studentId     || "",
    studentName:   d.studentName   || "",
    amount:        Number(d.amount || 0),
    paymentMode:   PAYMENT_MODES.has(d.paymentMode) ? d.paymentMode : "Cash",
    transactionId: d.transactionId || "",
    paymentDate:   d.paymentDate   || "",
    notes:         d.notes         || "",
    allocations:   Array.isArray(d.allocations) ? d.allocations : [],
    creditAppliedAmount: Number(d.creditAppliedAmount || 0),
    refundedAmount: Number(d.refundedAmount || 0),
    status:        d.status || stateMachine.STATES.RECORDED,
    source:        d.source || "financeFoundation",
    schoolId:      d.schoolId      || SCHOOL_ID,
    centerId:      d.centerId      || "",
    createdAt:     d.createdAt     || "",
    updatedAt:     d.updatedAt     || "",
    createdBy:     d.createdBy     || "",
  };
}

/**
 * recordPayment — the only way a Finance-Foundation Payment is created.
 * Immutable once created except via `transitionStatus` below (matching
 * the platform's existing `firestore.rules` comment on `payments`:
 * "generally immutable — only admins may correct").
 */
async function recordPayment(data, { schoolId = SCHOOL_ID, centerId = "", actorUserId = "system" } = {}) {
  if (!data.familyId) { const e = new Error("familyId is required."); e.code = "VALIDATION"; throw e; }

  const amount = Number(data.amount);
  if (!isFinite(amount) || amount <= 0) { const e = new Error("amount must be a positive number."); e.code = "VALIDATION"; throw e; }

  if (data.paymentMode && !PAYMENT_MODES.has(data.paymentMode)) {
    const e = new Error(`Invalid paymentMode "${data.paymentMode}".`); e.code = "VALIDATION"; throw e;
  }

  const paymentId     = await _nextPaymentId();
  const receiptNumber = await _nextReceiptNumber(schoolId);
  const doc = {
    paymentId,
    receiptNumber,
    familyId:     data.familyId,
    studentId:    data.studentId   || "",
    studentName:  data.studentName || "",
    amount,
    paymentMode:  data.paymentMode || "Cash",
    transactionId: data.transactionId || "",
    paymentDate:  data.paymentDate || nowISO().slice(0, 10),
    notes:        data.notes       || "",
    allocations:  [],
    creditAppliedAmount: 0,
    refundedAmount: 0,
    status:       stateMachine.STATES.RECORDED,
    source:       "financeFoundation",
    schoolId, centerId,
    createdAt:    nowISO(),
    updatedAt:    nowISO(),
    createdBy:    actorUserId,
  };

  await col().doc(paymentId).set(doc);

  await auditSvc.logFinanceAudit({
    schoolId, actorUserId,
    action: "financePayment.record", entityType: "payment", entityId: paymentId,
    meta: { familyId: data.familyId, amount, paymentMode: doc.paymentMode },
  });

  eventPublisher.publish(eventPublisher.EVENTS.PAYMENT_RECORDED, {
    schoolId, centerId, paymentId, familyId: data.familyId, amount, paymentMode: doc.paymentMode, actorUserId,
  });

  return doc;
}

async function getPayment(paymentId, { schoolId = SCHOOL_ID } = {}) {
  const snap = await col().doc(paymentId).get();
  if (!snap.exists) return null;
  const payment = docToFinancePayment(snap);
  if (payment.schoolId !== schoolId) return null; // hide, don't reveal
  return payment;
}

/** Only Finance-Foundation-recorded payments (source: "financeFoundation") —
 * the legacy manual flow's own invoiceService.getAllPayments() remains the
 * general-purpose reader for every payment regardless of source. */
async function listForFamily(familyId, { schoolId = SCHOOL_ID, limit = 100 } = {}) {
  const snap = await col()
    .where("schoolId", "==", schoolId)
    .where("familyId", "==", familyId)
    .where("source",   "==", "financeFoundation")
    .get();
  return snap.docs
    .map(docToFinancePayment)
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
    .slice(0, limit);
}

/**
 * listForSchool — school-wide browse, additive alongside listForFamily
 * (untouched). Needed for a staff-facing Payments list screen. Single-field
 * equality query on schoolId; `status` filtered in-memory.
 */
async function listForSchool({ schoolId = SCHOOL_ID, status, limit = 200 } = {}) {
  const snap = await col()
    .where("schoolId", "==", schoolId)
    .where("source",   "==", "financeFoundation")
    .get();
  let payments = snap.docs.map(docToFinancePayment);
  if (status) payments = payments.filter(p => p.status === status);
  payments.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return payments.slice(0, Number(limit) || 200);
}

/**
 * transitionStatus — the ONLY way a Payment's status ever changes after
 * creation. Not part of the "record a new payment" public surface on its
 * own, but exported since M4.2 (Allocation), M4.5 (Refund/Reversal), and
 * any future caller all need it. Validates the transition against
 * `financePaymentStateMachine` inside the same transaction that reads
 * the current status, so a concurrent transition can never race past an
 * invalid intermediate state.
 */
async function transitionStatus(paymentId, toStatus, { schoolId = SCHOOL_ID, actorUserId = "system", meta = {} } = {}) {
  const ref = col().doc(paymentId);
  let updatedData = null;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) { const e = new Error("Payment not found."); e.code = "VALIDATION"; throw e; }
    const payment = snap.data();
    if (payment.schoolId !== schoolId) { const e = new Error("Not found."); e.code = "NOT_FOUND"; throw e; }

    stateMachine.assertTransition(payment.status || stateMachine.STATES.RECORDED, toStatus);

    updatedData = { ...payment, status: toStatus, updatedAt: nowISO() };
    tx.update(ref, { status: toStatus, updatedAt: nowISO() });
  });

  await auditSvc.logFinanceAudit({
    schoolId, actorUserId,
    action: `financePayment.transition.${toStatus}`, entityType: "payment", entityId: paymentId,
    meta,
  });

  return docToFinancePayment(updatedData);
}

/**
 * appendAllocations — merges newly-resolved allocations (and any newly
 * credit-applied amount) into a Payment's running totals. Called by
 * `financePaymentAllocationService.js` (M4.2), which may call this more
 * than once for the same Payment (resuming a `PartiallyAllocated`
 * payment) — this always appends to the existing arrays/totals, never
 * replaces them, so a resumed allocation never loses a prior call's work.
 */
async function appendAllocations(paymentId, newAllocations, creditAppliedThisCall, { schoolId = SCHOOL_ID } = {}) {
  const ref = col().doc(paymentId);
  let updatedData = null;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) { const e = new Error("Payment not found."); e.code = "VALIDATION"; throw e; }
    const payment = snap.data();
    if (payment.schoolId !== schoolId) { const e = new Error("Not found."); e.code = "NOT_FOUND"; throw e; }

    const allocations = [...(Array.isArray(payment.allocations) ? payment.allocations : []), ...newAllocations];
    const creditAppliedAmount = Number(payment.creditAppliedAmount || 0) + Number(creditAppliedThisCall || 0);

    updatedData = { ...payment, allocations, creditAppliedAmount, updatedAt: nowISO() };
    tx.update(ref, { allocations, creditAppliedAmount, updatedAt: nowISO() });
  });

  return docToFinancePayment(updatedData);
}

/**
 * appendRefund — adds to a Payment's running `refundedAmount`. Called by
 * `financeRefundReversalService.js` (M4.5) after a Refund has actually
 * been processed (Ledger Entry posted) — never before, so a Payment's
 * `refundedAmount` always reflects money that has genuinely moved.
 */
async function appendRefund(paymentId, refundAmountThisCall, { schoolId = SCHOOL_ID } = {}) {
  const ref = col().doc(paymentId);
  let updatedData = null;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) { const e = new Error("Payment not found."); e.code = "VALIDATION"; throw e; }
    const payment = snap.data();
    if (payment.schoolId !== schoolId) { const e = new Error("Not found."); e.code = "NOT_FOUND"; throw e; }

    const refundedAmount = Number(payment.refundedAmount || 0) + Number(refundAmountThisCall || 0);

    updatedData = { ...payment, refundedAmount, updatedAt: nowISO() };
    tx.update(ref, { refundedAmount, updatedAt: nowISO() });
  });

  return docToFinancePayment(updatedData);
}

module.exports = { recordPayment, getPayment, listForFamily, listForSchool, transitionStatus, appendAllocations, appendRefund, PAYMENT_MODES };
