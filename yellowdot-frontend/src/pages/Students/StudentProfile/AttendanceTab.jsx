/**
 * AttendanceTab — same endpoint as the original (/api/attendance?studentId=),
 * rebuilt with KpiCard summary + a monthly trend BarChart (computed
 * client-side from the real entries -- no new API). A calendar heatmap
 * and "early pickups" were not added: no heatmap primitive exists yet and
 * there's no defined threshold for "early" checkout in the data, so both
 * were left out rather than fabricated.
 */
import { useState, useEffect, useRef, useMemo } from "react";
import { KpiCard, BarChart, StatusBadge, EmptyState, Skeleton } from "../../../components/ui";
import { get } from "../shared";

export default function AttendanceTab({ student }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    get(`/api/attendance?studentId=${encodeURIComponent(student.Student_ID)}&date=`)
      .then(d => { if (mountedRef.current) setEntries(d.entries || []); })
      .catch(() => {})
      .finally(() => { if (mountedRef.current) setLoading(false); });
    return () => { mountedRef.current = false; };
  }, [student.Student_ID]);

  const total   = entries.length;
  const present = entries.filter(e => e.status === "Present").length;
  const absent  = entries.filter(e => e.status === "Absent").length;
  const late    = entries.filter(e => e.status === "Late").length;
  const pct     = total ? Math.round((present / total) * 100) : 0;

  const checkIns = entries.filter(e => e.checkIn).map(e => e.checkIn);
  const avgCheckIn = checkIns.length
    ? (() => {
        const mins = checkIns.map(t => { const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); });
        const avg = Math.round(mins.reduce((a, b) => a + b, 0) / mins.length);
        return `${String(Math.floor(avg / 60)).padStart(2, "0")}:${String(avg % 60).padStart(2, "0")}`;
      })()
    : "—";

  const monthlyTrend = useMemo(() => {
    const byMonth = {};
    entries.forEach(e => {
      if (!e.date) return;
      const month = e.date.slice(0, 7); // "YYYY-MM"
      byMonth[month] ??= { month, present: 0, absent: 0, late: 0 };
      if (e.status === "Present") byMonth[month].present++;
      else if (e.status === "Absent") byMonth[month].absent++;
      else if (e.status === "Late") byMonth[month].late++;
    });
    return Object.values(byMonth)
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6)
      .map(m => ({ ...m, month: new Date(`${m.month}-01`).toLocaleDateString("en-IN", { month: "short" }) }));
  }, [entries]);

  if (loading) {
    return (
      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={48} />)}
      </div>
    );
  }

  return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
      <h3 style={{ fontSize: 13, fontWeight: 800, color: "var(--yd-charcoal)" }}>Attendance</h3>

      {total === 0 ? (
        <EmptyState size="sm" title="No attendance records" description="Attendance history will appear here once recorded." />
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
            <KpiCard label="Present" value={present} />
            <KpiCard label="Absent" value={absent} />
            <KpiCard label="Late" value={late} />
            <KpiCard label="Attendance Rate" value={`${pct}%`} />
            <KpiCard label="Avg Check-In" value={avgCheckIn} />
          </div>

          {monthlyTrend.length > 1 && (
            <BarChart
              title="Monthly Trend" subtitle="Last 6 months"
              data={monthlyTrend} xKey="month"
              series={[
                { key: "present", label: "Present" },
                { key: "absent", label: "Absent" },
                { key: "late", label: "Late" },
              ]}
              height={220}
            />
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 260, overflowY: "auto" }}>
            {entries.slice(0, 60).map((e, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--yd-surface)", borderRadius: 10, padding: "8px 12px", border: "1px solid var(--yd-border-light)" }}>
                <StatusBadge status={e.status} size="xs" />
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--yd-text-soft)", flex: 1 }}>{e.date}</span>
                <span style={{ fontSize: 10, color: "var(--yd-text-muted)" }}>{e.checkIn && `In ${e.checkIn}`}{e.checkOut && ` · Out ${e.checkOut}`}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
