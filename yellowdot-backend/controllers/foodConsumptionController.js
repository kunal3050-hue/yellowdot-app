/**
 * foodConsumptionController.js — Firestore-backed
 *
 * GET  /api/food-consumption?date=&class=  — read entries with filters
 * POST /api/food-consumption               — upsert a consumption entry
 * PUT  /api/food-consumption               — alias for POST (same upsert)
 */

const svc   = require("../services/foodConsumptionService");
const notif = require("../services/notificationService");

const DEFAULT_SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";

function resolveCtx(req) {
  return {
    schoolId:    req.user?.schoolId  || DEFAULT_SCHOOL_ID,
    centerId:    req.user?.centerId  || "",
    actorUserId: req.user?.userId    || "system",
  };
}

function logErr(route, e) { console.error(`[${route}]`, e.message); }

// ── GET /api/food-consumption ─────────────────────────────────────

async function getConsumption(req, res) {
  try {
    const { schoolId, centerId } = resolveCtx(req);
    const bypassCenter = ["developer", "super_admin", "admin"].includes(req.user?.role);
    const { date, class: cls, studentId } = req.query;
    const entries = await svc.getConsumption({
      date, class: cls, studentId,
      schoolId,
      centerId: bypassCenter ? undefined : centerId,
    });
    res.json(entries);
  } catch (e) {
    logErr("GET /api/food-consumption", e);
    res.status(500).json({ error: "Failed to fetch consumption data.", details: e.message });
  }
}

// ── POST /api/food-consumption ────────────────────────────────────
// Body: { date, student_id|studentId, student_name|studentName, class,
//         meal_type|mealType, food_item|foodItem, quantity, unit,
//         status, notes, updated_by|updatedBy }

async function saveConsumption(req, res) {
  try {
    const { schoolId, centerId, actorUserId } = resolveCtx(req);
    const b = req.body || {};

    const date      = b.date;
    const studentId = b.studentId   || b.student_id;
    const mealType  = b.mealType    || b.meal_type;

    console.log(`[food-consumption POST] date=${date} studentId=${studentId} mealType=${mealType} qty=${b.quantity}`);

    if (!date || !studentId || !mealType) {
      console.warn("[food-consumption POST] Missing required fields:", { date, studentId, mealType });
      return res.status(400).json({
        success: false,
        message: "date, studentId (or student_id) and mealType (or meal_type) are required.",
      });
    }

    const qty            = b.quantity ?? 0;
    const resolvedStatus = b.status || (Number(qty) > 0 ? "Ate" : "Didn't Eat");

    const entry = await svc.upsertConsumption(
      {
        date,
        studentId,
        studentName: b.studentName  || b.student_name  || "",
        class:       b.class        || b.student_class  || "",
        mealType,
        foodItem:    b.foodItem     || b.food_item      || "",
        quantity:    String(qty),
        unit:        b.unit         || "",
        status:      resolvedStatus,
        notes:       b.notes        || "",
        updatedBy:   b.updatedBy    || b.updated_by     || actorUserId,
      },
      { schoolId, centerId, actorUserId }
    );

    const pct    = Number(entry.quantity) > 0 ? `${entry.quantity}${entry.unit ? " " + entry.unit : ""}` : "";
    const ateMsg = entry.status === "Ate" && pct
      ? `${entry.studentName || entry.studentId} consumed ${pct} of ${entry.mealType?.toLowerCase() || "meal"}.`
      : `${entry.studentName || entry.studentId} had ${entry.mealType?.toLowerCase() || "a meal"} — marked as "${entry.status}".`;

    notif.notifyAsync(() => notif.fireForStudent(entry.studentId, entry.schoolId || schoolId, {
      type:     notif.TYPES.FOOD_CONSUMPTION,
      childId:  entry.studentId,
      title:    `${entry.mealType || "Meal"} update for ${entry.studentName || entry.studentId}`,
      message:  ateMsg,
      deepLink: "/parent-daily-care",
    }));

    res.json({ success: true, message: "Consumption saved.", entryId: entry.entryId, entry });
  } catch (e) {
    logErr("POST /api/food-consumption", e);
    res.status(500).json({ success: false, error: e.message });
  }
}

// PUT is the same upsert
const updateConsumption = saveConsumption;

module.exports = { getConsumption, saveConsumption, updateConsumption };
