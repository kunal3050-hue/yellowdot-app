/**
 * parentConsumptionService.js — Parent Module · Daily Care · Consumption Log
 * ───────────────────────────────────────────────────────────────────────────
 * Read-only parent view of a CHILD's food consumption. Reuses the staff-managed
 * foodConsumption collection. No schema/db changes.
 *
 *   foodConsumption/{id}: { date, studentId, mealType, foodItem, quantity, unit,
 *                           status ("Ate" | "Skipped"), notes, ... }
 *   One doc per child / meal / day.
 */

const fc = require("./foodConsumptionService");

const DEFAULT_SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";
const MEAL_ORDER = ["Breakfast", "Mid-Morning", "Roti Sabzi", "Dal Rice", "Milk", "Snacks"];
const todayISO = () => new Date().toISOString().slice(0, 10);

function toSafe(e) {
  return {
    mealType: e.mealType, foodItem: e.foodItem,
    quantity: e.quantity, unit: e.unit,
    status: e.status, notes: e.notes, date: e.date,
  };
}

/**
 * @param {Object} opts
 * @param {string} opts.schoolId
 * @param {string} opts.studentId  (caller enforces ownership)
 * @param {string} [opts.date]     YYYY-MM-DD (defaults to most recent logged day, else today)
 */
async function getConsumptionView({ schoolId = DEFAULT_SCHOOL_ID, studentId, date } = {}) {
  if (!studentId) {
    return { studentId: null, date: date || todayISO(), entries: [], summary: { ate: 0, skipped: 0, logged: 0 }, availableDates: [] };
  }
  // Equality-only query (schoolId + studentId) — no composite index needed.
  const all = await fc.getConsumption({ schoolId, studentId });

  const availableDates = [...new Set(all.map(e => e.date).filter(Boolean))]
    .sort((a, b) => b.localeCompare(a)).slice(0, 30);
  const targetDate =
    (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) ? date : (availableDates[0] || todayISO());

  const day = all.filter(e => e.date === targetDate && (e.foodItem || e.status));
  day.sort((a, b) => {
    const ia = MEAL_ORDER.indexOf(a.mealType), ib = MEAL_ORDER.indexOf(b.mealType);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  let ate = 0, skipped = 0;
  for (const e of day) {
    if (e.status === "Ate") ate++;
    else if (e.status) skipped++;
  }

  return {
    studentId,
    date: targetDate,
    entries: day.map(toSafe),
    summary: { ate, skipped, logged: day.length },
    availableDates,
  };
}

module.exports = { getConsumptionView };
