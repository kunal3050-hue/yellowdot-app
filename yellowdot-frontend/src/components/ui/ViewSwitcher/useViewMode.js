/**
 * useViewMode — persists a module's chosen view mode (grid/list/table/...)
 * to localStorage, keyed per module so each collection module remembers
 * its own preference independently. Same try/catch JSON-free string
 * pattern as config/sidebarConfig.js's section-state helpers (the value
 * is a plain string, no JSON needed).
 *
 * @param {string} moduleKey   unique key for the module, e.g. "quick_navigation"
 * @param {string} defaultMode initial mode if nothing is stored yet
 * @returns {[string, function]} [mode, setMode] — setMode persists as it sets
 */
import { useCallback, useState } from "react";

const LS_PREFIX = "yd_view_";

function readViewMode(moduleKey, defaultMode) {
  try {
    return localStorage.getItem(LS_PREFIX + moduleKey) || defaultMode;
  } catch {
    return defaultMode;
  }
}

export default function useViewMode(moduleKey, defaultMode = "grid") {
  const [mode, setModeState] = useState(() => readViewMode(moduleKey, defaultMode));

  const setMode = useCallback((next) => {
    setModeState(next);
    try { localStorage.setItem(LS_PREFIX + moduleKey, next); } catch { /* non-critical */ }
  }, [moduleKey]);

  return [mode, setMode];
}
