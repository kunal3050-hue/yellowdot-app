/**
 * billingService.js — Billing & Payments · core data service
 * ─────────────────────────────────────────────────────────────────────────────
 * Collections:
 *   feePlans/{planId}        — the catalogue: what a class of child is charged
 *   feeInvoices/{invoiceId}  — one itemised bill for one child, one period
 *   feePayments/{paymentId}  — money received, always against one invoice
 *   feeAuditLog/{entryId}    — every mutation (see billingAuditService.js)
 *   settings/billing         — UPI payee and receipt details (existing collection)
 *   counters/{key}           — invoice and receipt sequences (existing collection)
 *
 * ── What this carries over from the two deleted implementations ───────────────
 * `29d19f9` deleted an eleven-collection finance module; `f1796e9` replaced it
 * with a three-collection one; `710dfaf` deleted that too, for scope rather
 * than for quality. Four things from those passes were right and are kept:
 *
 *   1. Atomic settlement. recordPayment() writes the payment AND settles its
 *      invoice in ONE Firestore transaction. The eleven-collection module had
 *      no code path anywhere that marked an invoice paid, so a settled invoice
 *      read Pending forever and the parent app showed families owing money they
 *      had already paid. Here the writes either all land or none does, so that
 *      state is unreachable rather than merely fixed. reversePayment() is the
 *      exact mirror, for the same reason.
 *   2. Derived status. An invoice's status is recomputed from its own numbers
 *      on every write and never stored independently of them, so it cannot
 *      drift from paidAmount.
 *   3. Idempotent generation, on (studentId, period). Re-running by cron, by
 *      retry or by a staff member clicking twice skips children already
 *      invoiced for that period instead of double-billing them.
 *   4. Local-time dates. See billingMoney.js for why toISOString() is wrong.
 *
 * ── What is deliberately different ────────────────────────────────────────────
 *   - **New collection names.** `710dfaf` orphaned the old collections rather
 *     than deleting them, so `invoices`, `payments`, `feeTemplates` and
 *     `financeAuditLogs` still hold live documents in the old flat,
 *     single-amount shape with a different status vocabulary. Reading those
 *     back under this model would mean stale totals and invoices with no lines.
 *     `feePlans` / `feeInvoices` / `feePayments` / `feeAuditLog` start empty, so
 *     no migration is needed and no legacy document can be misread as a new one.
 *   - **Itemised invoices.** Lines, not one flat amount. The PRD calls billing
 *     one child on several concurrent rhythms — tuition, daycare, transport —
 *     on a single coherent bill the product's whole wedge, and both deleted
 *     implementations stored a single amount per invoice. Adding lines later
 *     would mean migrating live invoices; adding them now costs an array.
 *   - **A tenant check on every lookup by id.** The audit's one confirmed
 *     vulnerability was PUT/DELETE /api/fee-templates/:templateId reading
 *     `tplCol().doc(templateId)` with no schoolId comparison, against a
 *     guessable `TPL-${Date.now()}` id. `f1796e9` carried that same bug forward
 *     in its updateTemplate/deleteTemplate. Every by-id function here goes
 *     through _requireOwned(), which 404s rather than 403s so it never confirms
 *     that another school's record exists.
 *   - **School-scoped counters.** `f1796e9` keyed its sequences `invoices-YYYYMM`
 *     with no schoolId, so two schools shared one run of invoice numbers.
 *   - **An audit row for every mutation**, staged inside the same transaction as
 *     the money it describes.
 *   - **Nothing is hard-deleted.** An invoice is voided with a reason, a payment
 *     is reversed with a reason, a plan is deactivated. Money that was wrong
 *     stays visible next to its correction.
 */

const { db } = require("../firebaseAdmin");
const audit  = require("./billingAuditService");
const M      = require("./billingMoney");

const {
  money, sumMoney, addMoney, subtractMoney,
  today, periodOf, periodEnd, isPeriod, isISODate,
  statusFor, agingBucket, collectionRate,
} = M;

const SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";

const planCol = () => db.collection("feePlans");
const invCol  = () => db.collection("feeInvoices");
const payCol  = () => db.collection("feePayments");
const cntCol  = () => db.collection("counters");

const nowISO = () => new Date().toISOString();

// ── Vocabulary ───────────────────────────────────────────────────────────────

/** What a plan can charge for. Free-form fee types fragmented reporting before. */
const FEE_TYPES = Object.freeze([
  "tuition", "admission", "daycare", "transport", "activity", "meals", "other",
]);

/** How often a plan bills. Only `monthly` is picked up by generateForPeriod. */
const CADENCES = Object.freeze(["monthly", "termly", "one_time"]);

/**
 * How money arrived. An enum, not a string: the pre-deletion module defaulted
 * `paymentMode` to a free-form "Cash", so "cash" / "Cash" / "CASH" could all
 * exist at once and split every report three ways.
 */
const PAYMENT_MODES = Object.freeze([
  "cash", "upi", "card", "bank_transfer", "cheque", "other",
]);

const MAX_LINES      = 20;
const MAX_GENERATION = 500;

class BillingError extends Error {
  constructor(message, { status = 400, code = "BILLING_INVALID" } = {}) {
    super(message);
    this.name   = "BillingError";
    this.status = status;
    this.code   = code;
  }
}

const invalid  = (msg, code = "BILLING_INVALID") => new BillingError(msg, { status: 400, code });
const notFound = (msg = "Not found.")            => new BillingError(msg, { status: 404, code: "BILLING_NOT_FOUND" });

// ── Shaping ──────────────────────────────────────────────────────────────────

function toPlan(snap) {
  const d  = snap.data ? snap.data() : snap;
  const id = snap.id || d.planId || "";
  return {
    planId:        id,
    name:          d.name          || "",
    feeType:       d.feeType       || "other",
    amount:        money(d.amount),
    cadence:       d.cadence       || "monthly",
    classes:       Array.isArray(d.classes) ? d.classes : [],
    effectiveFrom: d.effectiveFrom || "",
    effectiveTo:   d.effectiveTo   || "",
    active:        d.active !== false,
    notes:         d.notes         || "",
    schoolId:      d.schoolId      || "",
    centerId:      d.centerId      || "",
    createdAt:     d.createdAt     || "",
    updatedAt:     d.updatedAt     || "",
    createdBy:     d.createdBy     || "",
    updatedBy:     d.updatedBy     || "",
  };
}

/**
 * An invoice's money is three layers, each kept on the document so a reader
 * never has to recompute anything to understand the row:
 *   lines[]          what was charged
 *   adjustments[]    credit notes, always negative
 *   totalAmount      sum of both — what is actually owed
 */
