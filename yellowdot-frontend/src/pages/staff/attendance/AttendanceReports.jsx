/**
 * AttendanceReports.jsx — Daily + Monthly reports with CSV export
 */

import { useCallback, useEffect, useState } from "react";
import staffAttendanceService, { STATUS_META } from "../../../services/staffAttendanceService";
import { T, pillStyle, fmtMins } from "./_shared";

function isoToday() { return new Date().toISOString().slice(0, 10); }

function csvEscape(v) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function AttendanceReports() {
  const [mode, setMode] = useState("daily"); // daily | monthly
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

  function download(name, body) {
    const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
    const a    = document.createElement("a");
    a.href     = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 0);
  }

  return (
    <div style={{ background: T.bg, minHeight: "100%", padding: "24px 28px 48px" }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: T.goldMid }}>Staff Attendance</div>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: T.text, margin: "4px 0 0", letterSpacing: "-0.02em" }}>Reports</h1>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14, borderBottom: `1px solid ${T.border}` }}>
        {[["daily","Daily"],["monthly","Monthly"]].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            style={{ background: "none", border: "none", padding: "10px 16px", cursor: "pointer", fontSize: 13, fontWeight: mode === id ? 700 : 500, color: mode === id ? T.text : T.textSoft, borderBottom: `2px solid ${mode === id ? T.gold : "transparent"}`, marginBottom: -1 }}
          >{label}</button>
        ))}
      </div>

      {error && <div style={errorBox}>{error}</div>}

      {mode === "daily" && (
        <>
          <div style={toolbar}>
            <label style={lbl}>Date <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inp} /></label>
            <button onClick={exportDaily} style={btn(T.surface, T.text, T.border)} disabled={!daily}>Export CSV</button>
          </div>
          {loading ? <Loading /> : daily && (
            <>
              <Grid7
                cards={[
                  ["Total",    daily.total],
                  ["Present",  daily.present],
                  ["Absent",   daily.absent, T.red],
                  ["Half Day", daily.halfDay, T.goldMid],
                  ["Leave",    daily.leave, T.goldMid],
                  ["Late",     daily.late, T.goldMid],
                  ["OT",       daily.overtime, T.green],
                ]}
              />
              <Table>
                <thead><tr><th style={th}>Employee</th><th style={th}>Dept</th><th style={th}>Status</th><th style={th}>In</th><th style={th}>Out</th><th style={th}>Hours</th><th style={th}>Late</th><th style={th}>OT</th></tr></thead>
                <tbody>
                  {(daily.rows || []).map(r => {
                    const m = STATUS_META[r.status] || STATUS_META.absent;
                    return (
                      <tr key={r.attendanceId} style={{ borderBottom: `1px solid ${T.border}` }}>
                        <td style={td}>{r.displayName}</td>
                        <td style={td}>{r.departmentName || "—"}</td>
                        <td style={td}><span style={pillStyle(m.color, m.bg, m.border)}>{m.label}</span></td>
                        <td style={td}>{r.checkIn ? r.checkIn.slice(11, 16) : "—"}</td>
                        <td style={td}>{r.checkOut ? r.checkOut.slice(11, 16) : "—"}</td>
                        <td style={td}>{r.hoursWorked ? `${r.hoursWorked}h` : "—"}</td>
                        <td style={td}>{r.isLate ? fmtMins(r.lateBy) : "—"}</td>
                        <td style={td}>{r.overtimeMinutes ? fmtMins(r.overtimeMinutes) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </>
          )}
        </>
      )}

      {mode === "monthly" && (
        <>
          <div style={toolbar}>
            <label style={lbl}>Year
              <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ ...inp, width: 100 }} />
            </label>
            <label style={lbl}>Month
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))} style={inp}>
                {Array.from({length: 12}, (_, i) => i + 1).map(m =>
                  <option key={m} value={m}>{new Date(2000, m - 1, 1).toLocaleDateString("en-IN", { month: "long" })}</option>
                )}
              </select>
            </label>
            <button onClick={exportMonthly} style={btn(T.surface, T.text, T.border)} disabled={!monthly}>Export CSV</button>
          </div>
          {loading ? <Loading /> : monthly && (
            <>
              <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px", marginBottom: 14, fontSize: 13, color: T.textSoft, boxShadow: T.shadow }}>
                Period: <strong>{monthly.fromDate}</strong> → <strong>{monthly.toDate}</strong> · {monthly.totalRecords} record(s) · {monthly.staffRows.length} employee(s)
              </div>
              <Table>
                <thead>
                  <tr>
                    <th style={th}>Employee</th><th style={th}>Dept</th>
                    <th style={th}>Present</th><th style={th}>Absent</th><th style={th}>Half Day</th><th style={th}>Leave</th>
                    <th style={th}>Late</th><th style={th}>OT</th><th style={th}>Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.staffRows.map(r => (
                    <tr key={r.staffId} style={{ borderBottom: `1px solid ${T.border}` }}>
                      <td style={td}>
                        <div style={{ fontWeight: 600 }}>{r.displayName}</div>
                        <div style={{ fontSize: 11, color: T.textMuted, fontFamily: "ui-monospace, Cascadia Code, monospace" }}>{r.employeeCode}</div>
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
              </Table>
            </>
          )}
        </>
      )}
    </div>
  );
}

function Loading() { return <div style={{ padding: 30, textAlign: "center", color: T.textMuted }}>Loading…</div>; }
function Table({ children }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, boxShadow: T.shadow, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 900 }}>{children}</table>
      </div>
    </div>
  );
}
function Grid7({ cards }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10, marginBottom: 14 }}>
      {cards.map(([label, value, color]) => (
        <div key={label} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px", position: "relative", overflow: "hidden", boxShadow: T.shadow }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: color || T.gold }} />
          <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, textTransform: "uppercase" }}>{label}</div>
          <div style={{ marginTop: 4, fontSize: 20, fontWeight: 700, color: T.text }}>{value}</div>
        </div>
      ))}
    </div>
  );
}

const th = { textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: T.textMuted };
const td = { padding: "10px 14px", fontSize: 13, color: T.text };
const errorBox = { background: T.redLight, color: T.red, border: `1px solid ${T.red}33`, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13 };
const lbl = { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.textSoft };
const inp = { border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 12px", fontSize: 13, background: T.surfaceWarm };
const toolbar = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 14, marginBottom: 14, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", boxShadow: T.shadow };
function btn(bg, color, border) {
  return { background: bg, color, border: border ? `1px solid ${border}` : "none", borderRadius: 10, padding: "9px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer" };
}
