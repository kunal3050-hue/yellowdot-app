import { ArrowLeft } from "lucide-react";

/**
 * PageHeader — top of a page: title, subtitle, back link, actions
 *
 * @prop {string}    title
 * @prop {string}    subtitle
 * @prop {ReactNode} actions     right-side slot (buttons, etc.)
 * @prop {string}    backLabel   if set, renders a ← back button
 * @prop {function}  onBack      called when back button is clicked
 * @prop {string}    tag         optional badge/tag next to the title
 * @prop {string}    className
 */
export default function PageHeader({
  title,
  subtitle,
  actions,
  backLabel,
  onBack,
  tag,
  className = "",
}) {
  return (
    <div className={`yd-ph ${className}`}>
      <div className="yd-ph-left">
        {(backLabel || onBack) && (
          <button className="yd-ph-back" onClick={onBack} type="button">
            <ArrowLeftIcon />
            {backLabel || "Back"}
          </button>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: "var(--yd-space-2)" }}>
          <h1 className="yd-ph-title">{title}</h1>
          {tag && (
            <span style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "3px 10px",
              borderRadius: "var(--yd-radius-full)",
              background: "var(--yd-yellow-light)",
              border: "1px solid var(--yd-yellow)",
              fontSize: "var(--yd-font-size-xs)",
              fontWeight: "var(--yd-weight-bold)",
              color: "var(--yd-charcoal)",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
            }}>
              {tag}
            </span>
          )}
        </div>

        {subtitle && <p className="yd-ph-sub">{subtitle}</p>}
      </div>

      {actions && (
        <div className="yd-ph-actions">{actions}</div>
      )}
    </div>
  );
}

function ArrowLeftIcon() {
  return <ArrowLeft size={13} strokeWidth={2.5} />;
}
