/**
 * performanceService.js — Performance Management
 * ───────────────────────────────────────────────
 * Collections:
 *   performanceKpis/{id}        — KPI definitions
 *   performanceReviews/{id}     — Review cycle entries per staff per period
 *   performanceGoals/{id}       — SMART goals per staff
 *   parentFeedback/{id}         — Parent feedback ratings/comments for teachers
 *   staffPromotions/{id}        — Promotion history
 *   staffAwards/{id}            — Awards & recognition
 *   performanceTimeline/{id}    — Append-only event log per staff
 *
 * Tenant-safe + soft-delete + audit fields on every row.
 *
 * AI-ready Performance Summary:
 *   getAiSummary({ staffId }) returns a structured JSON document that can be
 *   fed directly to an LLM for narrative generation (no LLM call done here).
 */

const { db } = require("../firebaseAdmin");
const SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";

const kpiCol        = () => db.collection("performanceKpis");
const reviewCol     = () => db.collection("performanceReviews");
const goalCol       = () => db.collection("performanceGoals");
const feedbackCol   = () => db.collection("parentFeedback");
const promotionCol  = () => db.collection("staffPromotions");
const awardCol      = () => db.collection("staffAwards");
const timelineCol   = () => db.collection("performanceTimeline");
const nowISO        = () => new Date().toISOString();

const KPI_TYPES   = new Set(["percent", "score", "count", "currency", "boolean"]);
const REVIEW_STATUSES = new Set(["draft", "submitted", "acknowledged"]);
const GOAL_STATUSES   = new Set(["not_started", "in_progress", "completed", "overdue", "cancelled"]);

// ── Defaults seeded on first read ───────────────────────────────

const DEFAULT_KPIS = [
  { code: "ATTN",  name: "Attendance %",         type: "percent",  target: 95, weight: 20, sortOrder: 10 },
  { code: "PUNCT", name: "Punctuality (late events)", type: "count", target: 2, weight: 10, sortOrder: 20, lowerIsBetter: true },
  { code: "PFB",   name: "Parent Feedback Score (out of 5)", type: "score", target: 4.5, weight: 25, sortOrder: 30 },
  { code: "OBS",   name: "Observation Quality (manager rating)", type: "score", target: 4, weight: 20, sortOrder: 40 },
  { code: "GOALS", name: "Goal Completion %",    type: "percent",  target: 80, weight: 15, sortOrder: 50 },
  { code: "INC",   name: "Incident-Free Days",   type: "count",    target: 60, weight: 10, sortOrder: 60 },
];

const _seededKpis = new Set();
async function _seedKpis(schoolId, tenantId) {
  if (_seededKpis.has(schoolId)) return;
  const snap = await kpiCol().where("schoolId", "==", schoolId).limit(1).get();
  if (!snap.empty) { _seededKpis.add(schoolId); return; }
  const batch = db.batch();
  const now   = nowISO();
  for (const k of DEFAULT_KPIS) {
    const ref = kpiCol().doc();
    batch.set(ref, {
      kpiId: ref.id, tenantId: tenantId || schoolId, schoolId, centerId: "",
      code: k.code, name: k.name, type: k.type, target: Number(k.target || 0),
      weight: Number(k.weight || 0), lowerIsBetter: Boolean(k.lowerIsBetter),
      active: true, isSystem: true, sortOrder: k.sortOrder,
      createdAt: now, updatedAt: now, createdBy: "system-seed", updatedBy: "system-seed",
    });
  }
  await batch.commit();
  _seededKpis.add(schoolId);
}

// ── Mappers ───────────────────────────────────────────────────────

function _base(d, id, idKey) {
  return {
    [idKey]: d[idKey] || id,
    tenantId: d.tenantId || d.schoolId || SCHOOL_ID,
    schoolId: d.schoolId || SCHOOL_ID, centerId: d.centerId || "",
    deletedAt: d.deletedAt || "", deletedBy: d.deletedBy || "",
    createdAt: d.createdAt || "", updatedAt: d.updatedAt || "",
    createdBy: d.createdBy || "", updatedBy: d.updatedBy || "",
  };
}

