/**
 * Control Center — src/pages/quickNavigation/
 * ─────────────────────────────────────────────────────────────────────
 * The operational home of KUE BOXS Care, shown right after login (see
 * RootRedirect in App.jsx) — not a navigation menu but the answer to
 * "what's happening today, what needs attention, what can I do next,
 * where is everything." Top to bottom: a greeting, a row of one-tap
 * Quick Actions, global search, Today's Overview metrics, Quick Access
 * (pinned favourites), Recent Activity, then every module the current
 * user has access to, grouped into categories that mirror how a
 * preschool owner actually thinks about the business. No business
 * logic lives here — every card links to an existing route; visibility
 * is gated purely by the same can(routeKey) RBAC check used app-wide.
 *
 * Renamed from "Quick Navigation" to "Control Center" (page title,
 * sidebar label) without touching the route (still /quick-navigation),
 * folder name, CSS class prefix (qnd-), or localStorage keys — all
 * internal identifiers, stable on purpose so pinned/recent/expanded/
 * view-mode preferences a user already set aren't silently reset by a
 * naming change. The old, unrelated /quick-nav legacy page (QuickNav.jsx)
 * still says "Quick Navigation" and is left alone, per the standing
 * "preserve all existing routes" rule from when this page was built.
 */
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { ViewSwitcher, useViewMode } from "../../components/ui";
import { SECTIONS } from "./modules";
import useRecentModules from "./useRecentModules";
import useFavouriteModules from "./useFavouriteModules";
import useExpandedSections from "./useExpandedSections";
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
  const { favouriteIds, toggleFavourite, pinFavourite } = useFavouriteModules();
  const { isExpanded, toggleExpanded } = useExpandedSections();
  const [view, setView] = useViewMode("quick_navigation", "grid");
  const [searchQuery, setSearchQuery] = useState("");

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
        <h1 className="qnd-hero-title">Control Center</h1>
        <p className="qnd-hero-subtitle">Everything you need to run your preschool, in one place.</p>
        <p className="qnd-hero-date">{todayLabel()}</p>
      </header>

      <QuickActions />

      <div className="qnd-hero-search">
        <QuickSearch query={searchQuery} onQueryChange={setSearchQuery} onNavigate={handleNavigate} />
      </div>

      <DashboardMetrics />

      <FavouriteModules
        favouriteIds={favouriteIds}
        onNavigate={handleNavigate}
        onToggleFavourite={toggleFavourite}
        onPin={pinFavourite}
      />

      <RecentModules
        recentIds={recentIds}
        favouriteIds={favouriteIds}
        onNavigate={handleNavigate}
        onToggleFavourite={toggleFavourite}
      />

      <div className="qnd-viewrow">
        <span className="qnd-viewrow-label">Workspace</span>
        <ViewSwitcher modes={["grid", "list"]} value={view} onChange={setView} />
      </div>

      {SECTIONS.map(section => (
        <ModuleSection
          key={section.id}
          section={section}
          favouriteIds={favouriteIds}
          onNavigate={handleNavigate}
          onToggleFavourite={toggleFavourite}
          view={view}
          searchQuery={searchQuery}
          isExpanded={isExpanded}
          onToggleExpanded={toggleExpanded}
        />
      ))}
    </div>
  );
}
