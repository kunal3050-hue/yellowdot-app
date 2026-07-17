/**
 * AttendanceHistory.jsx — Searchable table of all attendance records
 * Design System v2 / Platform Layout Standard retrofit: PageShell +
 * PageHeader + DataTable (search/filter/sort/export/pagination free).
 * Date range stays a server-side query param (re-fetches on change) --
 * everything else (staff/status filter, search, CSV export) now comes
 * from DataTable itself instead of hand-rolled controls.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import staffAttendanceService, { ATTENDANCE_STATUSES } from "../../../services/staffAttendanceService";
import staffService from "../../../services/staffService";
import { PageShell, PageHeader, DataTable } from "../../../components/ui";
import { fmtTime, fmtMins } from "./_shared";

function isoDaysAgo(n) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function AttendanceHistory() {
  const navigate = useNavigate();

  const [rows, setRows]       = useState([]);
  const [allStaff, setAllStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  const [fromDate, setFromDate] = useState(isoDaysAgo(30));
  const [toDate, setToDate]     = useState(isoDaysAgo(0));

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [r, s] = await Promise.all([
        staffAttendanceService.list({ fromDate, toDate }),
        staffService.getAll(),
      ]);
      if (r?.success) setRows(r.rows || []);
      if (s?.success) setAllStaff(s.staff || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally { setLoading(false); }
  }, [fromDate, toDate]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const staffOptions = useMemo(() => allStaff.map(s => ({ value: s.staffId, label: `${s.displayName} (${s.employeeCode})` })), [allStaff]);

  const columns = useMemo(() => [
    { key: "date", label: "Date", sortable: true, width: 110 },
    {
      key: "displayName", label: "Employee", sortable: true, filterable: true, width: 180,
      filterType: "select", filterOptions: staffOptions,
      render: (v, row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{v}</div>
          <div style={{ fontSize: 11, color: "var(--yd-text-muted)", fontFamily: "ui-monospace, Cascadia Code, monospace" }}>{row.employeeCode}</div>
        </div>
      ),
    },
    { key: "departmentName", label: "Department", sortable: true, filterable: true, width: 140, render: (v) => v || "—" },
    {
      key: "status", label: "Status", type: "badge", sortable: true, filterable: true,
      filterType: "select", filterOptions: ATTENDANCE_STATUSES, width: 120,
    },
    { key: "checkIn", label: "Check-In", width: 100, render: (v) => fmtTime(v) },
    { key: "checkOut", label: "Check-Out", width: 100, render: (v) => fmtTime(v) },
    { key: "hoursWorked", label: "Hours", width: 90, render: (v) => v ? `${v}h` : "—" },
    { key: "lateBy", label: "Late", width: 90, render: (v, row) => row.isLate ? <span style={{ color: "var(--yd-danger)", fontWeight: 600 }}>{fmtMins(v)}</span> : "—" },
    { key: "overtimeMinutes", label: "OT", width: 90, render: (v) => v ? <span style={{ color: "var(--yd-success)", fontWeight: 600 }}>{fmtMins(v)}</span> : "—" },
    { key: "source", label: "Source", width: 100, render: (v) => <span style={{ fontSize: 11, color: "var(--yd-text-muted)", textTransform: "uppercase" }}>{v}</span> },
  ], [staffOptions]);

  return (
    <PageShell
      header={
        <PageHeader
          title="History"
          tag="Staff Attendance"
          subtitle={`${rows.length} record${rows.length === 1 ? "" : "s"}`}
          primaryAction={{ label: "Mark Attendance", onClick: () => navigate("/staff/attendance/today") }}
        />
      }
    >
      {error && (
        <div style={{ background: "var(--yd-danger-soft)", color: "var(--yd-danger)", border: "1px solid var(--yd-danger-border)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      <div className="yd-card" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", padding: "14px 18px", marginBottom: 14 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--yd-text-soft)" }}>
          From <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="yd-input" style={{ width: "auto" }} />
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--yd-text-soft)" }}>
          To <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="yd-input" style={{ width: "auto" }} />
        </label>
      </div>

      <DataTable
        tableId="staff-attendance-history"
        columns={columns}
        data={rows}
        loading={loading}
        entityLabel="records"
        searchPlaceholder="Search name, employee ID…"
        exportFilename="staff-attendance-history"
        exportTitle="Staff Attendance History"
        exportFormats={["csv", "excel", "print"]}
        empty={{ title: "No attendance records for these filters" }}
      />
    </PageShell>
  );
}
