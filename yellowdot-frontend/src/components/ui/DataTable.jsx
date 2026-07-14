/**
 * DataTable — premium data table with sorting, pagination, empty + loading states
 *
 * @prop {Array}    columns       [{key, label, render?, width?, align?, sortable?, skeletonWidth?}]
 * @prop {Array}    data          row objects
 * @prop {boolean|number} loading true = 5 skeleton rows, N = N rows
 * @prop {function} onRowClick    (row) => void
 * @prop {object}   empty         EmptyState props
 * @prop {boolean}  striped       alternate row shading (default: true)
 * @prop {boolean}  compact       tighter row padding (default: false)
 * @prop {boolean}  stickyHeader  sticky thead (default: true)
 * @prop {string}   sortKey       controlled sort column key
 * @prop {string}   sortDir       "asc" | "desc"
 * @prop {function} onSort        (key, dir) => void
 * @prop {number}   page          current page (1-based), enables pagination UI
 * @prop {number}   pageSize      rows per page
 * @prop {number}   totalRows     total row count (for pagination display)
 * @prop {function} onPageChange  (page) => void
 * @prop {string}   className
 */

import EmptyState from "./EmptyState";
import Skeleton   from "./Skeleton";

export default function DataTable({
  columns     = [],
  data        = [],
  loading     = false,
  onRowClick,
  empty,
  striped     = true,
  compact     = false,
  stickyHeader= true,
  sortKey,
  sortDir     = "asc",
  onSort,
  page,
  pageSize    = 25,
  totalRows,
  onPageChange,
  className   = "",
}) {
  const skeletonCount = typeof loading === "number" ? loading : 6;
  const rowPad        = compact ? "7px 12px" : "10px 14px";

  function handleSort(col) {
    if (!col.sortable || !onSort) return;
    const nextDir = sortKey === col.key && sortDir === "asc" ? "desc" : "asc";
    onSort(col.key, nextDir);
  }

  // Pagination
  const showPagination = page != null && onPageChange != null;
  const total          = totalRows ?? data.length;
  const totalPages     = Math.max(1, Math.ceil(total / pageSize));
  const from           = (page - 1) * pageSize + 1;
  const to             = Math.min(page * pageSize, total);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, height: "100%" }}>
      {/* Table scroll area */}
      <div
        className={`yd-table-wrap ${className}`}
        style={{ flex: 1, overflowY: "auto" }}
      >
        <table className="yd-table" style={{ fontSize: compact ? 11 : 12 }}>
          <thead style={{ position: stickyHeader ? "sticky" : "static", top: 0, zIndex: 10 }}>
            <tr>
              {columns.map(col => {
                const isSorted  = sortKey === col.key;
                const canSort   = col.sortable && !!onSort;
                return (
                  <th
                    key={col.key}
                    style={{
                      width:    col.width,
                      textAlign:col.align ?? "left",
                      cursor:   canSort ? "pointer" : "default",
                      userSelect: canSort ? "none" : "auto",
                      paddingLeft:  col.align === "right" ? undefined : 14,
                      paddingRight: col.align === "right" ? 14 : undefined,
                    }}
                    onClick={() => handleSort(col)}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      {col.label}
                      {canSort && (
                        <SortIcon active={isSorted} dir={isSorted ? sortDir : null} />
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              /* Skeleton rows */
              Array.from({ length: skeletonCount }).map((_, ri) => (
                <tr key={ri}>
                  {columns.map(col => (
                    <td key={col.key} style={{ padding: rowPad }}>
                      <Skeleton height={11} width={col.skeletonWidth ?? "75%"} />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              /* Empty state */
              <tr>
                <td colSpan={columns.length} style={{ padding: 0, border: "none" }}>
                  {empty ? (
                    <EmptyState {...empty} />
                  ) : (
                    <EmptyState icon="📋" title="No records found" description="Nothing matches your current filters." />
                  )}
                </td>
              </tr>
            ) : (
              /* Data rows */
              data.map((row, ri) => (
                <tr
                  key={row.id ?? row._id ?? ri}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  role={onRowClick ? "button" : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={onRowClick ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onRowClick(row);
                    }
                  } : undefined}
                  className="yd-tr"
                  style={{
                    cursor:     onRowClick ? "pointer" : undefined,
                    background: striped && ri % 2 !== 0 ? "var(--yd-cream)" : undefined,
                    transition: "background 0.08s ease",
                  }}
                  onMouseEnter={onRowClick ? e => { e.currentTarget.style.background = "var(--yd-yellow-light)"; } : undefined}
                  onMouseLeave={onRowClick ? e => { e.currentTarget.style.background = striped && ri % 2 !== 0 ? "var(--yd-cream)" : ""; } : undefined}
                >
                  {columns.map(col => (
                    <td
                      key={col.key}
                      style={{
                        textAlign:   col.align ?? "left",
                        padding:     rowPad,
                        paddingLeft: col.align === "right" ? undefined : 14,
                        paddingRight:col.align === "right" ? 14 : undefined,
                      }}
                    >
                      {col.render
                        ? col.render(row[col.key], row, ri)
                        : (row[col.key] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {showPagination && !loading && total > 0 && (
        <div style={{
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          padding:        "8px 16px",
          borderTop:      "1px solid var(--yd-border-light)",
          background:     "var(--yd-surface)",
          flexShrink:     0,
          gap:            12,
        }}>
          <span style={{ fontSize: 11, color: "var(--yd-text-muted)", fontWeight: 500 }}>
            Showing {from}–{to} of {total}
          </span>

          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <PagBtn
              label="←"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            />
            {paginationPages(page, totalPages).map((p, i) =>
              p === "…" ? (
                <span key={`ellipsis-${i}`} style={{ padding: "0 4px", color: "var(--yd-text-muted)", fontSize: 11 }}>…</span>
              ) : (
                <PagBtn
                  key={p}
                  label={p}
                  active={p === page}
                  onClick={() => onPageChange(p)}
                />
              )
            )}
            <PagBtn
              label="→"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Pagination helpers ── */
function paginationPages(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [];
  pages.push(1);
  if (current > 3)           pages.push("…");
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p);
  if (current < total - 2)   pages.push("…");
  pages.push(total);
  return pages;
}

function PagBtn({ label, active, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        minWidth:     26,
        height:       26,
        padding:      "0 6px",
        borderRadius: "var(--yd-radius-xs)",
        border:       `1px solid ${active ? "var(--yd-yellow)" : "var(--yd-border)"}`,
        background:   active ? "var(--yd-yellow)" : disabled ? "transparent" : "var(--yd-surface)",
        color:        active ? "var(--yd-black)" : disabled ? "var(--yd-text-muted)" : "var(--yd-text-soft)",
        fontSize:     11,
        fontWeight:   active ? 800 : 600,
        cursor:       disabled ? "not-allowed" : "pointer",
        fontFamily:   "var(--yd-font)",
        opacity:      disabled ? 0.4 : 1,
        transition:   "all 0.12s ease",
      }}
    >
      {label}
    </button>
  );
}

/* ── Sort icon ── */
function SortIcon({ active, dir }) {
  const up   = active && dir === "asc";
  const down = active && dir === "desc";
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M5 1L8 4H2L5 1Z"
        fill={up ? "var(--yd-yellow)" : "var(--yd-border)"}
        stroke="none"
      />
      <path d="M5 9L2 6H8L5 9Z"
        fill={down ? "var(--yd-yellow)" : "var(--yd-border)"}
        stroke="none"
      />
    </svg>
  );
}
