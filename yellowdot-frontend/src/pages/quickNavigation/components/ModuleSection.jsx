/**
 * ModuleSection — a labeled group of modules on the Quick Navigation
 * Dashboard. Hides itself entirely (title included) when the current
 * user has permission for none of its items, so an empty section never
 * flashes a bare heading with no cards beneath it.
 *
 * Renders as a card grid (ModuleCard) or a compact row list
 * (ModuleListItem) depending on `view` — same data, same RBAC gate,
 * same navigate/pin callbacks either way. Switching `view` remounts
 * the container (keyed on `view`) so the fade-in replays, giving a
 * smooth transition without gating correctness on an exit animation
 * (see Wizard's documented lesson in KUE_BOXS_DESIGN_SYSTEM.md §13).
 */
import { motion } from "framer-motion";
import { useAuth } from "../../../contexts/AuthContext";
import ModuleCard from "./ModuleCard";
import ModuleListItem from "./ModuleListItem";

export default function ModuleSection({ section, favouriteIds, onNavigate, onToggleFavourite, view = "grid" }) {
  const { can } = useAuth();
  const visibleItems = section.items.filter(item => !item.routeKey || can(item.routeKey));

  if (visibleItems.length === 0) return null;

  const ItemComponent = view === "list" ? ModuleListItem : ModuleCard;

  return (
    <section className="qnd-section">
      <h2 className="qnd-section-title">{section.label}</h2>
      <motion.div
        key={view}
        className={view === "list" ? "qnd-list" : "qnd-grid"}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.16 }}
      >
        {visibleItems.map(item => (
          <ItemComponent
            key={item.id}
            id={item.id}
            icon={item.icon}
            label={item.label}
            description={item.description}
            routeKey={item.routeKey}
            path={item.path}
            favourite={favouriteIds.includes(item.id)}
            onNavigate={onNavigate}
            onToggleFavourite={onToggleFavourite}
          />
        ))}
      </motion.div>
    </section>
  );
}
