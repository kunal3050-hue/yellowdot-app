/**
 * AttendanceCard — same endpoint as the original (/api/attendance?studentId=),
 * now backed by the shared useStudentAttendance hook. KpiCard summary +
 * monthly-trend BarChart. Shared component -- used by the profile shell
 * for both /students and /student-profile/:id.
 */
import { KpiCard, BarChart, StatusBadge, EmptyState, Skeleton } from "../../../components/ui";
import useStudentAttendance from "../hooks/useStudentAttendance";

export default function AttendanceCard({ student }) {
  const { entries, loading, summary, monthlyTrend } = useStudentAttendance(student.Student_ID);

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

      {summary.total === 0 ? (
        <EmptyState size="sm" title="No attendance records" description="Attendance history will appear here once recorded." />
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
            <KpiCard label="Present" value={summary.present} />
            <KpiCard label="Absent" value={summary.absent} />
            <KpiCard label="Late" value={summary.late} />
            <KpiCard label="Attendance Rate" value={`${summary.pct}%`} />
            <KpiCard label="Avg Check-In" value={summary.avgCheckIn} />
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
