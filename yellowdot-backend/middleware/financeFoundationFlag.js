/**
 * financeFoundationFlag.js — Sprint 1 feature flag for the Finance
 * Foundation module (Student Ledger / Ledger Entry / Billing Plan /
 * Family Account extension / Finance Settings).
 *
 * "Every new feature must be feature-flagged if required" — since none
 * of these routes replace or alter any existing behavior, they are new,
 * additive endpoints. This flag gives an extra, explicit rollout control
 * on top of that: unless FINANCE_FOUNDATION_ENABLED=true is set in the
 * environment, every route behind this guard responds 404 — the app
 * behaves exactly as it does today, with no trace that this module
 * exists, until it is deliberately switched on.
 */
function requireFinanceFoundationFlag(req, res, next) {
  if (process.env.FINANCE_FOUNDATION_ENABLED === "true") return next();
  return res.status(404).json({ success: false, error: "Not found." });
}

module.exports = { requireFinanceFoundationFlag };
