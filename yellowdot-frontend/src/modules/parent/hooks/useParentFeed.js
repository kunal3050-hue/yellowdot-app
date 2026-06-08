/**
 * useParentFeed — fetch the parent Home Feed (Phase 2).
 * Returns { feed, loading, error, reload }.
 */

import { useCallback, useEffect, useState } from "react";
import parentService from "../services/parentService";

export default function useParentFeed() {
  const [feed,    setFeed]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await parentService.getFeed();
      setFeed(Array.isArray(data.feed) ? data.feed : []);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Failed to load feed.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return { feed, loading, error, reload };
}
