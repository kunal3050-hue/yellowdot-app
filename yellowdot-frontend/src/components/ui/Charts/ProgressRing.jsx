/**
 * ProgressRing — circular progress indicator (pure SVG, no Recharts needed)
 * @prop {number} value        0–100
 * @prop {number} size          diameter in px (default: 72)
 * @prop {number} strokeWidth
 * @prop {string} color
 * @prop {ReactNode} label      shown centered (defaults to "{value}%")
 */
import useChartTokens from "./useChartTokens";

export default function ProgressRing({ value = 0, size = 72, strokeWidth = 8, color, label }) {
  const { colorAt, grid } = useChartTokens();
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  const resolvedColor = color || colorAt(0);

  return (
    <div style={{ position: "relative", width: size, height: size, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={grid} strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={resolvedColor} strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.4s var(--yd-ease, ease)" }}
        />
      </svg>
      <span style={{ position: "absolute", fontSize: Math.max(11, size * 0.2), fontWeight: 700, color: "var(--yd-charcoal)" }}>
        {label ?? `${Math.round(clamped)}%`}
      </span>
    </div>
  );
}
