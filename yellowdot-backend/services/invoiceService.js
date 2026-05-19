/**
 * invoiceService.js — Firestore-backed Invoice / Payment / Fee Templates
 * ────────────────────────────────────────────────────────────────────────
 * Collections:
 *   invoices      {invoiceId}  — invoice records
 *   payments      {paymentId}  — payment records
 *   feeTemplates  {templateId} — reusable fee templates
 *
 * Isolation:
 *   schoolId — every document scoped to a school
 *   centerId — every document stores the originating center
 *
 * Timestamps: createdAt (on create), updatedAt (on every write)
 */

const { db } = require("../firebaseAdmin");

const SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";

// ── Collection refs ────────────────────────────────────────────────
const invCol = () => db.collection("invoices");
const payCol = () => db.collection("payments");
const tplCol = () => db.collection("feeTemplates");

// ── ID generators ──────────────────────────────────────────────────
const genInvId  = () => `INV-${Date.now()}`;
const genPayId  = () => `PAY-${Date.now()}`;
const genTplId  = () => `TPL-${Date.now()}`;
const nowStr    = ()  => new Date().toISOString();

function genInvoiceNumber() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const s = String(Date.now()).slice(-5);
  return `INV-${y}${m}-${s}`;
}

// ── Parsers ────────────────────────────────────────────────────────

function parseAmount(val) {
  const n = Number(String(val || "").replace(/,/g, "").trim());
  return isFinite(n) && n >= 0 && n <= 9_999_999 ? n : 0;
}

function parseDate(val) {
  const s = String(val || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return s;
  }
  return "";
}

const VALID_STATUSES = new Set(["Paid", "Pending", "Partial", "Overdue", "Cancelled"]);
function parseStatus(val) {
  const s = String(val || "").trim();
  return VALID_STATUSES.has(s) ? s : "Pending";
}

// ── Status auto-computation ────────────────────────────────────────

function computeStatus(totalAmount, paidAmount, dueDate, currentStatus) {
  if ((currentStatus || "").toLowerCase() === "cancelled") return "Cancelled";
  const total = parseAmount(totalAmount);
  const paid  = parseAmount(paidAmount);
  if (total > 0 && paid >= total) return "Paid";
  let overdue = false;
  if (dueDate) {
    const due   = new Date(dueDate);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    if (!isNaN(due.getTime()) && due < today) overdue = true;
  }
  if (paid > 0) return overdue ? "Overdue" : "Partial";
  return overdue ? "Overdue" : "Pending";
}

// ── Document mappers ───────────────────────────────────────────────

function docToInvoice(snap) {
  const d  = snap.data ? snap.data() : snap;
  const id = snap.id   || d.invoiceId || "";
  return {
    invoiceId:      d.invoiceId      || id,
    invoiceNumber:  d.invoiceNumber  || "",
    studentId:      d.studentId      || "",
    studentName:    d.studentName    || "",
    class:          d.class          || "",
    feeType:        d.feeType        || "",
    billingCycle:   d.billingCycle   || "",
    durationFrom:   parseDate(d.durationFrom),
    durationTo:     parseDate(d.durationTo),
    invoiceDate:    parseDate(d.invoiceDate),
    dueDate:        parseDate(d.dueDate),
    amount:         parseAmount(d.amount),
    gst:            parseAmount(d.gst),
    discount:       parseAmount(d.discount),
    totalAmount:    parseAmount(d.totalAmount),
    paidAmount:     parseAmount(d.paidAmount),
    balance:        parseAmount(d.balance),
    status:         parseStatus(d.status),
    fatherWhatsApp: d.fatherWhatsApp || "",
    motherWhatsApp: d.motherWhatsApp || "",
    notes:          d.notes          || "",
    schoolId:       d.schoolId       || SCHOOL_ID,
    centerId:       d.centerId       || d.center || "",
    createdAt:      d.createdAt      || "",
    updatedAt:      d.updatedAt      || "",
    createdBy:      d.createdBy      || "",
  };
}

