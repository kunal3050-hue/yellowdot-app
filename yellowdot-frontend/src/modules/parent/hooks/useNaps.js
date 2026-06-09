/**
 * useNaps — fetch a child's naps for a date (Daily Care · Nap Tracker).
 * Refetches when studentId or date changes.
 * Returns { data, loading, error, reload }.
 */

import { useCallback, useEffect, useState } from "react";
import parentService from "../services/parentService";

export default function useNaps(studentId, date) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await parentService.getNaps(studentId, date));
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Failed to load nap tracker.");
    } finally {
      setLoading(false);
    }
  }, [studentId, date]);

  useEffect(() => { reload(); }, [reload]);

  return { data, loading, error, reload };
}
