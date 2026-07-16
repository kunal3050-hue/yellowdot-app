/**
 * KpiCard — the standard dashboard number card
 * @prop {string}  label
 * @prop {string|number} value
 * @prop {number}  trend         signed % change, e.g. 12.4 or -3.1 (renders arrow + color)
 * @prop {string}  trendLabel    e.g. "vs last month"
 * @prop {string}  comparison    e.g. "42 last term" — a secondary reference value, distinct from trend
 * @prop {ReactNode} icon
 * @prop {Array}   sparkline     optional trend data, rendered bottom-right
 * @prop {boolean} loading
 * @prop {boolean} empty         renders a muted "—" value when there's genuinely no data (not loading)
 * @prop {function} onClick      makes the card a clickable action; adds hover/focus affordance
 */
import { TrendingUp, TrendingDown } from "lucide-react";
import Skeleton from "../Skeleton";
import Sparkline from "./Sparkline";

export default function KpiCard({
  label, value, trend, trendLabel, comparison, icon, sparkline,
  loading = false, empty = false, onClick, className = "",
}) {
  if (loading) {
    return (
      <div className={`yd-kpi-card ${className}`}>
        <Skeleton height={11} width="50%" />
        <div style={{ marginTop: 10 }}><Skeleton height={26} width="65%" /></div>
        <div style={{ marginTop: 8 }}><Skeleton height={10} width="40%" /></div>
      </div>
    );
  }

  const isUp = typeof trend === "number" && trend >= 0;
  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`yd-kpi-card ${onClick ? "yd-kpi-card--clickable" : ""} ${className}`}
    >
      <div className="yd-kpi-top">
        <span className="yd-kpi-label">{label}</span>
        {icon && <span className="yd-kpi-icon">{icon}</span>}
      </div>
      <div className="yd-kpi-value">{empty ? "—" : value}</div>
      <div className="yd-kpi-bottom">
        {!empty && typeof trend === "number" && (
          <span className={`yd-kpi-trend ${isUp ? "yd-kpi-trend--up" : "yd-kpi-trend--down"}`}>
            {isUp ? <TrendingUp size={12} strokeWidth={2.2} /> : <TrendingDown size={12} strokeWidth={2.2} />}
            {Math.abs(trend)}%
          </span>
        )}
        {!empty && trendLabel && <span className="yd-kpi-trend-label">{trendLabel}</span>}
        {!empty && comparison && <span className="yd-kpi-comparison">{comparison}</span>}
        {!empty && sparkline && <span className="yd-kpi-sparkline"><Sparkline data={sparkline} height={24} width={72} /></span>}
      </div>
    </Tag>
  );
}
