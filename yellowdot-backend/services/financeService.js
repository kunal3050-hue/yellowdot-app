/**
 * financeService.js — Firestore-backed fees, invoices and payments
 * ─────────────────────────────────────────────────────────────────
 * Collections:
 *   feeTemplates/{templateId}  — what a class of student is charged
 *   invoices/{invoiceId}       — a bill raised for one student, one period
 *   payments/{paymentId}       — money received, always against one invoice
 *
 * Deliberately three collections, not eleven. There are no ledgers, ledger
 * entries, billing plans, family accounts, allocation strategies or audit
 * tables: for a school billing one fixed monthly fee per child, the running
 * balance is `invoice.balance` and nothing further is earned by modelling
 * double-entry bookkeeping on top of it.
 *
 * The one rule that matters:
 *   recordPayment() writes the payment AND settles its invoice inside a
 *   single Firestore transaction. There is no code path that creates a
 *   payment without updating the invoice, so "paid invoice still shows
 *   Pending" — the defect that made the previous module report zero while
 *   money sat in the same collection — cannot occur by construction.
 *
 * Isolation: schoolId on every document; every read scopes to it.
 * Timestamps: createdAt on create, updatedAt on every write.
 * ID formats: FT001 · INV-YYYYMM-0001 · RCPT-YYYYMM-0001 (atomic counters)
 */

const { db } = require("../firebaseAdmin");

const SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";

const tplCol = () => db.collection("feeTemplates");
const invCol = () => db.collection("invoices");
const payCol = () => db.collection("payments");

const nowISO = () => new Date().toISOString();

// ── Helpers ────────────────────────────────────────────────────────

/** Amounts may arrive as strings from forms or legacy rows. */
function money(v) {
  if (typeof v === "number") return isFinite(v) ? Math.round(v * 100) / 100 : 0;
  const n = parseFloat(String(v == null ? "" : v).replace(/[^0-9.-]/g, ""));
  return isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

/** "YYYY-MM" for a Date (or today). */
function periodOf(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Format a Date as "YYYY-MM-DD" in LOCAL time.
 *
 * Not toISOString().slice(0,10): that converts to UTC first, so in IST
 * (+05:30) a local midnight lands on the previous UTC day. That turned the
 * 31st of August into the 30th, and every invoice raised before 05:30 IST
 * would have been dated yesterday.
 */
function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Today as "YYYY-MM-DD", local time. */
function today() {
  return localDate();
}

/** Last calendar day of a "YYYY-MM" period, as "YYYY-MM-DD". */
function periodEnd(period) {
  const [y, m] = period.split("-").map(Number);
  return localDate(new Date(y, m, 0));   // day 0 of next month = last of this
}

/**
 * Invoice status is always derived from the numbers, never stored
 * independently of them, so it cannot drift out of sync with paidAmount.
 */
function statusFor(totalAmount, paidAmount, dueDate) {
  const total = money(totalAmount);
  const paid  = money(paidAmount);
  if (total > 0 && paid >= total) return "Paid";
  if (dueDate && dueDate < today()) return "Overdue";
  if (paid > 0) return "Partial";
  return "Pending";
}

async function nextSeq(counterName, width = 3) {
  const ref = db.collection("_counters").doc(counterName);
  let n = 1;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    n = snap.exists ? (snap.data().count || 0) + 1 : 1;
    tx.set(ref, { count: n }, { merge: true });
  });
  return String(n).padStart(width, "0");
}

// ── Mappers ────────────────────────────────────────────────────────

function toTemplate(snap) {
  const d = snap.data ? snap.data() : snap;
  return {
    templateId: d.templateId || snap.id,
    name:       d.name       || "",
    amount:     money(d.amount),
    classes:    Array.isArray(d.classes) ? d.classes : [],
    active:     d.active !== false,
    schoolId:   d.schoolId   || SCHOOL_ID,
    createdAt:  d.createdAt  || "",
    updatedAt:  d.updatedAt  || "",
  };
}

