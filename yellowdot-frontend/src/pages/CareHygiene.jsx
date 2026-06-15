import { useState, useEffect, useCallback, useRef } from "react";
import Sidebar from "../components/Sidebar";
import { logCare, getCareHistory, getCareSummary } from "../services/careService";
import { api } from "../services/authService";
import { useAuth } from "../contexts/AuthContext";

// ─────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────

const CLASSES = ["All", "Playgroup", "Nursery", "Junior K.G.", "Senior K.G.", "Daycare"];

const TYPES = [
  { id: "Urine",          emoji: "🟡", label: "Urine",    shortLabel: "Urine",   bg: "#FEF9C3", border: "#FDE047", text: "#713F12" },
  { id: "Motion",         emoji: "🟤", label: "Motion",   shortLabel: "Motion",  bg: "#FEF3C7", border: "#F59E0B", text: "#78350F" },
  { id: "Both",           emoji: "🟢", label: "Both",     shortLabel: "Both",    bg: "#DCFCE7", border: "#86EFAC", text: "#14532D" },
  { id: "Diaper Change",  emoji: "🔵", label: "Diaper",   shortLabel: "Diaper",  bg: "#DBEAFE", border: "#93C5FD", text: "#1E3A8A" },
  { id: "Toilet Visit",   emoji: "🚽", label: "Toilet",   shortLabel: "Toilet",  bg: "#F1F5F9", border: "#94A3B8", text: "#1E293B" },
  { id: "Accident",       emoji: "⚠️", label: "Accident", shortLabel: "Oops",   bg: "#FEE2E2", border: "#FCA5A5", text: "#7F1D1D" },
  { id: "Water Refilled", emoji: "💧", label: "Water",    shortLabel: "Water",   bg: "#CFFAFE", border: "#67E8F9", text: "#164E63" },
];

const STAT_CARDS = [
  { typeId: "Urine",          emoji: "🟡", label: "Urine Logs",      bg: "linear-gradient(160deg,#FEF9C3,#FEF08A)", border: "#FDE047", text: "#713F12" },
  { typeId: "Motion",         emoji: "🟤", label: "Motion Logs",     bg: "linear-gradient(160deg,#FEF3C7,#FDE68A)", border: "#F59E0B", text: "#78350F" },
  { typeId: "Diaper Change",  emoji: "🔵", label: "Diaper Changes",  bg: "linear-gradient(160deg,#DBEAFE,#BFDBFE)", border: "#93C5FD", text: "#1E3A8A" },
  { typeId: "Water Refilled", emoji: "💧", label: "Water Refills",   bg: "linear-gradient(160deg,#CFFAFE,#A5F3FC)", border: "#67E8F9", text: "#164E63" },
  { typeId: "__total__",      emoji: "📊", label: "Total Events",    bg: "linear-gradient(160deg,#FFF7D6,#F7E7A8)", border: "#EFD978", text: "#4A3A22" },
];

const AVATAR_GRADIENTS = [
  ["#92400E","#78350F"],["#B45309","#92400E"],["#D97706","#B45309"],
  ["#059669","#065F46"],["#0891B2","#0E7490"],["#4338CA","#3730A3"],
  ["#DC2626","#991B1B"],["#7C3AED","#6D28D9"],
];

// ─────────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────
const W = {
  charcoal1: "#4A3A22", charcoal2: "#6A5737",
  gold1: "#F6D54A", gold2: "#F1C933", gold3: "#D4A820",
  goldPale: "#FFF7D6", goldMid: "#F7E7A8", goldBorder: "#EFD978",
  bg1: "#FFFDF7", bg2: "#FFFBF0", bg3: "#FFF8E8",
  muted1: "#8B7355", muted2: "#6A5737",
};