function docToKpi(snap) {
  const d = snap.data ? snap.data() : snap; const id = snap.id || d.kpiId || "";
  return { ..._base(d, id, "kpiId"),
    code: d.code || "", name: d.name || "", type: d.type || "score",
    target: Number(d.target || 0), weight: Number(d.weight || 0),
    lowerIsBetter: Boolean(d.lowerIsBetter),
    active: d.active !== false, isSystem: Boolean(d.isSystem),
    sortOrder: typeof d.sortOrder === "number" ? d.sortOrder : 0,
  };
}

function docToReview(snap) {
  const d = snap.data ? snap.data() : snap; const id = snap.id || d.reviewId || "";
  return { ..._base(d, id, "reviewId"),
    staffId: d.staffId || "", employeeCode: d.employeeCode || "", displayName: d.displayName || "",
    designationName: d.designationName || "", departmentName: d.departmentName || "",
    period: d.period || "",                       // "Q1-2026" / "FY-2026" / "2026-06"
    reviewerId: d.reviewerId || "", reviewerName: d.reviewerName || "",
    kpiScores: d.kpiScores || {},                 // { kpiId: { score, target, weighted, comment } }
    rating:    Number(d.rating || 0),             // overall 1-5
    strengths: d.strengths || "",
    improvements: d.improvements || "",
    comment:   d.comment || "",
    status:    d.status || "draft",
    submittedAt: d.submittedAt || "", acknowledgedAt: d.acknowledgedAt || "",
  };
}

function docToGoal(snap) {
  const d = snap.data ? snap.data() : snap; const id = snap.id || d.goalId || "";
  return { ..._base(d, id, "goalId"),
    staffId: d.staffId || "", displayName: d.displayName || "",
    title: d.title || "", description: d.description || "",
    period: d.period || "",
    targetDate: d.targetDate || "",
    weight: Number(d.weight || 0),
    progress: Number(d.progress || 0),
    status: d.status || "not_started",
    notes: d.notes || "",
  };
}

function docToFeedback(snap) {
  const d = snap.data ? snap.data() : snap; const id = snap.id || d.feedbackId || "";
  return { ..._base(d, id, "feedbackId"),
    staffId: d.staffId || "", displayName: d.displayName || "",
    parentId: d.parentId || "", parentName: d.parentName || "",
    studentId: d.studentId || "", studentName: d.studentName || "",
    rating: Number(d.rating || 0),
    comment: d.comment || "",
    periodKey: d.periodKey || "",
    source: d.source || "parent_app",
    visible: d.visible !== false,
  };
}

function docToPromotion(snap) {
  const d = snap.data ? snap.data() : snap; const id = snap.id || d.promotionId || "";
  return { ..._base(d, id, "promotionId"),
    staffId: d.staffId || "", displayName: d.displayName || "",
    effectiveDate: d.effectiveDate || "",
    fromDesignation: d.fromDesignation || "",
    toDesignation:   d.toDesignation || "",
    salaryChange:    Number(d.salaryChange || 0),
    citation: d.citation || "",
  };
}

function docToAward(snap) {
  const d = snap.data ? snap.data() : snap; const id = snap.id || d.awardId || "";
  return { ..._base(d, id, "awardId"),
    staffId: d.staffId || "", displayName: d.displayName || "",
    title: d.title || "", category: d.category || "recognition",
    awardedOn: d.awardedOn || "", awardedBy: d.awardedBy || "",
    citation: d.citation || "", iconUrl: d.iconUrl || "",
  };
}

function docToTimeline(snap) {
  const d = snap.data ? snap.data() : snap; const id = snap.id || d.eventId || "";
  return {
    eventId: d.eventId || id,
    tenantId: d.tenantId || d.schoolId || SCHOOL_ID,
    schoolId: d.schoolId || SCHOOL_ID,
    staffId: d.staffId || "",
    type: d.type || "", description: d.description || "",
    metadata: d.metadata || {},
    actorUserId: d.actorUserId || "",
    createdAt: d.createdAt || "",
  };
}

// ── Helpers ─────────────────────────────────────────────────────

async function _getStaff(staffId) {
  const snap = await db.collection("staff").doc(staffId).get();
  if (snap.exists) return { staffId: snap.id, ...snap.data() };
  const q = await db.collection("staff").where("staffId", "==", staffId).limit(1).get();
  return q.empty ? null : { staffId: q.docs[0].id, ...q.docs[0].data() };
}