/**
 * Field names here are load-bearing: parentFeesService and familyService
 * read studentId / studentName / feeType / invoiceDate / dueDate /
 * totalAmount / paidAmount / balance / status directly off these documents.
 * Renaming any of them silently breaks the parent app and the family fees
 * summary, neither of which imports this module.
 */
function toInvoice(snap) {
  const d = snap.data ? snap.data() : snap;
  return {
    invoiceId:     d.invoiceId     || snap.id,
    invoiceNumber: d.invoiceNumber || "",
    studentId:     d.studentId     || "",
    studentName:   d.studentName   || "",
    familyId:      d.familyId      || "",
    class:         d.class         || "",
    feeType:       d.feeType       || "",
    templateId:    d.templateId    || "",
    period:        d.period        || "",
    invoiceDate:   d.invoiceDate   || "",
    dueDate:       d.dueDate       || "",
    totalAmount:   money(d.totalAmount),
    paidAmount:    money(d.paidAmount),
    balance:       money(d.balance),
    status:        d.status        || "Pending",
    notes:         d.notes         || "",
    schoolId:      d.schoolId      || SCHOOL_ID,
    centerId:      d.centerId      || "",
    createdAt:     d.createdAt     || "",
    updatedAt:     d.updatedAt     || "",
    createdBy:     d.createdBy     || "",
  };
}

function toPayment(snap) {
  const d = snap.data ? snap.data() : snap;
  return {
    paymentId:     d.paymentId     || snap.id,
    receiptNumber: d.receiptNumber || "",
    invoiceId:     d.invoiceId     || "",
    invoiceNumber: d.invoiceNumber || "",
    studentId:     d.studentId     || "",
    studentName:   d.studentName   || "",
    familyId:      d.familyId      || "",
    amount:        money(d.amount),
    paymentMode:   d.paymentMode   || "",
    transactionId: d.transactionId || "",
    paymentDate:   d.paymentDate   || "",
    notes:         d.notes         || "",
    schoolId:      d.schoolId      || SCHOOL_ID,
    centerId:      d.centerId      || "",
    createdAt:     d.createdAt     || "",
    createdBy:     d.createdBy     || "",
  };
}

// ── Fee templates ──────────────────────────────────────────────────

async function listTemplates({ schoolId = SCHOOL_ID, activeOnly = false } = {}) {
  const snap = await tplCol().where("schoolId", "==", schoolId).get();
  let list = snap.docs.map(toTemplate);
  if (activeOnly) list = list.filter(t => t.active);
  return list.sort((a, b) => a.name.localeCompare(b.name));
}

async function createTemplate(data, { schoolId = SCHOOL_ID, actorUserId = "system" } = {}) {
  const name = String(data.name || "").trim();
  if (!name) { const e = new Error("Template name is required."); e.code = "VALIDATION"; throw e; }
  const amount = money(data.amount);
  if (amount <= 0) { const e = new Error("Amount must be greater than zero."); e.code = "VALIDATION"; throw e; }

  const templateId = `FT${await nextSeq("feeTemplates")}`;
  const doc = {
    templateId, name, amount,
    classes:   Array.isArray(data.classes) ? data.classes : [],
    active:    data.active !== false,
    schoolId,
    createdAt: nowISO(),
    updatedAt: nowISO(),
    createdBy: actorUserId,
  };
  await tplCol().doc(templateId).set(doc);
  return toTemplate(doc);
}

async function updateTemplate(templateId, data, { actorUserId = "system" } = {}) {
  const ref  = tplCol().doc(templateId);
  const snap = await ref.get();
  if (!snap.exists) return null;

  const updates = { updatedAt: nowISO(), updatedBy: actorUserId };
  if (data.name    !== undefined) updates.name    = String(data.name).trim();
  if (data.amount  !== undefined) updates.amount  = money(data.amount);
  if (data.classes !== undefined) updates.classes = Array.isArray(data.classes) ? data.classes : [];
  if (data.active  !== undefined) updates.active  = Boolean(data.active);

  await ref.update(updates);
  return toTemplate({ ...snap.data(), ...updates });
}

