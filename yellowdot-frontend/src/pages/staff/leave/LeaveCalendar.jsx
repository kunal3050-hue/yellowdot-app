/**
 * LeaveCalendar.jsx — Team-level leave + holiday calendar (month view).
 * Design System v2 / Platform Layout Standard retrofit: PageShell +
 * PageHeader + StatusBadge legend; the calendar grid itself is a bespoke
 * layout (not a DataTable fit) reskinned onto design tokens. Same
 * leaveService.calendar call.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { LEAVE_STATUS_META } from "../../../services/leaveService";
import leaveService from "../../../services/leaveService";
import { PageShell, PageHeader, StatusBadge } from "../../../components/ui";

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
    <PageShell
      header={
        <PageHeader
          title="Team Calendar"
          tag="Leave Management"
          actions={
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button onClick={prevMonth} className="yd-close-btn" aria-label="Previous month"><ChevronLeft size={16} strokeWidth={2} /></button>
              <div style={{ fontWeight: 700, minWidth: 140, textAlign: "center" }}>
                {new Date(year, month - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
              </div>
              <button onClick={nextMonth} className="yd-close-btn" aria-label="Next month"><ChevronRight size={16} strokeWidth={2} /></button>
            </div>
          }
        />
      }
    >
      {error && (
        <div style={{ background: "var(--yd-danger-soft)", color: "var(--yd-danger)", border: "1px solid var(--yd-danger-border)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      <div className="yd-card" style={{ padding: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, fontSize: 11, fontWeight: 700, color: "var(--yd-text-muted)", textTransform: "uppercase", marginBottom: 8 }}>
          {WEEK_LABELS.map(w => <div key={w} style={{ textAlign: "center" }}>{w}</div>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
          {loading
            ? cells.map((_, i) => <div key={i} style={{ background: "var(--yd-soft)", border: "1px dashed var(--yd-border)", borderRadius: 8, minHeight: 96 }} />)
            : cells.map((d, i) => {
                if (!d) return <div key={i} />;
                const key = `${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
                const slot = byDay.get(key);
                return <DayCell key={i} day={d} date={key} slot={slot} />;
              })
          }
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
        <StatusBadge status="approved" />
        <StatusBadge status="pending" />
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 8px", borderRadius: 9999, fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", background: "var(--yd-warning-soft)", color: "var(--yd-warning)", border: "1px solid var(--yd-warning-border)" }}>Holiday</span>
      </div>
    </PageShell>
  );
}

function DayCell({ day, date, slot }) {
  const total = (slot?.leaves?.length || 0);
  const holiday = slot?.holidays?.[0];
  return (
    <div style={{
      background: holiday ? "var(--yd-warning-soft)" : "var(--yd-soft)",
      border: `1px solid ${holiday ? "var(--yd-warning-border)" : "var(--yd-border)"}`,
      borderRadius: 8, padding: "8px 8px 10px", minHeight: 96,
    }}
      title={`${date}\n${total} on leave${holiday ? `\nHoliday: ${holiday.name || holiday.title || ""}` : ""}`}
    >
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontWeight: 700, color: "var(--yd-text)" }}>{day}</span>
        {holiday && <span style={{ fontSize: 9, fontWeight: 700, color: "var(--yd-warning)" }}>HOLIDAY</span>}
      </div>
      {holiday && (
        <div style={{ marginTop: 4, fontSize: 10, color: "var(--yd-warning)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
      {total > 3 && <div style={{ marginTop: 2, fontSize: 10, color: "var(--yd-text-muted)" }}>+{total - 3}</div>}
    </div>
  );
}