async function _logEvent(staffId, schoolId, ev) {
  try {
    const ref = timelineCol().doc();
    await ref.set({
      eventId: ref.id, tenantId: schoolId, schoolId,
      staffId, type: ev.type, description: ev.description || "",
      metadata: ev.metadata || {}, actorUserId: ev.actorUserId || "system",
      createdAt: nowISO(),
    });
  } catch (err) { console.warn("[performanceService] log failed:", err.message); }
}

// ── KPIs ────────────────────────────────────────────────────────

async function listKpis({ schoolId = SCHOOL_ID, tenantId, active } = {}) {
  await _seedKpis(schoolId, tenantId).catch(err => console.warn("[performanceService] seed kpis failed:", err.message));
  const snap = await kpiCol().where("schoolId", "==", schoolId).get();
  let rows = snap.docs.map(docToKpi);
  if (active !== undefined) rows = rows.filter(r => r.active === (active !== false && active !== "false"));
  rows.sort((a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name));
  return rows;
}

async function createKpi(data, { schoolId = SCHOOL_ID, tenantId, actorUserId = "system" } = {}) {
  if (!data.name) { const e = new Error("KPI name is required."); e.code = "VALIDATION"; throw e; }
  if (data.type && !KPI_TYPES.has(data.type)) { const e = new Error("Invalid KPI type."); e.code = "VALIDATION"; throw e; }
  const ref = kpiCol().doc();
  const doc = {
    kpiId: ref.id, tenantId: tenantId || schoolId, schoolId, centerId: (data.centerId || "").trim(),
    code: (data.code || "").trim().toUpperCase(),
    name: data.name.trim(),
    type: data.type || "score",
    target: Number(data.target || 0),
    weight: Number(data.weight || 0),
    lowerIsBetter: Boolean(data.lowerIsBetter),
    active: data.active !== false, isSystem: false,
    sortOrder: Number(data.sortOrder) || 0,
    createdAt: nowISO(), updatedAt: nowISO(), createdBy: actorUserId, updatedBy: actorUserId,
  };
  await ref.set(doc);
  return docToKpi(doc);
}

async function updateKpi(id, data, { actorUserId = "system" } = {}) {
  const ref = kpiCol().doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const updates = { updatedAt: nowISO(), updatedBy: actorUserId };
  ["name","code","type","centerId"].forEach(k => { if (data[k] !== undefined) updates[k] = String(data[k]).trim(); });
  if (updates.code) updates.code = updates.code.toUpperCase();
  ["target","weight","sortOrder"].forEach(k => { if (data[k] !== undefined) updates[k] = Number(data[k]) || 0; });
  ["active","lowerIsBetter"].forEach(k => { if (data[k] !== undefined) updates[k] = Boolean(data[k]); });
  await ref.update(updates);
  return docToKpi(await ref.get());
}

async function removeKpi(id) {
  const snap = await kpiCol().doc(id).get();
  if (!snap.exists) return false;
  if (snap.data().isSystem) { const e = new Error("System KPIs cannot be deleted."); e.code = "IN_USE"; throw e; }
  await kpiCol().doc(id).delete();
  return true;
}

// ── Reviews ─────────────────────────────────────────────────────

async function listReviews({ schoolId = SCHOOL_ID, staffId, period, status, includeDeleted = false } = {}) {
  let q = reviewCol().where("schoolId", "==", schoolId);
  if (staffId) q = q.where("staffId", "==", staffId);
  const snap = await q.get();
  let rows = snap.docs.map(docToReview);
  if (!includeDeleted) rows = rows.filter(r => !r.deletedAt);
  if (period) rows = rows.filter(r => r.period === period);
  if (status) rows = rows.filter(r => r.status === status);
  rows.sort((a, b) => (b.period || "").localeCompare(a.period || ""));
  return rows;
}

async function getReview(id) {
  const snap = await reviewCol().doc(id).get();
  return snap.exists ? docToReview(snap) : null;
}

