/**
 * LineChart — themed Recharts line chart
 * @prop {Array}  data      [{ [xKey]: string|number, ...seriesKeys }]
 * @prop {string} xKey
 * @prop {Array}  series    [{ key, label, color? }]
 * @prop {boolean} curved   monotone curve (default: true)
 * @prop {boolean} showLegend
 * @prop {boolean} showGrid
 * @prop {function} valueFormatter
 */
import {
  LineChart as RLineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import useChartTokens from "./useChartTokens";
import ChartContainer from "./ChartContainer";
import ChartTooltip from "./ChartTooltip";

export default function LineChart({
  data = [], xKey, series = [], curved = true, showLegend = true, showGrid = true,
  valueFormatter, title, subtitle, loading, height = 280, onExport, className = "",
}) {
  const { colorAt, grid, axisText } = useChartTokens();
  const isEmpty = !loading && data.length === 0;

  return (
    <ChartContainer title={title} subtitle={subtitle} loading={loading} empty={isEmpty} height={height} onExport={onExport} className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <RLineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          {showGrid && <CartesianGrid stroke={grid} vertical={false} />}
          <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: axisText }} axisLine={{ stroke: grid }} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: axisText }} axisLine={false} tickLine={false} width={40} />
          <Tooltip content={<ChartTooltip formatter={valueFormatter} />} />
          {showLegend && series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {series.map((s, i) => (
            <Line
              key={s.key}
              type={curved ? "monotone" : "linear"}
              dataKey={s.key}
              name={s.label || s.key}
              stroke={s.color || colorAt(i)}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </RLineChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
