/**
 * pickupMigrationController.js
 * ─────────────────────────────────────────────────────────────────────────
 * Handles automatic and bulk migration of existing student profiles:
 * creates Father / Mother as protected pickup persons if they don't exist.
 *
 * POST /api/pickup-authorization/migrate-student
 *   body: { studentId, studentName, fatherName, fatherMobile, fatherPhoto,
 *           motherName, motherMobile, motherPhoto }
 *   → creates missing Father/Mother records; idempotent
 *
 * POST /api/pickup-authorization/migrate-bulk
 *   body: { students: [ { studentId, studentName, fatherName, ... }, ... ] }
 *   → batch version; processes up to 200 students in one call
 *   → returns per-student result + aggregate summary
 *
 * GET  /api/pickup-authorization/migration-status
 *   → returns all pickup authorization entries so the client can join
 *     with the student list and compute per-student migration status
 *   (admin / staff only)
 */

const svc = require("../services/pickupAuthorizationService");

const DEFAULT_SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";

function resolveCtx(req) {
  return {
    schoolId:    req.user?.schoolId  || DEFAULT_SCHOOL_ID,
    centerId:    req.user?.centerId  || "",
    actorUserId: req.user?.userId    || "migration",
  };
}

function logErr(route, e) { console.error(`[${route}]`, e.message); }

// ── Helper: migrate one student's parent records ──────────────────────────

async function migrateOneStudent(
  { studentId, studentName, fatherName, fatherMobile, fatherPhoto, motherName, motherMobile, motherPhoto },
  { schoolId, centerId, actorUserId }
) {
  if (!studentId) return { skipped: true, reason: "no studentId" };

  // Fetch existing records for this student
  const existing = await svc.getAll(studentId, { schoolId });
  const hasFather = existing.some(e => e.isParent && e.relation === "Father");
  const hasMother = existing.some(e => e.isParent && e.relation === "Mother");

  const created      = [];
  const alreadyExists = [];
  const incomplete   = [];

  const ctx = { schoolId, centerId, actorUserId };

  // ── Father ──────────────────────────────────────────────────────────────
  const fName = (fatherName || "").trim();
  if (fName) {
    if (hasFather) {
      alreadyExists.push("Father");
    } else {
      const missingFields = [];
      if (!fatherMobile) missingFields.push("mobile");
      if (!fatherPhoto)  missingFields.push("photo");
      const isIncomplete = missingFields.length > 0;

      await svc.create(
        {
          studentId,
          studentName:  studentName || "",
          pickupName:   fName,
          relation:     "Father",
          mobile:       fatherMobile  || "",
          photoUrl:     fatherPhoto   || "",
          emergency:    true,
          isParent:     true,
          isProtected:  true,
          isIncomplete,
          notes: isIncomplete
            ? `Auto-migrated — missing: ${missingFields.join(", ")}`
            : "Auto-migrated from existing student profile",
        },
        ctx,
      );
      created.push("Father");
      if (isIncomplete) incomplete.push({ relation: "Father", missingFields });
    }
  }

  // ── Mother ──────────────────────────────────────────────────────────────
  const mName = (motherName || "").trim();
  if (mName) {
    if (hasMother) {
      alreadyExists.push("Mother");
    } else {
      const missingFields = [];
      if (!motherMobile) missingFields.push("mobile");
      if (!motherPhoto)  missingFields.push("photo");
      const isIncomplete = missingFields.length > 0;

      await svc.create(
        {
          studentId,
          studentName:  studentName || "",
          pickupName:   mName,
          relation:     "Mother",
          mobile:       motherMobile  || "",
          photoUrl:     motherPhoto   || "",
          emergency:    true,
          isParent:     true,
          isProtected:  true,
          isIncomplete,
          notes: isIncomplete
            ? `Auto-migrated — missing: ${missingFields.join(", ")}`
            : "Auto-migrated from existing student profile",
        },
        ctx,
      );
      created.push("Mother");
      if (isIncomplete) incomplete.push({ relation: "Mother", missingFields });
    }
  }

  return {
    studentId,
    studentName:  studentName || studentId,
    created,
    alreadyExists,
    incomplete,
    skipped: false,
  };
}

// ── POST /api/pickup-authorization/migrate-student ────────────────────────

