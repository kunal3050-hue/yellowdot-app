/**
 * useAutosaveDraft — localStorage-backed autosave + draft recovery for Wizard.
 * Debounced writes on every value change; exposes the saved draft (if any)
 * so the caller can offer "Resume draft?" before the form mounts with it.
 */
import { useEffect, useRef, useState } from "react";

function readDraft(key) {
  if (!key || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function useAutosaveDraft(key, values, { debounceMs = 600, paused = false } = {}) {
  const [draft] = useState(() => readDraft(key));
  const timerRef = useRef(null);

  useEffect(() => {
    if (!key || paused) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        window.localStorage.setItem(key, JSON.stringify(values));
      } catch {
        /* storage unavailable/full — autosave is best-effort */
      }
    }, debounceMs);
    return () => clearTimeout(timerRef.current);
  }, [key, values, debounceMs, paused]);

  function clearDraft() {
    if (!key) return;
    clearTimeout(timerRef.current);
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }

  return { draft, clearDraft };
}
