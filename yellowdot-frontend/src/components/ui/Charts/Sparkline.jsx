/**
 * Sparkline — minimal inline trend line, for KPI cards / table cells.
 * @prop {Array}  data    [number, ...] or [{ value: number }, ...]
 * @prop {string} color
 * @prop {number} height
 * @prop {number} width
 * @prop {boolean} fill   render as a filled area instead of a bare line
 */
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import useChartTokens from "./useChartTokens";

export default function Sparkline({ data = [], color, height = 32, width = 96, fill = true }) {
  const { colorAt } = useChartTokens();
  const resolvedColor = color || colorAt(0);
  const points = data.map(d => (typeof d === "number" ? { value: d } : d));

  if (points.length < 2) {
    return <div style={{ width, height }} aria-hidden="true" />;
  }

  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="yd-sparkline-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={resolvedColor} stopOpacity={0.3} />
              <stop offset="100%" stopColor={resolvedColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={resolvedColor}
            strokeWidth={1.5}
            fill={fill ? "url(#yd-sparkline-fill)" : "none"}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
