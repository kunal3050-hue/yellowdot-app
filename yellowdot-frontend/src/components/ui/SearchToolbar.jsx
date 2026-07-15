import { Search, X } from "lucide-react";

/**
 * SearchToolbar — search bar + filter chips + action buttons in one row
 *
 * Usage:
 *   <SearchToolbar
 *     search={q} onSearch={setQ}
 *     filters={[
 *       { key: "status", label: "Status", value: status, options: ["All","Active","Inactive"], onChange: setStatus },
 *       { key: "class",  label: "Class",  value: cls,    options: ["All","LKG","UKG"],       onChange: setCls   },
 *     ]}
 *     actions={<Button variant="primary">+ Add</Button>}
 *     count={42}
 *     total={100}
 *   />
 *
 * @prop {string}   search        controlled search value
 * @prop {function} onSearch      (value: string) => void
 * @prop {string}   placeholder
 * @prop {Array}    filters       [{key, label, value, options, onChange, width?}]
 * @prop {ReactNode} actions      right-side action buttons
 * @prop {number}   count         matching count (shown in subtitle)
 * @prop {number}   total         total count
 * @prop {string}   className
 */

export default function SearchToolbar({
  search = "",
  onSearch,
  placeholder = "Search…",
  filters = [],
  actions,
  count,
  total,
  className = "",
}) {
  return (
    <div
      className={className}
      style={{
        display:     "flex",
        alignItems:  "center",
        gap:         8,
        flexWrap:    "wrap",
        padding:     "10px 16px",
        background:  "var(--yd-surface)",
        borderBottom:"1px solid var(--yd-border-light)",
        flexShrink:  0,
      }}
    >
      {/* Search input */}
      <div style={{ position: "relative", minWidth: 200, flex: "1 1 200px", maxWidth: 320 }}>
        <span style={{
          position:   "absolute",
          left:       9,
          top:        "50%",
          transform:  "translateY(-50%)",
          color:      "var(--yd-text-muted)",
          display:    "flex",
          alignItems: "center",
          pointerEvents: "none",
        }}>
          <SearchIcon />
        </span>
        <input
          type="search"
          value={search}
          onChange={e => onSearch?.(e.target.value)}
          placeholder={placeholder}
          className="yd-input yd-input-has-left"
          style={{ fontSize: 12 }}
          autoComplete="off"
        />
        {search && (
          <button
            className="yd-input-action"
            onClick={() => onSearch?.("")}
            type="button"
            aria-label="Clear"
          >
            <XIcon />
          </button>
        )}
      </div>

      {/* Filter selects */}
      {filters.map(f => (
        <div key={f.key} style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {f.label && (
            <span style={{
              fontSize: 10, fontWeight: 700,
              color: "var(--yd-text-muted)",
              textTransform: "uppercase", letterSpacing: "0.06em",
              whiteSpace: "nowrap",
            }}>
              {f.label}
            </span>
          )}
          <select
            value={f.value}
            onChange={e => f.onChange?.(e.target.value)}
            style={{
              height:       28,
              padding:      "0 24px 0 8px",
              borderRadius: "var(--yd-radius-sm)",
              border:       "1.5px solid var(--yd-border)",
              fontSize:     11,
              fontWeight:   600,
              color:        "var(--yd-text)",
              background:   "var(--yd-surface)",
              fontFamily:   "var(--yd-font)",
              cursor:       "pointer",
              outline:      "none",
              appearance:   "none",
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none' stroke='%239CA3AF' stroke-width='1.5' viewBox='0 0 24 24'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 6px center",
              width: f.width ?? "auto",
              minWidth: 80,
            }}
          >
            {Array.isArray(f.options[0])
              ? f.options.map(([val, label]) => <option key={val} value={val}>{label}</option>)
              : f.options.map(o => <option key={o} value={o}>{o}</option>)
            }
          </select>
        </div>
      ))}

      {/* Count chip */}
      {(count != null || total != null) && (
        <span style={{
          fontSize:   10,
          fontWeight: 700,
          color:      "var(--yd-text-muted)",
          background: "var(--yd-soft)",
          border:     "1px solid var(--yd-border)",
          borderRadius: "var(--yd-radius-full)",
          padding:    "2px 8px",
          whiteSpace: "nowrap",
        }}>
          {count != null && total != null ? `${count} / ${total}` : count ?? total}
        </span>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Actions */}
      {actions && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {actions}
        </div>
      )}
    </div>
  );
}

function SearchIcon() {
  return <Search size={13} strokeWidth={2} />;
}

function XIcon() {
  return <X size={12} strokeWidth={2.5} />;
}
