/**
 * academicYear.js — Indian preschool academic year utility
 *
 * Academic year: June 1 → May 31
 *
 * getAcademicYear("2026-07-15") → "2026-27"
 * getAcademicYear("2027-02-10") → "2026-27"
 * getAcademicYear("2027-06-01") → "2027-28"
 * getAcademicYear("2027-05-31") → "2026-27"
 */

function getAcademicYear(dateISO) {
  const d     = dateISO ? new Date(`${dateISO}T00:00:00`) : new Date();
  const year  = d.getFullYear();
  const month = d.getMonth() + 1; // 1-indexed
  const start = month >= 6 ? year : year - 1;
  return `${start}-${String(start + 1).slice(2)}`;
}

function currentAcademicYear() {
  return getAcademicYear(null);
}

module.exports = { getAcademicYear, currentAcademicYear };
