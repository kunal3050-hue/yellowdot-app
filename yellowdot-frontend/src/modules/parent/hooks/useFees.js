/**
 * useFees — fetch fees (summary + invoices + payments) for linked children.
 * Pass a studentId to scope to one child, or undefined for all.
 * Returns { data, loading, error, reload }.
 */

import { useCallback, useEffect, useState } from "react";
import parentService from "../services/parentService";

export default function useFees(studentId) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await parentService.getFees(studentId);
      setData(res);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Failed to load fees.");
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => { reload(); }, [reload]);

  return { data, loading, error, reload };
}
