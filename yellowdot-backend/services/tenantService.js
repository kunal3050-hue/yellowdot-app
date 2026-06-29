/**
 * tenantService.js — Multi-tenant preschool registry
 *
 * Each tenant === one preschool, keyed by tenantId === schoolId.
 * This preserves full backwards-compatibility: existing data in every
 * collection continues to work because schoolId values are unchanged.
 *
 * Tenant document schema:
 * {
 *   tenantId:         string   (= schoolId, e.g. "yd-main", "abc-preschool")
 *   schoolName:       string
 *   slug:             string   (URL-safe identifier, unique)
 *   logo:             string   (storage URL or base64 data URI)
 *   subscriptionPlan: "trial" | "starter" | "professional" | "enterprise"
 *   status:           "trial" | "active" | "suspended" | "cancelled"
 *   trialEndsAt:      ISO string (null for paid plans)
 *   branches:         [{ branchId, name, address, phone, centerId }]
 *   adminUsers:       [{ userId, email, name, role }]
 *   academicYears:    [{ yearId, label, startDate, endDate, current }]
 *   contactEmail:     string
 *   contactPhone:     string
 *   address:          string
 *   city:             string
 *   country:          string
 *   timezone:         string
 *   currency:         string
 *   maxStudents:      number  (0 = unlimited)
 *   maxStaff:         number  (0 = unlimited)
 *   createdAt:        ISO string
 *   updatedAt:        ISO string
 *   createdBy:        userId (super_admin who created this tenant)
 * }
 */

const { db } = require("../firebaseAdmin");

const TENANTS_COL = "tenants";
const AUDIT_COL   = "tenantAuditLogs";

const tenantCol = () => db.collection(TENANTS_COL);
const auditCol  = () => db.collection(AUDIT_COL);

// ── Helpers ────────────────────────────────────────────────────────────────────

