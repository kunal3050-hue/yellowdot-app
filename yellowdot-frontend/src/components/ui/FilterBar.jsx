import { useState, useEffect, useCallback } from "react";
import { X, Bookmark, BookmarkPlus } from "lucide-react";
import SearchBar from "./SearchBar";

/**
 * FilterBar — the Standard Filter Bar (search + filters + saved views + actions)
 * ─────────────────────────────────────────────────────────────────────────
 * For pages built on <DataTable>, its built-in DataTableToolbar already IS
 * this component (search, per-column filters, chips, date range, saved
 * searches, active count, clear-all) — don't stack this on top of a
 * DataTable. Use FilterBar for standalone list/card/timeline views that
 * don't use DataTable.
 *
 * Usage:
 *   <FilterBar
 *     search={q} onSearch={setQ}
 *     filters={[
 *       { key: "status", label: "Status", type: "select", value: status, options: ["Active","Inactive"], onChange: setStatus },
 *       { key: "tags",   label: "Tags",   type: "chips",  value: tags,   options: ["VIP","New"],          onChange: setTags   },
 *       { key: "range",  label: "Date",   type: "dateRange", value: range, onChange: setRange },
 *       { key: "actor",  label: "User",   type: "text",   value: actor,  onChange: setActor, placeholder: "User ID…" },
 *     ]}
 *     savedViewsKey="yd_students_views"
 *     actions={<Button variant="primary">+ Add</Button>}
 *   />
 *
 * @prop {string}   search
 * @prop {function} onSearch          (value: string) => void
 * @prop {string}   placeholder
 * @prop {Array}    filters           [{key, label, type: "select"|"chips"|"dateRange"|"text", value, options, onChange, width?, placeholder?}]
 * @prop {string}   savedViewsKey     localStorage key; enables the Saved Views popover when provided
 * @prop {ReactNode} actions          right-side action buttons (e.g. an ActionBar)
 * @prop {string}   className
 */