function toInvoice(snap) {
  const d  = snap.data ? snap.data() : snap;
  const id = snap.id || d.invoiceId || "";
  return {
    invoiceId:     id,
    invoiceNumber: d.invoiceNumber || "",
    studentId:     d.studentId     || "",
    studentName:   d.studentName   || "",
    familyId:      d.familyId      || "",
    class:         d.class         || "",
    period:        d.period        || "",
    invoiceDate:   d.invoiceDate   || "",
    dueDate:       d.dueDate       || "",
    lines: (Array.isArray(d.lines) ? d.lines : []).map(l => ({
      lineId:  l.lineId  || "",
      planId:  l.planId  || "",
      label:   l.label   || "",
      feeType: l.feeType || "other",
      amount:  money(l.amount),
    })),
    adjustments: (Array.isArray(d.adjustments) ? d.adjustments : []).map(a => ({
      adjustmentId: a.adjustmentId || "",
      amount:       money(a.amount),
      reason:       a.reason       || "",
      createdAt:    a.createdAt    || "",
      createdBy:    a.createdBy    || "",
    })),
    subtotal:        money(d.subtotal),
    adjustmentTotal: money(d.adjustmentTotal),
    totalAmount:     money(d.totalAmount),
    paidAmount:      money(d.paidAmount),
    balance:         money(d.balance),
    status:          d.status      || "Pending",
    voided:          d.voided === true,
    voidReason:      d.voidReason  || "",
    voidedBy:        d.voidedBy    || "",
    voidedAt:        d.voidedAt    || "",
    notes:           d.notes       || "",
    generatedBy:     d.generatedBy || "manual",
    schoolId:        d.schoolId    || "",
    centerId:        d.centerId    || "",
    createdAt:       d.createdAt   || "",
    updatedAt:       d.updatedAt   || "",
    createdBy:       d.createdBy   || "",
  };
}

function toPayment(snap) {
  const d  = snap.data ? snap.data() : snap;
  const id = snap.id || d.paymentId || "";
  return {
    paymentId:      id,
    receiptNumber:  d.receiptNumber  || "",
    invoiceId:      d.invoiceId      || "",
    invoiceNumber:  d.invoiceNumber  || "",
    studentId:      d.studentId      || "",
    studentName:    d.studentName    || "",
    familyId:       d.familyId       || "",
    amount:         money(d.amount),
    paymentMode:    d.paymentMode    || "cash",
    reference:      d.reference      || "",
    paymentDate:    d.paymentDate    || "",
    receivedBy:     d.receivedBy     || "",
    notes:          d.notes          || "",
    reversed:       d.reversed === true,
    reversalReason: d.reversalReason || "",
    reversedBy:     d.reversedBy     || "",
    reversedAt:     d.reversedAt     || "",
    schoolId:       d.schoolId       || "",
    centerId:       d.centerId       || "",
    createdAt:      d.createdAt      || "",
    createdBy:      d.createdBy      || "",
  };
}

// ── Guards ───────────────────────────────────────────────────────────────────

/**
 * Fetch one document and refuse it unless it belongs to the caller's school.
 * Returns 404 rather than 403 on a cross-tenant id, so the response never
 * confirms that another school's record exists — the pattern the audit
 * credited `checkInvoiceOwnership` for, applied to every lookup instead of one.
 */
async function _requireOwned(col, id, schoolId, label) {
  if (!id) throw invalid(`${label} id is required.`);
  const snap = await col().doc(String(id)).get();
  if (!snap.exists) throw notFound(`${label} not found.`);
  if (snap.data().schoolId !== schoolId) throw notFound(`${label} not found.`);
  return snap;
}

/**
 * Allocate the next number in a school-scoped, period-scoped sequence.
 * Reads through the caller's transaction, so a receipt number is never burned
 * by a payment that then fails to commit.
 */
async function _nextSeq(tx, key, width = 4) {
  const ref  = cntCol().doc(key);
  const snap = await tx.get(ref);
  const next = (snap.exists ? Number(snap.data().seq) || 0 : 0) + 1;
  return { ref, next, padded: String(next).padStart(width, "0") };
}

// ── Fee plans ────────────────────────────────────────────────────────────────

async function listPlans({ schoolId = SCHOOL_ID, activeOnly = false, classId, feeType } = {}) {
  const snap = await planCol().where("schoolId", "==", schoolId).get();
  let list = snap.docs.map(toPlan);
  if (activeOnly) list = list.filter(p => p.active);
  if (classId)    list = list.filter(p => p.classes.length === 0 || p.classes.includes(classId));
  if (feeType)    list = list.filter(p => p.feeType === feeType);
  return list.sort((a, b) => a.name.localeCompare(b.name));
}

async function getPlan(planId, { schoolId = SCHOOL_ID } = {}) {
  return toPlan(await _requireOwned(planCol, planId, schoolId, "Fee plan"));
}

function _validatePlanInput(data, { partial = false } = {}) {
  const out = {};

  if (!partial || data.name !== undefined) {
    const name = String(data.name || "").trim();
    if (!name) throw invalid("A fee plan needs a name.");
    if (name.length > 80) throw invalid("A fee plan name cannot exceed 80 characters.");
    out.name = name;
  }

  if (!partial || data.amount !== undefined) {
    const amount = money(data.amount);
    if (amount <= 0) throw invalid("A fee plan amount must be greater than zero.");
    out.amount = amount;
  }

  if (!partial || data.feeType !== undefined) {
    const feeType = String(data.feeType || "other").trim();
    if (!FEE_TYPES.includes(feeType)) {
      throw invalid(`"${feeType}" is not a fee type. Use one of: ${FEE_TYPES.join(", ")}.`);
    }
    out.feeType = feeType;
  }

  if (!partial || data.cadence !== undefined) {
    const cadence = String(data.cadence || "monthly").trim();
    if (!CADENCES.includes(cadence)) {
      throw invalid(`"${cadence}" is not a billing cadence. Use one of: ${CADENCES.join(", ")}.`);
    }
    out.cadence = cadence;
  }

  if (data.classes !== undefined) {
    if (!Array.isArray(data.classes)) throw invalid("classes must be an array of class names.");
    out.classes = data.classes.map(c => String(c).trim()).filter(Boolean);
  }

  for (const field of ["effectiveFrom", "effectiveTo"]) {
    if (data[field] !== undefined) {
      const v = String(data[field] || "").trim();
      if (v && !isISODate(v)) throw invalid(`${field} must be a YYYY-MM-DD date.`);
      out[field] = v;
    }
  }
  if (out.effectiveFrom && out.effectiveTo && out.effectiveTo < out.effectiveFrom) {
    throw invalid("effectiveTo cannot be before effectiveFrom.");
  }

  if (data.notes  !== undefined) out.notes  = String(data.notes || "").slice(0, 500);
  if (data.active !== undefined) out.active = Boolean(data.active);

  return out;
}

async function createPlan(data = {}, ctx = {}) {
  const { schoolId = SCHOOL_ID, centerId = "", actorUserId = "system" } = ctx;
  const fields = _validatePlanInput(data);

  const ref = planCol().doc();
  const doc = {
    planId:        ref.id,
    name:          fields.name,
    feeType:       fields.feeType,
    amount:        fields.amount,
    cadence:       fields.cadence,
    classes:       fields.classes       || [],
    effectiveFrom: fields.effectiveFrom || "",
    effectiveTo:   fields.effectiveTo   || "",
    active:        fields.active !== false,
    notes:         fields.notes || "",
    schoolId, centerId,
    createdAt: nowISO(),
    updatedAt: nowISO(),
    createdBy: actorUserId,
    updatedBy: actorUserId,
  };

  await ref.set(doc);
  await audit.log({
    schoolId, centerId, actorUserId,
    action: audit.ACTIONS.PLAN_CREATE,
    entityType: "feePlan", entityId: ref.id,
    amount: doc.amount,
    after: { name: doc.name, feeType: doc.feeType, amount: doc.amount, cadence: doc.cadence },
  });

  return toPlan(doc);
}

