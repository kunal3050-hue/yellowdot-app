/**
 * billingRoutes.js — Billing & Payments · API routes
 *
 * Staff endpoints (authenticate + blockUnknown + staffOnly on every one):
 *   GET    /api/billing/summary                       — the KPI row
 *   GET    /api/billing/outstanding                   — who owes what, per child and per family
 *   GET    /api/billing/settings                      — UPI payee + receipt details
 *   PUT    /api/billing/settings                      — (admin tier)
 *   GET    /api/billing/audit                         — the money trail (admin tier)
 *
 *   GET    /api/billing/plans                         — the fee catalogue
 *   POST   /api/billing/plans                         — (billing tier)
 *   PATCH  /api/billing/plans/:planId                 — (billing tier)
 *   DELETE /api/billing/plans/:planId                 — deactivate (billing tier)
 *
 *   GET    /api/billing/invoices                      ?studentId=&familyId=&status=&period=
 *   POST   /api/billing/invoices                      — raise one, itemised (billing tier)
 *   POST   /api/billing/invoices/generate             — the monthly run (billing tier)
 *   GET    /api/billing/invoices/:invoiceId           — invoice + its payments
 *   POST   /api/billing/invoices/:invoiceId/void      — (admin tier, reason required)
 *   POST   /api/billing/invoices/:invoiceId/credit-note — (admin tier, reason required)
 *
 *   GET    /api/billing/payments                      ?studentId=&invoiceId=
 *   POST   /api/billing/payments                      — record money received (collect tier)
 *   POST   /api/billing/payments/:paymentId/reverse   — (admin tier, reason required)
 *   GET    /api/billing/receipts/:paymentId           — the receipt payload
 *
 * Parent endpoint (authenticate + blockUnknown + requireOwnChild):
 *   GET    /api/parent/billing                        — own child's bills and receipts
 *
 * ── Mount order matters ───────────────────────────────────────────────────────
 * parentRoutes applies a blanket `router.use("/api/parent", authenticate,
 * blockUnknown, parentOnly)` across the whole prefix. This router owns
 * /api/parent/billing and guards it with requireOwnChild, so it MUST be mounted
 * before parentRoutes or that blanket guard lands in front of the handler.
 * journeyRoutes and notificationRoutes carry the same requirement and say so;
 * test/routeMountsRegistered.test.js asserts all four orderings.
 *
 * ── Four tiers of guard ───────────────────────────────────────────────────────
 * Reading what a family owes is front-desk work — Reception answers "how much
 * do I owe?" at pickup, and the PRD gives them that plus recording the payment
 * they just took. Raising invoices and editing the catalogue is the billing
 * tier (which includes the accountant role). Unwinding money — voiding an
 * invoice, crediting one, reversing a payment — plus reading the audit trail
 * and changing the payee is admin-only: whoever takes money should not be the
 * one who can quietly un-take it. `authorize` lets the bypass roles
 * (developer, super_admin) through, as everywhere else in the app.
 *
 * Teachers get nothing here. A classroom role has no business reading a
 * family's balance, and the PRD's teacher row says the same.
 */

const express = require("express");
const router  = express.Router();

const billing = require("../services/billingService");
const audit   = require("../services/billingAuditService");
const {
  authenticate, authorize, blockUnknown, staffOnly, requireOwnChild,
} = require("../middleware/authMiddleware");

const SCHOOL_ID = process.env.SCHOOL_ID || "ydseawoods";

/** Reads what a family owes, and records money taken at the desk. */
const COLLECT_ROLES = ["admin", "center_admin", "center_owner", "accountant", "reception"];
/** Raises invoices and maintains the fee catalogue. */
const BILLING_ROLES = ["admin", "center_admin", "center_owner", "accountant"];
/** Unwinds money, reads the audit trail, changes the payee. */
const ADMIN_ROLES   = ["admin", "center_admin", "center_owner"];

// Guard stacks, built once rather than repeated per route, so a new endpoint
// cannot be added without one.
const readGate    = [authenticate, blockUnknown, staffOnly, authorize(...COLLECT_ROLES)];
const collectGate = [authenticate, blockUnknown, staffOnly, authorize(...COLLECT_ROLES)];
const billingGate = [authenticate, blockUnknown, staffOnly, authorize(...BILLING_ROLES)];
const adminGate   = [authenticate, blockUnknown, staffOnly, authorize(...ADMIN_ROLES)];
const parentGate  = [authenticate, blockUnknown, requireOwnChild];

function resolveCtx(req) {
  return {
    schoolId:    req.user?.schoolId || SCHOOL_ID,
    centerId:    req.user?.centerId || "",
    actorUserId: req.user?.userId   || "system",
  };
}

