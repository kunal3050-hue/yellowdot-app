/**
 * AttendanceDashboard.jsx — Staff Attendance KPIs + today snapshot
 * Design System v2 / Platform Layout Standard retrofit: PageShell +
 * PageHeader + KpiRow + StatusBadge. Same staffAttendanceService.dashboard
 * call/shape.
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import staffAttendanceService from "../../../services/staffAttendanceService";
import { PageShell, PageHeader, KpiRow, KpiCard, StatusBadge, SkeletonTable } from "../../../components/ui";
import { fmtTime, fmtMins } from "./_shared";

export default function AttendanceDashboard() {
  const navigate = useNavigate();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await staffAttendanceService.dashboard();
      if (res?.success) setData(res);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally { setLoading(false); }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const t = data?.today || {};
  const monthPct = data?.monthAttendancePct ?? 0;

  return (
    <PageShell
      header={
        <PageHeader
          title="Dashboard"
          tag="Staff Attendance"
          subtitle={t.date || "Loading…"}
          primaryAction={{ label: "Mark Attendance", onClick: () => navigate("/staff/attendance/today") }}
          secondaryActions={[{ key: "reports", label: "Reports", onClick: () => navigate("/staff/attendance/reports") }]}
        />
      }
      kpis={
        <KpiRow>
          <KpiCard label="Total Staff" value={t.total ?? 0}   trendLabel="In your school" loading={loading} />
          <KpiCard label="Present"     value={t.present ?? 0} trendLabel="Today"          loading={loading} />
          <KpiCard label="Absent"      value={t.absent ?? 0}  trendLabel="Today"          loading={loading} />
          <KpiCard label="On Leave"    value={t.leave ?? 0}   trendLabel="Today"          loading={loading} />
          <KpiCard label="Half Day"    value={t.halfDay ?? 0} trendLabel="Today"          loading={loading} />
          <KpiCard label="Late"        value={t.late ?? 0}    trendLabel={`${t.onTime ?? 0} on-time`} loading={loading} />
          <KpiCard label="MTD %"       value={`${monthPct}%`} trendLabel={`${data?.monthWorkedDays ?? 0} / ${data?.monthRecordCount ?? 0} marked`} loading={loading} />
        </KpiRow>
      }
    >
      {error && (
        <div style={{ background: "var(--yd-danger-soft)", color: "var(--yd-danger)", border: "1px solid var(--yd-danger-border)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--yd-charcoal)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Today's Attendance</div>
        <button onClick={() => navigate("/staff/attendance/today")} className="btn btn-ghost btn-xs">Open Marker →</button>
      </div>

      <div className="yd-card" style={{ overflow: "hidden", padding: 0 }}>
        {loading ? (
          <div style={{ padding: 20 }}><SkeletonTable rows={6} columns={7} /></div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 720 }}>
              <thead style={{ background: "var(--yd-soft)", borderBottom: "1px solid var(--yd-border)" }}>
                <tr>
                  <th style={th}>Employee</th>
                  <th style={th}>Status</th>
                  <th style={th}>Check-In</th>
                  <th style={th}>Check-Out</th>
                  <th style={th}>Hours</th>
                  <th style={th}>Late</th>
                  <th style={th}>OT</th>
                </tr>
              </thead>
              <tbody>
                {(t.rows || []).length === 0 && (
                  <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "var(--yd-text-muted)" }}>No staff records.</td></tr>
                )}
                {(t.rows || []).slice(0, 12).map(r => (
                  <tr key={r.staffId} style={{ borderBottom: "1px solid var(--yd-border-light)" }}>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{r.displayName}</div>
                      <div style={{ fontSize: 11, color: "var(--yd-text-muted)", fontFamily: "ui-monospace, Cascadia Code, monospace" }}>{r.employeeCode}</div>
                    </td>
                    <td style={td}><StatusBadge status={r.status} /></td>
                    <td style={td}>{fmtTime(r.checkIn)}</td>
                    <td style={td}>{fmtTime(r.checkOut)}</td>
                    <td style={td}>{r.hoursWorked ? `${r.hoursWorked}h` : "—"}</td>
                    <td style={td}>{r.isLate ? <span style={{ color: "var(--yd-danger)", fontWeight: 600 }}>{fmtMins(r.lateBy)}</span> : "—"}</td>
                    <td style={td}>{r.overtimeMinutes ? <span style={{ color: "var(--yd-success)", fontWeight: 600 }}>{fmtMins(r.overtimeMinutes)}</span> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageShell>
  );
}

const th = { textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--yd-text-muted)" };
const td = { padding: "10px 14px", fontSize: 13, color: "var(--yd-text)" };
