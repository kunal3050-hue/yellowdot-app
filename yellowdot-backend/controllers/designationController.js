/**
 * designationController.js — HTTP handlers for Designations
 * ────────────────────────────────────────────────────────────
 */

const svc = require("../services/designationService");
const { checkTenantAccess } = require("../middleware/tenantRecordAccess");

function _ctx(req) {
  return {
    schoolId:    req.user?.schoolId || process.env.SCHOOL_ID || "yd-main",
    tenantId:    req.user?.schoolId || process.env.SCHOOL_ID || "yd-main",
    actorUserId: req.user?.userId   || "system",
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

async function list(req, res) {
  try {
    const { schoolId } = _ctx(req);
    const { departmentId, active } = req.query;
    const designations = await svc.getAll({ schoolId, departmentId, active });
    res.json({ success: true, designations });
  } catch (err) { _err(res, "GET /api/designations", err); }
}

async function getOne(req, res) {
  try {
    const d = await svc.getOne(req.params.designationId);
    if (!d || !checkTenantAccess(req, d).allowed) return res.status(404).json({ success: false, error: "Designation not found." });
    res.json({ success: true, designation: d });
  } catch (err) { _err(res, "GET /api/designations/:designationId", err); }
}

async function create(req, res) {
  try {
    const { schoolId, tenantId, actorUserId } = _ctx(req);
    const d = await svc.create(req.body, { schoolId, tenantId, actorUserId });
    res.status(201).json({ success: true, designation: d });
  } catch (err) { _err(res, "POST /api/designations", err); }
}

async function update(req, res) {
  try {
    const existing = await svc.getOne(req.params.designationId);
    if (!existing || !checkTenantAccess(req, existing).allowed) return res.status(404).json({ success: false, error: "Designation not found." });
    const { actorUserId } = _ctx(req);
    const d = await svc.update(req.params.designationId, req.body, { actorUserId });
    if (!d) return res.status(404).json({ success: false, error: "Designation not found." });
    res.json({ success: true, designation: d });
  } catch (err) { _err(res, "PUT /api/designations/:designationId", err); }
}

async function remove(req, res) {
  try {
    const existing = await svc.getOne(req.params.designationId);
    if (!existing || !checkTenantAccess(req, existing).allowed) return res.status(404).json({ success: false, error: "Designation not found." });
    const ok = await svc.remove(req.params.designationId);
    if (!ok) return res.status(404).json({ success: false, error: "Designation not found." });
    res.json({ success: true, message: "Designation deleted." });
  } catch (err) { _err(res, "DELETE /api/designations/:designationId", err); }
}

module.exports = { list, getOne, create, update, remove };