/**
 * Map a BillingError onto its own status; anything else is a 500 whose detail
 * stays in the log rather than going to the client.
 */
function sendError(res, err) {
  if (err && err.name === "BillingError") {
    return res.status(err.status || 400).json({ success: false, error: err.message, code: err.code });
  }
  console.error("[billing]", err);
  return res.status(500).json({ success: false, error: "Could not complete the billing operation." });
}

// ── Dashboard and rollups ────────────────────────────────────────────────────

router.get("/api/billing/summary", ...readGate, async (req, res) => {
  try {
    const { schoolId } = resolveCtx(req);
    const summary = await billing.getSummary({ schoolId, period: req.query.period });
    res.json({ success: true, summary });
  } catch (err) { sendError(res, err); }
});

router.get("/api/billing/outstanding", ...readGate, async (req, res) => {
  try {
    const { schoolId } = resolveCtx(req);
    const result = await billing.getOutstanding({ schoolId });
    res.json({ success: true, ...result });
  } catch (err) { sendError(res, err); }
});

// ── Settings ─────────────────────────────────────────────────────────────────

// Readable by anyone who can take a payment: the UPI payee is what the QR code
// on the collect screen is built from.
router.get("/api/billing/settings", ...readGate, async (req, res) => {
  try {
    const { schoolId } = resolveCtx(req);
    const settings = await billing.getSettings({ schoolId });
    res.json({ success: true, settings });
  } catch (err) { sendError(res, err); }
});

router.put("/api/billing/settings", ...adminGate, async (req, res) => {
  try {
    const settings = await billing.updateSettings(req.body || {}, resolveCtx(req));
    res.json({ success: true, settings });
  } catch (err) { sendError(res, err); }
});

// ── Audit trail ──────────────────────────────────────────────────────────────

router.get("/api/billing/audit", ...adminGate, async (req, res) => {
  try {
    const { schoolId } = resolveCtx(req);
    const { entityType, entityId, action, actorUserId, from, to, limit } = req.query;
    const entries = await audit.listForSchool({
      schoolId, entityType, entityId, action, actorUserId, from, to, limit,
    });
    res.json({ success: true, entries });
  } catch (err) { sendError(res, err); }
});

// ── Fee plans ────────────────────────────────────────────────────────────────

router.get("/api/billing/plans", ...readGate, async (req, res) => {
  try {
    const { schoolId } = resolveCtx(req);
    const { activeOnly, classId, feeType } = req.query;
    const plans = await billing.listPlans({
      schoolId, activeOnly: activeOnly === "true", classId, feeType,
    });
    res.json({ success: true, plans, feeTypes: billing.FEE_TYPES, cadences: billing.CADENCES });
  } catch (err) { sendError(res, err); }
});

router.post("/api/billing/plans", ...billingGate, async (req, res) => {
  try {
    const plan = await billing.createPlan(req.body || {}, resolveCtx(req));
    res.status(201).json({ success: true, plan });
  } catch (err) { sendError(res, err); }
});

router.patch("/api/billing/plans/:planId", ...billingGate, async (req, res) => {
  try {
    const plan = await billing.updatePlan(req.params.planId, req.body || {}, resolveCtx(req));
    res.json({ success: true, plan });
  } catch (err) { sendError(res, err); }
});

// Deactivates rather than deletes — invoice lines reference the plan they were
// raised from, and a parent may reprint one years later.
router.delete("/api/billing/plans/:planId", ...billingGate, async (req, res) => {
  try {
    const plan = await billing.deactivatePlan(req.params.planId, resolveCtx(req));
    res.json({ success: true, plan });
  } catch (err) { sendError(res, err); }
});

// ── Invoices ─────────────────────────────────────────────────────────────────

router.get("/api/billing/invoices", ...readGate, async (req, res) => {
  try {
    const { schoolId } = resolveCtx(req);
    const { studentId, familyId, status, period, from, to, includeVoid } = req.query;
    const invoices = await billing.listInvoices({
      schoolId, studentId, familyId, status, period, from, to,
      includeVoid: includeVoid !== "false",
    });
    res.json({ success: true, invoices });
  } catch (err) { sendError(res, err); }
});

router.post("/api/billing/invoices", ...billingGate, async (req, res) => {
  try {
    const invoice = await billing.createInvoice(req.body || {}, resolveCtx(req));
    res.status(201).json({ success: true, invoice });
  } catch (err) { sendError(res, err); }
});

