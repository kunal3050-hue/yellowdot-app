import { useState, useEffect, useCallback, useRef, useReducer } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import Sidebar from "../components/Sidebar";
import napService from "../services/napService";
import { useAuth } from "../contexts/AuthContext";

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

// ─────────────────────────────────────────────────────────────────
// WARM DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────
const W = {
  charcoal1: "#1f1a17",
  charcoal2: "#2a221d",
  charcoal3: "#342922",
  gold1:     "#f4c430",
  gold2:     "#f7d24d",
  gold3:     "#e0b100",
  goldPale:  "#fff4c2",
  bg1:       "#fffdf6",
  bg2:       "#f8f4ea",
  bg3:       "#f5f0e2",
  muted1:    "#8b7d65",
  muted2:    "#6f624f",
};

// ─────────────────────────────────────────────────────────────────
// PREMIUM CSS — animations, typography, utilities
// ─────────────────────────────────────────────────────────────────
const NAP_CSS = `
  /* ── Inter Tight — premium geometric sans ── */
  @import url('https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400&display=swap');

  .nt-page, .nt-page * {
    font-family: 'Inter Tight', system-ui, -apple-system, sans-serif;
  }
  .nt-page h1 { font-size: clamp(2rem, 4vw, 2.75rem); font-weight: 900; letter-spacing: -0.04em; }
  .nt-page h2 { font-weight: 800; letter-spacing: -0.03em; }
  .nt-page p, .nt-page span, .nt-page td { letter-spacing: -0.01em; }

  /* ── Sleeping card gold glow breathe ── */
  @keyframes nt-breathe {
    0%,100% { box-shadow: 0 8px 32px rgba(31,26,23,.30), 0 0 0 0 rgba(244,196,48,.00); }
    50%      { box-shadow: 0 16px 56px rgba(31,26,23,.46), 0 0 0 18px rgba(244,196,48,.07); }
  }
  /* ── Card spring entry ── */
  @keyframes nt-spring-in {
    0%   { transform: scale(.88) translateY(10px); opacity:0; }
    55%  { transform: scale(1.04) translateY(-3px); opacity:1; }
    80%  { transform: scale(.98) translateY(1px); }
    100% { transform: scale(1) translateY(0); opacity:1; }
  }
  /* ── Bottom sheet ── */
  @keyframes nt-sheet-in {
    from { transform: translateY(100%); }
    to   { transform: translateY(0); }
  }
  /* ── Mood badge pop ── */
  @keyframes nt-badge-pop {
    0%   { transform: scale(0) rotate(-20deg); opacity:0; }
    60%  { transform: scale(1.22) rotate(6deg);  opacity:1; }
    80%  { transform: scale(.96) rotate(-2deg); }
    100% { transform: scale(1) rotate(0); opacity:1; }
  }
  /* ── Refused shake ── */
  @keyframes nt-shake {
    0%,100% { transform: translateX(0) rotate(0); }
    18%  { transform: translateX(-7px) rotate(-1.5deg); }
    36%  { transform: translateX(7px)  rotate(1.5deg); }
    54%  { transform: translateX(-5px) rotate(-1deg); }
    72%  { transform: translateX(5px)  rotate(1deg); }
  }
  /* ── Hint appear ── */
  @keyframes nt-hint-in {
    from { opacity:0; transform: scale(.65); }
    to   { opacity:1; transform: scale(1); }
  }
  /* ── Particles ── */
  @keyframes nt-p1 { 0%{transform:translate(0,0) scale(1) rotate(0deg);opacity:1} 100%{transform:translate(-30px,-56px) scale(0) rotate(200deg);opacity:0} }
  @keyframes nt-p2 { 0%{transform:translate(0,0) scale(1) rotate(0deg);opacity:1} 100%{transform:translate(26px,-64px) scale(0) rotate(-140deg);opacity:0} }
  @keyframes nt-p3 { 0%{transform:translate(0,0) scale(1);opacity:1} 100%{transform:translate(42px,-46px) scale(0);opacity:0} }
  @keyframes nt-p4 { 0%{transform:translate(0,0) scale(1) rotate(0deg);opacity:1} 100%{transform:translate(-14px,-72px) scale(0) rotate(100deg);opacity:0} }
  @keyframes nt-p5 { 0%{transform:translate(0,0) scale(1);opacity:1} 100%{transform:translate(18px,-76px) scale(0);opacity:0} }
  @keyframes nt-moon { 0%{transform:translateY(0) scale(.4) rotate(-25deg);opacity:0} 25%{opacity:1} 100%{transform:translateY(-88px) scale(0) rotate(25deg);opacity:0} }
  /* ── Dot pulse ── */
  @keyframes nt-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.35;transform:scale(.65)} }
  /* ── Timer tick ── */
  @keyframes nt-tick { from{transform:translateY(-3px);opacity:.5} to{transform:translateY(0);opacity:1} }
  /* ── Gold shimmer ── */
  @keyframes nt-shimmer {
    0%   { background-position: -200% center; }
    100% { background-position:  200% center; }
  }
  /* ── Live pulse ring ── */
  @keyframes nt-ring {
    0%   { box-shadow: 0 0 0 0 rgba(34,197,94,0.35); }
    70%  { box-shadow: 0 0 0 8px rgba(34,197,94,0); }
    100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
  }
  /* ── Moon float (empty state) ── */
  @keyframes nt-moon-float {
    0%,100% { transform: translateY(0) rotate(-4deg); }
    50%     { transform: translateY(-8px) rotate(4deg); }
  }
  /* ── Nap card slide in (staggered) ── */
  @keyframes nt-nap-slide-in {
    from { opacity: 0; transform: translateY(10px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  /* ── Stat number pulse ── */
  @keyframes nt-stat-pulse {
    0%,100% { opacity: 1; }
    50%     { opacity: 0.78; }
  }
  /* ── Avatar radial glow ── */
  @keyframes nt-avatar-glow {
    0%,100% { opacity: 0.60; transform: scale(1); }
    50%     { opacity: 1.00; transform: scale(1.12); }
  }

  .nt-sleeping-card { animation: nt-breathe 3.6s ease-in-out infinite; }
  .nt-spring-in     { animation: nt-spring-in 400ms cubic-bezier(.16,1,.3,1) both; }
  .nt-sheet-in      { animation: nt-sheet-in  320ms cubic-bezier(.16,1,.3,1) both; }
  .nt-badge-pop     { animation: nt-badge-pop 380ms cubic-bezier(.16,1,.3,1) both; }
  .nt-refused       { animation: nt-shake 380ms cubic-bezier(.36,.07,.19,.97) both; }

  .nt-p1 { animation: nt-p1 920ms cubic-bezier(.16,1,.3,1) both; }
  .nt-p2 { animation: nt-p2 920ms cubic-bezier(.16,1,.3,1) 55ms both; }
  .nt-p3 { animation: nt-p3 920ms cubic-bezier(.16,1,.3,1) 25ms both; }
  .nt-p4 { animation: nt-p4 920ms cubic-bezier(.16,1,.3,1) 75ms both; }
  .nt-p5 { animation: nt-p5 920ms cubic-bezier(.16,1,.3,1) 10ms both; }
  .nt-moon{ animation: nt-moon 1050ms cubic-bezier(.16,1,.3,1) both; }

  /* ── Premium card base ── */
  .nt-card {
    background: linear-gradient(145deg, #fffdf6 0%, #f8f4ea 100%);
    box-shadow:
      0 1px 0 rgba(255,255,255,0.90) inset,
      0 -1px 0 rgba(139,125,101,0.06) inset,
      0 2px 4px rgba(31,26,23,0.04),
      0 12px 36px rgba(31,26,23,0.07),
      0 32px 64px rgba(31,26,23,0.04);
    border: 1px solid rgba(139,125,101,0.09);
  }
  /* ── Idle swipe card ── */
  .nt-idle-card {
    background: linear-gradient(150deg, #fffdf6 0%, #fdf9ee 100%);
    box-shadow:
      0 1px 0 rgba(255,255,255,0.8) inset,
      0 1px 3px rgba(31,26,23,0.05),
      0 4px 12px rgba(31,26,23,0.05);
    border: 1px solid rgba(139,125,101,0.08);
    transition: box-shadow 240ms ease, border-color 240ms ease;
  }
  .nt-idle-card:hover {
    box-shadow:
      0 1px 0 rgba(255,255,255,0.9) inset,
      0 2px 6px rgba(31,26,23,0.07),
      0 10px 28px rgba(31,26,23,0.09),
      0 24px 48px rgba(31,26,23,0.05);
    border-color: rgba(139,125,101,0.14);
  }
  /* ── Charcoal sleeping card ── */
  .nt-sleep-card {
    background: linear-gradient(135deg, #1f1a17 0%, #2a221d 55%, #342922 100%);
    box-shadow:
      0 1px 0 rgba(244,196,48,0.13) inset,
      0 -1px 0 rgba(0,0,0,0.25) inset,
      0 8px 32px rgba(31,26,23,0.32),
      0 24px 64px rgba(31,26,23,0.18);
  }
  /* ── Gold glass panel ── */
  .nt-gold-panel {
    background: linear-gradient(145deg, #fff9e0 0%, #fff4c2 40%, #fded9a 100%);
    box-shadow:
      0 1px 0 rgba(255,255,255,0.60) inset,
      0 8px 32px rgba(224,177,0,0.18),
      0 32px 64px rgba(224,177,0,0.09);
    border: 1px solid rgba(224,177,0,0.18);
  }
  /* ── Ivory minimal card ── */
  .nt-ivory-card {
    background: linear-gradient(145deg, #fffdf6 0%, #f8f4ea 100%);
    box-shadow:
      0 1px 0 rgba(255,255,255,0.92) inset,
      0 2px 4px rgba(31,26,23,0.04),
      0 10px 28px rgba(31,26,23,0.07);
    border: 1px solid rgba(139,125,101,0.10);
  }
  /* ── Warm glass input ── */
  .nt-input {
    background: rgba(255,253,246,0.85);
    backdrop-filter: blur(8px);
    box-shadow: 0 1px 0 rgba(255,255,255,0.80) inset, 0 2px 8px rgba(31,26,23,0.05);
    border: 1px solid rgba(139,125,101,0.14);
    transition: box-shadow 200ms ease, border-color 200ms ease;
    border-radius: 999px;
    outline: none;
  }
  .nt-input:focus {
    box-shadow: 0 1px 0 rgba(255,255,255,0.80) inset, 0 0 0 3px rgba(244,196,48,0.28), 0 2px 8px rgba(31,26,23,0.05);
    border-color: rgba(244,196,48,0.55);
  }
  /* ── Pill filter active ── */
  .nt-pill-active {
    background: linear-gradient(135deg, #f4c430 0%, #f7d24d 100%);
    box-shadow: 0 2px 8px rgba(224,177,0,0.30), 0 1px 0 rgba(255,255,255,0.40) inset;
    color: #1f1a17;
  }
  /* ── Active nap panel (warm glass) ── */
  .nt-nap-panel {
    background: linear-gradient(145deg, #fffef8 0%, #fffbee 50%, #fff8e0 100%);
    box-shadow:
      0 1px 0 rgba(255,255,255,0.92) inset,
      0 8px 32px rgba(224,177,0,0.08),
      0 24px 64px rgba(31,26,23,0.06);
    border: 1px solid rgba(244,196,48,0.18);
  }
  /* ── Active nap card (glass) ── */
  .nt-nap-card {
    background: rgba(255,255,255,0.72);
    backdrop-filter: blur(12px);
    box-shadow:
      0 1px 0 rgba(255,255,255,0.9) inset,
      0 2px 8px rgba(31,26,23,0.06),
      0 8px 20px rgba(31,26,23,0.04);
    border: 1px solid rgba(244,196,48,0.15);
    transition: box-shadow 240ms ease, transform 240ms ease;
  }
  .nt-nap-card:hover {
    box-shadow:
      0 1px 0 rgba(255,255,255,0.95) inset,
      0 4px 14px rgba(31,26,23,0.09),
      0 14px 32px rgba(31,26,23,0.06);
    transform: translateY(-2px);
  }
  /* ── Timeline capsule hover ── */
  .nt-timeline-row {
    border-radius: 16px;
    transition: background 160ms ease;
  }
  .nt-timeline-row:hover { background: rgba(244,196,48,0.07); }
`;

