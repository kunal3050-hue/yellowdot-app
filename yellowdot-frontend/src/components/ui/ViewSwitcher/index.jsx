/**
 * ViewSwitcher — KUE BOXS Design System v2 canonical view-mode toggle.
 * ═══════════════════════════════════════════════════════════════════════
 * The single reusable control for switching how a collection module
 * (Quick Navigation, Students, Staff, Invoices, Documents, ...)
 * presents its data. Pair with `useViewMode()` for localStorage
 * persistence per module.
 *
 * The component is presentation-only: it doesn't know how to render
 * grid vs. list vs. table itself — the calling page owns that, keyed
 * off the same `value`. That keeps ViewSwitcher trivially reusable
 * across modules whose "card" and "row" look nothing alike.
 *
 * @prop {string[]} modes     which view modes to offer, in display order.
 *                             Supported keys: grid | list | table | kanban |
 *                             calendar | timeline | gallery
 * @prop {string}   value     the active mode
 * @prop {function} onChange  (mode) => void
 * @prop {string}   className
 */
import { LayoutGrid, List, Table, Kanban, CalendarDays, Waypoints, GalleryHorizontal } from "lucide-react";

const ICON = {
  grid: LayoutGrid,
  list: List,
  table: Table,
  kanban: Kanban,
  calendar: CalendarDays,
  timeline: Waypoints,
  gallery: GalleryHorizontal,
};

const LABEL = {
  grid: "Grid",
  list: "List",
  table: "Table",
  kanban: "Kanban",
  calendar: "Calendar",
  timeline: "Timeline",
  gallery: "Gallery",
};

export default function ViewSwitcher({ modes = ["grid", "list"], value, onChange, className = "" }) {
  return (
    <div className={`yd-viewswitcher ${className}`} role="tablist" aria-label="View mode">
      {modes.map(mode => {
        const Icon = ICON[mode];
        const active = value === mode;
        return (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={`${LABEL[mode] || mode} view`}
            title={`${LABEL[mode] || mode} view`}
            className={`yd-viewswitcher-btn${active ? " yd-viewswitcher-btn--active" : ""}`}
            onClick={() => onChange(mode)}
          >
            {Icon && <Icon size={15} strokeWidth={2} />}
          </button>
        );
      })}
    </div>
  );
}
