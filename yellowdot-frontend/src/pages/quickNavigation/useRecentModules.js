/**
 * useRecentModules.js — tracks the last 5 modules visited from Quick
 * Navigation, persisted to localStorage. Same try/catch JSON pattern as
 * config/sidebarConfig.js's section-state helpers.
 */
import { useCallback, useState } from "react";

const LS_KEY   = "yd_qn_recent";
const MAX_SIZE = 5;

function readRecent() {
  try {
    const stored = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function writeRecent(ids) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(ids));
  } catch { /* non-critical */ }
}

export default function useRecentModules() {
  const [recentIds, setRecentIds] = useState(readRecent);

  const recordVisit = useCallback((moduleId) => {
    setRecentIds(prev => {
      const next = [moduleId, ...prev.filter(id => id !== moduleId)].slice(0, MAX_SIZE);
      writeRecent(next);
      return next;
    });
  }, []);

  return { recentIds, recordVisit };
}
