/**
 * Quick Navigation Dashboard — src/pages/quickNavigation/
 * ─────────────────────────────────────────────────────────────────────
 * Premium landing page shown right after login (see RootRedirect in
 * App.jsx). Pure navigation surface: a greeting, a search box, a row of
 * recently-visited modules, a row of pinned favourites, and every module
 * the current user has access to, grouped by section. No business logic
 * lives here — every card links to an existing route; visibility is
 * gated purely by the same can(routeKey) RBAC check used app-wide.
 */
import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { SECTIONS } from "./modules";
import useRecentModules from "./useRecentModules";
import useFavouriteModules from "./useFavouriteModules";
import ModuleSection from "./components/ModuleSection";
import QuickSearch from "./components/QuickSearch";
import RecentModules from "./components/RecentModules";
import FavouriteModules from "./components/FavouriteModules";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
function firstName(name) {
  return (name || "").trim().split(/\s+/)[0] || "";
}
function todayLabel() {
  return new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

export default function QuickNavigation() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { recentIds, recordVisit } = useRecentModules();
  const { favouriteIds, toggleFavourite } = useFavouriteModules();

  const handleNavigate = useCallback((id, path) => {
    recordVisit(id);
    navigate(path);
  }, [recordVisit, navigate]);

  return (
    <div className="qnd-root">
      <header className="qnd-hero">
        <p className="qnd-hero-greeting">
          {getGreeting()}{user?.name ? `, ${firstName(user.name)}` : ""} 👋
        </p>
        <h1 className="qnd-hero-title">Quick Navigation</h1>
        <p className="qnd-hero-date">{todayLabel()}</p>

        <div className="qnd-hero-search">
          <QuickSearch onNavigate={handleNavigate} />
        </div>
      </header>

      <RecentModules
        recentIds={recentIds}
        favouriteIds={favouriteIds}
        onNavigate={handleNavigate}
        onToggleFavourite={toggleFavourite}
      />

      <FavouriteModules
        favouriteIds={favouriteIds}
        onNavigate={handleNavigate}
        onToggleFavourite={toggleFavourite}
      />

      {SECTIONS.map(section => (
        <ModuleSection
          key={section.id}
          section={section}
          favouriteIds={favouriteIds}
          onNavigate={handleNavigate}
          onToggleFavourite={toggleFavourite}
        />
      ))}
    </div>
  );
}
