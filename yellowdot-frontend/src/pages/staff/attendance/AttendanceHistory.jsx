/**
 * AttendanceHistory.jsx — Searchable table of all attendance records
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import staffAttendanceService, { STATUS_META, ATTENDANCE_STATUSES } from "../../../services/staffAttendanceService";
import staffService from "../../../services/staffService";
import { T, pillStyle, fmtTime, fmtMins } from "./_shared";

const PAGE_SIZE = 50;

function isoDaysAgo(n) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function csvEscape(v) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function AttendanceHistory() {
  const navigate = useNavigate();

  const [rows, setRows]       = useState([]);
  const [allStaff, setAllStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  const [fromDate, setFromDate] = useState(isoDaysAgo(30));
  const [toDate, setToDate]     = useState(isoDaysAgo(0));
  const [staffFilter, setStaffFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [r, s] = await Promise.all([
        staffAttendanceService.list({
          fromDate, toDate,
          staffId: staffFilter || undefined,
          status: statusFilter || undefined,
        }),
        staffService.getAll(),
      ]);
      if (r?.success) setRows(r.rows || []);
      if (s?.success) setAllStaff(s.staff || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally { setLoading(false); }
  }, [fromDate, toDate, staffFilter, statusFilter]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setPage(1); }, [fromDate, toDate, staffFilter, statusFilter]);

  const pageRows = useMemo(() => rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [rows, page]);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

  function exportCSV() {
    const cols = [
      ["Date",          r => r.date],
      ["Employee Code", r => r.employeeCode],
      ["Name",          r => r.displayName],
      ["Department",    r => r.departmentName],
      ["Status",        r => r.status],
      ["Check-In",      r => r.checkIn],
      ["Check-Out",     r => r.checkOut],
      ["Hours",         r => r.hoursWorked],
      ["Late (min)",    r => r.lateBy],
      ["Early Exit (min)", r => r.earlyExitBy],
      ["Overtime (min)",   r => r.overtimeMinutes],
      ["Source",        r => r.source],
    ];
    const lines = [cols.map(c => c[0]).join(",")];
    rows.forEach(r => lines.push(cols.map(c => csvEscape(c[1](r))).join(",")));
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a    = document.createElement("a");
    a.href     = URL.createObjectURL(blob);
    a.download = `staff-attendance-${fromDate}_to_${toDate}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 0);
  }

  return (
    <div style={{ background: T.bg, minHeight: "100%", padding: "24px 28px 48px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: T.goldMid }}>Staff Attendance</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: T.text, margin: "4px 0 0", letterSpacing: "-0.02em" }}>History ({rows.length})</h1>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={exportCSV} style={btn(T.surface, T.text, T.border)}>Export CSV</button>
          <button onClick={() => navigate("/staff/attendance/today")} style={btn(T.gold, "#1E1E1E")}>Mark Attendance</button>
        </div>
      </div>

      {error && <div style={errorBox}>{error}</div>}

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 14, marginBottom: 14, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", boxShadow: T.shadow }}>
        <label style={lbl}>From <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={inp} /></label>
        <label style={lbl}>To   <input type="date" value={toDate}   onChange={(e) => setToDate(e.target.value)}   style={inp} /></label>
        <select value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)} style={inp}>
          <option value="">All staff</option>
          {allStaff.map(s => <option key={s.staffId} value={s.staffId}>{s.displayName} ({s.employeeCode})</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={inp}>
          <option value="">All statuses</option>
          {ATTENDANCE_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, boxShadow: T.shadow, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 1080 }}>
            <thead style={{ background: T.surfaceWarm, borderBottom: `1px solid ${T.border}` }}>
              <tr>
                <th style={th}>Date</th>
                <th style={th}>Employee</th>
                <th style={th}>Department</th>
                <th style={th}>Status</th>
                <th style={th}>Check-In</th>
                <th style={th}>Check-Out</th>
                <th style={th}>Hours</th>
                <th style={th}>Late</th>
                <th style={th}>OT</th>
                <th style={th}>Source</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={10} style={{ padding: 24, textAlign: "center", color: T.textMuted }}>Loading…</td></tr>}
              {!loading && pageRows.length === 0 && (
                <tr><td colSpan={10} style={{ padding: 24, textAlign: "center", color: T.textMuted }}>No attendance records for these filters.</td></tr>
              )}
              {!loading && pageRows.map(r => {
                const m = STATUS_META[r.status] || STATUS_META.absent;
                return (
                  <tr key={r.attendanceId} style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={td}>{r.date}</td>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{r.displayName}</div>
                      <div style={{ fontSize: 11, color: T.textMuted, fontFamily: "ui-monospace, Cascadia Code, monospace" }}>{r.employeeCode}</div>
                    </td>
                    <td style={td}>{r.departmentName || "—"}</td>
                    <td style={td}><span style={pillStyle(m.color, m.bg, m.border)}>{m.label}</span></td>
                    <td style={td}>{fmtTime(r.checkIn)}</td>
                    <td style={td}>{fmtTime(r.checkOut)}</td>
                    <td style={td}>{r.hoursWorked ? `${r.hoursWorked}h` : "—"}</td>
                    <td style={td}>{r.isLate ? <span style={{ color: T.red, fontWeight: 600 }}>{fmtMins(r.lateBy)}</span> : "—"}</td>
                    <td style={td}>{r.overtimeMinutes ? <span style={{ color: T.green, fontWeight: 600 }}>{fmtMins(r.overtimeMinutes)}</span> : "—"}</td>
                    <td style={{ ...td, fontSize: 11, color: T.textMuted, textTransform: "uppercase" }}>{r.source}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {rows.length > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", borderTop: `1px solid ${T.border}`, background: T.surfaceWarm, fontSize: 12, color: T.textSoft }}>
            <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, rows.length)} of {rows.length}</span>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={pagerBtn(page === 1)}>‹</button>
              <span>Page {page} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={pagerBtn(page === totalPages)}>›</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const th = { textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: T.textMuted };
const td = { padding: "10px 14px", fontSize: 13, color: T.text };
const errorBox = { background: T.redLight, color: T.red, border: `1px solid ${T.red}33`, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13 };
const lbl = { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.textSoft };
const inp = { border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 12px", fontSize: 13, background: T.surfaceWarm };
function btn(bg, color, border) {
  return { background: bg, color, border: border ? `1px solid ${border}` : "none", borderRadius: 10, padding: "9px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer" };
}
function pagerBtn(disabled) {
  return { border: `1px solid ${T.border}`, background: T.surface, borderRadius: 6, width: 28, height: 28, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1 };
}
