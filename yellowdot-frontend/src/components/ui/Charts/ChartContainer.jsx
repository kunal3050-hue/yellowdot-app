/**
 * ChartContainer — shared chrome for every chart type: title/subtitle,
 * loading skeleton, empty state, and an optional export action.
 * export-ready architecture: `onExport` is called with no args; callers
 * decide the concrete export mechanism (CSV/PNG/etc.) — kept decoupled so
 * a future PDF/PNG exporter can be wired in without touching chart internals.
 */
import { Download } from "lucide-react";
import EmptyState from "../EmptyState";
import Skeleton from "../Skeleton";
import Button from "../Button";

export default function ChartContainer({
  title,
  subtitle,
  loading = false,
  empty = false,
  emptyProps,
  height = 280,
  onExport,
  className = "",
  children,
}) {
  const showHeader = title || subtitle || onExport;

  return (
    <div className={`yd-chart-root ${className}`}>
      {showHeader && (
        <div className="yd-chart-header">
          <div>
            {title && <div className="yd-chart-title">{title}</div>}
            {subtitle && <div className="yd-chart-subtitle">{subtitle}</div>}
          </div>
          {onExport && (
            <Button size="xs" variant="outline" leftIcon={<Download size={12} strokeWidth={2} />} onClick={onExport}>
              Export
            </Button>
          )}
        </div>
      )}

      {loading ? (
        <Skeleton height={height} radius="var(--yd-radius-sm)" />
      ) : empty ? (
        <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <EmptyState size="sm" title={emptyProps?.title || "No data yet"} description={emptyProps?.description || "Data will appear here once available."} />
        </div>
      ) : (
        <div style={{ height, width: "100%" }}>{children}</div>
      )}
    </div>
  );
}
