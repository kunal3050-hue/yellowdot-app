/**
 * financeInvoiceService.js — Finance Foundation: Invoice (Sprint 3, M3.2)
 * ────────────────────────────────────────────────────────────────────
 * Extends the EXISTING `invoices` collection — the same one
 * services/invoiceService.js already reads/writes for the manual
 * Invoice/InvoiceView/PaymentDrawer flow — rather than creating a
 * parallel collection, per the Sprint 3 plan's explicit instruction to
 * "extend the existing invoice architecture rather than replacing it."
 * services/invoiceService.js itself is NOT imported or modified by this
 * file at all.
 *
 * Every document this service writes populates every legacy field
 * invoiceService.js's own docToInvoice() already expects (invoiceNumber,
 * studentId, amount, gst, discount, totalAmount, paidAmount, balance,
 * status, schoolId, centerId, ...), computed as the aggregate of this
 * invoice's lines — so the existing manual-flow screens could read a
 * Finance-Foundation-generated invoice exactly like any other, with zero
 * change to them. The new `lines` array is purely additive; old code
 * that doesn't know about it simply never looks at it.
 *
 * Doc IDs use a distinct `FINV######` prefix (vs. legacy `INV-<timestamp>`)
 * and invoiceNumbers use a distinct `BINV-YYYYMM-#####` prefix (vs. legacy
 * `INV-YYYYMM-#####`), both via this service's own atomic counters — zero
 * risk of ID/number collision with the legacy service, and the prefix
 * itself makes a Billing-Engine-generated invoice immediately
 * recognizable to anyone reading raw data.
 *
 * Does NOT post a Ledger Entry, activate a Billing Plan, or apply any
 * Rules Engine policy — that orchestration is M3.4's job (the actual
 * "Generate Invoice" operation), which calls createInvoice() as one step.
 */
const { db }         = require("../firebaseAdmin");
const auditSvc       = require("./financeAuditService");
const eventPublisher = require("./financeEventPublisher");

const SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";
const col       = () => db.collection("invoices");
const nowISO    = () => new Date().toISOString();

const STATUSES = new Set(["Paid", "Pending", "Partial", "Overdue", "Cancelled"]);

async function _nextInvoiceId() {
  const ref = db.collection("_counters").doc("financeInvoices");
  let n = 1;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    n = snap.exists ? (snap.data().count || 0) + 1 : 1;
    tx.set(ref, { count: n }, { merge: true });
  });
  return `FINV${String(n).padStart(6, "0")}`;
}

async function _nextInvoiceNumber(schoolId) {
  const d   = new Date();
  const ym  = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
  const key = `binv-${schoolId}-${ym}`;
  const ref = db.collection("_counters").doc(key);
  let seq = 1;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    seq = snap.exists ? (snap.data().seq || 0) + 1 : 1;
    tx.set(ref, { seq, schoolId, period: ym, updatedAt: nowISO() }, { merge: true });
  });
  return `BINV-${ym}-${String(seq).padStart(5, "0")}`;
}

function _validateLines(lines) {
  if (!Array.isArray(lines) || lines.length === 0) {
    const e = new Error("At least one invoice line is required."); e.code = "VALIDATION"; throw e;
  }
  for (const line of lines) {
    if (!line.feeComponentId) { const e = new Error("Each line requires feeComponentId."); e.code = "VALIDATION"; throw e; }
    const amt = Number(line.amount);
    if (!isFinite(amt) || amt < 0) { const e = new Error("Each line's amount must be a non-negative number."); e.code = "VALIDATION"; throw e; }
  }
}

function _normalizeLine(line) {
  const amount   = Number(line.amount)   || 0;
  const gst      = Number(line.gst)      || 0;
  const discount = Number(line.discount) || 0;
  return {
    feeComponentId: line.feeComponentId,
    label:          line.label || "",
    amount, gst, discount,
    total: amount + gst - discount,
  };
}