const REFUSED_REASONS = [
  { id: "restless", label: "Restless",    emoji: "🦋" },
  { id: "crying",   label: "Crying",      emoji: "😢" },
  { id: "active",   label: "Too active",  emoji: "⚡" },
  { id: "skipped",  label: "Skipped",     emoji: "⏭️" },
];

const AVATAR_GRADIENTS = [
  "from-violet-500 to-purple-600",
  "from-amber-500 to-orange-500",
  "from-emerald-500 to-green-600",
  "from-rose-500 to-pink-600",
  "from-teal-500 to-cyan-600",
  "from-orange-400 to-red-500",
  "from-indigo-400 to-violet-500",
  "from-fuchsia-500 to-rose-500",
];

const CLASS_COLORS = {
  "Playgroup":   { pill: "bg-pink-50 text-pink-700 border border-pink-100",          dark: "bg-rose-400/18 text-rose-200"    },
  "Nursery":     { pill: "bg-violet-50 text-violet-700 border border-violet-100",    dark: "bg-purple-400/18 text-purple-200" },
  "Junior K.G.": { pill: "bg-amber-50 text-amber-700 border border-amber-100",       dark: "bg-amber-400/18 text-amber-200"  },
  "Senior K.G.": { pill: "bg-teal-50 text-teal-700 border border-teal-100",          dark: "bg-teal-400/18 text-teal-200"    },
  "Daycare":     { pill: "bg-orange-50 text-orange-700 border border-orange-100",    dark: "bg-orange-400/18 text-orange-200" },
};
const classPill = cls => CLASS_COLORS[cls]?.pill ?? "bg-stone-100 text-stone-600 border border-stone-200";
const classDark = cls => CLASS_COLORS[cls]?.dark ?? "bg-white/12 text-white/80";

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

const sid   = s => s.Student_ID   || s.student_id   || "";
const sname = s => s.Student_Name || s.student_name || "";
const scls  = s => s.Class        || s.class        || "";

// ─────────────────────────────────────────────────────────────────
// TOAST HOOK
// ─────────────────────────────────────────────────────────────────