async function deleteTemplate(templateId) {
  const ref  = tplCol().doc(templateId);
  const snap = await ref.get();
  if (!snap.exists) return false;
  await ref.delete();
  return true;
}

// ── Invoices ───────────────────────────────────────────────────────

/** Equality-only query plus in-memory filters, so no composite index is needed. */
async function listInvoices({ schoolId = SCHOOL_ID, studentId, status, period } = {}) {
  const snap = await invCol().where("schoolId", "==", schoolId).get();
  let list = snap.docs.map(toInvoice);
  if (studentId) list = list.filter(i => i.studentId === studentId);
  if (status)    list = list.filter(i => i.status    === status);
  if (period)    list = list.filter(i => i.period    === period);
  return list.sort((a, b) => (b.invoiceDate || "").localeCompare(a.invoiceDate || ""));
}

async function getInvoice(invoiceId, { schoolId = SCHOOL_ID } = {}) {
  const snap = await invCol().doc(invoiceId).get();
  if (!snap.exists) return null;
  const inv = toInvoice(snap);
  return inv.schoolId === schoolId ? inv : null;   // hide, do not reveal
}

async function createInvoice(data, { schoolId = SCHOOL_ID, centerId = "", actorUserId = "system" } = {}) {
  const studentId = String(data.studentId || "").trim();
  if (!studentId) { const e = new Error("studentId is required."); e.code = "VALIDATION"; throw e; }
  const totalAmount = money(data.amount != null ? data.amount : data.totalAmount);
  if (totalAmount <= 0) { const e = new Error("Amount must be greater than zero."); e.code = "VALIDATION"; throw e; }

  const period  = data.period  || periodOf();
  const dueDate = data.dueDate || periodEnd(period);
  const ym      = period.replace("-", "");
  const seq     = await nextSeq(`invoices-${ym}`, 4);

  const invoiceId     = `INV${Date.now()}`;
  const invoiceNumber = `INV-${ym}-${seq}`;

  const doc = {
    invoiceId, invoiceNumber,
    studentId,
    studentName: data.studentName || "",
    familyId:    data.familyId    || "",
    class:       data.class       || "",
    feeType:     data.feeType     || data.name || "Fees",
    templateId:  data.templateId  || "",
    period,
    invoiceDate: data.invoiceDate || today(),
    dueDate,
    totalAmount,
    paidAmount:  0,
    balance:     totalAmount,
    status:      statusFor(totalAmount, 0, dueDate),
    notes:       data.notes || "",
    schoolId, centerId,
    createdAt:   nowISO(),
    updatedAt:   nowISO(),
    createdBy:   actorUserId,
  };
  await invCol().doc(invoiceId).set(doc);
  return toInvoice(doc);
}

async function deleteInvoice(invoiceId, { schoolId = SCHOOL_ID } = {}) {
  const inv = await getInvoice(invoiceId, { schoolId });
  if (!inv) return false;
  const paid = await payCol().where("invoiceId", "==", invoiceId).limit(1).get();
  if (!paid.empty) {
    const e = new Error("Cannot delete an invoice that has payments against it.");
    e.code = "VALIDATION";
    throw e;
  }
  await invCol().doc(invoiceId).delete();
  return true;
}

/**
 * Raise this period's invoice for every active student whose class matches
 * an active fee template. Idempotent: a student who already has an invoice
 * for the same period is skipped, so re-running — by cron, by retry, or by
 * a staff member clicking twice — never double-bills.
 */
