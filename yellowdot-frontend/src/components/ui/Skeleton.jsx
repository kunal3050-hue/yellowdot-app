/**
 * Skeleton — shimmer loading placeholder
 *
 * @prop {string|number} width    CSS width (default: "100%")
 * @prop {string|number} height   CSS height (default: 16)
 * @prop {string|number} radius   CSS border-radius (default: inherited from .yd-skeleton)
 * @prop {boolean}       circle   render as a circle
 * @prop {number}        lines    render N stacked text-line skeletons
 * @prop {string}        className
 */
export default function Skeleton({
  width = "100%",
  height = 16,
  radius,
  circle = false,
  lines,
  className = "",
}) {
  if (lines && lines > 1) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={`yd-skeleton ${className}`}
            style={{
              width: i === lines - 1 ? "65%" : "100%",
              height,
              ...(radius ? { borderRadius: radius } : {}),
            }}
          />
        ))}
      </div>
    );
  }

  const dim = circle ? { width: height, height, borderRadius: "50%" } : {};

  return (
    <div
      className={`yd-skeleton ${className}`}
      style={{
        width: circle ? height : width,
        height,
        ...(radius ? { borderRadius: radius } : {}),
        ...dim,
      }}
    />
  );
}

/**
 * SkeletonTable — placeholder for a DataTable while its first page loads.
 * @prop {number} rows
 * @prop {number} columns
 */
export function SkeletonTable({ rows = 6, columns = 5, className = "" }) {
  return (
    <div className={`yd-skeleton-table ${className}`}>
      <div className="yd-skeleton-table-row yd-skeleton-table-row--head">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} height={11} width={i === 0 ? "70%" : "50%"} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="yd-skeleton-table-row">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} height={14} width={c === 0 ? "85%" : "60%"} />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * SkeletonCards — placeholder for a card grid (KPI rows, list-as-cards views).
 * @prop {number} count
 * @prop {number} height
 */
export function SkeletonCards({ count = 3, height = 100, className = "" }) {
  return (
    <div className={`yd-skeleton-cards ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="yd-skeleton-card">
          <Skeleton height={11} width="45%" />
          <Skeleton height={height} radius={8} />
        </div>
      ))}
    </div>
  );
}

/**
 * SkeletonTimeline — placeholder for a Timeline/ActivityFeed while it loads.
 * @prop {number} items
 */
export function SkeletonTimeline({ items = 4, className = "" }) {
  return (
    <div className={`yd-skeleton-timeline ${className}`}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="yd-skeleton-timeline-item">
          <Skeleton circle height={28} />
          <div className="yd-skeleton-timeline-body">
            <Skeleton height={12} width="55%" />
            <Skeleton height={10} width="30%" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * SkeletonForm — placeholder for a form/wizard step while defaults load.
 * @prop {number} fields
 */
export function SkeletonForm({ fields = 4, className = "" }) {
  return (
    <div className={`yd-skeleton-form ${className}`}>
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="yd-skeleton-form-field">
          <Skeleton height={10} width="30%" />
          <Skeleton height={34} radius={8} />
        </div>
      ))}
    </div>
  );
}
