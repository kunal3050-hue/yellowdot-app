/**
 * useChildAttendance — fetch a child's attendance for a given month (Phase 3).
 * Refetches when studentId or month changes (drives the child switcher).
 * Returns { data, loading, error, reload }.
 */

import { useCallback, useEffect, useState } from "react";
import parentService from "../services/parentService";

export default function useChildAttendance(studentId, month) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const reload = useCallback(async () => {
    if (!studentId) { setData(null); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await parentService.getChildAttendance(studentId, month);
      setData(res);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Failed to load attendance.");
    } finally {
      setLoading(false);
    }
  }, [studentId, month]);

  useEffect(() => { reload(); }, [reload]);

  return { data, loading, error, reload };
}