function docToPayment(snap) {
  const d  = snap.data ? snap.data() : snap;
  const id = snap.id   || d.paymentId || "";
  return {
    paymentId:     d.paymentId     || id,
    invoiceNumber: d.invoiceNumber || "",
    studentId:     d.studentId     || "",
    studentName:   d.studentName   || "",
    amount:        parseAmount(d.amount),
    paymentMode:   d.paymentMode   || "",
    transactionId: d.transactionId || "",
    paymentDate:   d.paymentDate   || "",
    notes:         d.notes         || "",
    staffName:     d.staffName     || "",
    schoolId:      d.schoolId      || SCHOOL_ID,
    centerId:      d.centerId      || d.center || "",
    createdAt:     d.createdAt     || "",
    updatedAt:     d.updatedAt     || "",
    createdBy:     d.createdBy     || "",
  };
}

function docToTemplate(snap) {
  const d  = snap.data ? snap.data() : snap;
  const id = snap.id   || d.templateId || "";
  return {
    templateId:        d.templateId        || id,
    templateName:      d.templateName      || "",
    feeType:           d.feeType           || "",
    amount:            parseAmount(d.amount),
    billingCycle:      d.billingCycle      || "",
    description:       d.description       || "",
    applicableClasses: d.applicableClasses || [],
    autoGenerate:      d.autoGenerate      || false,
    active:            d.active !== false,
    schoolId:          d.schoolId          || SCHOOL_ID,
    centerId:          d.centerId          || "",
    createdAt:         d.createdAt         || "",
    updatedAt:         d.updatedAt         || "",
  };
}

// ══════════════════════════════════════════════════════════════════
// INVOICES
// ══════════════════════════════════════════════════════════════════

async function getAllInvoices({ schoolId = SCHOOL_ID, centerId, studentId, status } = {}) {
  let q = invCol().where("schoolId", "==", schoolId);
  const snap = await q.get();
  let invoices = snap.docs.map(docToInvoice);

  // In-memory filters to avoid composite index requirements
  if (centerId)  invoices = invoices.filter(i => i.centerId  === centerId);
  if (studentId) invoices = invoices.filter(i => i.studentId === studentId);
  if (status)    invoices = invoices.filter(i => i.status    === status);

  invoices.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return invoices;
}

async function getInvoice(invoiceNumber, { schoolId = SCHOOL_ID } = {}) {
  const snap = await invCol()
    .where("schoolId",      "==", schoolId)
    .where("invoiceNumber", "==", invoiceNumber)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return docToInvoice(snap.docs[0]);
}

async function createInvoice(data, { schoolId = SCHOOL_ID, centerId, actorUserId = "system" } = {}) {
  const invoiceId     = genInvId();
  const invoiceNumber = data.invoiceNumber || genInvoiceNumber();
  const amount        = parseAmount(data.amount);
  const gst           = parseAmount(data.gst);
  const discount      = parseAmount(data.discount);
  const totalAmount   = amount + gst - discount;
  const paidAmount    = 0;
  const balance       = totalAmount;
  const status        = computeStatus(totalAmount, paidAmount, data.dueDate, "Pending");
  const resolvedCenter = centerId || data.centerId || data.center || "";

  const doc = {
    invoiceId, invoiceNumber,
    studentId:      data.studentId      || data.student_id     || "",
    studentName:    data.studentName    || data.student_name   || "",
    class:          data.class          || data.studentClass   || "",
    feeType:        data.feeType        || data.feesType       || "",
    billingCycle:   data.billingCycle   || "",
    durationFrom:   data.durationFrom   || "",
    durationTo:     data.durationTo     || "",
    invoiceDate:    data.invoiceDate    || nowStr().slice(0, 10),
    dueDate:        data.dueDate        || "",
    amount, gst, discount, totalAmount, paidAmount, balance, status,
    fatherWhatsApp: data.fatherWhatsApp || "",
    motherWhatsApp: data.motherWhatsApp || "",
    notes:          data.notes          || "",
    schoolId,
    centerId:       resolvedCenter,
    center:         resolvedCenter,
    createdAt:      nowStr(),
    updatedAt:      nowStr(),
    createdBy:      actorUserId,
  };

  await invCol().doc(invoiceId).set(doc);
  return doc;
}

