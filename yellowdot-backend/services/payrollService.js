/**
 * payrollService.js — Payroll engine for staff
 * ──────────────────────────────────────────────
 * Collections:
 *   salaryComponents/{id}    — Earnings / Deductions master (auto-seeded)
 *   salaryStructures/{id}    — Named templates with component allocations
 *   staffSalary/{staffId}    — Currently-assigned structure + overrides for a staff member
 *   payrollRuns/{id}         — Monthly batch (status: draft / processed / locked)
 *   payslips/{id}            — Per-staff per-month payslip
 *
 * Multi-tenant safe. Soft delete on staffSalary + payslips.
 *
 * Computation rules:
 *   Each component is either "earning" or "deduction" with:
 *     - type: "fixed"          → uses `amount` directly
 *     - type: "percent_basic"  → uses `percent` of the Basic component
 *     - type: "lop_proration"  → only on a payroll run; auto-computed from
 *                                LWP attendance (Phase 2/3 integration)
 *   Gross = sum of earnings; Deductions = sum of deductions
 *   Net   = Gross − Deductions − LOP pay-cut
 */

const { db } = require("../firebaseAdmin");
const SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";

const componentsCol = () => db.collection("salaryComponents");
const structuresCol = () => db.collection("salaryStructures");
const staffSalaryCol= () => db.collection("staffSalary");
const runsCol       = () => db.collection("payrollRuns");
const payslipsCol   = () => db.collection("payslips");
const nowISO        = () => new Date().toISOString();

// ── Defaults seeded on first read ───────────────────────────────

const DEFAULT_COMPONENTS = [
  { code: "BASIC",  name: "Basic",            kind: "earning",   type: "fixed",         sortOrder: 10, taxable: true,  isSystem: true },
  { code: "HRA",    name: "House Rent",       kind: "earning",   type: "percent_basic", percent: 40,   sortOrder: 20, taxable: true,  isSystem: true },
  { code: "CONV",   name: "Conveyance",       kind: "earning",   type: "fixed",         sortOrder: 30, taxable: false, isSystem: true },
  { code: "SPEC",   name: "Special Allowance",kind: "earning",   type: "fixed",         sortOrder: 40, taxable: true,  isSystem: true },
  { code: "PF",     name: "Provident Fund",   kind: "deduction", type: "percent_basic", percent: 12,   sortOrder: 110, isSystem: true },
  { code: "PT",     name: "Professional Tax", kind: "deduction", type: "fixed",         sortOrder: 120, isSystem: true },
  { code: "TDS",    name: "TDS / Income Tax", kind: "deduction", type: "fixed",         sortOrder: 130, isSystem: true },
  { code: "LOP",    name: "Loss of Pay",      kind: "deduction", type: "lop_proration", sortOrder: 200, isSystem: true },
];

const _seededComp = new Set();
async function _seedComponents(schoolId, tenantId) {
  if (_seededComp.has(schoolId)) return;
  const snap = await componentsCol().where("schoolId", "==", schoolId).limit(1).get();
  if (!snap.empty) { _seededComp.add(schoolId); return; }
  const batch = db.batch();
  const now   = nowISO();
  for (const c of DEFAULT_COMPONENTS) {
    const ref = componentsCol().doc();
    batch.set(ref, {
      componentId: ref.id, tenantId: tenantId || schoolId, schoolId, centerId: "",
      code: c.code, name: c.name, kind: c.kind, type: c.type,
      percent: Number(c.percent || 0), amount: 0,
      taxable: Boolean(c.taxable), active: true, isSystem: !!c.isSystem,
      sortOrder: c.sortOrder, createdAt: now, updatedAt: now, createdBy: "system-seed", updatedBy: "system-seed",
    });
  }
  await batch.commit();
  _seededComp.add(schoolId);
}

// ── Mappers ───────────────────────────────────────────────────────

function docToComponent(snap) {
  const d = snap.data ? snap.data() : snap; const id = snap.id || d.componentId || "";
  return {
    componentId: d.componentId || id,
    tenantId: d.tenantId || d.schoolId || SCHOOL_ID,
    schoolId: d.schoolId || SCHOOL_ID, centerId: d.centerId || "",
    code: d.code || "", name: d.name || "",
    kind: d.kind || "earning",        // earning | deduction
    type: d.type || "fixed",          // fixed | percent_basic | lop_proration
    percent: Number(d.percent || 0),
    amount:  Number(d.amount  || 0),  // template default; real values live on structures/staff
    taxable: Boolean(d.taxable),
    active:  d.active !== false,
    isSystem: Boolean(d.isSystem),
    sortOrder: typeof d.sortOrder === "number" ? d.sortOrder : 0,
    createdAt: d.createdAt || "", updatedAt: d.updatedAt || "",
    createdBy: d.createdBy || "", updatedBy: d.updatedBy || "",
  };
}

