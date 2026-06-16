/**
 * parentHolidaysService.js — Parent Module · Holiday Calendar (read-only)
 *
 * Reads the staff holidays collection and filters by class relevance:
 *   appliesTo === "all"       → visible to every parent
 *   appliesTo === "selected"  → visible only if student.classId is in classIds
 *
 * If studentClassId is unknown (student has no classId assigned yet) we show
 * all holidays so parents never see an empty calendar by accident.
 */

const communicationService = require("./communicationService");

const todayISO = () => new Date().toISOString().slice(0, 10);

function toSafe(h) {
  const startDate = h.startDate || "";
  return {
    id:          h.id,
    title:       h.title       || "",
    startDate,
    endDate:     h.endDate     || startDate,
    type:        h.type        || "School Holiday",
    description: h.description || "",
    recurring:   !!h.recurring,
    appliesTo:   h.appliesTo   || "all",
    classIds:    h.classIds    || [],
  };
}

/**
 * @param {Object} opts
 * @param {string}  opts.schoolId
 * @param {string}  [opts.year]           optional YYYY filter
 * @param {string}  [opts.studentClassId] child's classId for filtering
 */
async function getHolidaysView({ schoolId, year, studentClassId } = {}) {
  const all = await communicationService.getHolidays({ schoolId, year });

  const holidays = all
    .filter(h => {
      const appliesTo = h.appliesTo || "all";
      if (appliesTo === "selected") {
        // If the student has no classId yet, show the holiday (safe fallback).
        if (!studentClassId) return true;
        return (h.classIds || []).includes(studentClassId);
      }
      return true; // "all" or legacy records with no appliesTo field
    })
    .map(toSafe)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  const today    = todayISO();
  const upcoming = holidays.filter(h => (h.endDate || h.startDate) >= today);

  return { today, holidays, upcoming };
}

module.exports = { getHolidaysView };
