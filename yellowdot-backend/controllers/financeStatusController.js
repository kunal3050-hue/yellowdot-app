/**
 * financeStatusController.js — Finance Platform enablement probe.
 * ─────────────────────────────────────────────────────────────────────────
 * The one Finance endpoint that is registered UNCONDITIONALLY (see
 * server.js — outside the `FINANCE_FOUNDATION_ENABLED` block every other
 * Finance route lives inside), so the frontend always has something to ask
 * "is Finance on?" rather than inferring it from a 404 on a route that may
 * or may not exist. Reveals nothing beyond that one boolean.
 */
function getStatus(req, res) {
  res.json({ success: true, enabled: process.env.FINANCE_FOUNDATION_ENABLED === "true" });
}

module.exports = { getStatus };