/**
 * Edit a plan. The schoolId check here is the audit's one confirmed
 * vulnerability, fixed: the old updateTemplate took the document straight off a
 * guessable id and never compared tenants.
 *
 * Changing an amount does NOT touch invoices already raised from this plan. An
 * invoice is a historical document; a fee revision applies to the next billing
 * run, which is also why a plan carries effective dates.
 */
async function updatePlan(planId, data = {}, ctx = {}) {
  const { schoolId = SCHOOL_ID, centerId = "", actorUserId = "system" } = ctx;
  const snap   = await _requireOwned(planCol, planId, schoolId, "Fee plan");
  const before = toPlan(snap);
  const fields = _validatePlanInput(data, { partial: true });

  if (Object.keys(fields).length === 0) return before;

  const updates = { ...fields, updatedAt: nowISO(), updatedBy: actorUserId };
  await planCol().doc(snap.id).update(updates);

  const after = toPlan({ ...snap.data(), ...updates, planId: snap.id });
  await audit.log({
    schoolId, centerId, actorUserId,
    action: audit.ACTIONS.PLAN_UPDATE,
    entityType: "feePlan", entityId: snap.id,
    amount: after.amount,
    before: { name: before.name, amount: before.amount, cadence: before.cadence, active: before.active },
    after:  { name: after.name,  amount: after.amount,  cadence: after.cadence,  active: after.active  },
  });

  return after;
}

/**
 * Deactivate a plan. There is no hard delete: invoice lines carry the planId
 * they were raised from, and deleting the plan would orphan that reference on
 * documents a parent may print years later. A deactivated plan stops being
 * picked up by generation and stops being offered in the UI.
 */
async function deactivatePlan(planId, ctx = {}) {
  const { schoolId = SCHOOL_ID, centerId = "", actorUserId = "system" } = ctx;
  const snap   = await _requireOwned(planCol, planId, schoolId, "Fee plan");
  const before = toPlan(snap);

  if (!before.active) return before;

  const updates = { active: false, updatedAt: nowISO(), updatedBy: actorUserId };
  await planCol().doc(snap.id).update(updates);

  await audit.log({
    schoolId, centerId, actorUserId,
    action: audit.ACTIONS.PLAN_DEACTIVATE,
    entityType: "feePlan", entityId: snap.id,
    amount: before.amount,
    before: { active: true }, after: { active: false },
  });

  return toPlan({ ...snap.data(), ...updates, planId: snap.id });
}

// ── Invoice line normalisation ───────────────────────────────────────────────

/**
 * Turn whatever the caller sent into validated lines.
 *
 * A line may name a planId, in which case its label, feeType and amount
 * default from that plan — but an explicit amount always wins, because a
 * prorated first month is a real case and should not require inventing a
 * one-off plan for one child.
 */
async function _normaliseLines(rawLines, { schoolId, plans = null }) {
  if (!Array.isArray(rawLines) || rawLines.length === 0) {
    throw invalid("An invoice needs at least one line.");
  }
  if (rawLines.length > MAX_LINES) {
    throw invalid(`An invoice cannot carry more than ${MAX_LINES} lines.`);
  }

  const planList = plans || await listPlans({ schoolId });
  const planById = new Map(planList.map(p => [p.planId, p]));

  return rawLines.map((raw, i) => {
    const planId = String(raw.planId || "").trim();
    const plan   = planId ? planById.get(planId) : null;

    if (planId && !plan) throw invalid(`Line ${i + 1} names a fee plan that does not exist.`);

    const label = String(raw.label || plan?.name || "").trim();
    if (!label) throw invalid(`Line ${i + 1} needs a label.`);
    if (label.length > 80) throw invalid(`Line ${i + 1}'s label cannot exceed 80 characters.`);

    const feeType = String(raw.feeType || plan?.feeType || "other").trim();
    if (!FEE_TYPES.includes(feeType)) {
      throw invalid(`Line ${i + 1} has fee type "${feeType}", which is not one of: ${FEE_TYPES.join(", ")}.`);
    }

    const hasOwnAmount = raw.amount !== undefined && raw.amount !== null && raw.amount !== "";
    const amount = money(hasOwnAmount ? raw.amount : plan?.amount);
    if (amount <= 0) throw invalid(`Line ${i + 1} needs an amount greater than zero.`);

    return { lineId: `L${i + 1}`, planId, label, feeType, amount };
  });
}

/** Recompute the three money layers and the status from lines + adjustments. */
function _recompute({ lines, adjustments, paidAmount, dueDate, voided }) {
  const subtotal        = sumMoney(lines, "amount");
  const adjustmentTotal = sumMoney(adjustments || [], "amount");
  const totalAmount     = addMoney(subtotal, adjustmentTotal);
  const paid            = money(paidAmount);
  return {
    subtotal,
    adjustmentTotal,
    totalAmount,
    paidAmount: paid,
    balance:    subtractMoney(totalAmount, paid),
    status:     statusFor({ totalAmount, paidAmount: paid, dueDate, voided }),
  };
}

// ── Invoices ─────────────────────────────────────────────────────────────────

/**
 * One equality filter plus in-memory narrowing, so no composite index is
 * needed. Every list function in this module works the same way, and every
 * read is scoped to schoolId before anything else happens.
 */
async function listInvoices({
  schoolId = SCHOOL_ID, studentId, familyId, status, period, from, to, includeVoid = true,
} = {}) {
  const snap = await invCol().where("schoolId", "==", schoolId).get();
  let list = snap.docs.map(toInvoice);

  if (studentId)    list = list.filter(i => i.studentId === studentId);
  if (familyId)     list = list.filter(i => i.familyId  === familyId);
  if (status)       list = list.filter(i => i.status    === status);
  if (period)       list = list.filter(i => i.period    === period);
  if (from)         list = list.filter(i => (i.invoiceDate || "") >= from);
  if (to)           list = list.filter(i => (i.invoiceDate || "") <= to);
  if (!includeVoid) list = list.filter(i => !i.voided);

  return list.sort((a, b) =>
    (b.invoiceDate || "").localeCompare(a.invoiceDate || "") ||
    (b.invoiceNumber || "").localeCompare(a.invoiceNumber || ""));
}

async function getInvoice(invoiceId, { schoolId = SCHOOL_ID } = {}) {
  return toInvoice(await _requireOwned(invCol, invoiceId, schoolId, "Invoice"));
}

/** An invoice with its payments attached — what the detail screen needs. */
async function getInvoiceWithPayments(invoiceId, { schoolId = SCHOOL_ID } = {}) {
  const invoice  = await getInvoice(invoiceId, { schoolId });
  const payments = await listPayments({ schoolId, invoiceId: invoice.invoiceId });
  return { invoice, payments };
}

