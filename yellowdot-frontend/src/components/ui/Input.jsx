import { forwardRef } from "react";

/**
 * Input — text field with label, icon, error and hint support
 *
 * @prop {string}    label
 * @prop {string}    error       error message (adds red border + error text)
 * @prop {string}    hint        hint text below the input
 * @prop {ReactNode} leftIcon    icon inside the left edge
 * @prop {ReactNode} rightIcon   decorative icon inside the right edge
 * @prop {ReactNode} rightAction interactive element (button) on the right
 * @prop {string}    size        "sm" | "md" | "lg"
 * @prop {string}    className
 * All native <input> props are forwarded.
 */
const Input = forwardRef(function Input(
  {
    label,
    error,
    hint,
    leftIcon,
    rightIcon,
    rightAction,
    size,
    className = "",
    id,
    ...rest
  },
  ref
) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  const inputCls = [
    "yd-input",
    size === "lg" ? "yd-input-lg" : "",
    leftIcon ? "yd-input-has-left" : "",
    rightIcon || rightAction ? "yd-input-has-right" : "",
    error ? "error" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="yd-field">
      {label && (
        <label className="yd-label" htmlFor={inputId}>
          {label}
        </label>
      )}

      <div className="yd-input-wrap">
        {leftIcon && (
          <span className="yd-input-icon yd-input-icon-left">
            {leftIcon}
          </span>
        )}

        <input
          ref={ref}
          id={inputId}
          className={inputCls}
          aria-invalid={!!error}
          aria-describedby={
            error   ? `${inputId}-error` :
            hint    ? `${inputId}-hint`  : undefined
          }
          {...rest}
        />

        {rightAction && (
          <span className="yd-input-action">{rightAction}</span>
        )}
        {rightIcon && !rightAction && (
          <span className="yd-input-icon yd-input-icon-right">{rightIcon}</span>
        )}
      </div>

      {error && (
        <span id={`${inputId}-error`} className="yd-error-text">
          {error}
        </span>
      )}
      {hint && !error && (
        <span id={`${inputId}-hint`} className="yd-hint-text">
          {hint}
        </span>
      )}
    </div>
  );
});

export default Input;
