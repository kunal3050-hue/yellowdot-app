/**
 * studentLedgerController.js — HTTP handlers for Student Ledger + Ledger Entry
 * ────────────────────────────────────────────────────────────────────
 * Thin wrappers, mirrors staffController.js's shape. Assumes authenticate +
 * staffOnly + authorizeRoute already ran (router-level).
 */
const ledgerSvc      = require("../services/studentLedgerService");
const ledgerEntrySvc = require("../services/ledgerEntryService");
const { resolveContext } = require("../middleware/requestScope");

function _err(res, route, err) {
  let code = 500;
  if (err.code === "VALIDATION") code = 400;
  if (err.code === "NOT_FOUND")  code = 404;
  console.error(`[${route}]`, err.message);
  res.status(code).json({ success: false, error: err.message || "Server error." });
}

async function createLedger(req, res) {
  try {
    const { schoolId, centerId, actorUserId } = resolveContext(req);
    const { studentId, familyId } = req.body;
    const ledger = await ledgerSvc.createLedger(studentId, { schoolId, centerId, familyId, actorUserId });
    res.json({ success: true, ledger });
  } catch (err) { _err(res, "POST /api/finance/ledgers", err); }
}

async function getLedger(req, res) {
  try {
    const { schoolId } = resolveContext(req);
    const ledger = await ledgerSvc.getLedger(req.params.studentId, { schoolId });
    if (!ledger) return res.status(404).json({ success: false, error: "Ledger not found." });
    res.json({ success: true, ledger });
  } catch (err) { _err(res, "GET /api/finance/ledgers/:studentId", err); }
}

async function setLedgerStatus(req, res) {
  try {
    const { schoolId, actorUserId } = resolveContext(req);
    const ledger = await ledgerSvc.setStatus(req.params.studentId, req.body.status, { schoolId, actorUserId });
    if (!ledger) return res.status(404).json({ success: false, error: "Ledger not found." });
    res.json({ success: true, ledger });
  } catch (err) { _err(res, "PUT /api/finance/ledgers/:studentId/status", err); }
}

async function listEntries(req, res) {
  try {
    const { schoolId } = resolveContext(req);
    const entries = await ledgerSvc.listEntries(req.params.studentId, { schoolId, limit: Number(req.query.limit) || 100 });
    res.json({ success: true, entries, total: entries.length });
  } catch (err) { _err(res, "GET /api/finance/ledgers/:studentId/entries", err); }
}

async function createEntry(req, res) {
  try {
    const { schoolId, centerId, actorUserId } = resolveContext(req);
    const { entry, newBalance } = await ledgerEntrySvc.createEntry(req.params.studentId, req.body, { schoolId, centerId, actorUserId });
    res.json({ success: true, entry, newBalance });
  } catch (err) { _err(res, "POST /api/finance/ledgers/:studentId/entries", err); }
}

module.exports = { createLedger, getLedger, setLedgerStatus, listEntries, createEntry };