async function generateForPeriod({
  schoolId = SCHOOL_ID, period = periodOf(), actorUserId = "system", dryRun = false,
} = {}) {
  const [tplSnap, stuSnap, invSnap] = await Promise.all([
    tplCol().where("schoolId", "==", schoolId).get(),
    db.collection("students").where("schoolId", "==", schoolId).get(),
    invCol().where("schoolId", "==", schoolId).get(),
  ]);

  const templates = tplSnap.docs.map(toTemplate).filter(t => t.active);
  const already   = new Set(
    invSnap.docs.map(d => d.data()).filter(i => i.period === period).map(i => i.studentId)
  );

  const created = [], skipped = [], unmatched = [];

  for (const doc of stuSnap.docs) {
    const s         = doc.data();
    const studentId = s.studentId || doc.id;
    const isActive  = String(s.status || "Active").toLowerCase() === "active";

    if (!isActive)              { skipped.push({ studentId, reason: "inactive" });          continue; }
    if (already.has(studentId)) { skipped.push({ studentId, reason: "already_invoiced" });  continue; }

    const cls = s.class || s.Class || "";
    // A template with no classes listed applies to everyone.
    const tpl = templates.find(t => t.classes.length === 0 || t.classes.includes(cls));
    if (!tpl) { unmatched.push({ studentId, class: cls }); continue; }

    if (dryRun) {
      created.push({ studentId, amount: tpl.amount, template: tpl.name });
      continue;
    }

    const inv = await createInvoice({
      studentId,
      studentName: s.studentName || s.Student_Name || "",
      familyId:    s.familyId || "",
      class:       cls,
      feeType:     tpl.name,
      templateId:  tpl.templateId,
      amount:      tpl.amount,
      period,
    }, { schoolId, centerId: s.centerId || "", actorUserId });

    created.push({ studentId, invoiceNumber: inv.invoiceNumber, amount: inv.totalAmount });
  }

  return { period, dryRun, createdCount: created.length, created, skipped, unmatched };
}

// ── Payments ───────────────────────────────────────────────────────

const PAYMENT_MODES = new Set(["Cash", "UPI", "Card", "BankTransfer", "Cheque", "Other"]);

async function listPayments({ schoolId = SCHOOL_ID, studentId, invoiceId } = {}) {
  const snap = await payCol().where("schoolId", "==", schoolId).get();
  let list = snap.docs.map(toPayment);
  if (studentId) list = list.filter(p => p.studentId === studentId);
  if (invoiceId) list = list.filter(p => p.invoiceId === invoiceId);
  return list.sort((a, b) => (b.paymentDate || "").localeCompare(a.paymentDate || ""));
}

/**
 * Record money received against one invoice.
 *
 * The payment write and the invoice settlement happen in ONE transaction —
 * this is the whole point of the rebuild. Either both land or neither does,
 * so a payment can never exist whose invoice still reads Pending.
 */
