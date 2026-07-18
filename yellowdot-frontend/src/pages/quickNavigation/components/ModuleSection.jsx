/**
 * ModuleSection — a labeled group of ModuleCards on the Quick Navigation
 * Dashboard. Hides itself entirely (title included) when the current
 * user has permission for none of its items, so an empty section never
 * flashes a bare heading with no cards beneath it.
 */
import { useAuth } from "../../../contexts/AuthContext";
import ModuleCard from "./ModuleCard";

export default function ModuleSection({ section, favouriteIds, onNavigate, onToggleFavourite }) {
  const { can } = useAuth();
  const visibleItems = section.items.filter(item => !item.routeKey || can(item.routeKey));

  if (visibleItems.length === 0) return null;

  return (
    <section className="qnd-section">
      <h2 className="qnd-section-title">{section.label}</h2>
      <div className="qnd-grid">
        {visibleItems.map(item => (
          <ModuleCard
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
      </div>
    </section>
  );
}
