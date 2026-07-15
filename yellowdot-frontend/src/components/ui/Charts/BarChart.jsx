/**
 * BarChart — themed Recharts bar chart, supports stacking + horizontal layout
 * @prop {Array}   data
 * @prop {string}  xKey
 * @prop {Array}   series      [{ key, label, color? }]
 * @prop {boolean} stacked
 * @prop {boolean} horizontal
 * @prop {function} valueFormatter
 */
import {
  BarChart as RBarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import useChartTokens from "./useChartTokens";
import ChartContainer from "./ChartContainer";
import ChartTooltip from "./ChartTooltip";

export default function BarChart({
  data = [], xKey, series = [], stacked = false, horizontal = false,
  showLegend = true, showGrid = true, valueFormatter,
  title, subtitle, loading, height = 280, onExport, className = "",
}) {
  const { colorAt, grid, axisText } = useChartTokens();
  const isEmpty = !loading && data.length === 0;

  return (
    <ChartContainer title={title} subtitle={subtitle} loading={loading} empty={isEmpty} height={height} onExport={onExport} className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <RBarChart
          data={data}
          layout={horizontal ? "vertical" : "horizontal"}
          margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
        >
          {showGrid && <CartesianGrid stroke={grid} vertical={horizontal} horizontal={!horizontal} />}
          {horizontal ? (
            <>
              <XAxis type="number" tick={{ fontSize: 11, fill: axisText }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey={xKey} tick={{ fontSize: 11, fill: axisText }} axisLine={{ stroke: grid }} tickLine={false} width={90} />
            </>
          ) : (
            <>
              <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: axisText }} axisLine={{ stroke: grid }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: axisText }} axisLine={false} tickLine={false} width={40} />
            </>
          )}
          <Tooltip content={<ChartTooltip formatter={valueFormatter} />} cursor={{ fill: "var(--yd-soft)" }} />
          {showLegend && series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label || s.key}
              stackId={stacked ? "stack" : undefined}
              fill={s.color || colorAt(i)}
              radius={stacked ? [0, 0, 0, 0] : [4, 4, 0, 0]}
              maxBarSize={40}
            />
          ))}
        </RBarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
