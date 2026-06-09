/**
 * parentFoodMenuService.js — Parent Module · Daily Care · Food Menu (read-only)
 * ───────────────────────────────────────────────────────────────────────────
 * Reuses the existing foodMenus collection (staff-managed). The menu is the
 * same for the whole school on a given day, so this is school-scoped (not
 * child-specific). No schema/db changes.
 *
 *   foodMenus/{id}: { date, mealType, itemName, unitType, schoolId, ... }
 *   A day's menu = the items for that date, grouped by mealType.
 */

const foodMenuService = require("./foodMenuService");

const DEFAULT_SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";

// Canonical meal order (matches the staff Food Menu module).
const MEAL_ORDER = ["Breakfast", "Mid-Morning", "Roti Sabzi", "Dal Rice", "Milk", "Snacks"];

/**
 * @param {Object} opts
 * @param {string}  opts.schoolId
 * @param {string} [opts.date]  YYYY-MM-DD (defaults to the most recent menu, else today)
 * @returns {Promise<{date, meals, availableDates}>}
 */
async function getFoodMenuView({ schoolId = DEFAULT_SCHOOL_ID, date } = {}) {
  const all = await foodMenuService.getMenus({ schoolId }); // school-scoped, all dates

  const availableDates = [...new Set(all.map(m => m.date).filter(Boolean))]
    .sort((a, b) => b.localeCompare(a))   // newest first
    .slice(0, 30);

  const targetDate =
    (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) ? date
    : (availableDates[0] || new Date().toISOString().slice(0, 10));

  const dayItems = all.filter(m => m.date === targetDate && m.itemName);

  // Group by mealType, then order by the canonical list (unknown types appended).
  const byType = {};
  for (const m of dayItems) {
    (byType[m.mealType] || (byType[m.mealType] = [])).push({ itemName: m.itemName, unitType: m.unitType });
  }
  const ordered = [
    ...MEAL_ORDER.filter(t => byType[t]),
    ...Object.keys(byType).filter(t => !MEAL_ORDER.includes(t)),
  ];
  const meals = ordered.map(mealType => ({ mealType, items: byType[mealType] }));

  return { date: targetDate, meals, availableDates };
}

module.exports = { getFoodMenuView };
