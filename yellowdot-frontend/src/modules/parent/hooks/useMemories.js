/**
 * useMemories — fetch memories for linked children (Phase 4).
 * Pass a studentId to filter to one child, or undefined for all.
 * Returns { memories, loading, error, reload }.
 */

import { useCallback, useEffect, useState } from "react";
import parentService from "../services/parentService";

export default function useMemories(studentId) {
  const [memories, setMemories] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await parentService.getMemories(studentId);
      setMemories(Array.isArray(data.memories) ? data.memories : []);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Failed to load memories.");
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => { reload(); }, [reload]);

  return { memories, loading, error, reload };
}
