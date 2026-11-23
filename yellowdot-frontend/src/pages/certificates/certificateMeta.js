/**
 * certificateMeta.js — shared constants for the Certificates module
 *
 * A plain .js module rather than exports alongside a component, so the pages
 * stay single-export and react-refresh has nothing to complain about.
 *
 * Mirrors VALID_TYPES / VALID_TEMPLATES / DEFAULT_TITLES in
 * yellowdot-backend/services/certificateService.js. The backend validates
 * regardless — this copy exists to label and order the UI, not to enforce.
 */

export const CERTIFICATE_TYPES = [
  {
    value: "graduation",
    label: "Graduation / Completion",
    defaultTitle: "Certificate of Completion",
    defaultCitation: "has successfully completed the academic year",
    badge: "info",
    // The backend allows exactly one non-revoked graduation per child per
    // academic year; the UI says so up front rather than after a 409.
    oncePerYear: true,
    blurb: "End of term or academic year. Usually issued to a whole class at once.",
  },
  {
    value: "achievement",
    label: "Achievement",
    defaultTitle: "Certificate of Achievement",
    defaultCitation: "is awarded this certificate in recognition of outstanding achievement",
    badge: "yellow",
    oncePerYear: false,
    blurb: "Star of the Month, Best Reader, or any award you word yourself.",
  },
  {
    value: "participation",
    label: "Participation",
    defaultTitle: "Certificate of Participation",
    defaultCitation: "took part with great enthusiasm",
    badge: "success",
    oncePerYear: false,
    blurb: "Sports Day, Annual Day, competitions and school events.",
  },
  {
    value: "attendance",
    label: "Attendance Award",
    defaultTitle: "Certificate of Attendance",
    defaultCitation: "is commended for excellent attendance throughout the term",
    badge: "neutral",
    oncePerYear: false,
    blurb: "Eligible children are worked out from attendance already recorded.",
  },
];

export const TYPE_BY_VALUE = Object.fromEntries(CERTIFICATE_TYPES.map(t => [t.value, t]));

export const TYPE_OPTIONS = CERTIFICATE_TYPES.map(t => ({ value: t.value, label: t.label }));

export const TEMPLATES = [
  {
    value: "classic",
    label: "Classic",
    blurb: "Formal double rule, serif lettering. Reads as a school document.",
  },
  {
    value: "playful",
    label: "Playful",
    blurb: "Rounded frame and a brighter header. Suits the younger classes.",
  },
];

export const TEMPLATE_OPTIONS = TEMPLATES.map(t => ({ value: t.value, label: t.label }));

export const STATUS_OPTIONS = [
  { value: "issued",  label: "Issued"  },
  { value: "draft",   label: "Draft"   },
  { value: "revoked", label: "Revoked" },
];

export const STATUS_BADGE = {
  issued:  "success",
  draft:   "warn",
  revoked: "danger",
};

/** Attendance-award thresholds staff actually use. */
export const ATTENDANCE_THRESHOLDS = [
  { value: "100", label: "100% — perfect attendance" },
  { value: "95",  label: "95% and above" },
  { value: "90",  label: "90% and above" },
];

/** Today as an ISO date, in the browser's own timezone. */
export function todayISO() {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

/**
 * Indian preschool academic year (June 1 → May 31), mirroring
 * yellowdot-backend/utils/academicYear.js. Shown as a read-only hint while
 * issuing so staff can see which year a back-dated certificate lands in — a
 * March date and an April date are the same year, a June date is not.
 */
export function academicYearOf(dateISO) {
  const d = dateISO ? new Date(`${dateISO}T00:00:00`) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  const year  = d.getFullYear();
  const start = d.getMonth() + 1 >= 6 ? year : year - 1;
  return `${start}-${String(start + 1).slice(2)}`;
}

/** "28 March 2027" — how the date is printed on the certificate itself. */
export function formatAwardDate(dateISO) {
  if (!dateISO) return "";
  const d = new Date(`${dateISO}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateISO;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}
