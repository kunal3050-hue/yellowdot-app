/**
 * designationRoutes.js — Designations REST API
 * ──────────────────────────────────────────────
 * GET    /api/designations
 * GET    /api/designations/:designationId
 * POST   /api/designations
 * PUT    /api/designations/:designationId
 * DELETE /api/designations/:designationId
 */

const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/designationController");
const { authenticate, authorizeRoute, staffOnly } = require("../middleware/authMiddleware");

const ROUTE_KEY = "designations";
const canView   = [authenticate, staffOnly, authorizeRoute(ROUTE_KEY)];
const canMutate = [authenticate, staffOnly, authorizeRoute(ROUTE_KEY)];

router.get   ("/api/designations",                   ...canView,   ctrl.list);
router.get   ("/api/designations/:designationId",    ...canView,   ctrl.getOne);
router.post  ("/api/designations",                   ...canMutate, ctrl.create);
router.put   ("/api/designations/:designationId",    ...canMutate, ctrl.update);
router.delete("/api/designations/:designationId",    ...canMutate, ctrl.remove);

module.exports = router;
