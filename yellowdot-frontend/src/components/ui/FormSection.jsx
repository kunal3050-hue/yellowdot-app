/**
 * FormSection — card-wrapped form section with title, description, icon
 *
 * Usage:
 *   <FormSection title="Student Info" description="Basic details" icon="👦">
 *     <div className="yd-form-grid">
 *       <Field label="Name">…</Field>
 *     </div>
 *   </FormSection>
 *
 * @prop {string}    title
 * @prop {string}    description
 * @prop {string}    icon        emoji or ReactNode
 * @prop {boolean}   optional    adds "Optional" chip
 * @prop {boolean}   collapsible allows section collapse (default: false)
 * @prop {boolean}   defaultOpen start collapsed? (default: true = open)
 * @prop {string}    className
 * @prop {object}    style
 */

import { useState } from "react";
import { ChevronDown } from "lucide-react";

export default function FormSection({
  title,
  description,
  icon,
  optional = false,
  collapsible = false,
  defaultOpen = true,
  className = "",
  style = {},
  children,
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className={`yd-card ${className}`}
      style={{ overflow: "hidden", marginBottom: 16, ...style }}
    >
      {/* Header */}
      <div
        style={{
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          padding:        "14px 20px",
          borderBottom:   open ? "1px solid var(--yd-border-light)" : "none",
          cursor:         collapsible ? "pointer" : "default",
          userSelect:     "none",
        }}
        onClick={collapsible ? () => setOpen(o => !o) : undefined}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Yellow accent bar */}
          <div style={{
            width: 3, height: 20, borderRadius: 2,
            background: "var(--yd-yellow)", flexShrink: 0,
          }} />

          {icon && (
            <span style={{
              width: 32, height: 32, borderRadius: "var(--yd-radius-sm)",
              background: "var(--yd-yellow-light)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, flexShrink: 0,
            }}>
              {icon}
            </span>
          )}

          <div>
            <div style={{
              fontSize:   "var(--yd-font-size-sm)",
              fontWeight: "var(--yd-weight-bold)",
              color:      "var(--yd-charcoal)",
              display:    "flex",
              alignItems: "center",
              gap:        8,
            }}>
              {title}
              {optional && (
                <span style={{
                  fontSize: 9, fontWeight: 700, color: "var(--yd-text-muted)",
                  textTransform: "uppercase", letterSpacing: "0.08em",
                  background: "var(--yd-soft)", border: "1px solid var(--yd-border)",
                  padding: "1px 6px", borderRadius: 4,
                }}>
                  Optional
                </span>
              )}
            </div>
            {description && (
              <div style={{
                fontSize: "var(--yd-font-size-xs)",
                color: "var(--yd-text-muted)",
                marginTop: 1,
              }}>
                {description}
              </div>
            )}
          </div>
        </div>

        {collapsible && (
          <ChevronIcon open={open} />
        )}
      </div>

      {/* Body */}
      {(!collapsible || open) && (
        <div style={{ padding: "20px" }}>
          {children}
        </div>
      )}
    </div>
  );
}

function ChevronIcon({ open }) {
  return (
    <ChevronDown
      size={16}
      strokeWidth={2}
      style={{
        color: "var(--yd-text-muted)",
        transform: open ? "rotate(180deg)" : "rotate(0deg)",
        transition: "transform 0.18s ease",
        flexShrink: 0,
      }}
    />
  );
}

/* ── Helper: Form Field ─────────────────────────────────────────── */
/**
 * Field — label + input + error + hint
 *
 * @prop {string} label
 * @prop {string} error
 * @prop {string} hint
 * @prop {boolean} required
 */
export function Field({ label, error, hint, required, children }) {
  return (
    <div className="yd-field">
      {label && (
        <label className="yd-label">
          {label}
          {required && (
            <span style={{ color: "var(--yd-danger)", marginLeft: 3 }}>*</span>
          )}
        </label>
      )}
      {children}
      {error && <span className="yd-error-text">{error}</span>}
      {hint && !error && <span className="yd-hint-text">{hint}</span>}
    </div>
  );
}

/* ── Helper: Form Grid ──────────────────────────────────────────── */
/**
 * FormGrid — responsive 2-column grid layout for form fields
 */
export function FormGrid({ cols = 2, children, style = {} }) {
  return (
    <div
      style={{
        display:             "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap:                 "12px 16px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
