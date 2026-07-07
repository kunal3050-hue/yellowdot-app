/**
 * payrollController.js — HTTP handlers for Payroll
 * Includes a PDF payslip endpoint via pdfkit.
 */

const svc       = require("../services/payrollService");
const staffSvc  = require("../services/staffService");
const PDFDocument = require("pdfkit");

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

// ── Components ───────────────────────────────────────────────────

async function listComponents(req, res) {
  try {
    const { schoolId, tenantId } = _ctx(req);
    const rows = await svc.listComponents({ schoolId, tenantId, active: req.query.active });
    res.json({ success: true, components: rows });
  } catch (err) { _err(res, "GET /api/salary-components", err); }
}
async function createComponent(req, res) {
  try {
    const { schoolId, tenantId, actorUserId } = _ctx(req);
    const c = await svc.createComponent(req.body, { schoolId, tenantId, actorUserId });
    res.status(201).json({ success: true, component: c });
  } catch (err) { _err(res, "POST /api/salary-components", err); }
}
async function updateComponent(req, res) {
  try {
    const { actorUserId } = _ctx(req);
    const c = await svc.updateComponent(req.params.id, req.body, { actorUserId });
    if (!c) return res.status(404).json({ success: false, error: "Component not found." });
    res.json({ success: true, component: c });
  } catch (err) { _err(res, "PUT /api/salary-components/:id", err); }
}
async function removeComponent(req, res) {
  try {
    const ok = await svc.removeComponent(req.params.id);
    if (!ok) return res.status(404).json({ success: false, error: "Component not found." });
    res.json({ success: true });
  } catch (err) { _err(res, "DELETE /api/salary-components/:id", err); }
}

// ── Structures ───────────────────────────────────────────────────

async function listStructures(req, res) {
  try {
    const { schoolId } = _ctx(req);
    const rows = await svc.listStructures({ schoolId });
    res.json({ success: true, structures: rows });
  } catch (err) { _err(res, "GET /api/salary-structures", err); }
}
async function createStructure(req, res) {
  try {
    const { schoolId, tenantId, actorUserId } = _ctx(req);
    const s = await svc.createStructure(req.body, { schoolId, tenantId, actorUserId });
    res.status(201).json({ success: true, structure: s });
  } catch (err) { _err(res, "POST /api/salary-structures", err); }
}
async function updateStructure(req, res) {
  try {
    const { actorUserId } = _ctx(req);
    const s = await svc.updateStructure(req.params.id, req.body, { actorUserId });
    if (!s) return res.status(404).json({ success: false, error: "Structure not found." });
    res.json({ success: true, structure: s });
  } catch (err) { _err(res, "PUT /api/salary-structures/:id", err); }
}
async function removeStructure(req, res) {
  try {
    const ok = await svc.removeStructure(req.params.id);
    if (!ok) return res.status(404).json({ success: false, error: "Structure not found." });
    res.json({ success: true });
  } catch (err) { _err(res, "DELETE /api/salary-structures/:id", err); }
}

// ── Staff Salary ─────────────────────────────────────────────────

async function listStaffSalary(req, res) {
  try {
    const { schoolId } = _ctx(req);
    const rows = await svc.listStaffSalary({ schoolId, includeDeleted: req.query.includeDeleted });
    res.json({ success: true, staffSalary: rows });
  } catch (err) { _err(res, "GET /api/staff-salary", err); }
}
async function getStaffSalary(req, res) {
  try {
    const s = await svc.getStaffSalary(req.params.staffId);
    if (!s) return res.json({ success: true, staffSalary: null });
    res.json({ success: true, staffSalary: s });
  } catch (err) { _err(res, "GET /api/staff-salary/:staffId", err); }
}
async function upsertStaffSalary(req, res) {
  try {
    const { schoolId, tenantId, actorUserId } = _ctx(req);
    const s = await svc.upsertStaffSalary(req.params.staffId, req.body, { schoolId, tenantId, actorUserId });
    res.json({ success: true, staffSalary: s });
  } catch (err) { _err(res, "PUT /api/staff-salary/:staffId", err); }
}
async function removeStaffSalary(req, res) {
  try {
    const { actorUserId } = _ctx(req);
    const ok = await svc.removeStaffSalary(req.params.staffId, { actorUserId });
    if (!ok) return res.status(404).json({ success: false, error: "Staff salary not found." });
    res.json({ success: true });
  } catch (err) { _err(res, "DELETE /api/staff-salary/:staffId", err); }
}