async function upsertReview(data, { schoolId = SCHOOL_ID, tenantId, actorUserId = "system", actorName = "Reviewer" } = {}) {
  if (!data.staffId || !data.period) { const e = new Error("staffId and period required."); e.code = "VALIDATION"; throw e; }
  if (data.status && !REVIEW_STATUSES.has(data.status)) { const e = new Error("Invalid status."); e.code = "VALIDATION"; throw e; }

  const staff = await _getStaff(data.staffId);
  if (!staff) { const e = new Error("Staff not found."); e.code = "VALIDATION"; throw e; }

  let ref, snap;
  if (data.reviewId) {
    ref  = reviewCol().doc(data.reviewId);
    snap = await ref.get();
    if (!snap.exists) ref = reviewCol().doc();
  } else {
    // Find by staff+period
    const q = await reviewCol().where("schoolId", "==", schoolId).where("staffId", "==", staff.staffId).where("period", "==", data.period).limit(1).get();
    ref  = q.empty ? reviewCol().doc() : q.docs[0].ref;
    snap = q.empty ? null : q.docs[0];
  }

  const doc = {
    reviewId: ref.id,
    tenantId: tenantId || schoolId, schoolId, centerId: staff.centerId || "",
    staffId: staff.staffId, employeeCode: staff.employeeCode || "", displayName: staff.displayName || "",
    designationName: staff.designationName || "", departmentName: staff.departmentName || "",
    period: data.period,
    reviewerId: actorUserId, reviewerName: actorName,
    kpiScores: data.kpiScores || {},
    rating: Number(data.rating || 0),
    strengths: data.strengths || "", improvements: data.improvements || "", comment: data.comment || "",
    status: data.status || (snap?.data().status) || "draft",
    submittedAt: data.status === "submitted" ? nowISO() : (snap?.data().submittedAt || ""),
    acknowledgedAt: data.status === "acknowledged" ? nowISO() : (snap?.data().acknowledgedAt || ""),
    deletedAt: "", deletedBy: "",
    createdAt: snap ? (snap.data().createdAt || nowISO()) : nowISO(),
    createdBy: snap ? (snap.data().createdBy || actorUserId) : actorUserId,
    updatedAt: nowISO(), updatedBy: actorUserId,
  };
  await ref.set(doc, { merge: false });

  await _logEvent(staff.staffId, schoolId, {
    type: "REVIEW_" + doc.status.toUpperCase(),
    description: `Review for ${doc.period} ${doc.status}`,
    metadata: { period: doc.period, rating: doc.rating },
    actorUserId,
  });

  return docToReview(doc);
}

async function removeReview(id, { actorUserId = "system" } = {}) {
  const ref = reviewCol().doc(id);
  const snap = await ref.get();
  if (!snap.exists) return false;
  await ref.update({ deletedAt: nowISO(), deletedBy: actorUserId, updatedAt: nowISO(), updatedBy: actorUserId });
  return true;
}

// ── Goals ───────────────────────────────────────────────────────

async function listGoals({ schoolId = SCHOOL_ID, staffId, status, period, includeDeleted = false } = {}) {
  let q = goalCol().where("schoolId", "==", schoolId);
  if (staffId) q = q.where("staffId", "==", staffId);
  const snap = await q.get();
  let rows = snap.docs.map(docToGoal);
  if (!includeDeleted) rows = rows.filter(r => !r.deletedAt);
  if (status) rows = rows.filter(r => r.status === status);
  if (period) rows = rows.filter(r => r.period === period);
  rows.sort((a, b) => (a.targetDate || "").localeCompare(b.targetDate || ""));
  return rows;
}

async function upsertGoal(data, { schoolId = SCHOOL_ID, tenantId, actorUserId = "system" } = {}) {
  if (!data.staffId || !data.title) { const e = new Error("staffId and title required."); e.code = "VALIDATION"; throw e; }
  if (data.status && !GOAL_STATUSES.has(data.status)) { const e = new Error("Invalid goal status."); e.code = "VALIDATION"; throw e; }
  const staff = await _getStaff(data.staffId);
  if (!staff) { const e = new Error("Staff not found."); e.code = "VALIDATION"; throw e; }

  let ref, snap;
  if (data.goalId) {
    ref  = goalCol().doc(data.goalId);
    snap = await ref.get();
    if (!snap.exists) ref = goalCol().doc();
  } else {
    ref = goalCol().doc();
  }

  const doc = {
    goalId: ref.id,
    tenantId: tenantId || schoolId, schoolId, centerId: staff.centerId || "",
    staffId: staff.staffId, displayName: staff.displayName || "",
    title: data.title.trim(),
    description: (data.description || "").trim(),
    period: data.period || "",
    targetDate: data.targetDate || "",
    weight: Number(data.weight || 0),
    progress: Math.max(0, Math.min(100, Number(data.progress || 0))),
    status: data.status || "not_started",
    notes: data.notes || "",
    deletedAt: "", deletedBy: "",
    createdAt: snap ? (snap.data().createdAt || nowISO()) : nowISO(),
    createdBy: snap ? (snap.data().createdBy || actorUserId) : actorUserId,
    updatedAt: nowISO(), updatedBy: actorUserId,
  };
  await ref.set(doc, { merge: false });
  await _logEvent(staff.staffId, schoolId, { type: "GOAL_UPDATED", description: `${doc.title} → ${doc.status}`, metadata: { progress: doc.progress }, actorUserId });
  return docToGoal(doc);
}

