/**
 * useFavouriteModules.js — pin/unpin modules on Quick Navigation,
 * persisted to localStorage. Same try/catch JSON pattern as
 * config/sidebarConfig.js's section-state helpers.
 */
import { useCallback, useState } from "react";

const LS_KEY = "yd_qn_favourites";

function readFavourites() {
  try {
    const stored = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function writeFavourites(ids) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(ids));
  } catch { /* non-critical */ }
}

export default function useFavouriteModules() {
  const [favouriteIds, setFavouriteIds] = useState(readFavourites);

  const toggleFavourite = useCallback((moduleId) => {
    setFavouriteIds(prev => {
      const next = prev.includes(moduleId)
        ? prev.filter(id => id !== moduleId)
        : [...prev, moduleId];
      writeFavourites(next);
      return next;
    });
  }, []);

  const isFavourite = useCallback((moduleId) => favouriteIds.includes(moduleId), [favouriteIds]);

  return { favouriteIds, toggleFavourite, isFavourite };
}