async function updateInvoice(invoiceNumber, data, { schoolId = SCHOOL_ID, actorUserId = "system" } = {}) {
  const snap = await invCol()
    .where("schoolId",      "==", schoolId)
    .where("invoiceNumber", "==", invoiceNumber)
    .limit(1)
    .get();
  if (snap.empty) return null;

  const ref      = snap.docs[0].ref;
  const existing = docToInvoice(snap.docs[0]);

  const amount      = data.amount   !== undefined ? parseAmount(data.amount)   : existing.amount;
  const gst         = data.gst      !== undefined ? parseAmount(data.gst)      : existing.gst;
  const discount    = data.discount !== undefined ? parseAmount(data.discount) : existing.discount;
  const totalAmount = amount + gst - discount;
  const paidAmount  = existing.paidAmount;
  const balance     = totalAmount - paidAmount;
  const dueDate     = data.dueDate !== undefined ? data.dueDate : existing.dueDate;
  const status      = computeStatus(totalAmount, paidAmount, dueDate, data.status || existing.status);

  const updates = {
    studentId:      data.studentId    !== undefined ? data.studentId    : existing.studentId,
    studentName:    data.studentName  !== undefined ? data.studentName  : existing.studentName,
    class:          data.class        !== undefined ? data.class        : existing.class,
    feeType:        data.feeType      !== undefined ? data.feeType      : existing.feeType,
    billingCycle:   data.billingCycle !== undefined ? data.billingCycle : existing.billingCycle,
    durationFrom:   data.durationFrom !== undefined ? data.durationFrom : existing.durationFrom,
    durationTo:     data.durationTo   !== undefined ? data.durationTo   : existing.durationTo,
    invoiceDate:    data.invoiceDate  !== undefined ? data.invoiceDate  : existing.invoiceDate,
    dueDate,
    amount, gst, discount, totalAmount, paidAmount, balance, status,
    fatherWhatsApp: data.fatherWhatsApp !== undefined ? data.fatherWhatsApp : existing.fatherWhatsApp,
    motherWhatsApp: data.motherWhatsApp !== undefined ? data.motherWhatsApp : existing.motherWhatsApp,
    notes:          data.notes          !== undefined ? data.notes          : existing.notes,
    updatedAt:      nowStr(),
    updatedBy:      actorUserId,
  };

  await ref.update(updates);
  return { ...existing, ...updates };
}

async function deleteInvoice(invoiceNumber, { schoolId = SCHOOL_ID } = {}) {
  const snap = await invCol()
    .where("schoolId",      "==", schoolId)
    .where("invoiceNumber", "==", invoiceNumber)
    .limit(1)
    .get();
  if (snap.empty) return false;
  await snap.docs[0].ref.delete();
  return true;
}

// ══════════════════════════════════════════════════════════════════
// PAYMENTS
// ══════════════════════════════════════════════════════════════════

async function getAllPayments(invoiceNumber, { schoolId = SCHOOL_ID, centerId, studentId } = {}) {
  let q = payCol().where("schoolId", "==", schoolId);
  if (invoiceNumber) q = q.where("invoiceNumber", "==", invoiceNumber);
  const snap    = await q.get();
  let payments  = snap.docs.map(docToPayment);

  if (centerId)  payments = payments.filter(p => p.centerId  === centerId);
  if (studentId) payments = payments.filter(p => p.studentId === studentId);

  payments.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return payments;
}

async function recordPayment(data, { schoolId = SCHOOL_ID, centerId, actorUserId = "system" } = {}) {
  const paymentId      = genPayId();
  const amount         = parseAmount(data.amount);
  const resolvedCenter = centerId || data.centerId || data.center || "";

  const payDoc = {
    paymentId,
    invoiceNumber:  data.invoiceNumber  || "",
    studentId:      data.studentId      || "",
    studentName:    data.studentName    || "",
    amount,
    paymentMode:    data.paymentMode    || "Cash",
    transactionId:  data.transactionId  || "",
    paymentDate:    data.paymentDate    || nowStr().slice(0, 10),
    notes:          data.notes          || "",
    staffName:      data.staffName      || actorUserId,
    schoolId,
    centerId:       resolvedCenter,
    center:         resolvedCenter,
    createdAt:      nowStr(),
    updatedAt:      nowStr(),
    createdBy:      actorUserId,
  };

  await payCol().doc(paymentId).set(payDoc);
  const updatedInv = await _recalcInvoicePaid(data.invoiceNumber, schoolId);
  return { payment: payDoc, invoice: updatedInv };
}

