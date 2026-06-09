/**
 * useFoodMenu — fetch the food menu for a date (Daily Care · Food Menu).
 * Pass a date (YYYY-MM-DD) or undefined for the latest. Refetches on change.
 * Returns { data, loading, error, reload }.
 */

import { useCallback, useEffect, useState } from "react";
import parentService from "../services/parentService";

export default function useFoodMenu(date) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await parentService.getFoodMenu(date));
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Failed to load food menu.");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { reload(); }, [reload]);

  return { data, loading, error, reload };
}
