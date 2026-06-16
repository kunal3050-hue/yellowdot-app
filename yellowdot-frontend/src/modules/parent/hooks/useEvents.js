/**
 * useEvents — fetch school events filtered to the child's class.
 * Returns { data, loading, error, reload }.
 */

import { useCallback, useEffect, useState } from "react";
import parentService from "../services/parentService";

export default function useEvents(studentId) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await parentService.getEvents(studentId));
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Failed to load events.");
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => { reload(); }, [reload]);

  return { data, loading, error, reload };
}
