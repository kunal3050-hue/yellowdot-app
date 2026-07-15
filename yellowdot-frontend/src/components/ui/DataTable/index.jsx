/**
 * DataTable v2 — the canonical KUE BOXS enterprise data table
 * ═══════════════════════════════════════════════════════════════════════
 * See KUE_BOXS_DESIGN_SYSTEM.md for the full spec this implements, and
 * DATATABLE_API.md for the complete props reference + migration guide.
 *
 * Built on @tanstack/react-table (sorting, filtering, column visibility/
 * order/pinning, row selection) and @tanstack/react-virtual (virtualized
 * row rendering for large datasets). Zero production consumers existed
 * before this rebuild, so this is a clean v2 API, not a compatibility shim.
 *
 * Below `virtualizeThreshold` rows, renders a real semantic <table> (best
 * a11y, simplest, matches the rest of the app's table markup). Above the
 * threshold (or when `virtualize` is forced true), switches to a div-based
 * grid with ARIA table roles, which is what makes absolutely-positioned
 * virtual rows possible — a real <table> can't do that cleanly.
 */

import { useRef, useMemo, useState, useCallback, memo } from "react";
import { flexRender } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowUp, ArrowDown, ChevronsUpDown } from "lucide-react";

import useDataTableState from "./useDataTableState";
import DataTableToolbar from "./DataTableToolbar";
import DataTableMobileCards from "./DataTableMobileCards";
import renderCell from "./renderCell";
import { runExport } from "./dataTableExport";
import Skeleton from "../Skeleton";
import EmptyState from "../EmptyState";

const DENSITY_ROW_HEIGHT = { comfortable: 44, compact: 32 };

