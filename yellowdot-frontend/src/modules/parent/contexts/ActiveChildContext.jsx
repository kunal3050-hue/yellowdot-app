/**
 * ActiveChildContext — global active child selection for the Parent Module.
 *
 * When a parent has multiple children, every parent screen should show data
 * for the currently-selected child. This context persists the selection in
 * localStorage so it survives page refreshes.
 *
 * Usage:
 *   const { activeId, setActiveId, children } = useActiveChild();
 */

import { createContext, useContext, useState, useEffect, useMemo } from "react";
import useParentProfile from "../hooks/useParentProfile";

const LS_KEY = "yd_active_child";

const ActiveChildContext = createContext({
  activeId:    null,
  setActiveId: () => {},
  activeChild: null,
  children:    [],
  loading:     true,
});

export function ActiveChildProvider({ children: reactChildren }) {
  const { children, loading } = useParentProfile();

  const [activeId, setActiveIdState] = useState(() => {
    try { return localStorage.getItem(LS_KEY) || null; } catch { return null; }
  });

  // Auto-select first child when children load or the stored id is gone
  useEffect(() => {
    if (loading || !children.length) return;
    const stillValid = children.some(c => c.studentId === activeId);
    if (!stillValid && children.length > 0) {
      const first = children[0].studentId;
      setActiveIdState(first);
      try { localStorage.setItem(LS_KEY, first); } catch { /* non-critical */ }
    }
  }, [children, loading, activeId]);

  function setActiveId(id) {
    setActiveIdState(id);
    try { localStorage.setItem(LS_KEY, id); } catch { /* non-critical */ }
  }

  const activeChild = useMemo(
    () => children.find(c => c.studentId === activeId) || children[0] || null,
    [children, activeId],
  );

  return (
    <ActiveChildContext.Provider value={{ activeId: activeChild?.studentId || null, setActiveId, activeChild, children, loading }}>
      {reactChildren}
    </ActiveChildContext.Provider>
  );
}

export function useActiveChild() {
  return useContext(ActiveChildContext);
}

export default ActiveChildContext;
