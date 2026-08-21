/**
 * financeRoutes.js — fees, invoices and payments API
 * ─────────────────────────────────────────────────────────────────
 *   GET    /api/fee-templates
 *   POST   /api/fee-templates
 *   PUT    /api/fee-templates/:templateId
 *   DELETE /api/fee-templates/:templateId
 *
 *   GET    /api/invoices                 ?studentId=&status=&period=
 *   POST   /api/invoices
 *   DELETE /api/invoices/:invoiceId
 *
 *   GET    /api/payments                 ?studentId=&invoiceId=
 *   POST   /api/payments
 *
 *   GET    /api/finance/summary          per-student balances + totals
 *   POST   /api/finance/generate         raise this period's invoices
 *
 * Staff-only throughout. Parents never reach these: they read their own
 * children's fees through GET /api/parent/fees, which enforces ownership
 * against parents.studentIds.
 *
 * The GET /api/invoices and GET /api/payments response envelopes are
 * deliberately unchanged from the previous module — LiveDashboard, the
 * Control Center and the family fees summary consume them directly.
 */

const express = require("express");
const router  = express.Router();

const { authenticate, staffOnly } = require("../middleware/authMiddleware");
const { resolveContext }          = require("../middleware/requestScope");
const finance                     = require("../services/financeService");

const WRITE_ROLES = new Set(["admin", "center_admin", "center_owner", "accountant", "super_admin", "developer"]);

// Every route below is staff-only.
router.use(["/api/fee-templates", "/api/invoices", "/api/payments", "/api/finance"],
  authenticate, staffOnly);

function canWrite(req, res) {
  if (WRITE_ROLES.has(req.user?.role)) return true;
  res.status(403).json({ success: false, error: "You do not have permission to change finance records." });
  return false;
}

/** Map a service error to the right status code instead of a blanket 500. */
function fail(res, label, e) {
  const status = e.code === "VALIDATION" ? 400 : e.code === "NOT_FOUND" ? 404 : 500;
  if (status === 500) console.error(`[${label}]`, e.message);
  res.status(status).json({ success: false, error: e.message });
}

// ── Fee templates ──────────────────────────────────────────────────

router.get("/api/fee-templates", async (req, res) => {
  try {
    const { schoolId } = resolveContext(req);
    const templates = await finance.listTemplates({
      schoolId,
      activeOnly: req.query.active === "true",
    });
    res.json({ success: true, templates });
  } catch (e) { fail(res, "GET /api/fee-templates", e); }
});

router.post("/api/fee-templates", async (req, res) => {
  if (!canWrite(req, res)) return;
  try {
    const { schoolId, actorUserId } = resolveContext(req);
    const template = await finance.createTemplate(req.body || {}, { schoolId, actorUserId });
    res.json({ success: true, template });
  } catch (e) { fail(res, "POST /api/fee-templates", e); }
});

router.put("/api/fee-templates/:templateId", async (req, res) => {
  if (!canWrite(req, res)) return;
  try {
    const { actorUserId } = resolveContext(req);
    const template = await finance.updateTemplate(req.params.templateId, req.body || {}, { actorUserId });
    if (!template) return res.status(404).json({ success: false, error: "Template not found." });
    res.json({ success: true, template });
  } catch (e) { fail(res, "PUT /api/fee-templates/:templateId", e); }
});

router.delete("/api/fee-templates/:templateId", async (req, res) => {
  if (!canWrite(req, res)) return;
  try {
    const ok = await finance.deleteTemplate(req.params.templateId);
    if (!ok) return res.status(404).json({ success: false, error: "Template not found." });
    res.json({ success: true });
  } catch (e) { fail(res, "DELETE /api/fee-templates/:templateId", e); }
});

// ── Invoices ───────────────────────────────────────────────────────

router.get("/api/invoices", async (req, res) => {
  try {
    const { schoolId } = resolveContext(req);
    const invoices = await finance.listInvoices({
      schoolId,
      studentId: req.query.studentId,
      status:    req.query.status,
      period:    req.query.period,
    });
    res.json({ success: true, invoices });
  } catch (e) { fail(res, "GET /api/invoices", e); }
});

router.post("/api/invoices", async (req, res) => {
  if (!canWrite(req, res)) return;
  try {
    const { schoolId, centerId, actorUserId } = resolveContext(req);
    const invoice = await finance.createInvoice(req.body || {}, { schoolId, centerId, actorUserId });
    res.json({ success: true, invoice });
  } catch (e) { fail(res, "POST /api/invoices", e); }
});

router.delete("/api/invoices/:invoiceId", async (req, res) => {
  if (!canWrite(req, res)) return;
  try {
    const { schoolId } = resolveContext(req);
    const ok = await finance.deleteInvoice(req.params.invoiceId, { schoolId });
    if (!ok) return res.status(404).json({ success: false, error: "Invoice not found." });
    res.json({ success: true });
  } catch (e) { fail(res, "DELETE /api/invoices/:invoiceId", e); }
});

// ── Payments ───────────────────────────────────────────────────────

router.get("/api/payments", async (req, res) => {
  try {
    const { schoolId } = resolveContext(req);
    const payments = await finance.listPayments({
      schoolId,
      studentId: req.query.studentId,
      invoiceId: req.query.invoiceId,
    });
    res.json({ success: true, payments });
  } catch (e) { fail(res, "GET /api/payments", e); }
});

router.post("/api/payments", async (req, res) => {
  if (!canWrite(req, res)) return;
  try {
    const { schoolId, centerId, actorUserId } = resolveContext(req);
    // Returns the updated invoice too — the caller never has to re-fetch to
    // find out whether this payment settled it.
    const { payment, invoice } = await finance.recordPayment(req.body || {}, { schoolId, centerId, actorUserId });
    res.json({ success: true, payment, invoice });
  } catch (e) { fail(res, "POST /api/payments", e); }
});

// ── Overview + generation ──────────────────────────────────────────

router.get("/api/finance/summary", async (req, res) => {
  try {
    const { schoolId } = resolveContext(req);
    const { totals, rows } = await finance.studentSummary({ schoolId });
    res.json({ success: true, totals, rows });
  } catch (e) { fail(res, "GET /api/finance/summary", e); }
});

router.post("/api/finance/generate", async (req, res) => {
  if (!canWrite(req, res)) return;
  try {
    const { schoolId, actorUserId } = resolveContext(req);
    const result = await finance.generateForPeriod({
      schoolId,
      period:  (req.body && req.body.period)  || undefined,
      dryRun:  !!(req.body && req.body.dryRun),
      actorUserId,
    });
    res.json({ success: true, ...result });
  } catch (e) { fail(res, "POST /api/finance/generate", e); }
});

module.exports = router;