// ── Payroll Runs ─────────────────────────────────────────────────

async function listRuns(req, res) {
  try {
    const { schoolId } = _ctx(req);
    const rows = await svc.listRuns({ schoolId });
    res.json({ success: true, runs: rows });
  } catch (err) { _err(res, "GET /api/payroll-runs", err); }
}
async function getRun(req, res) {
  try {
    const r = await svc.getRun(req.params.id);
    if (!r) return res.status(404).json({ success: false, error: "Run not found." });
    res.json({ success: true, run: r });
  } catch (err) { _err(res, "GET /api/payroll-runs/:id", err); }
}
async function processRun(req, res) {
  try {
    const ctx = _ctx(req);
    const { year, month } = req.body || {};
    const run = await svc.processRun({ year: Number(year), month: Number(month), ...ctx });
    res.json({ success: true, run });
  } catch (err) { _err(res, "POST /api/payroll-runs/process", err); }
}
async function lockRun(req, res) {
  try {
    const { actorUserId } = _ctx(req);
    const r = await svc.lockRun(req.params.id, { actorUserId });
    if (!r) return res.status(404).json({ success: false, error: "Run not found." });
    res.json({ success: true, run: r });
  } catch (err) { _err(res, "POST /api/payroll-runs/:id/lock", err); }
}
async function reopenRun(req, res) {
  try {
    const { actorUserId } = _ctx(req);
    const r = await svc.reopenRun(req.params.id, { actorUserId });
    if (!r) return res.status(404).json({ success: false, error: "Run not found." });
    res.json({ success: true, run: r });
  } catch (err) { _err(res, "POST /api/payroll-runs/:id/reopen", err); }
}

// ── Payslips ─────────────────────────────────────────────────────

async function listPayslips(req, res) {
  try {
    const { schoolId } = _ctx(req);
    const { runId, year, month, staffId } = req.query;
    const rows = await svc.listPayslips({ schoolId, runId, year, month, staffId });
    res.json({ success: true, payslips: rows });
  } catch (err) { _err(res, "GET /api/payslips", err); }
}
async function getPayslip(req, res) {
  try {
    const p = await svc.getPayslip(req.params.id);
    if (!p) return res.status(404).json({ success: false, error: "Payslip not found." });
    res.json({ success: true, payslip: p });
  } catch (err) { _err(res, "GET /api/payslips/:id", err); }
}
async function myPayslips(req, res) {
  try {
    const ctx = _ctx(req);
    const staff = await staffSvc.getByLinkedUserId(ctx.actorUserId, ctx.schoolId);
    if (!staff) return res.status(404).json({ success: false, error: "No staff record linked to your login." });
    const rows = await svc.myPayslips({ schoolId: ctx.schoolId, staffId: staff.staffId });
    res.json({ success: true, payslips: rows, staff });
  } catch (err) { _err(res, "GET /api/payslips/me", err); }
}

