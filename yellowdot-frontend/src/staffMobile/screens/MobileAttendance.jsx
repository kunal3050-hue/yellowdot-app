/**
 * MobileAttendance.jsx — Attendance, mobile-native
 * ─────────────────────────────────────────────────────────────────────
 * Staff Home Phase 2 (2026-08-05).
 *
 * Renders in place of the desktop pages/Attendance.jsx at mobile
 * viewport widths only (see App.jsx's viewport-aware /attendance route).
 * Calls the exact same attendanceService methods and reads the same
 * `/students` shape (Student_ID/Student_Name/Class with an `id`/`name`/
 * `class` fallback — copied from Attendance.jsx's own field access, not
 * a new normalization) — no new backend surface, same server-side
 * authorization as the desktop page.
 *
 * Scope: one-tap-per-student marking + the existing "Mark All Present"
 * bulk action. QR scanning, student QR cards and the History tab stay
 * desktop-only for now (this screen is the daily-use fast path, not a
 * full re-port of every Attendance view).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Check, X, Clock3 } from "lucide-react";
import { colors, spacing, radius, shadows, typography, layout } from "../../theme/staffMobile";
import attendanceService from "../../services/attendanceService";
import { getStudents } from "../../services/studentService";

const todayISO = () => new Date().toISOString().slice(0, 10);

// Same fmtClock as pages/Attendance.jsx: checkIn/checkOut are UTC wall-clock
// strings ("HH:MM:SS") combined with the entry's date, except when they're
// already-formatted display strings (e.g. from a fresh optimistic write) or
// full ISO timestamps (seed data) — both pass through unchanged when the
// combined string fails to parse.
function fmtClock(dateISO, timeStr) {
  if (!timeStr) return "";
  const d = new Date(`${dateISO}T${timeStr}Z`);
  if (isNaN(d.getTime())) return timeStr;
  return d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true });
}

const STATUS_TONE = {
  Present: { bg: colors.successSoft, fg: colors.successStrong },
  Absent:  { bg: colors.dangerSoft,  fg: colors.dangerStrong },
  Late:    { bg: colors.warningSoft, fg: colors.warningStrong },
};

const sidOf   = s => s.Student_ID || s.id;
const nameOf  = s => s.Student_Name || s.name || "Unnamed";
const classOf = s => s.Class || s.class || "";

function StudentRow({ student, entry, saving, onMark }) {
  const status = entry?.status;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: spacing.md,
      background: colors.surface.card, borderRadius: radius.card,
      boxShadow: shadows.card, padding: spacing.lg, marginBottom: spacing.sm,
    }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ ...typography.title, color: colors.text.primary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {nameOf(student)}
        </div>
        <div style={{ ...typography.caption, color: colors.text.muted, marginTop: 2 }}>
          {classOf(student)}{entry?.checkIn ? ` · ${fmtClock(entry.date, entry.checkIn)}` : ""}
        </div>
      </div>

      <div style={{ display: "flex", gap: spacing.xs, flexShrink: 0 }}>
        {["Present", "Late", "Absent"].map(opt => {
          const active = status === opt;
          const tone = STATUS_TONE[opt];
          const Icon = opt === "Present" ? Check : opt === "Late" ? Clock3 : X;
          return (
            <button
              key={opt}
              disabled={!!saving}
              onClick={() => onMark(student, opt)}
              aria-label={opt}
              style={{
                width: 38, height: 38, borderRadius: radius.md,
                border: `1px solid ${active ? tone.fg : colors.surface.border}`,
                background: active ? tone.bg : colors.surface.raised,
                color: active ? tone.fg : colors.text.faint,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1,
              }}
            >
              <Icon size={16} strokeWidth={2.2} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function MobileAttendance() {
  const navigate = useNavigate();
  const mountedRef = useRef(true);
  const savingRef = useRef({});
  const [students, setStudents] = useState([]);
  const [entries, setEntries] = useState([]);
  const [saving, setSaving] = useState({});
  const [loading, setLoading] = useState(true);
  const [bulkBusy, setBulkBusy] = useState(false);

  const date = todayISO();

  const load = useCallback(async () => {
    try {
      const [studRes, attRes] = await Promise.all([
        getStudents(),
        attendanceService.getAttendance({ date }),
      ]);
      if (!mountedRef.current) return;
      const active = studRes.filter(s => (s.Status || s.status || "Active") === "Active");
      setStudents(active);
      setEntries(attRes.entries || []);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => { mountedRef.current = false; };
  }, [load]);

  const entryMap = useMemo(() => {
    const m = {};
    for (const e of entries) m[e.studentId] = e;
    return m;
  }, [entries]);

  const handleMark = useCallback(async (student, status) => {
    const sid = sidOf(student);
    if (savingRef.current[sid]) return;
    savingRef.current[sid] = true;
    setSaving(s => ({ ...s, [sid]: true }));

    const nowTime = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
    setEntries(prev => {
      const next = prev.filter(e => e.studentId !== sid);
      const existing = prev.find(e => e.studentId === sid);
      next.push({
        ...(existing || {}),
        studentId: sid, studentName: nameOf(student), class: classOf(student),
        status, date, checkIn: existing?.checkIn || (status !== "Absent" ? nowTime : ""),
        attendanceMethod: "Manual",
      });
      return next;
    });

    try {
      await attendanceService.markAttendance({
        studentId: sid, studentName: nameOf(student), class: classOf(student),
        status, date, attendanceMethod: "Manual",
      });
    } catch {
      if (mountedRef.current) setEntries(prev => prev.filter(e => e.studentId !== sid));
    } finally {
      savingRef.current[sid] = false;
      if (mountedRef.current) setSaving(s => ({ ...s, [sid]: false }));
    }
  }, [date]);

  const unmarked = students.filter(s => !entryMap[sidOf(s)]?.status);

  const handleMarkAllPresent = useCallback(async () => {
    setBulkBusy(true);
    for (const s of unmarked) await handleMark(s, "Present");
    if (mountedRef.current) setBulkBusy(false);
  }, [unmarked, handleMark]);

  return (
    <div style={{ minHeight: "100vh", background: colors.surface.background }}>
      <header style={{
        position: "sticky", top: 0, zIndex: 10, height: layout.topbarHeight,
        background: colors.surface.backgroundTranslucent, backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${colors.surface.border}`,
        display: "flex", alignItems: "center", gap: spacing.sm, padding: `0 ${spacing.lg}px`,
      }}>
        <button onClick={() => navigate(-1)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: colors.text.primary }}>
          <ChevronLeft size={22} />
        </button>
        <div style={{ ...typography.title, color: colors.text.primary }}>Attendance</div>
      </header>

      <div style={{ padding: `${spacing.lg}px ${spacing.lg}px ${spacing["3xl"]}px`, maxWidth: layout.contentMax, margin: "0 auto" }}>
        {!loading && unmarked.length > 0 && (
          <button
            onClick={handleMarkAllPresent}
            disabled={bulkBusy}
            style={{
              width: "100%", marginBottom: spacing.lg, padding: spacing.md,
              borderRadius: radius.card, border: "none", cursor: bulkBusy ? "default" : "pointer",
              background: colors.brand.gradient, color: colors.text.onYellow,
              ...typography.button, boxShadow: shadows.primary, opacity: bulkBusy ? 0.7 : 1,
            }}
          >
            Mark All Present ({unmarked.length})
          </button>
        )}

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ height: 72, borderRadius: radius.card, background: colors.surface.raised, opacity: 0.6 }} />
            ))}
          </div>
        ) : students.length === 0 ? (
          <div style={{ padding: spacing["2xl"], textAlign: "center", color: colors.text.muted }}>
            <div style={{ ...typography.caption }}>No students found.</div>
          </div>
        ) : (
          students.map(s => (
            <StudentRow
              key={sidOf(s)}
              student={s}
              entry={entryMap[sidOf(s)]}
              saving={saving[sidOf(s)]}
              onMark={handleMark}
            />
          ))
        )}
      </div>
    </div>
  );
}
