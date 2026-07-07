/**
 * leaveController.js — HTTP handlers for Leave Management
 */

const svc       = require("../services/leaveService");
const staffSvc  = require("../services/staffService");

function _ctx(req) {
  return {
    schoolId:    req.user?.schoolId || process.env.SCHOOL_ID || "yd-main",
    tenantId:    req.user?.schoolId || process.env.SCHOOL_ID || "yd-main",
    centerId:    req.query?.centerId || req.user?.centerId || "",
    actorUserId: req.user?.userId   || "system",
    actorName:   req.user?.name     || req.user?.email || "Staff",
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

// ── Types ────────────────────────────────────────────────────────

async function listTypes(req, res) {
  try {
    const { schoolId, tenantId } = _ctx(req);
    const rows = await svc.listTypes({ schoolId, tenantId, active: req.query.active });
    res.json({ success: true, leaveTypes: rows });
  } catch (err) { _err(res, "GET /api/leave-types", err); }
}

async function createType(req, res) {
  try {
    const { schoolId, tenantId, actorUserId } = _ctx(req);
    const t = await svc.createType(req.body, { schoolId, tenantId, actorUserId });
    res.status(201).json({ success: true, leaveType: t });
  } catch (err) { _err(res, "POST /api/leave-types", err); }
}

async function updateType(req, res) {
  try {
    const { actorUserId } = _ctx(req);
    const t = await svc.updateType(req.params.id, req.body, { actorUserId });
    if (!t) return res.status(404).json({ success: false, error: "Leave type not found." });
    res.json({ success: true, leaveType: t });
  } catch (err) { _err(res, "PUT /api/leave-types/:id", err); }
}

async function removeType(req, res) {
  try {
    const ok = await svc.removeType(req.params.id);
    if (!ok) return res.status(404).json({ success: false, error: "Leave type not found." });
    res.json({ success: true });
  } catch (err) { _err(res, "DELETE /api/leave-types/:id", err); }
}

// ── Balances ─────────────────────────────────────────────────────

async function listBalances(req, res) {
  try {
    const { schoolId } = _ctx(req);
    const year = req.query.year || new Date().getFullYear();
    const staffId = req.params.staffId || req.query.staffId;
    if (!staffId) return res.status(400).json({ success: false, error: "staffId required." });
    const rows = await svc.getBalancesForStaff({ schoolId, staffId, year });
    res.json({ success: true, balances: rows });
  } catch (err) { _err(res, "GET /api/leave-balances", err); }
}

async function myBalances(req, res) {
  try {
    const { schoolId, actorUserId } = _ctx(req);
    const staff = await staffSvc.getByLinkedUserId(actorUserId, schoolId);
    if (!staff) return res.status(404).json({ success: false, error: "No staff record linked to your login." });
    const year = req.query.year || new Date().getFullYear();
    const rows = await svc.getBalancesForStaff({ schoolId, staffId: staff.staffId, year });
    res.json({ success: true, balances: rows, staff });
  } catch (err) { _err(res, "GET /api/leave-balances/me", err); }
}

// ── Requests ─────────────────────────────────────────────────────

async function listRequests(req, res) {
  try {
    const { schoolId, centerId } = _ctx(req);
    const { staffId, status, fromDate, toDate, includeDeleted } = req.query;
    const rows = await svc.listRequests({ schoolId, centerId, staffId, status, fromDate, toDate, includeDeleted });
    res.json({ success: true, requests: rows });
  } catch (err) { _err(res, "GET /api/leave-requests", err); }
}

async function getRequest(req, res) {
  try {
    const r = await svc.getRequest(req.params.id);
    if (!r) return res.status(404).json({ success: false, error: "Leave request not found." });
    res.json({ success: true, request: r });
  } catch (err) { _err(res, "GET /api/leave-requests/:id", err); }
}

async function createRequest(req, res) {
  try {
    const ctx = _ctx(req);
    let staffId = req.body?.staffId;
    // Self-apply support: if no staffId provided, look up via linked user
    if (!staffId) {
      const staff = await staffSvc.getByLinkedUserId(ctx.actorUserId, ctx.schoolId);
      if (!staff) return res.status(400).json({ success: false, error: "staffId is required (or link this user to a staff record)." });
      staffId = staff.staffId;
    }
    const r = await svc.createRequest({ ...req.body, staffId }, ctx);
    res.status(201).json({ success: true, request: r });
  } catch (err) { _err(res, "POST /api/leave-requests", err); }
}

async function approveRequest(req, res) {
  try {
    const ctx = _ctx(req);
    const r = await svc.decideRequest(req.params.id, {
      decision: "approved",
      comment:  req.body?.comment || "",
      approverId: ctx.actorUserId,
      approverName: ctx.actorName,
    });
    if (!r) return res.status(404).json({ success: false, error: "Leave request not found." });
    res.json({ success: true, request: r });
  } catch (err) { _err(res, "POST /api/leave-requests/:id/approve", err); }
}

async function rejectRequest(req, res) {
  try {
    const ctx = _ctx(req);
    const r = await svc.decideRequest(req.params.id, {
      decision: "rejected",
      comment:  req.body?.comment || "",
      approverId: ctx.actorUserId,
      approverName: ctx.actorName,
    });
    if (!r) return res.status(404).json({ success: false, error: "Leave request not found." });
    res.json({ success: true, request: r });
  } catch (err) { _err(res, "POST /api/leave-requests/:id/reject", err); }
}

async function cancelRequest(req, res) {
  try {
    const ctx = _ctx(req);
    const r = await svc.cancelRequest(req.params.id, { actorUserId: ctx.actorUserId });
    if (!r) return res.status(404).json({ success: false, error: "Leave request not found." });
    res.json({ success: true, request: r });
  } catch (err) { _err(res, "POST /api/leave-requests/:id/cancel", err); }
}

async function removeRequest(req, res) {
  try {
    const ctx = _ctx(req);
    const ok = await svc.removeRequest(req.params.id, { actorUserId: ctx.actorUserId });
    if (!ok) return res.status(404).json({ success: false, error: "Leave request not found." });
    res.json({ success: true });
  } catch (err) { _err(res, "DELETE /api/leave-requests/:id", err); }
}

// ── Aggregates ───────────────────────────────────────────────────

async function calendar(req, res) {
  try {
    const { schoolId, centerId } = _ctx(req);
    const { fromDate, toDate } = req.query;
    const data = await svc.calendarFeed({ schoolId, centerId, fromDate, toDate });
    res.json({ success: true, ...data });
  } catch (err) { _err(res, "GET /api/leave-calendar", err); }
}

async function dashboard(req, res) {
  try {
    const { schoolId, centerId } = _ctx(req);
    const data = await svc.dashboard({ schoolId, centerId });
    res.json({ success: true, ...data });
  } catch (err) { _err(res, "GET /api/leave-dashboard", err); }
}

async function report(req, res) {
  try {
    const { schoolId, centerId } = _ctx(req);
    const data = await svc.leaveReport({ schoolId, centerId, year: req.query.year });
    res.json({ success: true, ...data });
  } catch (err) { _err(res, "GET /api/leave-reports", err); }
}

module.exports = {
  listTypes, createType, updateType, removeType,
  listBalances, myBalances,
  listRequests, getRequest, createRequest,
  approveRequest, rejectRequest, cancelRequest, removeRequest,
  calendar, dashboard, report,
};
