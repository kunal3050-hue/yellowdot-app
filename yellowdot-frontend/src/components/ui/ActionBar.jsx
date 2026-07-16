import { Trash2 } from "lucide-react";
import Button from "./Button";

/**
 * ActionBar — the Standard Action Bar (CRUD + Export/Import/Refresh/Bulk toolbar)
 * ─────────────────────────────────────────────────────────────────────────
 * A row of standard-styled action buttons. Use standalone above a page's
 * main content, or pass it as `<PageHeader actions={<ActionBar .../>} />`.
 * For pages built on <DataTable>, bulk actions + export are already built
 * into DataTableToolbar — pass `bulkActions`/`exportFormats` to <DataTable>
 * directly rather than duplicating an ActionBar underneath it.
 *
 * @prop {Array}    actions           [{key, label, icon, variant, onClick, disabled}] — primary/secondary buttons (Add, Edit, Delete, Export, Import, Refresh, ...)
 * @prop {number}   selectedCount     when > 0 (and bulkActions is set), replaces `actions` with the bulk bar
 * @prop {Array}    bulkActions       [{key, label, icon, variant, onClick}] — onClick receives nothing; caller already knows the selection
 * @prop {function} onClearSelection
 * @prop {string}   className
 */
export default function ActionBar({
  actions = [],
  selectedCount = 0,
  bulkActions = [],
  onClearSelection,
  className = "",
}) {
  if (selectedCount > 0 && bulkActions.length > 0) {
    return (
      <div className={`yd-actionbar yd-actionbar--bulk ${className}`}>
        <span className="yd-actionbar-bulk-count">{selectedCount} selected</span>
        <div className="yd-actionbar-group">
          {bulkActions.map(a => (
            <button
              key={a.key || a.label}
              type="button"
              className={`yd-actionbar-btn${a.variant === "danger" ? " yd-actionbar-btn--danger" : ""}`}
              onClick={a.onClick}
            >
              {a.icon || (a.variant === "danger" ? <Trash2 size={13} strokeWidth={2} /> : null)}
              {a.label}
            </button>
          ))}
        </div>
        {onClearSelection && (
          <button type="button" className="yd-actionbar-clear" onClick={onClearSelection}>Clear selection</button>
        )}
      </div>
    );
  }

  if (!actions.length) return null;

  return (
    <div className={`yd-actionbar ${className}`}>
      <div className="yd-actionbar-group">
        {actions.map(a => (
          <Button
            key={a.key || a.label}
            variant={a.variant || "outline"}
            size="sm"
            leftIcon={a.icon}
            onClick={a.onClick}
            disabled={a.disabled}
          >
            {a.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