function useToast() {
  const [toasts, setToasts] = useState([]);
  const dismiss = useCallback(id => setToasts(t => t.filter(x => x.id !== id)), []);
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
  const { canDo } = useAuth();
  const perm = { mark: canDo("nap_tracking", "mark") };

  const [cls,           setCls]           = useState("All");
  const [studentSearch, setStudentSearch] = useState("");
  const [histDate,      setHistDate]      = useState(todayISO);
  const [histStudent,   setHistStudent]   = useState("");

  const [students,   setStudents]   = useState([]);
  const [activeNaps, setActiveNaps] = useState([]);
  const [history,    setHistory]    = useState([]);
  const [stats,      setStats]      = useState({ currentlySleeping: 0, totalNapsToday: 0, avgDurationMinutes: 0 });

  const [loading,      setLoading]      = useState(true);
  const [bootError,    setBootError]    = useState(false);
  const [histLoading,  setHistLoading]  = useState(false);
  const [actionId,     setActionId]     = useState(null);
  const [wakeModal,    setWakeModal]    = useState(null);
  const [wakeLoading,  setWakeLoading]  = useState(false);
  const [refusedModal, setRefusedModal] = useState(null);
  const [lastNap,      setLastNap]      = useState(null);

  const mountedRef    = useRef(true);
  const refreshingRef = useRef(false);

  const [, refreshTick] = useReducer(x => x + 1, 0);
  useEffect(() => {
    const id = setInterval(refreshTick, 1000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line

  const toast = useToast();

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => { boot(); }, []); // eslint-disable-line

  async function boot() {
    if (!mountedRef.current) return;
    setLoading(true); setBootError(false);
    try {
      const today = todayISO();
      const [studRes, activeRes, histRes, statsRes] = await Promise.all([
        napService.getStudents(), napService.getActiveNaps(),
        napService.getNapHistory({ date: today }), napService.getStats({ date: today }),
      ]);
      if (!mountedRef.current) return;
      setStudents(Array.isArray(studRes)   ? studRes   : []);
      setActiveNaps(Array.isArray(activeRes) ? activeRes : []);
      setHistory(Array.isArray(histRes)    ? histRes   : []);
      setStats(statsRes ?? { currentlySleeping: 0, totalNapsToday: 0, avgDurationMinutes: 0 });
    } catch {
      if (!mountedRef.current) return;
      setBootError(true); toast.error("Could not connect to the server.");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    if (loading) return;
    fetchHistory(histDate);
  }, [histDate]); // eslint-disable-line

  async function fetchHistory(date) {
    if (!mountedRef.current) return;
    setHistLoading(true);
    try {
      const [histRes, statsRes] = await Promise.all([
        napService.getNapHistory({ date }), napService.getStats({ date }),
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

  const visibleStudents = students
    .filter(s => (s.Status || s.status || "Active") === "Active")
    .filter(s => cls === "All" || scls(s) === cls)
    .filter(s => !studentSearch || sname(s).toLowerCase().includes(studentSearch.toLowerCase()));

  const visibleHistory = history
    .filter(n => cls === "All" || n.class === cls)
    .filter(n => !histStudent || n.student_name.toLowerCase().includes(histStudent.toLowerCase()));

  const isSleeping   = s => activeNaps.some(n => n.student_id === sid(s));
  const getActiveNap = s => activeNaps.find(n => n.student_id === sid(s));

  async function handleStart(student) {
    if (actionId) return;
    const id = sid(student);
    setActionId(id);
    try {
      await napService.startNap({ student_id: id, student_name: sname(student), class: scls(student) });
      toast.success(`${sname(student)}'s nap started 😴`);
      setLastNap({ student_id: id, student_name: sname(student) });
      await refresh();
    } catch (e) {
      toast.error(e.message || "Could not start nap.");
    } finally {
      if (mountedRef.current) setActionId(null);
    }
  }

  async function handleUndo() {
    if (!lastNap || actionId) return;
    const nap = activeNaps.find(n => n.student_id === lastNap.student_id);
    if (!nap) { toast.error("Nothing to undo."); setLastNap(null); return; }
    setActionId(lastNap.student_id);
    try {
      await napService.wakeUp({ nap_id: nap.nap_id, mood: "", notes: "" });
      toast.success(`↩ Undone — ${lastNap.student_name} back to idle`);
      setLastNap(null);
      await refresh();
    } catch {
      toast.error("Could not undo.");
    } finally {
      if (mountedRef.current) setActionId(null);
    }
  }

  async function handleWakeUp() {
    if (!wakeModal || wakeLoading) return;
    setWakeLoading(true);
    try {
      await napService.wakeUp({ nap_id: wakeModal.nap.nap_id, mood: wakeModal.mood, notes: wakeModal.notes });
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

  function handleRefused(student, reason) {
    const reasonLabel = REFUSED_REASONS.find(r => r.id === reason)?.label;
    toast.success(reasonLabel
      ? `${sname(student)}: Can't sleep — ${reasonLabel} 🚫`
      : `${sname(student)}: Could not sleep logged 🚫`);
    setRefusedModal(null);
  }

  // ── Keyboard shortcuts ────────────────────────────────────────
  const kbRef = useRef({});
  kbRef.current = { visibleStudents, activeNaps, perm, actionId, wakeLoading, lastNap,
                    handleStart, handleUndo, openWakeModal, setRefusedModal };

  useEffect(() => {
    function onKey(e) {
      const tgt = e.target;
      if (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const r  = kbRef.current;
      const isl = s => r.activeNaps.some(n => n.student_id === sid(s));
      const gan = s => r.activeNaps.find(n => n.student_id === sid(s));
      if (e.key === "ArrowRight") {
        e.preventDefault();
        const s = r.visibleStudents.find(st => !isl(st));
        if (s && r.perm.mark && !r.actionId) r.handleStart(s);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        const s = r.visibleStudents.find(st => isl(st));
        const nap = s && gan(s);
        if (nap && r.perm.mark && !r.wakeLoading) r.openWakeModal(nap);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const s = r.visibleStudents.find(st => !isl(st));
        if (s && r.perm.mark) r.setRefusedModal({ name: sname(s), klass: scls(s) });
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (r.lastNap && r.perm.mark) r.handleUndo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []); // eslint-disable-line

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="nt-page flex min-h-screen" style={{ background: `linear-gradient(150deg, ${W.bg1} 0%, ${W.bg2} 50%, ${W.bg3} 100%)` }}>
      <style>{NAP_CSS}</style>

      <Sidebar />

      <div className="flex-1 min-w-0 overflow-auto">

        {/* ── STICKY HEADER ─────────────────────────────── */}
        <div className="sticky top-0 z-20 backdrop-blur-2xl" style={{
          background: `rgba(255,253,246,0.92)`,
          borderBottom: `1px solid rgba(139,125,101,0.10)`,
          boxShadow: `0 1px 0 rgba(255,255,255,0.7) inset, 0 4px 24px rgba(31,26,23,0.06)`,
        }}>
          <div className="px-6 md:px-10 py-5 md:py-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">

              <div className="flex-shrink-0">
                <p style={{ color: W.muted1, fontSize: 9.5, fontWeight: 500, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.75 }}>
                  Yellow Dot · Teacher View
                </p>
                <h1 className="leading-none mt-1.5" style={{ color: W.charcoal1, fontSize: "clamp(2rem,4vw,2.75rem)", fontWeight: 800, letterSpacing: "-0.04em" }}>
                  Nap Tracker
                </h1>
              </div>

              {/* Class pills */}
              <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-0.5 flex-shrink-0">
                {CLASSES.map(c => (
                  <button
                    key={c}
                    onClick={() => setCls(c)}
                    className={`px-3.5 py-1.5 rounded-full text-[13px] whitespace-nowrap flex-shrink-0 transition-all duration-200 ${
                      cls === c ? "nt-pill-active scale-[1.03]" : ""
                    }`}
                    style={cls !== c ? {
                      background: `rgba(139,125,101,0.07)`,
                      color: W.muted1,
                      fontWeight: 450,
                      border: `1px solid rgba(139,125,101,0.08)`,
                    } : { fontWeight: 600 }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 md:px-10 py-8 space-y-8">

          {/* ── STAT CARDS ──────────────────────────────── */}
          {loading ? <SkeletonStatCards /> : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">

              {/* Sleeping — warm charcoal */}
              <div
                className="rounded-[28px] p-6 relative overflow-hidden cursor-default"
                style={{
                  background: `linear-gradient(135deg, ${W.charcoal1} 0%, ${W.charcoal2} 55%, ${W.charcoal3} 100%)`,
                  boxShadow: `0 1px 0 rgba(244,196,48,0.12) inset, 0 -1px 0 rgba(0,0,0,0.20) inset, 0 8px 32px rgba(31,26,23,0.28), 0 28px 56px rgba(31,26,23,0.16)`,
                  transition: "transform 300ms cubic-bezier(.16,1,.3,1), box-shadow 300ms ease",
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px) scale(1.01)"; e.currentTarget.style.boxShadow = `0 1px 0 rgba(244,196,48,0.14) inset, 0 -1px 0 rgba(0,0,0,0.20) inset, 0 14px 48px rgba(31,26,23,0.32), 0 36px 72px rgba(31,26,23,0.18)`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = `0 1px 0 rgba(244,196,48,0.12) inset, 0 -1px 0 rgba(0,0,0,0.20) inset, 0 8px 32px rgba(31,26,23,0.28), 0 28px 56px rgba(31,26,23,0.16)`; }}
              >
                {/* Gold ambient top-right glow */}
                <div style={{ position: "absolute", top: -50, right: -50, width: 180, height: 180, background: `radial-gradient(circle, rgba(244,196,48,0.09) 0%, transparent 70%)`, pointerEvents: "none" }} />
                <div style={{ position: "absolute", bottom: -30, left: -30, width: 130, height: 130, background: `radial-gradient(circle, rgba(244,196,48,0.05) 0%, transparent 70%)`, pointerEvents: "none" }} />

                {stats.currentlySleeping > 0 && (
                  <span className="absolute top-5 right-5 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400" />
                  </span>
                )}
                <div className="text-3xl mb-4 select-none relative z-10">😴</div>
                <div className="text-5xl font-black tracking-tight tabular-nums leading-none relative z-10"
                  style={{ color: "#ffffff", fontVariantNumeric: "tabular-nums",
                    ...(stats.currentlySleeping > 0 ? { animation: "nt-stat-pulse 4s ease-in-out infinite" } : {}) }}>
                  {stats.currentlySleeping}
                </div>
                <div className="mt-4 text-sm relative z-10" style={{ color: W.goldPale, fontWeight: 500 }}>Currently Sleeping</div>
                <div className="text-xs mt-0.5 relative z-10" style={{ color: `rgba(244,196,48,0.40)`, fontWeight: 400 }}>
                  {stats.currentlySleeping === 1 ? "1 student napping" : `${stats.currentlySleeping} students napping`}
                </div>
              </div>

              {/* Total naps — warm gold glass */}
              <div
                className="nt-gold-panel rounded-[28px] p-6 relative overflow-hidden cursor-default"
                style={{ transition: "transform 300ms cubic-bezier(.16,1,.3,1), box-shadow 300ms ease" }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px) scale(1.01)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ""; }}
              >
                <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "120%", height: "120%", background: "radial-gradient(ellipse at 60% 40%, rgba(255,255,255,0.30) 0%, transparent 70%)", pointerEvents: "none" }} />
                <div className="text-3xl mb-4 select-none relative z-10">📊</div>
                <div className="text-5xl font-black tracking-tight tabular-nums leading-none relative z-10" style={{ color: W.charcoal1 }}>
                  {stats.totalNapsToday}
                </div>
                <div className="mt-4 text-sm relative z-10" style={{ color: W.charcoal2, fontWeight: 500 }}>Total Naps</div>
                <div className="text-xs mt-0.5 relative z-10" style={{ color: W.muted2, fontWeight: 400 }}>{fmtDate(histDate)}</div>
              </div>

              {/* Avg duration — ivory minimal */}
              <div
                className="nt-ivory-card rounded-[28px] p-6 relative overflow-hidden cursor-default"
                style={{ transition: "transform 300ms cubic-bezier(.16,1,.3,1), box-shadow 300ms ease" }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px) scale(1.01)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ""; }}
              >
                <div style={{ position: "absolute", bottom: -30, right: -30, width: 130, height: 130, background: `radial-gradient(circle, rgba(244,196,48,0.06) 0%, transparent 70%)`, pointerEvents: "none" }} />
                <div className="text-3xl mb-4 select-none relative z-10">⏱️</div>
                <div className="text-5xl font-black tracking-tight leading-none relative z-10" style={{ color: W.charcoal1 }}>
                  {fmtDuration(stats.avgDurationMinutes)}
                </div>
                <div className="mt-4 text-sm relative z-10" style={{ color: W.charcoal2, fontWeight: 500 }}>Avg Duration</div>
                <div className="text-xs mt-0.5 relative z-10" style={{ color: W.muted1, fontWeight: 400 }}>completed naps only</div>
              </div>

            </div>
          )}

          {/* ── MAIN PANEL ──────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

            {/* Students grid */}
            <div className="nt-card lg:col-span-3 rounded-[32px] p-6 md:p-8">

              {/* Panel header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
                <div>
                  <div className="flex items-center gap-2.5 mb-1">
                    <div className="w-1 h-5 rounded-full flex-shrink-0" style={{ background: `linear-gradient(180deg, ${W.gold1}, ${W.gold3})` }} />
                    <h2 className="text-xl" style={{ color: W.charcoal1, fontWeight: 700, letterSpacing: "-0.03em" }}>Students</h2>
                  </div>
                  <p className="text-xs pl-3.5" style={{ color: W.muted1 }}>
                    {cls === "All" ? "All classes" : cls} · → sleep · ← wake · ↑ can't sleep{lastNap ? " · ↓ undo" : ""}
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="relative flex-1 sm:flex-none">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm pointer-events-none select-none" style={{ color: W.muted1 }}>🔍</span>
                    <input
                      type="text"
                      value={studentSearch}
                      onChange={e => setStudentSearch(e.target.value)}
                      placeholder="Search…"
                      className="nt-input w-full sm:w-44 pl-9 pr-4 py-2.5 text-sm placeholder:font-normal"
                      style={{ color: W.charcoal1, fontWeight: 500 }}
                    />
                  </div>
                  <span className="font-black text-sm w-9 h-9 flex items-center justify-center rounded-2xl flex-shrink-0 tabular-nums"
                    style={{ background: `rgba(139,125,101,0.08)`, color: W.charcoal2, border: `1px solid rgba(139,125,101,0.10)` }}>
                    {loading ? "·" : visibleStudents.length}
                  </span>
                </div>
              </div>

              {loading ? <SkeletonGrid /> : bootError ? (
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
                      <SwipeCard
                        key={id}
                        name={name}
                        klass={klass}
                        sleeping={sleeping}
                        duration={dur}
                        starting={actionId === id}
                        disabled={!!actionId && actionId !== id}
                        onStart={perm.mark ? () => handleStart(s) : undefined}
                        onWakeUp={sleeping && nap && perm.mark ? () => openWakeModal(nap) : undefined}
                        onRefuse={!sleeping && perm.mark ? () => setRefusedModal({ name, klass }) : undefined}
                        onUndo={!sleeping && perm.mark ? handleUndo : undefined}
                        hasUndo={!!lastNap && !sleeping}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── ACTIVE NAPS PANEL ────────────────────── */}
            <div className="nt-nap-panel lg:col-span-2 rounded-[32px] p-6 md:p-8 relative overflow-hidden">
              {/* Ambient blobs */}
              <div style={{ position: "absolute", top: -50, right: -50, width: 220, height: 220, background: `radial-gradient(circle, rgba(244,196,48,0.10) 0%, transparent 70%)`, pointerEvents: "none" }} />
              <div style={{ position: "absolute", bottom: -40, left: -40, width: 160, height: 160, background: `radial-gradient(circle, rgba(244,196,48,0.07) 0%, transparent 70%)`, pointerEvents: "none" }} />

              <div className="relative z-10 h-full flex flex-col">

                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl" style={{ color: W.charcoal1, fontWeight: 700, letterSpacing: "-0.03em" }}>Active Naps</h2>
                    <p className="text-xs mt-0.5" style={{ color: W.muted1, fontWeight: 400 }}>Live tracking</p>
                  </div>
                  {!loading && activeNaps.length > 0 && (
                    <div className="flex items-center gap-2 rounded-full px-3 py-1.5"
                      style={{ background: "rgba(34,197,94,0.10)", border: "1px solid rgba(34,197,94,0.20)" }}>
                      <span className="flex h-2 w-2 relative flex-shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                      </span>
                      <span className="text-emerald-700 text-[11px] font-bold tabular-nums">{activeNaps.length} live</span>
                    </div>
                  )}
                </div>

                {loading ? <SkeletonActiveNaps /> : activeNaps.length === 0 ? (
                  <div className="flex flex-col items-center justify-center flex-1 py-10 md:py-14">
                    <div className="relative w-20 h-20 rounded-3xl flex items-center justify-center mb-5 select-none"
                      style={{
                        background: "rgba(255,253,246,0.80)",
                        boxShadow: `0 1px 0 rgba(255,255,255,0.9) inset, 0 4px 16px rgba(31,26,23,0.07)`,
                        border: `1px solid rgba(244,196,48,0.16)`,
                        animation: "nt-moon-float 4.5s ease-in-out infinite",
                      }}>
                      {/* Ambient glow behind moon */}
                      <div className="absolute inset-0 rounded-3xl" style={{ background: "radial-gradient(circle at 50% 40%, rgba(244,196,48,0.12) 0%, transparent 70%)" }} />
                      <span className="text-4xl relative z-10">🌙</span>
                    </div>
                    <p className="text-sm" style={{ color: W.muted1, fontWeight: 500 }}>No active naps</p>
                    <p className="text-xs mt-1.5 text-center leading-relaxed max-w-[150px]" style={{ color: `rgba(139,125,101,0.52)`, fontWeight: 400 }}>
                      Swipe right on a student card to start
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5 overflow-y-auto flex-1 scrollbar-none">
                    {activeNaps.map((nap, i) => (
                      <div key={nap.nap_id} style={{ animation: `nt-nap-slide-in 360ms cubic-bezier(.16,1,.3,1) ${i * 60}ms both` }}>
                        <ActiveNapCard nap={nap} duration={liveDuration(nap.start_time)} onWakeUp={() => openWakeModal(nap)} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* ── NAP LOG — TIMELINE ────────────────────────── */}
          <div className="nt-card rounded-[32px] p-6 md:p-8">

            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-7">
              <div>
                <div className="flex items-center gap-2.5 mb-1">
                  <div className="w-1 h-5 rounded-full flex-shrink-0" style={{ background: `linear-gradient(180deg, ${W.gold1}, ${W.gold3})` }} />
                  <h2 className="text-xl" style={{ color: W.charcoal1, fontWeight: 700, letterSpacing: "-0.03em" }}>Nap Log</h2>
                </div>
                <p className="text-xs pl-3.5" style={{ color: W.muted1 }}>
                  {histLoading ? "Loading…" : `${visibleHistory.length} entr${visibleHistory.length === 1 ? "y" : "ies"}`}
                  {" · "}{fmtDate(histDate)}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs pointer-events-none select-none" style={{ color: W.muted1 }}>📅</span>
                  <input
                    type="date"
                    value={histDate}
                    max={todayISO()}
                    onChange={e => setHistDate(e.target.value)}
                    className="nt-input pl-9 pr-3.5 py-2.5 text-sm cursor-pointer"
                    style={{ color: W.charcoal1, fontWeight: 500 }}
                  />
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs pointer-events-none select-none" style={{ color: W.muted1 }}>🔍</span>
                  <input
                    type="text"
                    value={histStudent}
                    onChange={e => setHistStudent(e.target.value)}
                    placeholder="Filter student…"
                    className="nt-input w-40 pl-9 pr-4 py-2.5 text-sm"
                    style={{ color: W.charcoal1, fontWeight: 500 }}
                  />
                </div>
                {histDate !== todayISO() && (
                  <button
                    onClick={() => setHistDate(todayISO())}
                    className="text-xs font-bold px-4 py-2.5 rounded-full transition-all active:scale-95"
                    style={{
                      background: `rgba(244,196,48,0.12)`,
                      color: W.charcoal2,
                      border: `1px solid rgba(244,196,48,0.30)`,
                    }}
                  >
                    Today
                  </button>
                )}
              </div>
            </div>

            {histLoading ? <SkeletonTimeline /> : visibleHistory.length === 0 ? (
              <EmptyHistory filtered={!!histStudent || cls !== "All"} />
            ) : (
              <div>
                {visibleHistory.map((nap, i) => {
                  const dur  = nap.status === "Sleeping" ? liveDuration(nap.start_time) : null;
                  const mood = MOODS.find(m => m.value === nap.mood);
                  return (
                    <div key={nap.nap_id || i}>
                      {i > 0 && <div style={{ height: 1, background: `rgba(139,125,101,0.07)`, margin: "0 4px" }} />}
                      <div className="nt-timeline-row flex items-center gap-3 py-2.5 px-3">
                        <div className={`w-8 h-8 flex-shrink-0 rounded-xl bg-gradient-to-br ${avatarGrad(nap.student_name)} flex items-center justify-center text-white font-black text-[10px]`}
                          style={{ boxShadow: "0 1px 6px rgba(31,26,23,0.12)" }}>
                          {initials(nap.student_name)}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center flex-wrap gap-1.5 mb-0.5">
                            <span className="text-sm truncate max-w-[130px]" style={{ color: W.charcoal1, fontWeight: 550 }}>{nap.student_name}</span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0 ${classPill(nap.class)}`}>{nap.class}</span>
                            {mood && <span className="text-sm leading-none select-none flex-shrink-0" title={mood.value}>{mood.emoji}</span>}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] flex-wrap" style={{ color: W.muted1, fontWeight: 400 }}>
                            <span className="font-mono tabular-nums">{fmtTime(nap.start_time)}</span>
                            {nap.end_time && <><span style={{ opacity: 0.35 }}>→</span><span className="font-mono tabular-nums">{fmtTime(nap.end_time)}</span></>}
                            <span style={{ opacity: 0.28 }}>·</span>
                            <span className="font-bold text-[11px] tabular-nums" style={{ color: W.charcoal2 }}>
                              {dur ? dur.display : fmtDuration(nap.duration_minutes)}
                            </span>
                            {nap.notes && <><span style={{ opacity: 0.28 }}>·</span><span className="italic truncate max-w-[100px]">{nap.notes}</span></>}
                          </div>
                        </div>

                        <div className="flex-shrink-0">
                          <StatusBadge status={nap.status} mini />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>

      {wakeModal && (
        <WakeUpSheet
          nap={wakeModal.nap} mood={wakeModal.mood} notes={wakeModal.notes}
          loading={wakeLoading}
          onMood={mood   => setWakeModal(p => ({ ...p, mood  }))}
          onNotes={notes => setWakeModal(p => ({ ...p, notes }))}
          onConfirm={handleWakeUp}
          onClose={() => !wakeLoading && setWakeModal(null)}
        />
      )}
      {refusedModal && (
        <RefusedSheet
          student={refusedModal}
          onConfirm={reason => handleRefused(refusedModal, reason)}
          onClose={() => setRefusedModal(null)}
        />
      )}
      <ToastStack toasts={toast.toasts} onDismiss={toast.dismiss} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// NAP PARTICLES
// ─────────────────────────────────────────────────────────────────

function NapParticles() {
  return (
    <div className="absolute inset-0 pointer-events-none z-[60] overflow-visible" style={{ isolation: "isolate" }}>
      <span className="absolute nt-p1 text-xl" style={{ top: "38%", left: "48%" }}>✨</span>
      <span className="absolute nt-p2 text-lg" style={{ top: "42%", left: "56%" }}>⭐</span>
      <span className="absolute nt-p3 text-base" style={{ top: "50%", left: "42%" }}>🌟</span>
      <span className="absolute nt-p4 text-sm" style={{ top: "34%", left: "54%" }}>💫</span>
      <span className="absolute nt-p5 text-sm" style={{ top: "46%", left: "60%" }}>✦</span>
      <span className="absolute nt-moon text-2xl" style={{ top: "40%", left: "46%" }}>🌙</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SWIPE CARD — Framer Motion, warm charcoal palette
// ─────────────────────────────────────────────────────────────────

function SwipeCard({ name, klass, sleeping, duration, starting, disabled, onStart, onWakeUp, onRefuse, onUndo, hasUndo }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-130, 0, 130], [-9, 0, 9]);

  const [drag, setDrag]       = useState({ action: null, ready: false });
  const [particles, setParticles] = useState(false);
  const [shaking,   setShaking]   = useState(false);

  const HINT_T   = 30;
  const COMMIT   = 82;
  const COMMIT_Y = 66;
  const COMMIT_D = 62;

  const canStart  = !sleeping && !disabled && !starting && !!onStart;
  const canWake   = sleeping  && !disabled && !!onWakeUp;
  const canRefuse = !sleeping && !disabled && !!onRefuse;
  const canUndo   = hasUndo   && !sleeping && !disabled && !!onUndo;

  function computeAction(ox, oy) {
    if (canStart  && ox >  HINT_T) return "start";
    if (canWake   && ox < -HINT_T) return "wake";
    if (canRefuse && oy < -HINT_T) return "refuse";
    if (canUndo   && oy >  HINT_T) return "undo";
    return null;
  }

  function handleDrag(_, info) {
    const ox = info.offset.x, oy = info.offset.y;
    const action = computeAction(ox, oy);
    const ready =
      (action === "start"  && ox >  COMMIT)   ||
      (action === "wake"   && ox < -COMMIT)   ||
      (action === "refuse" && oy < -COMMIT_Y) ||
      (action === "undo"   && oy >  COMMIT_D);
    setDrag(prev => (prev.action === action && prev.ready === ready ? prev : { action, ready }));
  }

  function handleDragEnd(_, info) {
    const ox = info.offset.x, oy = info.offset.y;
    const vx = info.velocity.x, vy = info.velocity.y;
    setDrag({ action: null, ready: false });
    if      (canStart  && (ox >  COMMIT   || vx >  500)) doStart();
    else if (canWake   && (ox < -COMMIT   || vx < -500)) doWake();
    else if (canRefuse && (oy < -COMMIT_Y || vy < -600)) doRefuse();
    else if (canUndo   && (oy >  COMMIT_D || vy >  500)) doUndo();
  }

  function doStart() {
    if (navigator.vibrate) navigator.vibrate([14, 40, 28]);
    setParticles(true); setTimeout(() => setParticles(false), 1150);
    onStart?.();
  }
  function doWake()   { onWakeUp?.(); }
  function doRefuse() {
    if (navigator.vibrate) navigator.vibrate([22, 14, 22]);
    setShaking(true); setTimeout(() => setShaking(false), 420);
    onRefuse?.();
  }
  function doUndo() { onUndo?.(); }

  // Live overlay colour (reads motion values at render time after drag state update)
  const { action: dragAction, ready: dragReady } = drag;
  const overlayBg = (() => {
    if (!dragAction) return "transparent";
    const xv = Math.abs(x.get()), yv = Math.abs(y.get());
    if (dragAction === "start")  return `rgba(31,26,23,${Math.min(.18, xv/130*.18)})`;
    if (dragAction === "wake")   return `rgba(245,158,11,${Math.min(.18, xv/130*.18)})`;
    if (dragAction === "refuse") return `rgba(220,38,38,${Math.min(.15, yv/100*.15)})`;
    if (dragAction === "undo")   return `rgba(99,102,241,${Math.min(.12, yv/80*.12)})`;
    return "transparent";
  })();

  const hintCfg = {
    start:  { icon: "🌙", label: "Start Nap",   bg: W.charcoal1, pos: { right: 10, top: "50%", transform: "translateY(-50%)" } },
    wake:   { icon: "☀️", label: "Wake Up",     bg: "#b45309",  pos: { left: 10,  top: "50%", transform: "translateY(-50%)" } },
    refuse: { icon: "🚫", label: "Can't sleep", bg: "#dc2626",  pos: { top: 10, left: "50%", transform: "translateX(-50%)" } },
    undo:   { icon: "↩️", label: "Undo",        bg: W.charcoal3, pos: { bottom: 10, left: "50%", transform: "translateX(-50%)" } },
  };

  const dragElastic = sleeping
    ? { left: 0.82, right: 0.14, top: 0.65, bottom: 0.08 }
    : { left: 0.14, right: 0.82, top: 0.65, bottom: canUndo ? 0.55 : 0.08 };

  return (
    <div className={`relative ${shaking ? "nt-refused" : ""}`} style={{ isolation: "isolate" }}>
      {particles && <NapParticles />}

      <motion.div
        drag={!disabled && !starting}
        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
        dragElastic={dragElastic}
        dragMomentum={false}
        style={{
          x, y, rotate,
          cursor: !disabled && !starting ? "grab" : "default",
          touchAction: "none",
          userSelect: "none",
          willChange: "transform",
          ...(sleeping ? {
            background: `linear-gradient(135deg, ${W.charcoal1} 0%, ${W.charcoal2} 55%, ${W.charcoal3} 100%)`,
            boxShadow: `0 1px 0 rgba(244,196,48,0.10) inset, 0 6px 24px rgba(31,26,23,0.28), 0 18px 40px rgba(31,26,23,0.16)`,
          } : disabled ? {
            background: W.bg3,
            opacity: 0.5,
          } : {}),
        }}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        className={[
          "relative rounded-[20px] p-4 overflow-hidden flex flex-col",
          sleeping ? "nt-sleeping-card" : !disabled ? "nt-idle-card" : "",
        ].filter(Boolean).join(" ")}
      >
        {/* Drag colour overlay */}
        {dragAction && (
          <div className="absolute inset-0 pointer-events-none z-[1] rounded-[inherit]"
            style={{ background: overlayBg, transition: "background 60ms" }} />
        )}

        {/* Hint bubble */}
        {dragAction && (() => {
          const c = hintCfg[dragAction];
          return (
            <div className="absolute z-20 pointer-events-none" style={c.pos}>
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-white text-[11px] font-black whitespace-nowrap"
                style={{
                  background: c.bg,
                  boxShadow: dragReady ? `0 4px 18px ${c.bg}70` : "0 2px 10px rgba(0,0,0,.24)",
                  transform: dragReady ? "scale(1.12)" : "scale(1)",
                  transition: "transform 120ms ease, box-shadow 120ms ease",
                  animation: "nt-hint-in 140ms cubic-bezier(.16,1,.3,1) both",
                }}>
                <span>{c.icon}</span><span>{c.label}</span>
              </div>
            </div>
          );
        })()}

        {/* Sleeping gold dot */}
        {sleeping && (
          <span className="absolute top-3 right-3 flex h-2.5 w-2.5 z-10">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: W.gold1 }} />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: W.gold1 }} />
          </span>
        )}

        {/* Avatar — with radial glow halo on sleeping state */}
        <div className="relative z-10 mb-3 flex-shrink-0 w-14 h-14">
          {sleeping && (
            <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{
              background: `radial-gradient(circle at 50% 50%, rgba(244,196,48,0.28) 0%, transparent 72%)`,
              transform: "scale(1.55)",
              animation: "nt-avatar-glow 3.6s ease-in-out infinite",
            }} />
          )}
          <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${avatarGrad(name)} flex items-center justify-center text-white font-black text-base relative`}
            style={{ boxShadow: sleeping ? "0 6px 20px rgba(31,26,23,0.50)" : "0 2px 10px rgba(31,26,23,0.14)" }}>
            {initials(name)}
          </div>
        </div>

        {/* Name */}
        <p className="relative z-10 text-sm leading-tight line-clamp-2"
          style={{ color: sleeping ? W.goldPale : W.charcoal1, letterSpacing: "-0.02em", fontWeight: sleeping ? 500 : 600 }}>
          {name}
        </p>

        {/* Class badge */}
        <span className={`relative z-10 inline-block text-[9px] font-bold px-2 py-0.5 rounded-lg mt-1.5 mb-3 ${
          sleeping ? classDark(klass) : classPill(klass)
        }`}>
          {klass}
        </span>

        {/* Bottom */}
        <div className="mt-auto relative z-10">
          {sleeping ? (
            <>
              {duration && (
                <div className="mb-1.5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-1.5 h-1.5 rounded-full inline-block flex-shrink-0"
                      style={{ background: W.gold1, animation: "nt-dot 2.2s ease-in-out infinite" }} />
                    <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: `rgba(244,196,48,0.65)` }}>Sleeping</span>
                  </div>
                  <p className="font-black text-[17px] font-mono tracking-widest tabular-nums leading-tight"
                    style={{ color: "#ffffff", animation: "nt-tick 1s ease both" }}>
                    {duration.display}
                  </p>
                </div>
              )}
              <p className="text-[10px] text-center mt-1 select-none" style={{ color: `rgba(244,196,48,0.30)`, fontWeight: 400, letterSpacing: "0.01em" }}>
                ← swipe to wake
              </p>
            </>
          ) : starting ? (
            <div className="flex items-center justify-center gap-2 py-2.5">
              <span className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin flex-shrink-0"
                style={{ borderColor: `${W.muted1} transparent transparent transparent` }} />
              <span className="text-[11px] font-bold" style={{ color: W.muted1 }}>Starting…</span>
            </div>
          ) : !disabled ? (
            <p className="text-[9px] text-center select-none pt-0.5" style={{ color: `rgba(139,125,101,0.42)`, fontWeight: 400, letterSpacing: "0.01em" }}>
              → sleep · ↑ can't sleep{canUndo ? " · ↓ undo" : ""}
            </p>
          ) : null}
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// ACTIVE NAP CARD — warm glass
// ─────────────────────────────────────────────────────────────────

function ActiveNapCard({ nap, duration, onWakeUp }) {
  return (
    <div className="nt-nap-card rounded-[20px] p-4">
      <div className="flex items-center gap-2.5 mb-3">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${avatarGrad(nap.student_name)} flex items-center justify-center text-white font-black text-xs flex-shrink-0`}
          style={{ boxShadow: "0 2px 8px rgba(31,26,23,0.18)" }}>
          {initials(nap.student_name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] leading-snug truncate" style={{ color: W.charcoal1, fontWeight: 550 }}>{nap.student_name}</p>
          <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-md mt-0.5 ${classPill(nap.class)}`}>
            {nap.class}
          </span>
        </div>
        <div className="flex items-center gap-1.5 rounded-full px-2 py-1 flex-shrink-0"
          style={{ background: "rgba(34,197,94,0.10)", border: "1px solid rgba(34,197,94,0.18)" }}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse inline-block flex-shrink-0 bg-emerald-400" />
          <span className="text-emerald-700 text-[9px] font-bold uppercase tracking-wide">Live</span>
        </div>
      </div>

      {/* Timer */}
      <div className="rounded-xl px-3 py-2.5 mb-3 flex items-center justify-between"
        style={{ background: `rgba(248,244,234,0.70)`, border: `1px solid rgba(139,125,101,0.08)` }}>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: W.muted1 }}>Duration</p>
          <p className="font-black text-[22px] font-mono tracking-widest tabular-nums leading-tight" style={{ color: W.charcoal1 }}>
            {duration.display.slice(0, 5)}
            <span className="text-base" style={{ opacity: 0.55 }}>{duration.display.slice(5)}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: W.muted1 }}>Started</p>
          <p className="text-sm font-bold" style={{ color: W.charcoal2 }}>{fmtTime(nap.start_time)}</p>
        </div>
      </div>

      {/* Wake CTA */}
      <button
        onClick={onWakeUp}
        className="w-full font-black text-sm py-2.5 rounded-xl transition-all duration-200 active:scale-[0.98]"
        style={{
          background: `linear-gradient(135deg, ${W.gold2} 0%, ${W.gold1} 100%)`,
          color: W.charcoal1,
          boxShadow: `0 2px 8px rgba(224,177,0,0.24), 0 1px 0 rgba(255,255,255,0.40) inset`,
        }}
      >
        ☀️ Wake Up
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// WAKE-UP SHEET — premium warm modal
// ─────────────────────────────────────────────────────────────────

function WakeUpSheet({ nap, mood, notes, loading, onMood, onNotes, onConfirm, onClose }) {
  const dur = liveDuration(nap.start_time);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        className={`absolute inset-0 backdrop-blur-sm transition-opacity ${loading ? "pointer-events-none" : "cursor-pointer"}`}
        style={{ background: "rgba(31,26,23,0.50)" }}
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg rounded-t-[32px] shadow-2xl overflow-hidden max-h-[88dvh] flex flex-col nt-sheet-in"
        style={{ background: W.bg1, boxShadow: `0 -8px 48px rgba(31,26,23,0.18), 0 -1px 0 rgba(255,255,255,0.6) inset` }}>

        <div className="flex justify-center pt-3.5 flex-shrink-0">
          <div className="w-9 h-[3px] rounded-full" style={{ background: `rgba(139,125,101,0.18)` }} />
        </div>

        <div className="flex items-center gap-3.5 px-5 pt-3 pb-4 flex-shrink-0">
          <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${avatarGrad(nap.student_name)} flex items-center justify-center text-white font-black text-sm flex-shrink-0`}
            style={{ boxShadow: "0 3px 12px rgba(31,26,23,0.18)" }}>
            {initials(nap.student_name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-[15px] leading-tight truncate" style={{ color: W.charcoal1 }}>{nap.student_name}</p>
            <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md mt-0.5 ${classPill(nap.class)}`}>{nap.class}</span>
          </div>
          <div className="text-right flex-shrink-0 rounded-2xl px-3 py-2"
            style={{ background: W.bg2, border: `1px solid rgba(139,125,101,0.10)` }}>
            <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: W.muted1 }}>Duration</p>
            <p className="text-lg font-black font-mono tabular-nums leading-tight" style={{ color: W.charcoal1 }}>{dur.display.slice(0,5)}</p>
            <p className="text-[10px]" style={{ color: W.muted1 }}>{dur.totalMinutes}m total</p>
          </div>
        </div>

        <div className="h-px mx-5 flex-shrink-0" style={{ background: `rgba(139,125,101,0.08)` }} />

        <div className="px-5 pt-5 pb-6 space-y-5 overflow-y-auto flex-1 scrollbar-none">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: W.muted1 }}>
              Mood after nap <span className="ml-1.5 normal-case font-normal tracking-normal opacity-60">· optional</span>
            </p>
            <div className="flex gap-1.5">
              {MOODS.map(m => (
                <button
                  key={m.value}
                  onClick={() => onMood(mood === m.value ? "" : m.value)}
                  className={`flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-2xl transition-all duration-180 active:scale-[.92] ${mood === m.value ? "nt-badge-pop" : ""}`}
                  style={{
                    border: `2px solid ${mood === m.value ? W.gold1 : "rgba(139,125,101,0.12)"}`,
                    background: mood === m.value ? `rgba(244,196,48,0.10)` : `rgba(255,253,246,0.80)`,
                    boxShadow: mood === m.value ? `0 2px 8px rgba(224,177,0,0.18)` : "none",
                  }}
                >
                  <span className="text-2xl leading-none select-none">{m.emoji}</span>
                  <span className="text-[8px] font-bold uppercase tracking-wide" style={{ color: W.muted1 }}>{m.value}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: W.muted1 }}>
              Notes <span className="ml-1.5 normal-case font-normal tracking-normal opacity-60">· optional</span>
            </p>
            <textarea
              value={notes}
              onChange={e => onNotes(e.target.value)}
              rows={2}
              placeholder="Any observations about this nap…"
              className="w-full rounded-2xl px-4 py-3 resize-none text-sm"
              style={{
                background: `rgba(248,244,234,0.70)`,
                border: `1px solid rgba(139,125,101,0.12)`,
                color: W.charcoal1,
                outline: "none",
              }}
              onFocus={e => { e.target.style.boxShadow = `0 0 0 3px rgba(244,196,48,0.22)`; e.target.style.borderColor = `rgba(244,196,48,0.45)`; }}
              onBlur={e => { e.target.style.boxShadow = "none"; e.target.style.borderColor = `rgba(139,125,101,0.12)`; }}
            />
          </div>

          <div className="flex gap-2.5">
            <button
              onClick={onClose}
              disabled={loading}
              className="font-bold py-3.5 rounded-2xl transition-all disabled:opacity-40 text-sm active:scale-95 flex-shrink-0"
              style={{ width: "4.5rem", background: `rgba(139,125,101,0.10)`, color: W.muted2 }}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="flex-1 font-black py-3.5 rounded-2xl disabled:opacity-60 flex items-center justify-center gap-2 text-sm active:scale-[0.98] transition-all"
              style={{
                background: `linear-gradient(135deg, ${W.charcoal1} 0%, ${W.charcoal3} 100%)`,
                color: W.goldPale,
                boxShadow: `0 4px 16px rgba(31,26,23,0.24), 0 1px 0 rgba(244,196,48,0.08) inset`,
              }}
            >
              {loading ? (
                <><span className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: `${W.goldPale} transparent transparent transparent` }} />Saving…</>
              ) : "☀️ Wake Up"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// REFUSED SHEET
// ─────────────────────────────────────────────────────────────────

function RefusedSheet({ student, onConfirm, onClose }) {
  const [reason, setReason] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 backdrop-blur-sm cursor-pointer" style={{ background: "rgba(31,26,23,0.48)" }} onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-t-[32px] shadow-2xl overflow-hidden nt-sheet-in"
        style={{ background: W.bg1, boxShadow: `0 -8px 48px rgba(31,26,23,0.16)` }}>

        <div className="flex justify-center pt-3.5">
          <div className="w-9 h-[3px] rounded-full" style={{ background: `rgba(139,125,101,0.18)` }} />
        </div>

        <div className="flex items-center gap-3 px-5 pt-4 pb-4">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 select-none"
            style={{ background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.12)" }}>
            🚫
          </div>
          <div>
            <p className="font-bold text-[15px] leading-tight" style={{ color: W.charcoal1 }}>Could not sleep</p>
            <p className="text-sm mt-0.5" style={{ color: W.muted1 }}>{student?.name}</p>
          </div>
        </div>

        <div className="h-px mx-5" style={{ background: `rgba(139,125,101,0.08)` }} />

        <div className="px-5 pt-5 pb-6 space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: W.muted1 }}>
            Reason <span className="ml-1.5 normal-case font-normal tracking-normal opacity-60">· optional</span>
          </p>

          <div className="grid grid-cols-2 gap-2">
            {REFUSED_REASONS.map(r => (
              <button
                key={r.id}
                onClick={() => setReason(reason === r.id ? "" : r.id)}
                className="flex items-center gap-2.5 px-4 py-3 rounded-2xl text-left transition-all duration-180 active:scale-[.95]"
                style={{
                  border: `2px solid ${reason === r.id ? "rgba(220,38,38,0.25)" : "rgba(139,125,101,0.10)"}`,
                  background: reason === r.id ? "rgba(220,38,38,0.05)" : `rgba(255,253,246,0.80)`,
                }}
              >
                <span className="text-xl leading-none select-none">{r.emoji}</span>
                <span className="font-bold text-sm" style={{ color: reason === r.id ? "#dc2626" : W.muted2 }}>{r.label}</span>
              </button>
            ))}
          </div>

          <div className="flex gap-2.5 pt-1">
            <button
              onClick={onClose}
              className="font-bold py-3.5 rounded-2xl text-sm active:scale-95 flex-shrink-0 transition-all"
              style={{ width: "4.5rem", background: `rgba(139,125,101,0.10)`, color: W.muted2 }}
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(reason)}
              className="flex-1 font-black py-3.5 rounded-2xl flex items-center justify-center gap-2 text-sm active:scale-[0.98] transition-all text-white"
              style={{ background: "linear-gradient(135deg, #dc2626, #b91c1c)", boxShadow: "0 4px 14px rgba(185,28,28,0.25)" }}
            >
              🚫 Log: Can't sleep
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

function StatusBadge({ status, mini = false }) {
  if (status === "Sleeping") {
    return (
      <span className={`inline-flex items-center gap-1 font-bold rounded-full whitespace-nowrap ${mini ? "px-2 py-0.5 text-[9px]" : "px-3 py-1.5 text-xs"}`}
        style={{ background: `rgba(31,26,23,0.07)`, color: W.charcoal2, border: `1px solid rgba(31,26,23,0.09)` }}>
        <span className={`leading-none select-none ${mini ? "text-[10px]" : "text-sm"}`}>😴</span>
        {mini ? "Live" : "Sleeping"}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 font-bold rounded-full border border-emerald-100 whitespace-nowrap ${mini ? "px-2 py-0.5 text-[9px]" : "px-3 py-1.5 text-xs"}`}>
      <span className={`leading-none select-none ${mini ? "text-[10px]" : "text-sm"}`}>☀️</span>
      {mini ? "Done" : "Complete"}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────
// TOAST STACK
// ─────────────────────────────────────────────────────────────────

function ToastStack({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-0 left-0 right-0 sm:bottom-6 sm:left-auto sm:right-6 z-[100] flex flex-col gap-2 sm:gap-3 p-4 sm:p-0 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id}
          className="flex items-center gap-3 px-4 py-3.5 sm:px-5 sm:py-4 rounded-2xl shadow-2xl text-sm font-semibold w-full sm:min-w-[280px] sm:max-w-sm pointer-events-auto animate-toast-in"
          style={t.type === "success"
            ? { background: W.charcoal1, color: W.goldPale, boxShadow: `0 8px 32px rgba(31,26,23,0.35), 0 1px 0 rgba(244,196,48,0.08) inset` }
            : { background: "#b91c1c", color: "#fff" }}>
          <span className="text-xl flex-shrink-0 leading-none select-none">{t.type === "success" ? "✅" : "❌"}</span>
          <span className="flex-1 leading-snug">{t.message}</span>
          <button onClick={() => onDismiss(t.id)} aria-label="Dismiss"
            className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full transition-all text-base font-bold leading-none active:scale-90"
            style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.70)" }}>
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
      <div className="rounded-[28px] p-6 animate-pulse" style={{ background: `linear-gradient(135deg, ${W.charcoal1}, ${W.charcoal3})` }}>
        <div className="w-8 h-8 rounded-xl mb-4" style={{ background: "rgba(255,255,255,0.08)" }} />
        <div className="h-11 w-12 rounded-xl mb-3" style={{ background: "rgba(255,255,255,0.10)" }} />
        <div className="h-3.5 w-32 rounded-full mb-1.5" style={{ background: "rgba(255,255,255,0.08)" }} />
        <div className="h-3 w-24 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }} />
      </div>
      <div className="nt-gold-panel rounded-[28px] p-6 animate-pulse">
        <div className="w-8 h-8 rounded-xl mb-4" style={{ background: `rgba(31,26,23,0.08)` }} />
        <div className="h-11 w-12 rounded-xl mb-3" style={{ background: `rgba(31,26,23,0.08)` }} />
        <div className="h-3.5 w-24 rounded-full mb-1.5" style={{ background: `rgba(31,26,23,0.07)` }} />
        <div className="h-3 w-28 rounded-full" style={{ background: `rgba(31,26,23,0.05)` }} />
      </div>
      <div className="nt-ivory-card rounded-[28px] p-6 animate-pulse">
        <div className="w-8 h-8 bg-stone-100 rounded-xl mb-4" />
        <div className="h-11 w-20 bg-stone-100 rounded-xl mb-3" />
        <div className="h-3.5 w-28 bg-stone-100 rounded-full mb-1.5" />
        <div className="h-3 w-24 bg-stone-50 rounded-full" />
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
        <div key={i} className="rounded-[20px] p-4 animate-pulse flex flex-col"
          style={{ background: W.bg2, animationDelay: `${i * 80}ms` }}>
          <div className="w-11 h-11 rounded-2xl mb-3 flex-shrink-0" style={{ background: "rgba(139,125,101,0.15)" }} />
          <div className="h-3 rounded-full mb-1.5 w-4/5" style={{ background: "rgba(139,125,101,0.12)" }} />
          <div className="h-5 rounded-lg w-1/2 mb-3" style={{ background: "rgba(139,125,101,0.09)" }} />
          <div className="mt-auto h-4 rounded-full" style={{ background: "rgba(139,125,101,0.09)" }} />
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SKELETON — ACTIVE NAPS
// ─────────────────────────────────────────────────────────────────

function SkeletonActiveNaps() {
  return (
    <div className="space-y-3">
      {[0, 1].map(i => (
        <div key={i} className="rounded-[20px] p-4 animate-pulse"
          style={{ background: "rgba(255,255,255,0.55)", border: "1px solid rgba(244,196,48,0.12)" }}>
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-10 h-10 rounded-xl flex-shrink-0" style={{ background: "rgba(139,125,101,0.15)" }} />
            <div className="flex-1">
              <div className="h-3 rounded-full w-3/4 mb-1.5" style={{ background: "rgba(139,125,101,0.12)" }} />
              <div className="h-4 rounded-lg w-1/2" style={{ background: "rgba(139,125,101,0.09)" }} />
            </div>
          </div>
          <div className="rounded-xl py-7 mb-3" style={{ background: "rgba(248,244,234,0.55)" }} />
          <div className="h-9 rounded-xl" style={{ background: "rgba(244,196,48,0.15)" }} />
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SKELETON — TIMELINE
// ─────────────────────────────────────────────────────────────────

function SkeletonTimeline() {
  return (
    <div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3.5 py-3 px-3 animate-pulse" style={{ animationDelay: `${i * 70}ms` }}>
          <div className="w-10 h-10 rounded-xl flex-shrink-0" style={{ background: "rgba(139,125,101,0.12)" }} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="h-3 rounded-full w-28" style={{ background: "rgba(139,125,101,0.12)" }} />
              <div className="h-4 rounded-lg w-16" style={{ background: "rgba(139,125,101,0.09)" }} />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2.5 rounded-full w-14" style={{ background: "rgba(139,125,101,0.08)" }} />
              <div className="h-2.5 rounded-full w-3" style={{ background: "rgba(139,125,101,0.06)" }} />
              <div className="h-2.5 rounded-full w-10" style={{ background: "rgba(139,125,101,0.10)" }} />
            </div>
          </div>
          <div className="w-12 h-5 rounded-full flex-shrink-0" style={{ background: "rgba(139,125,101,0.09)" }} />
        </div>
      ))}
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
        <div className="w-16 h-16 rounded-3xl flex items-center justify-center text-3xl mb-4 select-none"
          style={{ background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.12)" }}>⚠️</div>
        <p className="text-lg font-bold" style={{ color: W.charcoal1 }}>Connection Error</p>
        <p className="mt-1.5 text-sm max-w-xs leading-relaxed" style={{ color: W.muted1 }}>
          Could not reach the server. Make sure the backend is running on port 5000.
        </p>
        <button onClick={onRetry} className="mt-5 px-6 py-2.5 font-bold text-sm rounded-full transition-all active:scale-95"
          style={{ background: `linear-gradient(135deg, ${W.gold2}, ${W.gold1})`, color: W.charcoal1, boxShadow: `0 2px 8px rgba(224,177,0,0.22)` }}>
          ↺ Retry
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="w-16 h-16 rounded-3xl flex items-center justify-center text-3xl mb-4 select-none"
        style={{ background: `rgba(244,196,48,0.10)`, border: `1px solid rgba(244,196,48,0.18)` }}>
        {searched ? "🔍" : "🎒"}
      </div>
      <p className="text-lg font-bold" style={{ color: W.charcoal1 }}>
        {searched ? "No Matches" : "No Students Found"}
      </p>
      <p className="mt-1.5 text-sm max-w-xs leading-relaxed" style={{ color: W.muted1 }}>
        {searched ? "Try a different name or class filter." : "Add students first, then come back here."}
      </p>
    </div>
  );
}

function EmptyHistory({ filtered = false }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="w-16 h-16 rounded-3xl flex items-center justify-center text-3xl mb-4 select-none"
        style={{ background: W.bg2, border: `1px solid rgba(139,125,101,0.10)` }}>
        {filtered ? "🔍" : "📋"}
      </div>
      <p className="text-lg font-bold" style={{ color: W.charcoal1 }}>
        {filtered ? "No Matches" : "No Naps Recorded"}
      </p>
      <p className="mt-1.5 text-sm max-w-xs leading-relaxed" style={{ color: W.muted1 }}>
        {filtered
          ? "Try clearing the student search or selecting a different class."
          : "No naps have been logged for this date yet."}
      </p>
    </div>
  );
}
