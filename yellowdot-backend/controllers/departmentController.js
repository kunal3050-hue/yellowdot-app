/**
 * departmentController.js — HTTP handlers for Departments
 * ─────────────────────────────────────────────────────────
 */

const svc = require("../services/departmentService");

function _ctx(req) {
  return {
    schoolId:    req.user?.schoolId || process.env.SCHOOL_ID || "yd-main",
    tenantId:    req.user?.schoolId || process.env.SCHOOL_ID || "yd-main",
    centerId:    req.query?.centerId || req.user?.centerId || "",
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
    const { schoolId, centerId } = _ctx(req);
    const { active } = req.query;
    const departments = await svc.getAll({ schoolId, centerId, active });
    res.json({ success: true, departments });
  } catch (err) { _err(res, "GET /api/departments", err); }
}

async function getOne(req, res) {
  try {
    const dept = await svc.getOne(req.params.deptId);
    if (!dept) return res.status(404).json({ success: false, error: "Department not found." });
    res.json({ success: true, department: dept });
  } catch (err) { _err(res, "GET /api/departments/:deptId", err); }
}

async function create(req, res) {
  try {
    const { schoolId, tenantId, actorUserId } = _ctx(req);
    const dept = await svc.create(req.body, { schoolId, tenantId, actorUserId });
    res.status(201).json({ success: true, department: dept });
  } catch (err) { _err(res, "POST /api/departments", err); }
}

async function update(req, res) {
  try {
    const { actorUserId } = _ctx(req);
    const dept = await svc.update(req.params.deptId, req.body, { actorUserId });
    if (!dept) return res.status(404).json({ success: false, error: "Department not found." });
    res.json({ success: true, department: dept });
  } catch (err) { _err(res, "PUT /api/departments/:deptId", err); }
}

async function remove(req, res) {
  try {
    const ok = await svc.remove(req.params.deptId);
    if (!ok) return res.status(404).json({ success: false, error: "Department not found." });
    res.json({ success: true, message: "Department deleted." });
  } catch (err) { _err(res, "DELETE /api/departments/:deptId", err); }
}

module.exports = { list, getOne, create, update, remove };
