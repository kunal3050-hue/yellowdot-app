/**
 * financeRulesEngine.js — Finance Foundation: Rules Engine (Sprint 3, M3.3)
 * ────────────────────────────────────────────────────────────────────
 * Per the Sprint 3 approval: "the Rules Engine should only determine
 * billing behaviour during invoice generation... Keep the Rules Engine
 * deterministic and isolated."
 *
 * Deliberately pure: every function here takes plain data in and returns
 * plain data out. No Firestore reads, no writes, no side effects. The
 * caller (M3.4's Manual Billing Engine) is responsible for fetching
 * Finance Settings (`financeSettingsService.getSettings`) and the
 * sibling-discount rules (`familyService.getDiscountRules`) and passing
 * the resolved values in — that keeps this module trivially unit-testable
 * and free of any dependency on Firestore or another service's internals.
 *
 * Scope, honestly stated: this milestone implements Joining Date Policy
 * (full month / prorated / next cycle) and Discount application (reusing
 * the existing sibling-discount mechanism). Scholarship application is
 * NOT implemented here — no Scholarship entity/collection exists anywhere
 * in the codebase yet (Domain Architecture Chapter 2, Part 1 tags
 * Scholarship as a "new" entity still to be built). Wiring a Scholarship
 * rule into `evaluateBillingPlanInvoice` before that entity exists would
 * mean inventing a data shape with nothing real behind it — the same
 * honesty-over-completeness standard already applied to the LedgerEntryService
 * contract. This is flagged as follow-up work once Scholarships are built,
 * not silently skipped.
 */

const JOINING_POLICIES = new Set(["fullMonth", "prorated", "nextCycle"]);

function _round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function _parseDate(value, label) {
  const d = new Date(value);
  if (isNaN(d.getTime())) {
    const e = new Error(`Invalid date supplied for "${label}": ${value}`); e.code = "VALIDATION"; throw e;
  }
  return d;
}

function _validateLines(lines) {
  if (!Array.isArray(lines) || lines.length === 0) {
    const e = new Error("At least one invoice line is required."); e.code = "VALIDATION"; throw e;
  }
}

/**
 * resolveJoiningDateFactor — what fraction of a billing period's fee is
 * actually owed, given a student's joining date, the billing period's
 * bounds, and the school's chosen policy.
 *
 * A student who joined at/before the period start, or who has a joining
 * date entirely within a *later* period, always resolves the same way
 * regardless of policy (1 and 0 respectively) — the three policies only
 * differ for a student joining *during* the period in question.
 */
function resolveJoiningDateFactor({ policy, joiningDate, periodStart, periodEnd }) {
  if (!JOINING_POLICIES.has(policy)) {
    const e = new Error(`Invalid joining date policy "${policy}".`); e.code = "VALIDATION"; throw e;
  }
  const join  = _parseDate(joiningDate, "joiningDate");
  const start = _parseDate(periodStart, "periodStart");
  const end   = _parseDate(periodEnd, "periodEnd");
  if (end < start) {
    const e = new Error("periodEnd must not be before periodStart."); e.code = "VALIDATION"; throw e;
  }

  if (join <= start) return 1; // already enrolled for the whole period
  if (join > end)    return 0; // hasn't joined yet within this period

  // Joined partway through this specific period — this is where the
  // three policies actually diverge.
  if (policy === "fullMonth") return 1;
  if (policy === "nextCycle") return 0;

  // prorated — days-based fraction of the period actually attended,
  // inclusive of both the join day and the period's last day.
  const msPerDay      = 24 * 60 * 60 * 1000;
  const totalDays     = Math.round((end - start) / msPerDay) + 1;
  const attendedDays  = Math.round((end - join) / msPerDay) + 1;
  return Math.max(0, Math.min(1, attendedDays / totalDays));
}

/**
 * resolveSiblingDiscountPercent — reuses the existing sibling-discount
 * rule shape (`familyService.getDiscountRules()`: an array of
 * `{ siblingOrder, discountPercent, label }`), matching a student's
 * `siblingOrder` to the highest-defined rule at or below it (e.g. a rule
 * set defining 2nd/3rd/"4th Child+" applies the 4th-child rate to a 5th,
 * 6th, ... child too, exactly like the existing FamilyProfile.jsx editor
 * intends).
 */
function resolveSiblingDiscountPercent({ siblingOrder, discountRules }) {
  const order = Number(siblingOrder) || 0;
  if (order < 2) return 0; // first child — no sibling discount by definition

  const applicable = (discountRules || [])
    .filter((r) => Number(r.siblingOrder) <= order)
    .sort((a, b) => Number(a.siblingOrder) - Number(b.siblingOrder));
  if (applicable.length === 0) return 0;

  return Number(applicable[applicable.length - 1].discountPercent) || 0;
}

/**
 * applySiblingDiscount — applies a resolved discount percentage to a set
 * of already-prorated invoice lines. Respects Finance Settings'
 * `discountApprovalThreshold` (Sprint 1's Discount design: 0 = no
 * threshold configured, auto-apply below the threshold, require sign-off
 * at/above it) — when approval is required, lines are returned
 * UNCHANGED and `requiresApproval: true` is surfaced, since this engine
 * has no authority to silently discount an amount that policy says a
 * human must approve first. There is no approval workflow to route into
 * yet (not built in any sprint so far) — this is intentionally as far as
 * this milestone goes; the caller must decide what to do with
 * `requiresApproval: true` (e.g. surface it to staff, do not auto-generate).
 */
function applySiblingDiscount({ lines, siblingOrder, discountRules, discountApprovalThreshold = 0 }) {
  _validateLines(lines);
  const discountPercent = resolveSiblingDiscountPercent({ siblingOrder, discountRules });

  if (discountPercent <= 0) {
    return { lines, discountPercent: 0, requiresApproval: false };
  }

  const threshold = Number(discountApprovalThreshold) || 0;
  if (threshold > 0 && discountPercent >= threshold) {
    return { lines, discountPercent, requiresApproval: true };
  }

  const discountedLines = lines.map((line) => ({
    ...line,
    discount: _round2((Number(line.amount) || 0) * discountPercent / 100),
  }));
  return { lines: discountedLines, discountPercent, requiresApproval: false };
}

/**
 * evaluateBillingPlanInvoice — the single entry point M3.4 is expected to
 * call: applies Joining Date proration, then Sibling Discount, to a raw
 * set of lines (from a Billing Plan / Fee Template) in that order —
 * proration first, so a discount is always computed against the amount
 * actually owed for the period, never the full undiscounted period fee.
 */
function evaluateBillingPlanInvoice({
  lines,
  joiningDatePolicy,
  joiningDate,
  periodStart,
  periodEnd,
  siblingOrder,
  discountRules,
  discountApprovalThreshold,
}) {
  _validateLines(lines);

  const joiningDateFactor = resolveJoiningDateFactor({
    policy: joiningDatePolicy, joiningDate, periodStart, periodEnd,
  });

  const proratedLines = lines.map((line) => ({
    ...line,
    amount: _round2((Number(line.amount) || 0) * joiningDateFactor),
  }));

  const { lines: finalLines, discountPercent, requiresApproval } = applySiblingDiscount({
    lines: proratedLines, siblingOrder, discountRules, discountApprovalThreshold,
  });

  return { lines: finalLines, joiningDateFactor, discountPercent, requiresApproval };
}

module.exports = {
  JOINING_POLICIES,
  resolveJoiningDateFactor,
  resolveSiblingDiscountPercent,
  applySiblingDiscount,
  evaluateBillingPlanInvoice,
};
