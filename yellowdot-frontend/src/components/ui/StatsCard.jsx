import Skeleton from "./Skeleton";

/**
 * StatsCard — KPI metric tile
 *
 * @prop {string}    label       metric name
 * @prop {string}    value       main number / text
 * @prop {string}    sub         secondary line (e.g. "vs last month")
 * @prop {ReactNode} icon        icon element shown in top-right corner
 * @prop {number}    trend       numeric change (positive = up, negative = down)
 * @prop {string}    trendLabel  label after the trend number
 * @prop {boolean}   loading     show skeleton state
 * @prop {string}    className
 */
export default function StatsCard({
  label,
  value,
  sub,
  icon,
  trend,
  trendLabel,
  loading = false,
  className = "",
}) {
  const trendPositive = trend > 0;
  const trendNeutral  = trend === 0 || trend == null;

  return (
    <div className={`yd-stat ${className}`} style={{ position: "relative" }}>
      {icon && (
        <div style={{
          position: "absolute", top: 14, right: 14,
          width: 36, height: 36,
          borderRadius: "var(--yd-radius)",
          background: "var(--yd-yellow-light)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, flexShrink: 0,
        }}>
          {icon}
        </div>
      )}

      <div className="yd-stat-label">
        {loading ? <Skeleton width={80} height={10} /> : label}
      </div>

      <div className="yd-stat-value" style={{ marginTop: 4 }}>
        {loading ? <Skeleton width={100} height={28} /> : value}
      </div>

      {(sub || trend != null) && (
        <div className="yd-stat-sub" style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
          {loading ? (
            <Skeleton width={120} height={11} />
          ) : (
            <>
              {trend != null && !trendNeutral && (
                <span style={{
                  fontSize: "var(--yd-font-size-xs)",
                  fontWeight: "var(--yd-weight-bold)",
                  color: trendPositive ? "var(--yd-success)" : "var(--yd-danger)",
                  display: "inline-flex", alignItems: "center", gap: 2,
                }}>
                  {trendPositive ? "↑" : "↓"} {Math.abs(trend)}{trendLabel || "%"}
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
