import Button from "./Button";

/**
 * EmptyState — zero-data placeholder with CTA
 *
 * @prop {string|ReactNode} icon
 * @prop {string}           title
 * @prop {string}           description
 * @prop {object}           action          { label, onClick, variant?, icon? }
 * @prop {object}           secondaryAction { label, onClick }
 * @prop {string}           className
 */
export default function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className = "",
}) {
  return (
    <div className={`yd-empty ${className}`}>
      {icon && (
        <div className="yd-empty-icon">{icon}</div>
      )}

      {title && (
        <div className="yd-empty-title">{title}</div>
      )}

      {description && (
        <div className="yd-empty-sub" style={{ maxWidth: 340 }}>{description}</div>
      )}

      {(action || secondaryAction) && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--yd-space-2)",
          marginTop: "var(--yd-space-4)",
          flexWrap: "wrap",
          justifyContent: "center",
        }}>
          {action && (
            <Button
              variant={action.variant ?? "primary"}
              size="sm"
              onClick={action.onClick}
              leftIcon={action.icon}
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              variant="outline"
              size="sm"
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
