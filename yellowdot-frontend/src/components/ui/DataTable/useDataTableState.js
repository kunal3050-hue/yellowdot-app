/**
 * useDataTableState.js — headless state for DataTable v2
 * ──────────────────────────────────────────────────────────────────
 * Wraps @tanstack/react-table for sorting / column visibility / column
 * order / column pinning / row selection / filtering, and layers on:
 *   - localStorage persistence of user preferences (per tableId)
 *   - saved searches (named globalFilter + columnFilters combos)
 *   - a simplified column-definition API translated into TanStack's shape
 */

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
} from "@tanstack/react-table";

const LS_PREFIX = "yd_dt_";

function loadPrefs(tableId) {
  if (!tableId) return {};
  try {
    return JSON.parse(localStorage.getItem(`${LS_PREFIX}${tableId}`) || "{}");
  } catch {
    return {};
  }
}

function savePrefs(tableId, patch) {
  if (!tableId) return;
  try {
    const current = loadPrefs(tableId);
    localStorage.setItem(`${LS_PREFIX}${tableId}`, JSON.stringify({ ...current, ...patch }));
  } catch { /* storage full/unavailable — non-fatal */ }
}

function loadSavedSearches(tableId) {
  if (!tableId) return [];
  try {
    return JSON.parse(localStorage.getItem(`${LS_PREFIX}${tableId}_searches`) || "[]");
  } catch {
    return [];
  }
}

function persistSavedSearches(tableId, searches) {
  if (!tableId) return;
  try {
    localStorage.setItem(`${LS_PREFIX}${tableId}_searches`, JSON.stringify(searches));
  } catch { /* non-fatal */ }
}

/** Translate DataTable's simplified column API into TanStack ColumnDef[]. */
function toTanstackColumns(columns, { selectable }) {
  const cols = columns.map(col => ({
    id: col.key,
    accessorFn: col.accessorFn || (row => row[col.key]),
    header: col.label,
    enableSorting: col.sortable !== false,
    enableHiding: col.hideable !== false,
    enableColumnFilter: !!col.filterable,
    size: typeof col.width === "number" ? col.width : undefined,
    minSize: col.minWidth,
    meta: { ...col },
  }));

  if (selectable) {
    cols.unshift({
      id: "__select",
      header: "",
      enableSorting: false,
      enableHiding: false,
      size: 40,
      meta: { type: "select" },
    });
  }

  return cols;
}

export default function useDataTableState({
  tableId,
  data,
  columns,
  selectable = false,
  initialPageSize = 25,
  manualPagination = false, // true when the caller does server-side pagination
  pageCount,
  onPageChange,
}) {
  const prefs = useMemo(() => loadPrefs(tableId), [tableId]);

  const [sorting, setSorting] = useState(prefs.sorting || []);
  const [columnVisibility, setColumnVisibility] = useState(prefs.columnVisibility || {});
  const [columnOrder, setColumnOrder] = useState(prefs.columnOrder || []);
  const [columnPinning, setColumnPinning] = useState(
    prefs.columnPinning || {
      left: selectable ? ["__select"] : [],
      right: [],
    }
  );
  const [density, setDensity] = useState(prefs.density || "comfortable");
  const [rowSelection, setRowSelection] = useState({});
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState([]);
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: prefs.pageSize || initialPageSize,
  });
  const [savedSearches, setSavedSearches] = useState(() => loadSavedSearches(tableId));

  // Persist preferences whenever they change (debounced by React's own batching)
  useEffect(() => {
    savePrefs(tableId, { sorting, columnVisibility, columnOrder, columnPinning, density, pageSize: pagination.pageSize });
  }, [tableId, sorting, columnVisibility, columnOrder, columnPinning, density, pagination.pageSize]);

  useEffect(() => {
    onPageChange?.(pagination.pageIndex + 1, pagination.pageSize);
  }, [pagination.pageIndex, pagination.pageSize]); // eslint-disable-line react-hooks/exhaustive-deps

  const tanstackColumns = useMemo(
    () => toTanstackColumns(columns, { selectable }),
    [columns, selectable]
  );

  const table = useReactTable({
    data,
    columns: tanstackColumns,
    state: {
      sorting,
      columnVisibility,
      columnOrder,
      columnPinning,
      rowSelection,
      globalFilter,
      columnFilters,
      pagination,
    },
    enableMultiSort: true,
    enableRowSelection: selectable,
    manualPagination,
    pageCount: manualPagination ? pageCount : undefined,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    onColumnPinningChange: setColumnPinning,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: manualPagination ? undefined : getSortedRowModel(),
    getFilteredRowModel: manualPagination ? undefined : getFilteredRowModel(),
    // Always registered (TanStack Table doesn't cleanly toggle a row-model
    // getter on/off across renders of the same table instance -- passing
    // undefined on a later render doesn't reliably unregister a getter that
    // was present on an earlier render). The caller instead chooses between
    // table.getRowModel() (paginated) and table.getPrePaginationRowModel()
    // (sorted+filtered, unpaginated -- what virtualization needs) based on
    // disablePagination, via the `rows` selection in index.jsx.
    getPaginationRowModel: manualPagination ? undefined : getPaginationRowModel(),
  });

  const clearAllFilters = useCallback(() => {
    setGlobalFilter("");
    setColumnFilters([]);
  }, []);

  const activeFilterCount = columnFilters.length + (globalFilter ? 1 : 0);

  const saveSearch = useCallback((name) => {
    const entry = { name, globalFilter, columnFilters, savedAt: Date.now() };
    setSavedSearches(prev => {
      const next = [...prev.filter(s => s.name !== name), entry];
      persistSavedSearches(tableId, next);
      return next;
    });
  }, [tableId, globalFilter, columnFilters]);

  const applySavedSearch = useCallback((name) => {
    const entry = savedSearches.find(s => s.name === name);
    if (!entry) return;
    setGlobalFilter(entry.globalFilter || "");
    setColumnFilters(entry.columnFilters || []);
  }, [savedSearches]);

  const deleteSavedSearch = useCallback((name) => {
    setSavedSearches(prev => {
      const next = prev.filter(s => s.name !== name);
      persistSavedSearches(tableId, next);
      return next;
    });
  }, [tableId]);

  return {
    table,
    density, setDensity,
    globalFilter, setGlobalFilter,
    columnFilters, setColumnFilters,
    clearAllFilters,
    activeFilterCount,
    rowSelection, setRowSelection,
    savedSearches, saveSearch, applySavedSearch, deleteSavedSearch,
  };
}
