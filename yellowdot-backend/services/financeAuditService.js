/**
 * financeAuditService.js — audit trail for the Finance Foundation module
 * ────────────────────────────────────────────────────────────────────
 * Collection: financeAuditLogs/{logId}
 * Mirrors tenantService.js's _logAudit() pattern. Every write made by
 * studentLedgerService / ledgerEntryService / billingPlanService /
 * familyAccountService / financeSettingsService calls logFinanceAudit()
 * so "ensure every write operation is audit logged" holds by construction,
 * not by convention someone has to remember.
 *
 * Read-only from the client's perspective — see firestore.rules
 * (`allow write: if false`, backend/Admin-SDK only), same pattern already
 * used for payrollRuns/payslips.
 */
const { db } = require("../firebaseAdmin");

const col    = () => db.collection("financeAuditLogs");
const nowISO = () => new Date().toISOString();

/**
 * logFinanceAudit({ schoolId, actorUserId, action, entityType, entityId, meta })
 * action     e.g. "ledger.create", "ledgerEntry.create", "billingPlan.pause"
 * entityType e.g. "studentLedger", "ledgerEntry", "billingPlan", "familyAccount", "financeSettings"
 */
async function logFinanceAudit({ schoolId, actorUserId, action, entityType, entityId, meta = {} }) {
  const doc = {
    schoolId,
    actorUserId: actorUserId || "system",
    action,
    entityType,
    entityId,
    meta,
    createdAt: nowISO(),
  };
  await col().add(doc);
  return doc;
}

async function listForEntity({ schoolId, entityType, entityId }) {
  const snap = await col()
    .where("schoolId",   "==", schoolId)
    .where("entityType", "==", entityType)
    .where("entityId",   "==", entityId)
    .get();
  return snap.docs
    .map(d => ({ logId: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

/**
 * listForSchool({ schoolId, actorUserId?, entityType?, entityId?, action?,
 *   dateFrom?, dateTo?, limit? })
 * Single-field equality query on schoolId only (the one index Firestore
 * creates automatically) — every other filter is applied in-memory, same
 * approach listForEntity already uses. Fine at pilot-school data volumes;
 * revisit with a composite index if a school's audit log ever grows large
 * enough for this to matter.
 */
async function listForSchool({
  schoolId, actorUserId, entityType, entityId, action, dateFrom, dateTo, limit = 200,
}) {
  const snap = await col().where("schoolId", "==", schoolId).get();
  let rows = snap.docs.map(d => ({ logId: d.id, ...d.data() }));

  if (actorUserId) rows = rows.filter(r => r.actorUserId === actorUserId);
  if (entityType)  rows = rows.filter(r => r.entityType === entityType);
  if (entityId)    rows = rows.filter(r => r.entityId === entityId);
  if (action)      rows = rows.filter(r => r.action === action);
  if (dateFrom)    rows = rows.filter(r => (r.createdAt || "") >= dateFrom);
  if (dateTo)      rows = rows.filter(r => (r.createdAt || "") <= dateTo);

  rows.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return rows.slice(0, Number(limit) || 200);
}

module.exports = { logFinanceAudit, listForEntity, listForSchool };