async function payslipPdf(req, res) {
  try {
    const p = await svc.getPayslip(req.params.id);
    if (!p) return res.status(404).json({ success: false, error: "Payslip not found." });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="payslip-${p.employeeCode}-${p.year}-${String(p.month).padStart(2, "0")}.pdf"`);

    const doc = new PDFDocument({ size: "A4", margin: 40 });
    doc.pipe(res);

    // Header
    doc.fontSize(18).font("Helvetica-Bold").text("Payslip", { align: "left" });
    doc.fontSize(10).font("Helvetica").fillColor("#666")
       .text(`For ${monthName(p.month)} ${p.year}`)
       .moveDown(0.5);

    doc.fillColor("#000").font("Helvetica-Bold").text("Yellow Dot Preschool", { align: "right" });
    doc.font("Helvetica").fontSize(9).fillColor("#666").text("Auto-generated payslip", { align: "right" });
    doc.moveDown();

    // Employee block
    doc.fillColor("#000").fontSize(11).font("Helvetica-Bold").text("Employee").moveDown(0.2);
    doc.font("Helvetica").fontSize(10);
    doc.text(`Name        : ${p.displayName}`);
    doc.text(`Code        : ${p.employeeCode}`);
    doc.text(`Designation : ${p.designationName || "—"}`);
    doc.text(`Department  : ${p.departmentName || "—"}`);
    doc.text(`Paid Days   : ${p.paidDays} / 30  (LOP ${p.lopDays})`);
    if (p.bankAccountLast4) doc.text(`Bank A/C    : XXXX${p.bankAccountLast4}  (${p.paymentMode || "—"})`);
    doc.moveDown();

    // Table-ish layout for earnings & deductions
    const colX = [40, 300];
    const startY = doc.y;
    doc.font("Helvetica-Bold").fontSize(11);
    doc.text("Earnings",   colX[0], startY);
    doc.text("Deductions", colX[1], startY);
    doc.moveTo(40, doc.y + 4).lineTo(555, doc.y + 4).strokeColor("#ddd").stroke();
    doc.moveDown(0.6);

    const rowsCount = Math.max(p.earnings.length, p.deductions.length);
    doc.font("Helvetica").fontSize(10);
    let y = doc.y;
    for (let i = 0; i < rowsCount; i++) {
      const e = p.earnings[i];
      const d = p.deductions[i];
      doc.text(e ? `${e.name}` : "", colX[0], y, { width: 200 });
      doc.text(e ? `₹ ${e.amount.toLocaleString("en-IN")}` : "", colX[0] + 200, y, { width: 60, align: "right" });
      doc.text(d ? `${d.name}` : "", colX[1], y, { width: 180 });
      doc.text(d ? `₹ ${d.amount.toLocaleString("en-IN")}` : "", colX[1] + 180, y, { width: 60, align: "right" });
      y += 18;
    }
    doc.moveTo(40, y + 4).lineTo(555, y + 4).strokeColor("#ddd").stroke();
    y += 12;

    doc.font("Helvetica-Bold").fontSize(11);
    doc.text(`Gross   : ₹ ${p.gross.toLocaleString("en-IN")}`,           colX[0], y);
    doc.text(`Deductions : ₹ ${p.totalDeductions.toLocaleString("en-IN")}`, colX[1], y);
    y += 18;
    doc.fillColor("#7a4d12").text(`Net Pay : ₹ ${p.net.toLocaleString("en-IN")}`, colX[0], y);
    doc.fillColor("#666").fontSize(8).font("Helvetica")
       .text(`Generated on ${new Date().toLocaleString("en-IN")}`, 40, 770, { width: 515, align: "center" });

    doc.end();
  } catch (err) {
    console.error("[GET /api/payslips/:id/pdf]", err.message);
    res.status(500).end();
  }
}

function monthName(m) {
  return new Date(2000, (m || 1) - 1, 1).toLocaleDateString("en-IN", { month: "long" });
}

// ── Bank report ──────────────────────────────────────────────────

async function bankTransferReport(req, res) {
  try {
    const { schoolId } = _ctx(req);
    const r = await svc.bankTransferReport({ schoolId, runId: req.query.runId });
    res.json({ success: true, ...r });
  } catch (err) { _err(res, "GET /api/payroll-runs/bank-report", err); }
}

module.exports = {
  // Components
  listComponents, createComponent, updateComponent, removeComponent,
  // Structures
  listStructures, createStructure, updateStructure, removeStructure,
  // Staff salary
  listStaffSalary, getStaffSalary, upsertStaffSalary, removeStaffSalary,
  // Runs
  listRuns, getRun, processRun, lockRun, reopenRun,
  // Payslips
  listPayslips, getPayslip, myPayslips, payslipPdf,
  // Bank report
  bankTransferReport,
};
