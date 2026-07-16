/**
 * JourneyTimeline — the canonical Timeline component, now backed by the
 * shared useStudentJourney hook (merges journey entries + attendance +
 * staff notes). Incidents and a medical audit trail are not included --
 * no such per-student event-log API exists in the backend. Shared
 * component -- used by the profile shell for both /students and
 * /student-profile/:id.
 */
import { useState, useMemo } from "react";
import { Star, Sparkles, StickyNote } from "lucide-react";
import { Timeline } from "../../../components/ui";
import useStudentJourney from "../hooks/useStudentJourney";

const JOURNEY_EVENT_TYPES = {
  milestone: { icon: Star,       color: "var(--yd-warning)",  bg: "var(--yd-warning-soft)" },
  note:      { icon: StickyNote, color: "var(--yd-text-soft)", bg: "var(--yd-soft)" },
  activity:  { icon: Sparkles,   color: "var(--yd-info)",     bg: "var(--yd-info-soft)" },
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "milestone", label: "Milestones" },
  { key: "attendance", label: "Attendance" },
  { key: "note", label: "Notes" },
  { key: "activity", label: "Activities" },
];

export default function JourneyTimeline({ student }) {
  const { items, loading } = useStudentJourney(student.Student_ID);
  const [filter, setFilter] = useState("all");

  const filtered = useMemo(() => (filter === "all" ? items : items.filter(i => i.type === filter)), [items, filter]);

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
