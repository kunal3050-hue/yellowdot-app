import { useState, useEffect, useCallback, useRef } from "react";
import Sidebar from "../components/Sidebar";
import { logCare, getCareHistory, getCareSummary } from "../services/careService";
import { api } from "../services/authService";

// ─────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────

const CLASSES = ["All", "Playgroup", "Nursery", "Junior K.G.", "Senior K.G.", "Daycare"];

const TYPES = [
  { id: "Urine",          emoji: "🟡", label: "Urine",        bg: "#FEF9C3", border: "#FDE047", text: "#713F12" },
  { id: "Motion",         emoji: "🟤", label: "Motion",       bg: "#FEF3C7", border: "#F59E0B", text: "#78350F" },
  { id: "Both",           emoji: "🟢", label: "Both",         bg: "#DCFCE7", border: "#86EFAC", text: "#14532D" },
  { id: "Diaper Change",  emoji: "🔵", label: "Diaper Change",bg: "#DBEAFE", border: "#93C5FD", text: "#1E3A8A" },
  { id: "Toilet Visit",   emoji: "🚽", label: "Toilet Visit", bg: "#F1F5F9", border: "#94A3B8", text: "#1E293B" },
  { id: "Incident",       emoji: "⚠️", label: "Incident",     bg: "#FEE2E2", border: "#FCA5A5", text: "#7F1D1D" },
  { id: "Water Refilled", emoji: "💧", label: "Water Refilled",bg: "#CFFAFE", border: "#67E8F9", text: "#164E63" },
];

const AVATAR_GRADIENTS = [
  ["#92400E","#78350F"],["#B45309","#92400E"],["#D97706","#B45309"],
  ["#059669","#065F46"],["#0891B2","#0E7490"],["#4338CA","#3730A3"],
  ["#DC2626","#991B1B"],["#7C3AED","#6D28D9"],
];

