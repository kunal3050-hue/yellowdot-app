/**
 * FavouriteModules — "Quick Access": horizontal row of pinned modules
 * on Quick Navigation. Resolves stored ids through MODULES_BY_ID so a
 * removed/renamed module never renders a broken card.
 *
 * Doubles as a drop zone: dragging any ModuleCard/ModuleListItem here
 * pins it (same effect as clicking its star). Drag is a mouse-only
 * progressive enhancement — the star button remains the accessible,
 * keyboard-operable way to pin/unpin.
 */
import { useState } from "react";
import { Pin } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { MODULES_BY_ID } from "../modules";
import ModuleCard from "./ModuleCard";

export default function FavouriteModules({ favouriteIds, onNavigate, onToggleFavourite, onPin }) {
  const { can } = useAuth();
  const [dragOver, setDragOver] = useState(false);

  const items = favouriteIds
    .map(id => MODULES_BY_ID[id])
    .filter(item => item && (!item.routeKey || can(item.routeKey)));

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDragOver(true);
  }
  function handleDragLeave() {
    setDragOver(false);
  }
  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const id = e.dataTransfer.getData("text/x-yd-module-id");
    if (id) onPin(id);
  }

  return (
    <section
      className={`qnd-section qnd-section--row qnd-quickaccess${dragOver ? " qnd-quickaccess--dragover" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <h2 className="qnd-section-title">Quick Access</h2>
      {items.length === 0 ? (
        <div className="qnd-quickaccess-empty">
          <Pin size={15} strokeWidth={2} />
          Drag a module here, or click its star, to pin it
        </div>
      ) : (
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
              favourite
              onNavigate={onNavigate}
              onToggleFavourite={onToggleFavourite}
              compact
            />
          ))}
        </div>
      )}
    </section>
  );
}
