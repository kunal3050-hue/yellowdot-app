/**
 * financeFoundationMigration.js — Sprint 1 migration STUBS. NOT EXECUTED.
 * ────────────────────────────────────────────────────────────────────
 * This file defines the shape of the future backfill (Domain Architecture
 * Chapter 2, Part 9 — "Existing invoices" / "Existing payments") but is
 * deliberately inert: it is not wired into any npm script, not required
 * by server.js/index.js, and every exported function refuses to run
 * unless called with an explicit confirmation flag no automated process
 * would ever pass by accident.
 *
 * "Do NOT migrate production data" (Sprint 1 constraint) — this file
 * exists to document the plan and let the *shape* of the migration be
 * reviewed now, not to run it. Do not remove the confirmation guard when
 * this work actually begins in a later sprint; replace this whole header
 * comment instead so it's clear the stub has graduated to a real script.
 */

const CONFIRM_TOKEN = "I_UNDERSTAND_THIS_WILL_WRITE_DATA";

function _requireConfirmation(opts) {
  if (opts?.confirm !== CONFIRM_TOKEN) {
    throw new Error(
      "Refusing to run: this migration is a Sprint 1 stub only, pending approval " +
      "of a dedicated migration plan (Domain Architecture Chapter 2, Part 9). " +
      `Pass { confirm: "${CONFIRM_TOKEN}" } explicitly once that plan is approved.`
    );
  }
}

/**
 * Reconstruct a Student Ledger + Ledger Entries for one existing, active
 * student from their current `invoices`/`payments` history — additive
 * only, never rewrites the original documents. STUB: not implemented.
 */
async function backfillStudentLedger(studentId, opts = {}) {
  _requireConfirmation(opts);
  throw new Error("Not implemented — Sprint 1 stub only.");
}

/**
 * Reconstruct a Family Account finance facet from a family's existing
 * students' invoice/payment history. STUB: not implemented.
 */
async function backfillFamilyAccount(familyId, opts = {}) {
  _requireConfirmation(opts);
  throw new Error("Not implemented — Sprint 1 stub only.");
}

/**
 * Run the full backfill for one school (every active student). Intended
 * future shape: dry-run by default, per-school opt-in, full reconciliation
 * report comparing reconstructed totals against existing computed
 * dashboard numbers before anything is considered "migrated" (per Part 9).
 * STUB: not implemented.
 */
async function backfillSchool(schoolId, opts = {}) {
  _requireConfirmation(opts);
  throw new Error("Not implemented — Sprint 1 stub only.");
}

module.exports = { backfillStudentLedger, backfillFamilyAccount, backfillSchool };
