/**
 * AreaChart — themed Recharts area chart
 * @prop {Array}  data      [{ [xKey]: string|number, ...seriesKeys }]
 * @prop {string} xKey
 * @prop {Array}  series    [{ key, label, color? }]
 * @prop {boolean} stacked
 * @prop {boolean} showLegend
 * @prop {boolean} showGrid
 * @prop {function} valueFormatter
 */
import {
  AreaChart as RAreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import useChartTokens from "./useChartTokens";
import ChartContainer from "./ChartContainer";
import ChartTooltip from "./ChartTooltip";

export default function AreaChart({
  data = [], xKey, series = [], stacked = false, showLegend = true, showGrid = true,
  valueFormatter, title, subtitle, loading, height = 280, onExport, className = "",
}) {
  const { colorAt, grid, axisText } = useChartTokens();
  const isEmpty = !loading && data.length === 0;

  return (
    <ChartContainer title={title} subtitle={subtitle} loading={loading} empty={isEmpty} height={height} onExport={onExport} className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <RAreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <defs>
            {series.map((s, i) => {
              const color = s.color || colorAt(i);
              return (
                <linearGradient key={s.key} id={`yd-area-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              );
            })}
          </defs>
          {showGrid && <CartesianGrid stroke={grid} vertical={false} />}
          <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: axisText }} axisLine={{ stroke: grid }} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: axisText }} axisLine={false} tickLine={false} width={40} />
          <Tooltip content={<ChartTooltip formatter={valueFormatter} />} />
          {showLegend && series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {series.map((s, i) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label || s.key}
              stackId={stacked ? "stack" : undefined}
              stroke={s.color || colorAt(i)}
              strokeWidth={2}
              fill={`url(#yd-area-${s.key})`}
            />
          ))}
        </RAreaChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
