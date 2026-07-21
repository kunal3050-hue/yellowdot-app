/**
 * ledgerRoutes.js — Student Ledger + Ledger Entry REST API (Finance Foundation, Sprint 1)
 * ────────────────────────────────────────────────────────────────────
 * POST /api/finance/ledgers                        Create a ledger for a student
 * GET  /api/finance/ledgers/:studentId              Fetch a student's ledger
 * PUT  /api/finance/ledgers/:studentId/status       Freeze/archive a ledger
 * GET  /api/finance/ledgers/:studentId/entries      List entries (Financial Timeline data)
 * POST /api/finance/ledgers/:studentId/entries      Post a manual entry (adjustment)
 *
 * Gated behind FINANCE_FOUNDATION_ENABLED (see middleware/financeFoundationFlag.js)
 * — disabled by default, so this module has zero effect on the running
 * application until explicitly turned on for a rollout.
 *
 * Permission: "finance-foundation" route key (admin, center_owner, center_admin,
 * accountant, plus bypass roles) — a single umbrella key for this sprint since
 * there is no UI yet to gate per sub-module; can be split into finer-grained
 * keys once real screens consume these endpoints.
 */
const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/studentLedgerController");
const { authenticate, authorizeRoute, staffOnly } = require("../middleware/authMiddleware");
const { requireFinanceFoundationFlag } = require("../middleware/financeFoundationFlag");

const KEY = "finance-foundation";
const guard = [requireFinanceFoundationFlag, authenticate, staffOnly, authorizeRoute(KEY)];

router.post("/api/finance/ledgers",                       ...guard, ctrl.createLedger);
router.get("/api/finance/ledgers/:studentId",              ...guard, ctrl.getLedger);
router.put("/api/finance/ledgers/:studentId/status",       ...guard, ctrl.setLedgerStatus);
router.get("/api/finance/ledgers/:studentId/entries",      ...guard, ctrl.listEntries);
router.post("/api/finance/ledgers/:studentId/entries",     ...guard, ctrl.createEntry);

module.exports = router;
