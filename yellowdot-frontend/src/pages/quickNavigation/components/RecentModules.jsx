/**
 * RecentModules — "Recent Activity": horizontal row of the last 5
 * modules visited from Control Center. Hides itself entirely when
 * there's no history yet. Resolves stored ids through MODULES_BY_ID so
 * a removed/renamed module never renders a broken card.
 */
import { useAuth } from "../../../contexts/AuthContext";
import { MODULES_BY_ID } from "../modules";
import ModuleCard from "./ModuleCard";

export default function RecentModules({ recentIds, favouriteIds, onNavigate, onToggleFavourite }) {
  const { can } = useAuth();

  const items = recentIds
    .map(id => MODULES_BY_ID[id])
    .filter(item => item && (!item.routeKey || can(item.routeKey)));

  if (items.length === 0) return null;

  return (
    <section className="qnd-section qnd-section--row">
      <h2 className="qnd-section-title">Recent Activity</h2>
      <div className="qnd-row">
        {items.map(item => (
          <ModuleCard
            key={item.id}
            id={item.id}
            icon={item.icon}
            label={item.label}
            description={item.description}
            routeKey={item.routeKey}
            accent={item.accent}
            path={item.path}
            favourite={favouriteIds.includes(item.id)}
            onNavigate={onNavigate}
            onToggleFavourite={onToggleFavourite}
            compact
          />
        ))}
      </div>
    </section>
  );
}
