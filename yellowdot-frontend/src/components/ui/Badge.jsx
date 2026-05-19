/**
 * Badge
 *
 * @prop {string}    variant  success | danger | warn | info | neutral | yellow (default: neutral)
 * @prop {boolean}   dot      show a leading colored dot
 * @prop {string}    className
 */
export default function Badge({ variant = "neutral", dot = false, children, className = "" }) {
  const cls = ["badge", `badge-${variant}`, className].filter(Boolean).join(" ");

  const dotColors = {
    success: "var(--yd-success)",
    danger:  "var(--yd-danger)",
    warn:    "var(--yd-warning)",
    info:    "var(--yd-info)",
    neutral: "var(--yd-text-muted)",
    yellow:  "var(--yd-yellow)",
  };

  return (
    <span className={cls}>
      {dot && (
        <span style={{
          width: 5, height: 5, borderRadius: "50%",
          background: dotColors[variant] ?? "var(--yd-text-muted)",
          display: "inline-block",
          flexShrink: 0,
        }} />
      )}
      {children}
    </span>
  );
}
