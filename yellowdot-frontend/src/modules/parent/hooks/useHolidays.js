/**
 * useHolidays — fetch the school holiday calendar filtered to the child's class.
 * Pass studentId (the active child) so the backend can resolve classId and
 * filter class-specific holidays. Falls back gracefully if studentId unknown.
 * Returns { data, loading, error, reload }.
 */

import { useCallback, useEffect, useState } from "react";
import parentService from "../services/parentService";

export default function useHolidays(studentId) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await parentService.getHolidays(undefined, studentId));
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Failed to load holidays.");
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => { reload(); }, [reload]);

  return { data, loading, error, reload };
}