function docToFinanceInvoice(snap) {
  const d  = snap.data ? snap.data() : snap;
  const id = snap.id   || d.invoiceId || "";
  return {
    invoiceId:       d.invoiceId       || id,
    invoiceNumber:   d.invoiceNumber   || "",
    studentId:       d.studentId       || "",
    studentLedgerId: d.studentLedgerId || d.studentId || "",
    studentName:     d.studentName     || "",
    invoiceDate:     d.invoiceDate     || "",
    dueDate:         d.dueDate         || "",
    lines:           Array.isArray(d.lines) ? d.lines : [],
    amount:          Number(d.amount || 0),
    gst:             Number(d.gst || 0),
    discount:        Number(d.discount || 0),
    totalAmount:     Number(d.totalAmount || 0),
    paidAmount:      Number(d.paidAmount || 0),
    balance:         Number(d.balance || 0),
    status:          STATUSES.has(d.status) ? d.status : "Pending",
    source:          d.source          || "manual",
    billingPlanId:   d.billingPlanId   || "",
    schoolId:        d.schoolId        || SCHOOL_ID,
    centerId:        d.centerId        || "",
    notes:           d.notes           || "",
    createdAt:       d.createdAt       || "",
    updatedAt:       d.updatedAt       || "",
    createdBy:       d.createdBy       || "",
  };
}

/**
 * createInvoice — always itemized (>=1 line), always billing-plan-sourced
 * in this sprint (source defaults to "billingPlan"; nothing calls this
 * with source: "manual" yet — the existing manual flow still goes through
 * services/invoiceService.js entirely, untouched).
 */
async function createInvoice(data, { schoolId = SCHOOL_ID, centerId = "", actorUserId = "system" } = {}) {
  if (!data.studentId) { const e = new Error("studentId is required."); e.code = "VALIDATION"; throw e; }
  _validateLines(data.lines);

  const lines       = data.lines.map(_normalizeLine);
  const amount       = lines.reduce((s, l) => s + l.amount, 0);
  const gst          = lines.reduce((s, l) => s + l.gst, 0);
  const discount     = lines.reduce((s, l) => s + l.discount, 0);
  const totalAmount  = amount + gst - discount;

  const invoiceId     = await _nextInvoiceId();
  const invoiceNumber = await _nextInvoiceNumber(schoolId);

  const doc = {
    invoiceId, invoiceNumber,
    studentId:       data.studentId,
    studentLedgerId: data.studentLedgerId || data.studentId,
    studentName:     data.studentName || "",
    invoiceDate:     data.invoiceDate || nowISO().slice(0, 10),
    dueDate:         data.dueDate     || "",
    lines,
    amount, gst, discount, totalAmount,
    paidAmount: 0,
    balance:    totalAmount,
    status:     "Pending",
    source:        data.source        || "billingPlan",
    billingPlanId: data.billingPlanId || "",
    schoolId, centerId,
    notes:      data.notes || "",
    createdAt:  nowISO(),
    updatedAt:  nowISO(),
    createdBy:  actorUserId,
  };

  await col().doc(invoiceId).set(doc);

  await auditSvc.logFinanceAudit({
    schoolId, actorUserId,
    action: "financeInvoice.create", entityType: "invoice", entityId: invoiceId,
    meta: { studentId: data.studentId, totalAmount, lineCount: lines.length, billingPlanId: data.billingPlanId || "" },
  });

  eventPublisher.publish(eventPublisher.EVENTS.INVOICE_GENERATED, {
    schoolId, centerId, invoiceId, invoiceNumber,
    studentId: data.studentId, billingPlanId: data.billingPlanId || "",
    totalAmount, lineCount: lines.length, actorUserId,
  });

  return doc;
}

async function getInvoice(invoiceId, { schoolId = SCHOOL_ID } = {}) {
  const snap = await col().doc(invoiceId).get();
  if (!snap.exists) return null;
  const inv = docToFinanceInvoice(snap);
  if (inv.schoolId !== schoolId) return null; // hide, don't reveal
  return inv;
}

/** Only Finance-Foundation-generated invoices (source: "billingPlan") — the legacy
 * manual flow's own invoiceService.getAllInvoices()/getInvoice() remain the
 * general-purpose reader for every invoice regardless of source. */
async function listForStudent(studentId, { schoolId = SCHOOL_ID, limit = 100 } = {}) {
  const snap = await col()
    .where("schoolId",  "==", schoolId)
    .where("studentId", "==", studentId)
    .where("source",    "==", "billingPlan")
    .get();
  return snap.docs
    .map(docToFinanceInvoice)
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
    .slice(0, limit);
}

module.exports = { createInvoice, getInvoice, listForStudent, STATUSES };
