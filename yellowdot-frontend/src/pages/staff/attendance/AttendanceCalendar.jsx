/**
 * AttendanceCalendar.jsx — Per-staff month calendar view
 * URL: /staff/attendance/calendar?staffId=STF000001
 * Design System v2 / Platform Layout Standard retrofit: PageShell +
 * PageHeader + KpiRow for the month totals + StatusBadge legend. The
 * calendar grid itself is a bespoke layout (not a DataTable fit) reskinned
 * onto design tokens. Same staffAttendanceService/staffService calls.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import staffAttendanceService, { STATUS_META, ATTENDANCE_STATUSES } from "../../../services/staffAttendanceService";
import staffService from "../../../services/staffService";
import { PageShell, PageHeader, KpiRow, KpiCard, StatusBadge, Select } from "../../../components/ui";
import { fmtTime, fmtMins } from "./_shared";

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

  const totalDays   = daysInMonth(year, month);
  const firstWeekday= new Date(year, month - 1, 1).getDay();
  const cells       = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);

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

  const staffOptions = useMemo(() => allStaff.map(s => ({ value: s.staffId, label: `${s.displayName} (${s.employeeCode})` })), [allStaff]);

  return (
    <PageShell
      header={
        <PageHeader
          title="Calendar"
          tag="Staff Attendance"
          subtitle={staff && (
            <span>{staff.displayName} · <span style={{ fontFamily: "ui-monospace, Cascadia Code, monospace", fontSize: 12 }}>{staff.employeeCode}</span></span>
          )}
          secondaryActions={[{ key: "back", label: "← Back to Today", onClick: () => navigate("/staff/attendance/today") }]}
        />
      }
    >
      {error && (
        <div style={{ background: "var(--yd-danger-soft)", color: "var(--yd-danger)", border: "1px solid var(--yd-danger-border)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: 18 }}>
        <div style={{ minWidth: 240 }}>
          <Select value={staffId} onChange={(e) => { const next = new URLSearchParams(sp); next.set("staffId", e.target.value); setSp(next); }} options={staffOptions} placeholder="Select employee…" />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={prevMonth} className="yd-close-btn" aria-label="Previous month"><ChevronLeft size={16} strokeWidth={2} /></button>
          <div style={{ fontWeight: 700, color: "var(--yd-charcoal)", minWidth: 140, textAlign: "center" }}>
            {new Date(year, month - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
          </div>
          <button onClick={nextMonth} className="yd-close-btn" aria-label="Next month"><ChevronRight size={16} strokeWidth={2} /></button>
        </div>
      </div>

      {!staffId ? (
        <div className="yd-card" style={{ padding: 40, textAlign: "center", color: "var(--yd-text-muted)" }}>
          Select an employee to see their month-by-month attendance.
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 16 }}>
            <KpiRow>
              <KpiCard label="Present" value={totals.present} />
              <KpiCard label="Absent" value={totals.absent} />
              <KpiCard label="Half Day" value={totals.halfDay} />
              <KpiCard label="Leave" value={totals.leave} />
              <KpiCard label="Late Days" value={totals.late} />
              <KpiCard label="OT" value={fmtMins(totals.otMins)} />
              <KpiCard label="Total Hrs" value={`${totals.hours}h`} />
            </KpiRow>
          </div>

          <div className="yd-card" style={{ padding: 18 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, fontSize: 11, fontWeight: 700, color: "var(--yd-text-muted)", textTransform: "uppercase", marginBottom: 8 }}>
              {WEEK_LABELS.map(w => <div key={w} style={{ textAlign: "center" }}>{w}</div>)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
              {loading
                ? cells.map((_, i) => <div key={i} style={{ background: "var(--yd-soft)", border: "1px dashed var(--yd-border)", borderRadius: 8, minHeight: 72 }} />)
                : cells.map((d, i) => {
                    if (!d) return <div key={i} />;
                    const date = `${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
                    const r    = byDay.get(date);
                    return <DayCell key={i} day={d} record={r} date={date} />;
                  })
              }
            </div>
          </div>

          <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {ATTENDANCE_STATUSES.filter(s => s.value !== "weekend").map(s => (
              <StatusBadge key={s.value} status={s.value} />
            ))}
          </div>
        </>
      )}
    </PageShell>
  );
}

function DayCell({ day, record, date }) {
  const meta = record ? (STATUS_META[record.status] || STATUS_META.absent) : null;
  const hasRecord = !!record;
  return (
    <div title={record ? `${date}\n${record.status}${record.checkIn ? `\nIn: ${fmtTime(record.checkIn)}` : ""}${record.checkOut ? `\nOut: ${fmtTime(record.checkOut)}` : ""}` : date}
      style={{
        background: hasRecord ? meta.bg : "var(--yd-soft)",
        border: `1px solid ${hasRecord ? meta.border : "var(--yd-border)"}`,
        borderRadius: 8, padding: "10px 8px", minHeight: 72,
      }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 700, color: hasRecord ? meta.color : "var(--yd-text)" }}>{day}</span>
        {hasRecord && record.isLate && <span style={{ fontSize: 9, color: "var(--yd-danger)", fontWeight: 700 }}>LATE</span>}
      </div>
      {hasRecord && (
        <div style={{ marginTop: 4, fontSize: 10, color: meta.color, fontWeight: 600 }}>
          {meta.label}
        </div>
      )}
      {hasRecord && record.checkIn && (
        <div style={{ marginTop: 2, fontSize: 10, color: "var(--yd-text-soft)" }}>
          {fmtTime(record.checkIn)}{record.checkOut ? `–${fmtTime(record.checkOut)}` : ""}
        </div>
      )}
    </div>
  );
}
