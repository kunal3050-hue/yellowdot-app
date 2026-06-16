/**
 * usePTM — fetch PTMs visible to the linked child, with slot availability and booking status.
 */

import { useCallback, useEffect, useState } from "react";
import parentService from "../services/parentService";

export default function usePTM(studentId) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await parentService.getPtms(studentId));
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Failed to load PTMs.");
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => { reload(); }, [reload]);

  return { data, loading, error, reload };
}