export default function FilterBar({
  search = "",
  onSearch,
  placeholder = "Search…",
  filters = [],
  savedViewsKey,
  actions,
  className = "",
}) {
  const [showSaved, setShowSaved] = useState(false);
  const [saveNameDraft, setSaveNameDraft] = useState("");
  const { views, save: saveView, remove: removeView } = useSavedViews(savedViewsKey);

  const activeCount =
    (search ? 1 : 0) +
    filters.filter(f => isFilterActive(f)).length;

  function clearAll() {
    onSearch?.("");
    filters.forEach(f => f.onChange?.(f.type === "chips" ? [] : undefined));
  }

  function applyView(view) {
    if (view.snapshot.search !== undefined) onSearch?.(view.snapshot.search);
    filters.forEach(f => {
      if (view.snapshot.filters?.[f.key] !== undefined) f.onChange?.(view.snapshot.filters[f.key]);
    });
    setShowSaved(false);
  }

  function handleSaveView() {
    const name = saveNameDraft.trim();
    if (!name) return;
    const snapshot = { search, filters: Object.fromEntries(filters.map(f => [f.key, f.value])) };
    saveView(name, snapshot);
    setSaveNameDraft("");
  }

  return (
    <div className={`yd-filterbar ${className}`}>
      <div className="yd-filterbar-row">
        <div style={{ minWidth: 200, flex: "1 1 200px", maxWidth: 320 }}>
          <SearchBar value={search} onChange={e => onSearch?.(e.target.value)} onClear={() => onSearch?.("")} placeholder={placeholder} />
        </div>

        {filters.map(f => <FilterField key={f.key} field={f} />)}

        {activeCount > 0 && (
          <span className="yd-filterbar-count">{activeCount} active</span>
        )}

        {activeCount > 0 && (
          <button type="button" className="yd-filterbar-clear" onClick={clearAll}>Clear filters</button>
        )}

        {savedViewsKey && (
          <div style={{ position: "relative" }}>
            <button
              type="button"
              className={`yd-filterbar-saved-btn${showSaved ? " yd-filterbar-saved-btn--active" : ""}`}
              onClick={() => setShowSaved(o => !o)}
              aria-expanded={showSaved}
            >
              <Bookmark size={13} strokeWidth={2} /> Saved
            </button>
            {showSaved && (
              <div className="yd-filterbar-saved-panel">
                <div className="yd-filterbar-saved-save-row">
                  <input
                    className="yd-filterbar-mini-input"
                    placeholder="Name this view…"
                    value={saveNameDraft}
                    onChange={e => setSaveNameDraft(e.target.value)}
                  />
                  <button type="button" disabled={!saveNameDraft.trim()} onClick={handleSaveView} aria-label="Save view">
                    <BookmarkPlus size={14} strokeWidth={2} />
                  </button>
                </div>
                {views.length === 0 ? (
                  <div className="yd-filterbar-saved-empty">No saved views yet.</div>
                ) : (
                  views.map(v => (
                    <div key={v.name} className="yd-filterbar-saved-item">
                      <button type="button" className="yd-filterbar-saved-item-name" onClick={() => applyView(v)}>{v.name}</button>
                      <button type="button" className="yd-filterbar-saved-item-del" onClick={() => removeView(v.name)} aria-label={`Delete ${v.name}`}>
                        <X size={11} strokeWidth={2.5} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        <div style={{ flex: 1 }} />

        {actions && <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>{actions}</div>}
      </div>
    </div>
  );
}

function isFilterActive(f) {
  if (f.type === "chips") return Array.isArray(f.value) && f.value.length > 0;
  if (f.type === "dateRange") return !!(f.value?.from || f.value?.to);
  return f.value !== undefined && f.value !== "" && f.value !== "All";
}

function FilterField({ field: f }) {
  if (f.type === "chips") {
    const selected = Array.isArray(f.value) ? f.value : [];
    return (
      <div className="yd-filterbar-field">
        {f.label && <span className="yd-filterbar-field-label">{f.label}</span>}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {f.options.map(opt => {
            const val = typeof opt === "object" ? opt.value : opt;
            const label = typeof opt === "object" ? opt.label : opt;
            const active = selected.includes(val);
            return (
              <button
                key={val}
                type="button"
                className={`yd-filterbar-chip${active ? " yd-filterbar-chip--active" : ""}`}
                onClick={() => f.onChange?.(active ? selected.filter(v => v !== val) : [...selected, val])}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (f.type === "dateRange") {
    const range = f.value || {};
    return (
      <div className="yd-filterbar-field">
        {f.label && <span className="yd-filterbar-field-label">{f.label}</span>}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input type="date" className="yd-filterbar-mini-input" value={range.from || ""} onChange={e => f.onChange?.({ ...range, from: e.target.value || undefined })} />
          <span style={{ fontSize: 11, color: "var(--yd-text-muted)" }}>to</span>
          <input type="date" className="yd-filterbar-mini-input" value={range.to || ""} onChange={e => f.onChange?.({ ...range, to: e.target.value || undefined })} />
        </div>
      </div>
    );
  }

  if (f.type === "text") {
    return (
      <div className="yd-filterbar-field">
        {f.label && <span className="yd-filterbar-field-label">{f.label}</span>}
        <input
          type="text"
          className="yd-filterbar-mini-input"
          style={{ width: f.width ?? "auto" }}
          placeholder={f.placeholder || f.label || ""}
          value={f.value ?? ""}
          onChange={e => f.onChange?.(e.target.value)}
        />
      </div>
    );
  }

  // "select" (default) — options may be tuples ([val,label]), {value,label}
  // objects (the shape used everywhere else in this design system, e.g.
  // Select.jsx / DataTable column filterOptions), or flat primitives.
  return (
    <div className="yd-filterbar-field">
      {f.label && <span className="yd-filterbar-field-label">{f.label}</span>}
      <select className="yd-filterbar-select" value={f.value ?? "All"} onChange={e => f.onChange?.(e.target.value)} style={{ width: f.width ?? "auto" }}>
        {f.options.map(o => {
          if (Array.isArray(o)) return <option key={o[0]} value={o[0]}>{o[1]}</option>;
          if (o && typeof o === "object") return <option key={o.value} value={o.value}>{o.label}</option>;
          return <option key={o} value={o}>{o}</option>;
        })}
      </select>
    </div>
  );
}

function useSavedViews(storageKey) {
  const [views, setViews] = useState([]);

  useEffect(() => {
    if (!storageKey) return;
    try { setViews(JSON.parse(localStorage.getItem(storageKey) || "[]")); } catch { setViews([]); }
  }, [storageKey]);

  const persist = useCallback((next) => {
    setViews(next);
    if (storageKey) { try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* storage unavailable */ } }
  }, [storageKey]);

  const save = useCallback((name, snapshot) => {
    persist([...views.filter(v => v.name !== name), { name, snapshot }]);
  }, [views, persist]);

  const remove = useCallback((name) => {
    persist(views.filter(v => v.name !== name));
  }, [views, persist]);

  return { views, save, remove };
}
