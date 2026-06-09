/**
 * useHolidays — fetch the school holiday calendar (Daily Care · Holidays).
 * Fetches the full calendar once (school-scoped); the calendar view browses
 * months client-side. Returns { data, loading, error, reload }.
 */

import { useCallback, useEffect, useState } from "react";
import parentService from "../services/parentService";

export default function useHolidays() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await parentService.getHolidays());
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Failed to load holidays.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return { data, loading, error, reload };
}
