/**
 * familyRoutes.js — Family & Sibling Management REST API
 * ────────────────────────────────────────────────────────
 * All routes require a valid Firebase ID token + staff account.
 * Mutations require family_management permission.
 *
 * GET    /api/families                          List families (schoolId-scoped)
 * GET    /api/families/count                    Total active families (dashboard)
 * GET    /api/families/search?q=               Search by name / contact / code
 * GET    /api/families/:familyId               Get single family
 * POST   /api/families                          Create family
 * PUT    /api/families/:familyId               Update family
 * DELETE /api/families/:familyId               Delete family (unlinks all students)
 * POST   /api/families/:familyId/students/:studentId   Link student to family
 * DELETE /api/families/:familyId/students/:studentId   Unlink student from family
 * GET    /api/students/:studentId/family        Get the family linked to a student
 *
 * V2 — Notes
 * GET    /api/families/:familyId/notes          List notes
 * POST   /api/families/:familyId/notes          Add note
 * DELETE /api/families/:familyId/notes/:noteId  Delete note
 *
 * V2 — Documents
 * GET    /api/families/:familyId/documents               List documents
 * POST   /api/families/:familyId/documents               Add document metadata
 * DELETE /api/families/:familyId/documents/:docId        Delete document
 *
 * V2 — Timeline & Fees
 * GET    /api/families/:familyId/timeline        Activity timeline
 * GET    /api/families/:familyId/fees-summary    Outstanding fees across children
 *
 * V2 — Sibling discount rules (school-wide)
 * GET    /api/sibling-discount-rules             Get rules
 * PUT    /api/sibling-discount-rules             Update rules
 */

const express = require("express");
const router  = express.Router();
const svc     = require("../services/familyService");
const { authenticate, authorizeRoute, staffOnly } = require("../middleware/authMiddleware");
const { checkTenantAccess } = require("../middleware/tenantRecordAccess");
const admissionFinanceSvc   = require("../services/admissionFinanceService"); // Sprint 2 — Finance Foundation link hook

const ROUTE_KEY   = "families";
const canView     = [authenticate, staffOnly, authorizeRoute(ROUTE_KEY)];
const canMutate   = [authenticate, staffOnly, authorizeRoute(ROUTE_KEY)];

// ── Tenant guard for every :familyId route ─────────────────────────
// Fetches the family once, verifies it belongs to the caller's school,
// and stashes it on req.family so handlers don't need to re-fetch.
async function requireFamilyTenant(req, res, next) {
  try {
    const family = await svc.getOne(req.params.familyId);
    if (!family || !checkTenantAccess(req, family).allowed) {
      return res.status(404).json({ success: false, error: "Family not found." });
    }
    req.family = family;
    next();
  } catch (err) {
    console.error("[requireFamilyTenant]", err.message);
    res.status(500).json({ success: false, error: "Failed to verify family access." });
  }
}

// ── GET /api/families ──────────────────────────────────────────────

router.get("/api/families", ...canView, async (req, res) => {
  try {
    const { centerId, active } = req.query;
    const families = await svc.getAll({
      schoolId: req.user.schoolId,
      centerId,
      active,
    });
    res.json({ success: true, families });
  } catch (err) {
    console.error("[GET /api/families]", err.message);
    res.status(500).json({ success: false, error: "Failed to fetch families." });
  }
});

// ── GET /api/families/count ────────────────────────────────────────

router.get("/api/families/count", ...canView, async (req, res) => {
  try {
    const total = await svc.count(req.user.schoolId);
    res.json({ success: true, total });
  } catch (err) {
    console.error("[GET /api/families/count]", err.message);
    res.status(500).json({ success: false, error: "Failed to count families." });
  }
});

// ── GET /api/families/search ───────────────────────────────────────

router.get("/api/families/search", ...canView, async (req, res) => {
  try {
    const families = await svc.search(req.query.q, { schoolId: req.user.schoolId });
    res.json({ success: true, families });
  } catch (err) {
    console.error("[GET /api/families/search]", err.message);
    res.status(500).json({ success: false, error: "Failed to search families." });
  }
});

// ── GET /api/families/:familyId ────────────────────────────────────

router.get("/api/families/:familyId", ...canView, requireFamilyTenant, async (req, res) => {
  try {
    res.json({ success: true, family: req.family });
  } catch (err) {
    console.error("[GET /api/families/:familyId]", err.message);
    res.status(500).json({ success: false, error: "Failed to fetch family." });
  }
});

