/**
 * renderCell.jsx — shared cell-rendering logic for both the desktop table
 * body and the mobile card view, so avatar/badge/actions/custom-render
 * columns behave identically in both layouts.
 */
import Avatar from "../Avatar";
import StatusBadge from "../StatusBadge";
import highlightMatch from "./highlightMatch";

export default function renderCell(col, value, row, index, globalFilter) {
  if (col.render) return col.render(value, row, index);

  switch (col.type) {
    case "avatar":
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Avatar name={col.avatarName ? col.avatarName(row) : String(value ?? "")} photoUrl={col.avatarPhoto?.(row)} size={28} shape="circle" />
          <span>{highlightMatch(value, globalFilter)}</span>
        </div>
      );
    case "badge":
      return <StatusBadge status={value} />;
    case "actions":
      return col.actions ? col.actions(row) : null;
    default:
      return globalFilter ? highlightMatch(value ?? "—", globalFilter) : (value ?? "—");
  }
}