/** Look a student up, and refuse one from another school. */
async function _loadStudent(studentId, schoolId) {
  const id = String(studentId || "").trim();
  if (!id) throw invalid("studentId is required.");

  const snap = await db.collection("students").doc(id).get();
  if (!snap.exists) throw notFound("Student not found.");
  const d = snap.data();
  if (d.schoolId !== schoolId) throw notFound("Student not found.");

  return {
    studentId:   d.studentId || snap.id,
    studentName: d.studentName || d.Student_Name || "",
    familyId:    d.familyId || "",
    class:       d.class || d.Class || "",
    centerId:    d.centerId || "",
    status:      d.status || "Active",
  };
}

/**
 * Build one invoice document. Shared by createInvoice and generateForPeriod so
 * a generated invoice and a hand-raised one are the same shape and draw from
 * the same numbering sequence.
 *
 * The sequence read and all three writes happen in one transaction, so two
 * concurrent raises cannot take the same invoice number and a failed raise
 * cannot leave a gap in the run.
 */
async function _buildInvoice({ lines, student, period, invoiceDate, dueDate, notes, generatedBy }, ctx) {
  const { schoolId, centerId, actorUserId } = ctx;
  const ym     = period.replace("-", "");
  const ref    = invCol().doc();
  const seqKey = `fee-invoice-${schoolId}-${ym}`;

  const doc = await db.runTransaction(async (tx) => {
    const seq = await _nextSeq(tx, seqKey, 4);

    const computed = _recompute({ lines, adjustments: [], paidAmount: 0, dueDate, voided: false });

    const invoice = {
      invoiceId:     ref.id,
      invoiceNumber: `INV-${ym}-${seq.padded}`,
      studentId:     student.studentId,
      studentName:   student.studentName || "",
      familyId:      student.familyId    || "",
      class:         student.class       || "",
      period,
      invoiceDate,
      dueDate,
      lines,
      adjustments: [],
      ...computed,
      voided:      false,
      voidReason:  "",
      voidedBy:    "",
      voidedAt:    "",
      notes:       String(notes || "").slice(0, 500),
      generatedBy,
      schoolId,
      centerId:    student.centerId || centerId || "",
      createdAt:   nowISO(),
      updatedAt:   nowISO(),
      createdBy:   actorUserId,
    };

    tx.set(seq.ref, { seq: seq.next, schoolId, period: ym, updatedAt: nowISO() }, { merge: true });
    tx.set(ref, invoice);
    audit.logInTransaction(tx, {
      schoolId, centerId: invoice.centerId, actorUserId,
      action: generatedBy === "plan" ? audit.ACTIONS.INVOICE_GENERATE : audit.ACTIONS.INVOICE_CREATE,
      entityType: "feeInvoice", entityId: ref.id,
      amount: invoice.totalAmount,
      after: {
        invoiceNumber: invoice.invoiceNumber, studentId: invoice.studentId,
        period, totalAmount: invoice.totalAmount, status: invoice.status,
        lines: invoice.lines.map(l => ({ label: l.label, amount: l.amount })),
      },
    });

    return invoice;
  });

  return toInvoice(doc);
}

async function createInvoice(data = {}, ctx = {}) {
  const { schoolId = SCHOOL_ID, centerId = "", actorUserId = "system" } = ctx;

  const student = await _loadStudent(data.studentId, schoolId);
  const lines   = await _normaliseLines(data.lines, { schoolId });

  const period = String(data.period || periodOf()).trim();
  if (!isPeriod(period)) throw invalid("period must be a YYYY-MM month.");

  const invoiceDate = String(data.invoiceDate || today()).trim();
  if (!isISODate(invoiceDate)) throw invalid("invoiceDate must be a YYYY-MM-DD date.");

  const dueDate = String(data.dueDate || periodEnd(period)).trim();
  if (!isISODate(dueDate)) throw invalid("dueDate must be a YYYY-MM-DD date.");
  if (dueDate < invoiceDate) throw invalid("dueDate cannot be before invoiceDate.");

  return _buildInvoice({
    lines, student, period, invoiceDate, dueDate,
    notes: data.notes, generatedBy: "manual",
  }, { schoolId, centerId, actorUserId });
}

/**
 * Raise this period's invoices for every active child whose class matches at
 * least one active monthly plan. Every matching plan becomes a LINE on one
 * invoice, which is the whole point of itemisation: a child on tuition plus
 * daycare plus transport gets one bill with three lines, not three bills.
 *
 * Idempotent on (studentId, period). A child who already holds a non-void
 * invoice for the period is skipped, so re-running never double-bills.
 *
 * The UI always runs this as a dry run first: the caller sees the count, the
 * total, who is skipped and who matched no plan, before anything is written.
 */
async function generateForPeriod({
  schoolId = SCHOOL_ID, centerId = "", actorUserId = "system",
  period = periodOf(), dueDate, dryRun = false,
} = {}) {
  if (!isPeriod(period)) throw invalid("period must be a YYYY-MM month.");

  const due = String(dueDate || periodEnd(period)).trim();
  if (!isISODate(due)) throw invalid("dueDate must be a YYYY-MM-DD date.");

  const [plans, stuSnap, existing] = await Promise.all([
    listPlans({ schoolId, activeOnly: true }),
    db.collection("students").where("schoolId", "==", schoolId).get(),
    listInvoices({ schoolId, period }),
  ]);

  const monthlyPlans = plans.filter(p => p.cadence === "monthly");
  // A void invoice does not count as already billed — voiding one is how a
  // staff member asks for that child's invoice to be raised again.
  const alreadyBilled = new Set(existing.filter(i => !i.voided).map(i => i.studentId));

  const planApplies = (plan, cls) => {
    if (plan.classes.length > 0 && !plan.classes.includes(cls)) return false;
    if (plan.effectiveFrom && due < plan.effectiveFrom) return false;
    if (plan.effectiveTo   && due > plan.effectiveTo)   return false;
    return true;
  };

  const planned = [], skipped = [], unmatched = [];

  for (const doc of stuSnap.docs) {
    const d         = doc.data();
    const studentId = d.studentId || doc.id;
    const name      = d.studentName || d.Student_Name || "";
    const cls       = d.class || d.Class || "";

    if (String(d.status || "Active").toLowerCase() !== "active") {
      skipped.push({ studentId, studentName: name, reason: "inactive" });
      continue;
    }
    if (alreadyBilled.has(studentId)) {
      skipped.push({ studentId, studentName: name, reason: "already_invoiced" });
      continue;
    }

    const matching = monthlyPlans.filter(p => planApplies(p, cls));
    if (matching.length === 0) {
      unmatched.push({ studentId, studentName: name, class: cls });
      continue;
    }

    planned.push({
      student: {
        studentId, studentName: name, familyId: d.familyId || "",
        class: cls, centerId: d.centerId || "",
      },
      lines: matching.map((p, i) => ({
        lineId: `L${i + 1}`, planId: p.planId, label: p.name,
        feeType: p.feeType, amount: p.amount,
      })),
    });
  }

  if (planned.length > MAX_GENERATION) {
    throw invalid(
      `This run would raise ${planned.length} invoices, over the ${MAX_GENERATION} limit. ` +
      "Narrow the period or raise them in batches.",
    );
  }

  const summary = {
    period, dueDate: due, dryRun,
    plannedCount:   planned.length,
    skippedCount:   skipped.length,
    unmatchedCount: unmatched.length,
    totalAmount:    sumMoney(planned.map(p => sumMoney(p.lines, "amount"))),
    skipped, unmatched,
  };

  if (dryRun) {
    return {
      ...summary,
      planned: planned.map(p => ({
        studentId:   p.student.studentId,
        studentName: p.student.studentName,
        class:       p.student.class,
        lines:       p.lines.map(l => ({ label: l.label, amount: l.amount })),
        amount:      sumMoney(p.lines, "amount"),
      })),
      createdCount: 0,
      created: [],
    };
  }

  const created = [];
  for (const item of planned) {
    const invoice = await _buildInvoice({
      lines: item.lines, student: item.student, period,
      invoiceDate: today(), dueDate: due, notes: "", generatedBy: "plan",
    }, { schoolId, centerId, actorUserId });

    created.push({
      invoiceId:     invoice.invoiceId,
      invoiceNumber: invoice.invoiceNumber,
      studentId:     invoice.studentId,
      studentName:   invoice.studentName,
      totalAmount:   invoice.totalAmount,
    });
  }

  return { ...summary, planned: [], createdCount: created.length, created };
}

