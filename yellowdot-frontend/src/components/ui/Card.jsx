/**
 * Card — white surface container with warm border + shadow
 *
 * @prop {string|number} padding    inner padding — CSS value or token shorthand (default: "20px 24px")
 * @prop {boolean}       hover      adds lift-on-hover effect
 * @prop {string}        className
 * @prop {function}      onClick    if provided, renders as a button-like card
 * @prop {string}        as         element type (default: "div")
 */
export default function Card({
  children,
  padding = "20px 24px",
  hover = false,
  className = "",
  onClick,
  as: Tag = "div",
  style = {},
  ...rest
}) {
  const cls = [
    "yd-card",
    hover || onClick ? "yd-card-hover" : "",
    onClick ? "yd-card-clickable" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Tag
      className={cls}
      style={{ padding, cursor: onClick ? "pointer" : undefined, ...style }}
      onClick={onClick}
      {...rest}
    >
      {children}
    </Tag>
  );
}
