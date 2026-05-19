/**
 * SectionHeader — smaller in-page section title with optional actions
 *
 * @prop {string}    title
 * @prop {string}    description
 * @prop {ReactNode} actions     right-side slot
 * @prop {boolean}   divider     adds a bottom border
 * @prop {string}    className
 */
export default function SectionHeader({
  title,
  description,
  actions,
  divider = false,
  className = "",
}) {
  const cls = [
    "yd-sh",
    divider ? "yd-sh-divider" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cls}>
      <div>
        <div className="yd-sh-title">{title}</div>
        {description && <div className="yd-sh-desc">{description}</div>}
      </div>

      {actions && (
        <div className="yd-sh-actions">{actions}</div>
      )}
    </div>
  );
}
