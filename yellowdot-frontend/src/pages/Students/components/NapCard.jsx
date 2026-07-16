/**
 * NapCard — same endpoint as the original (/api/nap-sessions?studentId=).
 * Kept (not in the Phase 2.2 requested tab list, but preserving existing
 * functionality). Shared component -- used by the profile shell for
 * both /students and /student-profile/:id.
 */
import { useState, useEffect, useRef } from "react";
import { Moon } from "lucide-react";
import { Button, EmptyState, Skeleton } from "../../../components/ui";
import { get } from "../shared";

export default function NapCard({ student }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    get(`/api/nap-sessions?studentId=${encodeURIComponent(student.Student_ID)}`)
      .then(d => { if (mountedRef.current) setRecords(d.sessions || d.entries || []); })
      .catch(() => {})
      .finally(() => { if (mountedRef.current) setLoading(false); });
    return () => { mountedRef.current = false; };
  }, [student.Student_ID]);

  return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ fontSize: 13, fontWeight: 800, color: "var(--yd-charcoal)" }}>Nap Records</h3>
        <Button as="a" href="/nap-tracker" size="xs" variant="primary">+ Log Nap</Button>
      </div>
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={40} />)}</div>
      ) : records.length === 0 ? (
        <EmptyState size="sm" title="No nap records" description="Nap sessions will appear here." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 320, overflowY: "auto" }}>
          {records.slice(0, 40).map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, borderRadius: 10, padding: "8px 12px", border: "1px solid var(--yd-info-border)", background: "var(--yd-info-soft)" }}>
              <Moon size={14} strokeWidth={2} color="var(--yd-info)" />
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--yd-text-soft)", flex: 1 }}>{r.date || r.Date}</span>
              <span style={{ fontSize: 11, color: "var(--yd-text-muted)" }}>{r.startTime || r.Start_Time} – {r.endTime || r.End_Time}</span>
              {(r.duration || r.Duration) && <span style={{ fontSize: 10, fontWeight: 700, color: "var(--yd-info)" }}>{r.duration || r.Duration}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
