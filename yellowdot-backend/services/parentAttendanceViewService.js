/**
 * parentAttendanceViewService.js — Parent Module · Phase 3 (Attendance VIEW)
 * ───────────────────────────────────────────────────────────────────────────
 * Read-only, parent-facing view of a CHILD's attendance. Composes the existing
 * attendance + holiday data — it does NOT create a parallel attendance system.
 *
 *   attendance/{id}  via attendanceService.getAttendanceHistory()
 *   holidays/{id}    via communicationService.getHolidays()
 *
 * One call powers all four V1 widgets for a child + month:
 *   • Today's status (Present | Absent | Holiday | NotMarked)
 *   • Monthly attendance percentage
 *   • Calendar (date → status map)
 *   • History list
 *
 * No editing, no teacher actions, no reports/analytics.
 */

const attendanceService = require("./attendanceService");
const comms             = require("./communicationService");

const DEFAULT_SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";

const pad = n => String(n).padStart(2, "0");
const todayISO = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => new Date().toISOString().slice(0, 7); // YYYY-MM

/** All YYYY-MM-DD strings from start..end (inclusive). Bounded for safety. */
function eachDate(start, end) {
  const out = [];
  if (!start) return out;
  let d = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${(end || start)}T00:00:00Z`);
  let guard = 0;
  while (d <= last && guard < 400) {
    out.push(d.toISOString().slice(0, 10));
    d = new Date(d.getTime() + 86400000);
    guard++;
  }
  return out;
}

/**
 * @param {Object} opts
 * @param {string} opts.studentId
 * @param {string} [opts.schoolId]
 * @param {string} [opts.month]  YYYY-MM (defaults to current month)
 */
async function getChildAttendance({ studentId, schoolId = DEFAULT_SCHOOL_ID, month } = {}) {
  const ym       = /^\d{4}-\d{2}$/.test(month || "") ? month : currentMonth();
  const [yy, mm] = ym.split("-").map(Number);
  const daysInMonth = new Date(yy, mm, 0).getDate();
  const from = `${ym}-01`;
  const to   = `${ym}-${pad(daysInMonth)}`;

  const [records, holidays] = await Promise.all([
    attendanceService.getAttendanceHistory({ studentId, from, to, limit: 400, schoolId }),
    comms.getHolidays({ schoolId, year: String(yy) }),
  ]);

  // ── Holiday date set within this month ────────────────────────────
  const holidayDates = new Set();
  for (const h of holidays) {
    for (const d of eachDate(h.startDate, h.endDate || h.startDate)) {
      if (d.startsWith(ym)) holidayDates.add(d);
    }
  }

  // ── Per-day status map (record wins over holiday) ─────────────────
  const days = {};
  holidayDates.forEach(d => { days[d] = "Holiday"; });
  records.forEach(r => { if (r.date) days[r.date] = r.status || "Absent"; });

  // ── Monthly percentage (over recorded school days; holidays excluded) ─
  let present = 0, absent = 0, late = 0;
  records.forEach(r => {
    if (holidayDates.has(r.date)) return;
    if (r.status === "Present") present++;
    else if (r.status === "Late") late++;
    else if (r.status === "Absent") absent++;
  });
  const recorded   = present + late + absent;
  const percentage = recorded > 0 ? Math.round(((present + late) / recorded) * 100) : null;

  // ── Today's status ────────────────────────────────────────────────
  const td = todayISO();
  let todayStatus = "NotMarked";
  if (td.startsWith(ym)) {
    if (days[td]) todayStatus = days[td];
    else if (holidayDates.has(td)) todayStatus = "Holiday";
  }

  // ── History list (newest first) ───────────────────────────────────
  const history = records.map(r => ({
    date:     r.date,
    status:   holidayDates.has(r.date) ? "Holiday" : (r.status || "Absent"),
    checkIn:  r.checkIn || "",
    checkOut: r.checkOut || "",
  }));

  return {
    studentId,
    month: ym,
    daysInMonth,
    today:      { date: td, status: todayStatus },
    percentage,
    summary:    { present, absent, late, holiday: holidayDates.size, recorded },
    days,       // { "YYYY-MM-DD": "Present" | "Absent" | "Late" | "Holiday" }
    history,
  };
}

module.exports = { getChildAttendance };
