import { forwardRef } from "react";

/**
 * Select — native dropdown styled with the design system
 *
 * @prop {string}   label
 * @prop {string}   error
 * @prop {string}   hint
 * @prop {string}   placeholder  empty first option
 * @prop {Array}    options       [{value, label, disabled?}] or plain string[]
 * @prop {string}   className
 * All native <select> props are forwarded.
 */
const Select = forwardRef(function Select(
  {
    label,
    error,
    hint,
    placeholder,
    options = [],
    className = "",
    id,
    ...rest
  },
  ref
) {
  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  const cls = [
    "yd-input",
    error ? "error" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="yd-field">
      {label && (
        <label className="yd-label" htmlFor={selectId}>
          {label}
        </label>
      )}

      <div className="yd-input-wrap">
        <select
          ref={ref}
          id={selectId}
          className={cls}
          aria-invalid={!!error}
          style={{
            appearance: "none",
            WebkitAppearance: "none",
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 10px center",
            paddingRight: 32,
            cursor: "pointer",
          }}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map(opt => {
            const v = typeof opt === "string" ? opt : opt.value;
            const l = typeof opt === "string" ? opt : opt.label;
            const d = typeof opt === "object" ? opt.disabled : false;
            return (
              <option key={v} value={v} disabled={d}>
                {l}
              </option>
            );
          })}
        </select>
      </div>

      {error && <span className="yd-error-text">{error}</span>}
      {hint && !error && <span className="yd-hint-text">{hint}</span>}
    </div>
  );
});

export default Select;
