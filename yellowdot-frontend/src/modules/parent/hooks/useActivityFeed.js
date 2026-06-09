/**
 * useActivityFeed — fetch the unified, child-specific Home activity timeline.
 * Refetches whenever the selected child changes.
 * Returns { data, loading, error, reload }.
 */

import { useCallback, useEffect, useState } from "react";
import parentService from "../services/parentService";

export default function useActivityFeed(studentId) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const reload = useCallback(async () => {
    if (!studentId) { setData(null); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      setData(await parentService.getActivity(studentId));
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Failed to load your feed.");
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => { reload(); }, [reload]);

  return { data, loading, error, reload };
}
