/**
 * performanceRoutes.js — Performance Management REST API
 */

const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/performanceController");
const { authenticate, authorizeRoute, staffOnly } = require("../middleware/authMiddleware");

const VIEW    = "staff-performance";
const MANAGE  = "staff-performance-manage";

const canView   = [authenticate, staffOnly, authorizeRoute(VIEW)];
const canManage = [authenticate, staffOnly, authorizeRoute(MANAGE)];

// KPIs
router.get   ("/api/performance-kpis",      ...canView,   ctrl.listKpis);
router.post  ("/api/performance-kpis",      ...canManage, ctrl.createKpi);
router.put   ("/api/performance-kpis/:id",  ...canManage, ctrl.updateKpi);
router.delete("/api/performance-kpis/:id",  ...canManage, ctrl.removeKpi);

// Reviews
router.get   ("/api/performance-reviews",       ...canView,   ctrl.listReviews);
router.get   ("/api/performance-reviews/:id",   ...canView,   ctrl.getReview);
router.post  ("/api/performance-reviews",       ...canManage, ctrl.upsertReview);
router.delete("/api/performance-reviews/:id",   ...canManage, ctrl.removeReview);

// Goals
router.get   ("/api/performance-goals",         ...canView,   ctrl.listGoals);
router.post  ("/api/performance-goals",         ...canManage, ctrl.upsertGoal);
router.delete("/api/performance-goals/:id",     ...canManage, ctrl.removeGoal);

// Parent Feedback
router.get   ("/api/parent-feedback",                          ...canView,   ctrl.listFeedback);
router.post  ("/api/parent-feedback",                          ...canManage, ctrl.createFeedback);
router.delete("/api/parent-feedback/:id",                      ...canManage, ctrl.removeFeedback);
router.get   ("/api/parent-feedback/staff/:staffId/summary",   ...canView,   ctrl.feedbackSummary);

// Promotions
router.get   ("/api/staff-promotions",       ...canView,   ctrl.listPromotions);
router.post  ("/api/staff-promotions",       ...canManage, ctrl.createPromotion);
router.delete("/api/staff-promotions/:id",   ...canManage, ctrl.removePromotion);

// Awards
router.get   ("/api/staff-awards",           ...canView,   ctrl.listAwards);
router.post  ("/api/staff-awards",           ...canManage, ctrl.createAward);
router.delete("/api/staff-awards/:id",       ...canManage, ctrl.removeAward);

// Timeline + dashboard + AI summary
router.get("/api/performance-timeline/:staffId",     ...canView, ctrl.timelineFor);
router.get("/api/performance-dashboard",             ...canView, ctrl.dashboard);
router.get("/api/performance-ai-summary/:staffId",   ...canView, ctrl.aiSummary);

module.exports = router;
