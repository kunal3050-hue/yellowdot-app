/**
 * ActionBar — sticky top action bar for full-page flows
 *
 * Used for: NewAdmission, InvoiceView, Settings, EditStudent, etc.
 * Replaces the inconsistent ad-hoc sticky headers across pages.
 *
 * @prop {function}  onBack        show ← Back button
 * @prop {string}    backLabel     (default: "Back")
 * @prop {string}    title         center title
 * @prop {string}    subtitle      small subtitle beneath title
 * @prop {ReactNode} left          left slot (after back button)
 * @prop {ReactNode} right         right slot (buttons, status badge, etc.)
 * @prop {boolean}   border        show bottom border (default: true)
 * @prop {boolean}   shadow        show shadow (default: true)
 * @prop {string}    variant       "light" | "dark" (default: "light")
 * @prop {string}    className
 */

export default function ActionBar({
  onBack,
  backLabel = "Back",
  title,
  subtitle,
  left,
  right,
  border   = true,
  shadow   = true,
  variant  = "light",
  className = "",
  style = {},
}) {
  const dark = variant === "dark";

  return (
    <div
      className={className}
      style={{
        position:        "sticky",
        top:             0,
        zIndex:          "var(--yd-z-sticky)",
        display:         "flex",
        alignItems:      "center",
        gap:             12,
        padding:         "0 20px",
        height:          52,
        flexShrink:      0,
        background:      dark ? "var(--yd-navy)" : "var(--yd-surface)",
        borderBottom:    border ? `1px solid ${dark ? "rgba(255,255,255,0.08)" : "var(--yd-border-light)"}` : "none",
        boxShadow:       shadow ? (dark ? "0 4px 20px rgba(0,0,0,0.20)" : "0 1px 3px rgba(244,196,0,0.06)") : "none",
        ...style,
      }}
    >
      {/* Back button */}
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          style={{
            display:     "inline-flex",
            alignItems:  "center",
            gap:         5,
            padding:     "5px 10px",
            borderRadius:"var(--yd-radius-sm)",
            fontSize:    12,
            fontWeight:  700,
            fontFamily:  "var(--yd-font)",
            cursor:      "pointer",
            border:      `1px solid ${dark ? "rgba(255,255,255,0.12)" : "var(--yd-border)"}`,
            background:  dark ? "rgba(255,255,255,0.08)" : "transparent",
            color:       dark ? "rgba(255,255,255,0.75)" : "var(--yd-text-soft)",
            transition:  "all 0.12s ease",
            flexShrink:  0,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = dark ? "rgba(255,255,255,0.14)" : "var(--yd-soft)";
            e.currentTarget.style.color = dark ? "white" : "var(--yd-charcoal)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = dark ? "rgba(255,255,255,0.08)" : "transparent";
            e.currentTarget.style.color = dark ? "rgba(255,255,255,0.75)" : "var(--yd-text-soft)";
          }}
        >
          <ArrowLeft size={12} />
          {backLabel}
        </button>
      )}

      {/* Left slot */}
      {left && <div style={{ flexShrink: 0 }}>{left}</div>}

      {/* Center: title */}
      {(title || subtitle) && (
        <div style={{ flex: 1, minWidth: 0 }}>
          {title && (
            <div style={{
              fontSize:   13,
              fontWeight: 800,
              color:      dark ? "white" : "var(--yd-charcoal)",
              lineHeight: 1.2,
              overflow:   "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {title}
            </div>
          )}
          {subtitle && (
            <div style={{
              fontSize: 11,
              color:    dark ? "rgba(255,255,255,0.45)" : "var(--yd-text-muted)",
              marginTop: 1,
              overflow:  "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {subtitle}
            </div>
          )}
        </div>
      )}

      {/* Right slot */}
      {right && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {right}
        </div>
      )}
    </div>
  );
}

function ArrowLeft({ size = 14 }) {
  return (
    <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  );
}
