/**
 * performanceController.js — HTTP handlers for Performance Management
 */

const svc = require("../services/performanceService");

function _ctx(req) {
  return {
    schoolId:    req.user?.schoolId || process.env.SCHOOL_ID || "yd-main",
    tenantId:    req.user?.schoolId || process.env.SCHOOL_ID || "yd-main",
    centerId:    req.query?.centerId || req.user?.centerId || "",
    actorUserId: req.user?.userId   || "system",
    actorName:   req.user?.name     || req.user?.email || "Reviewer",
  };
}

function _err(res, route, err) {
  let code = 500;
  if (err.code === "VALIDATION") code = 400;
  if (err.code === "DUPLICATE")  code = 409;
  if (err.code === "IN_USE")     code = 409;
  console.error(`[${route}]`, err.message);
  res.status(code).json({ success: false, error: err.message || "Server error." });
}

// ── KPIs ─────────────────────────────────────────────────────────
async function listKpis(req, res) {
  try { const { schoolId, tenantId } = _ctx(req); const rows = await svc.listKpis({ schoolId, tenantId, active: req.query.active }); res.json({ success: true, kpis: rows }); }
  catch (err) { _err(res, "GET /api/performance-kpis", err); }
}
async function createKpi(req, res) {
  try { const ctx = _ctx(req); const k = await svc.createKpi(req.body, ctx); res.status(201).json({ success: true, kpi: k }); }
  catch (err) { _err(res, "POST /api/performance-kpis", err); }
}
async function updateKpi(req, res) {
  try { const { actorUserId } = _ctx(req); const k = await svc.updateKpi(req.params.id, req.body, { actorUserId }); if (!k) return res.status(404).json({ success: false, error: "KPI not found." }); res.json({ success: true, kpi: k }); }
  catch (err) { _err(res, "PUT /api/performance-kpis/:id", err); }
}
async function removeKpi(req, res) {
  try { const ok = await svc.removeKpi(req.params.id); if (!ok) return res.status(404).json({ success: false, error: "KPI not found." }); res.json({ success: true }); }
  catch (err) { _err(res, "DELETE /api/performance-kpis/:id", err); }
}

// ── Reviews ──────────────────────────────────────────────────────
async function listReviews(req, res) {
  try { const { schoolId } = _ctx(req); const { staffId, period, status } = req.query; const rows = await svc.listReviews({ schoolId, staffId, period, status }); res.json({ success: true, reviews: rows }); }
  catch (err) { _err(res, "GET /api/performance-reviews", err); }
}
async function getReview(req, res) {
  try { const r = await svc.getReview(req.params.id); if (!r) return res.status(404).json({ success: false, error: "Review not found." }); res.json({ success: true, review: r }); }
  catch (err) { _err(res, "GET /api/performance-reviews/:id", err); }
}
async function upsertReview(req, res) {
  try { const ctx = _ctx(req); const r = await svc.upsertReview(req.body, ctx); res.json({ success: true, review: r }); }
  catch (err) { _err(res, "POST /api/performance-reviews", err); }
}
async function removeReview(req, res) {
  try { const { actorUserId } = _ctx(req); const ok = await svc.removeReview(req.params.id, { actorUserId }); if (!ok) return res.status(404).json({ success: false, error: "Review not found." }); res.json({ success: true }); }
  catch (err) { _err(res, "DELETE /api/performance-reviews/:id", err); }
}

// ── Goals ────────────────────────────────────────────────────────
async function listGoals(req, res) {
  try { const { schoolId } = _ctx(req); const { staffId, status, period } = req.query; const rows = await svc.listGoals({ schoolId, staffId, status, period }); res.json({ success: true, goals: rows }); }
  catch (err) { _err(res, "GET /api/performance-goals", err); }
}
async function upsertGoal(req, res) {
  try { const ctx = _ctx(req); const g = await svc.upsertGoal(req.body, ctx); res.json({ success: true, goal: g }); }
  catch (err) { _err(res, "POST /api/performance-goals", err); }
}
async function removeGoal(req, res) {
  try { const { actorUserId } = _ctx(req); const ok = await svc.removeGoal(req.params.id, { actorUserId }); if (!ok) return res.status(404).json({ success: false, error: "Goal not found." }); res.json({ success: true }); }
  catch (err) { _err(res, "DELETE /api/performance-goals/:id", err); }
}

