/**
 * useExpandedSections.js — remembers which Control Center categories
 * the user has expanded past their default "first row" preview.
 * Persisted to localStorage, same try/catch JSON pattern as
 * config/sidebarConfig.js's section-state helpers.
 */
import { useCallback, useState } from "react";

const LS_KEY = "yd_qn_expanded";

function readExpanded() {
  try {
    const stored = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
    return stored && typeof stored === "object" ? stored : {};
  } catch {
    return {};
  }
}

function writeExpanded(map) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(map));
  } catch { /* non-critical */ }
}

export default function useExpandedSections() {
  const [expandedMap, setExpandedMap] = useState(readExpanded);

  const toggleExpanded = useCallback((sectionId) => {
    setExpandedMap(prev => {
      const next = { ...prev, [sectionId]: !prev[sectionId] };
      writeExpanded(next);
      return next;
    });
  }, []);

  const isExpanded = useCallback((sectionId) => !!expandedMap[sectionId], [expandedMap]);

  return { isExpanded, toggleExpanded };
}
