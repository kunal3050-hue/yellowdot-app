/**
 * pickupAuthorizationController.js — Firestore-backed
 *
 * GET    /api/pickup-authorization          — list (filter: studentId, status)
 * POST   /api/pickup-authorization          — create pickup person
 * PUT    /api/pickup-authorization/:id      — update pickup person
 * DELETE /api/pickup-authorization/:id      — delete (blocked for protected Father/Mother)
 * GET    /api/pickup-authorization/audit    — audit log for a student
 */

const svc = require("../services/pickupAuthorizationService");

const DEFAULT_SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";

function resolveCtx(req) {
  return {
    schoolId:    req.user?.schoolId  || DEFAULT_SCHOOL_ID,
    centerId:    req.user?.centerId  || "",
    actorUserId: req.user?.userId    || "system",
  };
}

function logErr(route, e) { console.error(`[${route}]`, e.message); }

// ── GET /api/pickup-authorization ─────────────────────────────────

async function getPickupPersons(req, res) {
  try {
    const { schoolId, centerId } = resolveCtx(req);
    const role         = req.user?.role;
    const bypassCenter = ["developer", "super_admin", "admin"].includes(role);
    const { status }   = req.query;
    let { studentId }  = req.query;

    if (role === "parent") {
      const linkedId = req.user.student?.studentId;
      if (!linkedId) {
        return res.status(403).json({ success: false, error: "No student linked to this parent account." });
      }
      studentId = linkedId;
    }

    let entries = await svc.getAll(
      studentId || null,
      { schoolId, centerId: bypassCenter ? undefined : centerId }
    );

    if (status) entries = entries.filter(e => e.status === status);

    res.json({ success: true, count: entries.length, entries });
  } catch (e) {
    logErr("GET /api/pickup-authorization", e);
    res.status(500).json({ success: false, error: e.message });
  }
}

// ── GET /api/pickup-authorization/audit?studentId= ────────────────

async function getAuditLog(req, res) {
  try {
    const { schoolId } = resolveCtx(req);
    const { studentId } = req.query;
    if (!studentId) return res.status(400).json({ success: false, error: "studentId required." });

    const logs = await svc.getAuditLogs(studentId, { schoolId });
    res.json({ success: true, count: logs.length, logs });
  } catch (e) {
    logErr("GET /api/pickup-authorization/audit", e);
    res.status(500).json({ success: false, error: e.message });
  }
}

// ── POST /api/pickup-authorization ────────────────────────────────

async function createPickupPerson(req, res) {
  try {
    const { schoolId, centerId, actorUserId } = resolveCtx(req);
    const {
      studentId, studentName, pickupName, relation,
      mobile, photoUrl, idProof, emergency, status, notes,
      isParent, isProtected,
    } = req.body || {};

    if (!studentId)   return res.status(400).json({ success: false, error: "studentId required." });
    if (!studentName) return res.status(400).json({ success: false, error: "studentName required." });
    if (!pickupName)  return res.status(400).json({ success: false, error: "pickupName required." });
    if (!relation)    return res.status(400).json({ success: false, error: "relation required." });

    // Duplicate check: same studentId + pickupName (case-insensitive)
    const all = await svc.getAll(studentId, { schoolId });
    const dup = all.some(e => e.pickupName.toLowerCase() === (pickupName || "").toLowerCase());
    if (dup) {
      return res.status(409).json({
        success: false,
        error: `"${pickupName}" is already an authorized pickup person for this student.`,
      });
    }

    const entry = await svc.create(
      {
        studentId, studentName, pickupName,
        relation:    relation   || "Guardian",
        mobile:      mobile     || "",
        photoUrl:    photoUrl   || "",
        idProof:     idProof    || "",
        emergency:   !!emergency,
        notes:       notes      || "",
        isParent:    !!isParent,
        isProtected: !!isProtected,
      },
      { schoolId, centerId, actorUserId }
    );

    res.json({
      success: true,
      message: `${pickupName} added as authorized pickup person for ${studentName}.`,
      entry:   { ...entry, photoUrl: entry.photoUrl ? "<<stored>>" : "" },
    });
  } catch (e) {
    logErr("POST /api/pickup-authorization", e);
    res.status(500).json({ success: false, error: e.message });
  }
}

// ── PUT /api/pickup-authorization/:id ────────────────────────────

async function updatePickupPerson(req, res) {
  try {
    const { schoolId, centerId, actorUserId } = resolveCtx(req);
    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, error: "Entry ID required." });

    const { pickupName, relation, mobile, photoUrl, idProof, emergency, status, notes } = req.body || {};

    // Fetch existing to get studentId/name for audit log
    const existing = await svc.getOne(id);
    if (!existing) return res.status(404).json({ success: false, error: "Pickup person not found." });

    const updates = {};
    if (pickupName !== undefined) updates.pickupName = pickupName;
    if (relation   !== undefined) updates.relation   = relation;
    if (mobile     !== undefined) updates.mobile     = mobile;
    if (emergency  !== undefined) updates.emergency  = !!emergency;
    if (notes      !== undefined) updates.notes      = notes;
    if (status     !== undefined) updates.status     = status;
    if (typeof photoUrl === "string") updates.photoUrl = photoUrl;
    if (typeof idProof  === "string") updates.idProof  = idProof;

    const entry = await svc.update(id, updates, {
      updatedBy:   actorUserId,
      studentId:   existing.studentId,
      studentName: existing.studentName,
      schoolId,
      centerId,
    });

    if (!entry) return res.status(404).json({ success: false, error: "Pickup person not found." });

    res.json({
      success: true,
      message: `${entry.pickupName} updated.`,
      entry:   { ...entry, photoUrl: entry.photoUrl ? "<<stored>>" : "" },
    });
  } catch (e) {
    logErr("PUT /api/pickup-authorization/:id", e);
    res.status(500).json({ success: false, error: e.message });
  }
}

// ── DELETE /api/pickup-authorization/:id ──────────────────────────
// Protected persons (Father / Mother, isProtected = true) cannot be deleted.
// They can only be disabled via PUT (status → "Inactive").

async function deletePickupPerson(req, res) {
  try {
    const { schoolId, centerId, actorUserId } = resolveCtx(req);
    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, error: "Entry ID required." });

    const result = await svc.remove(id, { actorUserId, schoolId, centerId });

    if (result === "protected") {
      return res.status(403).json({
        success: false,
        error: "Father and Mother cannot be deleted — they are protected records. You can disable them by changing their status to Inactive.",
        code:  "PROTECTED_RECORD",
      });
    }
    if (!result) return res.status(404).json({ success: false, error: "Pickup person not found." });

    res.json({ success: true, message: "Pickup person removed." });
  } catch (e) {
    logErr("DELETE /api/pickup-authorization/:id", e);
    res.status(500).json({ success: false, error: e.message });
  }
}

module.exports = {
  getPickupPersons,
  getAuditLog,
  createPickupPerson,
  updatePickupPerson,
  deletePickupPerson,
};
