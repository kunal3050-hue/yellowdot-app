/**
 * useStudentJourney — merges three real sources into one chronological
 * feed: journey entries (existing journeyService, also used by
 * ChildJourney.jsx), attendance check-ins, and staff notes. Same sources
 * as the original inline JourneyTab logic. "Incidents" and a medical
 * audit trail are not included -- no per-student incident-log API or
 * medical-change audit trail exists in the backend.
 */
import { useState, useEffect, useRef } from "react";
import { getEntries } from "../../../services/journeyService";
import { get } from "../shared";

export default function useStudentJourney(studentId) {
  const [items,   setItems  ] = useState([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    Promise.allSettled([
      getEntries({ studentId }),
      get(`/api/attendance?studentId=${encodeURIComponent(studentId)}`),
      get(`/api/student-notes/${encodeURIComponent(studentId)}`),
    ]).then(([journeyRes, attRes, notesRes]) => {
      if (!mountedRef.current) return;

      const journeyItems = (journeyRes.value?.entries || []).map(e => ({
        id: `journey-${e.id}`,
        type: e.kind === "milestone" || e.kind === "achievement" ? "milestone" : "activity",
        title: e.kind === "milestone" ? (e.milestoneTitle || "Milestone reached")
             : e.kind === "achievement" ? "Achievement"
             : e.kind === "observation" ? "Observation logged"
             : e.kind === "artwork" ? "Artwork added"
             : "Activity logged",
        description: e.observationText || e.caption || e.artworkTitle || undefined,
        timestamp: e.date ? new Date(`${e.date}T00:00:00`).getTime() : Date.now(),
        expandable: !!(e.observationText || e.caption),
        details: e.observationText || e.caption,
      }));

      const attItems = (attRes.value?.entries || []).map((e, i) => ({
        id: `att-${e.date || i}`,
        type: "attendance",
        title: e.status === "Present" ? "Checked in" : e.status === "Absent" ? "Absent" : "Late arrival",
        description: e.checkIn ? `In: ${e.checkIn}${e.checkOut ? ` · Out: ${e.checkOut}` : ""}` : undefined,
        timestamp: e.timestamp ? new Date(e.timestamp).getTime() : (e.date ? new Date(`${e.date}T00:00:00`).getTime() : Date.now()),
      }));

      const noteItems = (notesRes.value?.notes || []).map(n => ({
        id: `note-${n.noteId}`,
        type: "note",
        title: "Staff note added",
        description: n.note,
        timestamp: n.createdAt ? new Date(n.createdAt).getTime() : Date.now(),
      }));

      setItems([...journeyItems, ...attItems, ...noteItems].sort((a, b) => b.timestamp - a.timestamp));
    }).finally(() => { if (mountedRef.current) setLoading(false); });
    return () => { mountedRef.current = false; };
  }, [studentId]);

  return { items, loading };
}
