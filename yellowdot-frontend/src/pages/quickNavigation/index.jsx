/**
 * Quick Navigation Dashboard — src/pages/quickNavigation/
 * ─────────────────────────────────────────────────────────────────────
 * Premium landing page shown right after login (see RootRedirect in
 * App.jsx). Pure navigation surface, top to bottom: a greeting, a row
 * of one-tap Quick Actions, global search, "Today at a Glance" metrics,
 * Quick Access (pinned favourites), Recent, then every module the
 * current user has access to, grouped into categories that mirror how
 * a preschool owner actually thinks about the business. No business
 * logic lives here — every card links to an existing route; visibility
 * is gated purely by the same can(routeKey) RBAC check used app-wide.
 */
import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { SECTIONS } from "./modules";
import useRecentModules from "./useRecentModules";
import useFavouriteModules from "./useFavouriteModules";
import ModuleSection from "./components/ModuleSection";
import QuickActions from "./components/QuickActions";
import QuickSearch from "./components/QuickSearch";
import DashboardMetrics from "./components/DashboardMetrics";
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
      </header>

      <QuickActions />

      <div className="qnd-hero-search">
        <QuickSearch onNavigate={handleNavigate} />
      </div>

      <DashboardMetrics />

      <FavouriteModules
        favouriteIds={favouriteIds}
        onNavigate={handleNavigate}
        onToggleFavourite={toggleFavourite}
      />

      <RecentModules
        recentIds={recentIds}
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
