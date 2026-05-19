import { useState, useEffect, useCallback, useRef, useReducer } from "react";
import Sidebar from "../components/Sidebar";
import napService from "../services/napService";

// ─────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────

const CLASSES = ["All", "Playgroup", "Nursery", "Junior K.G.", "Senior K.G.", "Daycare"];

const MOODS = [
  { value: "Refreshed", emoji: "😊" },
  { value: "Happy",     emoji: "😄" },
  { value: "Cranky",    emoji: "😠" },
  { value: "Drowsy",    emoji: "😴" },
  { value: "Calm",      emoji: "😌" },
];

const AVATAR_GRADIENTS = [
  "from-violet-500 to-purple-600",
  "from-sky-500 to-blue-600",
  "from-emerald-500 to-green-600",
  "from-rose-500 to-pink-600",
  "from-amber-500 to-orange-600",
  "from-teal-500 to-cyan-600",
  "from-indigo-500 to-blue-700",
  "from-fuchsia-500 to-pink-700",
];

// Per-class colour tokens — used consistently across every component
const CLASS_COLORS = {
  "Playgroup":   { pill: "bg-pink-50 text-pink-700 border border-pink-100",       dark: "bg-pink-900/30 text-pink-300"   },
  "Nursery":     { pill: "bg-violet-50 text-violet-700 border border-violet-100", dark: "bg-violet-900/30 text-violet-300" },
  "Junior K.G.": { pill: "bg-sky-50 text-sky-700 border border-sky-100",          dark: "bg-sky-900/30 text-sky-300"     },
  "Senior K.G.": { pill: "bg-teal-50 text-teal-700 border border-teal-100",       dark: "bg-teal-900/30 text-teal-300"   },
  "Daycare":     { pill: "bg-amber-50 text-amber-700 border border-amber-100",    dark: "bg-amber-900/30 text-amber-300" },
};
const classPill = cls => CLASS_COLORS[cls]?.pill ?? "bg-gray-100 text-gray-600";
const classDark = cls => CLASS_COLORS[cls]?.dark ?? "bg-blue-900/40 text-blue-300";

// ─────────────────────────────────────────────────────────────────
// PURE UTILITIES
// ─────────────────────────────────────────────────────────────────

function todayISO()  { return new Date().toISOString().split("T")[0]; }
function pad2(n)     { return String(n).padStart(2, "0"); }

function liveDuration(startIso) {
  const diff = Math.max(0, Date.now() - new Date(startIso).getTime());
  const s    = Math.floor(diff / 1000);
  return {
    h:            Math.floor(s / 3600),
    m:            Math.floor((s % 3600) / 60),
    s:            s % 60,
    totalMinutes: Math.floor(diff / 60000),
    display:      `${pad2(Math.floor(s / 3600))}:${pad2(Math.floor((s % 3600) / 60))}:${pad2(s % 60)}`,
  };
}

function fmtDuration(mins) {
  const m = parseInt(mins);
  if (!m || m <= 0) return "—";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

function fmtTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function initials(name = "") {
  return name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase() || "?";
}
function avatarGrad(name = "") {
  return AVATAR_GRADIENTS[name.charCodeAt(0) % AVATAR_GRADIENTS.length] ?? AVATAR_GRADIENTS[0];
}

// Field normalisers — handles PascalCase (sheet) and camelCase (API)
const sid   = s => s.Student_ID   || s.student_id   || "";
const sname = s => s.Student_Name || s.student_name || "";
const scls  = s => s.Class        || s.class        || "";

// ─────────────────────────────────────────────────────────────────
// TOAST HOOK
// ─────────────────────────────────────────────────────────────────

function useToast() {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback(id => {
    setToasts(t => t.filter(x => x.id !== id));
  }, []);

  const add = useCallback((type, message) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, type, message }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4200);
  }, []);

  const success = useCallback(msg => add("success", msg), [add]);
  const error   = useCallback(msg => add("error",   msg), [add]);

  return { toasts, success, error, dismiss };
}

// ─────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────