/**
 * Void an invoice, with a mandatory reason. Not a delete: the row stays in the
 * register showing what was raised, why it was withdrawn and by whom, which is
 * what makes a billing mistake auditable instead of invisible.
 *
 * Refused while a live payment sits against it — reverse the payment first.
 * Voiding over a payment would strand money a parent holds a receipt for.
 */
async function voidInvoice(invoiceId, reason, ctx = {}) {
  const { schoolId = SCHOOL_ID, centerId = "", actorUserId = "system" } = ctx;

  const trimmed = String(reason || "").trim();
  if (!trimmed) throw invalid("Voiding an invoice needs a reason.");
  if (trimmed.length > 300) throw invalid("A void reason cannot exceed 300 characters.");

  const snap   = await _requireOwned(invCol, invoiceId, schoolId, "Invoice");
  const before = toInvoice(snap);

  if (before.voided) throw invalid("This invoice is already void.");

  const live = (await listPayments({ schoolId, invoiceId: before.invoiceId }))
    .filter(p => !p.reversed);
  if (live.length > 0) {
    throw invalid(
      `This invoice has ${live.length} payment${live.length === 1 ? "" : "s"} against it ` +
      `totalling ${before.paidAmount}. Reverse ${live.length === 1 ? "it" : "them"} before voiding.`,
    );
  }

  const updates = {
    voided:     true,
    voidReason: trimmed,
    voidedBy:   actorUserId,
    voidedAt:   nowISO(),
    status:     "Void",
    balance:    0,
    updatedAt:  nowISO(),
  };

  await db.runTransaction(async (tx) => {
    tx.update(invCol().doc(snap.id), updates);
    audit.logInTransaction(tx, {
      schoolId, centerId: before.centerId || centerId, actorUserId,
      action: audit.ACTIONS.INVOICE_VOID,
      entityType: "feeInvoice", entityId: snap.id,
      amount: before.totalAmount, reason: trimmed,
      before: { status: before.status, balance: before.balance, totalAmount: before.totalAmount },
      after:  { status: "Void", balance: 0, totalAmount: before.totalAmount },
    });
  });

  return toInvoice({ ...snap.data(), ...updates, invoiceId: snap.id });
}

/**
 * Add a credit note — a negative adjustment on the invoice, with a reason.
 *
 * Why an adjustment on the invoice rather than a separate credit document: the
 * PRD's third principle is one source of truth per child, and the audit's worst
 * structural finding was three screens each computing their own version of what
 * a family owes. Keeping the reduction on the invoice means `balance` stays the
 * only number anyone has to read, and the reason travels with it.
 *
 * Cannot take the invoice below what has already been paid — that is a refund,
 * deliberately out of this module's scope, and quietly creating a negative
 * balance would be the invisible way to get it wrong.
 */
async function addCreditNote(invoiceId, { amount, reason } = {}, ctx = {}) {
  const { schoolId = SCHOOL_ID, centerId = "", actorUserId = "system" } = ctx;

  const trimmed = String(reason || "").trim();
  if (!trimmed) throw invalid("A credit note needs a reason.");
  if (trimmed.length > 300) throw invalid("A credit note reason cannot exceed 300 characters.");

  // Callers may send 500 or -500; the stored adjustment is always negative.
  const requested = Math.abs(money(amount));
  if (requested <= 0) throw invalid("A credit note needs an amount greater than zero.");

  const invRef = invCol().doc(String(invoiceId || ""));

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(invRef);
    if (!snap.exists) throw notFound("Invoice not found.");

    const before = toInvoice({ ...snap.data(), invoiceId: snap.id });
    if (before.schoolId !== schoolId) throw notFound("Invoice not found.");
    if (before.voided) throw invalid("A void invoice cannot be credited.");

    if (requested > before.balance) {
      throw invalid(
        `A credit note of ${requested} is more than the outstanding balance of ${before.balance}. ` +
        "Refunding money already received is not handled here.",
      );
    }

    const adjustments = [...before.adjustments, {
      adjustmentId: `ADJ${before.adjustments.length + 1}`,
      amount:       -requested,
      reason:       trimmed,
      createdAt:    nowISO(),
      createdBy:    actorUserId,
    }];

    const computed = _recompute({
      lines: before.lines, adjustments,
      paidAmount: before.paidAmount, dueDate: before.dueDate, voided: false,
    });

    const updates = { adjustments, ...computed, updatedAt: nowISO() };
    tx.update(invRef, updates);

    audit.logInTransaction(tx, {
      schoolId, centerId: before.centerId || centerId, actorUserId,
      action: audit.ACTIONS.INVOICE_CREDIT,
      entityType: "feeInvoice", entityId: snap.id,
      amount: -requested, reason: trimmed,
      before: { totalAmount: before.totalAmount,   balance: before.balance,   status: before.status },
      after:  { totalAmount: computed.totalAmount, balance: computed.balance, status: computed.status },
    });

    return toInvoice({ ...snap.data(), ...updates, invoiceId: snap.id });
  });
}

// ── Payments ─────────────────────────────────────────────────────────────────

async function listPayments({
  schoolId = SCHOOL_ID, studentId, invoiceId, familyId, from, to, includeReversed = true,
} = {}) {
  const snap = await payCol().where("schoolId", "==", schoolId).get();
  let list = snap.docs.map(toPayment);

  if (studentId) list = list.filter(p => p.studentId === studentId);
  if (invoiceId) list = list.filter(p => p.invoiceId === invoiceId);
  if (familyId)  list = list.filter(p => p.familyId  === familyId);
  if (from)      list = list.filter(p => (p.paymentDate || "") >= from);
  if (to)        list = list.filter(p => (p.paymentDate || "") <= to);
  if (!includeReversed) list = list.filter(p => !p.reversed);

  return list.sort((a, b) =>
    (b.paymentDate || "").localeCompare(a.paymentDate || "") ||
    (b.createdAt || "").localeCompare(a.createdAt || ""));
}

