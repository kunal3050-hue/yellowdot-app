/**
 * MobileCareHygiene.jsx — Care & Hygiene, mobile-native
 * ─────────────────────────────────────────────────────────────────────
 * Staff Home Phase 2 (2026-08-05).
 *
 * Renders in place of the desktop pages/CareHygiene.jsx at mobile
 * viewport widths only (see App.jsx's viewport-aware /care-hygiene
 * route). Calls the exact same careService methods (logCare/
 * getCareHistory/getCareSummary) and the same event TYPES desktop uses
 * — no new backend surface, same server-side authorization.
 *
 * Scope: student list with "last event today" + a one-tap event picker
 * sheet, the module's actual core interaction. The desktop page's class
 * filter chips, search, and full activity timeline stay desktop-only —
 * this is the daily-use fast path, not a full re-port.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { colors, spacing, radius, shadows, typography, layout } from "../../theme/staffMobile";
import { logCare, getCareHistory } from "../../services/careService";
import { getStudents } from "../../services/studentService";

const todayISO = () => new Date().toISOString().slice(0, 10);

const TYPES = [
  { id: "Urine",          emoji: "🟡", label: "Urine" },
  { id: "Motion",         emoji: "🟤", label: "Motion" },
  { id: "Both",           emoji: "🟢", label: "Both" },
  { id: "Diaper Change",  emoji: "🔵", label: "Diaper" },
  { id: "Toilet Visit",   emoji: "🚽", label: "Toilet" },
  { id: "Incident",       emoji: "⚠️", label: "Incident" },
  { id: "Water Refilled", emoji: "💧", label: "Water" },
];

const sid   = s => s.studentId   || s.Student_ID   || s.id;
const sname = s => s.studentName || s.Student_Name || s.name || "Unnamed";
const scls  = s => s.class       || s.Class        || "";

function fmtTime(iso) {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function StudentRow({ student, last, onLog }) {
  const t = last ? TYPES.find(x => x.id === last.type) : null;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: spacing.md,
      background: colors.surface.card, borderRadius: radius.card,
      boxShadow: shadows.card, padding: spacing.lg, marginBottom: spacing.sm,
    }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ ...typography.title, color: colors.text.primary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {sname(student)}
        </div>
        <div style={{ ...typography.caption, color: colors.text.muted, marginTop: 2 }}>
          {last ? `${t?.emoji || "🩺"} ${last.type} · ${fmtTime(last.loggedAt)}` : `${scls(student)} · No events today`}
        </div>
      </div>
      <button
        onClick={onLog}
        style={{
          flexShrink: 0, padding: `${spacing.sm}px ${spacing.md}px`, borderRadius: radius.pill,
          border: "none", background: colors.brand.gradient, color: colors.text.onYellow,
          ...typography.meta, fontWeight: typography.weight.bold, cursor: "pointer",
        }}
      >
        Log Care
      </button>
    </div>
  );
}

function LogSheet({ student, loggingType, onLog, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={() => !loggingType && onClose()} style={{ position: "absolute", inset: 0, background: "rgba(31,29,24,0.48)" }} />
      <div style={{
        position: "relative", width: "100%", maxWidth: layout.contentMax,
        background: colors.surface.background, borderRadius: `${radius["2xl"]}px ${radius["2xl"]}px 0 0`,
        padding: spacing.xl, paddingBottom: spacing["3xl"],
      }}>
        <div style={{ ...typography.title, color: colors.text.primary, marginBottom: spacing.lg }}>
          {sname(student)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: spacing.sm }}>
          {TYPES.map(t => (
            <button
              key={t.id}
              disabled={!!loggingType}
              onClick={() => onLog(t.id)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                padding: `${spacing.md}px ${spacing.xs}px`, borderRadius: radius.md,
                border: `1px solid ${colors.surface.border}`, background: colors.surface.raised,
                cursor: loggingType ? "default" : "pointer", opacity: loggingType && loggingType !== t.id ? 0.5 : 1,
              }}
            >
              <span style={{ fontSize: 18 }}>{t.emoji}</span>
              <span style={{ ...typography.meta, fontWeight: typography.weight.bold, color: colors.text.primary }}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function MobileCareHygiene() {
  const navigate = useNavigate();
  const mountedRef = useRef(true);
  const [students, setStudents] = useState([]);
  const [lastByStud, setLastByStud] = useState({});
  const [loading, setLoading] = useState(true);
  const [sheetStudent, setSheetStudent] = useState(null);
  const [loggingType, setLoggingType] = useState(null);

  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      try {
        const [studRes, histRes] = await Promise.all([
          getStudents(),
          getCareHistory({ date: todayISO(), limit: 500 }),
        ]);
        if (!mountedRef.current) return;
        setStudents(studRes.filter(s => (s.status || s.Status) === "Active"));
        const last = {};
        for (const r of (histRes.records || [])) {
          if (!last[r.studentId] || r.loggedAt > last[r.studentId].loggedAt) last[r.studentId] = r;
        }
        setLastByStud(last);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();
    return () => { mountedRef.current = false; };
  }, []);

  const handleLog = useCallback(async (typeId) => {
    if (!sheetStudent || loggingType) return;
    setLoggingType(typeId);
    const studentId = sid(sheetStudent);
    try {
      await logCare({ studentId, studentName: sname(sheetStudent), class: scls(sheetStudent), type: typeId, notes: "" });
      const now = new Date().toISOString();
      if (mountedRef.current) {
        setLastByStud(prev => ({ ...prev, [studentId]: { studentId, studentName: sname(sheetStudent), type: typeId, loggedAt: now } }));
        setSheetStudent(null);
      }
    } finally {
      if (mountedRef.current) setLoggingType(null);
    }
  }, [sheetStudent, loggingType]);

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
        <div style={{ ...typography.title, color: colors.text.primary }}>Care & Hygiene</div>
      </header>

      <div style={{ padding: `${spacing.lg}px`, maxWidth: layout.contentMax, margin: "0 auto" }}>
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
            <StudentRow key={sid(s)} student={s} last={lastByStud[sid(s)]} onLog={() => setSheetStudent(s)} />
          ))
        )}
      </div>

      {sheetStudent && (
        <LogSheet
          student={sheetStudent}
          loggingType={loggingType}
          onLog={handleLog}
          onClose={() => setSheetStudent(null)}
        />
      )}
    </div>
  );
}
