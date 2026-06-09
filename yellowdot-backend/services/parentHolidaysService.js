/**
 * parentHolidaysService.js — Parent Module · Daily Care · Holiday Calendar (read-only)
 * ───────────────────────────────────────────────────────────────────────────────
 * Read-only parent view of the SCHOOL holiday calendar. Reuses the existing
 * staff/admin holidays collection (no separate parent collection, no schema
 * change). Parents see exactly what staff enters.
 *
 *   holidays/{id}: { title, startDate(YYYY-MM-DD), endDate, type,
 *                    description, recurring, pushToParents, schoolId }
 *
 * Type-agnostic: any `type` string staff enters (e.g. "School Closed",
 * "Half Day", "National Holiday", "Festival Holiday", "Special Event") flows
 * straight through — the parent UI styles by type with a safe fallback, so new
 * types need no backend change.
 */

const communicationService = require("./communicationService");

const todayISO = () => new Date().toISOString().slice(0, 10);

function toSafe(h) {
  const startDate = h.startDate || "";
  return {
    id: h.id,
    title: h.title || "",
    startDate,
    endDate: h.endDate || startDate,
    type: h.type || "School Holiday",
    description: h.description || "",
    recurring: !!h.recurring,
  };
}

/**
 * @param {Object} opts
 * @param {string} opts.schoolId
 * @param {string} [opts.year]  optional YYYY filter (calendar browses client-side)
 */
async function getHolidaysView({ schoolId, year } = {}) {
  // Equality-only query (schoolId) — reuses staff service, no composite index.
  // Fetch the full calendar so the parent calendar can browse any month
  // without re-fetching; optionally narrow by year.
  const all = await communicationService.getHolidays({ schoolId, year });
  const holidays = all.map(toSafe).sort((a, b) => a.startDate.localeCompare(b.startDate));

  const today = todayISO();
  const upcoming = holidays.filter(h => (h.endDate || h.startDate) >= today);

  return { today, holidays, upcoming };
}

module.exports = { getHolidaysView };
