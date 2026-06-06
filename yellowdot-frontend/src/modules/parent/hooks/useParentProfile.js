/**
 * useParentProfile — fetch the authenticated parent's profile + children.
 * Returns { parent, children, loading, error, reload }.
 */

import { useCallback, useEffect, useState } from "react";
import parentService from "../services/parentService";

export default function useParentProfile() {
  const [parent,   setParent]   = useState(null);
  const [children, setChildren] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await parentService.getParentProfile();
      setParent(data.parent || null);
      setChildren(data.children || []);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Failed to load profile.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return { parent, children, loading, error, reload };
}
