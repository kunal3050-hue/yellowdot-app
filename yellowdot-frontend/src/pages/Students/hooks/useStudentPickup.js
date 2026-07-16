/**
 * useStudentPickup — authorized persons (/api/pickup-authorization) +
 * pickup history (/api/pickup-history). Same endpoints as the original
 * inline PickupAuthTab/TimelineTab logic.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { get, del } from "../shared";

export default function useStudentPickup(studentId, toast) {
  const [persons,        setPersons       ] = useState([]);
  const [history,        setHistory       ] = useState([]);
  const [loading,        setLoading       ] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const mountedRef = useRef(true);

  const loadPersons = useCallback(() => {
    setLoading(true);
    get(`/api/pickup-authorization?studentId=${encodeURIComponent(studentId)}`)
      .then(d => { if (mountedRef.current) setPersons(d.entries || []); })
      .catch(() => {})
      .finally(() => { if (mountedRef.current) setLoading(false); });
  }, [studentId]);

  useEffect(() => {
    mountedRef.current = true;
    loadPersons();
    setHistoryLoading(true);
    get(`/api/pickup-history?studentId=${encodeURIComponent(studentId)}&limit=30`)
      .then(d => { if (mountedRef.current) setHistory(d.entries || []); })
      .catch(() => {})
      .finally(() => { if (mountedRef.current) setHistoryLoading(false); });
    return () => { mountedRef.current = false; };
  }, [loadPersons, studentId]);

  async function removePerson(id, name) {
    try {
      const r = await del(`/api/pickup-authorization/${id}`);
      if (r.success) { toast?.success(`${name} removed.`); loadPersons(); }
      else toast?.error(r.error || "Failed.");
    } catch { toast?.error("Error removing."); }
  }

  return { persons, history, loading, historyLoading, removePerson };
}