async function getPayment(paymentId, { schoolId = SCHOOL_ID } = {}) {
  return toPayment(await _requireOwned(payCol, paymentId, schoolId, "Payment"));
}

/**
 * Record money that has changed hands, against one invoice.
 *
 * THE rule of this module: the payment write, the invoice settlement, the
 * receipt-number allocation and the audit row all happen in ONE Firestore
 * transaction. Either all four land or none does. There is no code path that
 * creates a payment without settling its invoice, so "paid invoice still reads
 * Pending" — the defect that made the deleted module report zero collected
 * while money sat in the same collection — is unreachable rather than fixed.
 *
 * This records a payment already received, in cash, by UPI, by cheque or by
 * transfer. It does not move money: no provider is called, and nothing here
 * can initiate a transfer.
 */
async function recordPayment(data = {}, ctx = {}) {
  const { schoolId = SCHOOL_ID, centerId = "", actorUserId = "system" } = ctx;

  const amount = money(data.amount);
  if (amount <= 0) throw invalid("A payment amount must be greater than zero.");

  const paymentMode = String(data.paymentMode || "cash").trim().toLowerCase();
  if (!PAYMENT_MODES.includes(paymentMode)) {
    throw invalid(`"${paymentMode}" is not a payment mode. Use one of: ${PAYMENT_MODES.join(", ")}.`);
  }

  const paymentDate = String(data.paymentDate || today()).trim();
  if (!isISODate(paymentDate)) throw invalid("paymentDate must be a YYYY-MM-DD date.");
  if (paymentDate > today()) throw invalid("A payment cannot be dated in the future.");

  // A reference is what makes a non-cash payment reconcilable against a bank
  // statement, so it is required for every mode except cash.
  const reference = String(data.reference || "").trim();
  if (paymentMode !== "cash" && !reference) {
    throw invalid(
      `A ${paymentMode.replace("_", " ")} payment needs a reference ` +
      "(UTR, cheque number or transaction id).",
    );
  }

  const invoiceId = String(data.invoiceId || "").trim();
  if (!invoiceId) throw invalid("invoiceId is required.");

  const invRef = invCol().doc(invoiceId);
  const payRef = payCol().doc();
  const ym     = paymentDate.slice(0, 7).replace("-", "");
  const seqKey = `fee-receipt-${schoolId}-${ym}`;

  const result = await db.runTransaction(async (tx) => {
    // Every read first — Firestore requires reads before writes, and the
    // sequence is read inside this transaction so a failed payment never burns
    // a receipt number.
    const invSnap = await tx.get(invRef);
    if (!invSnap.exists) throw notFound("Invoice not found.");

    const inv = toInvoice({ ...invSnap.data(), invoiceId: invSnap.id });
    if (inv.schoolId !== schoolId) throw notFound("Invoice not found.");
    if (inv.voided) throw invalid("A void invoice cannot take a payment.");

    const seq = await _nextSeq(tx, seqKey, 4);

    const newPaid = addMoney(inv.paidAmount, amount);
    if (newPaid > inv.totalAmount) {
      throw invalid(
        `This payment of ${amount} exceeds the outstanding balance of ${inv.balance}. ` +
        "Record a partial payment, or add a credit note first.",
      );
    }

    const computed = _recompute({
      lines: inv.lines, adjustments: inv.adjustments,
      paidAmount: newPaid, dueDate: inv.dueDate, voided: false,
    });

    const payment = {
      paymentId:     payRef.id,
      receiptNumber: `RCPT-${ym}-${seq.padded}`,
      invoiceId:     inv.invoiceId,
      invoiceNumber: inv.invoiceNumber,
      studentId:     inv.studentId,
      studentName:   inv.studentName,
      familyId:      inv.familyId,
      amount,
      paymentMode,
      reference,
      paymentDate,
      receivedBy:     String(data.receivedBy || "").trim() || actorUserId,
      notes:          String(data.notes || "").slice(0, 500),
      reversed:       false,
      reversalReason: "",
      reversedBy:     "",
      reversedAt:     "",
      schoolId,
      centerId:  inv.centerId || centerId || "",
      createdAt: nowISO(),
      createdBy: actorUserId,
    };

    tx.set(seq.ref, { seq: seq.next, schoolId, period: ym, updatedAt: nowISO() }, { merge: true });
    tx.set(payRef, payment);
    tx.update(invRef, {
      paidAmount: computed.paidAmount,
      balance:    computed.balance,
      status:     computed.status,
      updatedAt:  nowISO(),
    });

    audit.logInTransaction(tx, {
      schoolId, centerId: payment.centerId, actorUserId,
      action: audit.ACTIONS.PAYMENT_RECORD,
      entityType: "feePayment", entityId: payRef.id,
      amount,
      meta: {
        invoiceId: inv.invoiceId, invoiceNumber: inv.invoiceNumber,
        receiptNumber: payment.receiptNumber, paymentMode,
      },
      before: { paidAmount: inv.paidAmount,        balance: inv.balance,        status: inv.status },
      after:  { paidAmount: computed.paidAmount,   balance: computed.balance,   status: computed.status },
    });

    return {
      payment,
      invoice: { ...invSnap.data(), invoiceId: invSnap.id, ...computed, updatedAt: nowISO() },
    };
  });

  return { payment: toPayment(result.payment), invoice: toInvoice(result.invoice) };
}

/**
 * Reverse a payment, with a mandatory reason — the exact mirror of recording
 * one, and in one transaction for the same reason. A reversal is how a
 * mis-keyed amount, a bounced cheque or a payment put against the wrong child
 * gets corrected.
 *
 * The payment row is never deleted: it stays with `reversed: true` and its
 * reason, so a receipt a parent already holds still resolves to something that
 * explains itself.
 */
