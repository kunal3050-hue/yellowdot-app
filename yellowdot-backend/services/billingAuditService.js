/**
 * billingAuditService.js — Billing & Payments · append-only audit trail
 * ─────────────────────────────────────────────────────────────────────────────
 * Collection: feeAuditLog/{entryId}
 *
 * Every mutation of a balance, an invoice or a payment writes one row here,
 * naming the actor, the action, the entity and the before/after amounts. The
 * rule the module is built around: money never changes without a row in this
 * collection, and nothing in this collection is ever updated or deleted.
 *
 * ── Carried over from the deleted implementation ──────────────────────────────
 * This is `financeAuditService.js` from 29d19f9, kept almost verbatim — it was
 * one of the parts of that module that was right. What changed:
 *   - `financeAuditLogs` → `feeAuditLog`. 710dfaf orphaned the old collection
 *     rather than deleting it, so its documents are still live in Firestore and
 *     carry the eleven-collection module's entityTypes. A new name means this
 *     log starts empty and every row in it was written by this module.
 *   - `logFinanceAudit` gained `before`/`after` and `reason`. The old shape put
 *     everything in a free-form `meta`, so "what was this balance before?" was
 *     answerable only if whoever wrote the call site happened to include it.
 *   - Writes go through a caller-supplied transaction when one is given, so a
 *     settlement and its audit row commit together instead of the audit row
 *     being a separate write that can fail on its own.
 *
 * Read-only from the client's perspective: there is no update or delete export
 * here at all, and firestore.rules keeps the collection backend-only, the same
 * pattern payrollRuns and payslips already use.
 */

const { db } = require("../firebaseAdmin");

const col    = () => db.collection("feeAuditLog");
const nowISO = () => new Date().toISOString();

/**
 * Actions this module records. Kept as a frozen list rather than free-form
 * strings so a typo in a call site fails a test instead of quietly creating a
 * category of audit row nothing ever queries.
 */
const ACTIONS = Object.freeze({
  PLAN_CREATE:        "plan.create",
  PLAN_UPDATE:        "plan.update",
  PLAN_DEACTIVATE:    "plan.deactivate",
  INVOICE_CREATE:     "invoice.create",
  INVOICE_GENERATE:   "invoice.generate",
  INVOICE_VOID:       "invoice.void",
  INVOICE_CREDIT:     "invoice.creditNote",
  PAYMENT_RECORD:     "payment.record",
  PAYMENT_REVERSE:    "payment.reverse",
  SETTINGS_UPDATE:    "settings.update",
});

const VALID_ACTIONS = new Set(Object.values(ACTIONS));

/**
 * Build the audit row. Separated from the write so a caller inside a Firestore
 * transaction can stage it with tx.set() and have it land atomically with the
 * money it describes.
 *
 * `before` / `after` hold the amounts that moved — typically
 * { paidAmount, balance, status } for an invoice. They are plain snapshots, not
 * a diff: reading the row should not require replaying anything.
 */
function buildEntry({
  schoolId, centerId = "", actorUserId, action, entityType, entityId,
  amount = null, reason = "", before = null, after = null, meta = {},
}) {
  if (!VALID_ACTIONS.has(action)) {
    const e = new Error(`Unknown billing audit action "${action}".`);
    e.code = "VALIDATION";
    throw e;
  }
  if (!schoolId)   { const e = new Error("Audit entry requires a schoolId.");   e.code = "VALIDATION"; throw e; }
  if (!entityType) { const e = new Error("Audit entry requires an entityType."); e.code = "VALIDATION"; throw e; }

  return {
    schoolId,
    centerId,
    actorUserId: actorUserId || "system",
    action,
    entityType,
    entityId:    entityId || "",
    amount:      amount === null ? null : Number(amount),
    reason:      String(reason || ""),
    before,
    after,
    meta,
    createdAt:   nowISO(),
  };
}

/**
 * Stage an audit row inside an existing Firestore transaction. Use this from
 * any service function that is already in a transaction, so the row and the
 * balance it describes either both commit or neither does.
 */
function logInTransaction(tx, descriptor) {
  const entry = buildEntry(descriptor);
  const ref   = col().doc();
  tx.set(ref, entry);
  return { entryId: ref.id, ...entry };
}

/** Write an audit row on its own, for mutations that need no transaction. */
async function log(descriptor) {
  const entry = buildEntry(descriptor);
  const ref   = await col().add(entry);
  return { entryId: ref.id, ...entry };
}

/**
 * The trail for one entity — "everything that ever happened to this invoice".
 * Two equality filters only, so no composite index is needed; ordering is done
 * in memory, the same approach every list function in this module takes.
 */
async function listForEntity({ schoolId, entityType, entityId }) {
  const snap = await col()
    .where("schoolId", "==", schoolId)
    .where("entityType", "==", entityType)
    .get();

  return snap.docs
    .map(d => ({ entryId: d.id, ...d.data() }))
    .filter(r => r.entityId === entityId)
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

/**
 * The school's whole trail, newest first, filtered in memory.
 * `limit` caps the returned rows, not the read — fine at a single school's
 * volume, and the honest place to revisit with a composite index if a school's
 * log ever grows past it.
 */
async function listForSchool({
  schoolId, actorUserId, entityType, entityId, action, from, to, limit = 200,
} = {}) {
  const snap = await col().where("schoolId", "==", schoolId).get();
  let rows = snap.docs.map(d => ({ entryId: d.id, ...d.data() }));

  if (actorUserId) rows = rows.filter(r => r.actorUserId === actorUserId);
  if (entityType)  rows = rows.filter(r => r.entityType  === entityType);
  if (entityId)    rows = rows.filter(r => r.entityId    === entityId);
  if (action)      rows = rows.filter(r => r.action      === action);
  if (from)        rows = rows.filter(r => (r.createdAt || "") >= from);
  if (to)          rows = rows.filter(r => (r.createdAt || "") <= `${to}\uffff`);

  rows.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  const capped = Number(limit);
  return rows.slice(0, Number.isFinite(capped) && capped > 0 ? capped : 200);
}

module.exports = {
  ACTIONS,
  buildEntry,
  logInTransaction,
  log,
  listForEntity,
  listForSchool,
};
