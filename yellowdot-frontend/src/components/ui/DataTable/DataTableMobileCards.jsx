/**
 * DataTableMobileCards.jsx — card-based row rendering for small screens.
 * Renders below the `mobileBreakpoint`; the desktop <table> is hidden via CSS
 * rather than unmounted, so no data/scroll-position is lost when resizing.
 */
import renderCell from "./renderCell";

export default function DataTableMobileCards({
  rows,
  columns,
  selectable,
  onRowClick,
  globalFilter,
  primaryColumnKey,
}) {
  const dataColumns = columns.filter(c => c.type !== "actions" && c.key !== primaryColumnKey);
  const primaryCol = columns.find(c => c.key === primaryColumnKey) || columns[0];
  const actionsCol = columns.find(c => c.type === "actions");

  return (
    <div className="yd-dt-mobile-cards" role="list">
      {rows.map((row, i) => {
        const original = row.original;
        const selected = row.getIsSelected?.();
        return (
          <div
            key={row.id}
            role="listitem"
            className={`yd-dt-mobile-card${selected ? " yd-dt-mobile-card--selected" : ""}`}
            onClick={onRowClick ? () => onRowClick(original) : undefined}
            tabIndex={onRowClick ? 0 : undefined}
            onKeyDown={onRowClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onRowClick(original); } } : undefined}
          >
            <div className="yd-dt-mobile-card-top">
              {selectable && (
                <input
                  type="checkbox"
                  checked={!!selected}
                  onChange={row.getToggleSelectedHandler?.()}
                  onClick={e => e.stopPropagation()}
                  aria-label="Select row"
                />
              )}
              <div className="yd-dt-mobile-card-primary">
                {renderCell(primaryCol, original[primaryCol.key], original, i, globalFilter)}
              </div>
              {actionsCol && (
                <div onClick={e => e.stopPropagation()}>
                  {renderCell(actionsCol, original[actionsCol.key], original, i, globalFilter)}
                </div>
              )}
            </div>
            <div className="yd-dt-mobile-card-grid">
              {dataColumns.map(col => (
                <div key={col.key} className="yd-dt-mobile-card-field">
                  <span className="yd-dt-mobile-card-label">{col.label}</span>
                  <span className="yd-dt-mobile-card-value">
                    {renderCell(col, original[col.key], original, i, globalFilter)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