function docToTenant(snap) {
  return { id: snap.id, ...snap.data() };
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function _logAudit(action, { tenantId, actorUserId, actorEmail, meta = {} } = {}) {
  await auditCol().add({
    tenantId,
    action,
    actorUserId: actorUserId || "system",
    actorEmail:  actorEmail  || "",
    meta,
    createdAt: new Date().toISOString(),
  });
}

// ── Reads ──────────────────────────────────────────────────────────────────────

async function getAll({ status, plan, search } = {}) {
  const snap = await tenantCol().orderBy("createdAt", "desc").get();
  let tenants = snap.docs.map(docToTenant);

  if (status) tenants = tenants.filter(t => t.status === status);
  if (plan)   tenants = tenants.filter(t => t.subscriptionPlan === plan);
  if (search) {
    const q = search.toLowerCase();
    tenants = tenants.filter(t =>
      t.schoolName?.toLowerCase().includes(q) ||
      t.tenantId?.toLowerCase().includes(q)   ||
      t.contactEmail?.toLowerCase().includes(q),
    );
  }
  return tenants;
}

async function getById(tenantId) {
  const snap = await tenantCol().doc(tenantId).get();
  if (!snap.exists) return null;
  return docToTenant(snap);
}

async function getBySlug(slug) {
  const snap = await tenantCol().where("slug", "==", slug).limit(1).get();
  if (snap.empty) return null;
  return docToTenant(snap.docs[0]);
}

// ── Writes ─────────────────────────────────────────────────────────────────────

async function create(data, { actorUserId, actorEmail } = {}) {
  const {
    schoolName,
    tenantId: providedId,
    subscriptionPlan = "trial",
    contactEmail,
    contactPhone,
    address,
    city,
    country    = "India",
    timezone   = "Asia/Kolkata",
    currency   = "INR",
    maxStudents = 0,
    maxStaff    = 0,
    logo        = "",
    branches    = [],
    adminUsers  = [],
    academicYears = [],
  } = data;

  if (!schoolName) throw new Error("schoolName is required");

  const slug     = slugify(schoolName);
  const tenantId = providedId || slug;

  // Prevent duplicates
  const existing = await tenantCol().doc(tenantId).get();
  if (existing.exists) throw new Error(`Tenant '${tenantId}' already exists`);

  const slugSnap = await tenantCol().where("slug", "==", slug).limit(1).get();
  if (!slugSnap.empty && slugSnap.docs[0].id !== tenantId) {
    throw new Error(`A tenant with slug '${slug}' already exists`);
  }

  const now = new Date().toISOString();
  const trialEndsAt = subscriptionPlan === "trial"
    ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const doc = {
    tenantId,
    schoolName,
    slug,
    logo,
    subscriptionPlan,
    status:       subscriptionPlan === "trial" ? "trial" : "active",
    trialEndsAt,
    branches,
    adminUsers,
    academicYears,
    contactEmail:  contactEmail || "",
    contactPhone:  contactPhone || "",
    address:       address || "",
    city:          city    || "",
    country,
    timezone,
    currency,
    maxStudents,
    maxStaff,
    createdAt:     now,
    updatedAt:     now,
    createdBy:     actorUserId || "system",
  };

  await tenantCol().doc(tenantId).set(doc);
  await _logAudit("tenant.created", { tenantId, actorUserId, actorEmail, meta: { schoolName, subscriptionPlan } });

  return doc;
}

async function update(tenantId, updates, { actorUserId, actorEmail } = {}) {
  const ref = tenantCol().doc(tenantId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error(`Tenant '${tenantId}' not found`);

  // Strip immutable fields
  const { tenantId: _1, createdAt: _2, createdBy: _3, ...safeUpdates } = updates;

  const payload = { ...safeUpdates, updatedAt: new Date().toISOString() };
  await ref.update(payload);

  await _logAudit("tenant.updated", { tenantId, actorUserId, actorEmail, meta: Object.keys(safeUpdates) });
  return { ...snap.data(), ...payload };
}

async function setStatus(tenantId, status, { actorUserId, actorEmail, reason } = {}) {
  const allowed = ["trial", "active", "suspended", "cancelled"];
  if (!allowed.includes(status)) throw new Error(`Invalid status '${status}'`);

  await update(tenantId, { status }, { actorUserId, actorEmail });
  await _logAudit(`tenant.${status}`, { tenantId, actorUserId, actorEmail, meta: { reason } });
  return getById(tenantId);
}

async function remove(tenantId, { actorUserId, actorEmail } = {}) {
  const snap = await tenantCol().doc(tenantId).get();
  if (!snap.exists) throw new Error(`Tenant '${tenantId}' not found`);

  // Soft-delete: mark cancelled rather than hard-delete to preserve audit trail
  await update(tenantId, { status: "cancelled", deletedAt: new Date().toISOString(), deletedBy: actorUserId }, { actorUserId, actorEmail });
  await _logAudit("tenant.deleted", { tenantId, actorUserId, actorEmail });
}

// ── Branches ───────────────────────────────────────────────────────────────────

async function addBranch(tenantId, branch, { actorUserId, actorEmail } = {}) {
  const tenant = await getById(tenantId);
  if (!tenant) throw new Error(`Tenant '${tenantId}' not found`);

  const branchId = branch.branchId || `${tenantId}-branch-${Date.now()}`;
  const newBranch = { branchId, ...branch, createdAt: new Date().toISOString() };
  const branches = [...(tenant.branches || []), newBranch];

  await update(tenantId, { branches }, { actorUserId, actorEmail });
  await _logAudit("tenant.branch.added", { tenantId, actorUserId, actorEmail, meta: { branchId } });
  return newBranch;
}

async function removeBranch(tenantId, branchId, { actorUserId, actorEmail } = {}) {
  const tenant = await getById(tenantId);
  if (!tenant) throw new Error(`Tenant '${tenantId}' not found`);

  const branches = (tenant.branches || []).filter(b => b.branchId !== branchId);
  await update(tenantId, { branches }, { actorUserId, actorEmail });
  await _logAudit("tenant.branch.removed", { tenantId, actorUserId, actorEmail, meta: { branchId } });
}

// ── Academic Years ─────────────────────────────────────────────────────────────

async function upsertAcademicYear(tenantId, year, { actorUserId, actorEmail } = {}) {
  const tenant = await getById(tenantId);
  if (!tenant) throw new Error(`Tenant '${tenantId}' not found`);

  const yearId  = year.yearId || `ay-${Date.now()}`;
  const existing = (tenant.academicYears || []).filter(y => y.yearId !== yearId);

  // If setting this year as current, unset others
  let updated = existing;
  if (year.current) updated = updated.map(y => ({ ...y, current: false }));

  updated = [...updated, { yearId, ...year }];
  await update(tenantId, { academicYears: updated }, { actorUserId, actorEmail });
  return { yearId, ...year };
}

// ── Analytics (aggregate across all tenants) ──────────────────────────────────

async function getAnalytics() {
  const tenants = await getAll();

  const byStatus = tenants.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {});

  const byPlan = tenants.reduce((acc, t) => {
    acc[t.subscriptionPlan] = (acc[t.subscriptionPlan] || 0) + 1;
    return acc;
  }, {});

  return {
    total:    tenants.length,
    byStatus,
    byPlan,
    newest:   tenants.slice(0, 5),
  };
}

// ── Audit log ─────────────────────────────────────────────────────────────────

async function getAuditLogs({ tenantId, limit = 50 } = {}) {
  let q = auditCol().orderBy("createdAt", "desc").limit(limit);
  if (tenantId) q = auditCol().where("tenantId", "==", tenantId).orderBy("createdAt", "desc").limit(limit);
  const snap = await q.get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Impersonation (audit-logged) ──────────────────────────────────────────────

async function logImpersonation(tenantId, { actorUserId, actorEmail, targetSchoolId } = {}) {
  await _logAudit("tenant.impersonated", {
    tenantId,
    actorUserId,
    actorEmail,
    meta: { targetSchoolId, timestamp: new Date().toISOString() },
  });
}

module.exports = {
  getAll,
  getById,
  getBySlug,
  create,
  update,
  setStatus,
  remove,
  addBranch,
  removeBranch,
  upsertAcademicYear,
  getAnalytics,
  getAuditLogs,
  logImpersonation,
};
