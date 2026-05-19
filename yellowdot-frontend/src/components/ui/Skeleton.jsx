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
