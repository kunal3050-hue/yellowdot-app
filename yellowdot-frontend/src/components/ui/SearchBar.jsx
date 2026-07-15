import { Search, X } from "lucide-react";

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
  return <Search size={14} strokeWidth={2} />;
}

function XIcon() {
  return <X size={13} strokeWidth={2.5} />;
}
