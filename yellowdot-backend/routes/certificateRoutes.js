/**
 * certificateRoutes.js — Certificates Module · API Routes
 *
 * Staff endpoints (authenticate + blockUnknown + staffOnly on every route):
 *   GET    /api/certificates                      — the issuance register
 *   GET    /api/certificates/summary              — counts for the KPI row
 *   GET    /api/certificates/eligibility/attendance — who qualifies for an attendance award
 *   GET    /api/certificates/:id                  — one certificate
 *   POST   /api/certificates                      — issue one
 *   POST   /api/certificates/bulk                 — issue for a whole class
 *   PATCH  /api/certificates/:id                  — edit a draft / promote it to issued
 *   POST   /api/certificates/:id/revoke           — soft revoke
 *
 * There is no parent-facing route here on purpose: certificates are printed
 * and handed over, so the module is staff-only and carries no visibility
 * field to get wrong.
 *
 * ── Two tiers of guard ────────────────────────────────────────────────────────
 * Reading the register is part of a teacher's job — they need to see whether
 * their class has had its certificates. ISSUING is not: a certificate is a
 * formal school document that prints a signatory's name under it, so writes
 * are restricted to the admin tier. `authorize` lets the bypass roles
 * (developer, super_admin) through, as everywhere else in the app.
 */

const express = require("express");
const router  = express.Router();
const certSvc = require("../services/certificateService");
const { authenticate, authorize, blockUnknown, staffOnly } = require("../middleware/authMiddleware");

const SCHOOL_ID = process.env.SCHOOL_ID || "ydseawoods";

/** Roles permitted to issue, edit or revoke a certificate. */
const ISSUE_ROLES = ["admin", "center_admin", "center_owner"];

// Every route in this file is staff-only; mounted once rather than repeated
// per route so a new endpoint cannot be added without its guard.
const staffGate = [authenticate, blockUnknown, staffOnly];
const issueGate = [authenticate, blockUnknown, staffOnly, authorize(...ISSUE_ROLES)];

function resolveCtx(req) {
  return {
    schoolId:    req.user?.schoolId || SCHOOL_ID,
    centerId:    req.user?.centerId || "",
    actorUserId: req.user?.userId   || "system",
  };
}

/** Map a CertificateError onto its status; anything else is a 500. */
function sendError(res, err) {
  if (err && err.name === "CertificateError") {
    return res.status(err.status || 400).json({ error: err.message, code: err.code });
  }
  console.error("[certificates]", err);
  return res.status(500).json({ error: "Could not complete the certificate operation." });
}

// ── Read ──────────────────────────────────────────────────────────────────────

router.get("/api/certificates", ...staffGate, async (req, res) => {
  try {
    const { type, status, studentId, classId, academicYear, batchId, from, to } = req.query;
    const certificates = await certSvc.listCertificates(
      { type, status, studentId, classId, academicYear, batchId, from, to },
      resolveCtx(req),
    );
    res.json({ success: true, certificates });
  } catch (err) { sendError(res, err); }
});

router.get("/api/certificates/summary", ...staffGate, async (req, res) => {
  try {
    const { academicYear, classId } = req.query;
    const summary = await certSvc.getSummary({ academicYear, classId }, resolveCtx(req));
    res.json({ success: true, summary });
  } catch (err) { sendError(res, err); }
});

// Declared before "/:id" so "eligibility" is never swallowed as an id.
router.get("/api/certificates/eligibility/attendance", ...staffGate, async (req, res) => {
  try {
    const { from, to, classId, threshold, minDays } = req.query;
    const result = await certSvc.getAttendanceEligibility(
      { from, to, classId, threshold: threshold ?? 100, minDays: minDays ?? 1 },
      resolveCtx(req),
    );
    res.json({ success: true, ...result });
  } catch (err) { sendError(res, err); }
});

router.get("/api/certificates/:id", ...staffGate, async (req, res) => {
  try {
    const certificate = await certSvc.getCertificate(req.params.id, resolveCtx(req));
    res.json({ success: true, certificate });
  } catch (err) { sendError(res, err); }
});

// ── Write ─────────────────────────────────────────────────────────────────────

router.post("/api/certificates", ...issueGate, async (req, res) => {
  try {
    const certificate = await certSvc.issueCertificate(req.body || {}, resolveCtx(req));
    res.status(201).json({ success: true, certificate });
  } catch (err) { sendError(res, err); }
});

router.post("/api/certificates/bulk", ...issueGate, async (req, res) => {
  try {
    const result = await certSvc.issueBulk(req.body || {}, resolveCtx(req));
    res.status(201).json({ success: true, ...result });
  } catch (err) { sendError(res, err); }
});

router.patch("/api/certificates/:id", ...issueGate, async (req, res) => {
  try {
    const certificate = await certSvc.updateCertificate(req.params.id, req.body || {}, resolveCtx(req));
    res.json({ success: true, certificate });
  } catch (err) { sendError(res, err); }
});

router.post("/api/certificates/:id/revoke", ...issueGate, async (req, res) => {
  try {
    const certificate = await certSvc.revokeCertificate(
      req.params.id, (req.body || {}).reason, resolveCtx(req),
    );
    res.json({ success: true, certificate });
  } catch (err) { sendError(res, err); }
});

module.exports = router;