async function reversePayment(paymentId, reason, ctx = {}) {
  const { schoolId = SCHOOL_ID, centerId = "", actorUserId = "system" } = ctx;

  const trimmed = String(reason || "").trim();
  if (!trimmed) throw invalid("Reversing a payment needs a reason.");
  if (trimmed.length > 300) throw invalid("A reversal reason cannot exceed 300 characters.");

  const payRef = payCol().doc(String(paymentId || ""));

  const result = await db.runTransaction(async (tx) => {
    const paySnap = await tx.get(payRef);
    if (!paySnap.exists) throw notFound("Payment not found.");

    const payment = toPayment({ ...paySnap.data(), paymentId: paySnap.id });
    if (payment.schoolId !== schoolId) throw notFound("Payment not found.");
    if (payment.reversed) throw invalid("This payment has already been reversed.");

    const invRef  = invCol().doc(payment.invoiceId);
    const invSnap = await tx.get(invRef);
    if (!invSnap.exists) throw notFound("The invoice this payment settles no longer exists.");

    const inv = toInvoice({ ...invSnap.data(), invoiceId: invSnap.id });
    if (inv.schoolId !== schoolId) throw notFound("Payment not found.");

    const newPaid = subtractMoney(inv.paidAmount, payment.amount);
    if (newPaid < 0) {
      // Unreachable while every settlement goes through recordPayment, which is
      // the point of asserting it: if it ever fires, the invariant has broken
      // somewhere else, and silently clamping to zero would hide that.
      throw invalid("Reversing this payment would take the invoice's paid amount below zero.");
    }

    const computed = _recompute({
      lines: inv.lines, adjustments: inv.adjustments,
      paidAmount: newPaid, dueDate: inv.dueDate, voided: inv.voided,
    });

    const payUpdates = {
      reversed:       true,
      reversalReason: trimmed,
      reversedBy:     actorUserId,
      reversedAt:     nowISO(),
    };

    tx.update(payRef, payUpdates);
    tx.update(invRef, {
      paidAmount: computed.paidAmount,
      balance:    computed.balance,
      status:     computed.status,
      updatedAt:  nowISO(),
    });

    audit.logInTransaction(tx, {
      schoolId, centerId: payment.centerId || centerId, actorUserId,
      action: audit.ACTIONS.PAYMENT_REVERSE,
      entityType: "feePayment", entityId: paySnap.id,
      amount: -payment.amount, reason: trimmed,
      meta: {
        invoiceId: inv.invoiceId, invoiceNumber: inv.invoiceNumber,
        receiptNumber: payment.receiptNumber,
      },
      before: { paidAmount: inv.paidAmount,      balance: inv.balance,      status: inv.status,      reversed: false },
      after:  { paidAmount: computed.paidAmount, balance: computed.balance, status: computed.status, reversed: true  },
    });

    return {
      payment: { ...paySnap.data(), paymentId: paySnap.id, ...payUpdates },
      invoice: { ...invSnap.data(), invoiceId: invSnap.id, ...computed, updatedAt: nowISO() },
    };
  });

  return { payment: toPayment(result.payment), invoice: toInvoice(result.invoice) };
}

/** The receipt for one payment — the payment, its invoice, the school's details. */
async function getReceipt(paymentId, { schoolId = SCHOOL_ID } = {}) {
  const payment  = await getPayment(paymentId, { schoolId });
  const invoice  = await getInvoice(payment.invoiceId, { schoolId });
  const settings = await getSettings({ schoolId });
  return { payment, invoice, settings };
}

// ── Rollups ──────────────────────────────────────────────────────────────────

/**
 * Who owes what — per child, rolled up per family, plus school totals.
 *
 * This is the module's ONE aggregation. The audit's third finding was that
 * finance KPIs were computed independently in three screens with overlapping,
 * sometimes-inconsistent numbers; every screen here reads this function, so the
 * dashboard and the outstanding list cannot disagree.
 *
 * Void invoices are excluded from every total: a withdrawn bill is not money
 * anybody owes.
 */
async function getOutstanding({ schoolId = SCHOOL_ID, asOf = today() } = {}) {
  const [stuSnap, invoices] = await Promise.all([
    db.collection("students").where("schoolId", "==", schoolId).get(),
    listInvoices({ schoolId, includeVoid: false }),
  ]);

  const byStudent = new Map();
  for (const inv of invoices) {
    if (!byStudent.has(inv.studentId)) byStudent.set(inv.studentId, []);
    byStudent.get(inv.studentId).push(inv);
  }

  const students = stuSnap.docs.map(doc => {
    const d         = doc.data();
    const studentId = d.studentId || doc.id;
    const mine      = byStudent.get(studentId) || [];

    const billed  = sumMoney(mine, "totalAmount");
    const paid    = sumMoney(mine, "paidAmount");
    const balance = sumMoney(mine, "balance");
    const overdue = mine.filter(i => i.status === "Overdue");
    const oldest  = overdue.map(i => i.dueDate).filter(Boolean).sort()[0] || "";

    return {
      studentId,
      studentName:  d.studentName || d.Student_Name || "",
      class:        d.class || d.Class || "",
      familyId:     d.familyId || "",
      active:       String(d.status || "Active").toLowerCase() === "active",
      invoiceCount: mine.length,
      billed, paid, balance,
      overdueCount:  overdue.length,
      overdueAmount: sumMoney(overdue, "balance"),
      oldestDueDate: oldest,
      aging:         oldest ? agingBucket(oldest, asOf) : "current",
      status:        mine.length === 0      ? "No Invoices"
                   : overdue.length > 0     ? "Overdue"
                   : balance > 0            ? "Outstanding"
                   : "Clear",
    };
  }).sort((a, b) => b.balance - a.balance || a.studentName.localeCompare(b.studentName));

  // Children with no familyId are their own group, so a school that has not
  // linked siblings still sees every balance exactly once in the family view.
  const familyMap = new Map();
  for (const s of students) {
    const key = s.familyId || `solo:${s.studentId}`;
    if (!familyMap.has(key)) {
      familyMap.set(key, {
        familyId: s.familyId || "", groupKey: key, children: [],
        billed: 0, paid: 0, balance: 0, overdueCount: 0, overdueAmount: 0,
      });
    }
    const f = familyMap.get(key);
    f.children.push({
      studentId: s.studentId, studentName: s.studentName,
      class: s.class, balance: s.balance,
    });
    f.billed        = addMoney(f.billed, s.billed);
    f.paid          = addMoney(f.paid, s.paid);
    f.balance       = addMoney(f.balance, s.balance);
    f.overdueAmount = addMoney(f.overdueAmount, s.overdueAmount);
    f.overdueCount += s.overdueCount;
  }

  const families = [...familyMap.values()]
    .map(f => ({
      ...f,
      childCount: f.children.length,
      status: f.overdueCount > 0 ? "Overdue" : f.balance > 0 ? "Outstanding" : "Clear",
    }))
    .sort((a, b) => b.balance - a.balance);

  const billed    = sumMoney(invoices, "totalAmount");
  const collected = sumMoney(invoices, "paidAmount");
  const overdueInvoices = invoices.filter(i => i.status === "Overdue");

  return {
    asOf,
    totals: {
      students:       students.length,
      families:       families.length,
      invoices:       invoices.length,
      billed,
      collected,
      outstanding:    sumMoney(invoices, "balance"),
      overdueCount:   overdueInvoices.length,
      overdueAmount:  sumMoney(overdueInvoices, "balance"),
      collectionRate: collectionRate(billed, collected),
    },
    students, families,
  };
}

/**
 * The KPI row: what came in today and this month, what is owed, what is
 * overdue, and how much of the billing is actually turning into cash.
 * Reversed payments are excluded from collections — that money went back.
 */
