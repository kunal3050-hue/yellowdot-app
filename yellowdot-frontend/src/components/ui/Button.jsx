import { forwardRef } from "react";

const VARIANT = {
  primary:   "btn-primary",
  secondary: "btn-dark",
  outline:   "btn-ghost",
  danger:    "btn-danger",
  ghost:     "btn-soft",
  success:   "btn-success",
};

const SIZE = {
  xs: "btn-xs",
  sm: "btn-sm",
  md: "btn-md",
  lg: "btn-lg",
  xl: "btn-xl",
};

/**
 * Button
 *
 * @prop {string}    variant   primary | secondary | outline | danger | ghost | success
 * @prop {string}    size      xs | sm | md | lg | xl
 * @prop {boolean}   loading   shows a spinner and disables
 * @prop {boolean}   block     full-width
 * @prop {ReactNode} leftIcon
 * @prop {ReactNode} rightIcon
 * @prop {boolean}   icon      icon-only (square) mode
 * @prop {string}    as        element type: "button" | "a" (default: "button")
 */
const Button = forwardRef(function Button(
  {
    variant = "outline",
    size,
    loading = false,
    block = false,
    icon = false,
    leftIcon,
    rightIcon,
    children,
    className = "",
    disabled,
    as: Tag = "button",
    ...rest
  },
  ref
) {
  const classes = [
    "btn",
    VARIANT[variant] ?? "btn-ghost",
    size ? SIZE[size] : "",
    block ? "btn-block" : "",
    icon ? "btn-icon" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Tag
      ref={ref}
      className={classes}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <Spinner variant={variant} />
      ) : (
        <>
          {leftIcon && <span style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>{leftIcon}</span>}
          {children}
          {rightIcon && <span style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>{rightIcon}</span>}
        </>
      )}
    </Tag>
  );
});

function Spinner({ variant }) {
  /* On yellow (primary) bg use dark dots, elsewhere use yellow dots */
  const dark = variant === "primary";
  return (
    <span className={`yd-dots ${dark ? "yd-dots-dark" : ""}`}>
      <span /><span /><span />
    </span>
  );
}

export default Button;