function docToStructure(snap) {
  const d = snap.data ? snap.data() : snap; const id = snap.id || d.structureId || "";
  return {
    structureId: d.structureId || id,
    tenantId: d.tenantId || d.schoolId || SCHOOL_ID, schoolId: d.schoolId || SCHOOL_ID, centerId: d.centerId || "",
    name: d.name || "",
    monthlyCtc: Number(d.monthlyCtc || 0),
    componentAmounts: d.componentAmounts || {}, // { componentId: amount } — fixed components only
    active: d.active !== false,
    sortOrder: typeof d.sortOrder === "number" ? d.sortOrder : 0,
    createdAt: d.createdAt || "", updatedAt: d.updatedAt || "",
    createdBy: d.createdBy || "", updatedBy: d.updatedBy || "",
  };
}

function docToStaffSalary(snap) {
  const d = snap.data ? snap.data() : snap; const id = snap.id || d.staffId || "";
  return {
    staffId: d.staffId || id,
    tenantId: d.tenantId || d.schoolId || SCHOOL_ID, schoolId: d.schoolId || SCHOOL_ID, centerId: d.centerId || "",
    structureId: d.structureId || "",
    monthlyCtc:  Number(d.monthlyCtc || 0),
    overrides:   d.overrides || {},  // { componentId: amount }
    paymentMode: d.paymentMode || "",
    bankAccountLast4: d.bankAccountLast4 || "",
    bankName: d.bankName || "", ifsc: d.ifsc || "",
    effectiveFrom: d.effectiveFrom || "",
    active: d.active !== false,
    deletedAt: d.deletedAt || "", deletedBy: d.deletedBy || "",
    createdAt: d.createdAt || "", updatedAt: d.updatedAt || "",
    createdBy: d.createdBy || "", updatedBy: d.updatedBy || "",
  };
}

function docToRun(snap) {
  const d = snap.data ? snap.data() : snap; const id = snap.id || d.runId || "";
  return {
    runId: d.runId || id,
    tenantId: d.tenantId || d.schoolId || SCHOOL_ID, schoolId: d.schoolId || SCHOOL_ID, centerId: d.centerId || "",
    year: Number(d.year || 0), month: Number(d.month || 0),
    status: d.status || "draft",  // draft | processed | locked | reversed
    totals: d.totals || { gross: 0, deductions: 0, net: 0, employees: 0 },
    processedAt: d.processedAt || "", processedBy: d.processedBy || "",
    lockedAt: d.lockedAt || "", lockedBy: d.lockedBy || "",
    createdAt: d.createdAt || "", updatedAt: d.updatedAt || "",
    createdBy: d.createdBy || "", updatedBy: d.updatedBy || "",
  };
}

function docToPayslip(snap) {
  const d = snap.data ? snap.data() : snap; const id = snap.id || d.payslipId || "";
  return {
    payslipId: d.payslipId || id, runId: d.runId || "",
    tenantId: d.tenantId || d.schoolId || SCHOOL_ID, schoolId: d.schoolId || SCHOOL_ID, centerId: d.centerId || "",
    staffId: d.staffId || "", employeeCode: d.employeeCode || "", displayName: d.displayName || "",
    designationName: d.designationName || "", departmentName: d.departmentName || "",
    year: Number(d.year || 0), month: Number(d.month || 0),
    workedDays: Number(d.workedDays || 0), paidDays: Number(d.paidDays || 0), lopDays: Number(d.lopDays || 0),
    earnings:   d.earnings   || [],
    deductions: d.deductions || [],
    gross: Number(d.gross || 0),
    totalDeductions: Number(d.totalDeductions || 0),
    net: Number(d.net || 0),
    paymentMode: d.paymentMode || "",
    bankAccountLast4: d.bankAccountLast4 || "",
    pdfUrl: d.pdfUrl || "",
    notes: d.notes || "",
    deletedAt: d.deletedAt || "", deletedBy: d.deletedBy || "",
    createdAt: d.createdAt || "", updatedAt: d.updatedAt || "",
  };
}

// ── Components CRUD ──────────────────────────────────────────────

