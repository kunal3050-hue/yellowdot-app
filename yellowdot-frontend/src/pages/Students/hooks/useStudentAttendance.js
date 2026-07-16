/**
 * useStudentAttendance — GET /api/attendance?studentId=&date=
 * Same endpoint as the original inline AttendanceTab logic.
 */
import { useState, useEffect, useRef, useMemo } from "react";
import { get } from "../shared";

export default function useStudentAttendance(studentId) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    get(`/api/attendance?studentId=${encodeURIComponent(studentId)}&date=`)
      .then(d => { if (mountedRef.current) setEntries(d.entries || []); })
      .catch(() => {})
      .finally(() => { if (mountedRef.current) setLoading(false); });
    return () => { mountedRef.current = false; };
  }, [studentId]);

  const summary = useMemo(() => {
    const total   = entries.length;
    const present = entries.filter(e => e.status === "Present").length;
    const absent  = entries.filter(e => e.status === "Absent").length;
    const late    = entries.filter(e => e.status === "Late").length;
    const pct     = total ? Math.round((present / total) * 100) : 0;

    const checkIns = entries.filter(e => e.checkIn).map(e => e.checkIn);
    const avgCheckIn = checkIns.length
      ? (() => {
          const mins = checkIns.map(t => { const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); });
          const avg = Math.round(mins.reduce((a, b) => a + b, 0) / mins.length);
          return `${String(Math.floor(avg / 60)).padStart(2, "0")}:${String(avg % 60).padStart(2, "0")}`;
        })()
      : "—";

    return { total, present, absent, late, pct, avgCheckIn };
  }, [entries]);

  const monthlyTrend = useMemo(() => {
    const byMonth = {};
    entries.forEach(e => {
      if (!e.date) return;
      const month = e.date.slice(0, 7);
      byMonth[month] ??= { month, present: 0, absent: 0, late: 0 };
      if (e.status === "Present") byMonth[month].present++;
      else if (e.status === "Absent") byMonth[month].absent++;
      else if (e.status === "Late") byMonth[month].late++;
    });
    return Object.values(byMonth)
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6)
      .map(m => ({ ...m, month: new Date(`${m.month}-01`).toLocaleDateString("en-IN", { month: "short" }) }));
  }, [entries]);

  return { entries, loading, summary, monthlyTrend };
}
