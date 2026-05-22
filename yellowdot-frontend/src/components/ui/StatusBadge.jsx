/**
 * StatusBadge — semantic status pill
 *
 * Covers: invoice statuses, student statuses, attendance, user roles.
 * Reads from theme.statusConfig for consistent color mapping.
 *
 * @prop {string}  status    "Paid" | "Pending" | "Active" | "Present" | "admin" | …
 * @prop {boolean} dot       show leading dot (default: true)
 * @prop {boolean} pill      fully rounded pill style (default: true)
 * @prop {string}  size      "xs" | "sm" | "md" (default: "sm")
 * @prop {string}  className
 */

import { statusConfig } from "../../design-system/theme";

const SIZE = {
  xs: { fontSize: 9,  padding: "1px 6px",  dotSize: 4 },
  sm: { fontSize: 10, padding: "2px 8px",  dotSize: 5 },
  md: { fontSize: 11, padding: "4px 12px", dotSize: 6 },
};

export default function StatusBadge({
  status,
  dot = true,
  pill = true,
  size = "sm",
  className = "",
  style = {},
}) {
  const cfg = statusConfig[status] ?? {
    label:  status || "—",
    text:   "#6B7280",
    bg:     "#F3F4F6",
    border: "#E5E7EB",
    dot:    "#9CA3AF",
  };

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