async function migrateStudent(req, res) {
  try {
    const ctx = resolveCtx(req);
    const {
      studentId, studentName,
      fatherName, fatherMobile, fatherPhoto,
      motherName, motherMobile, motherPhoto,
    } = req.body || {};

    if (!studentId)
      return res.status(400).json({ success: false, error: "studentId required." });

    const result = await migrateOneStudent(
      { studentId, studentName, fatherName, fatherMobile, fatherPhoto, motherName, motherMobile, motherPhoto },
      ctx,
    );

    const msg = result.created.length > 0
      ? `Created ${result.created.join(", ")} pickup record(s) for ${studentName || studentId}.`
      : "No migration needed — all parent records already exist.";

    res.json({ success: true, ...result, message: msg });
  } catch (e) {
    logErr("POST /api/pickup-authorization/migrate-student", e);
    res.status(500).json({ success: false, error: e.message });
  }
}

// ── POST /api/pickup-authorization/migrate-bulk ───────────────────────────
// Body: { students: [ {studentId, studentName, fatherName, fatherMobile, fatherPhoto,
//                       motherName, motherMobile, motherPhoto}, ... ] }
// Processes each student sequentially to avoid Firestore write contention.
// Stops at 200 students per request.

async function migrateBulk(req, res) {
  try {
    const ctx      = resolveCtx(req);
    const students = Array.isArray(req.body?.students) ? req.body.students.slice(0, 200) : [];

    if (students.length === 0)
      return res.status(400).json({ success: false, error: "students[] array required." });

    const results = [];
    let totalCreated   = 0;
    let totalSkipped   = 0;
    let totalIncomplete = 0;

    for (const stu of students) {
      try {
        const r = await migrateOneStudent(stu, ctx);
        totalCreated    += r.created.length;
        totalIncomplete += r.incomplete.length;
        if (r.skipped) totalSkipped++;
        results.push(r);
      } catch (e) {
        results.push({
          studentId:   stu.studentId || "unknown",
          studentName: stu.studentName || "",
          error:       e.message,
          created:     [],
          alreadyExists: [],
          incomplete:  [],
          skipped:     true,
        });
        totalSkipped++;
      }
    }

    res.json({
      success: true,
      processed:       students.length,
      totalCreated,
      totalSkipped,
      totalIncomplete,
      results,
      message: `Migration complete. Created ${totalCreated} record(s) across ${students.length} students.`,
    });
  } catch (e) {
    logErr("POST /api/pickup-authorization/migrate-bulk", e);
    res.status(500).json({ success: false, error: e.message });
  }
}

// ── GET /api/pickup-authorization/migration-status ────────────────────────
// Returns all authorization entries (isParent only) so the client can join
// with the student list to compute per-student migration status.

async function getMigrationStatus(req, res) {
  try {
    const { schoolId, centerId } = resolveCtx(req);
    const role        = req.user?.role;
    const bypassCenter = ["developer", "super_admin", "admin"].includes(role);

    // Fetch ALL pickup authorization entries for the school
    let entries = await svc.getAll(
      null,  // no studentId filter — all students
      { schoolId, centerId: bypassCenter ? undefined : centerId },
    );

    // Only return parent records for the migration status view
    const parentEntries = entries.filter(e => e.isParent);

    // Build a summary map: studentId → { father, mother }
    const map = {};
    for (const e of parentEntries) {
      if (!map[e.studentId]) map[e.studentId] = { studentId: e.studentId, studentName: e.studentName, father: null, mother: null };
      if (e.relation === "Father") map[e.studentId].father = { entryId: e.entryId, status: e.status, isIncomplete: e.isIncomplete, missingFields: e.missingFields };
      if (e.relation === "Mother") map[e.studentId].mother = { entryId: e.entryId, status: e.status, isIncomplete: e.isIncomplete, missingFields: e.missingFields };
    }

    res.json({
      success: true,
      count:   Object.keys(map).length,
      status:  Object.values(map),
    });
  } catch (e) {
    logErr("GET /api/pickup-authorization/migration-status", e);
    res.status(500).json({ success: false, error: e.message });
  }
}

module.exports = { migrateStudent, migrateBulk, getMigrationStatus };
