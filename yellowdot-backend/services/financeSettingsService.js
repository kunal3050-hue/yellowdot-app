/**
 * financeSettingsService.js — Finance Foundation: Finance Settings
 * ────────────────────────────────────────────────────────────────────
 * Collection: financeSettings/{schoolId}  — one singleton doc per school,
 * schoolId-scoped from day one (Domain Architecture Part 1 explicitly
 * calls out NOT repeating the existing `settings/{section}` collection's
 * known technical debt of not being schoolId-scoped).
 *
 * Sprint 1 scope: the settings record itself, readable/writable with
 * sane defaults. Nothing reads these values to drive behavior yet — no
 * rules engine, no automation is wired up this sprint ("do not enable
 * recurring billing"). This is the storage layer future sprints build on.
 */
const { db }              = require("../firebaseAdmin");
const { logFinanceAudit } = require("./financeAuditService");
const { publish, EVENTS } = require("./financeEventPublisher");

const SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";
const col       = () => db.collection("financeSettings");
const nowISO    = () => new Date().toISOString();

const JOINING_POLICIES     = new Set(["fullMonth", "prorated", "nextCycle"]);
const ALLOCATION_DEFAULTS  = new Set(["oldestDueFirst", "manual"]);

function _defaults(schoolId) {
  return {
    schoolId,
    gstNumber:                 "",
    defaultJoiningDatePolicy:  "fullMonth",
    defaultAllocationPolicy:   "oldestDueFirst",
    lateFeeEnabled:            false,
    lateFeeFormula:            { type: "flat", value: 0 }, // "flat" | "percentage"
    gracePeriodDays:           0,
    discountApprovalThreshold: 0,   // 0 = no threshold set yet; auto-apply below, require sign-off above
    refundApprovalThreshold:   0,
    createdAt:                 nowISO(),
    updatedAt:                 nowISO(),
  };
}

function _sanitize(existing) {
  return {
    schoolId:                   existing.schoolId,
    gstNumber:                  existing.gstNumber || "",
    defaultJoiningDatePolicy:   JOINING_POLICIES.has(existing.defaultJoiningDatePolicy) ? existing.defaultJoiningDatePolicy : "fullMonth",
    defaultAllocationPolicy:    ALLOCATION_DEFAULTS.has(existing.defaultAllocationPolicy) ? existing.defaultAllocationPolicy : "oldestDueFirst",
    lateFeeEnabled:             Boolean(existing.lateFeeEnabled),
    lateFeeFormula:             existing.lateFeeFormula || { type: "flat", value: 0 },
    gracePeriodDays:            Number(existing.gracePeriodDays || 0),
    discountApprovalThreshold:  Number(existing.discountApprovalThreshold || 0),
    refundApprovalThreshold:    Number(existing.refundApprovalThreshold || 0),
    createdAt:                  existing.createdAt || "",
    updatedAt:                  existing.updatedAt || "",
    updatedBy:                  existing.updatedBy || "",
  };
}

/** Always returns a usable settings object — sane defaults if the school hasn't configured anything yet. */
async function getSettings(schoolId = SCHOOL_ID) {
  const snap = await col().doc(schoolId).get();
  if (!snap.exists) return _defaults(schoolId);
  return _sanitize(snap.data());
}

async function updateSettings(schoolId = SCHOOL_ID, data = {}, { actorUserId = "system" } = {}) {
  if (data.defaultJoiningDatePolicy && !JOINING_POLICIES.has(data.defaultJoiningDatePolicy)) {
    const e = new Error(`Invalid defaultJoiningDatePolicy "${data.defaultJoiningDatePolicy}".`); e.code = "VALIDATION"; throw e;
  }
  if (data.defaultAllocationPolicy && !ALLOCATION_DEFAULTS.has(data.defaultAllocationPolicy)) {
    const e = new Error(`Invalid defaultAllocationPolicy "${data.defaultAllocationPolicy}".`); e.code = "VALIDATION"; throw e;
  }

  const ref     = col().doc(schoolId);
  const current = await getSettings(schoolId);

  // Strip schoolId (and any other identity field) from the incoming body before
  // merging — same _stripImmutable() principle used elsewhere on the platform.
  const { schoolId: _ignored, createdAt: _ignoredCreated, ...incoming } = data;

  const updated = {
    ..._sanitize({ ...current, ...incoming, schoolId }),
    updatedAt: nowISO(),
    updatedBy: actorUserId,
  };
  if (!current.createdAt) updated.createdAt = nowISO(); // first write

  await ref.set(updated, { merge: true });

  await logFinanceAudit({
    schoolId, actorUserId,
    action: "financeSettings.update", entityType: "financeSettings", entityId: schoolId,
    meta: { changed: Object.keys(incoming) },
  });

  publish(EVENTS.FINANCE_SETTINGS_CHANGED, { schoolId, actorUserId, changed: Object.keys(incoming) });

  return updated;
}

module.exports = { getSettings, updateSettings, JOINING_POLICIES, ALLOCATION_DEFAULTS };
