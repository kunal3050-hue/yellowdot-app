/**
 * AttendanceReports.jsx — Daily + Monthly reports with CSV export
 * Design System v2 / Platform Layout Standard retrofit: PageShell +
 * PageHeader + Tabs + KpiRow + StatusBadge. Same staffAttendanceService
 * calls/export logic.
 */
import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import staffAttendanceService, { STATUS_META } from "../../../services/staffAttendanceService";
import { PageShell, PageHeader, Tabs, KpiRow, KpiCard, StatusBadge, Select, SkeletonTable } from "../../../components/ui";
import { fmtMins } from "./_shared";

function isoToday() { return new Date().toISOString().slice(0, 10); }

function csvEscape(v) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function download(name, body) {
  const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
  const a    = document.createElement("a");
  a.href     = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 0);
}

const REPORT_TABS = [{ id: "daily", label: "Daily" }, { id: "monthly", label: "Monthly" }];

export default function AttendanceReports() {
  const [mode, setMode] = useState("daily");
  const [date, setDate] = useState(isoToday());
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [daily, setDaily]     = useState(null);
  const [monthly, setMonthly] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      if (mode === "daily") {
        const res = await staffAttendanceService.dailyReport(date);
        if (res?.success) setDaily(res);
      } else {
        const res = await staffAttendanceService.monthlyReport(year, month);
        if (res?.success) setMonthly(res);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally { setLoading(false); }
  }, [mode, date, year, month]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  function exportDaily() {
    if (!daily) return;
    const cols = [["Employee Code", r => r.employeeCode],["Name", r => r.displayName],["Department", r => r.departmentName],["Status", r => r.status],["Check-In", r => r.checkIn],["Check-Out", r => r.checkOut],["Hours", r => r.hoursWorked],["Late", r => r.lateBy],["OT", r => r.overtimeMinutes]];
    const lines = [cols.map(c => c[0]).join(",")];
    daily.rows.forEach(r => lines.push(cols.map(c => csvEscape(c[1](r))).join(",")));
    download(`daily-${daily.date}.csv`, lines.join("\n"));
  }

  function exportMonthly() {
    if (!monthly) return;
    const cols = [["Employee Code", r => r.employeeCode],["Name", r => r.displayName],["Department", r => r.departmentName],["Present", r => r.present],["Absent", r => r.absent],["Half Day", r => r.halfDay],["Leave", r => r.leave],["Late Min", r => r.lateMinutes],["OT Min", r => r.overtimeMinutes],["Total Hours", r => r.hoursWorked]];
    const lines = [cols.map(c => c[0]).join(",")];
    monthly.staffRows.forEach(r => lines.push(cols.map(c => csvEscape(c[1](r))).join(",")));
    download(`monthly-${monthly.year}-${String(monthly.month).padStart(2,"0")}.csv`, lines.join("\n"));
  }

  return (
    <PageShell
      header={
        <PageHeader
          title="Reports"
          tag="Staff Attendance"
          primaryAction={mode === "daily"
            ? { label: "Export CSV", icon: <Download size={14} strokeWidth={2} />, onClick: exportDaily, disabled: !daily }
            : { label: "Export CSV", icon: <Download size={14} strokeWidth={2} />, onClick: exportMonthly, disabled: !monthly }}
        />
      }
    >
      {error && (
        <div style={{ background: "var(--yd-danger-soft)", color: "var(--yd-danger)", border: "1px solid var(--yd-danger-border)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: 14 }}>
        <Tabs tabs={REPORT_TABS} activeTab={mode} onChange={setMode} />
      </div>

      {mode === "daily" && (
        <>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: "var(--yd-text-soft)", display: "flex", alignItems: "center", gap: 6 }}>
              Date <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="yd-input" style={{ width: "auto" }} />
            </label>
          </div>
          {loading ? <SkeletonTable rows={6} columns={8} /> : daily && (
            <>
              <div style={{ marginBottom: 14 }}>
                <KpiRow>
                  <KpiCard label="Total" value={daily.total} />
                  <KpiCard label="Present" value={daily.present} />
                  <KpiCard label="Absent" value={daily.absent} />
                  <KpiCard label="Half Day" value={daily.halfDay} />
                  <KpiCard label="Leave" value={daily.leave} />
                  <KpiCard label="Late" value={daily.late} />
                  <KpiCard label="OT" value={daily.overtime} />
                </KpiRow>
              </div>
              <ReportTable>
                <thead><tr><th style={th}>Employee</th><th style={th}>Dept</th><th style={th}>Status</th><th style={th}>In</th><th style={th}>Out</th><th style={th}>Hours</th><th style={th}>Late</th><th style={th}>OT</th></tr></thead>
                <tbody>
                  {(daily.rows || []).map(r => (
                    <tr key={r.attendanceId} style={{ borderBottom: "1px solid var(--yd-border-light)" }}>
                      <td style={td}>{r.displayName}</td>
                      <td style={td}>{r.departmentName || "—"}</td>
                      <td style={td}><StatusBadge status={r.status} /></td>
                      <td style={td}>{r.checkIn ? r.checkIn.slice(11, 16) : "—"}</td>
                      <td style={td}>{r.checkOut ? r.checkOut.slice(11, 16) : "—"}</td>
                      <td style={td}>{r.hoursWorked ? `${r.hoursWorked}h` : "—"}</td>
                      <td style={td}>{r.isLate ? fmtMins(r.lateBy) : "—"}</td>
                      <td style={td}>{r.overtimeMinutes ? fmtMins(r.overtimeMinutes) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </ReportTable>
            </>
          )}
        </>
      )}

      {mode === "monthly" && (
        <>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: "var(--yd-text-soft)", display: "flex", alignItems: "center", gap: 6 }}>
              Year <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="yd-input" style={{ width: 100 }} />
            </label>
            <label style={{ fontSize: 12, color: "var(--yd-text-soft)", display: "flex", alignItems: "center", gap: 6 }}>
              Month
              <Select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                options={Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: new Date(2000, i, 1).toLocaleDateString("en-IN", { month: "long" }) }))}
              />
            </label>
          </div>
          {loading ? <SkeletonTable rows={6} columns={9} /> : monthly && (
            <>
              <div className="yd-card" style={{ marginBottom: 14, fontSize: 13, color: "var(--yd-text-soft)" }}>
                Period: <strong>{monthly.fromDate}</strong> → <strong>{monthly.toDate}</strong> · {monthly.totalRecords} record(s) · {monthly.staffRows.length} employee(s)
              </div>
              <ReportTable>
                <thead>
                  <tr>
                    <th style={th}>Employee</th><th style={th}>Dept</th>
                    <th style={th}>Present</th><th style={th}>Absent</th><th style={th}>Half Day</th><th style={th}>Leave</th>
                    <th style={th}>Late</th><th style={th}>OT</th><th style={th}>Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.staffRows.map(r => (
                    <tr key={r.staffId} style={{ borderBottom: "1px solid var(--yd-border-light)" }}>
                      <td style={td}>
                        <div style={{ fontWeight: 600 }}>{r.displayName}</div>
                        <div style={{ fontSize: 11, color: "var(--yd-text-muted)", fontFamily: "ui-monospace, Cascadia Code, monospace" }}>{r.employeeCode}</div>
                      </td>
                      <td style={td}>{r.departmentName || "—"}</td>
                      <td style={td}>{r.present}</td>
                      <td style={td}>{r.absent}</td>
                      <td style={td}>{r.halfDay}</td>
                      <td style={td}>{r.leave}</td>
                      <td style={td}>{fmtMins(r.lateMinutes)}</td>
                      <td style={td}>{fmtMins(r.overtimeMinutes)}</td>
                      <td style={td}>{Math.round(r.hoursWorked * 10) / 10}h</td>
                    </tr>
                  ))}
                </tbody>
              </ReportTable>
            </>
          )}
        </>
      )}
    </PageShell>
  );
}

function ReportTable({ children }) {
  return (
    <div className="yd-card" style={{ overflow: "hidden", padding: 0 }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 900 }}>{children}</table>
      </div>
    </div>
  );
}

const th = { textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--yd-text-muted)" };
const td = { padding: "10px 14px", fontSize: 13, color: "var(--yd-text)" };