async function removeGoal(id, { actorUserId = "system" } = {}) {
  const ref = goalCol().doc(id);
  const snap = await ref.get();
  if (!snap.exists) return false;
  await ref.update({ deletedAt: nowISO(), deletedBy: actorUserId, updatedAt: nowISO(), updatedBy: actorUserId });
  return true;
}

// ── Parent Feedback ─────────────────────────────────────────────

async function listFeedback({ schoolId = SCHOOL_ID, staffId, periodKey, includeDeleted = false } = {}) {
  let q = feedbackCol().where("schoolId", "==", schoolId);
  if (staffId) q = q.where("staffId", "==", staffId);
  const snap = await q.get();
  let rows = snap.docs.map(docToFeedback);
  if (!includeDeleted) rows = rows.filter(r => !r.deletedAt);
  if (periodKey) rows = rows.filter(r => r.periodKey === periodKey);
  rows.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return rows;
}

async function createFeedback(data, { schoolId = SCHOOL_ID, tenantId, actorUserId = "system" } = {}) {
  if (!data.staffId || !data.rating) { const e = new Error("staffId and rating required."); e.code = "VALIDATION"; throw e; }
  if (data.rating < 1 || data.rating > 5) { const e = new Error("rating must be 1–5."); e.code = "VALIDATION"; throw e; }
  const staff = await _getStaff(data.staffId);
  if (!staff) { const e = new Error("Staff not found."); e.code = "VALIDATION"; throw e; }
  const ref = feedbackCol().doc();
  const doc = {
    feedbackId: ref.id,
    tenantId: tenantId || schoolId, schoolId, centerId: staff.centerId || "",
    staffId: staff.staffId, displayName: staff.displayName || "",
    parentId: data.parentId || "", parentName: data.parentName || "",
    studentId: data.studentId || "", studentName: data.studentName || "",
    rating: Number(data.rating), comment: (data.comment || "").trim(),
    periodKey: data.periodKey || new Date().toISOString().slice(0, 7),
    source: data.source || "parent_app",
    visible: data.visible !== false,
    deletedAt: "", deletedBy: "",
    createdAt: nowISO(), updatedAt: nowISO(), createdBy: actorUserId, updatedBy: actorUserId,
  };
  await ref.set(doc);
  await _logEvent(staff.staffId, schoolId, { type: "PARENT_FEEDBACK", description: `Rated ${doc.rating}/5 by ${doc.parentName || "a parent"}`, metadata: { rating: doc.rating }, actorUserId });
  return docToFeedback(doc);
}

async function removeFeedback(id, { actorUserId = "system" } = {}) {
  const ref = feedbackCol().doc(id);
  const snap = await ref.get();
  if (!snap.exists) return false;
  await ref.update({ deletedAt: nowISO(), deletedBy: actorUserId, updatedAt: nowISO(), updatedBy: actorUserId });
  return true;
}

async function feedbackSummary({ schoolId = SCHOOL_ID, staffId }) {
  const rows = await listFeedback({ schoolId, staffId });
  if (!rows.length) return { count: 0, average: 0, distribution: {1:0,2:0,3:0,4:0,5:0} };
  const dist = {1:0,2:0,3:0,4:0,5:0};
  let total = 0;
  rows.forEach(r => { dist[r.rating] = (dist[r.rating] || 0) + 1; total += r.rating; });
  return { count: rows.length, average: Math.round((total / rows.length) * 100) / 100, distribution: dist };
}