async function recordPayment(data, { schoolId = SCHOOL_ID, centerId = "", actorUserId = "system" } = {}) {
  const invoiceId = String(data.invoiceId || "").trim();
  if (!invoiceId) { const e = new Error("invoiceId is required."); e.code = "VALIDATION"; throw e; }

  const amount = money(data.amount);
  if (amount <= 0) { const e = new Error("Amount must be greater than zero."); e.code = "VALIDATION"; throw e; }

  const paymentMode = data.paymentMode || "Cash";
  if (!PAYMENT_MODES.has(paymentMode)) {
    const e = new Error(`Invalid payment mode "${paymentMode}".`); e.code = "VALIDATION"; throw e;
  }

  const ym            = periodOf().replace("-", "");
  const paymentId     = `PAY${Date.now()}`;
  const receiptNumber = `RCPT-${ym}-${await nextSeq(`receipts-${ym}`, 4)}`;
  const paymentDate   = data.paymentDate || today();

  const invRef = invCol().doc(invoiceId);
  const payRef = payCol().doc(paymentId);

  const result = await db.runTransaction(async (tx) => {
    const invSnap = await tx.get(invRef);
    if (!invSnap.exists) { const e = new Error("Invoice not found."); e.code = "NOT_FOUND"; throw e; }

    const inv = invSnap.data();
    if (inv.schoolId !== schoolId) { const e = new Error("Invoice not found."); e.code = "NOT_FOUND"; throw e; }

    const newPaid = money(money(inv.paidAmount) + amount);
    if (newPaid > money(inv.totalAmount)) {
      const e = new Error(
        `Payment exceeds the outstanding balance (balance ${money(inv.balance)}, offered ${amount}).`
      );
      e.code = "VALIDATION";
      throw e;
    }

    const newBalance = money(money(inv.totalAmount) - newPaid);
    const newStatus  = statusFor(inv.totalAmount, newPaid, inv.dueDate);

    const payDoc = {
      paymentId, receiptNumber,
      invoiceId,
      invoiceNumber: inv.invoiceNumber || "",
      studentId:     inv.studentId     || "",
      studentName:   inv.studentName   || "",
      familyId:      inv.familyId      || "",
      amount, paymentMode,
      transactionId: data.transactionId || "",
      paymentDate,
      notes:         data.notes || "",
      schoolId,
      centerId:      centerId || inv.centerId || "",
      createdAt:     nowISO(),
      createdBy:     actorUserId,
    };

    tx.set(payRef, payDoc);
    tx.update(invRef, {
      paidAmount: newPaid,
      balance:    newBalance,
      status:     newStatus,
      updatedAt:  nowISO(),
    });

    return {
      payment: payDoc,
      invoice: { ...inv, paidAmount: newPaid, balance: newBalance, status: newStatus },
    };
  });

  return { payment: toPayment(result.payment), invoice: toInvoice(result.invoice) };
}

// ── Summary (Fees overview screen) ─────────────────────────────────

/** One row per student: billed, paid, outstanding, and a headline status. */
async function studentSummary({ schoolId = SCHOOL_ID } = {}) {
  const [stuSnap, invSnap] = await Promise.all([
    db.collection("students").where("schoolId", "==", schoolId).get(),
    invCol().where("schoolId", "==", schoolId).get(),
  ]);
  const invoices = invSnap.docs.map(toInvoice);

  const rows = stuSnap.docs.map(doc => {
    const s         = doc.data();
    const studentId = s.studentId || doc.id;
    const mine      = invoices.filter(i => i.studentId === studentId);

    const billed  = mine.reduce((t, i) => t + i.totalAmount, 0);
    const paid    = mine.reduce((t, i) => t + i.paidAmount, 0);
    const balance = mine.reduce((t, i) => t + i.balance, 0);
    const overdue = mine.some(i => i.status === "Overdue");

    return {
      studentId,
      studentName:  s.studentName || s.Student_Name || "",
      class:        s.class || s.Class || "",
      invoiceCount: mine.length,
      billed:  money(billed),
      paid:    money(paid),
      balance: money(balance),
      status:  mine.length === 0 ? "No Invoices"
             : overdue         ? "Overdue"
             : balance > 0     ? "Pending"
             : "Clear",
    };
  });

  const totals = {
    students: rows.length,
    billed:   money(rows.reduce((t, r) => t + r.billed, 0)),
    paid:     money(rows.reduce((t, r) => t + r.paid, 0)),
    balance:  money(rows.reduce((t, r) => t + r.balance, 0)),
  };

  return { totals, rows: rows.sort((a, b) => a.studentName.localeCompare(b.studentName)) };
}

module.exports = {
  // templates
  listTemplates, createTemplate, updateTemplate, deleteTemplate,
  // invoices
  listInvoices, getInvoice, createInvoice, deleteInvoice, generateForPeriod,
  // payments
  listPayments, recordPayment, PAYMENT_MODES,
  // overview
  studentSummary,
  // helpers (exported for tests)
  statusFor, money, periodOf, periodEnd, localDate, today,
};