const CARE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700;800;900&display=swap');
  .ch-page, .ch-page * { font-family: 'Inter Tight', system-ui, -apple-system, sans-serif; box-sizing: border-box; }
  .ch-card {
    background: linear-gradient(145deg,#fffdf6 0%,#f8f4ea 100%);
    box-shadow: 0 1px 0 rgba(255,255,255,.90) inset, 0 2px 4px rgba(31,26,23,.04), 0 12px 36px rgba(31,26,23,.07);
    border: 1px solid rgba(139,125,101,.09);
  }
  .ch-student-card {
    background: linear-gradient(150deg,#fffdf6 0%,#fdf9ee 100%);
    box-shadow: 0 1px 0 rgba(255,255,255,.8) inset, 0 1px 3px rgba(31,26,23,.05), 0 4px 12px rgba(31,26,23,.05);
    border: 1px solid rgba(139,125,101,.08);
    transition: box-shadow 140ms ease, border-color 140ms ease, transform 140ms ease;
  }
  .ch-student-card:hover {
    box-shadow: 0 1px 0 rgba(255,255,255,.9) inset, 0 2px 6px rgba(31,26,23,.07), 0 10px 28px rgba(31,26,23,.09);
    border-color: rgba(139,125,101,.14);
    transform: translateY(-1px);
  }
  .ch-student-card.ch-selected {
    border-color: #F6D54A;
    background: linear-gradient(150deg,#FFFDE7 0%,#FFF9C4 100%);
    box-shadow: 0 0 0 2px rgba(246,213,74,.30), 0 4px 12px rgba(31,26,23,.06);
  }
  .ch-action-btn {
    transition: transform 80ms ease, box-shadow 80ms ease, opacity 80ms ease;
    cursor: pointer;
  }
  .ch-action-btn:active:not(:disabled) { transform: scale(0.88); }
  .ch-action-btn:disabled { opacity: 0.45; cursor: not-allowed; }
  .ch-pill-active {
    background: linear-gradient(135deg,#F6D54A 0%,#F1C933 100%);
    box-shadow: 0 2px 8px rgba(241,201,51,.32), 0 1px 0 rgba(255,255,255,.50) inset;
    color: #4A3A22;
  }
  .ch-input {
    background: linear-gradient(180deg,#fffdf8 0%,#fdfaf0 100%);
    box-shadow: 0 1px 0 rgba(255,255,255,.92) inset, 0 2px 6px rgba(43,33,24,.05);
    border: 1px solid rgba(139,125,101,.12);
    border-radius: 999px;
    outline: none;
    transition: box-shadow 180ms ease, border-color 180ms ease;
  }
  .ch-input:focus {
    box-shadow: 0 1px 0 rgba(255,255,255,.90) inset, 0 0 0 2.5px rgba(244,196,48,.30), 0 2px 6px rgba(43,33,24,.05);
    border-color: rgba(244,196,48,.50);
  }
  @keyframes ch-spring-in {
    0%   { transform: scale(.90) translateY(8px); opacity:0; }
    55%  { transform: scale(1.03) translateY(-2px); opacity:1; }
    80%  { transform: scale(.99) translateY(1px); }
    100% { transform: scale(1) translateY(0); opacity:1; }
  }
  @keyframes ch-sheet-in {
    from { transform: translateY(100%); }
    to   { transform: translateY(0); }
  }
  @keyframes ch-fade-in {
    from { opacity:0; transform:translateY(6px); }
    to   { opacity:1; transform:translateY(0); }
  }
  .ch-spring-in { animation: ch-spring-in 360ms cubic-bezier(.16,1,.3,1) both; }
  .ch-sheet-in  { animation: ch-sheet-in  300ms cubic-bezier(.16,1,.3,1) both; }
  .ch-fade-in   { animation: ch-fade-in 220ms ease both; }
  .ch-timeline-row { border-radius: 12px; transition: background 130ms ease; }
  .ch-timeline-row:hover { background: rgba(244,196,48,.07); }
  .ch-tab-strip {
    background: rgba(255,253,246,.80);
    border: 1px solid rgba(139,125,101,.09);
    box-shadow: 0 1px 0 rgba(255,255,255,.90) inset, 0 2px 8px rgba(31,26,23,.04);
    backdrop-filter: blur(8px);
  }
  .ch-tab-active {
    background: linear-gradient(135deg,#F6D54A 0%,#F1C933 100%);
  }
`;

// ─────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────
const todayISO  = () => new Date().toISOString().slice(0, 10);

function fmtTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
}
function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function initials(name = "") {
  return name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase() || "?";
}
function avatarGrad(name = "") {
  const pair = AVATAR_GRADIENTS[name.charCodeAt(0) % AVATAR_GRADIENTS.length];
  return pair || AVATAR_GRADIENTS[0];
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
  const add = useCallback((type, message) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, type, message }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }, []);
  return { toasts, success: msg => add("success", msg), error: msg => add("error", msg), dismiss };
}

// ─────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────
export default function CareHygiene() {
  const { user } = useAuth();
  const toast = useToast();
  const mountedRef = useRef(true);

  // ── Data
  const [students,    setStudents]    = useState([]);
  const [lastByStud,  setLastByStud]  = useState({}); // studentId → last care record
  const [todayCounts, setTodayCounts] = useState({});
  const [todayTotal,  setTodayTotal]  = useState(0);
  const [history,     setHistory]     = useState([]);

  // ── UI
  const [loading,     setLoading]     = useState(true);
  const [bootError,   setBootError]   = useState(false);
  const [classFilter, setClassFilter] = useState("All");
  const [search,      setSearch]      = useState("");
  const [histDate,    setHistDate]    = useState(todayISO());
  const [histLoading, setHistLoading] = useState(false);
  const [loggingId,   setLoggingId]   = useState(null); // studentId currently being logged

  // ── Batch mode
  const [batchMode,    setBatchMode]    = useState(false);
  const [selectedIds,  setSelectedIds]  = useState(new Set());
  const [batchLogging, setBatchLogging] = useState(false);

  // ── Notes modal — { studentId, studentName, note }
  const [noteModal, setNoteModal] = useState(null);
  const [noteLoggingType, setNoteLoggingType] = useState(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => { boot(); }, []); // eslint-disable-line
  useEffect(() => { if (!loading) fetchHistory(histDate); }, [histDate]); // eslint-disable-line

  // ─── Boot: load students + today's summary + today's history ────
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
      applySummary(sumRes.summary || null);
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

  function applySummary(summary) {
    if (!summary) return;
    setTodayCounts(summary.counts || {});
    setTodayTotal(summary.total || 0);
  }

  async function fetchHistory(date) {
    setHistLoading(true);
    try {
      const [histRes, sumRes] = await Promise.all([
        getCareHistory({ date, limit: 500 }),
        getCareSummary({ date }),
      ]);
      if (!mountedRef.current) return;
      if (date === todayISO()) applyHistory(histRes.records || []);
      else setHistory(histRes.records || []);
      if (date === todayISO()) applySummary(sumRes.summary || null);
    } catch { /* non-critical */ }
    finally { if (mountedRef.current) setHistLoading(false); }
  }

  // ─── One-tap log ──────────────────────────────────────────────
  async function handleLog(student, typeId, note = "") {
    if (loggingId) return;
    const id = sid(student);
    setLoggingId(id);
    try {
      await logCare({ studentId: id, studentName: sname(student), class: scls(student), type: typeId, notes: note });
      const now = new Date().toISOString();
      const newRecord = { logId: now + id, studentId: id, studentName: sname(student), type: typeId, notes: note, loggedAt: now, date: todayISO() };
      setLastByStud(prev => ({ ...prev, [id]: newRecord }));
      setTodayCounts(prev => ({ ...prev, [typeId]: (prev[typeId] || 0) + 1 }));
      setTodayTotal(prev => prev + 1);
      setHistory(prev => [newRecord, ...prev]);
      toast.success(`${sname(student)} — ${typeId} logged ✓`);
    } catch (e) {
      toast.error(e.message || "Could not save.");
    } finally {
      if (mountedRef.current) setLoggingId(null);
    }
  }

  // ─── Batch log ────────────────────────────────────────────────
  async function handleBatchLog(typeId) {
    if (!selectedIds.size || batchLogging) return;
    setBatchLogging(true);
    const targets = visibleStudents.filter(s => selectedIds.has(sid(s)));
    try {
      await Promise.all(targets.map(s => logCare({ studentId: sid(s), studentName: sname(s), class: scls(s), type: typeId, notes: "" })));
      const now = new Date().toISOString();
      const newRecords = targets.map(s => ({
        logId: now + sid(s), studentId: sid(s), studentName: sname(s), type: typeId, notes: "", loggedAt: now, date: todayISO(),
      }));
      setLastByStud(prev => {
        const next = { ...prev };
        for (const r of newRecords) next[r.studentId] = r;
        return next;
      });
      setTodayCounts(prev => ({ ...prev, [typeId]: (prev[typeId] || 0) + targets.length }));
      setTodayTotal(prev => prev + targets.length);
      setHistory(prev => [...newRecords, ...prev]);
      setSelectedIds(new Set());
      toast.success(`${typeId} logged for ${targets.length} child${targets.length > 1 ? "ren" : ""} ✓`);
    } catch (e) {
      toast.error(e.message || "Batch log failed.");
    } finally {
      if (mountedRef.current) setBatchLogging(false);
    }
  }

  // ─── Notes modal log ──────────────────────────────────────────
  async function handleNoteLog(typeId) {
    if (!noteModal || noteLoggingType) return;
    setNoteLoggingType(typeId);
    const student = students.find(s => sid(s) === noteModal.studentId);
    if (!student) { setNoteLoggingType(null); return; }
    try {
      await handleLog(student, typeId, noteModal.note.trim());
      setNoteModal(null);
    } finally {
      if (mountedRef.current) setNoteLoggingType(null);
    }
  }

  // ─── Derived ──────────────────────────────────────────────────
  const visibleStudents = students
    .filter(s => classFilter === "All" || scls(s) === classFilter)
    .filter(s => !search || sname(s).toLowerCase().includes(search.toLowerCase()));

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="ch-page flex min-h-screen" style={{ background: `linear-gradient(150deg,${W.bg1} 0%,${W.bg2} 50%,${W.bg3} 100%)` }}>
      <style>{CARE_CSS}</style>
      <Sidebar />

      <div className="flex-1 min-w-0 overflow-auto">

        {/* ── STICKY HEADER ──────────────────────────────────── */}
        <div className="sticky top-0 z-20 backdrop-blur-2xl"
          style={{ background: "rgba(255,253,246,.92)", borderBottom: "1px solid rgba(139,125,101,.10)", boxShadow: "0 1px 0 rgba(255,255,255,.7) inset, 0 4px 24px rgba(31,26,23,.06)" }}>
          <div className="px-5 md:px-8 py-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h1 className="text-[clamp(1.4rem,3vw,1.9rem)] font-black leading-none tracking-[-0.04em]" style={{ color: W.charcoal1 }}>
                🩺 Care &amp; Hygiene
              </h1>
              <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-0.5 flex-shrink-0">
                {CLASSES.map(c => (
                  <button key={c} onClick={() => setClassFilter(c)}
                    className={`px-2.5 py-1 rounded-full text-[11px] whitespace-nowrap flex-shrink-0 font-semibold transition-all duration-150 ${classFilter === c ? "ch-pill-active" : ""}`}
                    style={classFilter !== c ? { background: "rgba(139,125,101,.06)", color: W.muted1, border: "1px solid rgba(139,125,101,.08)" } : {}}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 md:px-8 py-5 space-y-5">

          {/* ── STAT CARDS ─────────────────────────────────────── */}
          {loading ? <SkeletonStats /> : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {STAT_CARDS.map(card => {
                const count = card.typeId === "__total__" ? todayTotal : (todayCounts[card.typeId] || 0);
                return (
                  <div key={card.typeId}
                    className="rounded-[20px] p-4 relative overflow-hidden cursor-default"
                    style={{ background: card.bg, border: `1px solid ${card.border}`, boxShadow: "0 1px 0 rgba(255,255,255,.80) inset, 0 4px 14px rgba(31,26,23,.05)", transition: "transform 160ms ease" }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = ""; }}>
                    <div className="text-xl mb-1 select-none">{card.emoji}</div>
                    <div className="text-3xl font-black tabular-nums leading-none mb-1" style={{ color: card.text }}>{count}</div>
                    <div className="text-[10.5px] font-semibold leading-tight" style={{ color: card.text, opacity: 0.7 }}>{card.label}</div>
                    <div className="text-[9.5px] mt-0.5" style={{ color: card.text, opacity: 0.5 }}>today</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── CHILD CARDS PANEL ──────────────────────────────── */}
          <div className="ch-card rounded-[28px] p-4 md:p-5">

            {/* Search + batch toggle */}
            <div className="flex items-center gap-2.5 mb-4">
              <div className="relative flex-1 max-w-[200px]">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none" style={{ color: W.muted1 }}>🔍</span>
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search…" className="ch-input w-full pl-8 pr-3 py-1.5 text-[12.5px]"
                  style={{ color: W.charcoal1, fontWeight: 500 }} />
              </div>
              {!loading && (
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-xl tabular-nums flex-shrink-0"
                  style={{ background: "rgba(139,125,101,.07)", color: W.muted2, border: "1px solid rgba(139,125,101,.09)" }}>
                  {visibleStudents.length} children
                </span>
              )}
              <button
                onClick={() => { setBatchMode(b => !b); setSelectedIds(new Set()); }}
                className="flex-shrink-0 px-3 py-1.5 rounded-full text-[11.5px] font-bold transition-all duration-150"
                style={batchMode
                  ? { background: "linear-gradient(135deg,#F6D54A,#F1C933)", color: "#7A5A00", border: "1px solid rgba(212,178,40,.25)", boxShadow: "0 2px 8px rgba(241,201,51,.28)" }
                  : { background: "rgba(139,125,101,.07)", color: W.muted2, border: "1px solid rgba(139,125,101,.09)" }}>
                {batchMode ? `✓ Batch (${selectedIds.size})` : "Batch"}
              </button>
            </div>

            {/* Card grid */}
            {loading ? <SkeletonCards /> : bootError ? (
              <ErrorState onRetry={boot} />
            ) : visibleStudents.length === 0 ? (
              <EmptyStudents searched={!!search} />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {visibleStudents.map((s, i) => {
                  const id       = sid(s);
                  const last     = lastByStud[id];
                  const isSel    = selectedIds.has(id);
                  const isLogging = loggingId === id;
                  return (
                    <StudentCard
                      key={id}
                      student={s}
                      lastRecord={last}
                      isLogging={isLogging}
                      batchMode={batchMode}
                      isSelected={isSel}
                      animDelay={i * 22}
                      onTap={typeId => batchMode ? toggleSelect(id) : handleLog(s, typeId)}
                      onSelect={() => toggleSelect(id)}
                      onAddNote={() => setNoteModal({ studentId: id, studentName: sname(s), note: "" })}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* ── ACTIVITY TIMELINE ──────────────────────────────── */}
          <ActivityTimeline
            history={history}
            loading={histLoading}
            histDate={histDate}
            onDateChange={d => { setHistDate(d); if (d !== todayISO()) { fetchHistory(d); } }}
          />

        </div>
      </div>

      {/* ── BATCH BOTTOM BAR ────────────────────────────────────── */}
      {batchMode && selectedIds.size > 0 && (
        <BatchBar
          count={selectedIds.size}
          loading={batchLogging}
          onLog={handleBatchLog}
          onClear={() => setSelectedIds(new Set())}
        />
      )}

      {/* ── NOTES MODAL ─────────────────────────────────────────── */}
      {noteModal && (
        <NoteModal
          studentName={noteModal.studentName}
          note={noteModal.note}
          loggingType={noteLoggingType}
          onNoteChange={n => setNoteModal(p => ({ ...p, note: n }))}
          onLog={handleNoteLog}
          onClose={() => !noteLoggingType && setNoteModal(null)}
        />
      )}

      <ToastStack toasts={toast.toasts} onDismiss={toast.dismiss} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// STUDENT CARD
// ─────────────────────────────────────────────────────────────────
function StudentCard({ student, lastRecord, isLogging, batchMode, isSelected, animDelay, onTap, onSelect, onAddNote }) {
  const name  = sname(student);
  const klass = scls(student);
  const [from, to] = avatarGrad(name);
  const lastLine = lastRecord
    ? `${TYPES.find(t => t.id === lastRecord.type)?.emoji || "🩺"} ${lastRecord.type} · ${fmtTime(lastRecord.loggedAt)}`
    : "No events today";

  return (
    <div
      className={`ch-student-card rounded-[20px] p-3.5 ch-spring-in ${isSelected ? "ch-selected" : ""}`}
      style={{ animationDelay: `${animDelay}ms`, position: "relative" }}
      onClick={batchMode ? onSelect : undefined}
    >
      {/* Batch checkbox */}
      {batchMode && (
        <div className="absolute top-3 right-3 z-10 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: isSelected ? "#F6D54A" : "rgba(139,125,101,.12)", border: `2px solid ${isSelected ? "#D4A820" : "rgba(139,125,101,.20)"}`, transition: "all 150ms ease" }}>
          {isSelected && <span style={{ fontSize: 10, fontWeight: 900, color: "#7A5A00" }}>✓</span>}
        </div>
      )}

      {/* Header: avatar + name + last event */}
      <div className="flex items-start gap-2.5 mb-3">
        <div className="w-9 h-9 rounded-[10px] flex-shrink-0 flex items-center justify-center text-white font-black text-[11px]"
          style={{ background: `linear-gradient(135deg,${from},${to})`, boxShadow: "0 1px 6px rgba(31,26,23,.12)" }}>
          {initials(name)}
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="text-[13px] font-bold leading-tight truncate" style={{ color: W.charcoal1 }}>{name}</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            {klass && <span className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded-md" style={{ background: "rgba(139,125,101,.09)", color: W.muted1 }}>{klass}</span>}
            <span className="text-[10px] truncate" style={{ color: lastRecord ? W.muted2 : W.muted1, opacity: lastRecord ? 0.85 : 0.6 }}>{lastLine}</span>
          </div>
        </div>
        {/* Add Note button */}
        {!batchMode && (
          <button
            onClick={e => { e.stopPropagation(); onAddNote(); }}
            className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm transition-all active:scale-90"
            style={{ background: "rgba(139,125,101,.09)", color: W.muted1, border: "none", cursor: "pointer" }}
            title="Add note with this event">
            📝
          </button>
        )}
      </div>

      {/* Action buttons */}
      {!batchMode && (
        <div className="flex flex-wrap gap-1.5">
          {TYPES.map(t => (
            <button
              key={t.id}
              onClick={() => !isLogging && onTap(t.id)}
              disabled={isLogging}
              className="ch-action-btn flex items-center gap-1 px-2 py-1 rounded-full text-[10.5px] font-bold"
              style={{ background: t.bg, border: `1.5px solid ${t.border}`, color: t.text, cursor: isLogging ? "default" : "pointer" }}>
              <span style={{ fontSize: 12, lineHeight: 1 }}>{t.emoji}</span>
              {t.shortLabel}
              {isLogging && <span className="w-2.5 h-2.5 border-[1.5px] border-t-transparent rounded-full animate-spin inline-block flex-shrink-0"
                style={{ borderColor: `${t.text} transparent transparent transparent` }} />}
            </button>
          ))}
        </div>
      )}

      {batchMode && (
        <div className="text-[11px] font-semibold mt-1" style={{ color: isSelected ? "#7A5A00" : W.muted1 }}>
          {isSelected ? "Selected for batch log" : "Tap to select"}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// BATCH BOTTOM BAR
// ─────────────────────────────────────────────────────────────────
function BatchBar({ count, loading, onLog, onClear }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 ch-sheet-in"
      style={{ background: "rgba(255,253,246,.97)", borderTop: "1px solid rgba(139,125,101,.14)", boxShadow: "0 -8px 32px rgba(31,26,23,.10)", backdropFilter: "blur(12px)" }}>
      <div className="px-4 py-3 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[13px] font-bold" style={{ color: W.charcoal1 }}>
            {count} child{count !== 1 ? "ren" : ""} selected — tap event to log all
          </span>
          <button onClick={onClear} className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: "rgba(139,125,101,.10)", color: W.muted2, border: "none", cursor: "pointer" }}>
            Clear
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {TYPES.map(t => (
            <button
              key={t.id}
              onClick={() => onLog(t.id)}
              disabled={loading}
              className="ch-action-btn flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold"
              style={{ background: t.bg, border: `1.5px solid ${t.border}`, color: t.text, cursor: loading ? "default" : "pointer" }}>
              <span style={{ fontSize: 14 }}>{t.emoji}</span>
              {t.shortLabel}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// NOTES MODAL
// ─────────────────────────────────────────────────────────────────
function NoteModal({ studentName, note, loggingType, onNoteChange, onLog, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 cursor-pointer" style={{ background: "rgba(31,26,23,.50)", backdropFilter: "blur(4px)" }} onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-t-[28px] overflow-hidden ch-sheet-in"
        style={{ background: W.bg1, boxShadow: "0 -8px 40px rgba(31,26,23,.16), 0 -1px 0 rgba(255,255,255,.60) inset" }}>

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-8 h-[3px] rounded-full" style={{ background: "rgba(139,125,101,.18)" }} />
        </div>

        <div className="px-5 pb-6 pt-2 space-y-4">
          <div>
            <p className="text-[13px] font-bold" style={{ color: W.charcoal1 }}>Add Note — {studentName}</p>
            <p className="text-[11px] mt-0.5" style={{ color: W.muted1 }}>Type a note, then tap the event to log with note</p>
          </div>

          <textarea
            value={note}
            onChange={e => onNoteChange(e.target.value)}
            rows={3}
            placeholder="E.g. rash noticed, normal, used extra wipes…"
            autoFocus
            className="w-full rounded-2xl px-4 py-3 resize-none text-[13px]"
            style={{ background: "rgba(248,244,234,.70)", border: "1px solid rgba(139,125,101,.12)", color: W.charcoal1, outline: "none" }}
          />

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: W.muted1 }}>Choose Event</p>
            <div className="flex flex-wrap gap-2">
              {TYPES.map(t => (
                <button
                  key={t.id}
                  onClick={() => onLog(t.id)}
                  disabled={!!loggingType}
                  className="ch-action-btn flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold"
                  style={{ background: t.bg, border: `1.5px solid ${t.border}`, color: t.text, cursor: loggingType ? "default" : "pointer",
                    boxShadow: loggingType === t.id ? `0 0 0 3px ${t.border}` : "none" }}>
                  {loggingType === t.id
                    ? <span className="w-3 h-3 border-[1.5px] border-t-transparent rounded-full animate-spin" style={{ borderColor: `${t.text} transparent transparent transparent` }} />
                    : <span style={{ fontSize: 14 }}>{t.emoji}</span>}
                  {t.shortLabel}
                </button>
              ))}
            </div>
          </div>

          <button onClick={onClose} disabled={!!loggingType}
            className="w-full py-2.5 rounded-2xl text-[13px] font-bold transition-all disabled:opacity-40"
            style={{ background: "rgba(139,125,101,.10)", color: W.muted2, border: "none", cursor: loggingType ? "default" : "pointer" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// ACTIVITY TIMELINE
// ─────────────────────────────────────────────────────────────────
function ActivityTimeline({ history, loading, histDate, onDateChange }) {
  return (
    <div className="ch-card rounded-[28px] p-4 md:p-5 mb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 rounded-full flex-shrink-0" style={{ background: "linear-gradient(180deg,#F6D54A,#D4A820)" }} />
            <h2 className="text-[17px] font-semibold tracking-[-0.03em]" style={{ color: W.charcoal1 }}>Activity Log</h2>
          </div>
          <p className="text-[11px] pl-3 mt-0.5" style={{ color: W.muted1 }}>
            {loading ? "Loading…" : `${history.length} event${history.length === 1 ? "" : "s"} · ${fmtDate(histDate)}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none" style={{ color: W.muted1 }}>📅</span>
            <input type="date" value={histDate} max={todayISO()} onChange={e => onDateChange(e.target.value)}
              className="ch-input pl-8 pr-3 py-1.5 text-[12.5px] cursor-pointer" style={{ color: W.charcoal1, fontWeight: 500 }} />
          </div>
          {histDate !== todayISO() && (
            <button onClick={() => onDateChange(todayISO())}
              className="text-[11.5px] font-bold px-3 py-1.5 rounded-full transition-all active:scale-95"
              style={{ background: "rgba(244,196,48,.12)", color: W.charcoal2, border: "1px solid rgba(244,196,48,.30)" }}>
              Today
            </button>
          )}
        </div>
      </div>

      {loading ? <SkeletonTimeline /> : history.length === 0 ? (
        <EmptyTimeline />
      ) : (
        <div>
          {history.map((r, i) => {
            const t = TYPES.find(x => x.id === r.type);
            const [from, to] = avatarGrad(r.studentName || "");
            return (
              <div key={r.logId || i}>
                {i > 0 && <div style={{ height: 1, background: "rgba(139,125,101,.06)", margin: "0 4px" }} />}
                <div className="ch-timeline-row flex items-center gap-3 py-2 px-2">
                  <div className="flex-shrink-0 w-11 text-right">
                    <span className="text-[10.5px] font-mono tabular-nums font-semibold" style={{ color: W.muted1 }}>{fmtTime(r.loggedAt)}</span>
                  </div>
                  <div className="w-7 h-7 flex-shrink-0 rounded-lg flex items-center justify-center text-white font-black text-[9px]"
                    style={{ background: `linear-gradient(135deg,${from},${to})` }}>
                    {initials(r.studentName || "")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[12.5px] font-semibold truncate max-w-[120px]" style={{ color: W.charcoal1 }}>{r.studentName}</span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0"
                        style={{ background: t?.bg || W.goldPale, border: `1px solid ${t?.border || W.goldBorder}`, color: t?.text || W.charcoal1 }}>
                        {t?.emoji || "🩺"} {r.type}
                      </span>
                    </div>
                    {r.notes && <p className="text-[10.5px] mt-0.5 truncate max-w-[200px] italic" style={{ color: W.muted1 }}>{r.notes}</p>}
                  </div>
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
    <div className="fixed bottom-0 left-0 right-0 sm:bottom-6 sm:left-auto sm:right-6 z-[100] flex flex-col gap-2 p-4 sm:p-0 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className="ch-fade-in flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl text-sm font-semibold w-full sm:min-w-[280px] sm:max-w-sm pointer-events-auto"
          style={t.type === "success"
            ? { background: W.goldPale, color: W.charcoal1, border: "1px solid #EFD978", boxShadow: "0 6px 20px rgba(240,200,70,.18)" }
            : { background: "#7F1D1D", color: "#fff" }}>
          <span className="text-lg flex-shrink-0 select-none">{t.type === "success" ? "✨" : "⚠️"}</span>
          <span className="flex-1 leading-snug text-[13px]">{t.message}</span>
          <button onClick={() => onDismiss(t.id)}
            className="w-5 h-5 flex items-center justify-center rounded-full text-xs font-black flex-shrink-0 transition-all active:scale-90"
            style={{ background: "rgba(74,58,34,.12)", color: W.muted1, border: "none", cursor: "pointer" }}>×</button>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SKELETONS & EMPTY STATES
// ─────────────────────────────────────────────────────────────────
function SkeletonStats() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {STAT_CARDS.map((c, i) => (
        <div key={i} className="rounded-[20px] p-4 animate-pulse"
          style={{ background: c.bg, border: `1px solid ${c.border}`, animationDelay: `${i * 60}ms` }}>
          <div className="w-5 h-5 rounded-lg mb-2" style={{ background: "rgba(0,0,0,.10)" }} />
          <div className="h-7 w-10 rounded-xl mb-1.5" style={{ background: "rgba(0,0,0,.10)" }} />
          <div className="h-2 w-16 rounded-full" style={{ background: "rgba(0,0,0,.07)" }} />
        </div>
      ))}
    </div>
  );
}

function SkeletonCards() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-[20px] p-3.5 animate-pulse"
          style={{ background: W.bg2, border: "1px solid rgba(139,125,101,.08)", animationDelay: `${i * 60}ms` }}>
          <div className="flex items-start gap-2.5 mb-3">
            <div className="w-9 h-9 rounded-[10px] flex-shrink-0" style={{ background: "rgba(139,125,101,.14)" }} />
            <div className="flex-1 pt-0.5">
              <div className="h-3 w-24 rounded-full mb-1.5" style={{ background: "rgba(139,125,101,.12)" }} />
              <div className="h-2.5 w-32 rounded-full" style={{ background: "rgba(139,125,101,.08)" }} />
            </div>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {[1,2,3,4,5].map(j => (
              <div key={j} className="h-6 rounded-full" style={{ width: 52 + j * 4, background: "rgba(139,125,101,.09)" }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SkeletonTimeline() {
  return (
    <div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-2 px-2 animate-pulse" style={{ animationDelay: `${i * 60}ms` }}>
          <div className="w-11 flex-shrink-0"><div className="h-2.5 w-10 rounded-full ml-auto" style={{ background: "rgba(139,125,101,.12)" }} /></div>
          <div className="w-7 h-7 rounded-lg flex-shrink-0" style={{ background: "rgba(139,125,101,.12)" }} />
          <div className="flex-1">
            <div className="h-3 w-28 rounded-full mb-1" style={{ background: "rgba(139,125,101,.12)" }} />
            <div className="h-2.5 w-16 rounded-full" style={{ background: "rgba(139,125,101,.07)" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorState({ onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-14 h-14 rounded-3xl flex items-center justify-center text-2xl mb-3 select-none"
        style={{ background: "rgba(220,38,38,.07)", border: "1px solid rgba(220,38,38,.12)" }}>⚠️</div>
      <p className="font-bold text-[15px]" style={{ color: W.charcoal1 }}>Connection Error</p>
      <p className="mt-1 text-[12px] max-w-[200px] leading-relaxed" style={{ color: W.muted1 }}>Could not reach the server.</p>
      <button onClick={onRetry} className="mt-4 px-5 py-2 font-bold text-[12px] rounded-full transition-all active:scale-95"
        style={{ background: `linear-gradient(135deg,${W.gold2},${W.gold1})`, color: W.charcoal1, boxShadow: "0 2px 8px rgba(224,177,0,.22)", border: "none", cursor: "pointer" }}>
        ↺ Retry
      </button>
    </div>
  );
}

function EmptyStudents({ searched }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="w-12 h-12 rounded-3xl flex items-center justify-center text-xl mb-3 select-none"
        style={{ background: "rgba(244,196,48,.10)", border: "1px solid rgba(244,196,48,.18)" }}>
        {searched ? "🔍" : "🎒"}
      </div>
      <p className="font-bold text-[14px]" style={{ color: W.charcoal1 }}>{searched ? "No Matches" : "No Students"}</p>
      <p className="mt-1 text-[11px] max-w-[160px] leading-relaxed" style={{ color: W.muted1 }}>
        {searched ? "Try a different search or class filter." : "Add students first."}
      </p>
    </div>
  );
}

function EmptyTimeline() {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="w-12 h-12 rounded-3xl flex items-center justify-center text-xl mb-3 select-none"
        style={{ background: W.bg2, border: "1px solid rgba(139,125,101,.10)" }}>📋</div>
      <p className="font-bold text-[14px]" style={{ color: W.charcoal1 }}>No Events Yet</p>
      <p className="mt-1 text-[11px]" style={{ color: W.muted1 }}>Log events above to see them here.</p>
    </div>
  );
}
