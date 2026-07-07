/**
 * leaveRoutes.js — Leave Management REST API
 *
 * /api/leave-types                 Master types (admin/center-admin only)
 * /api/leave-balances              Per-staff yearly balances
 * /api/leave-requests              Applied leave records (apply / approve / reject / cancel)
 * /api/leave-calendar              Team calendar feed (approved + pending + holidays)
 * /api/leave-dashboard             KPIs for the leave dashboard
 * /api/leave-reports               Annual leave consumption per staff
 */

const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/leaveController");
const { authenticate, authorizeRoute, staffOnly } = require("../middleware/authMiddleware");

const VIEW    = "staff-leave";
const APPROVE = "staff-leave-approve";
const TYPES   = "staff-leave-types";

const canView    = [authenticate, staffOnly, authorizeRoute(VIEW)];
const canApprove = [authenticate, staffOnly, authorizeRoute(APPROVE)];
const canTypes   = [authenticate, staffOnly, authorizeRoute(TYPES)];

// Types
router.get   ("/api/leave-types",      ...canView,  ctrl.listTypes);
router.post  ("/api/leave-types",      ...canTypes, ctrl.createType);
router.put   ("/api/leave-types/:id",  ...canTypes, ctrl.updateType);
router.delete("/api/leave-types/:id",  ...canTypes, ctrl.removeType);

// Balances
router.get("/api/leave-balances/me",                  authenticate, staffOnly, ctrl.myBalances);
router.get("/api/leave-balances/staff/:staffId",      ...canView,   ctrl.listBalances);
router.get("/api/leave-balances",                     ...canView,   ctrl.listBalances);

// Requests
router.get   ("/api/leave-requests",              ...canView,    ctrl.listRequests);
router.post  ("/api/leave-requests",              authenticate, staffOnly, ctrl.createRequest);
router.get   ("/api/leave-requests/:id",          ...canView,    ctrl.getRequest);
router.post  ("/api/leave-requests/:id/approve",  ...canApprove, ctrl.approveRequest);
router.post  ("/api/leave-requests/:id/reject",   ...canApprove, ctrl.rejectRequest);
router.post  ("/api/leave-requests/:id/cancel",   authenticate, staffOnly, ctrl.cancelRequest);
router.delete("/api/leave-requests/:id",          ...canApprove, ctrl.removeRequest);

// Aggregates
router.get("/api/leave-calendar",  ...canView, ctrl.calendar);
router.get("/api/leave-dashboard", ...canView, ctrl.dashboard);
router.get("/api/leave-reports",   ...canView, ctrl.report);

module.exports = router;