export default function NapTracker() {

  // ── Filters ──────────────────────────────────────────────────
  const [cls,           setCls]           = useState("All");
  const [studentSearch, setStudentSearch] = useState("");
  const [histDate,      setHistDate]      = useState(todayISO);   // lazy initialiser
  const [histStudent,   setHistStudent]   = useState("");

  // ── Data ─────────────────────────────────────────────────────
  const [students,   setStudents]   = useState([]);
  const [activeNaps, setActiveNaps] = useState([]);
  const [history,    setHistory]    = useState([]);
  const [stats,      setStats]      = useState({
    currentlySleeping: 0, totalNapsToday: 0, avgDurationMinutes: 0,
  });

  // ── UI state ─────────────────────────────────────────────────
  const [loading,      setLoading]      = useState(true);
  const [bootError,    setBootError]    = useState(false);
  const [histLoading,  setHistLoading]  = useState(false);
  const [actionId,     setActionId]     = useState(null);   // student_id being acted on
  const [wakeModal,    setWakeModal]    = useState(null);   // { nap, mood, notes }
  const [wakeLoading,  setWakeLoading]  = useState(false);

  // ── Refs ─────────────────────────────────────────────────────
  const mountedRef    = useRef(true);   // prevents setState after unmount
  const refreshingRef = useRef(false);  // deduplicates concurrent refresh calls

  // ── Live-timer tick (drives liveDuration recalculation every second) ──
  // useReducer dispatch is stable — no risk of infinite effect loops.
  const [, refreshTick] = useReducer(x => x + 1, 0);
  useEffect(() => {
    const id = setInterval(refreshTick, 1000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Toast ────────────────────────────────────────────────────
  const toast = useToast();

  // ── Cleanup on unmount ───────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ── Initial load ─────────────────────────────────────────────
  useEffect(() => { boot(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function boot() {
    if (!mountedRef.current) return;
    setLoading(true);
    setBootError(false);
    try {
      const today = todayISO();
      const [studRes, activeRes, histRes, statsRes] = await Promise.all([
        napService.getStudents(),
        napService.getActiveNaps(),
        napService.getNapHistory({ date: today }),
        napService.getStats({ date: today }),
      ]);
      if (!mountedRef.current) return;
      setStudents(Array.isArray(studRes)    ? studRes    : []);
      setActiveNaps(Array.isArray(activeRes)  ? activeRes  : []);
      setHistory(Array.isArray(histRes)     ? histRes    : []);
      setStats(statsRes ?? { currentlySleeping: 0, totalNapsToday: 0, avgDurationMinutes: 0 });
    } catch {
      if (!mountedRef.current) return;
      setBootError(true);
      toast.error("Could not connect to the server.");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  // ── Re-fetch history + stats when date picker changes ────────
  useEffect(() => {
    if (loading) return; // skip during initial boot (avoids double-fetch)
    fetchHistory(histDate);
  }, [histDate]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchHistory(date) {
    if (!mountedRef.current) return;
    setHistLoading(true);
    try {
      const [histRes, statsRes] = await Promise.all([
        napService.getNapHistory({ date }),
        napService.getStats({ date }),
      ]);
      if (!mountedRef.current) return;
      setHistory(Array.isArray(histRes) ? histRes : []);
      setStats(s => statsRes ?? s);
    } catch {
      if (mountedRef.current) toast.error("Failed to load history for this date.");
    } finally {
      if (mountedRef.current) setHistLoading(false);
    }
  }

  // ── Post-write full refresh (deduplicated) ───────────────────
  async function refresh() {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    try {
      const [activeRes, histRes, statsRes] = await Promise.all([
        napService.getActiveNaps(),
        napService.getNapHistory({ date: histDate }),
        napService.getStats({ date: histDate }),
      ]);
      if (!mountedRef.current) return;
      setActiveNaps(Array.isArray(activeRes) ? activeRes : []);
      setHistory(Array.isArray(histRes)      ? histRes   : []);
      setStats(s => statsRes ?? s);
    } catch {
      if (mountedRef.current) toast.error("Sync failed — pull down to refresh.");
    } finally {
      refreshingRef.current = false;
    }
  }

  // ── Derived data ─────────────────────────────────────────────
  const visibleStudents = students
    .filter(s => (s.Status || s.status || "Active") === "Active")
    .filter(s => cls === "All" || scls(s) === cls)
    .filter(s => !studentSearch || sname(s).toLowerCase().includes(studentSearch.toLowerCase()));

  const visibleHistory = history
    .filter(n => cls === "All" || n.class === cls)
    .filter(n => !histStudent || n.student_name.toLowerCase().includes(histStudent.toLowerCase()));

  const isSleeping   = s => activeNaps.some(n => n.student_id === sid(s));
  const getActiveNap = s => activeNaps.find(n => n.student_id === sid(s));

  // ── Actions ──────────────────────────────────────────────────
  async function handleStart(student) {
    if (actionId) return;                   // prevent any overlap
    const id = sid(student);
    setActionId(id);
    try {
      await napService.startNap({
        student_id:   id,
        student_name: sname(student),
        class:        scls(student),
      });
      toast.success(`${sname(student)}'s nap started 😴`);
      await refresh();
    } catch (e) {
      toast.error(e.message || "Could not start nap.");
    } finally {
      if (mountedRef.current) setActionId(null);
    }
  }

  async function handleWakeUp() {
    if (!wakeModal || wakeLoading) return;
    setWakeLoading(true);
    try {
      await napService.wakeUp({
        nap_id: wakeModal.nap.nap_id,
        mood:   wakeModal.mood,
        notes:  wakeModal.notes,
      });
      toast.success(`${wakeModal.nap.student_name} is awake 🌞`);
      if (mountedRef.current) setWakeModal(null);
      await refresh();
    } catch (e) {
      toast.error(e.message || "Could not record wake-up.");
    } finally {
      if (mountedRef.current) setWakeLoading(false);
    }
  }

  function openWakeModal(nap) {
    if (wakeLoading) return;
    setWakeModal({ nap, mood: "", notes: "" });
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-gradient-to-br from-[#F8F9FF] via-[#F7F8FC] to-[#FFFDF5]">
      <Sidebar />

      <div className="flex-1 min-w-0 overflow-auto">

        {/* ── STICKY HEADER ─────────────────────────────── */}
        <div className="sticky top-0 z-20 bg-white/[0.98] backdrop-blur-2xl border-b border-gray-100 shadow-sm">
          <div className="px-6 md:px-10 py-4 md:py-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">

              {/* Title */}
              <div className="flex-shrink-0">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">
                  Yellow Dot · Teacher View
                </p>
                <h1 className="text-3xl md:text-4xl font-black text-yd-navy tracking-tight leading-none mt-0.5">
                  Nap Tracker
                </h1>
              </div>

              {/* Class filter pills */}
              <div className="flex gap-2 overflow-x-auto scrollbar-none pb-0.5 flex-shrink-0">
                {CLASSES.map(c => (
                  <button
                    key={c}
                    onClick={() => setCls(c)}
                    className={`px-4 py-2 rounded-full font-bold text-sm whitespace-nowrap flex-shrink-0 transition-all duration-200 ${
                      cls === c
                        ? "bg-[var(--yd-yellow-light)] text-yd-navy shadow-md shadow-yellow-200/60 scale-[1.04]"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200 active:scale-95"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>

            </div>
          </div>
        </div>

        <div className="px-6 md:px-10 py-7 space-y-7">

          {/* ── STAT CARDS ────────────────────────────────── */}
          {loading ? <SkeletonStatCards /> : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">

              {/* Currently sleeping */}
              <div className="bg-gradient-to-br from-yd-navy to-yd-navy-2 rounded-[28px] p-6 shadow-xl shadow-blue-900/20 relative overflow-hidden hover:scale-[1.02] hover:-translate-y-1 transition-all duration-300 cursor-default">
                {stats.currentlySleeping > 0 && (
                  <span className="absolute top-4 right-4 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-400" />
                  </span>
                )}
                <div className="absolute -bottom-8 -left-8 w-36 h-36 bg-sky-400/10 rounded-full blur-2xl pointer-events-none" />
                <div className="text-3xl mb-3 select-none">😴</div>
                <div className="text-5xl font-black text-white tracking-tight tabular-nums leading-none">
                  {stats.currentlySleeping}
                </div>
                <div className="text-blue-200 font-bold mt-3 text-sm">Currently Sleeping</div>
                <div className="text-blue-300/60 text-xs mt-0.5">
                  {stats.currentlySleeping === 1 ? "1 student napping" : `${stats.currentlySleeping} students napping`}
                </div>
              </div>

              {/* Total naps */}
              <div className="bg-gradient-to-br from-[var(--yd-yellow-light)] to-yd-yellow-hover rounded-[28px] p-6 shadow-xl shadow-yellow-200/40 relative overflow-hidden hover:scale-[1.02] hover:-translate-y-1 transition-all duration-300 cursor-default">
                <div className="absolute -bottom-8 -right-8 w-36 h-36 bg-white/15 rounded-full pointer-events-none" />
                <div className="text-3xl mb-3 select-none">📊</div>
                <div className="text-5xl font-black text-yd-navy tracking-tight tabular-nums leading-none">
                  {stats.totalNapsToday}
                </div>
                <div className="text-yd-navy/80 font-bold mt-3 text-sm">Total Naps</div>
                <div className="text-yd-navy/50 text-xs mt-0.5">{fmtDate(histDate)}</div>
              </div>

              {/* Avg duration */}
              <div className="bg-white border border-gray-100 rounded-[28px] p-6 shadow-sm relative overflow-hidden hover:scale-[1.02] hover:-translate-y-1 transition-all duration-300 cursor-default">
                <div className="absolute -bottom-8 -right-8 w-36 h-36 bg-yd-bg rounded-full pointer-events-none" />
                <div className="text-3xl mb-3 select-none">⏱️</div>
                <div className="text-5xl font-black text-yd-navy tracking-tight leading-none">
                  {fmtDuration(stats.avgDurationMinutes)}
                </div>
                <div className="text-gray-700 font-bold mt-3 text-sm">Avg Duration</div>
                <div className="text-gray-400 text-xs mt-0.5">completed naps only</div>
              </div>

            </div>
          )}

          {/* ── MAIN PANEL ───────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

            {/* Students grid */}
            <div className="lg:col-span-3 bg-white rounded-[32px] p-6 md:p-8 shadow-sm border border-gray-100">

              {/* Panel header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <div className="flex items-center gap-2.5 mb-0.5">
                    <div className="w-1 h-5 bg-[var(--yd-yellow-light)] rounded-full flex-shrink-0" />
                    <h2 className="text-xl font-black text-yd-navy">Students</h2>
                  </div>
                  <p className="text-gray-400 text-xs mt-0.5 pl-3.5">
                    {cls === "All" ? "All classes" : cls} · tap a card to start or stop a nap
                  </p>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="relative flex-1 sm:flex-none">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none select-none">
                      🔍
                    </span>
                    <input
                      type="text"
                      value={studentSearch}
                      onChange={e => setStudentSearch(e.target.value)}
                      placeholder="Search…"
                      className="w-full sm:w-40 bg-yd-bg border border-gray-100 rounded-2xl pl-8 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--yd-yellow-light)]/50 focus:border-[var(--yd-yellow-light)]/40 transition-all placeholder-gray-300"
                    />
                  </div>
                  <span className="bg-yd-bg border border-gray-100 text-yd-navy font-black text-sm w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0 tabular-nums">
                    {loading ? "·" : visibleStudents.length}
                  </span>
                </div>
              </div>

              {/* Grid / states */}
              {loading ? (
                <SkeletonGrid />
              ) : bootError ? (
                <EmptyStudents error onRetry={boot} />
              ) : visibleStudents.length === 0 ? (
                <EmptyStudents searched={!!studentSearch || cls !== "All"} />
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                  {visibleStudents.map(s => {
                    const id       = sid(s);
                    const name     = sname(s);
                    const klass    = scls(s);
                    const sleeping = isSleeping(s);
                    const nap      = getActiveNap(s);
                    const dur      = sleeping && nap ? liveDuration(nap.start_time) : null;
                    return (
                      <StudentCard
                        key={id}
                        name={name}
                        klass={klass}
                        sleeping={sleeping}
                        duration={dur}
                        starting={actionId === id}
                        disabled={!!actionId && actionId !== id}
                        onStart={() => handleStart(s)}
                        onWakeUp={sleeping && nap ? () => openWakeModal(nap) : undefined}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {/* Active naps panel */}
            <div className="lg:col-span-2 bg-gradient-to-br from-yd-navy via-yd-navy to-yd-navy-2
                            rounded-[32px] p-6 md:p-8 shadow-2xl shadow-blue-900/30 relative overflow-hidden">
              <div className="absolute -top-16 -right-16 w-64 h-64 bg-[var(--yd-yellow-light)]/5 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-sky-400/5 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 h-full flex flex-col">

                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-black text-white">Active Naps</h2>
                    <p className="text-blue-300/70 text-xs mt-0.5">Live tracking</p>
                  </div>
                  {!loading && activeNaps.length > 0 && (
                    <div className="flex items-center gap-2 bg-green-500/20 border border-green-500/20 rounded-full px-3 py-1.5">
                      <span className="flex h-2 w-2 relative flex-shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
                      </span>
                      <span className="text-green-300 text-[11px] font-bold tabular-nums">
                        {activeNaps.length} live
                      </span>
                    </div>
                  )}
                </div>

                {/* Content */}
                {loading ? (
                  <SkeletonActiveNaps />
                ) : activeNaps.length === 0 ? (
                  <div className="flex flex-col items-center justify-center flex-1 py-10 md:py-14">
                    <div className="relative w-24 h-24 flex items-center justify-center mb-5 select-none">
                      <div className="absolute inset-0 rounded-full border border-white/8" />
                      <div className="absolute inset-3 rounded-full border border-white/10" />
                      <div className="absolute inset-6 rounded-full border border-white/15" />
                      <div className="absolute inset-9 rounded-full bg-white/5" />
                      <span className="text-3xl relative z-10">🌙</span>
                      <span className="absolute top-1 right-3 text-[8px] animate-pulse text-yellow-200">✨</span>
                      <span className="absolute bottom-2 left-2 text-[6px] animate-pulse text-blue-200" style={{ animationDelay: "0.7s" }}>⭐</span>
                      <span className="absolute top-5 left-0 text-[7px] animate-pulse text-white/60" style={{ animationDelay: "1.4s" }}>✦</span>
                    </div>
                    <p className="text-white/40 font-bold text-sm">No active naps</p>
                    <p className="text-white/25 text-xs mt-2 text-center leading-relaxed max-w-[160px]">
                      Tap Start Nap on any student card
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 overflow-y-auto flex-1 scrollbar-none pr-0.5">
                    {activeNaps.map(nap => (
                      <ActiveNapCard
                        key={nap.nap_id}
                        nap={nap}
                        duration={liveDuration(nap.start_time)}
                        onWakeUp={() => openWakeModal(nap)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* ── NAP HISTORY / LOG ─────────────────────────── */}
          <div className="bg-white rounded-[32px] p-6 md:p-8 shadow-sm border border-gray-100">

            {/* Header + filters */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-2.5 mb-0.5">
                  <div className="w-1 h-5 bg-[var(--yd-yellow-light)] rounded-full flex-shrink-0" />
                  <h2 className="text-xl font-black text-yd-navy">Nap Log</h2>
                </div>
                <p className="text-gray-400 text-xs mt-0.5 pl-3.5">
                  {histLoading
                    ? "Loading…"
                    : `${visibleHistory.length} entr${visibleHistory.length === 1 ? "y" : "ies"}`
                  }
                  {" · "}{fmtDate(histDate)}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* Date picker */}
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none select-none">
                    📅
                  </span>
                  <input
                    type="date"
                    value={histDate}
                    max={todayISO()}
                    onChange={e => setHistDate(e.target.value)}
                    className="bg-yd-bg border border-gray-100 rounded-2xl pl-8 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--yd-yellow-light)]/40 focus:border-[var(--yd-yellow-light)]/40 transition-all text-gray-700 cursor-pointer"
                  />
                </div>

                {/* Student search */}
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none select-none">
                    🔍
                  </span>
                  <input
                    type="text"
                    value={histStudent}
                    onChange={e => setHistStudent(e.target.value)}
                    placeholder="Filter student…"
                    className="w-40 bg-yd-bg border border-gray-100 rounded-2xl pl-8 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--yd-yellow-light)]/40 transition-all placeholder-gray-300"
                  />
                </div>

                {/* Today shortcut */}
                {histDate !== todayISO() && (
                  <button
                    onClick={() => setHistDate(todayISO())}
                    className="text-xs font-bold text-yd-navy bg-[#FFFBEA] border border-yellow-200 px-3.5 py-2.5 rounded-2xl hover:bg-yellow-100 transition-all active:scale-95"
                  >
                    Today
                  </button>
                )}
              </div>
            </div>

            {/* Table / states */}
            {histLoading ? (
              <SkeletonTable />
            ) : visibleHistory.length === 0 ? (
              <EmptyHistory filtered={!!histStudent || cls !== "All"} />
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-gray-100">
                <table className="w-full min-w-[700px]">
                  <thead>
                    <tr className="bg-yd-bg border-b border-gray-100">
                      {["Student", "Class", "Start", "Wake-Up", "Duration", "Mood", "Notes", "Status"].map(h => (
                        <th
                          key={h}
                          className="text-left px-5 py-3.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleHistory.map((nap, i) => {
                      const dur = nap.status === "Sleeping" ? liveDuration(nap.start_time) : null;
                      return (
                        <tr
                          key={nap.nap_id || i}
                          className="border-t border-gray-50 hover:bg-yd-warn-soft/40 hover:shadow-[inset_3px_0_0_theme(colors.yd.yellow)] transition-all duration-150"
                        >
                          {/* Student */}
                          <td className="px-5 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${avatarGrad(nap.student_name)} flex items-center justify-center text-white text-[10px] font-black shadow-sm flex-shrink-0`}>
                                {initials(nap.student_name)}
                              </div>
                              <span className="font-semibold text-yd-navy text-sm">{nap.student_name}</span>
                            </div>
                          </td>

                          {/* Class */}
                          <td className="px-5 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center font-bold text-[11px] px-2.5 py-1 rounded-lg ${classPill(nap.class)}`}>
                              {nap.class}
                            </span>
                          </td>

                          {/* Start */}
                          <td className="px-5 py-4 text-gray-600 font-medium text-sm tabular-nums whitespace-nowrap">
                            {fmtTime(nap.start_time)}
                          </td>

                          {/* Wake-up */}
                          <td className="px-5 py-4 tabular-nums whitespace-nowrap">
                            {nap.status === "Sleeping" ? (
                              <span className="text-blue-500 font-bold text-sm">Active</span>
                            ) : (
                              <span className="text-gray-600 font-medium text-sm">{fmtTime(nap.end_time)}</span>
                            )}
                          </td>

                          {/* Duration */}
                          <td className="px-5 py-4 whitespace-nowrap">
                            <span className="font-black text-yd-navy text-sm tabular-nums">
                              {dur ? dur.display : fmtDuration(parseInt(nap.duration_minutes))}
                            </span>
                          </td>

                          {/* Mood */}
                          <td className="px-5 py-4">
                            {nap.mood ? (
                              <span className="text-xl leading-none select-none" title={nap.mood}>
                                {MOODS.find(m => m.value === nap.mood)?.emoji ?? nap.mood}
                              </span>
                            ) : <span className="text-gray-300 text-sm">—</span>}
                          </td>

                          {/* Notes */}
                          <td className="px-5 py-4 max-w-[180px]">
                            {nap.notes ? (
                              <span
                                className="text-gray-500 text-xs line-clamp-2 leading-relaxed"
                                title={nap.notes}
                              >
                                {nap.notes}
                              </span>
                            ) : <span className="text-gray-300 text-sm">—</span>}
                          </td>

                          {/* Status */}
                          <td className="px-5 py-4 whitespace-nowrap">
                            <StatusBadge status={nap.status} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>{/* /content */}
      </div>{/* /main */}

      {/* ── WAKE-UP MODAL ─────────────────────────────── */}
      {wakeModal && (
        <WakeUpModal
          nap={wakeModal.nap}
          mood={wakeModal.mood}
          notes={wakeModal.notes}
          loading={wakeLoading}
          onMood={mood   => setWakeModal(p => ({ ...p, mood  }))}
          onNotes={notes => setWakeModal(p => ({ ...p, notes }))}
          onConfirm={handleWakeUp}
          onClose={() => !wakeLoading && setWakeModal(null)}
        />
      )}

      {/* ── TOAST STACK ───────────────────────────────── */}
      <ToastStack toasts={toast.toasts} onDismiss={toast.dismiss} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// STUDENT CARD
// ─────────────────────────────────────────────────────────────────

function StudentCard({ name, klass, sleeping, duration, starting, disabled, onStart, onWakeUp }) {
  return (
    <div
      className={`relative rounded-[20px] p-4 transition-all duration-300 select-none overflow-hidden flex flex-col ${
        sleeping
          ? "bg-gradient-to-br from-yd-navy to-yd-navy-2 shadow-lg shadow-blue-900/25"
          : disabled
          ? "bg-yd-bg opacity-50 cursor-not-allowed"
          : "bg-yd-bg border border-transparent hover:bg-white hover:shadow-lg hover:shadow-gray-100/80 hover:border-gray-100"
      }`}
    >
      {/* Sleeping live dot */}
      {sleeping && (
        <span className="absolute top-3 right-3 flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-300 opacity-60" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-yellow-300" />
        </span>
      )}

      {/* Avatar */}
      <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${avatarGrad(name)} flex items-center justify-center text-white font-black text-sm mb-3 shadow-md flex-shrink-0`}>
        {initials(name)}
      </div>

      {/* Name */}
      <p className={`font-black text-sm leading-tight tracking-tight line-clamp-2 ${sleeping ? "text-white" : "text-yd-navy"}`}>
        {name}
      </p>

      {/* Class badge */}
      <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-lg mt-1.5 mb-3 ${
        sleeping ? classDark(klass) : classPill(klass)
      }`}>
        {klass}
      </span>

      {/* Action area — always at bottom */}
      <div className="mt-auto">
        {sleeping ? (
          <>
            {/* Live timer */}
            {duration && (
              <div className="mb-2.5">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-300 animate-pulse inline-block flex-shrink-0" />
                  <span className="text-blue-200 text-[9px] font-bold uppercase tracking-widest">Sleeping</span>
                </div>
                <p className="text-white font-black text-[18px] font-mono tracking-widest tabular-nums leading-tight">
                  {duration.display.slice(0, 6)}
                  <span className="animate-timer-pulse">{duration.display.slice(6)}</span>
                </p>
              </div>
            )}
            {/* Wake Up — directly on the card */}
            <button
              onClick={onWakeUp}
              className="group relative overflow-hidden w-full bg-[var(--yd-yellow-light)]/15 hover:bg-[var(--yd-yellow-light)]/25 active:bg-[var(--yd-yellow-light)]/35 border border-[var(--yd-yellow-light)]/20 hover:border-[var(--yd-yellow-light)]/40 text-[var(--yd-yellow-light)] font-black text-[11px] py-2.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-300/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />
              🌞 Wake Up
            </button>
          </>
        ) : (
          <button
            onClick={onStart}
            disabled={starting || disabled}
            className="group relative overflow-hidden w-full bg-gradient-to-r from-[var(--yd-yellow-light)] to-yd-yellow-hover hover:from-yd-yellow-hover hover:to-yd-yellow-hover disabled:from-gray-200 disabled:to-gray-200 text-yd-navy disabled:text-gray-400 font-black text-xs py-3 rounded-xl transition-all duration-200 hover:shadow-md hover:shadow-yellow-200/60 active:scale-95 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />
            {starting ? (
              <>
                <span className="w-3 h-3 border-2 border-yd-navy/30 border-t-yd-navy rounded-full animate-spin" />
                Starting…
              </>
            ) : "▶ Start Nap"}
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// ACTIVE NAP CARD
// ─────────────────────────────────────────────────────────────────

function ActiveNapCard({ nap, duration, onWakeUp }) {
  return (
    <div className="bg-white/10 border border-white/10 rounded-[20px] p-4 transition-all duration-200 hover:bg-white/[0.13] hover:-translate-y-0.5 backdrop-blur-sm">

      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${avatarGrad(nap.student_name)} flex items-center justify-center text-white font-black text-xs shadow-md flex-shrink-0`}>
            {initials(nap.student_name)}
          </div>
          <div className="min-w-0">
            <p className="text-white font-black text-[13px] leading-snug truncate">{nap.student_name}</p>
            <p className="text-blue-300/80 text-[10px] truncate">{nap.class}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-blue-400/20 rounded-full px-2.5 py-1 flex-shrink-0 ml-2">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-300 animate-pulse inline-block flex-shrink-0" />
          <span className="text-blue-200 text-[9px] font-bold uppercase tracking-wider">Live</span>
        </div>
      </div>

      {/* Live timer block */}
      <div className="bg-white/5 border border-white/5 rounded-xl px-3 py-3 mb-3 text-center">
        <p className="text-blue-300/60 text-[9px] font-bold uppercase tracking-widest mb-1">Duration</p>
        <p className="text-white font-black text-[26px] font-mono tracking-widest tabular-nums leading-none">
          {duration.display.slice(0, 6)}
          <span className="animate-timer-pulse">{duration.display.slice(6)}</span>
        </p>
        <p className="text-blue-400/50 text-[10px] mt-2">
          Started {fmtTime(nap.start_time)}
        </p>
      </div>

      {/* Wake up CTA */}
      <button
        onClick={onWakeUp}
        className="w-full bg-gradient-to-r from-[var(--yd-yellow-light)] to-yd-yellow-hover hover:from-yd-yellow-hover hover:to-yd-yellow-hover text-yd-navy font-black text-sm py-2.5 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-yellow-400/20 active:scale-[0.98]"
      >
        🌞 Wake Up
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// WAKE-UP MODAL
// ─────────────────────────────────────────────────────────────────

function WakeUpModal({ nap, mood, notes, loading, onMood, onNotes, onConfirm, onClose }) {
  const dur = liveDuration(nap.start_time);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop — fully blocked during submission */}
      <div
        className={`absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity ${
          loading ? "pointer-events-none" : "cursor-pointer"
        }`}
        onClick={onClose}
      />

      {/* Sheet / card */}
      <div className="relative bg-white w-full sm:max-w-md rounded-t-[36px] sm:rounded-[36px] shadow-2xl overflow-hidden max-h-[92dvh] flex flex-col">

        {/* Mobile drag handle */}
        <div className="sm:hidden flex justify-center pt-3.5 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Yellow header */}
        <div className="bg-gradient-to-br from-[var(--yd-yellow-light)] to-yd-yellow-hover px-7 pt-6 pb-8 relative overflow-hidden flex-shrink-0">
          <div className="absolute -top-10 -right-10 w-44 h-44 bg-white/15 rounded-full pointer-events-none" />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-yd-navy/10 rounded-full pointer-events-none" />
          <div className="relative flex items-center gap-4">
            <div className="w-14 h-14 bg-white/30 backdrop-blur-sm rounded-3xl flex items-center justify-center text-3xl shadow-xl flex-shrink-0 select-none">
              🌞
            </div>
            <div className="min-w-0">
              <p className="text-yd-navy/60 text-[10px] font-bold uppercase tracking-widest">Wake Up</p>
              <h2 className="text-xl font-black text-yd-navy leading-tight truncate">{nap.student_name}</h2>
              <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-lg mt-1 ${classPill(nap.class)}`}>
                {nap.class}
              </span>
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="px-7 pt-6 pb-7 space-y-5 overflow-y-auto flex-1 scrollbar-none">

          {/* Duration display */}
          <div className="bg-yd-bg border border-gray-100 rounded-2xl py-5 text-center">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">Total Nap Duration</p>
            <p className="text-5xl font-black text-yd-navy font-mono tracking-wide tabular-nums">
              {dur.display}
            </p>
            <p className="text-gray-400 text-sm mt-2">
              {dur.totalMinutes} minute{dur.totalMinutes !== 1 ? "s" : ""} total
            </p>
          </div>

          {/* Mood picker */}
          <div>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-3">
              Mood After Nap
              <span className="ml-2 normal-case font-normal tracking-normal text-gray-300">optional</span>
            </p>
            <div className="grid grid-cols-5 gap-2">
              {MOODS.map(m => (
                <button
                  key={m.value}
                  onClick={() => onMood(mood === m.value ? "" : m.value)}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-2xl border-2 transition-all duration-200 ${
                    mood === m.value
                      ? "border-[var(--yd-yellow-light)] bg-[#FFFBEA] scale-[1.06] shadow-md shadow-yellow-100"
                      : "border-gray-100 bg-white hover:border-gray-200 active:scale-95"
                  }`}
                >
                  <span className="text-2xl leading-none select-none">{m.emoji}</span>
                  <span className="text-[8px] font-bold text-gray-500 uppercase tracking-wide text-center leading-none">
                    {m.value}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2.5">
              Notes
              <span className="ml-2 normal-case font-normal tracking-normal text-gray-300">optional</span>
            </p>
            <textarea
              value={notes}
              onChange={e => onNotes(e.target.value)}
              rows={3}
              placeholder="Any observations about this nap…"
              className="w-full bg-yd-bg border border-gray-100 rounded-2xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-[var(--yd-yellow-light)]/50 focus:border-[var(--yd-yellow-light)]/30 transition-all resize-none text-gray-700 text-sm placeholder-gray-300"
            />
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-3.5 rounded-2xl transition-all disabled:opacity-40 text-sm active:scale-95"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="flex-[2] bg-gradient-to-r from-yd-navy to-yd-navy-2 text-white font-black py-3.5 rounded-2xl shadow-xl shadow-blue-900/20 disabled:opacity-60 flex items-center justify-center gap-2 text-sm hover:shadow-2xl hover:shadow-blue-900/30 active:scale-[0.98] transition-all"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving…
                </>
              ) : "✓ Confirm Wake Up"}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// STATUS BADGE
// ─────────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  if (status === "Sleeping") {
    return (
      <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 font-bold px-3 py-1.5 rounded-full text-xs border border-blue-100 whitespace-nowrap">
        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse inline-block flex-shrink-0" />
        Sleeping
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 font-bold px-3 py-1.5 rounded-full text-xs border border-emerald-100 whitespace-nowrap">
      <span className="text-emerald-500 text-[10px] flex-shrink-0">✓</span>
      Completed
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────
// TOAST STACK
// ─────────────────────────────────────────────────────────────────

function ToastStack({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    // Full-width at bottom on mobile → right-anchored floating on sm+
    <div className="fixed bottom-0 left-0 right-0 sm:bottom-6 sm:left-auto sm:right-6 z-[100] flex flex-col gap-2 sm:gap-3 p-4 sm:p-0 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`flex items-center gap-3 px-4 py-3.5 sm:px-5 sm:py-4 rounded-2xl shadow-2xl text-sm font-semibold w-full sm:min-w-[280px] sm:max-w-sm pointer-events-auto animate-toast-in ${
            t.type === "success"
              ? "bg-yd-navy text-white"
              : "bg-rose-600 text-white"
          }`}
        >
          <span className="text-xl flex-shrink-0 leading-none select-none">
            {t.type === "success" ? "✅" : "❌"}
          </span>
          <span className="flex-1 leading-snug">{t.message}</span>
          <button
            onClick={() => onDismiss(t.id)}
            aria-label="Dismiss notification"
            className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 active:scale-90 transition-all text-white/80 hover:text-white text-base font-bold leading-none"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SKELETON — STAT CARDS
// ─────────────────────────────────────────────────────────────────

function SkeletonStatCards() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
      {/* Dark card */}
      <div className="bg-gradient-to-br from-yd-navy to-yd-navy-2 rounded-[28px] p-6 animate-pulse">
        <div className="w-8 h-8 bg-white/10 rounded-xl mb-4" />
        <div className="h-11 w-12 bg-white/15 rounded-xl mb-3" />
        <div className="h-3.5 w-32 bg-white/10 rounded-full mb-1.5" />
        <div className="h-3 w-24 bg-white/10 rounded-full" />
      </div>
      {/* Yellow card */}
      <div className="bg-gradient-to-br from-[var(--yd-yellow-light)] to-yd-yellow-hover rounded-[28px] p-6 animate-pulse">
        <div className="w-8 h-8 bg-yd-navy/10 rounded-xl mb-4" />
        <div className="h-11 w-12 bg-yd-navy/10 rounded-xl mb-3" />
        <div className="h-3.5 w-24 bg-yd-navy/10 rounded-full mb-1.5" />
        <div className="h-3 w-28 bg-yd-navy/8 rounded-full" />
      </div>
      {/* White card */}
      <div className="bg-white border border-gray-100 rounded-[28px] p-6 animate-pulse">
        <div className="w-8 h-8 bg-gray-100 rounded-xl mb-4" />
        <div className="h-11 w-20 bg-gray-100 rounded-xl mb-3" />
        <div className="h-3.5 w-28 bg-gray-100 rounded-full mb-1.5" />
        <div className="h-3 w-24 bg-gray-50 rounded-full" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SKELETON — STUDENT GRID
// ─────────────────────────────────────────────────────────────────

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-yd-bg rounded-[20px] p-4 animate-pulse flex flex-col" style={{ animationDelay: `${i * 80}ms` }}>
          <div className="w-11 h-11 bg-gray-200 rounded-2xl mb-3 flex-shrink-0" />
          <div className="h-3 bg-gray-200 rounded-full mb-1.5 w-4/5" />
          <div className="h-5 bg-gray-100 rounded-lg w-1/2 mb-3" />
          <div className="mt-auto h-9 bg-gray-200 rounded-xl" />
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SKELETON — ACTIVE NAPS (dark panel)
// ─────────────────────────────────────────────────────────────────

function SkeletonActiveNaps() {
  return (
    <div className="space-y-3">
      {[0, 1].map(i => (
        <div key={i} className="bg-white/10 rounded-[20px] p-4 animate-pulse">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="h-3 bg-white/20 rounded-full w-3/4 mb-1.5" />
              <div className="h-2.5 bg-white/10 rounded-full w-1/2" />
            </div>
          </div>
          <div className="bg-white/5 rounded-xl py-6 mb-3 flex items-center justify-center">
            <div className="h-7 w-32 bg-white/15 rounded-xl" />
          </div>
          <div className="h-9 bg-white/15 rounded-xl" />
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SKELETON — HISTORY TABLE
// ─────────────────────────────────────────────────────────────────

function SkeletonTable() {
  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-100">
      <table className="w-full min-w-[700px]">
        <thead>
          <tr className="bg-yd-bg border-b border-gray-100">
            {["Student", "Class", "Start", "Wake-Up", "Duration", "Mood", "Notes", "Status"].map(h => (
              <th key={h} className="text-left px-5 py-3.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 4 }).map((_, i) => (
            <tr key={i} className="border-t border-gray-50 animate-pulse">
              <td className="px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-gray-200 rounded-xl flex-shrink-0" />
                  <div className="h-3 bg-gray-200 rounded-full w-24" />
                </div>
              </td>
              <td className="px-5 py-4"><div className="h-5 bg-gray-100 rounded-lg w-16" /></td>
              <td className="px-5 py-4"><div className="h-3 bg-gray-100 rounded-full w-14" /></td>
              <td className="px-5 py-4"><div className="h-3 bg-gray-100 rounded-full w-14" /></td>
              <td className="px-5 py-4"><div className="h-3 bg-gray-200 rounded-full w-12" /></td>
              <td className="px-5 py-4"><div className="w-6 h-6 bg-gray-100 rounded-full" /></td>
              <td className="px-5 py-4"><div className="h-3 bg-gray-100 rounded-full w-24" /></td>
              <td className="px-5 py-4"><div className="h-6 bg-gray-100 rounded-full w-20" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// EMPTY STATES
// ─────────────────────────────────────────────────────────────────

function EmptyStudents({ searched = false, error = false, onRetry }) {
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-center">
        <div className="w-16 h-16 bg-rose-50 rounded-3xl flex items-center justify-center text-3xl mb-4 shadow-sm select-none">
          ⚠️
        </div>
        <p className="text-lg font-black text-gray-800">Connection Error</p>
        <p className="text-gray-400 mt-1.5 text-sm max-w-xs leading-relaxed">
          Could not reach the server. Make sure the backend is running on port 5000.
        </p>
        <button
          onClick={onRetry}
          className="mt-5 px-6 py-2.5 bg-[var(--yd-yellow-light)] hover:bg-yd-yellow-hover text-yd-navy font-black text-sm rounded-2xl transition-all active:scale-95 shadow-sm"
        >
          ↺ Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="w-16 h-16 bg-[#FFFBEA] rounded-3xl flex items-center justify-center text-3xl mb-4 shadow-sm select-none">
        {searched ? "🔍" : "🎒"}
      </div>
      <p className="text-lg font-black text-gray-800">
        {searched ? "No Matches" : "No Students Found"}
      </p>
      <p className="text-gray-400 mt-1.5 text-sm max-w-xs leading-relaxed">
        {searched
          ? "Try a different name or class filter."
          : "Add students first, then come back here."}
      </p>
    </div>
  );
}

function EmptyHistory({ filtered = false }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="w-16 h-16 bg-yd-bg border border-gray-100 rounded-3xl flex items-center justify-center text-3xl mb-4 shadow-sm select-none">
        {filtered ? "🔍" : "📋"}
      </div>
      <p className="text-lg font-black text-gray-800">
        {filtered ? "No Matches" : "No Naps Recorded"}
      </p>
      <p className="text-gray-400 mt-1.5 text-sm max-w-xs leading-relaxed">
        {filtered
          ? "Try clearing the student search or selecting a different class."
          : "No naps have been logged for this date yet."}
      </p>
    </div>
  );
}

