/**
 * AttendanceDashboard.jsx — Staff Attendance KPIs + today snapshot
 */

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import staffAttendanceService, { STATUS_META } from "../../../services/staffAttendanceService";
import { T, pillStyle, fmtTime, fmtMins } from "./_shared";

function Stat({ label, value, sub, accent = T.gold, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: 14, padding: "18px 20px",
        cursor: onClick ? "pointer" : "default",
        boxShadow: T.shadow, position: "relative", overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 3, background: accent }} />
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: T.textMuted }}>{label}</div>
      <div style={{ marginTop: 8, fontSize: 28, fontWeight: 700, color: T.text }}>{value}</div>
      {sub && <div style={{ marginTop: 4, fontSize: 12, color: T.textSoft }}>{sub}</div>}
    </div>
  );
}

function StatusPill({ status }) {
  const m = STATUS_META[status] || STATUS_META.absent;
  return <span style={pillStyle(m.color, m.bg, m.border)}>{m.label}</span>;
}

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
    <div style={{ background: T.bg, minHeight: "100%", padding: "24px 28px 48px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: T.goldMid }}>Staff Attendance</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: T.text, margin: "4px 0 0", letterSpacing: "-0.02em" }}>Dashboard</h1>
          <div style={{ fontSize: 13, color: T.textSoft, marginTop: 4 }}>{t.date || "Loading…"}</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => navigate("/staff/attendance/today")} style={btn(T.gold, "#1E1E1E")}>Mark Attendance</button>
          <button onClick={() => navigate("/staff/attendance/reports")} style={btn(T.surface, T.text, T.border)}>Reports</button>
        </div>
      </div>

      {error && <div style={errorBox}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14, marginBottom: 24 }}>
        <Stat label="Total Staff"   value={t.total ?? 0}    sub="In your school"               accent={T.gold}  />
        <Stat label="Present"       value={t.present ?? 0}  sub="Today"                        accent={T.green} />
        <Stat label="Absent"        value={t.absent ?? 0}   sub="Today"                        accent={T.red}   />
        <Stat label="On Leave"      value={t.leave ?? 0}    sub="Today"                        accent={T.goldMid}/>
        <Stat label="Half Day"      value={t.halfDay ?? 0}  sub="Today"                        accent={T.goldMid}/>
        <Stat label="Late"          value={t.late ?? 0}     sub={`${t.onTime ?? 0} on-time`}   accent={T.goldMid}/>
        <Stat label="MTD %"         value={`${monthPct}%`}  sub={`${data?.monthWorkedDays ?? 0} / ${data?.monthRecordCount ?? 0} marked`} accent={T.green} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.text, textTransform: "uppercase", letterSpacing: "0.08em" }}>Today's Attendance</div>
        <button onClick={() => navigate("/staff/attendance/today")} style={{ ...btn(T.surface, T.goldMid, T.border), fontSize: 12 }}>Open Marker →</button>
      </div>

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, boxShadow: T.shadow, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 720 }}>
            <thead style={{ background: T.surfaceWarm, borderBottom: `1px solid ${T.border}` }}>
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
              {loading && <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: T.textMuted }}>Loading…</td></tr>}
              {!loading && (t.rows || []).length === 0 && (
                <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: T.textMuted }}>No staff records.</td></tr>
              )}
              {!loading && (t.rows || []).slice(0, 12).map(r => (
                <tr key={r.staffId} style={{ borderBottom: `1px solid ${T.border}` }}>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>{r.displayName}</div>
                    <div style={{ fontSize: 11, color: T.textMuted, fontFamily: "ui-monospace, Cascadia Code, monospace" }}>{r.employeeCode}</div>
                  </td>
                  <td style={td}><StatusPill status={r.status} /></td>
                  <td style={td}>{fmtTime(r.checkIn)}</td>
                  <td style={td}>{fmtTime(r.checkOut)}</td>
                  <td style={td}>{r.hoursWorked ? `${r.hoursWorked}h` : "—"}</td>
                  <td style={td}>{r.isLate ? <span style={{ color: T.red, fontWeight: 600 }}>{fmtMins(r.lateBy)}</span> : "—"}</td>
                  <td style={td}>{r.overtimeMinutes ? <span style={{ color: T.green, fontWeight: 600 }}>{fmtMins(r.overtimeMinutes)}</span> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const th = { textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: T.textMuted };
const td = { padding: "10px 14px", fontSize: 13, color: T.text };
const errorBox = { background: T.redLight, color: T.red, border: `1px solid ${T.red}33`, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13 };
function btn(bg, color, border) {
  return { background: bg, color, border: border ? `1px solid ${border}` : "none", borderRadius: 10, padding: "10px 18px", fontWeight: 600, fontSize: 13, cursor: "pointer" };
}
