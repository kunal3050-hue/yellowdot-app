/**
 * PieChart — themed Recharts pie/donut chart
 * @prop {Array}   data          [{ name, value, color? }]
 * @prop {boolean} donut         renders as a donut (innerRadius) — pass `centerLabel` for the middle
 * @prop {ReactNode|string} centerLabel  shown in the donut hole (donut only)
 * @prop {boolean} showLegend
 * @prop {function} valueFormatter
 */
import { PieChart as RPieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import useChartTokens from "./useChartTokens";
import ChartContainer from "./ChartContainer";
import ChartTooltip from "./ChartTooltip";

export default function PieChart({
  data = [], donut = false, centerLabel, showLegend = true, valueFormatter,
  title, subtitle, loading, height = 280, onExport, className = "",
}) {
  const { colorAt } = useChartTokens();
  const isEmpty = !loading && data.length === 0;

  return (
    <ChartContainer title={title} subtitle={subtitle} loading={loading} empty={isEmpty} height={height} onExport={onExport} className={className}>
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <RPieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={donut ? "62%" : 0}
              outerRadius="85%"
              paddingAngle={data.length > 1 ? 2 : 0}
              stroke="none"
              isAnimationActive={false}
            >
              {data.map((d, i) => <Cell key={i} fill={d.color || colorAt(i)} />)}
            </Pie>
            <Tooltip content={<ChartTooltip formatter={valueFormatter} />} />
            {showLegend && <Legend wrapperStyle={{ fontSize: 12 }} />}
          </RPieChart>
        </ResponsiveContainer>
        {donut && centerLabel && (
          <div className="yd-chart-donut-center">{centerLabel}</div>
        )}
      </div>
    </ChartContainer>
  );
}
