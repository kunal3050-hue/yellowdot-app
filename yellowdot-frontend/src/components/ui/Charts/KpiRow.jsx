import EmptyState from "../EmptyState";

/**
 * KpiRow — responsive grid wrapper for a row of KpiCards
 *
 * @prop {ReactNode} children     one or more <KpiCard>
 * @prop {number}    maxWidth     optional cap on the row's total width
 * @prop {boolean}   empty        renders an EmptyState instead of the grid
 * @prop {object}    emptyProps   passed through to EmptyState when empty
 * @prop {string}    className
 */
export default function KpiRow({ children, maxWidth, empty = false, emptyProps, className = "" }) {
  if (empty) {
    return (
      <div className={`yd-kpi-row yd-kpi-row--empty ${className}`}>
        <EmptyState size="sm" title="No metrics yet" {...emptyProps} />
      </div>
    );
  }

  return (
    <div className={`yd-kpi-row ${className}`} style={maxWidth ? { maxWidth } : undefined}>
      {children}
    </div>
  );
}
