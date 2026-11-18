import { Children } from "react";
import EmptyState from "../EmptyState";

// Mirrors .yd-kpi-row in charts.css: repeat(auto-fit, minmax(180px, 1fr))
// with a 12px gap. Kept here so the guard below cannot drift from the CSS
// without someone noticing both.
const MIN_CARD_PX = 180;
const GAP_PX = 12;

/**
 * The narrowest this row can be without the cards wrapping.
 *
 * A maxWidth below this silently pushes the last card onto a row of its own
 * and doubles the height of the block. That is not hypothetical: three pages
 * shipped with a cap a few pixels short — StaffDirectory at 560 against the
 * 564 three cards need, StudentList the same, PayrollRun at 640 against 756
 * for four. Each looked like a deliberate two-row layout.
 *
 * So maxWidth is treated as "do not grow beyond this", never as permission to
 * wrap. A caller that genuinely wants wrapping omits maxWidth and lets
 * auto-fit do it on the real container width.
 */
function widthFor(count, maxWidth) {
  if (!maxWidth || count < 1) return maxWidth;
  const needed = count * MIN_CARD_PX + (count - 1) * GAP_PX;
  return Math.max(maxWidth, needed);
}

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

  const width = widthFor(Children.count(children), maxWidth);

  return (
    <div className={`yd-kpi-row ${className}`} style={width ? { maxWidth: width } : undefined}>
      {children}
    </div>
  );
}