async function listComponents({ schoolId = SCHOOL_ID, tenantId, active } = {}) {
  await _seedComponents(schoolId, tenantId).catch(err => console.warn("[payrollService] seed components failed:", err.message));
  const snap = await componentsCol().where("schoolId", "==", schoolId).get();
  let rows = snap.docs.map(docToComponent);
  if (active !== undefined) rows = rows.filter(r => r.active === (active !== false && active !== "false"));
  rows.sort((a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name));
  return rows;
}

async function getComponent(id) {
  const snap = await componentsCol().doc(id).get();
  return snap.exists ? docToComponent(snap) : null;
}

async function createComponent(data, { schoolId = SCHOOL_ID, tenantId, actorUserId = "system" } = {}) {
  const name = (data.name || "").trim();
  if (!name) { const e = new Error("Component name is required."); e.code = "VALIDATION"; throw e; }
  const code = (data.code || "").trim().toUpperCase();
  if (code) {
    const dup = await componentsCol().where("schoolId", "==", schoolId).where("code", "==", code).limit(1).get();
    if (!dup.empty) { const e = new Error("A component with this code already exists."); e.code = "DUPLICATE"; throw e; }
  }
  const ref = componentsCol().doc();
  const doc = {
    componentId: ref.id, tenantId: tenantId || schoolId, schoolId,
    centerId: (data.centerId || "").trim(),
    code, name,
    kind: data.kind === "deduction" ? "deduction" : "earning",
    type: ["fixed","percent_basic","lop_proration"].includes(data.type) ? data.type : "fixed",
    percent: Number(data.percent || 0),
    amount:  Number(data.amount  || 0),
    taxable: Boolean(data.taxable),
    active:  data.active !== false,
    isSystem: false,
    sortOrder: Number(data.sortOrder) || 0,
    createdAt: nowISO(), updatedAt: nowISO(), createdBy: actorUserId, updatedBy: actorUserId,
  };
  await ref.set(doc);
  return docToComponent(doc);
}

async function updateComponent(id, data, { actorUserId = "system" } = {}) {
  const ref = componentsCol().doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const updates = { updatedAt: nowISO(), updatedBy: actorUserId };
  ["name","code","kind","type","centerId"].forEach(k => { if (data[k] !== undefined) updates[k] = String(data[k]); });
  if (updates.code) updates.code = updates.code.toUpperCase().trim();
  ["percent","amount","sortOrder"].forEach(k => { if (data[k] !== undefined) updates[k] = Number(data[k]) || 0; });
  ["taxable","active"].forEach(k => { if (data[k] !== undefined) updates[k] = Boolean(data[k]); });
  await ref.update(updates);
  return docToComponent(await ref.get());
}

async function removeComponent(id) {
  const snap = await componentsCol().doc(id).get();
  if (!snap.exists) return false;
  if (snap.data().isSystem) { const e = new Error("System components cannot be deleted."); e.code = "IN_USE"; throw e; }
  await componentsCol().doc(id).delete();
  return true;
}

// ── Structures CRUD ──────────────────────────────────────────────

async function listStructures({ schoolId = SCHOOL_ID } = {}) {
  const snap = await structuresCol().where("schoolId", "==", schoolId).get();
  const rows = snap.docs.map(docToStructure);
  rows.sort((a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name));
  return rows;
}

async function getStructure(id) {
  const snap = await structuresCol().doc(id).get();
  return snap.exists ? docToStructure(snap) : null;
}

async function createStructure(data, { schoolId = SCHOOL_ID, tenantId, actorUserId = "system" } = {}) {
  const name = (data.name || "").trim();
  if (!name) { const e = new Error("Structure name is required."); e.code = "VALIDATION"; throw e; }
  const ref = structuresCol().doc();
  const doc = {
    structureId: ref.id, tenantId: tenantId || schoolId, schoolId, centerId: (data.centerId || "").trim(),
    name, monthlyCtc: Number(data.monthlyCtc || 0),
    componentAmounts: data.componentAmounts || {},
    active: data.active !== false, sortOrder: Number(data.sortOrder) || 0,
    createdAt: nowISO(), updatedAt: nowISO(), createdBy: actorUserId, updatedBy: actorUserId,
  };
  await ref.set(doc);
  return docToStructure(doc);
}