const W = {
  charcoal1: "#4A3A22", charcoal2: "#6A5737",
  gold1: "#F6D54A", gold2: "#F1C933",
  goldPale: "#FFF7D6", goldBorder: "#EFD978",
  bg1: "#FFFDF7", bg2: "#FFFBF0", bg3: "#FFF8E8",
  muted1: "#8B7355", muted2: "#6A5737",
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700;800;900&display=swap');
  .ch-page, .ch-page * { font-family: 'Inter Tight', system-ui, -apple-system, sans-serif; box-sizing: border-box; }
  .ch-card {
    background: linear-gradient(145deg,#fffdf6,#f8f4ea);
    box-shadow: 0 2px 4px rgba(31,26,23,.04), 0 8px 24px rgba(31,26,23,.06);
    border: 1px solid rgba(139,125,101,.09);
  }
  .ch-child-card {
    background: #fffdf8;
    border: 1px solid rgba(139,125,101,.10);
    box-shadow: 0 1px 3px rgba(31,26,23,.04);
    transition: box-shadow 140ms ease, border-color 140ms ease;
  }
  .ch-child-card:hover { border-color: rgba(139,125,101,.20); box-shadow: 0 2px 8px rgba(31,26,23,.07); }
  .ch-log-btn {
    background: linear-gradient(135deg,#F6D54A,#F1C933);
    color: #4A3A22;
    border: none;
    font-weight: 700;
    cursor: pointer;
    transition: transform 80ms ease, box-shadow 80ms ease;
  }
  .ch-log-btn:hover { box-shadow: 0 2px 8px rgba(241,201,51,.35); }
  .ch-log-btn:active { transform: scale(0.94); }
  .ch-log-btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }
  .ch-input {
    background: rgba(255,253,246,.80);
    border: 1px solid rgba(139,125,101,.12);
    border-radius: 999px;
    outline: none;
    transition: border-color 180ms ease, box-shadow 180ms ease;
  }
  .ch-input:focus { border-color: rgba(244,196,48,.50); box-shadow: 0 0 0 2.5px rgba(244,196,48,.20); }
  .ch-pill-active { background: linear-gradient(135deg,#F6D54A,#F1C933); color: #4A3A22; box-shadow: 0 2px 6px rgba(241,201,51,.28); }
  .ch-type-btn {
    cursor: pointer;
    transition: transform 70ms ease, box-shadow 70ms ease;
    border: none;
  }
  .ch-type-btn:hover { transform: translateY(-1px); box-shadow: 0 3px 10px rgba(0,0,0,.10); }
  .ch-type-btn:active { transform: scale(0.92); }
  .ch-type-btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }
  @keyframes ch-sheet-in { from { transform: translateY(100%); } to { transform: translateY(0); } }
  @keyframes ch-fade-in  { from { opacity:0; } to { opacity:1; } }
  @keyframes ch-spring-in { 0%{transform:scale(.92) translateY(6px);opacity:0} 60%{transform:scale(1.02);opacity:1} 100%{transform:scale(1) translateY(0);opacity:1} }
  .ch-sheet-in  { animation: ch-sheet-in  280ms cubic-bezier(.16,1,.3,1) both; }
  .ch-fade-in   { animation: ch-fade-in   200ms ease both; }
  .ch-spring-in { animation: ch-spring-in 320ms cubic-bezier(.16,1,.3,1) both; }
  .ch-timeline-row:hover { background: rgba(244,196,48,.06); border-radius: 10px; }
`;

// ─────────────────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────────────────
const todayISO = () => new Date().toISOString().slice(0, 10);

function fmtTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d) ? "" : d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
}
function fmtDate(iso) {
  if (!iso) return "";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function initials(name = "") {
  return name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase() || "?";
}
function avatarGrad(name = "") {
  return AVATAR_GRADIENTS[name.charCodeAt(0) % AVATAR_GRADIENTS.length] || AVATAR_GRADIENTS[0];
}
const sid   = s => s.studentId   || s.Student_ID   || "";
const sname = s => s.studentName || s.Student_Name || "";
const scls  = s => s.class       || s.Class        || "";

// ─────────────────────────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([]);
  const dismiss = useCallback(id => setToasts(t => t.filter(x => x.id !== id)), []);
  const add = useCallback((type, msg) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, type, msg }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);
  return { toasts, success: m => add("ok", m), error: m => add("err", m), dismiss };
}

// ─────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────
export default function CareHygiene() {
  const toast = useToast();
  const mountedRef = useRef(true);

  const [students,   setStudents]   = useState([]);
  const [lastByStud, setLastByStud] = useState({});
  const [todayTotal, setTodayTotal] = useState(0);
  const [history,    setHistory]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [bootError,  setBootError]  = useState(false);
  const [classFilter, setClassFilter] = useState("All");
  const [search,      setSearch]      = useState("");
  const [histDate,    setHistDate]    = useState(todayISO());
  const [histLoading, setHistLoading] = useState(false);

  // Log sheet: null | { studentId, studentName, class }
  const [sheet,       setSheet]       = useState(null);
  const [sheetLogging, setSheetLogging] = useState(null); // typeId being logged
  const [sheetNote,   setSheetNote]   = useState("");
  const [showNote,    setShowNote]    = useState(false);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  useEffect(() => { boot(); }, []); // eslint-disable-line
  useEffect(() => { if (!loading) fetchHistory(histDate); }, [histDate]); // eslint-disable-line

  // ── Boot ──────────────────────────────────────────────────────
  async function boot() {
    if (!mountedRef.current) return;
    setLoading(true); setBootError(false);
    try {
      const [studRes, histRes, sumRes] = await Promise.all([
        api({ method: "GET", url: "/students" }).then(r => r.data),
        getCareHistory({ date: todayISO(), limit: 500 }),
        getCareSummary({ date: todayISO() }),
      ]);
      if (!mountedRef.current) return;
      setStudents(Array.isArray(studRes) ? studRes.filter(s => (s.status || s.Status) === "Active") : []);
      applyHistory(histRes.records || []);
      setTodayTotal((sumRes.summary || {}).total || 0);
    } catch {
      if (mountedRef.current) setBootError(true);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  function applyHistory(records) {
    const last = {};
    for (const r of records) {
      if (!last[r.studentId] || r.loggedAt > last[r.studentId].loggedAt) last[r.studentId] = r;
    }
    setLastByStud(last);
    setHistory(records);
  }

  async function fetchHistory(date) {
    setHistLoading(true);
    try {
      const [histRes, sumRes] = await Promise.all([
        getCareHistory({ date, limit: 500 }),
        date === todayISO() ? getCareSummary({ date }) : Promise.resolve(null),
      ]);
      if (!mountedRef.current) return;
      if (date === todayISO()) {
        applyHistory(histRes.records || []);
        setTodayTotal(((sumRes || {}).summary || {}).total || 0);
      } else {
        setHistory(histRes.records || []);
      }
    } catch { /* non-critical */ }
    finally { if (mountedRef.current) setHistLoading(false); }
  }

  // ── Open / close sheet ────────────────────────────────────────
  function openSheet(student) {
    setSheet({ studentId: sid(student), studentName: sname(student), class: scls(student) });
    setSheetNote(""); setShowNote(false); setSheetLogging(null);
  }
  function closeSheet() { if (!sheetLogging) { setSheet(null); } }

  // ── Log via sheet ─────────────────────────────────────────────
  async function handleLog(typeId) {
    if (!sheet || sheetLogging) return;
    setSheetLogging(typeId);
    try {
      await logCare({ studentId: sheet.studentId, studentName: sheet.studentName, class: sheet.class, type: typeId, notes: sheetNote.trim() });
      const now = new Date().toISOString();
      const rec = { logId: now + sheet.studentId, studentId: sheet.studentId, studentName: sheet.studentName, type: typeId, notes: sheetNote.trim(), loggedAt: now, date: todayISO() };
      setLastByStud(prev => ({ ...prev, [sheet.studentId]: rec }));
      setTodayTotal(prev => prev + 1);
      setHistory(prev => [rec, ...prev]);
      setSheet(null);
      toast.success(`${sheet.studentName} — ${typeId} logged`);
    } catch (e) {
      toast.error(e.message || "Could not save.");
      setSheetLogging(null);
    }
  }

  // ── Derived ───────────────────────────────────────────────────
  const visible = students
    .filter(s => classFilter === "All" || scls(s) === classFilter)
    .filter(s => !search || sname(s).toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="ch-page flex min-h-screen" style={{ background: `linear-gradient(150deg,${W.bg1},${W.bg2} 50%,${W.bg3})` }}>
      <style>{CSS}</style>
      <Sidebar />

      <div className="flex-1 min-w-0 overflow-auto">

        {/* ── STICKY HEADER ───────────────────────────────────── */}
        <div className="sticky top-0 z-20"
          style={{ background: "rgba(255,253,246,.94)", borderBottom: "1px solid rgba(139,125,101,.10)", backdropFilter: "blur(16px)", boxShadow: "0 4px 20px rgba(31,26,23,.05)" }}>
          <div className="px-5 md:px-8 py-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
              <div className="flex items-center gap-3 flex-shrink-0">
                <h1 className="text-[clamp(1.3rem,3vw,1.75rem)] font-black tracking-[-0.04em] leading-none" style={{ color: W.charcoal1 }}>
                  🩺 Care &amp; Hygiene
                </h1>
                {!loading && (
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full tabular-nums"
                    style={{ background: "rgba(244,196,48,.14)", color: W.charcoal2, border: "1px solid rgba(244,196,48,.28)" }}>
                    {todayTotal} today
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 sm:ml-auto overflow-x-auto scrollbar-none pb-0.5">
                {CLASSES.map(c => (
                  <button key={c} onClick={() => setClassFilter(c)}
                    className={`px-2.5 py-1 rounded-full text-[11px] whitespace-nowrap flex-shrink-0 font-semibold transition-all duration-150 ${classFilter === c ? "ch-pill-active" : ""}`}
                    style={classFilter !== c ? { background: "rgba(139,125,101,.07)", color: W.muted1, border: "1px solid rgba(139,125,101,.09)" } : {}}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 md:px-8 py-5 space-y-4">

          {/* ── SEARCH ──────────────────────────────────────────── */}
          <div className="flex items-center gap-2.5">
            <div className="relative max-w-[220px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none" style={{ color: W.muted1 }}>🔍</span>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search children…" className="ch-input w-full pl-8 pr-3 py-1.5 text-[12.5px]"
                style={{ color: W.charcoal1, fontWeight: 500 }} />
            </div>
            {!loading && (
              <span className="text-[11px] font-bold" style={{ color: W.muted1 }}>
                {visible.length} {classFilter === "All" ? "children" : classFilter}
              </span>
            )}
          </div>

          {/* ── CHILD CARDS ─────────────────────────────────────── */}
          <div className="ch-card rounded-[24px] p-4">
            {loading ? <SkeletonCards /> : bootError ? <ErrorState onRetry={boot} /> : visible.length === 0 ? <EmptyStudents searched={!!search} /> : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
                {visible.map((s, i) => {
                  const id   = sid(s);
                  const last = lastByStud[id];
                  return (
                    <ChildCard key={id} student={s} last={last} animDelay={i * 18}
                      onLog={() => openSheet(s)} />
                  );
                })}
              </div>
            )}
          </div>

          {/* ── ACTIVITY LOG ────────────────────────────────────── */}
          <ActivityLog
            history={history} loading={histLoading}
            histDate={histDate} onDateChange={d => setHistDate(d)}
          />

        </div>
      </div>

      {/* ── LOG SHEET ───────────────────────────────────────────── */}
      {sheet && (
        <LogSheet
          student={sheet}
          loggingType={sheetLogging}
          note={sheetNote}
          showNote={showNote}
          onNote={v => setSheetNote(v)}
          onToggleNote={() => setShowNote(n => !n)}
          onLog={handleLog}
          onClose={closeSheet}
        />
      )}

      <ToastStack toasts={toast.toasts} onDismiss={toast.dismiss} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// CHILD CARD
// ─────────────────────────────────────────────────────────────────
function ChildCard({ student, last, animDelay, onLog }) {
  const name = sname(student);
  const klass = scls(student);
  const [from, to] = avatarGrad(name);
  const t = last ? TYPES.find(x => x.id === last.type) : null;

  return (
    <div className="ch-child-card rounded-[16px] p-3 flex items-center gap-3 ch-spring-in"
      style={{ animationDelay: `${animDelay}ms` }}>
      {/* Avatar */}
      <div className="w-10 h-10 rounded-[11px] flex-shrink-0 flex items-center justify-center text-white font-black text-[11px] select-none"
        style={{ background: `linear-gradient(135deg,${from},${to})`, boxShadow: "0 2px 6px rgba(31,26,23,.12)" }}>
        {initials(name)}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold leading-tight truncate" style={{ color: W.charcoal1 }}>{name}</p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {klass && (
            <span className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded-md" style={{ background: "rgba(139,125,101,.09)", color: W.muted1 }}>{klass}</span>
          )}
          {last ? (
            <span className="text-[10.5px]" style={{ color: W.muted2 }}>
              {t?.emoji || "🩺"} {last.type} · {fmtTime(last.loggedAt)}
            </span>
          ) : (
            <span className="text-[10.5px]" style={{ color: W.muted1, opacity: 0.55 }}>No events today</span>
          )}
        </div>
      </div>

      {/* CTA */}
      <button onClick={onLog}
        className="ch-log-btn flex-shrink-0 text-[11.5px] px-3 py-1.5 rounded-full"
        style={{ fontSize: 11.5 }}>
        Log Care
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// LOG SHEET (bottom sheet modal)
// ─────────────────────────────────────────────────────────────────
function LogSheet({ student, loggingType, note, showNote, onNote, onToggleNote, onLog, onClose }) {
  const [from, to] = avatarGrad(student.studentName);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 ch-fade-in" onClick={onClose}
        style={{ background: "rgba(31,26,23,.48)", backdropFilter: "blur(4px)" }} />

      {/* Sheet */}
      <div className="relative w-full max-w-lg ch-sheet-in rounded-t-[28px] overflow-hidden"
        style={{ background: W.bg1, boxShadow: "0 -8px 40px rgba(31,26,23,.16)" }}>
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-8 h-[3px] rounded-full" style={{ background: "rgba(139,125,101,.18)" }} />
        </div>

        <div className="px-5 pt-2 pb-6 space-y-4">
          {/* Child header */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[10px] flex-shrink-0 flex items-center justify-center text-white font-black text-[10px]"
              style={{ background: `linear-gradient(135deg,${from},${to})` }}>
              {initials(student.studentName)}
            </div>
            <div>
              <p className="text-[14px] font-bold leading-tight" style={{ color: W.charcoal1 }}>{student.studentName}</p>
              {student.class && <p className="text-[11px]" style={{ color: W.muted1 }}>{student.class}</p>}
            </div>
            <button onClick={onClose} disabled={!!loggingType}
              className="ml-auto w-7 h-7 rounded-full flex items-center justify-center text-sm font-black transition-all active:scale-90 disabled:opacity-40"
              style={{ background: "rgba(139,125,101,.10)", color: W.muted1, border: "none", cursor: loggingType ? "default" : "pointer" }}>
              ×
            </button>
          </div>

          {/* Event type grid */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-2.5" style={{ color: W.muted1 }}>Select event</p>
            <div className="grid grid-cols-4 gap-2">
              {TYPES.map(t => (
                <button key={t.id} onClick={() => onLog(t.id)} disabled={!!loggingType}
                  className="ch-type-btn flex flex-col items-center gap-1 py-2.5 px-1 rounded-[14px] text-center"
                  style={{ background: t.bg, border: `1.5px solid ${t.border}`,
                    boxShadow: loggingType === t.id ? `0 0 0 3px ${t.border}` : "none" }}>
                  {loggingType === t.id
                    ? <span className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin block"
                        style={{ borderColor: `${t.text} transparent transparent transparent` }} />
                    : <span style={{ fontSize: 18, lineHeight: 1 }}>{t.emoji}</span>}
                  <span className="text-[10px] font-bold leading-tight" style={{ color: t.text }}>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Optional note */}
          <div>
            <button onClick={onToggleNote}
              className="text-[11.5px] font-semibold flex items-center gap-1 transition-all active:scale-95"
              style={{ color: W.muted2, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              <span>{showNote ? "▾" : "▸"}</span>
              {showNote ? "Hide note" : "Add optional note"}
            </button>
            {showNote && (
              <textarea value={note} onChange={e => onNote(e.target.value)} rows={2}
                placeholder="E.g. rash noticed, used extra wipes…"
                autoFocus
                className="mt-2 w-full rounded-2xl px-4 py-2.5 resize-none text-[12.5px]"
                style={{ background: "rgba(248,244,234,.80)", border: "1px solid rgba(139,125,101,.13)", color: W.charcoal1, outline: "none" }} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// ACTIVITY LOG
// ─────────────────────────────────────────────────────────────────
function ActivityLog({ history, loading, histDate, onDateChange }) {
  return (
    <div className="ch-card rounded-[24px] p-4 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 rounded-full flex-shrink-0" style={{ background: "linear-gradient(180deg,#F6D54A,#D4A820)" }} />
          <h2 className="text-[15px] font-bold tracking-[-0.02em]" style={{ color: W.charcoal1 }}>Activity Log</h2>
          <span className="text-[11px]" style={{ color: W.muted1 }}>
            {loading ? "Loading…" : `${history.length} events · ${fmtDate(histDate)}`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none" style={{ color: W.muted1 }}>📅</span>
            <input type="date" value={histDate} max={todayISO()} onChange={e => onDateChange(e.target.value)}
              className="ch-input pl-8 pr-3 py-1.5 text-[12px] cursor-pointer" style={{ color: W.charcoal1, fontWeight: 500, borderRadius: 999 }} />
          </div>
          {histDate !== todayISO() && (
            <button onClick={() => onDateChange(todayISO())}
              className="text-[11px] font-bold px-3 py-1.5 rounded-full transition-all active:scale-95"
              style={{ background: "rgba(244,196,48,.12)", color: W.charcoal2, border: "1px solid rgba(244,196,48,.28)" }}>
              Today
            </button>
          )}
        </div>
      </div>

      {loading ? <SkeletonTimeline /> : history.length === 0 ? <EmptyTimeline /> : (
        <div>
          {history.map((r, i) => {
            const t = TYPES.find(x => x.id === r.type);
            const [from, to] = avatarGrad(r.studentName || "");
            return (
              <div key={r.logId || i}>
                {i > 0 && <div style={{ height: 1, background: "rgba(139,125,101,.06)", margin: "0 4px" }} />}
                <div className="ch-timeline-row flex items-center gap-2.5 py-1.5 px-2">
                  <span className="text-[10px] font-mono tabular-nums flex-shrink-0 w-12 text-right" style={{ color: W.muted1 }}>{fmtTime(r.loggedAt)}</span>
                  <div className="w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center text-white font-black text-[8px]"
                    style={{ background: `linear-gradient(135deg,${from},${to})` }}>
                    {initials(r.studentName || "")}
                  </div>
                  <span className="text-[12px] font-semibold truncate flex-shrink-0 max-w-[110px]" style={{ color: W.charcoal1 }}>{r.studentName}</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0"
                    style={{ background: t?.bg || W.goldPale, border: `1px solid ${t?.border || W.goldBorder}`, color: t?.text || W.charcoal1 }}>
                    {t?.emoji || "🩺"} {r.type}
                  </span>
                  {r.notes && <span className="text-[10px] truncate italic flex-shrink min-w-0" style={{ color: W.muted1 }}>{r.notes}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────────────────────────
function ToastStack({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-6 right-4 sm:right-6 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className="ch-fade-in flex items-center gap-2.5 px-4 py-2.5 rounded-2xl shadow-lg text-[12.5px] font-semibold pointer-events-auto"
          style={t.type === "ok"
            ? { background: W.goldPale, color: W.charcoal1, border: `1px solid ${W.goldBorder}`, boxShadow: "0 4px 16px rgba(240,200,70,.18)" }
            : { background: "#7F1D1D", color: "#fff" }}>
          <span>{t.type === "ok" ? "✓" : "⚠️"}</span>
          <span>{t.msg}</span>
          <button onClick={() => onDismiss(t.id)}
            className="ml-1 w-4 h-4 flex items-center justify-center rounded-full text-xs font-black opacity-60 hover:opacity-100"
            style={{ background: "rgba(0,0,0,.08)", border: "none", cursor: "pointer" }}>×</button>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SKELETONS & EMPTY STATES
// ─────────────────────────────────────────────────────────────────
function SkeletonCards() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="rounded-[16px] p-3 flex items-center gap-3 animate-pulse"
          style={{ background: W.bg2, border: "1px solid rgba(139,125,101,.07)", animationDelay: `${i * 40}ms` }}>
          <div className="w-10 h-10 rounded-[11px] flex-shrink-0" style={{ background: "rgba(139,125,101,.12)" }} />
          <div className="flex-1">
            <div className="h-3 w-24 rounded-full mb-1.5" style={{ background: "rgba(139,125,101,.12)" }} />
            <div className="h-2.5 w-32 rounded-full" style={{ background: "rgba(139,125,101,.08)" }} />
          </div>
          <div className="h-7 w-16 rounded-full flex-shrink-0" style={{ background: "rgba(244,196,48,.20)" }} />
        </div>
      ))}
    </div>
  );
}

function SkeletonTimeline() {
  return (
    <div className="space-y-1">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2.5 py-1.5 px-2 animate-pulse" style={{ animationDelay: `${i * 50}ms` }}>
          <div className="h-2 w-12 rounded-full" style={{ background: "rgba(139,125,101,.10)" }} />
          <div className="w-6 h-6 rounded-lg flex-shrink-0" style={{ background: "rgba(139,125,101,.10)" }} />
          <div className="h-2.5 w-20 rounded-full" style={{ background: "rgba(139,125,101,.10)" }} />
          <div className="h-5 w-20 rounded-full" style={{ background: "rgba(139,125,101,.08)" }} />
        </div>
      ))}
    </div>
  );
}

function ErrorState({ onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="text-2xl mb-2">⚠️</div>
      <p className="font-bold text-[14px] mb-1" style={{ color: W.charcoal1 }}>Connection Error</p>
      <p className="text-[11.5px] mb-4" style={{ color: W.muted1 }}>Could not reach the server.</p>
      <button onClick={onRetry} className="ch-log-btn px-5 py-2 rounded-full text-[12px]">↺ Retry</button>
    </div>
  );
}

function EmptyStudents({ searched }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="text-2xl mb-2">{searched ? "🔍" : "🎒"}</div>
      <p className="font-bold text-[13px]" style={{ color: W.charcoal1 }}>{searched ? "No matches" : "No students"}</p>
      <p className="text-[11px] mt-1" style={{ color: W.muted1 }}>{searched ? "Try a different filter." : "Add students first."}</p>
    </div>
  );
}

function EmptyTimeline() {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="text-xl mb-1.5">📋</div>
      <p className="text-[12.5px] font-semibold" style={{ color: W.charcoal1 }}>No events yet</p>
      <p className="text-[11px] mt-0.5" style={{ color: W.muted1 }}>Log events above to see them here.</p>
    </div>
  );
}
