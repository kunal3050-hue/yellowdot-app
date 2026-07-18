/**
 * FavouriteModules — "Quick Access": horizontal row of pinned modules
 * on Quick Navigation. Hides itself entirely when nothing is pinned
 * yet. Resolves stored ids through MODULES_BY_ID so a removed/renamed
 * module never renders a broken card.
 */
import { useAuth } from "../../../contexts/AuthContext";
import { MODULES_BY_ID } from "../modules";
import ModuleCard from "./ModuleCard";

export default function FavouriteModules({ favouriteIds, onNavigate, onToggleFavourite }) {
  const { can } = useAuth();

  const items = favouriteIds
    .map(id => MODULES_BY_ID[id])
    .filter(item => item && (!item.routeKey || can(item.routeKey)));

  if (items.length === 0) return null;

  return (
    <section className="qnd-section qnd-section--row">
      <h2 className="qnd-section-title">Quick Access</h2>
      <div className="qnd-row">
        {items.map(item => (
          <ModuleCard
            key={item.id}
            id={item.id}
            icon={item.icon}
            label={item.label}
            description={item.description}
            routeKey={item.routeKey}
            path={item.path}
            favourite
            onNavigate={onNavigate}
            onToggleFavourite={onToggleFavourite}
            compact
          />
        ))}
      </div>
    </section>
  );
}