async function updateStructure(id, data, { actorUserId = "system" } = {}) {
  const ref = structuresCol().doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const updates = { updatedAt: nowISO(), updatedBy: actorUserId };
  if (data.name        !== undefined) updates.name        = String(data.name).trim();
  if (data.monthlyCtc  !== undefined) updates.monthlyCtc  = Number(data.monthlyCtc) || 0;
  if (data.componentAmounts !== undefined) updates.componentAmounts = data.componentAmounts;
  if (data.active      !== undefined) updates.active      = Boolean(data.active);
  if (data.sortOrder   !== undefined) updates.sortOrder   = Number(data.sortOrder) || 0;
  await ref.update(updates);
  return docToStructure(await ref.get());
}

async function removeStructure(id) {
  const snap = await structuresCol().doc(id).get();
  if (!snap.exists) return false;
  const used = await staffSalaryCol().where("structureId", "==", id).limit(1).get();
  if (!used.empty) { const e = new Error("Structure is in use — reassign affected staff first."); e.code = "IN_USE"; throw e; }
  await structuresCol().doc(id).delete();
  return true;
}

// ── Staff Salary ─────────────────────────────────────────────────

async function listStaffSalary({ schoolId = SCHOOL_ID, includeDeleted = false } = {}) {
  const snap = await staffSalaryCol().where("schoolId", "==", schoolId).get();
  let rows = snap.docs.map(docToStaffSalary);
  if (!includeDeleted) rows = rows.filter(r => !r.deletedAt);
  return rows;
}

async function getStaffSalary(staffId) {
  const snap = await staffSalaryCol().doc(staffId).get();
  return snap.exists ? docToStaffSalary(snap) : null;
}

async function upsertStaffSalary(staffId, data, { schoolId = SCHOOL_ID, tenantId, actorUserId = "system" } = {}) {
  const ref  = staffSalaryCol().doc(staffId);
  const snap = await ref.get();

  const doc = {
    staffId,
    tenantId:    tenantId || schoolId,
    schoolId,
    centerId:    (data.centerId || (snap.exists ? snap.data().centerId : "")) || "",
    structureId: data.structureId || (snap.exists ? snap.data().structureId : ""),
    monthlyCtc:  Number(data.monthlyCtc || 0),
    overrides:   data.overrides || {},
    paymentMode: data.paymentMode || "",
    bankAccountLast4: (data.bankAccountLast4 || "").toString().slice(-4),
    bankName: data.bankName || "",
    ifsc:     data.ifsc     || "",
    effectiveFrom: data.effectiveFrom || (snap.exists ? snap.data().effectiveFrom : new Date().toISOString().slice(0, 10)),
    active:    data.active !== false,
    deletedAt: "", deletedBy: "",
    updatedAt: nowISO(), updatedBy: actorUserId,
    createdAt: snap.exists ? (snap.data().createdAt || nowISO()) : nowISO(),
    createdBy: snap.exists ? (snap.data().createdBy || actorUserId) : actorUserId,
  };
  await ref.set(doc, { merge: false });
  return docToStaffSalary(doc);
}

async function removeStaffSalary(staffId, { actorUserId = "system" } = {}) {
  const snap = await staffSalaryCol().doc(staffId).get();
  if (!snap.exists) return false;
  await staffSalaryCol().doc(staffId).update({
    active: false, deletedAt: nowISO(), deletedBy: actorUserId, updatedAt: nowISO(), updatedBy: actorUserId,
  });
  return true;
}

// ── Payslip computation ──────────────────────────────────────────

function _resolveBasic(componentMap, amountsForStaff) {
  const basic = Object.values(componentMap).find(c => c.code === "BASIC" || c.code === "BASE");
  if (!basic) return 0;
  return Number(amountsForStaff[basic.componentId] || basic.amount || 0);
}

function _computeLine(comp, amountsForStaff, basicAmount) {
  if (comp.type === "fixed") {
    return Number(amountsForStaff[comp.componentId] || comp.amount || 0);
  }
  if (comp.type === "percent_basic") {
    const pct = Number(amountsForStaff[`${comp.componentId}__percent`] || comp.percent || 0);
    return Math.round(basicAmount * pct) / 100;
  }
  return 0; // lop_proration handled later
}

function _round(n) { return Math.round(Number(n) || 0); }