// ── POST /api/families ─────────────────────────────────────────────

router.post("/api/families", ...canMutate, async (req, res) => {
  try {
    const result = await svc.create(req.body, {
      schoolId:    req.user.schoolId,
      actorUserId: req.user.userId,
    });
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    console.error("[POST /api/families]", err.message);
    res.status(500).json({ success: false, error: "Failed to create family." });
  }
});

// ── PUT /api/families/:familyId ────────────────────────────────────

router.put("/api/families/:familyId", ...canMutate, requireFamilyTenant, async (req, res) => {
  try {
    const result = await svc.update(req.params.familyId, req.body, {
      actorUserId: req.user.userId,
    });
    if (!result) return res.status(404).json({ success: false, error: "Family not found." });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("[PUT /api/families/:familyId]", err.message);
    res.status(500).json({ success: false, error: "Failed to update family." });
  }
});

// ── DELETE /api/families/:familyId ────────────────────────────────

router.delete("/api/families/:familyId", ...canMutate, requireFamilyTenant, async (req, res) => {
  try {
    const deleted = await svc.remove(req.params.familyId);
    if (!deleted) return res.status(404).json({ success: false, error: "Family not found." });
    res.json({ success: true, message: "Family deleted successfully." });
  } catch (err) {
    console.error("[DELETE /api/families/:familyId]", err.message);
    res.status(500).json({ success: false, error: "Failed to delete family." });
  }
});

// ── POST /api/families/:familyId/students/:studentId ──────────────

router.post("/api/families/:familyId/students/:studentId", ...canMutate, requireFamilyTenant, async (req, res) => {
  try {
    const result = await svc.addStudent(
      req.params.familyId,
      req.params.studentId,
      { actorUserId: req.user.userId },
    );
    if (!result) return res.status(404).json({ success: false, error: "Family not found." });

    // Finance Foundation link hook (Sprint 2) — feature-flagged, fire-and-forget,
    // same "never fail the caller" contract as server.js's admission hook.
    if (process.env.FINANCE_FOUNDATION_ENABLED === "true") {
      admissionFinanceSvc
        .onStudentLinkedToFamily({
          familyId:  req.params.familyId,
          studentId: req.params.studentId,
          schoolId:  req.user.schoolId,
          actorUserId: req.user.userId,
        })
        .catch(err => console.error("[POST /api/families/:familyId/students/:studentId] Finance hook failed:", err.message));
    }

    res.json({ success: true, ...result });
  } catch (err) {
    console.error("[POST /api/families/:familyId/students/:studentId]", err.message);
    res.status(500).json({ success: false, error: "Failed to link student to family." });
  }
});

// ── DELETE /api/families/:familyId/students/:studentId ────────────

router.delete("/api/families/:familyId/students/:studentId", ...canMutate, requireFamilyTenant, async (req, res) => {
  try {
    const result = await svc.removeStudent(
      req.params.familyId,
      req.params.studentId,
      { actorUserId: req.user.userId },
    );
    if (!result) return res.status(404).json({ success: false, error: "Family not found." });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("[DELETE /api/families/:familyId/students/:studentId]", err.message);
    res.status(500).json({ success: false, error: "Failed to unlink student from family." });
  }
});

// ── GET /api/students/:studentId/family ───────────────────────────

router.get("/api/students/:studentId/family", ...canView, async (req, res) => {
  try {
    const family = await svc.getByStudentId(req.params.studentId);
    if (!family || !checkTenantAccess(req, family).allowed) return res.json({ success: true, family: null });
    res.json({ success: true, family });
  } catch (err) {
    console.error("[GET /api/students/:studentId/family]", err.message);
    res.status(500).json({ success: false, error: "Failed to fetch family for student." });
  }
});

// ══════════════════════════════════════════════════════════════════
// V2 — NOTES
// ══════════════════════════════════════════════════════════════════

router.get("/api/families/:familyId/notes", ...canView, requireFamilyTenant, async (req, res) => {
  try {
    const notes = await svc.getNotes(req.params.familyId);
    res.json({ success: true, notes });
  } catch (err) {
    console.error("[GET notes]", err.message);
    res.status(500).json({ success: false, error: "Failed to fetch notes." });
  }
});

