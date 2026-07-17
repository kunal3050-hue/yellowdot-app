/**
 * StatusBadge — semantic status pill
 *
 * Covers: invoice statuses, student statuses, attendance, user roles.
 * Colors are CSS custom properties from tokens.css (via a semantic-group
 * mapping below), never a separate hardcoded palette — this is the single
 * source every status pill in the app renders from, so it always matches
 * the tokens.css palette (light and dark) it's placed next to.
 *
 * @prop {string}  status    "Paid" | "Pending" | "Active" | "Present" | "admin" | …
 * @prop {boolean} dot       show leading dot (default: true)
 * @prop {boolean} pill      fully rounded pill style (default: true)
 * @prop {string}  size      "xs" | "sm" | "md" (default: "sm")
 * @prop {string}  className
 */

const SIZE = {
  xs: { fontSize: 9,  padding: "1px 6px",  dotSize: 4 },
  sm: { fontSize: 10, padding: "2px 8px",  dotSize: 5 },
  md: { fontSize: 11, padding: "4px 12px", dotSize: 6 },
};

// Each status maps to one of the semantic token groups defined in
// tokens.css (--yd-success/-soft/-border, --yd-warning/…, --yd-danger/…,
// --yd-info/…, --yd-neutral/…) plus the brand yellow for the two roles
// that represent "elevated platform access" rather than a health state.
const GROUP = {
  success: { text: "var(--yd-success)", bg: "var(--yd-success-soft)", border: "var(--yd-success-border)" },
  warning: { text: "var(--yd-warning)", bg: "var(--yd-warning-soft)", border: "var(--yd-warning-border)" },
  danger:  { text: "var(--yd-danger)",  bg: "var(--yd-danger-soft)",  border: "var(--yd-danger-border)" },
  info:    { text: "var(--yd-info)",    bg: "var(--yd-info-soft)",    border: "var(--yd-info-border)" },
  neutral: { text: "var(--yd-neutral)", bg: "var(--yd-neutral-soft)", border: "var(--yd-neutral-border)" },
  yellow:  { text: "var(--yd-yellow-dark)", bg: "var(--yd-yellow-light, #FFF9E0)", border: "var(--yd-yellow-dark)" },
};

const STATUS_LABEL_GROUP = {
  // Student / general
  Active: "success", Inactive: "neutral", Alumni: "warning",
  // Invoice / payment
  Paid: "success", Pending: "warning", Partial: "warning", Overdue: "danger", Cancelled: "neutral", Completed: "success",
  // Attendance
  Present: "success", Absent: "danger", Late: "warning", Holiday: "info",
  // User roles
  developer: "yellow", super_admin: "danger", admin: "info", center_admin: "info",
  teacher: "success", accountant: "warning", reception: "neutral", parent: "yellow",
  // Staff employment status (staffService.STAFF_ENUMS.employmentStatuses)
  draft: "neutral", active: "success", on_leave: "warning", notice_period: "warning",
  resigned: "neutral", terminated: "danger", inactive: "neutral", retired: "neutral",
  // Staff login-link status (staffService.LOGIN_STATUS_META)
  not_linked: "neutral", invitation_sent: "warning", disabled: "danger",
  // Staff attendance status (staffAttendanceService.ATTENDANCE_STATUSES)
  present: "success", absent: "danger", half_day: "warning", leave: "warning",
  holiday: "info", wfh: "neutral", weekend: "neutral",
  // Leave request status (leaveService.LEAVE_STATUS_META)
  pending: "warning", approved: "success", rejected: "danger", cancelled: "neutral",
  // Payroll run status (payrollService.RUN_STATUS_META)
  processed: "success", locked: "warning", reversed: "danger",
};

// Role keys need a friendlier display label than the raw snake_case value —
// everything else's label is identical to its key.
const FRIENDLY_LABEL = {
  developer: "Developer", super_admin: "Super Admin", admin: "Admin",
  center_admin: "Ctr Admin", teacher: "Teacher", accountant: "Accountant",
  reception: "Reception", parent: "Parent",
  draft: "Draft", active: "Active", on_leave: "On Leave", notice_period: "Notice Period",
  resigned: "Resigned", terminated: "Terminated", inactive: "Inactive", retired: "Retired",
  not_linked: "Not Linked", invitation_sent: "Invitation Sent", disabled: "Disabled",
  present: "Present", absent: "Absent", half_day: "Half Day", leave: "Leave",
  holiday: "Holiday", wfh: "WFH", weekend: "Weekend",
  pending: "Pending", approved: "Approved", rejected: "Rejected", cancelled: "Cancelled",
  processed: "Processed", locked: "Locked", reversed: "Reversed",
};

function _statusConfig(status) {
  const group = GROUP[STATUS_LABEL_GROUP[status]] ?? GROUP.neutral;
  const label = FRIENDLY_LABEL[status] ?? (status || "—");
  return { label, text: group.text, bg: group.bg, border: group.border, dot: group.text };
}

export default function StatusBadge({
  status,
  dot = true,
  pill = true,
  size = "sm",
  className = "",
  style = {},
}) {
  const cfg = _statusConfig(status);

  const s = SIZE[size] ?? SIZE.sm;

  return (
    <span
      className={className}
      style={{
        display:        "inline-flex",
        alignItems:     "center",
        gap:            s.dotSize + 1,
        padding:        s.padding,
        borderRadius:   pill ? 9999 : 5,
        fontSize:       s.fontSize,
        fontWeight:     700,
        letterSpacing:  "0.06em",
        textTransform:  "uppercase",
        whiteSpace:     "nowrap",
        lineHeight:     1.4,
        background:     cfg.bg,
        color:          cfg.text,
        border:         `1px solid ${cfg.border}`,
        ...style,
      }}
    >
      {dot && (
        <span
          style={{
            width:        s.dotSize,
            height:       s.dotSize,
            borderRadius: "50%",
            background:   cfg.dot ?? cfg.text,
            display:      "inline-block",
            flexShrink:   0,
          }}
        />
      )}
      {cfg.label}
    </span>
  );
}