async function _computePayslipFor({ schoolId, staff, salary, run, componentMap, attendanceSummary }) {
  const amounts = salary.overrides || {};

  // Auto-distribute Basic if missing: half of monthlyCtc goes to BASIC, the rest follows percent_basic chain.
  const basic = Object.values(componentMap).find(c => c.code === "BASIC" || c.code === "BASE");
  if (basic && !amounts[basic.componentId]) {
    amounts[basic.componentId] = _round(salary.monthlyCtc * 0.5);
  }
  const basicAmount = _resolveBasic(componentMap, amounts);

  const earnings = [];
  const deductions = [];
  let gross = 0, totalDed = 0;
  for (const comp of Object.values(componentMap)) {
    if (!comp.active) continue;
    const val = _computeLine(comp, amounts, basicAmount);
    if (val <= 0 && comp.code !== "LOP") continue;
    if (comp.kind === "earning") { earnings.push({ componentId: comp.componentId, code: comp.code, name: comp.name, amount: _round(val) }); gross += val; }
    else                          { deductions.push({ componentId: comp.componentId, code: comp.code, name: comp.name, amount: _round(val) }); totalDed += val; }
  }

  // LOP — proration based on lopDays
  if (attendanceSummary.lopDays > 0 && salary.monthlyCtc > 0) {
    const perDay   = salary.monthlyCtc / 30;
    const lopAmount = _round(perDay * attendanceSummary.lopDays);
    deductions.push({ componentId: "LOP-AUTO", code: "LOP", name: "Loss of Pay", amount: lopAmount });
    totalDed += lopAmount;
  }

  return {
    earnings, deductions,
    gross: _round(gross),
    totalDeductions: _round(totalDed),
    net: _round(gross - totalDed),
    workedDays: attendanceSummary.workedDays,
    paidDays:   attendanceSummary.paidDays,
    lopDays:    attendanceSummary.lopDays,
  };
}

async function _attendanceForMonth({ schoolId, staffId, year, month }) {
  // Best-effort: use staffAttendanceService if present, else default everyone to 30 paid days
  try {
    const attendanceSvc = require("./staffAttendanceService");
    const rows = await attendanceSvc.getForStaffMonth({ schoolId, staffId, year, month });
    let worked = 0, paid = 0, lop = 0;
    rows.forEach(r => {
      if (r.status === "present")  { worked++; paid++; }
      if (r.status === "half_day") { worked += 0.5; paid += 0.5; }
      if (r.status === "leave" || r.status === "holiday" || r.status === "weekend") paid++;
      if (r.status === "absent")   lop++;
    });
    return { workedDays: worked, paidDays: paid, lopDays: lop };
  } catch {
    return { workedDays: 30, paidDays: 30, lopDays: 0 };
  }
}

// ── Payroll Runs ─────────────────────────────────────────────────

async function listRuns({ schoolId = SCHOOL_ID } = {}) {
  const snap = await runsCol().where("schoolId", "==", schoolId).get();
  const rows = snap.docs.map(docToRun);
  rows.sort((a, b) => (b.year - a.year) || (b.month - a.month));
  return rows;
}

async function getRun(id) {
  const snap = await runsCol().doc(id).get();
  return snap.exists ? docToRun(snap) : null;
}

async function _getStaff(staffId) {
  const snap = await db.collection("staff").doc(staffId).get();
  if (snap.exists) return { staffId: snap.id, ...snap.data() };
  const q = await db.collection("staff").where("staffId", "==", staffId).limit(1).get();
  return q.empty ? null : { staffId: q.docs[0].id, ...q.docs[0].data() };
}

