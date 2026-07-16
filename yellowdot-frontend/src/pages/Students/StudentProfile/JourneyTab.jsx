/**
 * JourneyTab — the canonical Timeline component replacing the old
 * attendance+pickup-only "Timeline" tab. Merges three real data sources
 * for this student: journey entries (milestones/achievements/
 * observations/activities, via the existing journeyService also used by
 * ChildJourney.jsx), attendance check-ins, and staff notes. "Incidents"
 * and "medical" event types were not included: there is no per-student
 * incident-log API and no medical-change audit trail in the backend, so
 * they were left out rather than fabricated. Chronological with a
 * category filter row.
 */
import { useState, useEffect, useMemo, useRef } from "react";
import { Star, Sparkles, StickyNote } from "lucide-react";
import { Timeline } from "../../../components/ui";
import { getEntries } from "../../../services/journeyService";
import { get } from "../shared";

const JOURNEY_EVENT_TYPES = {
  milestone: { icon: Star,       color: "var(--yd-warning)", bg: "var(--yd-warning-soft)" },
  note:      { icon: StickyNote, color: "var(--yd-text-soft)", bg: "var(--yd-soft)" },
  activity:  { icon: Sparkles,   color: "var(--yd-info)",    bg: "var(--yd-info-soft)" },
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "milestone", label: "Milestones" },
  { key: "attendance", label: "Attendance" },
  { key: "note", label: "Notes" },
  { key: "activity", label: "Activities" },
];

export default function JourneyTab({ student }) {
  const [items,   setItems  ] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter ] = useState("all");
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const sid = student.Student_ID;
    Promise.allSettled([
      getEntries({ studentId: sid }),
      get(`/api/attendance?studentId=${encodeURIComponent(sid)}`),
      get(`/api/student-notes/${encodeURIComponent(sid)}`),
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

      const all = [...journeyItems, ...attItems, ...noteItems].sort((a, b) => b.timestamp - a.timestamp);
      setItems(all);
    }).finally(() => { if (mountedRef.current) setLoading(false); });
    return () => { mountedRef.current = false; };
  }, [student.Student_ID]);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter(i => i.type === filter);
  }, [items, filter]);

  return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
      <h3 style={{ fontSize: 13, fontWeight: 800, color: "var(--yd-charcoal)" }}>Journey</h3>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            style={{
              padding: "4px 12px", fontSize: 11, fontWeight: 700, borderRadius: 999, cursor: "pointer",
              border: `1px solid ${filter === f.key ? "var(--yd-charcoal)" : "var(--yd-border)"}`,
              background: filter === f.key ? "var(--yd-charcoal)" : "var(--yd-surface)",
              color: filter === f.key ? "#fff" : "var(--yd-text-soft)",
            }}>
            {f.label}
          </button>
        ))}
      </div>

      <Timeline
        items={filtered}
        loading={loading}
        eventTypeConfig={JOURNEY_EVENT_TYPES}
        empty={{ title: "No journey entries yet", description: "Milestones, attendance, and staff notes will appear here as they happen." }}
      />
    </div>
  );
}