async function _recalcInvoicePaid(invoiceNumber, schoolId = SCHOOL_ID) {
  if (!invoiceNumber) return null;

  const allPay    = await getAllPayments(invoiceNumber, { schoolId });
  const totalPaid = allPay.reduce((s, p) => s + p.amount, 0);

  const snap = await invCol()
    .where("schoolId",      "==", schoolId)
    .where("invoiceNumber", "==", invoiceNumber)
    .limit(1)
    .get();
  if (snap.empty) return null;

  const ref = snap.docs[0].ref;
  const inv = docToInvoice(snap.docs[0]);

  const balance = inv.totalAmount - totalPaid;
  const status  = computeStatus(inv.totalAmount, totalPaid, inv.dueDate, inv.status);

  await ref.update({ paidAmount: totalPaid, balance, status, updatedAt: nowStr() });
  return { ...inv, paidAmount: totalPaid, balance, status };
}

// ══════════════════════════════════════════════════════════════════
// FEE TEMPLATES
// ══════════════════════════════════════════════════════════════════

async function getAllTemplates({ schoolId = SCHOOL_ID, centerId, active } = {}) {
  let q = tplCol().where("schoolId", "==", schoolId);
  const snap    = await q.get();
  let templates = snap.docs.map(docToTemplate);

  if (centerId !== undefined) templates = templates.filter(t => !t.centerId || t.centerId === centerId);
  if (active   !== undefined) templates = templates.filter(t => t.active === active);

  templates.sort((a, b) => a.templateName.localeCompare(b.templateName));
  return templates;
}

async function createTemplate(data, { schoolId = SCHOOL_ID, centerId, actorUserId = "system" } = {}) {
  const templateId     = genTplId();
  const resolvedCenter = centerId || data.centerId || "";
  const doc = {
    templateId,
    templateName:      (data.templateName || "").trim(),
    feeType:           data.feeType        || "",
    amount:            parseAmount(data.amount),
    billingCycle:      data.billingCycle   || "",
    description:       data.description   || "",
    applicableClasses: Array.isArray(data.applicableClasses) ? data.applicableClasses : [],
    autoGenerate:      Boolean(data.autoGenerate),
    active:            true,
    schoolId,
    centerId:          resolvedCenter,
    createdAt:         nowStr(),
    updatedAt:         nowStr(),
    createdBy:         actorUserId,
  };
  await tplCol().doc(templateId).set(doc);
  return doc;
}

async function updateTemplate(templateId, data, { actorUserId = "system" } = {}) {
  const ref  = tplCol().doc(templateId);
  const snap = await ref.get();
  if (!snap.exists) return null;

  const updates = { updatedAt: nowStr(), updatedBy: actorUserId };
  if (data.templateName      !== undefined) updates.templateName      = data.templateName;
  if (data.feeType           !== undefined) updates.feeType           = data.feeType;
  if (data.amount            !== undefined) updates.amount            = parseAmount(data.amount);
  if (data.billingCycle      !== undefined) updates.billingCycle      = data.billingCycle;
  if (data.description       !== undefined) updates.description       = data.description;
  if (data.applicableClasses !== undefined) updates.applicableClasses = data.applicableClasses;
  if (data.autoGenerate      !== undefined) updates.autoGenerate      = Boolean(data.autoGenerate);
  if (data.active            !== undefined) updates.active            = Boolean(data.active);

  await ref.update(updates);
  return docToTemplate({ ...snap, data: () => ({ ...snap.data(), ...updates }) });
}

async function deleteTemplate(templateId) {
  const ref  = tplCol().doc(templateId);
  const snap = await ref.get();
  if (!snap.exists) return false;
  await ref.delete();
  return true;
}

module.exports = {
  // Invoices
  getAllInvoices, getInvoice, createInvoice, updateInvoice, deleteInvoice,
  // Payments
  getAllPayments, recordPayment,
  // Fee Templates
  getAllTemplates, createTemplate, updateTemplate, deleteTemplate,
  // Helpers (exported for tests)
  computeStatus, parseAmount, parseDate,
};
