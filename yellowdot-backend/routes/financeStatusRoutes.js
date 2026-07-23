/**
 * financeStatusRoutes.js — GET /api/finance/status
 * ─────────────────────────────────────────────────────────────────────────
 * Registered unconditionally in server.js (not inside the
 * FINANCE_FOUNDATION_ENABLED block) — this is the one Finance route that
 * must exist even while the module is disabled, so the frontend can detect
 * "disabled" as a real answer rather than a 404 on a route that doesn't
 * exist. `authenticate` only — no route-level RBAC, since a boolean
 * enablement flag carries no data worth restricting further.
 */
const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/financeStatusController");
const { authenticate } = require("../middleware/authMiddleware");

router.get("/api/finance/status", authenticate, ctrl.getStatus);

module.exports = router;