// ── Promotions ──────────────────────────────────────────────────

async function listPromotions({ schoolId = SCHOOL_ID, staffId } = {}) {
  let q = promotionCol().where("schoolId", "==", schoolId);
  if (staffId) q = q.where("staffId", "==", staffId);
  const snap = await q.get();
  let rows = snap.docs.map(docToPromotion).filter(r => !r.deletedAt);
  rows.sort((a, b) => (b.effectiveDate || "").localeCompare(a.effectiveDate || ""));
  return rows;
}

async function createPromotion(data, { schoolId = SCHOOL_ID, tenantId, actorUserId = "system" } = {}) {
  if (!data.staffId || !data.toDesignation || !data.effectiveDate) {
    const e = new Error("staffId, toDesignation and effectiveDate required."); e.code = "VALIDATION"; throw e;
  }
  const staff = await _getStaff(data.staffId);
  if (!staff) { const e = new Error("Staff not found."); e.code = "VALIDATION"; throw e; }
  const ref = promotionCol().doc();
  const doc = {
    promotionId: ref.id,
    tenantId: tenantId || schoolId, schoolId, centerId: staff.centerId || "",
    staffId: staff.staffId, displayName: staff.displayName || "",
    effectiveDate: data.effectiveDate,
    fromDesignation: data.fromDesignation || staff.designationName || "",
    toDesignation:   data.toDesignation,
    salaryChange:    Number(data.salaryChange || 0),
    citation:        (data.citation || "").trim(),
    deletedAt: "", deletedBy: "",
    createdAt: nowISO(), updatedAt: nowISO(), createdBy: actorUserId, updatedBy: actorUserId,
  };
  await ref.set(doc);
  await _logEvent(staff.staffId, schoolId, { type: "PROMOTION", description: `Promoted to ${doc.toDesignation}`, metadata: doc, actorUserId });
  return docToPromotion(doc);
}

async function removePromotion(id, { actorUserId = "system" } = {}) {
  const ref = promotionCol().doc(id); const snap = await ref.get();
  if (!snap.exists) return false;
  await ref.update({ deletedAt: nowISO(), deletedBy: actorUserId, updatedAt: nowISO(), updatedBy: actorUserId });
  return true;
}

// ── Awards ──────────────────────────────────────────────────────

async function listAwards({ schoolId = SCHOOL_ID, staffId } = {}) {
  let q = awardCol().where("schoolId", "==", schoolId);
  if (staffId) q = q.where("staffId", "==", staffId);
  const snap = await q.get();
  let rows = snap.docs.map(docToAward).filter(r => !r.deletedAt);
  rows.sort((a, b) => (b.awardedOn || "").localeCompare(a.awardedOn || ""));
  return rows;
}

async function createAward(data, { schoolId = SCHOOL_ID, tenantId, actorUserId = "system", actorName = "Admin" } = {}) {
  if (!data.staffId || !data.title) { const e = new Error("staffId and title required."); e.code = "VALIDATION"; throw e; }
  const staff = await _getStaff(data.staffId);
  if (!staff) { const e = new Error("Staff not found."); e.code = "VALIDATION"; throw e; }
  const ref = awardCol().doc();
  const doc = {
    awardId: ref.id,
    tenantId: tenantId || schoolId, schoolId, centerId: staff.centerId || "",
    staffId: staff.staffId, displayName: staff.displayName || "",
    title: data.title.trim(),
    category: data.category || "recognition",
    awardedOn: data.awardedOn || new Date().toISOString().slice(0, 10),
    awardedBy: data.awardedBy || actorName,
    citation:  (data.citation || "").trim(),
    iconUrl:   data.iconUrl || "",
    deletedAt: "", deletedBy: "",
    createdAt: nowISO(), updatedAt: nowISO(), createdBy: actorUserId, updatedBy: actorUserId,
  };
  await ref.set(doc);
  await _logEvent(staff.staffId, schoolId, { type: "AWARD", description: `Awarded ${doc.title}`, metadata: { title: doc.title, category: doc.category }, actorUserId });
  return docToAward(doc);
}

