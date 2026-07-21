/**
 * financeSettingsController.js — HTTP handlers for Finance Settings
 */
const settingsSvc        = require("../services/financeSettingsService");
const { resolveContext } = require("../middleware/requestScope");

function _err(res, route, err) {
  let code = 500;
  if (err.code === "VALIDATION") code = 400;
  console.error(`[${route}]`, err.message);
  res.status(code).json({ success: false, error: err.message || "Server error." });
}

async function getSettings(req, res) {
  try {
    const { schoolId } = resolveContext(req);
    const settings = await settingsSvc.getSettings(schoolId);
    res.json({ success: true, settings });
  } catch (err) { _err(res, "GET /api/finance/settings", err); }
}

async function updateSettings(req, res) {
  try {
    const { schoolId, actorUserId } = resolveContext(req);
    const settings = await settingsSvc.updateSettings(schoolId, req.body, { actorUserId });
    res.json({ success: true, settings });
  } catch (err) { _err(res, "PUT /api/finance/settings", err); }
}

module.exports = { getSettings, updateSettings };
