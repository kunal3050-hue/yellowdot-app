/**
 * payrollRoutes.js — Payroll REST API
 *
 * Components / Structures / Staff Salary (admin/center-owner only):
 *   /api/salary-components, /api/salary-structures, /api/staff-salary/:staffId
 *
 * Runs:
 *   GET    /api/payroll-runs            list
 *   POST   /api/payroll-runs/process    { year, month } — creates/refreshes a run + its payslips
 *   POST   /api/payroll-runs/:id/lock   lock for the period
 *   POST   /api/payroll-runs/:id/reopen unlock
 *   GET    /api/payroll-runs/bank-report?runId
 *
 * Payslips:
 *   GET    /api/payslips                ?runId&year&month&staffId
 *   GET    /api/payslips/me             current user's payslip history
 *   GET    /api/payslips/:id            single
 *   GET    /api/payslips/:id/pdf        rendered PDF
 */

const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/payrollController");
const { authenticate, authorizeRoute, staffOnly } = require("../middleware/authMiddleware");

const VIEW    = "staff-payroll";
const PROCESS = "staff-payroll-process";

const canView    = [authenticate, staffOnly, authorizeRoute(VIEW)];
const canProcess = [authenticate, staffOnly, authorizeRoute(PROCESS)];

// Components
router.get   ("/api/salary-components",       ...canView,    ctrl.listComponents);
router.post  ("/api/salary-components",       ...canProcess, ctrl.createComponent);
router.put   ("/api/salary-components/:id",   ...canProcess, ctrl.updateComponent);
router.delete("/api/salary-components/:id",   ...canProcess, ctrl.removeComponent);

// Structures
router.get   ("/api/salary-structures",       ...canView,    ctrl.listStructures);
router.post  ("/api/salary-structures",       ...canProcess, ctrl.createStructure);
router.put   ("/api/salary-structures/:id",   ...canProcess, ctrl.updateStructure);
router.delete("/api/salary-structures/:id",   ...canProcess, ctrl.removeStructure);

// Staff salary
router.get   ("/api/staff-salary",                  ...canView,    ctrl.listStaffSalary);
router.get   ("/api/staff-salary/:staffId",         ...canView,    ctrl.getStaffSalary);
router.put   ("/api/staff-salary/:staffId",         ...canProcess, ctrl.upsertStaffSalary);
router.delete("/api/staff-salary/:staffId",         ...canProcess, ctrl.removeStaffSalary);

// Runs — literal paths before :param routes
router.get ("/api/payroll-runs",                 ...canView,    ctrl.listRuns);
router.get ("/api/payroll-runs/bank-report",     ...canView,    ctrl.bankTransferReport);
router.post("/api/payroll-runs/process",         ...canProcess, ctrl.processRun);
router.get ("/api/payroll-runs/:id",             ...canView,    ctrl.getRun);
router.post("/api/payroll-runs/:id/lock",        ...canProcess, ctrl.lockRun);
router.post("/api/payroll-runs/:id/reopen",      ...canProcess, ctrl.reopenRun);

// Payslips
router.get("/api/payslips/me",        authenticate, staffOnly, ctrl.myPayslips);
router.get("/api/payslips",           ...canView,   ctrl.listPayslips);
router.get("/api/payslips/:id",       ...canView,   ctrl.getPayslip);
router.get("/api/payslips/:id/pdf",   ...canView,   ctrl.payslipPdf);

module.exports = router;