// ── Parent Feedback ──────────────────────────────────────────────
async function listFeedback(req, res) {
  try { const { schoolId } = _ctx(req); const { staffId, periodKey } = req.query; const rows = await svc.listFeedback({ schoolId, staffId, periodKey }); res.json({ success: true, feedback: rows }); }
  catch (err) { _err(res, "GET /api/parent-feedback", err); }
}
async function createFeedback(req, res) {
  try { const ctx = _ctx(req); const f = await svc.createFeedback(req.body, ctx); res.status(201).json({ success: true, feedback: f }); }
  catch (err) { _err(res, "POST /api/parent-feedback", err); }
}
async function removeFeedback(req, res) {
  try { const { actorUserId } = _ctx(req); const ok = await svc.removeFeedback(req.params.id, { actorUserId }); if (!ok) return res.status(404).json({ success: false, error: "Feedback not found." }); res.json({ success: true }); }
  catch (err) { _err(res, "DELETE /api/parent-feedback/:id", err); }
}
async function feedbackSummary(req, res) {
  try { const { schoolId } = _ctx(req); const s = await svc.feedbackSummary({ schoolId, staffId: req.params.staffId }); res.json({ success: true, ...s }); }
  catch (err) { _err(res, "GET /api/parent-feedback/staff/:staffId/summary", err); }
}

// ── Promotions / Awards ──────────────────────────────────────────
async function listPromotions(req, res) {
  try { const { schoolId } = _ctx(req); const rows = await svc.listPromotions({ schoolId, staffId: req.query.staffId }); res.json({ success: true, promotions: rows }); }
  catch (err) { _err(res, "GET /api/staff-promotions", err); }
}
async function createPromotion(req, res) {
  try { const ctx = _ctx(req); const p = await svc.createPromotion(req.body, ctx); res.status(201).json({ success: true, promotion: p }); }
  catch (err) { _err(res, "POST /api/staff-promotions", err); }
}
async function removePromotion(req, res) {
  try { const { actorUserId } = _ctx(req); const ok = await svc.removePromotion(req.params.id, { actorUserId }); if (!ok) return res.status(404).json({ success: false, error: "Promotion not found." }); res.json({ success: true }); }
  catch (err) { _err(res, "DELETE /api/staff-promotions/:id", err); }
}

async function listAwards(req, res) {
  try { const { schoolId } = _ctx(req); const rows = await svc.listAwards({ schoolId, staffId: req.query.staffId }); res.json({ success: true, awards: rows }); }
  catch (err) { _err(res, "GET /api/staff-awards", err); }
}
async function createAward(req, res) {
  try { const ctx = _ctx(req); const a = await svc.createAward(req.body, ctx); res.status(201).json({ success: true, award: a }); }
  catch (err) { _err(res, "POST /api/staff-awards", err); }
}
async function removeAward(req, res) {
  try { const { actorUserId } = _ctx(req); const ok = await svc.removeAward(req.params.id, { actorUserId }); if (!ok) return res.status(404).json({ success: false, error: "Award not found." }); res.json({ success: true }); }
  catch (err) { _err(res, "DELETE /api/staff-awards/:id", err); }
}

// ── Timeline / Dashboard / AI ─────────────────────────────────────
async function timelineFor(req, res) {
  try { const { schoolId } = _ctx(req); const rows = await svc.timelineFor({ schoolId, staffId: req.params.staffId, limit: Number(req.query.limit) || 100 }); res.json({ success: true, events: rows }); }
  catch (err) { _err(res, "GET /api/performance-timeline/:staffId", err); }
}
async function dashboard(req, res) {
  try { const { schoolId, centerId } = _ctx(req); const d = await svc.dashboard({ schoolId, centerId }); res.json({ success: true, ...d }); }
  catch (err) { _err(res, "GET /api/performance-dashboard", err); }
}
async function aiSummary(req, res) {
  try { const { schoolId } = _ctx(req); const s = await svc.getAiSummary({ schoolId, staffId: req.params.staffId }); if (!s) return res.status(404).json({ success: false, error: "Staff not found." }); res.json({ success: true, summary: s }); }
  catch (err) { _err(res, "GET /api/performance-ai-summary/:staffId", err); }
}

module.exports = {
  listKpis, createKpi, updateKpi, removeKpi,
  listReviews, getReview, upsertReview, removeReview,
  listGoals, upsertGoal, removeGoal,
  listFeedback, createFeedback, removeFeedback, feedbackSummary,
  listPromotions, createPromotion, removePromotion,
  listAwards, createAward, removeAward,
  timelineFor, dashboard, aiSummary,
};
