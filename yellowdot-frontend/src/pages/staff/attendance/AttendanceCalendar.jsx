/**
 * AttendanceCalendar.jsx — Per-staff month calendar view
 * URL: /staff/attendance/calendar?staffId=STF000001
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import staffAttendanceService, { STATUS_META, ATTENDANCE_STATUSES } from "../../../services/staffAttendanceService";
import staffService from "../../../services/staffService";
import { T, pillStyle, fmtTime, fmtMins } from "./_shared";

const WEEK_LABELS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function daysInMonth(y, m) {
  return new Date(y, m, 0).getDate();
}

export default function AttendanceCalendar() {
  const [sp, setSp]    = useSearchParams();
  const navigate       = useNavigate();
  const staffId        = sp.get("staffId") || "";
  const now            = new Date();
  const [year, setYear]   = useState(Number(sp.get("year"))  || now.getFullYear());
  const [month, setMonth] = useState(Number(sp.get("month")) || (now.getMonth() + 1));

  const [rows, setRows]     = useState([]);
  const [staff, setStaff]   = useState(null);
  const [allStaff, setAllStaff] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  // Load directory once for the picker
  useEffect(() => {
    staffService.getAll().then(r => { if (r?.success) setAllStaff(r.staff || []); }).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    if (!staffId) return;
    setLoading(true); setError("");
    try {
      const [m, s] = await Promise.all([
        staffAttendanceService.staffMonth(staffId, { year, month }),
        staffService.getOne(staffId),
      ]);
      if (m?.success) setRows(m.rows || []);
      if (s?.success) setStaff(s.staff);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally { setLoading(false); }
  }, [staffId, year, month]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  // Sync URL with selections
  useEffect(() => {
    const next = new URLSearchParams(sp);
    next.set("year", String(year));
    next.set("month", String(month));
    if (staffId) next.set("staffId", staffId);
    setSp(next, { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, staffId]);

  const byDay = useMemo(() => {
    const m = new Map();
    rows.forEach(r => m.set(r.date, r));
    return m;
  }, [rows]);

  // Build the calendar grid (leading blanks for the first weekday offset)
  const totalDays   = daysInMonth(year, month);
  const firstWeekday= new Date(year, month - 1, 1).getDay();
  const cells       = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);

  // Totals for the month
  const totals = useMemo(() => {
    const t = { present: 0, absent: 0, halfDay: 0, leave: 0, late: 0, otMins: 0, hours: 0 };
    rows.forEach(r => {
      if (r.status === "present")  t.present++;
      if (r.status === "absent")   t.absent++;
      if (r.status === "half_day") t.halfDay++;
      if (r.status === "leave")    t.leave++;
      if (r.isLate)                t.late++;
      t.otMins += r.overtimeMinutes || 0;
      t.hours  += r.hoursWorked     || 0;
    });
    t.hours = Math.round(t.hours * 10) / 10;
    return t;
  }, [rows]);

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1);
  }

  return (
    <div style={{ background: T.bg, minHeight: "100%", padding: "24px 28px 48px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: T.goldMid }}>Staff Attendance</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: T.text, margin: "4px 0 0", letterSpacing: "-0.02em" }}>Calendar</h1>
          {staff && (
            <div style={{ fontSize: 13, color: T.textSoft, marginTop: 4 }}>
              {staff.displayName} · <span style={{ fontFamily: "ui-monospace, Cascadia Code, monospace", fontSize: 12 }}>{staff.employeeCode}</span>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select value={staffId} onChange={(e) => { const next = new URLSearchParams(sp); next.set("staffId", e.target.value); setSp(next); }} style={selectStyle}>
            <option value="">Select employee…</option>
            {allStaff.map(s => <option key={s.staffId} value={s.staffId}>{s.displayName} ({s.employeeCode})</option>)}
          </select>
          <button onClick={prevMonth} style={btn(T.surface, T.text, T.border)}>‹</button>
          <div style={{ fontWeight: 600, color: T.text, minWidth: 140, textAlign: "center" }}>
            {new Date(year, month - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
          </div>
          <button onClick={nextMonth} style={btn(T.surface, T.text, T.border)}>›</button>
        </div>
      </div>

      {error && <div style={errorBox}>{error}</div>}

      {!staffId && (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 40, textAlign: "center", color: T.textMuted }}>
          Select an employee to see their month-by-month attendance.
        </div>
      )}

      {staffId && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10, marginBottom: 16 }}>
            <KPI label="Present"  value={totals.present}  />
            <KPI label="Absent"   value={totals.absent}   color={T.red} />
            <KPI label="Half Day" value={totals.halfDay}  color={T.goldMid} />
            <KPI label="Leave"    value={totals.leave}    color={T.goldMid} />
            <KPI label="Late Days"value={totals.late}     color={T.goldMid} />
            <KPI label="OT"       value={fmtMins(totals.otMins)} color={T.green} />
            <KPI label="Total Hrs"value={`${totals.hours}h`}     color={T.green} />
          </div>

          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 18, boxShadow: T.shadow }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", marginBottom: 8 }}>
              {WEEK_LABELS.map(w => <div key={w} style={{ textAlign: "center" }}>{w}</div>)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
              {loading
                ? cells.map((_, i) => <div key={i} style={cellSkel} />)
                : cells.map((d, i) => {
                    if (!d) return <div key={i} />;
                    const date = `${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
                    const r    = byDay.get(date);
                    return <DayCell key={i} day={d} record={r} date={date} />;
                  })
              }
            </div>
          </div>

          <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap", fontSize: 11, color: T.textSoft }}>
            {ATTENDANCE_STATUSES.filter(s => s.value !== "weekend").map(s => (
              <span key={s.value} style={pillStyle(s.color, s.bg, s.border)}>{s.label}</span>
            ))}
          </div>

          <div style={{ marginTop: 18, textAlign: "right" }}>
            <button onClick={() => navigate("/staff/attendance/today")} style={btn(T.surface, T.text, T.border)}>← Back to Today</button>
          </div>
        </>
      )}
    </div>
  );
}

function KPI({ label, value, color = T.gold }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px", position: "relative", overflow: "hidden", boxShadow: T.shadow }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: color }} />
      <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 18, fontWeight: 700, color: T.text }}>{value}</div>
    </div>
  );
}

function DayCell({ day, record, date }) {
  const meta = record ? (STATUS_META[record.status] || STATUS_META.absent) : null;
  const hasRecord = !!record;
  return (
    <div title={record ? `${date}\n${record.status}${record.checkIn ? `\nIn: ${fmtTime(record.checkIn)}` : ""}${record.checkOut ? `\nOut: ${fmtTime(record.checkOut)}` : ""}` : date}
      style={{
        background: hasRecord ? meta.bg : T.surfaceWarm,
        border: `1px solid ${hasRecord ? meta.border : T.border}`,
        borderRadius: 8, padding: "10px 8px", minHeight: 72,
      }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 700, color: hasRecord ? meta.color : T.text }}>{day}</span>
        {hasRecord && record.isLate && <span style={{ fontSize: 9, color: T.red, fontWeight: 700 }}>LATE</span>}
      </div>
      {hasRecord && (
        <div style={{ marginTop: 4, fontSize: 10, color: meta.color, fontWeight: 600 }}>
          {meta.label}
        </div>
      )}
      {hasRecord && record.checkIn && (
        <div style={{ marginTop: 2, fontSize: 10, color: T.textSoft }}>
          {fmtTime(record.checkIn)}{record.checkOut ? `–${fmtTime(record.checkOut)}` : ""}
        </div>
      )}
    </div>
  );
}

const errorBox = { background: T.redLight, color: T.red, border: `1px solid ${T.red}33`, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13 };
const selectStyle = { border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 12px", fontSize: 13, background: T.surfaceWarm, minWidth: 220 };
const cellSkel = { background: T.surfaceWarm, border: `1px dashed ${T.border}`, borderRadius: 8, minHeight: 72 };
function btn(bg, color, border) {
  return { background: bg, color, border: border ? `1px solid ${border}` : "none", borderRadius: 10, padding: "8px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer" };
}
