/**
 * pickupAuthorizationController.js — Firestore-backed
 *
 * GET    /api/pickup-authorization         — list (filter: studentId, status)
 * POST   /api/pickup-authorization         — create pickup person
 * PUT    /api/pickup-authorization/:id     — update pickup person
 * DELETE /api/pickup-authorization/:id     — delete pickup person
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

    // Parents may only see their own child's authorized pickup persons.
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

    // Sort: Active first, emergency first within active, then alphabetically
    entries.sort((a, b) => {
      if (a.status !== b.status) return a.status === "Active" ? -1 : 1;
      if (a.emergency !== b.emergency) return a.emergency ? -1 : 1;
      return a.pickupName.localeCompare(b.pickupName);
    });

    res.json({ success: true, count: entries.length, entries });
  } catch (e) {
    logErr("GET /api/pickup-authorization", e);
    res.status(500).json({ success: false, error: e.message });
  }
}

// ── POST /api/pickup-authorization ────────────────────────────────

async function createPickupPerson(req, res) {
  try {
    const { schoolId, centerId, actorUserId } = resolveCtx(req);
    const {
      studentId, studentName, pickupName, relation,
      mobile, photoUrl, emergency, status,
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

    const photoStr = typeof photoUrl === "string" ? photoUrl.slice(0, 49_000) : "";

    const entry = await svc.create(
      {
        studentId, studentName, pickupName,
        relation:  relation  || "Guardian",
        mobile:    mobile    || "",
        photoUrl:  photoStr,
        emergency: !!emergency,
      },
      { schoolId, centerId, actorUserId }
    );

    res.json({
      success: true,
      message: `${pickupName} added as authorized pickup person for ${studentName}.`,
      entry:   { ...entry, photoUrl: photoStr ? "<<stored>>" : "" },
    });
  } catch (e) {
    logErr("POST /api/pickup-authorization", e);
    res.status(500).json({ success: false, error: e.message });
  }
}

// ── PUT /api/pickup-authorization/:id ────────────────────────────

async function updatePickupPerson(req, res) {
  try {
    const { actorUserId } = resolveCtx(req);
    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, error: "Entry ID required." });

    const { pickupName, relation, mobile, photoUrl, emergency, status } = req.body || {};

    const updates = {};
    if (pickupName !== undefined) updates.pickupName = pickupName;
    if (relation   !== undefined) updates.relation   = relation;
    if (mobile     !== undefined) updates.mobile     = mobile;
    if (emergency  !== undefined) updates.emergency  = !!emergency;
    if (status     !== undefined) updates.status     = status;
    if (typeof photoUrl === "string" && photoUrl.startsWith("data:")) {
      updates.photoUrl = photoUrl.slice(0, 49_000);
    }

    const entry = await svc.update(id, updates, { updatedBy: actorUserId });
    if (!entry) return res.status(404).json({ success: false, error: "Pickup person not found." });

    res.json({
      success: true,
      message: `${entry.pickupName} updated.`,
      entry:   { ...entry, photoUrl: "<<stored>>" },
    });
  } catch (e) {
    logErr("PUT /api/pickup-authorization/:id", e);
    res.status(500).json({ success: false, error: e.message });
  }
}

// ── DELETE /api/pickup-authorization/:id ──────────────────────────

async function deletePickupPerson(req, res) {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, error: "Entry ID required." });

    const deleted = await svc.remove(id);
    if (!deleted) return res.status(404).json({ success: false, error: "Pickup person not found." });

    res.json({ success: true, message: "Pickup person removed." });
  } catch (e) {
    logErr("DELETE /api/pickup-authorization/:id", e);
    res.status(500).json({ success: false, error: e.message });
  }
}

module.exports = { getPickupPersons, createPickupPerson, updatePickupPerson, deletePickupPerson };
