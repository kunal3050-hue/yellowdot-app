/**
 * ModuleSection — a labeled, colour-coded group of modules on the Quick
 * Navigation Dashboard. Hides itself entirely (title included) when the
 * current user has permission for none of its items, so an empty
 * section never flashes a bare heading with no cards beneath it.
 *
 * Three states, in priority order:
 *  1. Active search — shows every matching item (label/description),
 *     ignoring the collapse limit entirely; hides the whole section if
 *     nothing matches. Matching text is highlighted via highlightQuery.
 *  2. Collapsed (default) — shows only the first COLLAPSE_LIMIT items
 *     when there are more than that, with a "Show N more" toggle.
 *  3. Expanded — every item, remembered per-category via
 *     useExpandedSections so it survives a reload.
 *
 * Renders as a card grid (ModuleCard) or a compact row list
 * (ModuleListItem) depending on `view` — same data, same RBAC gate,
 * same navigate/pin/drag callbacks either way.
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import ModuleCard from "./ModuleCard";
import ModuleListItem from "./ModuleListItem";

const COLLAPSE_LIMIT = 4;

export default function ModuleSection({
  section,
  favouriteIds,
  onNavigate,
  onToggleFavourite,
  view = "grid",
  searchQuery = "",
  isExpanded,
  onToggleExpanded,
}) {
  const { can } = useAuth();
  const [hoverHeader, setHoverHeader] = useState(false);

  const q = searchQuery.trim().toLowerCase();
  const searching = q.length > 0;

  const permitted = section.items.filter(item => !item.routeKey || can(item.routeKey));
  const visibleItems = searching
    ? permitted.filter(item =>
        item.label.toLowerCase().includes(q) || item.description.toLowerCase().includes(q))
    : permitted;

  if (visibleItems.length === 0) return null;

  const expanded = isExpanded(section.id);
  const canCollapse = !searching && visibleItems.length > COLLAPSE_LIMIT;
  const itemsToRender = canCollapse && !expanded ? visibleItems.slice(0, COLLAPSE_LIMIT) : visibleItems;

  const ItemComponent = view === "list" ? ModuleListItem : ModuleCard;
  const HeaderIcon = section.items[0]?.icon;
  const accent = section.accent;

  return (
    <section className="qnd-section">
      <div
        className={`qnd-section-header${hoverHeader ? " qnd-section-header--active" : ""}`}
        style={accent ? { "--qnd-header-accent": accent.icon } : undefined}
        onMouseEnter={() => setHoverHeader(true)}
        onMouseLeave={() => setHoverHeader(false)}
      >
        <span className="qnd-section-header-left">
          {HeaderIcon && (
            <span className="qnd-section-icon" style={accent ? { background: accent.bg, color: accent.icon } : undefined}>
              <HeaderIcon size={15} strokeWidth={2} />
            </span>
          )}
          <h2 className="qnd-section-title">{section.label}</h2>
          <span className="qnd-section-count">{visibleItems.length}</span>
        </span>

        {canCollapse && (
          <button
            type="button"
            className="qnd-section-toggle"
            onClick={() => onToggleExpanded(section.id)}
            aria-expanded={expanded}
          >
            {expanded ? "Show less" : `Show ${visibleItems.length - COLLAPSE_LIMIT} more`}
            <ChevronDown size={14} strokeWidth={2} className={`qnd-section-chevron${expanded ? " qnd-section-chevron--open" : ""}`} />
          </button>
        )}
      </div>

      <motion.div
        key={`${view}-${searching}-${expanded}`}
        className={view === "list" ? "qnd-list" : "qnd-grid"}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.16 }}
      >
        {itemsToRender.map(item => (
          <ItemComponent
            key={item.id}
            id={item.id}
            icon={item.icon}
            label={item.label}
            description={item.description}
            routeKey={item.routeKey}
            accent={accent}
            path={item.path}
            favourite={favouriteIds.includes(item.id)}
            onNavigate={onNavigate}
            onToggleFavourite={onToggleFavourite}
            highlightQuery={searching ? searchQuery : ""}
          />
        ))}
      </motion.div>
    </section>
  );
}