async function processRun({ year, month, schoolId = SCHOOL_ID, tenantId, centerId, actorUserId = "system" }) {
  if (!year || !month) { const e = new Error("year and month required."); e.code = "VALIDATION"; throw e; }
  const components = await listComponents({ schoolId, tenantId, active: true });
  const componentMap = Object.fromEntries(components.map(c => [c.componentId, c]));

  // Existing run for this period?
  const existing = await runsCol().where("schoolId", "==", schoolId).where("year", "==", year).where("month", "==", month).limit(1).get();
  let runRef, runDoc;
  if (!existing.empty) {
    runRef = existing.docs[0].ref;
    runDoc = existing.docs[0].data();
    if (runDoc.status === "locked") { const e = new Error("This payroll run is locked."); e.code = "VALIDATION"; throw e; }
  } else {
    runRef = runsCol().doc();
    runDoc = {
      runId: runRef.id, tenantId: tenantId || schoolId, schoolId, centerId: centerId || "",
      year, month, status: "draft", totals: { gross: 0, deductions: 0, net: 0, employees: 0 },
      processedAt: "", processedBy: "", lockedAt: "", lockedBy: "",
      createdAt: nowISO(), updatedAt: nowISO(), createdBy: actorUserId, updatedBy: actorUserId,
    };
    await runRef.set(runDoc);
  }

  // Process payslips for every staff with a configured salary
  const salaries = await listStaffSalary({ schoolId });
  let totalGross = 0, totalDed = 0, totalNet = 0, employees = 0;

  for (const salary of salaries) {
    if (!salary.monthlyCtc) continue;
    const staff = await _getStaff(salary.staffId);
    if (!staff) continue;
    const att   = await _attendanceForMonth({ schoolId, staffId: salary.staffId, year, month });
    const comp  = await _computePayslipFor({ schoolId, staff, salary, run: runDoc, componentMap, attendanceSummary: att });

    const payslipId = `${runRef.id}_${salary.staffId}`;
    const ref = payslipsCol().doc(payslipId);
    const doc = {
      payslipId, runId: runRef.id,
      tenantId: runDoc.tenantId, schoolId, centerId: staff.centerId || "",
      staffId: salary.staffId, employeeCode: staff.employeeCode || "", displayName: staff.displayName || "",
      designationName: staff.designationName || "", departmentName: staff.departmentName || "",
      year, month,
      ...comp,
      paymentMode: salary.paymentMode || "", bankAccountLast4: salary.bankAccountLast4 || "",
      pdfUrl: "", notes: "",
      deletedAt: "", deletedBy: "",
      createdAt: nowISO(), updatedAt: nowISO(),
    };
    await ref.set(doc);
    totalGross += comp.gross; totalDed += comp.totalDeductions; totalNet += comp.net; employees++;
  }

  const totals = { gross: _round(totalGross), deductions: _round(totalDed), net: _round(totalNet), employees };
  await runRef.update({
    status: "processed", totals,
    processedAt: nowISO(), processedBy: actorUserId,
    updatedAt: nowISO(), updatedBy: actorUserId,
  });

  return { ...runDoc, runId: runRef.id, status: "processed", totals };
}

async function lockRun(id, { actorUserId = "system" } = {}) {
  const ref = runsCol().doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  await ref.update({ status: "locked", lockedAt: nowISO(), lockedBy: actorUserId, updatedAt: nowISO(), updatedBy: actorUserId });
  return docToRun(await ref.get());
}

async function reopenRun(id, { actorUserId = "system" } = {}) {
  const ref = runsCol().doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  await ref.update({ status: "processed", lockedAt: "", lockedBy: "", updatedAt: nowISO(), updatedBy: actorUserId });
  return docToRun(await ref.get());
}

// ── Payslips ─────────────────────────────────────────────────────

async function listPayslips({ schoolId = SCHOOL_ID, runId, year, month, staffId } = {}) {
  let q = payslipsCol().where("schoolId", "==", schoolId);
  if (runId)   q = q.where("runId", "==", runId);
  if (year)    q = q.where("year", "==", Number(year));
  if (month)   q = q.where("month", "==", Number(month));
  if (staffId) q = q.where("staffId", "==", staffId);
  const snap = await q.get();
  const rows = snap.docs.map(docToPayslip).filter(r => !r.deletedAt);
  rows.sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""));
  return rows;
}

async function getPayslip(id) {
  const snap = await payslipsCol().doc(id).get();
  return snap.exists ? docToPayslip(snap) : null;
}

async function myPayslips({ schoolId = SCHOOL_ID, staffId }) {
  return listPayslips({ schoolId, staffId });
}

// ── Bank Transfer Report ─────────────────────────────────────────

async function bankTransferReport({ schoolId = SCHOOL_ID, runId }) {
  const run = runId ? await getRun(runId) : null;
  const payslips = await listPayslips({ schoolId, runId });
  const rows = payslips.map(p => ({
    employeeCode: p.employeeCode, displayName: p.displayName,
    bankAccountLast4: p.bankAccountLast4, paymentMode: p.paymentMode,
    net: p.net,
  }));
  const total = rows.reduce((s, r) => s + r.net, 0);
  return { run, total, rows };
}

module.exports = {
  // Components
  listComponents, getComponent, createComponent, updateComponent, removeComponent,
  // Structures
  listStructures, getStructure, createStructure, updateStructure, removeStructure,
  // Staff salary
  listStaffSalary, getStaffSalary, upsertStaffSalary, removeStaffSalary,
  // Runs
  listRuns, getRun, processRun, lockRun, reopenRun,
  // Payslips
  listPayslips, getPayslip, myPayslips,
  // Reports
  bankTransferReport,
};
