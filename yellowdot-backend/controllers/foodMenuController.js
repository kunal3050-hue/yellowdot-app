/**
 * foodMenuController.js — Firestore-backed
 *
 * POST   /api/food-menu        — save a day's meal plan
 * GET    /api/food-menu        — fetch menus (date/branch filters)
 * PUT    /api/food-menu/:date  — replace all meals for a date
 * DELETE /api/food-menu/:date  — delete all meals for a date
 */

const svc = require("../services/foodMenuService");

const DEFAULT_SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";

const MEAL_ORDER = [
  "Breakfast", "Mid-Morning", "Roti Sabzi", "Dal Rice", "Milk", "Snacks",
];

function resolveCtx(req) {
  return {
    schoolId:    req.user?.schoolId  || DEFAULT_SCHOOL_ID,
    centerId:    req.user?.centerId  || "",
    actorUserId: req.user?.userId    || "system",
  };
}

function logErr(route, e) { console.error(`[${route}]`, e.message); }

// ── POST /api/food-menu ───────────────────────────────────────────
// Body: { date, branch?, meals: [{ mealType, itemName, unitType }] }

async function saveMenu(req, res) {
  try {
    const { schoolId, centerId, actorUserId } = resolveCtx(req);
    const { date, branch = "Main", meals } = req.body;

    if (!date || !Array.isArray(meals) || meals.length === 0) {
      return res.status(400).json({ success: false, message: "date and meals[] are required." });
    }

    const valid = meals.filter(m => m.itemName && String(m.itemName).trim() !== "");
    if (valid.length === 0) {
      return res.status(400).json({ success: false, message: "At least one meal must have a food item." });
    }

    const created = await Promise.all(
      valid.map(m => svc.createMenu(
        { date, mealType: m.mealType || "", itemName: String(m.itemName).trim(), unitType: m.unitType || "pcs", branch },
        { schoolId, centerId, actorUserId }
      ))
    );

    res.json({
      success: true,
      message: `Menu for ${date} saved with ${created.length} item${created.length !== 1 ? "s" : ""}.`,
      count:   created.length,
    });
  } catch (e) {
    logErr("POST /api/food-menu", e);
    res.status(500).json({ success: false, error: e.message });
  }
}

// ── GET /api/food-menu?date=&branch= ─────────────────────────────

async function getMenus(req, res) {
  try {
    const { schoolId, centerId } = resolveCtx(req);
    const bypassCenter = ["developer", "super_admin", "admin"].includes(req.user?.role);
    const { date, branch } = req.query;
    let menus = await svc.getMenus({
      date, branch,
      schoolId,
      centerId: bypassCenter ? undefined : centerId,
    });

    // Sort: newest date first, then canonical meal order within date
    menus.sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      const ai = MEAL_ORDER.indexOf(a.mealType);
      const bi = MEAL_ORDER.indexOf(b.mealType);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

    res.json(menus);
  } catch (e) {
    logErr("GET /api/food-menu", e);
    res.status(500).json({ error: "Failed to fetch menus.", details: e.message });
  }
}

// ── PUT /api/food-menu/:date ──────────────────────────────────────
// Replaces all rows for the given date with a fresh set.

async function updateMenu(req, res) {
  try {
    const { schoolId, centerId, actorUserId } = resolveCtx(req);
    const { date } = req.params;
    const { branch = "Main", meals } = req.body;

    if (!date || !Array.isArray(meals) || meals.length === 0) {
      return res.status(400).json({ success: false, message: "date param and meals[] are required." });
    }

    const valid = meals.filter(m => m.itemName && String(m.itemName).trim() !== "");
    if (valid.length === 0) {
      return res.status(400).json({ success: false, message: "At least one meal must have a food item." });
    }

    // Delete existing docs for this date then recreate
    await svc.deleteMenuByDate(date, { schoolId });
    const created = await Promise.all(
      valid.map(m => svc.createMenu(
        { date, mealType: m.mealType || "", itemName: String(m.itemName).trim(), unitType: m.unitType || "pcs", branch },
        { schoolId, centerId, actorUserId }
      ))
    );

    res.json({
      success: true,
      message: `Menu for ${date} updated with ${created.length} item${created.length !== 1 ? "s" : ""}.`,
      count:   created.length,
    });
  } catch (e) {
    logErr("PUT /api/food-menu/:date", e);
    res.status(500).json({ success: false, error: e.message });
  }
}

// ── DELETE /api/food-menu/:date ───────────────────────────────────

async function deleteMenu(req, res) {
  try {
    const { schoolId } = resolveCtx(req);
    const { date } = req.params;
    if (!date) return res.status(400).json({ success: false, message: "date param is required." });
    const result = await svc.deleteMenuByDate(date, { schoolId });
    res.json({ success: true, message: `Menu for ${date} deleted.`, ...result });
  } catch (e) {
    logErr("DELETE /api/food-menu/:date", e);
    res.status(500).json({ success: false, error: e.message });
  }
}

module.exports = { saveMenu, getMenus, updateMenu, deleteMenu };