async function getSummary({ schoolId = SCHOOL_ID, period, asOf = today() } = {}) {
  const month = period && isPeriod(period) ? period : asOf.slice(0, 7);

  const [invoices, payments] = await Promise.all([
    listInvoices({ schoolId, includeVoid: false }),
    listPayments({ schoolId, includeReversed: false }),
  ]);

  const monthInvoices = invoices.filter(i => i.period === month);
  const monthPayments = payments.filter(p => (p.paymentDate || "").startsWith(month));
  const todayPayments = payments.filter(p => p.paymentDate === asOf);
  const overdue       = invoices.filter(i => i.status === "Overdue");

  const aging = { current: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
  for (const inv of invoices) {
    if (inv.balance <= 0) continue;
    const bucket = agingBucket(inv.dueDate, asOf);
    aging[bucket] = addMoney(aging[bucket], inv.balance);
  }

  const billedThisMonth    = sumMoney(monthInvoices, "totalAmount");
  const collectedThisMonth = sumMoney(monthPayments, "amount");

  return {
    asOf, period: month,
    collectedToday:    sumMoney(todayPayments, "amount"),
    collectedThisMonth,
    billedThisMonth,
    outstanding:       sumMoney(invoices, "balance"),
    overdueCount:      overdue.length,
    overdueAmount:     sumMoney(overdue, "balance"),
    invoicesThisMonth: monthInvoices.length,
    paymentsThisMonth: monthPayments.length,
    collectionRate:    collectionRate(billedThisMonth, collectedThisMonth),
    // The truest test of whether the automation is landing in daily practice,
    // per the PRD's Invoice Automation % KPI.
    automationRate: monthInvoices.length === 0 ? 0
      : Math.round(
          (monthInvoices.filter(i => i.generatedBy === "plan").length / monthInvoices.length) * 1000,
        ) / 10,
    aging,
  };
}

// ── Parent-facing ────────────────────────────────────────────────────────────

/**
 * One child's own bills and receipts. The caller has already resolved which
 * child this is from the parent's own link (requireOwnChild) — this function
 * never takes a client-supplied studentId, which is what kept the deleted
 * module's parent fee route well-isolated and is worth keeping.
 *
 * Void invoices are hidden: a withdrawn bill is a staff-side correction, and
 * showing it would raise a question about money the family never owed.
 */
async function getForStudent({ schoolId = SCHOOL_ID, studentId, asOf = today() } = {}) {
  if (!studentId) throw invalid("studentId is required.");

  const [invoices, payments, settings] = await Promise.all([
    listInvoices({ schoolId, studentId, includeVoid: false }),
    listPayments({ schoolId, studentId, includeReversed: false }),
    getSettings({ schoolId }),
  ]);

  const overdue = invoices.filter(i => i.status === "Overdue");
  const unpaid  = invoices.filter(i => i.balance > 0);
  const nextDue = unpaid.map(i => i.dueDate).filter(Boolean).sort()[0] || "";

  return {
    asOf,
    summary: {
      outstanding:   sumMoney(invoices, "balance"),
      paidToDate:    sumMoney(payments, "amount"),
      billedToDate:  sumMoney(invoices, "totalAmount"),
      overdueCount:  overdue.length,
      overdueAmount: sumMoney(overdue, "balance"),
      unpaidCount:   unpaid.length,
      nextDueDate:   nextDue,
    },
    invoices, payments,
    payee: { upiId: settings.upiId, upiName: settings.upiName, schoolName: settings.schoolName },
  };
}

// ── Settings ─────────────────────────────────────────────────────────────────

/**
 * Billing settings live in the existing `settings/{section}` collection rather
 * than one of their own — the audit's complaint about the deleted module was
 * eleven collections for one domain, and this is a payee name and a VPA.
 *
 * `upiId` is the school's own virtual payment address. The frontend renders a
 * UPI deep link as a QR code from it so a parent can scan and pay; staff then
 * record the payment they can see has arrived. Nothing here calls a payment
 * provider or moves money, and there is no gateway key to leak.
 */
const SETTINGS_DOC = "billing";

async function getSettings({ schoolId = SCHOOL_ID } = {}) {
  const snap = await db.collection("settings").doc(SETTINGS_DOC).get();
  const d = snap.exists ? snap.data() : {};
  return {
    schoolName:    d.schoolName    || "",
    upiId:         d.upiId         || "",
    upiName:       d.upiName       || "",
    receiptFooter: d.receiptFooter || "",
    dueDayOfMonth: Number(d.dueDayOfMonth) || 0,
    schoolId:      d.schoolId      || schoolId,
    updatedAt:     d.updatedAt     || "",
    updatedBy:     d.updatedBy     || "",
  };
}

/** A UPI virtual payment address: `handle@provider`. */
function isUpiId(v) {
  return typeof v === "string" && /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z][a-zA-Z0-9.]{1,32}$/.test(v);
}

async function updateSettings(data = {}, ctx = {}) {
  const { schoolId = SCHOOL_ID, centerId = "", actorUserId = "system" } = ctx;
  const before  = await getSettings({ schoolId });
  const updates = { schoolId, updatedAt: nowISO(), updatedBy: actorUserId };

  if (data.schoolName    !== undefined) updates.schoolName    = String(data.schoolName || "").slice(0, 120).trim();
  if (data.upiName       !== undefined) updates.upiName       = String(data.upiName || "").slice(0, 120).trim();
  if (data.receiptFooter !== undefined) updates.receiptFooter = String(data.receiptFooter || "").slice(0, 300);

  if (data.upiId !== undefined) {
    const upiId = String(data.upiId || "").trim();
    if (upiId && !isUpiId(upiId)) throw invalid("A UPI ID looks like name@bank.");
    updates.upiId = upiId;
  }

  if (data.dueDayOfMonth !== undefined) {
    const day = Number(data.dueDayOfMonth);
    if (!Number.isInteger(day) || day < 0 || day > 28) {
      throw invalid("dueDayOfMonth must be a whole number from 1 to 28, or 0 for the end of the month.");
    }
    updates.dueDayOfMonth = day;
  }

  await db.collection("settings").doc(SETTINGS_DOC).set(updates, { merge: true });

  await audit.log({
    schoolId, centerId, actorUserId,
    action: audit.ACTIONS.SETTINGS_UPDATE,
    entityType: "billingSettings", entityId: SETTINGS_DOC,
    before: { upiId: before.upiId, upiName: before.upiName, dueDayOfMonth: before.dueDayOfMonth },
    after: {
      upiId:         updates.upiId         ?? before.upiId,
      upiName:       updates.upiName       ?? before.upiName,
      dueDayOfMonth: updates.dueDayOfMonth ?? before.dueDayOfMonth,
    },
  });

  return getSettings({ schoolId });
}

module.exports = {
  BillingError,
  FEE_TYPES, CADENCES, PAYMENT_MODES,
  MAX_LINES, MAX_GENERATION,
  // plans
  listPlans, getPlan, createPlan, updatePlan, deactivatePlan,
  // invoices
  listInvoices, getInvoice, getInvoiceWithPayments, createInvoice,
  generateForPeriod, voidInvoice, addCreditNote,
  // payments
  listPayments, getPayment, recordPayment, reversePayment, getReceipt,
  // rollups
  getOutstanding, getSummary,
  // parent
  getForStudent,
  // settings
  getSettings, updateSettings, isUpiId,
  // internals, exported for tests
  _normaliseLines, _recompute, _loadStudent,
};
