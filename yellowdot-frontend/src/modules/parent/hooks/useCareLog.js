/**
 * useCareLog — fetch a child's Care & Hygiene logs for a date.
 * Returns { data, loading, error, reload }.
 */

import { useCallback, useEffect, useState } from "react";
import { getCareLog } from "../services/parentService";

export default function useCareLog(studentId, date) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getCareLog(studentId, date));
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Failed to load care log.");
    } finally {
      setLoading(false);
    }
  }, [studentId, date]);

  useEffect(() => { reload(); }, [reload]);

  return { data, loading, error, reload };
}
