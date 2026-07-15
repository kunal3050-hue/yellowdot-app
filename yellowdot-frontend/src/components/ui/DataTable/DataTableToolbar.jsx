/**
 * DataTableToolbar.jsx — search, filters, bulk actions, export, columns, density
 * ──────────────────────────────────────────────────────────────────────────
 * Purely presentational + local popover state; all real state lives in the
 * `table` instance (TanStack) and the hook that owns density/saved searches.
 */

import { useState, useRef, useEffect } from "react";
import {
  Search, X, SlidersHorizontal, Download, Columns3, Rows3, Rows2,
  BookmarkPlus, Bookmark, ChevronDown, Trash2, Archive, FileDown,
} from "lucide-react";
import { flexRender } from "@tanstack/react-table";

function useClickOutside(ref, onOutside) {
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) onOutside();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ref, onOutside]);
}

function Popover({ label, icon, badge, children, align = "left" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false));

  return (
    <div className="yd-dt-popover-wrap" ref={ref}>
      <button
        type="button"
        className={`yd-dt-tb-btn${open ? " yd-dt-tb-btn--active" : ""}`}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        {icon}
        <span>{label}</span>
        {badge != null && badge > 0 && <span className="yd-dt-badge-count">{badge}</span>}
        <ChevronDown size={13} strokeWidth={2.5} />
      </button>
      {open && (
        <div className={`yd-dt-popover yd-dt-popover--${align}`} onClick={e => e.stopPropagation()}>
          {typeof children === "function" ? children({ close: () => setOpen(false) }) : children}
        </div>
      )}
    </div>
  );
}