/**
 * The monthly run. Declared before "/:invoiceId" so "generate" is never
 * swallowed as an invoice id.
 *
 * `dryRun: true` writes nothing and returns exactly what a real run would do,
 * which is how the UI shows the count, the total, who is skipped and who
 * matched no plan before anything is billed.
 */
router.post("/api/billing/invoices/generate", ...billingGate, async (req, res) => {
  try {
    const { period, dueDate, dryRun } = req.body || {};
    const result = await billing.generateForPeriod({
      ...resolveCtx(req), period, dueDate, dryRun: dryRun === true,
    });
    res.json({ success: true, ...result });
  } catch (err) { sendError(res, err); }
});

router.get("/api/billing/invoices/:invoiceId", ...readGate, async (req, res) => {
  try {
    const { schoolId } = resolveCtx(req);
    const result = await billing.getInvoiceWithPayments(req.params.invoiceId, { schoolId });
    res.json({ success: true, ...result });
  } catch (err) { sendError(res, err); }
});

router.post("/api/billing/invoices/:invoiceId/void", ...adminGate, async (req, res) => {
  try {
    const invoice = await billing.voidInvoice(
      req.params.invoiceId, (req.body || {}).reason, resolveCtx(req),
    );
    res.json({ success: true, invoice });
  } catch (err) { sendError(res, err); }
});

router.post("/api/billing/invoices/:invoiceId/credit-note", ...adminGate, async (req, res) => {
  try {
    const { amount, reason } = req.body || {};
    const invoice = await billing.addCreditNote(
      req.params.invoiceId, { amount, reason }, resolveCtx(req),
    );
    res.json({ success: true, invoice });
  } catch (err) { sendError(res, err); }
});

// ── Payments ─────────────────────────────────────────────────────────────────

router.get("/api/billing/payments", ...readGate, async (req, res) => {
  try {
    const { schoolId } = resolveCtx(req);
    const { studentId, invoiceId, familyId, from, to, includeReversed } = req.query;
    const payments = await billing.listPayments({
      schoolId, studentId, invoiceId, familyId, from, to,
      includeReversed: includeReversed !== "false",
    });
    res.json({ success: true, payments, paymentModes: billing.PAYMENT_MODES });
  } catch (err) { sendError(res, err); }
});

/**
 * Record money that has already changed hands. This endpoint never moves
 * money: no payment provider is called from anywhere in this module, and there
 * is no gateway credential in the tree to misuse.
 */
router.post("/api/billing/payments", ...collectGate, async (req, res) => {
  try {
    const result = await billing.recordPayment(req.body || {}, resolveCtx(req));
    res.status(201).json({ success: true, ...result });
  } catch (err) { sendError(res, err); }
});

router.post("/api/billing/payments/:paymentId/reverse", ...adminGate, async (req, res) => {
  try {
    const result = await billing.reversePayment(
      req.params.paymentId, (req.body || {}).reason, resolveCtx(req),
    );
    res.json({ success: true, ...result });
  } catch (err) { sendError(res, err); }
});

/**
 * The printable bill. Distinct from GET /invoices/:id, which serves the
 * management screen - this one carries the school's letterhead, because a
 * document that leaves the building has to say who issued it.
 *
 * Mounted before nothing in particular: "/invoices/:invoiceId" cannot shadow
 * it, since a path parameter matches exactly one segment.
 */
router.get("/api/billing/invoices/:invoiceId/document", ...readGate, async (req, res) => {
  try {
    const { schoolId } = resolveCtx(req);
    const result = await billing.getInvoiceDocument(req.params.invoiceId, { schoolId });
    res.json({ success: true, ...result });
  } catch (err) { sendError(res, err); }
});

router.get("/api/billing/receipts/:paymentId", ...readGate, async (req, res) => {
  try {
    const { schoolId } = resolveCtx(req);
    const result = await billing.getReceipt(req.params.paymentId, { schoolId });
    res.json({ success: true, ...result });
  } catch (err) { sendError(res, err); }
});

// ── Parent ───────────────────────────────────────────────────────────────────

/**
 * One child's bills and receipts.
 *
 * requireOwnChild rejects staff (403) and parents with no linked child (403),
 * and sets req.ownChildId to the server-resolved linked studentId. The route
 * deliberately ignores any studentId in the query: a client-supplied id cannot
 * influence which child's money is returned. Same shape as
 * GET /api/parent/journey, for the same reason.
 */
router.get("/api/parent/billing", ...parentGate, async (req, res) => {
  try {
    const { schoolId } = resolveCtx(req);
    const result = await billing.getForStudent({ schoolId, studentId: req.ownChildId });
    res.json({ success: true, ...result });
  } catch (err) { sendError(res, err); }
});

module.exports = router;
