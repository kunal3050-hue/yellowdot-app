/**
 * parentNapService.js — Parent Module · Daily Care · Nap Tracker (read-only)
 * ───────────────────────────────────────────────────────────────────────────
 * Read-only parent view of a CHILD's naps. Reuses the staff-managed napLogs
 * collection. No schema/db changes.
 *
 *   napLogs/{id}: { date, studentId, startTime(ISO), endTime(ISO|null),
 *                   duration(minutes), status ("sleeping"|"done"), mood, notes }
 */

const napService = require("./napService");

const DEFAULT_SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";
const todayISO = () => new Date().toISOString().slice(0, 10);

function toSafe(n) {
  return {
    napId: n.napId, date: n.date,
    startTime: n.startTime, endTime: n.endTime,
    duration: n.duration, status: n.status,
    mood: n.mood, notes: n.notes,
  };
}

/**
 * @param {Object} opts
 * @param {string} opts.schoolId
 * @param {string} opts.studentId  (caller enforces ownership)
 * @param {string} [opts.date]     YYYY-MM-DD (defaults to most recent nap day, else today)
 */
async function getNapView({ schoolId = DEFAULT_SCHOOL_ID, studentId, date } = {}) {
  if (!studentId) {
    return { studentId: null, date: date || todayISO(), naps: [], totalMinutes: 0, count: 0, activeCount: 0, availableDates: [] };
  }
  // Equality-only query (schoolId + studentId) — no composite index needed.
  const all = await napService.getNapHistory({ schoolId, studentId, limit: 500 });

  const availableDates = [...new Set(all.map(n => n.date).filter(Boolean))]
    .sort((a, b) => b.localeCompare(a)).slice(0, 30);
  const targetDate =
    (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) ? date : (availableDates[0] || todayISO());

  const day = all.filter(n => n.date === targetDate);
  // Timeline order: earliest start first.
  day.sort((a, b) => String(a.startTime || "").localeCompare(String(b.startTime || "")));

  const totalMinutes = day.reduce((s, n) => s + (Number(n.duration) || 0), 0);
  const activeCount = day.filter(n => n.status === "sleeping").length;

  return {
    studentId,
    date: targetDate,
    naps: day.map(toSafe),
    totalMinutes,
    count: day.length,
    activeCount,
    availableDates,
  };
}

module.exports = { getNapView };
