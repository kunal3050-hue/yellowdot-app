/**
 * departmentRoutes.js — Departments REST API
 * ────────────────────────────────────────────
 * GET    /api/departments
 * GET    /api/departments/:deptId
 * POST   /api/departments
 * PUT    /api/departments/:deptId
 * DELETE /api/departments/:deptId
 */

const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/departmentController");
const { authenticate, authorizeRoute, staffOnly } = require("../middleware/authMiddleware");

const ROUTE_KEY = "departments";
const canView   = [authenticate, staffOnly, authorizeRoute(ROUTE_KEY)];
const canMutate = [authenticate, staffOnly, authorizeRoute(ROUTE_KEY)];

router.get   ("/api/departments",          ...canView,   ctrl.list);
router.get   ("/api/departments/:deptId",  ...canView,   ctrl.getOne);
router.post  ("/api/departments",          ...canMutate, ctrl.create);
router.put   ("/api/departments/:deptId",  ...canMutate, ctrl.update);
router.delete("/api/departments/:deptId",  ...canMutate, ctrl.remove);

module.exports = router;
