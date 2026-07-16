import { ArrowLeft, ChevronRight, Download, RotateCw, HelpCircle } from "lucide-react";
import Button from "./Button";

/**
 * PageHeader — top of a page: breadcrumbs, title, subtitle, actions
 *
 * Two ways to supply actions:
 *  1. Pass `actions` directly (full manual control) — existing usage.
 *  2. Pass `primaryAction` / `secondaryActions` / `onExport` / `onRefresh` /
 *     `onHelp` and let PageHeader assemble a standard-order action row.
 * `actions` always wins if provided, so existing callers are unaffected.
 *
 * @prop {string}    title
 * @prop {string}    subtitle
 * @prop {Array}     breadcrumbs      [{label, href?, onClick?}] — last item renders as current page (non-link)
 * @prop {ReactNode} actions          right-side slot (buttons, etc.) — overrides the assembled action row
 * @prop {object}    primaryAction    {label, icon, onClick, disabled}
 * @prop {Array}     secondaryActions [{key, label, icon, onClick, variant}]
 * @prop {function}  onExport
 * @prop {function}  onRefresh
 * @prop {function}  onHelp
 * @prop {string}    shortcutHint     e.g. "⌘K to search" — small muted hint next to the title
 * @prop {string}    backLabel        if set, renders a ← back button
 * @prop {function}  onBack           called when back button is clicked
 * @prop {string}    tag              optional badge/tag next to the title
 * @prop {string}    className
 */
export default function PageHeader({
  title,
  subtitle,
  actions,
  breadcrumbs,
  primaryAction,
  secondaryActions,
  onExport,
  onRefresh,
  onHelp,
  shortcutHint,
  backLabel,
  onBack,
  tag,
  className = "",
}) {
  const assembledActions = !actions && (primaryAction || secondaryActions?.length || onExport || onRefresh || onHelp)
    ? (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {onHelp && (
          <button type="button" onClick={onHelp} aria-label="Help" className="yd-close-btn" style={{ width: 30, height: 30 }}>
            <HelpCircle size={14} strokeWidth={2} />
          </button>
        )}
        {onRefresh && (
          <button type="button" onClick={onRefresh} aria-label="Refresh" className="yd-close-btn" style={{ width: 30, height: 30 }}>
            <RotateCw size={14} strokeWidth={2} />
          </button>
        )}
        {onExport && (
          <Button variant="outline" size="sm" leftIcon={<Download size={13} strokeWidth={2} />} onClick={onExport}>
            Export
          </Button>
        )}
        {secondaryActions?.map(a => (
          <Button key={a.key || a.label} variant={a.variant || "outline"} size="sm" leftIcon={a.icon} onClick={a.onClick} disabled={a.disabled}>
            {a.label}
          </Button>
        ))}
        {primaryAction && (
          <Button variant="primary" size="sm" leftIcon={primaryAction.icon} onClick={primaryAction.onClick} disabled={primaryAction.disabled}>
            {primaryAction.label}
          </Button>
        )}
      </div>
    )
    : actions;

  return (
    <div className={`yd-ph ${className}`}>
      <div className="yd-ph-left">
        {breadcrumbs?.length > 0 && (
          <nav aria-label="Breadcrumb" style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4, flexWrap: "wrap" }}>
            {breadcrumbs.map((b, i) => {
              const isLast = i === breadcrumbs.length - 1;
              return (
                <span key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  {i > 0 && <ChevronRight size={11} strokeWidth={2.5} style={{ color: "var(--yd-text-muted)" }} />}
                  {isLast || (!b.href && !b.onClick) ? (
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: isLast ? "var(--yd-text-soft)" : "var(--yd-text-muted)" }}>
                      {b.label}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={b.onClick}
                      style={{ fontSize: 11.5, fontWeight: 600, color: "var(--yd-text-muted)", background: "none", border: "none", padding: 0, cursor: "pointer" }}
                    >
                      {b.label}
                    </button>
                  )}
                </span>
              );
            })}
          </nav>
        )}

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
          {shortcutHint && (
            <span style={{
              fontSize: 10.5, fontWeight: 600, color: "var(--yd-text-muted)",
              background: "var(--yd-soft)", border: "1px solid var(--yd-border)",
              borderRadius: "var(--yd-radius-sm)", padding: "2px 7px", whiteSpace: "nowrap",
            }}>
              {shortcutHint}
            </span>
          )}
        </div>

        {subtitle && <p className="yd-ph-sub">{subtitle}</p>}
      </div>

      {assembledActions && (
        <div className="yd-ph-actions">{assembledActions}</div>
      )}
    </div>
  );
}

function ArrowLeftIcon() {
  return <ArrowLeft size={13} strokeWidth={2.5} />;
}