export default function DataTable({
  tableId,
  columns = [],
  data = [],
  loading = false,

  selectable = false,
  bulkActions = [],

  onRowClick,
  empty,
  emptyIllustration,

  entityLabel = "results",
  searchPlaceholder = "Search…",
  exportFormats = ["csv", "excel", "print"],
  exportFilename = "export",
  exportTitle,
  exportHandlers,
  onExport,

  toolbarExtra,
  showToolbar = true,

  virtualize,
  virtualizeThreshold = 200,
  maxBodyHeight = 560,

  mobileBreakpoint = 640,

  pageSizeOptions = [10, 25, 50, 100],
  manualPagination = false,
  pageCount,
  totalRows,
  onPageChange,

  className = "",
}) {
  const scrollRef = useRef(null);
  const [focusedCell, setFocusedCell] = useState({ row: 0, col: 0 });

  // Decided from the raw dataset size, BEFORE pagination -- pagination and
  // virtualization are alternative strategies, not composable (see
  // useDataTableState's disablePagination doc comment).
  const shouldVirtualize = virtualize ?? data.length > virtualizeThreshold;

  const {
    table, density, setDensity,
    globalFilter, setGlobalFilter,
    activeFilterCount, clearAllFilters,
    savedSearches, saveSearch, applySavedSearch, deleteSavedSearch,
  } = useDataTableState({
    tableId, data, columns, selectable,
    initialPageSize: pageSizeOptions[1] || 25,
    manualPagination, pageCount, onPageChange,
  });

  // Virtualizing: use the pre-pagination (sorted+filtered, unpaginated) row
  // model -- pagination and virtualization are alternative strategies for
  // large lists, not composable. Not virtualizing: use the normal paginated
  // row model.
  const rows = shouldVirtualize ? table.getPrePaginationRowModel().rows : table.getRowModel().rows;
  const leafColumns = table.getVisibleLeafColumns();
  const rowHeight = DENSITY_ROW_HEIGHT[density] || 44;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 12,
    enabled: shouldVirtualize,
  });

  // ── Export ────────────────────────────────────────────────────────────
  const handleExport = useCallback((format) => {
    const exportRows = table.getFilteredRowModel().rows.map(r => r.original);
    const exportCols = columns.filter(c => c.type !== "actions" && c.key !== "__select");
    runExport(format, exportRows, exportCols, { filename: exportFilename, title: exportTitle }, exportHandlers);
    onExport?.(format, exportRows);
  }, [table, columns, exportFilename, exportTitle, exportHandlers, onExport]);

  // ── Keyboard navigation (arrow keys between cells, Enter activates row) ─
  const handleKeyDown = useCallback((e, rowIndex, colIndex, rowOriginal) => {
    const maxRow = rows.length - 1;
    const maxCol = leafColumns.length - 1;
    if (e.key === "ArrowDown") { e.preventDefault(); setFocusedCell({ row: Math.min(rowIndex + 1, maxRow), col: colIndex }); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setFocusedCell({ row: Math.max(rowIndex - 1, 0), col: colIndex }); }
    else if (e.key === "ArrowRight") { e.preventDefault(); setFocusedCell({ row: rowIndex, col: Math.min(colIndex + 1, maxCol) }); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); setFocusedCell({ row: rowIndex, col: Math.max(colIndex - 1, 0) }); }
    else if (e.key === "Enter" && onRowClick) { e.preventDefault(); onRowClick(rowOriginal); }
  }, [rows.length, leafColumns.length, onRowClick]);

  // ── Pagination display ("Showing 26–50 of 284 students") ──────────────
  // When virtualizing, there is no "page" -- all filtered rows are already
  // in the DOM (windowed), so the range is simply the full filtered count.
  const { pageIndex, pageSize } = table.getState().pagination;
  const total = manualPagination ? (totalRows ?? 0) : shouldVirtualize ? rows.length : table.getFilteredRowModel().rows.length;
  const from = total === 0 ? 0 : shouldVirtualize ? 1 : pageIndex * pageSize + 1;
  const to = shouldVirtualize ? total : Math.min((pageIndex + 1) * pageSize, total);
  const pageCountResolved = manualPagination ? (pageCount || 1) : table.getPageCount();

  const isEmpty = !loading && rows.length === 0;

  return (
    <div className={`yd-dt-root ${className}`} data-density={density}>
      {showToolbar && (
        <DataTableToolbar
          table={table}
          globalFilter={globalFilter} setGlobalFilter={setGlobalFilter}
          activeFilterCount={activeFilterCount} clearAllFilters={clearAllFilters}
          density={density} setDensity={setDensity}
          savedSearches={savedSearches} saveSearch={saveSearch}
          applySavedSearch={applySavedSearch} deleteSavedSearch={deleteSavedSearch}
          bulkActions={bulkActions}
          exportFormats={exportFormats}
          onExport={exportFormats.length ? handleExport : null}
          entityLabel={entityLabel}
          searchPlaceholder={searchPlaceholder}
          toolbarExtra={toolbarExtra}
        />
      )}

      {/* Desktop: real <table> below threshold, virtualized div-grid above.
          Visibility is CSS-only (dataTable.css) so the >640px media query
          can actually take effect -- no inline style here. */}
      <div className="yd-dt-desktop">
        {loading ? (
          <SkeletonRows columns={leafColumns} density={density} />
        ) : isEmpty ? (
          <EmptyState
            icon={emptyIllustration}
            title={empty?.title || `No ${entityLabel} found`}
            description={empty?.description || (activeFilterCount > 0 ? "Try adjusting your search or filters." : `${entityLabel} will appear here once added.`)}
            action={empty?.action}
          />
        ) : shouldVirtualize ? (
          <VirtualizedGrid
            scrollRef={scrollRef}
            virtualizer={virtualizer}
            rows={rows}
            table={table}
            leafColumns={leafColumns}
            selectable={selectable}
            onRowClick={onRowClick}
            globalFilter={globalFilter}
            focusedCell={focusedCell}
            setFocusedCell={setFocusedCell}
            handleKeyDown={handleKeyDown}
            maxBodyHeight={maxBodyHeight}
            rowHeight={rowHeight}
          />
        ) : (
          <PlainTable
            table={table}
            rows={rows}
            leafColumns={leafColumns}
            selectable={selectable}
            onRowClick={onRowClick}
            globalFilter={globalFilter}
            focusedCell={focusedCell}
            setFocusedCell={setFocusedCell}
            handleKeyDown={handleKeyDown}
            maxBodyHeight={maxBodyHeight}
          />
        )}
      </div>

      {/* Mobile: card-based rows, shown via CSS below 640px (see dataTable.css) */}
      <div className="yd-dt-mobile">
        {loading ? (
          <div className="yd-dt-mobile-skel">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={72} radius={12} />)}
          </div>
        ) : isEmpty ? (
          <EmptyState
            icon={emptyIllustration}
            title={empty?.title || `No ${entityLabel} found`}
            description={empty?.description || `${entityLabel} will appear here once added.`}
            action={empty?.action}
          />
        ) : (
          <DataTableMobileCards
            rows={rows}
            columns={columns}
            selectable={selectable}
            onRowClick={onRowClick}
            globalFilter={globalFilter}
            primaryColumnKey={columns[0]?.key}
          />
        )}
      </div>

      {/* Pagination footer -- when virtualizing, all rows are already
          windowed into the DOM, so page controls are meaningless. */}
      {!isEmpty && (
        <div className="yd-dt-pagination">
          <div className="yd-dt-pagination-info">
            {shouldVirtualize
              ? `Showing all ${total} ${entityLabel} (virtualized)`
              : `Showing ${from}–${to} of ${total} ${entityLabel}`}
          </div>
          {!shouldVirtualize && (
            <div className="yd-dt-pagination-controls">
              <label className="yd-dt-page-size">
                <span>Rows per page</span>
                <select
                  value={pageSize}
                  onChange={e => table.setPageSize(Number(e.target.value))}
                >
                  {pageSizeOptions.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <div className="yd-dt-page-nav">
                <button onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()} aria-label="First page">«</button>
                <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Previous page">‹</button>
                <span className="yd-dt-page-current">{pageIndex + 1} / {Math.max(1, pageCountResolved)}</span>
                <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Next page">›</button>
                <button onClick={() => table.setPageIndex(pageCountResolved - 1)} disabled={!table.getCanNextPage()} aria-label="Last page">»</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Sort indicator
// ══════════════════════════════════════════════════════════════════════
function SortIndicator({ column }) {
  if (!column.getCanSort()) return null;
  const dir = column.getIsSorted();
  return (
    <span className="yd-dt-sort-icon" aria-hidden="true">
      {dir === "asc" ? <ArrowUp size={12} strokeWidth={2.5} />
        : dir === "desc" ? <ArrowDown size={12} strokeWidth={2.5} />
        : <ChevronsUpDown size={12} strokeWidth={2} />}
    </span>
  );
}

function HeaderCell({ header, pinStyle }) {
  const column = header.column;
  const canSort = column.getCanSort();
  return (
    <div
      role="columnheader"
      className={`yd-dt-th${column.getIsPinned() ? " yd-dt-th--pinned" : ""}`}
      style={{ width: header.getSize(), ...pinStyle }}
      aria-sort={column.getIsSorted() === "asc" ? "ascending" : column.getIsSorted() === "desc" ? "descending" : "none"}
    >
      {column.columnDef.meta?.type === "select" ? (
        <input
          type="checkbox"
          aria-label="Select all rows"
          checked={header.getContext().table.getIsAllPageRowsSelected()}
          onChange={header.getContext().table.getToggleAllPageRowsSelectedHandler()}
        />
      ) : (
        <button
          type="button"
          className="yd-dt-th-btn"
          onClick={canSort ? (e) => column.toggleSorting(undefined, e.shiftKey) : undefined}
          disabled={!canSort}
          aria-label={canSort ? `Sort by ${header.column.columnDef.header}. Hold Shift to sort by multiple columns.` : undefined}
        >
          <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
          <SortIndicator column={column} />
        </button>
      )}
    </div>
  );
}

function pinStyleFor(column) {
  const pinned = column.getIsPinned();
  if (!pinned) return {};
  return {
    position: "sticky",
    [pinned]: 0,
    zIndex: 2,
    background: "var(--yd-surface)",
  };
}

// ══════════════════════════════════════════════════════════════════════
// Plain (non-virtualized) <table> path
// ══════════════════════════════════════════════════════════════════════
function PlainTable({ table, rows, leafColumns, selectable, onRowClick, globalFilter, focusedCell, setFocusedCell, handleKeyDown, maxBodyHeight }) {
  return (
    <div className="yd-dt-scroll-wrap" style={{ maxHeight: maxBodyHeight }}>
      <table className="yd-dt-table">
        <thead>
          {table.getHeaderGroups().map(hg => (
            <tr key={hg.id}>
              {hg.headers.map(header => (
                <th
                  key={header.id}
                  className={header.column.getIsPinned() ? "yd-dt-th--pinned" : ""}
                  style={{ width: header.getSize(), ...pinStyleFor(header.column) }}
                  aria-sort={header.column.getIsSorted() === "asc" ? "ascending" : header.column.getIsSorted() === "desc" ? "descending" : "none"}
                >
                  {header.column.columnDef.meta?.type === "select" ? (
                    <input
                      type="checkbox"
                      aria-label="Select all rows"
                      checked={table.getIsAllPageRowsSelected()}
                      onChange={table.getToggleAllPageRowsSelectedHandler()}
                    />
                  ) : (
                    <button
                      type="button"
                      className="yd-dt-th-btn"
                      onClick={header.column.getCanSort() ? (e) => header.column.toggleSorting(undefined, e.shiftKey) : undefined}
                      disabled={!header.column.getCanSort()}
                    >
                      <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
                      <SortIndicator column={header.column} />
                    </button>
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <TableRow
              key={row.id}
              row={row}
              rowIndex={ri}
              selected={row.getIsSelected()}
              leafColumns={leafColumns}
              selectable={selectable}
              onRowClick={onRowClick}
              globalFilter={globalFilter}
              focusedCell={focusedCell}
              setFocusedCell={setFocusedCell}
              handleKeyDown={handleKeyDown}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

const TableRow = memo(function TableRow({ row, rowIndex, selected, leafColumns, selectable, onRowClick, globalFilter, focusedCell, setFocusedCell, handleKeyDown }) {
  return (
    <tr
      className={`yd-dt-tr${selected ? " yd-dt-tr--selected" : ""}`}
      onClick={onRowClick ? () => onRowClick(row.original) : undefined}
    >
      {row.getVisibleCells().map((cell, ci) => {
        const col = cell.column.columnDef.meta || {};
        const isFocused = focusedCell.row === rowIndex && focusedCell.col === ci;
        return (
          <td
            key={cell.id}
            className={cell.column.getIsPinned() ? "yd-dt-td--pinned" : ""}
            style={pinStyleFor(cell.column)}
            tabIndex={isFocused ? 0 : -1}
            onFocus={() => setFocusedCell({ row: rowIndex, col: ci })}
            onKeyDown={(e) => handleKeyDown(e, rowIndex, ci, row.original)}
          >
            {col.type === "select" ? (
              <input
                type="checkbox"
                checked={selected}
                onChange={row.getToggleSelectedHandler()}
                onClick={e => e.stopPropagation()}
                aria-label="Select row"
              />
            ) : (
              renderCell(col, row.original[col.key], row.original, rowIndex, globalFilter)
            )}
          </td>
        );
      })}
    </tr>
  );
});

// ══════════════════════════════════════════════════════════════════════
// Virtualized div-grid path (large datasets — real <table> can't
// absolutely-position virtual rows cleanly, so this uses ARIA table roles)
// ══════════════════════════════════════════════════════════════════════
function VirtualizedGrid({ scrollRef, virtualizer, rows, table, leafColumns, selectable, onRowClick, globalFilter, focusedCell, setFocusedCell, handleKeyDown, maxBodyHeight, rowHeight }) {
  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  return (
    <div
      ref={scrollRef}
      className="yd-dt-scroll-wrap yd-dt-scroll-wrap--virtual"
      style={{ maxHeight: maxBodyHeight, overflow: "auto", position: "relative" }}
      role="table"
      aria-rowcount={rows.length}
    >
      <div role="rowgroup" className="yd-dt-vheader">
        <div role="row" className="yd-dt-vrow yd-dt-vrow--header">
          {table.getHeaderGroups()[0].headers.map(header => (
            <HeaderCell key={header.id} header={header} pinStyle={pinStyleFor(header.column)} />
          ))}
        </div>
      </div>
      <div role="rowgroup" style={{ height: totalSize, position: "relative" }}>
        {virtualItems.map(vItem => {
          const row = rows[vItem.index];
          const selected = row.getIsSelected();
          return (
            <div
              key={row.id}
              role="row"
              aria-rowindex={vItem.index + 1}
              className={`yd-dt-vrow${selected ? " yd-dt-vrow--selected" : ""}`}
              style={{
                position: "absolute", top: 0, left: 0, width: "100%",
                height: vItem.size, transform: `translateY(${vItem.start}px)`,
              }}
              onClick={onRowClick ? () => onRowClick(row.original) : undefined}
            >
              {row.getVisibleCells().map((cell, ci) => {
                const col = cell.column.columnDef.meta || {};
                const isFocused = focusedCell.row === vItem.index && focusedCell.col === ci;
                return (
                  <div
                    key={cell.id}
                    role="cell"
                    className="yd-dt-vcell"
                    style={{ width: cell.column.getSize(), ...pinStyleFor(cell.column) }}
                    tabIndex={isFocused ? 0 : -1}
                    onFocus={() => setFocusedCell({ row: vItem.index, col: ci })}
                    onKeyDown={(e) => handleKeyDown(e, vItem.index, ci, row.original)}
                  >
                    {col.type === "select" ? (
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={row.getToggleSelectedHandler()}
                        onClick={e => e.stopPropagation()}
                        aria-label="Select row"
                      />
                    ) : (
                      renderCell(col, row.original[col.key], row.original, vItem.index, globalFilter)
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Loading skeleton
// ══════════════════════════════════════════════════════════════════════
function SkeletonRows({ columns, density }) {
  const rowH = DENSITY_ROW_HEIGHT[density] || 44;
  return (
    <div className="yd-dt-scroll-wrap">
      <table className="yd-dt-table">
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.id}>{typeof col.columnDef.header === "string" ? col.columnDef.header : ""}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 8 }).map((_, ri) => (
            <tr key={ri} style={{ height: rowH }}>
              {columns.map(col => (
                <td key={col.id}>
                  <Skeleton height={12} width={col.columnDef.meta?.skeletonWidth || "70%"} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