export default function DataTableToolbar({
  table,
  globalFilter, setGlobalFilter,
  activeFilterCount, clearAllFilters,
  density, setDensity,
  savedSearches, saveSearch, applySavedSearch, deleteSavedSearch,
  bulkActions = [],
  exportFormats = ["csv", "excel", "print"],
  onExport,
  entityLabel = "results",
  searchPlaceholder = "Search…",
  toolbarExtra,
}) {
  const [saveNameDraft, setSaveNameDraft] = useState("");
  const selectedRows = table.getSelectedRowModel().rows;
  const selectedCount = selectedRows.length;
  const filterableColumns = table.getAllLeafColumns().filter(c => c.columnDef.enableColumnFilter);

  return (
    <div className="yd-dt-toolbar">
      {/* ── Row 1: search + filters + columns + density + export ────────── */}
      <div className="yd-dt-toolbar-row">
        <div className="yd-dt-search-wrap">
          <Search size={14} strokeWidth={2} className="yd-dt-search-icon" />
          <input
            className="yd-dt-search-input"
            value={globalFilter}
            onChange={e => setGlobalFilter(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label="Search"
          />
          {globalFilter && (
            <button className="yd-dt-search-clear" onClick={() => setGlobalFilter("")} aria-label="Clear search">
              <X size={13} strokeWidth={2.5} />
            </button>
          )}
        </div>

        {filterableColumns.length > 0 && (
          <Popover label="Filters" icon={<SlidersHorizontal size={13} strokeWidth={2} />} badge={activeFilterCount}>
            {({ close }) => (
              <div className="yd-dt-filter-panel">
                {filterableColumns.map(col => (
                  <ColumnFilter key={col.id} column={col} />
                ))}
                <div className="yd-dt-filter-panel-footer">
                  <button className="yd-dt-link-btn" onClick={() => { clearAllFilters(); close(); }}>
                    Clear all filters
                  </button>
                </div>
              </div>
            )}
          </Popover>
        )}

        <Popover label="Saved" icon={<Bookmark size={13} strokeWidth={2} />}>
          {({ close }) => (
            <div className="yd-dt-saved-panel">
              <div className="yd-dt-saved-save-row">
                <input
                  className="yd-dt-mini-input"
                  placeholder="Name this search…"
                  value={saveNameDraft}
                  onChange={e => setSaveNameDraft(e.target.value)}
                />
                <button
                  className="yd-dt-icon-btn-sm"
                  disabled={!saveNameDraft.trim()}
                  onClick={() => { saveSearch(saveNameDraft.trim()); setSaveNameDraft(""); }}
                  aria-label="Save search"
                >
                  <BookmarkPlus size={14} strokeWidth={2} />
                </button>
              </div>
              {savedSearches.length === 0 ? (
                <div className="yd-dt-saved-empty">No saved searches yet.</div>
              ) : (
                savedSearches.map(s => (
                  <div key={s.name} className="yd-dt-saved-item">
                    <button className="yd-dt-saved-item-name" onClick={() => { applySavedSearch(s.name); close(); }}>
                      {s.name}
                    </button>
                    <button className="yd-dt-saved-item-del" onClick={() => deleteSavedSearch(s.name)} aria-label={`Delete ${s.name}`}>
                      <X size={11} strokeWidth={2.5} />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </Popover>

        <Popover label="Columns" icon={<Columns3 size={13} strokeWidth={2} />}>
          <div className="yd-dt-columns-panel">
            {table.getAllLeafColumns().filter(c => c.columnDef.enableHiding !== false).map(col => (
              <label key={col.id} className="yd-dt-col-toggle">
                <input
                  type="checkbox"
                  checked={col.getIsVisible()}
                  onChange={col.getToggleVisibilityHandler()}
                />
                <span>{typeof col.columnDef.header === "string" ? col.columnDef.header : col.id}</span>
                <span className="yd-dt-col-pin-actions">
                  <button
                    className={`yd-dt-pin-btn${col.getIsPinned() === "left" ? " yd-dt-pin-btn--active" : ""}`}
                    onClick={() => col.pin(col.getIsPinned() === "left" ? false : "left")}
                    title="Pin left"
                    type="button"
                  >L</button>
                  <button
                    className={`yd-dt-pin-btn${col.getIsPinned() === "right" ? " yd-dt-pin-btn--active" : ""}`}
                    onClick={() => col.pin(col.getIsPinned() === "right" ? false : "right")}
                    title="Pin right"
                    type="button"
                  >R</button>
                </span>
              </label>
            ))}
          </div>
        </Popover>

        <div className="yd-dt-density-toggle" role="group" aria-label="Row density">
          <button
            className={`yd-dt-density-btn${density === "comfortable" ? " yd-dt-density-btn--active" : ""}`}
            onClick={() => setDensity("comfortable")}
            aria-pressed={density === "comfortable"}
            title="Comfortable"
          >
            <Rows2 size={14} strokeWidth={2} />
          </button>
          <button
            className={`yd-dt-density-btn${density === "compact" ? " yd-dt-density-btn--active" : ""}`}
            onClick={() => setDensity("compact")}
            aria-pressed={density === "compact"}
            title="Compact"
          >
            <Rows3 size={14} strokeWidth={2} />
          </button>
        </div>

        {onExport && exportFormats.length > 0 && (
          <Popover label="Export" icon={<Download size={13} strokeWidth={2} />} align="right">
            {({ close }) => (
              <div className="yd-dt-export-panel">
                {exportFormats.map(fmt => (
                  <button key={fmt} className="yd-dt-export-item" onClick={() => { onExport(fmt); close(); }}>
                    <FileDown size={13} strokeWidth={2} />
                    {fmt.toUpperCase()}
                  </button>
                ))}
              </div>
            )}
          </Popover>
        )}

        {toolbarExtra && <div className="yd-dt-toolbar-extra">{toolbarExtra}</div>}
      </div>

      {/* ── Row 2: active filter chips ────────────────────────────────── */}
      {activeFilterCount > 0 && (
        <div className="yd-dt-chip-row">
          {globalFilter && (
            <span className="yd-dt-chip">
              Search: "{globalFilter}"
              <button onClick={() => setGlobalFilter("")} aria-label="Remove search filter"><X size={11} strokeWidth={2.5} /></button>
            </span>
          )}
          {table.getState().columnFilters.map(f => {
            const col = table.getColumn(f.id);
            const label = typeof col?.columnDef.header === "string" ? col.columnDef.header : f.id;
            return (
              <span key={f.id} className="yd-dt-chip">
                {label}: {formatFilterValue(f.value)}
                <button onClick={() => col?.setFilterValue(undefined)} aria-label={`Remove ${label} filter`}>
                  <X size={11} strokeWidth={2.5} />
                </button>
              </span>
            );
          })}
          <button className="yd-dt-link-btn" onClick={clearAllFilters}>Clear all</button>
        </div>
      )}

      {/* ── Row 3: bulk action bar (only when rows selected) ─────────────── */}
      {selectedCount > 0 && bulkActions.length > 0 && (
        <div className="yd-dt-bulk-bar">
          <span className="yd-dt-bulk-count">{selectedCount} selected</span>
          <div className="yd-dt-bulk-actions">
            {bulkActions.map(action => (
              <button
                key={action.key || action.label}
                className={`yd-dt-bulk-btn${action.variant === "danger" ? " yd-dt-bulk-btn--danger" : ""}`}
                onClick={() => action.onClick(selectedRows.map(r => r.original))}
              >
                {action.icon || (action.variant === "danger" ? <Trash2 size={13} strokeWidth={2} /> : <Archive size={13} strokeWidth={2} />)}
                {action.label}
              </button>
            ))}
          </div>
          <button className="yd-dt-link-btn" onClick={() => table.resetRowSelection()}>
            Clear selection
          </button>
        </div>
      )}
    </div>
  );
}

function formatFilterValue(value) {
  if (Array.isArray(value)) return value.join(", ");
  if (value && typeof value === "object" && ("from" in value || "to" in value)) {
    return `${value.from || "…"} → ${value.to || "…"}`;
  }
  return String(value);
}

/** Renders the correct control for a single filterable column, based on its filterType. */
function ColumnFilter({ column }) {
  const meta = column.columnDef.meta || {};
  const type = meta.filterType || "text";
  const value = column.getFilterValue();

  if (type === "select" || type === "multiselect") {
    const options = meta.filterOptions || [];
    const selected = Array.isArray(value) ? value : value ? [value] : [];
    return (
      <div className="yd-dt-filter-field">
        <label>{typeof column.columnDef.header === "string" ? column.columnDef.header : column.id}</label>
        <div className="yd-dt-filter-chips">
          {options.map(opt => {
            const optValue = typeof opt === "object" ? opt.value : opt;
            const optLabel = typeof opt === "object" ? opt.label : opt;
            const active = selected.includes(optValue);
            return (
              <button
                key={optValue}
                type="button"
                className={`yd-dt-filter-chip-btn${active ? " yd-dt-filter-chip-btn--active" : ""}`}
                onClick={() => {
                  const next = active ? selected.filter(v => v !== optValue) : [...selected, optValue];
                  column.setFilterValue(next.length ? next : undefined);
                }}
              >
                {optLabel}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (type === "dateRange") {
    const range = value || {};
    return (
      <div className="yd-dt-filter-field">
        <label>{typeof column.columnDef.header === "string" ? column.columnDef.header : column.id}</label>
        <div className="yd-dt-filter-daterange">
          <input
            type="date"
            className="yd-dt-mini-input"
            value={range.from || ""}
            onChange={e => column.setFilterValue({ ...range, from: e.target.value || undefined })}
          />
          <span>to</span>
          <input
            type="date"
            className="yd-dt-mini-input"
            value={range.to || ""}
            onChange={e => column.setFilterValue({ ...range, to: e.target.value || undefined })}
          />
        </div>
      </div>
    );
  }

  // Plain text column search
  return (
    <div className="yd-dt-filter-field">
      <label>{typeof column.columnDef.header === "string" ? column.columnDef.header : column.id}</label>
      <input
        className="yd-dt-mini-input"
        value={value || ""}
        onChange={e => column.setFilterValue(e.target.value || undefined)}
        placeholder={`Filter ${typeof column.columnDef.header === "string" ? column.columnDef.header.toLowerCase() : column.id}…`}
      />
    </div>
  );
}
