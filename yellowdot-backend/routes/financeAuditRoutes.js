/**
 * financeAuditRoutes.js — Finance Audit Log REST API (read-only)
 * ────────────────────────────────────────────────────────────────────
 * GET /api/finance/audit-logs?actorUserId=&entityType=&entityId=&action=&dateFrom=&dateTo=&limit=
 *   Lists financeAuditLogs entries for the caller's school, filterable.
 *   Wraps the existing financeAuditService (already written to by every
 *   Finance Foundation service since Sprint 1) — no new logging logic,
 *   this is purely a read surface for a screen that didn't exist before.
 *
 * Gated behind FINANCE_FOUNDATION_ENABLED, same as every other Finance
 * Foundation route. financeAuditLogs is write:false at the Firestore-rules
 * layer already — this route only ever reads.
 */
const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/financeAuditController");
const { authenticate, authorizeRoute, staffOnly } = require("../middleware/authMiddleware");
const { requireFinanceFoundationFlag } = require("../middleware/financeFoundationFlag");

const KEY = "finance-foundation";
const guard = [requireFinanceFoundationFlag, authenticate, staffOnly, authorizeRoute(KEY)];

router.get("/api/finance/audit-logs", ...guard, ctrl.list);

module.exports = router;
