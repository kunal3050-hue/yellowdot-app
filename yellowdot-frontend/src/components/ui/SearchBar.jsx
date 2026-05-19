/**
 * SearchBar — search input with icon and optional clear button
 *
 * @prop {string}   value
 * @prop {function} onChange    (e) => void
 * @prop {function} onClear     () => void  — shows ✕ when value is set
 * @prop {string}   placeholder (default: "Search…")
 * @prop {string}   size        "sm" | "md" | "lg"
 * @prop {string}   className
 */
export default function SearchBar({
  value = "",
  onChange,
  onClear,
  placeholder = "Search…",
  size,
  className = "",
}) {
  const inputCls = [
    "yd-input",
    size === "lg" ? "yd-input-lg" : "",
    "yd-input-has-left",
    value && onClear ? "yd-input-has-right" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="yd-input-wrap" style={{ maxWidth: "100%" }}>
      <span className="yd-input-icon yd-input-icon-left">
        <SearchIcon />
      </span>

      <input
        type="search"
        className={inputCls}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete="off"
        style={{ WebkitAppearance: "none" }}
      />

      {value && onClear && (
        <button
          type="button"
          className="yd-input-action"
          onClick={onClear}
          aria-label="Clear search"
        >
          <XIcon />
        </button>
      )}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