async function removeAward(id, { actorUserId = "system" } = {}) {
  const ref = awardCol().doc(id); const snap = await ref.get();
  if (!snap.exists) return false;
  await ref.update({ deletedAt: nowISO(), deletedBy: actorUserId, updatedAt: nowISO(), updatedBy: actorUserId });
  return true;
}

// ── Timeline ────────────────────────────────────────────────────

async function timelineFor({ schoolId = SCHOOL_ID, staffId, limit = 100 }) {
  const snap = await timelineCol().where("schoolId", "==", schoolId).where("staffId", "==", staffId).get();
  const rows = snap.docs.map(docToTimeline);
  rows.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return rows.slice(0, limit);
}

// ── Dashboard + AI-ready summary ────────────────────────────────

async function dashboard({ schoolId = SCHOOL_ID, centerId }) {
  const staffSnap = await db.collection("staff").where("schoolId", "==", schoolId).get();
  const staff = staffSnap.docs.map(d => ({ staffId: d.id, ...d.data() }))
    .filter(s => !s.deletedAt && s.active !== false && (!centerId || s.centerId === centerId));

  const [reviews, feedbacks, goals, promotions, awards] = await Promise.all([
    listReviews({ schoolId }), listFeedback({ schoolId }), listGoals({ schoolId }), listPromotions({ schoolId }), listAwards({ schoolId }),
  ]);

  const now = new Date();
  const monthKey = now.toISOString().slice(0, 7);
  const fbMTD = feedbacks.filter(f => f.periodKey === monthKey);
  const avgRating = fbMTD.length ? Math.round((fbMTD.reduce((s, f) => s + f.rating, 0) / fbMTD.length) * 100) / 100 : 0;
  const reviewsPending = reviews.filter(r => r.status === "draft").length;
  const goalsActive    = goals.filter(g => g.status === "in_progress" || g.status === "not_started").length;
  const goalsOverdue   = goals.filter(g => g.status === "overdue").length;

  return {
    totalStaff: staff.length,
    reviewsPending,
    avgParentRatingMTD: avgRating,
    feedbackMTDCount: fbMTD.length,
    goalsActive, goalsOverdue,
    recentAwards: awards.slice(0, 5),
    recentPromotions: promotions.slice(0, 5),
  };
}

async function getAiSummary({ schoolId = SCHOOL_ID, staffId }) {
  const staff = await _getStaff(staffId);
  if (!staff) return null;

  const [reviews, goals, feedbackS, promotions, awards, timeline, kpis] = await Promise.all([
    listReviews({ schoolId, staffId }),
    listGoals({ schoolId, staffId }),
    feedbackSummary({ schoolId, staffId }),
    listPromotions({ schoolId, staffId }),
    listAwards({ schoolId, staffId }),
    timelineFor({ schoolId, staffId, limit: 50 }),
    listKpis({ schoolId }),
  ]);

  // Goal progress aggregate
  const goalsCompleted = goals.filter(g => g.status === "completed").length;
  const goalCompletionPct = goals.length ? Math.round((goalsCompleted / goals.length) * 100) : 0;

  return {
    generatedAt: nowISO(),
    schoolId,
    staff: {
      staffId: staff.staffId, displayName: staff.displayName,
      designation: staff.designationName, department: staff.departmentName,
      category: staff.category, joiningDate: staff.joiningDate,
    },
    snapshot: {
      reviewsCount:  reviews.length,
      latestReview:  reviews[0] || null,
      goalsTotal:    goals.length,
      goalsCompleted, goalCompletionPct,
      parentFeedback:feedbackS,
      promotionsCount: promotions.length,
      awardsCount:     awards.length,
    },
    kpisAvailable: kpis,
    promotions, awards,
    timelinePreview: timeline.slice(0, 20),
    notes: "AI-ready structured summary. Feed this object to an LLM (e.g. Anthropic Claude) for narrative generation.",
  };
}

module.exports = {
  // KPIs
  listKpis, createKpi, updateKpi, removeKpi,
  // Reviews
  listReviews, getReview, upsertReview, removeReview,
  // Goals
  listGoals, upsertGoal, removeGoal,
  // Feedback
  listFeedback, createFeedback, removeFeedback, feedbackSummary,
  // Promotions
  listPromotions, createPromotion, removePromotion,
  // Awards
  listAwards, createAward, removeAward,
  // Timeline + AI summary
  timelineFor, dashboard, getAiSummary,
};
