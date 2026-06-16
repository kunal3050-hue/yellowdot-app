import { useState, useEffect, useCallback } from "react";
import { getIncidents } from "../services/parentService";

export function useIncidents() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getIncidents();
      setData(result);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Failed to load incidents.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return { data, loading, error, reload };
}
