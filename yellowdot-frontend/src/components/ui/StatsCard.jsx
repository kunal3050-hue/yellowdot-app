/**
 * StatsCard — premium KPI metric tile
 *
 * @prop {string}    label        metric name
 * @prop {string}    value        main number / text
 * @prop {string}    sub          secondary text line
 * @prop {ReactNode} icon         emoji or SVG shown in icon area
 * @prop {string}    iconBg       icon background color override
 * @prop {number}    trend        numeric % change — positive=up, negative=down, 0=flat
 * @prop {string}    trendLabel   suffix after trend number (default: "%")
 * @prop {string}    color        accent color for the left border stripe
 * @prop {boolean}   loading      show skeleton shimmer state
 * @prop {boolean}   highlight    adds prominent yellow border + shadow
 * @prop {string}    variant      "default" | "navy" | "success" | "danger" | "warning"
 * @prop {function}  onClick      makes card clickable
 * @prop {string}    className
 */
import Skeleton from "./Skeleton";

const VARIANT_STYLES = {
  default: {
    border:     "1px solid var(--yd-border-light)",
    background: "var(--yd-surface)",
    valueColor: "var(--yd-charcoal)",
  },
  navy: {
    border:     "1px solid rgba(234,179,8,0.35)",
    background: "linear-gradient(135deg, #facc15 0%, #eab308 100%)",
    valueColor: "#1f1f1f",
    labelColor: "rgba(31,31,31,0.65)",
    subColor:   "rgba(31,31,31,0.50)",
  },
  success: {
    border:     "1px solid var(--yd-success-border)",
    background: "linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)",
    valueColor: "var(--yd-success)",
  },
  danger: {
    border:     "1px solid var(--yd-danger-border)",
    background: "linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%)",
    valueColor: "var(--yd-danger)",
  },
  warning: {
    border:     "1px solid var(--yd-warning-border)",
    background: "linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)",
    valueColor: "var(--yd-warning)",
  },
};

export default function StatsCard({
  label,
  value,
  sub,
  icon,
  iconBg,
  trend,
  trendLabel  = "%",
  color,
  loading     = false,
  highlight   = false,
  variant     = "default",
  onClick,
  className   = "",
}) {
  const vstyle     = VARIANT_STYLES[variant] ?? VARIANT_STYLES.default;
  const isNavy     = variant === "navy";
  const trendUp    = trend > 0;
  const trendFlat  = trend === 0 || trend == null;

  return (
    <div
      className={`yd-stat ${onClick ? "yd-card-hover" : ""} ${className}`}
      onClick={onClick}
      style={{
        position:   "relative",
        cursor:     onClick ? "pointer" : "default",
        overflow:   "hidden",
        background: vstyle.background,
        border:     highlight
          ? "2px solid var(--yd-yellow)"
          : vstyle.border,
        boxShadow:  highlight
          ? "0 4px 20px rgba(244,196,0,0.20), var(--yd-shadow-sm)"
          : "var(--yd-shadow-card)",
      }}
    >
      {/* Colored accent stripe on left edge */}
      {color && (
        <div style={{
          position:    "absolute",
          left:        0, top: 0, bottom: 0,
          width:       3,
          borderRadius:"2px 0 0 2px",
          background:  color,
        }} />
      )}

      {/* Icon */}
      {icon && (
        <div style={{
          position:       "absolute",
          top:            14,
          right:          14,
          width:          36,
          height:         36,
          borderRadius:   "var(--yd-radius-sm)",
          background:     iconBg ?? (isNavy ? "rgba(255,255,255,0.35)" : "var(--yd-yellow-light)"),
          border:         isNavy ? "1px solid rgba(31,31,31,0.12)" : "1px solid var(--yd-border-light)",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          fontSize:       17,
          flexShrink:     0,
        }}>
          {icon}
        </div>
      )}

      {/* Label */}
      <div
        className="yd-stat-label"
        style={{ color: vstyle.labelColor, paddingRight: icon ? 44 : 0 }}
      >
        {loading ? <Skeleton width={72} height={10} /> : label}
      </div>

      {/* Value */}
      <div
        className="yd-stat-value"
        style={{ marginTop: 4, color: vstyle.valueColor }}
      >
        {loading ? <Skeleton width={100} height={28} /> : value}
      </div>

      {/* Sub + trend */}
      {(sub != null || trend != null) && (
        <div
          className="yd-stat-sub"
          style={{
            marginTop:  6,
            display:    "flex",
            alignItems: "center",
            gap:        6,
            color:      vstyle.subColor,
          }}
        >
          {loading ? (
            <Skeleton width={110} height={10} />
          ) : (
            <>
              {trend != null && !trendFlat && (
                <span style={{
                  display:    "inline-flex",
                  alignItems: "center",
                  gap:        2,
                  fontSize:   "var(--yd-font-size-xs)",
                  fontWeight: "var(--yd-weight-bold)",
                  color:      trendUp
                    ? (isNavy ? "#86EFAC" : "var(--yd-success)")
                    : (isNavy ? "#FCA5A5" : "var(--yd-danger)"),
                }}>
                  {trendUp ? "↑" : "↓"} {Math.abs(trend)}{trendLabel}
                </span>
              )}
              {sub && <span>{sub}</span>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
