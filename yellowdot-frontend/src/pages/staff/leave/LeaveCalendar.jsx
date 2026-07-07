/**
 * LeaveCalendar.jsx — Team-level leave + holiday calendar (month view).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import leaveService, { LEAVE_STATUS_META } from "../../../services/leaveService";
import { T, pillStyle } from "./_shared";

const WEEK_LABELS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const daysInMonth = (y, m) => new Date(y, m, 0).getDate();

export default function LeaveCalendar() {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [leaves, setLeaves]     = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");

  const from = `${year}-${String(month).padStart(2,"0")}-01`;
  const to   = `${year}-${String(month).padStart(2,"0")}-${String(daysInMonth(year, month)).padStart(2,"0")}`;

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const r = await leaveService.calendar(from, to);
      if (r?.success) {
        setLeaves(r.leaves || []);
        setHolidays(r.holidays || []);
      }
    } catch (err) { setError(err.response?.data?.error || err.message); }
    finally { setLoading(false); }
  }, [from, to]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  // Build per-day index
  const byDay = useMemo(() => {
    const m = new Map();
    for (let d = 1; d <= daysInMonth(year, month); d++) {
      const key = `${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      m.set(key, { leaves: [], holidays: [] });
    }
    leaves.forEach(r => {
      const a = new Date(r.fromDate + "T00:00:00");
      const b = new Date(r.toDate   + "T00:00:00");
      for (let cur = new Date(a); cur <= b; cur.setDate(cur.getDate() + 1)) {
        const key = cur.toISOString().slice(0, 10);
        if (m.has(key)) m.get(key).leaves.push(r);
      }
    });
    holidays.forEach(h => { if (m.has(h.date)) m.get(h.date).holidays.push(h); });
    return m;
  }, [leaves, holidays, year, month]);

  const totalDays   = daysInMonth(year, month);
  const firstWeekday= new Date(year, month - 1, 1).getDay();
  const cells       = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);

  function prevMonth() { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); }

  return (
    <div style={{ background: T.bg, minHeight: "100%", padding: "24px 28px 48px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: T.goldMid }}>Leave Management</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: T.text, margin: "4px 0 0" }}>Team Calendar</h1>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={prevMonth} style={btn(T.surface, T.text, T.border)}>‹</button>
          <div style={{ fontWeight: 600, minWidth: 140, textAlign: "center" }}>
            {new Date(year, month - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
          </div>
          <button onClick={nextMonth} style={btn(T.surface, T.text, T.border)}>›</button>
        </div>
      </div>

      {error && <div style={errorBox}>{error}</div>}

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 18, boxShadow: T.shadow }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", marginBottom: 8 }}>
          {WEEK_LABELS.map(w => <div key={w} style={{ textAlign: "center" }}>{w}</div>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
          {loading
            ? cells.map((_, i) => <div key={i} style={cellSkel} />)
            : cells.map((d, i) => {
                if (!d) return <div key={i} />;
                const key = `${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
                const slot = byDay.get(key);
                return <DayCell key={i} day={d} date={key} slot={slot} />;
              })
          }
        </div>
      </div>

      <div style={{ display: "flex", gap: 14, marginTop: 16, flexWrap: "wrap", fontSize: 12, color: T.textSoft }}>
        <span style={pillStyle(LEAVE_STATUS_META.approved.color, LEAVE_STATUS_META.approved.bg, LEAVE_STATUS_META.approved.border)}>Approved leave</span>
        <span style={pillStyle(LEAVE_STATUS_META.pending.color, LEAVE_STATUS_META.pending.bg, LEAVE_STATUS_META.pending.border)}>Pending leave</span>
        <span style={pillStyle("#92400e", "#fef3c7", "#fde68a")}>Holiday</span>
      </div>
    </div>
  );
}

function DayCell({ day, date, slot }) {
  const total = (slot?.leaves?.length || 0);
  const holiday = slot?.holidays?.[0];
  return (
    <div style={{
      background: holiday ? "#fef3c7" : T.surfaceWarm,
      border: `1px solid ${holiday ? "#fde68a" : T.border}`,
      borderRadius: 8, padding: "8px 8px 10px", minHeight: 96,
    }}
      title={`${date}\n${total} on leave${holiday ? `\nHoliday: ${holiday.name || holiday.title || ""}` : ""}`}
    >
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontWeight: 700, color: T.text }}>{day}</span>
        {holiday && <span style={{ fontSize: 9, fontWeight: 700, color: "#92400e" }}>HOLIDAY</span>}
      </div>
      {holiday && (
        <div style={{ marginTop: 4, fontSize: 10, color: "#92400e", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {holiday.name || holiday.title || "Holiday"}
        </div>
      )}
      {(slot?.leaves || []).slice(0, 3).map((r, i) => {
        const m = LEAVE_STATUS_META[r.status] || LEAVE_STATUS_META.pending;
        return (
          <div key={`${r.requestId}-${i}`} title={`${r.displayName} · ${r.leaveCode}`} style={{
            marginTop: 4, fontSize: 10, color: m.color, fontWeight: 600,
            background: m.bg, border: `1px solid ${m.border}`,
            padding: "1px 6px", borderRadius: 4,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {r.displayName}
          </div>
        );
      })}
      {total > 3 && <div style={{ marginTop: 2, fontSize: 10, color: T.textMuted }}>+{total - 3}</div>}
    </div>
  );
}

const errorBox = { background: T.redLight, color: T.red, border: `1px solid ${T.red}33`, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13 };
const cellSkel = { background: T.surfaceWarm, border: `1px dashed ${T.border}`, borderRadius: 8, minHeight: 96 };
function btn(bg, color, border) {
  return { background: bg, color, border: border ? `1px solid ${border}` : "none", borderRadius: 10, padding: "8px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer" };
}
