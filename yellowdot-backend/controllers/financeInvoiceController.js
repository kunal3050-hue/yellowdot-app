/**
 * financeInvoiceController.js — HTTP handlers for Finance Foundation
 * invoices (source: "billingPlan"). Read-only from this controller's
 * perspective — creation only ever happens via financeBillingEngineController
 * (generate-invoice), never directly. No route/controller pair existed for
 * this before — financeInvoiceService's listForStudent/getInvoice were only
 * ever called from tests. Additive: does not touch the legacy manual
 * invoice flow (invoiceService.js / invoiceController.js / /api/invoices).
 */
const invoiceSvc = require("../services/financeInvoiceService");
const { resolveContext } = require("../middleware/requestScope");

function _err(res, route, err) {
  console.error(`[${route}]`, err.message);
  res.status(500).json({ success: false, error: err.message || "Server error." });
}

async function list(req, res) {
  try {
    const { schoolId } = resolveContext(req);
    const { studentId, status } = req.query;
    const invoices = studentId
      ? await invoiceSvc.listForStudent(studentId, { schoolId })
      : await invoiceSvc.listForSchool({ schoolId, status });
    res.json({ success: true, invoices, total: invoices.length });
  } catch (err) { _err(res, "GET /api/finance/invoices", err); }
}

async function getOne(req, res) {
  try {
    const { schoolId } = resolveContext(req);
    const invoice = await invoiceSvc.getInvoice(req.params.invoiceId, { schoolId });
    if (!invoice) return res.status(404).json({ success: false, error: "Invoice not found." });
    res.json({ success: true, invoice });
  } catch (err) { _err(res, "GET /api/finance/invoices/:invoiceId", err); }
}

module.exports = { list, getOne };
