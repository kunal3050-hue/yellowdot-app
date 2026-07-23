/**
 * EmptyState — zero-data placeholder with optional CTA
 *
 * @prop {string|ReactNode} icon
 * @prop {string}           title
 * @prop {string}           description
 * @prop {object}           action           { label, onClick, variant?, leftIcon? }
 * @prop {object}           secondaryAction  { label, onClick }
 * @prop {string}           variant          "default" | "filtered" | "error" | "first-time" | "disabled"
 * @prop {string}           size             "sm" | "md" | "lg" (default: "md")
 * @prop {string}           className
 */
import Button from "./Button";

const DEFAULTS = {
  default:    { icon: "📋", title: "No records found",       description: "Nothing here yet." },
  filtered:   { icon: "🔍", title: "No results",             description: "Try adjusting your search or filters." },
  error:      { icon: "⚠️", title: "Something went wrong",   description: "Please try again or contact support." },
  "first-time":{ icon: "🚀", title: "Get started",           description: "Add your first record to begin." },
  disabled:   { icon: "🔌", title: "Not enabled",             description: "This feature isn't turned on yet." },
};

const SIZE_STYLES = {
  sm: { padding: "24px 16px", iconSize: 28, titleSize: 13, descSize: 11, gap: 6 },
  md: { padding: "48px 24px", iconSize: 36, titleSize: 14, descSize: 12, gap: 8 },
  lg: { padding: "64px 32px", iconSize: 48, titleSize: 16, descSize: 13, gap: 10 },
};

export default function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  variant   = "default",
  size      = "md",
  className = "",
}) {
  const d = DEFAULTS[variant] ?? DEFAULTS.default;
  const s = SIZE_STYLES[size] ?? SIZE_STYLES.md;

  return (
    <div
      className={`yd-empty ${className}`}
      style={{ padding: s.padding, gap: s.gap }}
    >
      {/* Icon */}
      <div style={{
        fontSize:    s.iconSize,
        lineHeight:  1,
        opacity:     0.75,
        marginBottom:4,
        filter:      "drop-shadow(0 2px 4px rgba(0,0,0,0.08))",
      }}>
        {icon ?? d.icon}
      </div>

      {/* Title */}
      <div style={{
        fontSize:   s.titleSize,
        fontWeight: 700,
        color:      "var(--yd-text-soft)",
        lineHeight: 1.3,
      }}>
        {title ?? d.title}
      </div>

      {/* Description */}
      {(description ?? d.description) && (
        <div style={{
          fontSize:  s.descSize,
          color:     "var(--yd-text-muted)",
          maxWidth:  340,
          lineHeight:1.55,
          textAlign: "center",
        }}>
          {description ?? d.description}
        </div>
      )}

      {/* Actions */}
      {(action || secondaryAction) && (
        <div style={{
          display:        "flex",
          alignItems:     "center",
          gap:            8,
          marginTop:      4,
          flexWrap:       "wrap",
          justifyContent: "center",
        }}>
          {action && (
            <Button
              variant={action.variant ?? "primary"}
              size="sm"
              onClick={action.onClick}
              leftIcon={action.leftIcon ?? action.icon}
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="outline" size="sm" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
