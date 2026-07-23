/**
 * financeAuditController.js — HTTP handler for the Finance Audit Log (read-only)
 * ────────────────────────────────────────────────────────────────────
 * Thin wrapper, mirrors studentLedgerController.js's shape. Assumes
 * authenticate + staffOnly + authorizeRoute already ran (router-level).
 */
const auditSvc = require("../services/financeAuditService");
const { resolveContext } = require("../middleware/requestScope");

function _err(res, route, err) {
  console.error(`[${route}]`, err.message);
  res.status(500).json({ success: false, error: err.message || "Server error." });
}

async function list(req, res) {
  try {
    const { schoolId } = resolveContext(req);
    const { actorUserId, entityType, entityId, action, dateFrom, dateTo, limit } = req.query;
    const entries = await auditSvc.listForSchool({
      schoolId, actorUserId, entityType, entityId, action, dateFrom, dateTo, limit,
    });
    res.json({ success: true, entries, total: entries.length });
  } catch (err) { _err(res, "GET /api/finance/audit-logs", err); }
}

module.exports = { list };
