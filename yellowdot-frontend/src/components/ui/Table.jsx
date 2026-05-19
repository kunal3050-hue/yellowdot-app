import EmptyState from "./EmptyState";
import Skeleton from "./Skeleton";

/**
 * Table — data table with optional loading + empty state
 *
 * @prop {Array}    columns     [{key, label, render?, width?, align?, sortable?}]
 * @prop {Array}    data        row objects
 * @prop {boolean|number} loading  true = 5 skeleton rows, number = that many rows
 * @prop {function} onRowClick  (row) => void — adds pointer + hover highlight
 * @prop {object}   empty       EmptyState props ({ icon, title, description, action })
 * @prop {string}   className
 */
export default function Table({
  columns = [],
  data = [],
  loading = false,
  onRowClick,
  empty,
  className = "",
}) {
  const skeletonRows = typeof loading === "number" ? loading : 5;

  return (
    <div className={`yd-table-wrap ${className}`}>
      <table className="yd-table">
        <thead>
          <tr>
            {columns.map(col => (
              <th
                key={col.key}
                style={{
                  width: col.width,
                  textAlign: col.align ?? "left",
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {loading ? (
            /* Skeleton rows */
            Array.from({ length: skeletonRows }).map((_, ri) => (
              <tr key={ri}>
                {columns.map(col => (
                  <td key={col.key}>
                    <Skeleton height={13} width={col.skeletonWidth ?? "80%"} />
                  </td>
                ))}
              </tr>
            ))
          ) : data.length === 0 ? (
            /* Empty state spans all columns */
            <tr>
              <td colSpan={columns.length} style={{ padding: 0, borderBottom: "none" }}>
                {empty ? (
                  <EmptyState {...empty} />
                ) : (
                  <EmptyState
                    icon="📋"
                    title="No records found"
                    description="There's nothing here yet."
                  />
                )}
              </td>
            </tr>
          ) : (
            /* Data rows */
            data.map((row, ri) => (
              <tr
                key={row.id ?? ri}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                style={{ cursor: onRowClick ? "pointer" : undefined }}
              >
                {columns.map(col => (
                  <td
                    key={col.key}
                    style={{ textAlign: col.align ?? "left" }}
                  >
                    {col.render
                      ? col.render(row[col.key], row)
                      : row[col.key] ?? "—"}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
