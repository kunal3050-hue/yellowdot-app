/**
 * ChartTooltip — themed Recharts tooltip content (replaces the default
 * unstyled white box). Shared by Line/Area/Bar/Pie.
 */
export default function ChartTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="yd-chart-tooltip">
      {label !== undefined && <div className="yd-chart-tooltip-label">{label}</div>}
      {payload.map((entry, i) => (
        <div key={i} className="yd-chart-tooltip-row">
          <span className="yd-chart-tooltip-dot" style={{ background: entry.color || entry.fill }} />
          <span className="yd-chart-tooltip-name">{entry.name}</span>
          <span className="yd-chart-tooltip-value">
            {formatter ? formatter(entry.value, entry.name) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}
