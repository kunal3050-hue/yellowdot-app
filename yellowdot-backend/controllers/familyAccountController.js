/**
 * familyAccountController.js — HTTP handlers for the Family Account extension
 */
const familyAccountSvc   = require("../services/familyAccountService");
const { resolveContext } = require("../middleware/requestScope");

function _err(res, route, err) {
  let code = 500;
  if (err.code === "VALIDATION") code = 400;
  if (err.code === "NOT_FOUND")  code = 404;
  console.error(`[${route}]`, err.message);
  res.status(code).json({ success: false, error: err.message || "Server error." });
}

async function getOne(req, res) {
  try {
    const { schoolId } = resolveContext(req);
    const account = await familyAccountSvc.getFinanceAccount(req.params.familyId, { schoolId });
    if (!account) return res.status(404).json({ success: false, error: "Family account not found." });
    res.json({ success: true, account });
  } catch (err) { _err(res, "GET /api/finance/family-accounts/:familyId", err); }
}

async function ensure(req, res) {
  try {
    const { schoolId, actorUserId } = resolveContext(req);
    const account = await familyAccountSvc.ensureFinanceAccount(req.params.familyId, { schoolId, actorUserId });
    res.json({ success: true, account });
  } catch (err) { _err(res, "POST /api/finance/family-accounts/:familyId", err); }
}

async function adjustCredit(req, res) {
  try {
    const { schoolId, actorUserId } = resolveContext(req);
    const { delta, reason } = req.body;
    const result = await familyAccountSvc.adjustCreditBalance(req.params.familyId, delta, { schoolId, actorUserId, reason });
    res.json({ success: true, ...result });
  } catch (err) { _err(res, "POST /api/finance/family-accounts/:familyId/credit", err); }
}

module.exports = { getOne, ensure, adjustCredit };