router.post("/api/families/:familyId/notes", ...canMutate, requireFamilyTenant, async (req, res) => {
  try {
    const result = await svc.addNote(req.params.familyId, {
      content:    req.body.content,
      authorName: req.user.name || req.user.email || "Staff",
      authorId:   req.user.userId,
    });
    res.status(201).json(result);
  } catch (err) {
    console.error("[POST notes]", err.message);
    res.status(400).json({ success: false, error: err.message || "Failed to add note." });
  }
});

router.delete("/api/families/:familyId/notes/:noteId", ...canMutate, requireFamilyTenant, async (req, res) => {
  try {
    await svc.deleteNote(req.params.familyId, req.params.noteId);
    res.json({ success: true });
  } catch (err) {
    console.error("[DELETE note]", err.message);
    res.status(500).json({ success: false, error: "Failed to delete note." });
  }
});

// ══════════════════════════════════════════════════════════════════
// V2 — DOCUMENTS
// ══════════════════════════════════════════════════════════════════

router.get("/api/families/:familyId/documents", ...canView, requireFamilyTenant, async (req, res) => {
  try {
    const documents = await svc.getDocuments(req.params.familyId);
    res.json({ success: true, documents });
  } catch (err) {
    console.error("[GET documents]", err.message);
    res.status(500).json({ success: false, error: "Failed to fetch documents." });
  }
});

router.post("/api/families/:familyId/documents", ...canMutate, requireFamilyTenant, async (req, res) => {
  try {
    const result = await svc.addDocument(req.params.familyId, {
      name:           req.body.name,
      url:            req.body.url  || "",
      type:           req.body.type || "other",
      uploadedBy:     req.user.userId,
      uploadedByName: req.user.name || req.user.email || "Staff",
    });
    res.status(201).json(result);
  } catch (err) {
    console.error("[POST documents]", err.message);
    res.status(400).json({ success: false, error: err.message || "Failed to add document." });
  }
});

router.delete("/api/families/:familyId/documents/:docId", ...canMutate, requireFamilyTenant, async (req, res) => {
  try {
    await svc.deleteDocument(req.params.familyId, req.params.docId);
    res.json({ success: true });
  } catch (err) {
    console.error("[DELETE document]", err.message);
    res.status(500).json({ success: false, error: "Failed to delete document." });
  }
});

// ══════════════════════════════════════════════════════════════════
// V2 — TIMELINE
// ══════════════════════════════════════════════════════════════════

router.get("/api/families/:familyId/timeline", ...canView, requireFamilyTenant, async (req, res) => {
  try {
    const events = await svc.getTimeline(req.params.familyId);
    res.json({ success: true, events });
  } catch (err) {
    console.error("[GET timeline]", err.message);
    res.status(500).json({ success: false, error: "Failed to fetch timeline." });
  }
});

// ══════════════════════════════════════════════════════════════════
// V2 — FEES SUMMARY
// ══════════════════════════════════════════════════════════════════

router.get("/api/families/:familyId/fees-summary", ...canView, requireFamilyTenant, async (req, res) => {
  try {
    const summary = await svc.getFeesSummary(req.params.familyId, req.user.schoolId);
    res.json({ success: true, ...summary });
  } catch (err) {
    console.error("[GET fees-summary]", err.message);
    res.status(500).json({ success: false, error: "Failed to fetch fees summary." });
  }
});

// ══════════════════════════════════════════════════════════════════
// V2 — SIBLING DISCOUNT RULES (school-wide)
// ══════════════════════════════════════════════════════════════════

router.get("/api/sibling-discount-rules", ...canView, async (req, res) => {
  try {
    const data = await svc.getDiscountRules(req.user.schoolId);
    res.json({ success: true, ...data });
  } catch (err) {
    console.error("[GET sibling-discount-rules]", err.message);
    res.status(500).json({ success: false, error: "Failed to fetch discount rules." });
  }
});

router.put("/api/sibling-discount-rules", ...canMutate, async (req, res) => {
  try {
    const result = await svc.updateDiscountRules(req.body.rules, {
      schoolId:    req.user.schoolId,
      actorUserId: req.user.userId,
    });
    res.json(result);
  } catch (err) {
    console.error("[PUT sibling-discount-rules]", err.message);
    res.status(500).json({ success: false, error: "Failed to update discount rules." });
  }
});

module.exports = router;
