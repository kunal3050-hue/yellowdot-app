import { useState, useEffect, useCallback, useRef, useReducer } from "react";
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
  charcoal1: "#4A3A22",
  charcoal2: "#6A5737",
  charcoal3: "#7A6340",
  gold1:     "#F6D54A",
  gold2:     "#F1C933",
  gold3:     "#D4A820",
  goldPale:  "#FFF7D6",
  goldMid:   "#F7E7A8",
  goldBorder:"#EFD978",
  bg1:       "#FFFDF7",
  bg2:       "#FFFBF0",
  bg3:       "#FFF8E8",
  muted1:    "#8B7355",
  muted2:    "#6A5737",
};

// ─────────────────────────────────────────────────────────────────
// PREMIUM CSS
// ─────────────────────────────────────────────────────────────────
const NAP_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400&display=swap');

  .nt-page, .nt-page * { font-family: 'Inter Tight', system-ui, -apple-system, sans-serif; }
  .nt-page h1 { font-size: clamp(1.8rem, 3.5vw, 2.4rem); font-weight: 700; letter-spacing: -0.04em; }
  .nt-page h2 { font-weight: 600; letter-spacing: -0.03em; }
  .nt-page p, .nt-page span, .nt-page td { letter-spacing: -0.01em; }

  /* ── Sleeping card gold breathe ── */
  @keyframes nt-breathe {
    0%,100% { box-shadow: 0 4px 16px rgba(240,200,70,.14), 0 0 0 0 rgba(240,200,70,.00), 0 0 0 1px rgba(239,217,120,.65); }
    50%      { box-shadow: 0 8px 28px rgba(240,200,70,.24), 0 0 0 6px rgba(240,200,70,.08), 0 0 0 1px rgba(239,217,120,.90); }
  }
  /* ── Card spring entry ── */
  @keyframes nt-spring-in {
    0%   { transform: scale(.88) translateY(10px); opacity:0; }
    55%  { transform: scale(1.04) translateY(-3px); opacity:1; }
    80%  { transform: scale(.98) translateY(1px); }
    100% { transform: scale(1) translateY(0); opacity:1; }
  }
  /* ── Card exit — tap to start nap ── */
  @keyframes nt-card-exit {
    0%   { opacity: 1; transform: scale(1) translateY(0); }
    35%  { transform: scale(1.04) translateY(-4px); }
    100% { opacity: 0; transform: scale(0.78) translateY(-18px); }
  }
  .nt-card-exit { animation: nt-card-exit 300ms cubic-bezier(.55,0,.45,1) forwards; pointer-events: none; }

  /* ── Bottom sheet slide up ── */
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
  /* ── Moon float (empty state) ── */
  @keyframes nt-moon-float {
    0%,100% { transform: translateY(0) rotate(-4deg); }
    50%     { transform: translateY(-8px) rotate(4deg); }
  }
  /* ── Nap card slide in ── */
  @keyframes nt-nap-slide-in {
    from { opacity: 0; transform: translateY(10px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  /* ── Tab glow pulse ── */
  @keyframes nt-tab-glow {
    0%,100% { box-shadow: 0 2px 12px rgba(241,201,51,0.30), 0 1px 0 rgba(255,255,255,0.55) inset; }
    50%     { box-shadow: 0 3px 22px rgba(241,201,51,0.52), 0 1px 0 rgba(255,255,255,0.55) inset; }
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
  /* ── Awake card ── */
  .nt-idle-card {
    background: linear-gradient(150deg, #fffdf6 0%, #fdf9ee 100%);
    box-shadow: 0 1px 0 rgba(255,255,255,0.8) inset, 0 1px 3px rgba(31,26,23,0.05), 0 4px 12px rgba(31,26,23,0.05);
    border: 1px solid rgba(139,125,101,0.08);
    transition: box-shadow 150ms ease, border-color 150ms ease, transform 150ms ease;
  }
  .nt-idle-card:hover {
    box-shadow: 0 1px 0 rgba(255,255,255,0.9) inset, 0 2px 6px rgba(31,26,23,0.07), 0 10px 28px rgba(31,26,23,0.09);
    border-color: rgba(139,125,101,0.14);
    transform: translateY(-2px);
  }
  /* ── Sleeping card — light warm gold ── */
  .nt-sleep-card {
    background: linear-gradient(180deg, #FFF7D6 0%, #F7E7A8 100%);
    box-shadow: 0 1px 0 rgba(255,255,255,0.80) inset, 0 4px 20px rgba(240,200,70,0.18), 0 12px 36px rgba(240,200,70,0.10);
    border: 1px solid #EFD978;
  }
  /* ── Gold glass panel ── */
  .nt-gold-panel {
    background: linear-gradient(145deg, #fff9e0 0%, #fff4c2 40%, #fded9a 100%);
    box-shadow: 0 1px 0 rgba(255,255,255,0.60) inset, 0 8px 32px rgba(224,177,0,0.18), 0 32px 64px rgba(224,177,0,0.09);
    border: 1px solid rgba(224,177,0,0.18);
  }
  /* ── Ivory minimal card ── */
  .nt-ivory-card {
    background: linear-gradient(145deg, #fffdf6 0%, #f8f4ea 100%);
    box-shadow: 0 1px 0 rgba(255,255,255,0.92) inset, 0 2px 4px rgba(31,26,23,0.04), 0 10px 28px rgba(31,26,23,0.07);
    border: 1px solid rgba(139,125,101,0.10);
  }
  /* ── Premium input ── */
  .nt-input {
    background: linear-gradient(180deg, #fffdf8 0%, #fdfaf0 100%);
    box-shadow: 0 1px 0 rgba(255,255,255,0.92) inset, 0 1px 0 rgba(139,125,101,0.06), 0 2px 6px rgba(43,33,24,0.05);
    border: 1px solid rgba(139,125,101,0.12);
    transition: box-shadow 180ms ease, border-color 180ms ease;
    border-radius: 999px;
    outline: none;
  }
  .nt-input:focus {
    box-shadow: 0 1px 0 rgba(255,255,255,0.90) inset, 0 0 0 2.5px rgba(244,196,48,0.30), 0 2px 6px rgba(43,33,24,0.05);
    border-color: rgba(244,196,48,0.50);
  }
  /* ── Pill filter active ── */
  .nt-pill-active {
    background: linear-gradient(135deg, #F6D54A 0%, #F1C933 100%);
    box-shadow: 0 2px 8px rgba(241,201,51,0.32), 0 1px 0 rgba(255,255,255,0.50) inset;
    color: #4A3A22;
  }
  /* ── Summary bar — soft ivory pill ── */
  .nt-summary-bar {
    background: linear-gradient(135deg, rgba(255,253,246,0.96) 0%, rgba(255,249,224,0.96) 100%);
    border: 1px solid rgba(244,196,48,0.22);
    box-shadow: 0 1px 0 rgba(255,255,255,0.85) inset, 0 2px 10px rgba(224,177,0,0.08);
    backdrop-filter: blur(8px);
  }
  /* ── Workflow tab container ── */
  .nt-tab-strip {
    background: rgba(255,253,246,0.80);
    border: 1px solid rgba(139,125,101,0.09);
    box-shadow: 0 1px 0 rgba(255,255,255,0.90) inset, 0 2px 8px rgba(31,26,23,0.04);
    backdrop-filter: blur(8px);
  }
  /* ── Active workflow tab ── */
  .nt-tab-active {
    background: linear-gradient(135deg, #F6D54A 0%, #F1C933 100%);
    animation: nt-tab-glow 2.8s ease-in-out infinite;
  }
  /* ── Start Nap button ── */
  .nt-start-btn { transition: transform 150ms ease, box-shadow 150ms ease; }
  .nt-start-btn:hover:not(:disabled) {
    transform: translateY(-1.5px);
    box-shadow: 0 5px 18px rgba(212,170,31,0.42), inset 0 1px 0 rgba(255,255,255,0.55) !important;
  }
  .nt-start-btn:active:not(:disabled) { transform: scale(0.97); }
  /* ── Wake Up button ── */
  .nt-wake-btn { transition: transform 150ms ease, box-shadow 150ms ease; }
  .nt-wake-btn:hover:not(:disabled) { transform: translateY(-1px); }
  .nt-wake-btn:active:not(:disabled) { transform: scale(0.97); }
  /* ── Timeline row hover ── */
  .nt-timeline-row { border-radius: 14px; transition: background 140ms ease; }
  .nt-timeline-row:hover { background: rgba(244,196,48,0.07); }
`;

const REFUSED_REASONS = [
  { id: "restless", label: "Restless",    emoji: "🦋" },
  { id: "crying",   label: "Crying",      emoji: "😢" },
  { id: "active",   label: "Too active",  emoji: "⚡" },
  { id: "skipped",  label: "Skipped",     emoji: "⏭️" },
];

const AVATAR_GRADIENTS = [
  "from-stone-600 to-stone-800",
  "from-amber-600 to-amber-900",
  "from-yellow-700 to-amber-800",
  "from-stone-500 to-amber-700",
  "from-amber-700 to-stone-700",
  "from-yellow-600 to-stone-700",
  "from-stone-700 to-amber-600",
  "from-amber-500 to-stone-600",
];

const CLASS_COLORS = {
  "Playgroup":   { pill: "bg-amber-50 text-amber-800 border border-amber-200" },
  "Nursery":     { pill: "bg-stone-100 text-stone-700 border border-stone-200" },
  "Junior K.G.": { pill: "bg-yellow-50 text-yellow-800 border border-yellow-200" },
  "Senior K.G.": { pill: "bg-amber-100 text-amber-900 border border-amber-300" },
  "Daycare":     { pill: "bg-stone-50 text-stone-600 border border-stone-200" },
};
const classPill = cls => CLASS_COLORS[cls]?.pill ?? "bg-stone-100 text-stone-600 border border-stone-200";

// ─────────────────────────────────────────────────────────────────
// PURE UTILITIES
// ─────────────────────────────────────────────────────────────────

function todayISO()  { return new Date().toISOString().split("T")[0]; }
function pad2(n)     { return String(n).padStart(2, "0"); }

function liveDuration(startIso) {
  if (!startIso) return { h:0, m:0, s:0, totalMinutes:0, display:"00:00:00", displayHM:"Just started", justStarted:true };
  let ms = new Date(startIso).getTime();
  if (isNaN(ms)) ms = new Date(`${new Date().toISOString().slice(0,10)}T${startIso}`).getTime();
  if (isNaN(ms)) return { h:0, m:0, s:0, totalMinutes:0, display:"00:00:00", displayHM:"Just started", justStarted:true };
  const diff = Math.max(0, Date.now() - ms);
  const sec  = Math.floor(diff / 1000);
  const h    = Math.floor(sec / 3600);
  const m    = Math.floor((sec % 3600) / 60);
  const s    = sec % 60;
  const displayHM = diff < 30000 ? "Just started" : `${pad2(h)}h ${pad2(m)}m`;
  return { h, m, s, totalMinutes: Math.floor(diff / 60000), display: `${pad2(h)}:${pad2(m)}:${pad2(s)}`, displayHM };
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
  const d = new Date(iso);
  if (!isNaN(d.getTime())) return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  if (/^\d{2}:\d{2}/.test(iso)) return iso.slice(0,5);
  return "—";
}

function renderTimerHM(displayHM, numColor = "#4A3A22", unitColor = "#8B7355") {
  if (!displayHM || displayHM === "Just started") {
    return <span style={{ fontSize:13, fontWeight:500, color:unitColor, letterSpacing:0 }}>Just started</span>;
  }
  return displayHM.replace(/(\d+)/g,"§$1§").split("§").filter(Boolean).map((t,i) =>
    /^\d+$/.test(t)
      ? <span key={i} style={{ fontSize:32, fontWeight:800, letterSpacing:"-0.04em", lineHeight:1, color:numColor }}>{t}</span>
      : <span key={i} style={{ fontSize:15, fontWeight:500, lineHeight:1, color:unitColor, paddingRight: t.trim()==="h"?4:0 }}>{t}</span>
  );
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" });
}

function initials(name = "") {
  return name.trim().split(/\s+/).map(w => w[0]).slice(0,2).join("").toUpperCase() || "?";
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

  // ── Filters
  const [cls,           setCls]           = useState("All");
  const [studentSearch, setStudentSearch] = useState("");
  const [histDate,      setHistDate]      = useState(todayISO);
  const [histStudent,   setHistStudent]   = useState("");

  // ── Workflow tabs
  const [workflow,   setWorkflow]   = useState("start"); // "start" | "wake"
  const [exitingId,  setExitingId]  = useState(null);

  // ── Data
  const [students,   setStudents]   = useState([]);
  const [activeNaps, setActiveNaps] = useState([]);
  const [history,    setHistory]    = useState([]);
  const [stats,      setStats]      = useState({ currentlySleeping:0, totalNapsToday:0, avgDurationMinutes:0 });

  // ── UI state
  const [loading,      setLoading]      = useState(true);
  const [bootError,    setBootError]    = useState(false);
  const [histLoading,  setHistLoading]  = useState(false);
  const [actionId,     setActionId]     = useState(null);
  const [wakeModal,    setWakeModal]    = useState(null);
  const [wakeLoading,  setWakeLoading]  = useState(false);
  const [lastNap,      setLastNap]      = useState(null);

  const mountedRef    = useRef(true);
  const refreshingRef = useRef(false);
  const [, tick] = useReducer(x => x + 1, 0);
  useEffect(() => { const id = setInterval(tick, 1000); return () => clearInterval(id); }, []); // eslint-disable-line

  const toast = useToast();

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  useEffect(() => { boot(); }, []); // eslint-disable-line
  useEffect(() => { if (!loading) fetchHistory(histDate); }, [histDate]); // eslint-disable-line

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
      setStats(statsRes ?? { currentlySleeping:0, totalNapsToday:0, avgDurationMinutes:0 });
    } catch {
      if (!mountedRef.current) return;
      setBootError(true); toast.error("Could not connect to the server.");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

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

  // ── Derived lists
  const visibleStudents = students
    .filter(s => (s.Status || s.status || "Active") === "Active")
    .filter(s => cls === "All" || scls(s) === cls)
    .filter(s => !studentSearch || sname(s).toLowerCase().includes(studentSearch.toLowerCase()));

  const isSleeping   = s => activeNaps.some(n => n.student_id === sid(s) || n.studentId === sid(s));
  const awakeStudents = visibleStudents.filter(s => !isSleeping(s));

  const sleepingFiltered = activeNaps
    .filter(n => cls === "All" || n.class === cls)
    .filter(n => !studentSearch || (n.student_name || n.studentName || "").toLowerCase().includes(studentSearch.toLowerCase()));

  const visibleHistory = history
    .filter(n => cls === "All" || n.class === cls)
    .filter(n => !histStudent || (n.student_name || n.studentName || "").toLowerCase().includes(histStudent.toLowerCase()));

  // ── Actions
  async function handleStart(student) {
    if (actionId) return;
    const id = sid(student);
    setActionId(id);
    setExitingId(id); // fire exit animation immediately

    // Auto-switch to wake tab after animation plays (~300ms)
    const switchTimer = setTimeout(() => {
      if (mountedRef.current) setWorkflow("wake");
    }, 260);

    try {
      await napService.startNap({ student_id: id, student_name: sname(student), class: scls(student) });
      toast.success(`${sname(student)}'s nap started 😴`);
      setLastNap({ student_id: id, student_name: sname(student) });
      await refresh();
    } catch (e) {
      clearTimeout(switchTimer);
      if (mountedRef.current) setWorkflow("start");
      toast.error(e.message || "Could not start nap.");
    } finally {
      if (mountedRef.current) { setActionId(null); setExitingId(null); }
    }
  }

  async function handleWakeUp() {
    if (!wakeModal || wakeLoading) return;
    setWakeLoading(true);
    try {
      await napService.wakeUp({ nap_id: wakeModal.nap.nap_id || wakeModal.nap.napId, mood: wakeModal.mood, notes: wakeModal.notes });
      toast.success(`${wakeModal.nap.student_name || wakeModal.nap.studentName} is awake ☀️`);
      if (mountedRef.current) { setWakeModal(null); setWorkflow("start"); }
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

  // ── Render
  return (
    <div className="nt-page flex min-h-screen" style={{ background: `linear-gradient(150deg, ${W.bg1} 0%, ${W.bg2} 50%, ${W.bg3} 100%)` }}>
      <style>{NAP_CSS}</style>
      <Sidebar />

      <div className="flex-1 min-w-0 overflow-auto">

        {/* ── STICKY HEADER ────────────────────────────────── */}
        <div className="sticky top-0 z-20 backdrop-blur-2xl"
          style={{ background:"rgba(255,253,246,0.92)", borderBottom:"1px solid rgba(139,125,101,0.10)", boxShadow:"0 1px 0 rgba(255,255,255,0.7) inset, 0 4px 24px rgba(31,26,23,0.06)" }}>
          <div className="px-6 md:px-10 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h1 className="leading-none flex-shrink-0" style={{ color:W.charcoal1, fontWeight:700, letterSpacing:"-0.04em" }}>
                Nap Tracker
              </h1>
              {/* Class filter chips */}
              <div className="flex gap-1 overflow-x-auto scrollbar-none pb-0.5 flex-shrink-0">
                {CLASSES.map(c => (
                  <button key={c} onClick={() => setCls(c)}
                    className={`px-2.5 py-1 rounded-full text-[11.5px] whitespace-nowrap flex-shrink-0 transition-all duration-200 ${cls === c ? "nt-pill-active scale-[1.02]" : ""}`}
                    style={cls !== c ? { background:"rgba(139,125,101,0.06)", color:W.muted1, fontWeight:500, border:"1px solid rgba(139,125,101,0.08)" } : { fontWeight:600 }}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 md:px-10 py-6 space-y-5">

          {/* ── STAT CARDS ───────────────────────────────────── */}
          {loading ? <SkeletonStatCards /> : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

              {/* Sleeping — warm gold */}
              <div className="rounded-[22px] p-4 relative overflow-hidden cursor-default"
                style={{ background:"linear-gradient(180deg, #FFF7D6 0%, #F7E7A8 100%)", border:`1px solid ${W.goldBorder}`, boxShadow:"0 1px 0 rgba(255,255,255,0.80) inset, 0 4px 20px rgba(240,200,70,0.15)", transition:"transform 180ms ease, box-shadow 180ms ease" }}
                onMouseEnter={e => { e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow="0 1px 0 rgba(255,255,255,0.80) inset, 0 8px 28px rgba(240,200,70,0.22)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform=""; e.currentTarget.style.boxShadow="0 1px 0 rgba(255,255,255,0.80) inset, 0 4px 20px rgba(240,200,70,0.15)"; }}>
                {stats.currentlySleeping > 0 && (
                  <span className="absolute top-4 right-4 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background:W.gold2 }} />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background:W.gold1 }} />
                  </span>
                )}
                <div className="text-2xl mb-2 select-none">😴</div>
                <div className="text-4xl font-black tracking-tight tabular-nums leading-none" style={{ color:W.charcoal1 }}>{stats.currentlySleeping}</div>
                <div className="mt-2 text-xs" style={{ color:W.charcoal2, fontWeight:500 }}>Currently Sleeping</div>
                <div className="text-[11px] mt-0.5" style={{ color:W.muted1, fontWeight:400 }}>
                  {stats.currentlySleeping === 1 ? "1 student napping" : `${stats.currentlySleeping} students napping`}
                </div>
              </div>

              {/* Total naps */}
              <div className="nt-gold-panel rounded-[22px] p-4 relative overflow-hidden cursor-default"
                style={{ transition:"transform 180ms ease" }}
                onMouseEnter={e => { e.currentTarget.style.transform="translateY(-2px)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform=""; }}>
                <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", width:"120%", height:"120%", background:"radial-gradient(ellipse at 60% 40%, rgba(255,255,255,0.30) 0%, transparent 70%)", pointerEvents:"none" }} />
                <div className="text-2xl mb-2 select-none relative z-10">✦</div>
                <div className="text-4xl font-black tracking-tight tabular-nums leading-none relative z-10" style={{ color:W.charcoal1 }}>{stats.totalNapsToday}</div>
                <div className="mt-2 text-xs relative z-10" style={{ color:W.charcoal2, fontWeight:500 }}>Total Naps Today</div>
                <div className="text-[11px] mt-0.5 relative z-10" style={{ color:W.muted2, fontWeight:400 }}>{fmtDate(histDate)}</div>
              </div>

              {/* Avg duration */}
              <div className="nt-ivory-card rounded-[22px] p-4 relative overflow-hidden cursor-default"
                style={{ transition:"transform 180ms ease" }}
                onMouseEnter={e => { e.currentTarget.style.transform="translateY(-2px)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform=""; }}>
                <div style={{ position:"absolute", bottom:-20, right:-20, width:100, height:100, background:`radial-gradient(circle, rgba(241,201,51,0.08) 0%, transparent 70%)`, pointerEvents:"none" }} />
                <div className="text-2xl mb-2 select-none relative z-10">🌙</div>
                <div className="text-4xl font-black tracking-tight leading-none relative z-10" style={{ color:W.charcoal1 }}>{fmtDuration(stats.avgDurationMinutes)}</div>
                <div className="mt-2 text-xs relative z-10" style={{ color:W.charcoal2, fontWeight:500 }}>Avg Duration</div>
                <div className="text-[11px] mt-0.5 relative z-10" style={{ color:W.muted1, fontWeight:400 }}>completed naps only</div>
              </div>

            </div>
          )}

          {/* ── SUMMARY BAR ──────────────────────────────────── */}
          {!loading && <SummaryBar activeNaps={activeNaps} stats={stats} />}

          {/* ── WORKFLOW PANEL ───────────────────────────────── */}
          <div className="nt-card rounded-[28px] p-5 md:p-6">

            {/* Search + count */}
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1 max-w-[220px]">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none select-none" style={{ color:W.muted1 }}>🔍</span>
                <input type="text" value={studentSearch} onChange={e => setStudentSearch(e.target.value)}
                  placeholder="Search students…" className="nt-input w-full pl-8 pr-3.5 py-2 text-[13px]"
                  style={{ color:W.charcoal1, fontWeight:500 }} />
              </div>
              {!loading && (
                <span className="text-[11.5px] font-bold px-3 py-1.5 rounded-xl tabular-nums flex-shrink-0"
                  style={{ background:`rgba(139,125,101,0.07)`, color:W.muted2, border:`1px solid rgba(139,125,101,0.09)` }}>
                  {workflow === "start" ? `${awakeStudents.length} awake` : `${sleepingFiltered.length} sleeping`}
                </span>
              )}
            </div>

            {/* Workflow switcher */}
            <WorkflowSwitcher
              active={workflow}
              onChange={setWorkflow}
              wakeCount={activeNaps.length}
            />

            {/* Dynamic content */}
            <div className="mt-5">
              {loading ? <SkeletonWorkflow compact={workflow === "start"} /> : bootError ? (
                <EmptyStudents error onRetry={boot} />
              ) : workflow === "start" ? (
                /* ── START NAP — awake students, compact dense grid ── */
                awakeStudents.length === 0 ? (
                  <EmptyAwake sleepingCount={activeNaps.length} onSwitch={() => setWorkflow("wake")} />
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
                    {awakeStudents.map((s, i) => {
                      const id = sid(s);
                      return (
                        <StartNapCard
                          key={id}
                          name={sname(s)}
                          klass={scls(s)}
                          starting={actionId === id}
                          exiting={exitingId === id}
                          disabled={!!actionId && actionId !== id}
                          animDelay={i * 28}
                          onStart={perm.mark ? () => handleStart(s) : undefined}
                        />
                      );
                    })}
                  </div>
                )
              ) : (
                /* ── WAKE UP — sleeping students, prominent cards ── */
                sleepingFiltered.length === 0 ? (
                  <EmptyActiveNaps onSwitch={() => setWorkflow("start")} />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {sleepingFiltered.map((nap, i) => {
                      const dur = liveDuration(nap.start_time || nap.startTime);
                      return (
                        <WakeUpCard
                          key={nap.nap_id || nap.napId || i}
                          nap={nap}
                          duration={dur}
                          disabled={!!actionId}
                          animDelay={i * 40}
                          onWakeUp={perm.mark ? () => openWakeModal(nap) : undefined}
                        />
                      );
                    })}
                  </div>
                )
              )}
            </div>
          </div>

          {/* ── TODAY'S ACTIVITY ─────────────────────────────── */}
          <ActivityTimeline
            history={visibleHistory}
            loading={histLoading}
            histDate={histDate}
            histStudent={histStudent}
            onDateChange={setHistDate}
            onStudentChange={setHistStudent}
          />

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
      <ToastStack toasts={toast.toasts} onDismiss={toast.dismiss} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SUMMARY BAR — "🟢 3 sleeping now · Avg 42m · Next ~2:15 pm"
// ─────────────────────────────────────────────────────────────────

function SummaryBar({ activeNaps, stats }) {
  if (!activeNaps.length && !stats.avgDurationMinutes) return null;

  const nextWake = (() => {
    if (!activeNaps.length) return null;
    const times = activeNaps
      .map(n => new Date(n.start_time || n.startTime).getTime())
      .filter(t => !isNaN(t));
    if (!times.length) return null;
    const oldest  = Math.min(...times);
    const napLen  = (stats.avgDurationMinutes > 0) ? stats.avgDurationMinutes : 60;
    const wakeMs  = oldest + napLen * 60000;
    if (wakeMs <= Date.now()) return null;
    return fmtTime(new Date(wakeMs).toISOString());
  })();

  return (
    <div className="nt-summary-bar flex items-center gap-1.5 px-4 py-2.5 rounded-[14px] flex-wrap">
      {/* Sleeping count */}
      {activeNaps.length > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="flex h-2 w-2 relative flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-55" style={{ background:W.gold2 }} />
            <span className="relative inline-flex rounded-full h-2 w-2" style={{ background:"#5FA840" }} />
          </span>
          <span className="text-[12.5px] font-semibold" style={{ color:W.charcoal1 }}>
            {activeNaps.length} sleeping now
          </span>
        </div>
      )}
      {/* Avg */}
      {stats.avgDurationMinutes > 0 && (
        <>
          <span style={{ color:W.goldBorder, fontSize:12, opacity:0.7, padding:"0 2px" }}>·</span>
          <span className="text-[12.5px]" style={{ color:W.charcoal2, fontWeight:500 }}>
            Avg {fmtDuration(stats.avgDurationMinutes)}
          </span>
        </>
      )}
      {/* Next wake estimate */}
      {nextWake && (
        <>
          <span style={{ color:W.goldBorder, fontSize:12, opacity:0.7, padding:"0 2px" }}>·</span>
          <span className="text-[12.5px]" style={{ color:W.charcoal2, fontWeight:500 }}>
            Next wake ~{nextWake}
          </span>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// WORKFLOW SWITCHER — Instagram story selector feel
// ─────────────────────────────────────────────────────────────────

function WorkflowSwitcher({ active, onChange, wakeCount }) {
  const tabs = [
    { id:"start", emoji:"😴", label:"Start Nap" },
    { id:"wake",  emoji:"☀️", label:"Wake Up",  count: wakeCount },
  ];
  return (
    <div className="nt-tab-strip flex p-1 rounded-[18px] gap-1">
      {tabs.map(tab => {
        const isActive = active === tab.id;
        return (
          <button key={tab.id} onClick={() => onChange(tab.id)}
            className={`flex-1 relative flex items-center justify-center gap-2 py-2.5 rounded-[14px] transition-all duration-200 ${isActive ? "nt-tab-active" : ""}`}
            style={isActive ? {
              color: "#7A5A00",
              transform: "translateY(-0.5px)",
            } : {
              color: W.muted1,
              background: "transparent",
            }}>
            <span className="text-[16px] leading-none select-none">{tab.emoji}</span>
            <span className="font-bold text-[13.5px]" style={{ letterSpacing:"-0.02em" }}>{tab.label}</span>
            {tab.count > 0 && (
              <span className="absolute -top-1.5 -right-1 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] font-black px-1.5"
                style={{
                  background: isActive ? "rgba(74,58,34,0.20)" : "linear-gradient(135deg, #F6D54A, #F1C933)",
                  color: "#7A5A00",
                  boxShadow: isActive ? "none" : "0 1px 4px rgba(212,168,32,0.35)",
                }}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// START NAP CARD — compact, single-tap, no timer
// ─────────────────────────────────────────────────────────────────

function StartNapCard({ name, klass, starting, exiting, disabled, animDelay, onStart }) {
  return (
    <div
      className={exiting ? "nt-card-exit" : "nt-idle-card"}
      style={{
        borderRadius: 16,
        padding: "12px 10px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled && !exiting ? 0.42 : 1,
        animation: exiting ? undefined : `nt-spring-in 380ms cubic-bezier(.16,1,.3,1) ${animDelay}ms both`,
        ...(disabled && !exiting ? { background: W.bg3 } : {}),
      }}>
      {/* Avatar */}
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${avatarGrad(name)} flex items-center justify-center text-white font-bold text-[12px] mb-2.5 flex-shrink-0`}
        style={{ boxShadow:"0 1px 6px rgba(74,58,34,0.10)" }}>
        {initials(name)}
      </div>

      {/* Name */}
      <p className="text-[11.5px] leading-tight font-semibold w-full mb-3 line-clamp-2" style={{ color:W.charcoal1, letterSpacing:"-0.02em" }}>
        {name}
      </p>

      {/* CTA */}
      {starting ? (
        <div className="flex items-center justify-center gap-1.5 w-full py-1.5">
          <span className="w-2 h-2 border-2 border-t-transparent rounded-full animate-spin flex-shrink-0"
            style={{ borderColor:`${W.muted1} transparent transparent transparent` }} />
          <span className="text-[10px] font-medium" style={{ color:W.muted1 }}>Starting…</span>
        </div>
      ) : (
        <button
          onClick={onStart}
          disabled={disabled || !onStart}
          className="nt-start-btn w-full font-semibold text-[11px] py-1.5 rounded-[9px]"
          style={disabled || !onStart ? {
            background: `rgba(139,125,101,0.06)`,
            color: W.muted1,
            border: `1px solid rgba(139,125,101,0.08)`,
            cursor: "default",
          } : {
            background: `linear-gradient(180deg,#F6D54A 0%,#F1C933 100%)`,
            color: "#7A5A00",
            border: `1px solid rgba(212,178,40,0.25)`,
            boxShadow: "0 2px 8px rgba(241,201,51,0.28), inset 0 1px 0 rgba(255,255,255,0.60)",
            cursor: "pointer",
            letterSpacing: "-0.01em",
          }}>
          😴 Start Nap
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// WAKE UP CARD — prominent sleeping student card with live timer
// ─────────────────────────────────────────────────────────────────

function WakeUpCard({ nap, duration, disabled, animDelay, onWakeUp }) {
  const name     = nap.student_name || nap.studentName || "";
  const startIso = nap.start_time   || nap.startTime   || "";
  const isLong   = duration.totalMinutes >= 120;

  return (
    <div
      className="nt-sleep-card nt-sleeping-card relative overflow-hidden"
      style={{
        borderRadius: 20,
        padding: "14px 14px 12px",
        animation: `nt-spring-in 400ms cubic-bezier(.16,1,.3,1) ${animDelay}ms both, nt-breathe 3.6s ease-in-out ${animDelay}ms infinite`,
      }}>

      {/* Pulse dot — top right */}
      <span className="absolute top-3 right-3 flex h-2 w-2 z-10">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-55" style={{ background:W.gold3 }} />
        <span className="relative inline-flex rounded-full h-2 w-2" style={{ background:W.gold2 }} />
      </span>

      {/* Header row — avatar + name */}
      <div className="flex items-start gap-2.5 mb-3">
        <div className={`w-10 h-10 rounded-xl flex-shrink-0 bg-gradient-to-br ${avatarGrad(name)} flex items-center justify-center text-white font-bold text-[12px]`}
          style={{ boxShadow:"0 2px 10px rgba(212,168,32,0.22)" }}>
          {initials(name)}
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-[13.5px] font-semibold leading-tight truncate" style={{ color:W.charcoal1 }}>{name}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full inline-block flex-shrink-0"
              style={{ background:W.gold3, animation:"nt-dot 2.2s ease-in-out infinite" }} />
            <span className="text-[9px] font-semibold uppercase tracking-[0.10em]" style={{ color:W.muted1 }}>
              Sleeping now
            </span>
          </div>
        </div>
      </div>

      {/* Live timer — big digits */}
      <div className="mb-1">
        <div className="flex items-baseline leading-none mb-1">
          {renderTimerHM(duration.displayHM, W.charcoal1, W.muted1)}
        </div>
        <p className="text-[10px] tabular-nums" style={{ color:W.muted1, fontWeight:400 }}>
          since {fmtTime(startIso)}
        </p>
      </div>

      {/* Long nap warning */}
      {isLong && (
        <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1 mb-2.5 inline-flex w-auto"
          style={{ background:"rgba(255,240,180,0.85)", border:"1px solid rgba(212,168,32,0.30)" }}>
          <span className="text-[10px]">⚠</span>
          <span className="text-[10px] font-bold" style={{ color:"#8B6914" }}>Long nap · {duration.totalMinutes}m</span>
        </div>
      )}

      {/* Wake Up CTA */}
      <button
        onClick={onWakeUp}
        disabled={disabled || !onWakeUp}
        className="nt-wake-btn w-full font-semibold text-[12.5px] py-2 rounded-[11px] mt-2"
        style={{
          background: "linear-gradient(180deg,#FFE7DF 0%,#F8D2C5 100%)",
          color: "#B25B45",
          border: "1px solid rgba(178,91,69,0.18)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.85)",
          cursor: disabled ? "default" : "pointer",
          letterSpacing: "-0.01em",
          opacity: disabled ? 0.55 : 1,
        }}>
        ☀️ Wake Up
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// ACTIVITY TIMELINE — Today's Activity feed at bottom
// ─────────────────────────────────────────────────────────────────

function ActivityTimeline({ history, loading, histDate, histStudent, onDateChange, onStudentChange }) {
  return (
    <div className="nt-card rounded-[28px] p-5 md:p-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1 h-4 rounded-full flex-shrink-0"
              style={{ background:`linear-gradient(180deg, #F6D54A, #D4A820)` }} />
            <h2 className="text-[18px]" style={{ color:W.charcoal1, fontWeight:600, letterSpacing:"-0.03em" }}>
              Today's Activity
            </h2>
          </div>
          <p className="text-[11px] pl-3" style={{ color:W.muted1 }}>
            {loading ? "Loading…" : `${history.length} entr${history.length === 1 ? "y" : "ies"}`}
            {" · "}{fmtDate(histDate)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none select-none" style={{ color:W.muted1 }}>📅</span>
            <input type="date" value={histDate} max={todayISO()} onChange={e => onDateChange(e.target.value)}
              className="nt-input pl-9 pr-3.5 py-2 text-sm cursor-pointer" style={{ color:W.charcoal1, fontWeight:500 }} />
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none select-none" style={{ color:W.muted1 }}>🔍</span>
            <input type="text" value={histStudent} onChange={e => onStudentChange(e.target.value)}
              placeholder="Filter…" className="nt-input w-32 pl-9 pr-3.5 py-2 text-sm" style={{ color:W.charcoal1, fontWeight:500 }} />
          </div>
          {histDate !== todayISO() && (
            <button onClick={() => onDateChange(todayISO())}
              className="text-xs font-bold px-3.5 py-2 rounded-full transition-all active:scale-95"
              style={{ background:`rgba(244,196,48,0.12)`, color:W.charcoal2, border:`1px solid rgba(244,196,48,0.30)` }}>
              Today
            </button>
          )}
        </div>
      </div>

      {loading ? <SkeletonTimeline /> : history.length === 0 ? (
        <EmptyHistory filtered={!!histStudent} />
      ) : (
        <div>
          {history.map((nap, i) => {
            const dur    = nap.status === "sleeping" ? liveDuration(nap.start_time || nap.startTime) : null;
            const mood   = MOODS.find(m => m.value === nap.mood);
            const isDone = nap.status === "done" || nap.status === "complete";
            const name   = nap.student_name || nap.studentName || "";
            return (
              <div key={nap.nap_id || nap.napId || i}>
                {i > 0 && <div style={{ height:1, background:`rgba(139,125,101,0.07)`, margin:"0 4px" }} />}
                <div className="nt-timeline-row flex items-center gap-3 py-2.5 px-2.5">

                  {/* Time stamp */}
                  <div className="flex-shrink-0 w-12 text-right">
                    <span className="text-[11px] font-mono tabular-nums font-semibold" style={{ color:W.muted1 }}>
                      {fmtTime(nap.start_time || nap.startTime)}
                    </span>
                  </div>

                  {/* Avatar */}
                  <div className={`w-8 h-8 flex-shrink-0 rounded-xl bg-gradient-to-br ${avatarGrad(name)} flex items-center justify-center text-white font-black text-[10px]`}
                    style={{ boxShadow:"0 1px 6px rgba(31,26,23,0.12)" }}>
                    {initials(name)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-1.5 mb-0.5">
                      <span className="text-[13px] truncate max-w-[140px]" style={{ color:W.charcoal1, fontWeight:600 }}>{name}</span>
                      {mood && <span className="text-sm leading-none select-none flex-shrink-0" title={mood.value}>{mood.emoji}</span>}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] flex-wrap" style={{ color:W.muted1 }}>
                      <span>{isDone ? "Woke up" : "Started napping"}</span>
                      {(nap.end_time || nap.endTime) && (
                        <><span style={{ opacity:0.35 }}>→</span>
                        <span className="font-mono tabular-nums">{fmtTime(nap.end_time || nap.endTime)}</span></>
                      )}
                      {(nap.notes) && (
                        <><span style={{ opacity:0.28 }}>·</span>
                        <span className="italic truncate max-w-[90px]">{nap.notes}</span></>
                      )}
                    </div>
                  </div>

                  {/* Duration */}
                  <div className="flex-shrink-0 flex flex-col items-end gap-1">
                    <span className="font-bold text-[12px] tabular-nums" style={{ color:W.charcoal2 }}>
                      {dur ? dur.displayHM : fmtDuration(nap.duration_minutes ?? nap.duration)}
                    </span>
                    <span className={`inline-flex items-center gap-0.5 font-bold rounded-full whitespace-nowrap px-2 py-0.5 text-[9px]`}
                      style={isDone
                        ? { background:"rgba(176,152,48,0.10)", color:"#5a4d18", border:"1px solid rgba(180,150,40,0.22)" }
                        : { background:`rgba(31,26,23,0.07)`, color:W.charcoal2, border:`1px solid rgba(31,26,23,0.09)` }}>
                      {isDone ? "☀️ Done" : "😴 Live"}
                    </span>
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
// WAKE-UP SHEET — premium warm bottom modal
// ─────────────────────────────────────────────────────────────────

function WakeUpSheet({ nap, mood, notes, loading, onMood, onNotes, onConfirm, onClose }) {
  const napName  = nap.student_name || nap.studentName || "";
  const napClass = nap.class        || "";
  const dur      = liveDuration(nap.start_time || nap.startTime);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        className={`absolute inset-0 backdrop-blur-sm transition-opacity ${loading ? "pointer-events-none" : "cursor-pointer"}`}
        style={{ background:"rgba(31,26,23,0.50)" }}
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg rounded-t-[32px] shadow-2xl overflow-hidden max-h-[88dvh] flex flex-col nt-sheet-in"
        style={{ background:W.bg1, boxShadow:`0 -8px 48px rgba(31,26,23,0.18), 0 -1px 0 rgba(255,255,255,0.6) inset` }}>

        <div className="flex justify-center pt-3.5 flex-shrink-0">
          <div className="w-9 h-[3px] rounded-full" style={{ background:`rgba(139,125,101,0.18)` }} />
        </div>

        <div className="flex items-center gap-3.5 px-5 pt-3 pb-4 flex-shrink-0">
          <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${avatarGrad(napName)} flex items-center justify-center text-white font-black text-sm flex-shrink-0`}
            style={{ boxShadow:"0 3px 12px rgba(31,26,23,0.18)" }}>
            {initials(napName)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-[15px] leading-tight truncate" style={{ color:W.charcoal1 }}>{napName}</p>
            <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md mt-0.5 ${classPill(napClass)}`}>{napClass}</span>
          </div>
          <div className="text-right flex-shrink-0 rounded-2xl px-3 py-2"
            style={{ background:W.bg2, border:`1px solid rgba(139,125,101,0.10)` }}>
            <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color:W.muted1 }}>Duration</p>
            <p className="text-lg font-black font-mono tabular-nums leading-tight" style={{ color:W.charcoal1 }}>{dur.display.slice(0,5)}</p>
            <p className="text-[10px]" style={{ color:W.muted1 }}>{dur.totalMinutes}m total</p>
          </div>
        </div>

        <div className="h-px mx-5 flex-shrink-0" style={{ background:`rgba(139,125,101,0.08)` }} />

        <div className="px-5 pt-5 pb-6 space-y-5 overflow-y-auto flex-1 scrollbar-none">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color:W.muted1 }}>
              Mood after nap <span className="ml-1.5 normal-case font-normal tracking-normal opacity-60">· optional</span>
            </p>
            <div className="flex gap-1.5">
              {MOODS.map(m => (
                <button key={m.value} onClick={() => onMood(mood === m.value ? "" : m.value)}
                  className={`flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-2xl transition-all duration-180 active:scale-[.92] ${mood === m.value ? "nt-badge-pop" : ""}`}
                  style={{
                    border:`2px solid ${mood === m.value ? W.gold1 : "rgba(139,125,101,0.12)"}`,
                    background: mood === m.value ? `rgba(244,196,48,0.10)` : `rgba(255,253,246,0.80)`,
                    boxShadow: mood === m.value ? `0 2px 8px rgba(224,177,0,0.18)` : "none",
                  }}>
                  <span className="text-2xl leading-none select-none">{m.emoji}</span>
                  <span className="text-[8px] font-bold uppercase tracking-wide" style={{ color:W.muted1 }}>{m.value}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color:W.muted1 }}>
              Notes <span className="ml-1.5 normal-case font-normal tracking-normal opacity-60">· optional</span>
            </p>
            <textarea value={notes} onChange={e => onNotes(e.target.value)} rows={2}
              placeholder="Any observations about this nap…"
              className="w-full rounded-2xl px-4 py-3 resize-none text-sm"
              style={{ background:`rgba(248,244,234,0.70)`, border:`1px solid rgba(139,125,101,0.12)`, color:W.charcoal1, outline:"none" }}
              onFocus={e => { e.target.style.boxShadow=`0 0 0 3px rgba(244,196,48,0.22)`; e.target.style.borderColor=`rgba(244,196,48,0.45)`; }}
              onBlur={e => { e.target.style.boxShadow="none"; e.target.style.borderColor=`rgba(139,125,101,0.12)`; }}
            />
          </div>

          <div className="flex gap-2.5">
            <button onClick={onClose} disabled={loading}
              className="font-bold py-3.5 rounded-2xl transition-all disabled:opacity-40 text-sm active:scale-95 flex-shrink-0"
              style={{ width:"4.5rem", background:`rgba(139,125,101,0.10)`, color:W.muted2 }}>
              Cancel
            </button>
            <button onClick={onConfirm} disabled={loading}
              className="flex-1 font-black py-3.5 rounded-2xl disabled:opacity-60 flex items-center justify-center gap-2 text-sm active:scale-[0.98] transition-all"
              style={{ background:`linear-gradient(180deg,#F6D54A 0%,#F1C933 100%)`, color:"#7A5A00", boxShadow:`0 3px 12px rgba(241,201,51,0.30), inset 0 1px 0 rgba(255,255,255,0.50)` }}>
              {loading ? (
                <><span className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor:`${W.goldPale} transparent transparent transparent` }} />Saving…</>
              ) : "☀️ Wake Up"}
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
  if (status === "sleeping") {
    return (
      <span className={`inline-flex items-center gap-1 font-bold rounded-full whitespace-nowrap ${mini ? "px-2 py-0.5 text-[9px]" : "px-3 py-1.5 text-xs"}`}
        style={{ background:`rgba(31,26,23,0.07)`, color:W.charcoal2, border:`1px solid rgba(31,26,23,0.09)` }}>
        <span className={`leading-none select-none ${mini ? "text-[10px]" : "text-sm"}`}>😴</span>
        {mini ? "Live" : "Sleeping"}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1 font-bold rounded-full whitespace-nowrap ${mini ? "px-2 py-0.5 text-[9px]" : "px-3 py-1.5 text-xs"}`}
      style={{ background:"rgba(176,152,48,0.10)", color:"#5a4d18", border:"1px solid rgba(180,150,40,0.22)" }}>
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
          className="flex items-center gap-3 px-4 py-3.5 sm:px-5 sm:py-4 rounded-2xl shadow-2xl text-sm font-semibold w-full sm:min-w-[280px] sm:max-w-sm pointer-events-auto"
          style={t.type === "success"
            ? { background:"#FFF7D6", color:W.charcoal1, border:"1px solid #EFD978", boxShadow:`0 8px 24px rgba(240,200,70,0.18)` }
            : { background:"#b91c1c", color:"#fff" }}>
          <span className="text-xl flex-shrink-0 leading-none select-none">{t.type === "success" ? "✨" : "⚠️"}</span>
          <span className="flex-1 leading-snug">{t.message}</span>
          <button onClick={() => onDismiss(t.id)} aria-label="Dismiss"
            className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full transition-all text-base font-bold leading-none active:scale-90"
            style={{ background:"rgba(74,58,34,0.10)", color:W.muted1 }}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SKELETONS
// ─────────────────────────────────────────────────────────────────

function SkeletonStatCards() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="rounded-[22px] p-4 animate-pulse" style={{ background:"linear-gradient(180deg, #FFF7D6, #F7E7A8)", border:"1px solid #EFD978" }}>
        <div className="w-6 h-6 rounded-lg mb-2" style={{ background:"rgba(212,168,32,0.15)" }} />
        <div className="h-9 w-10 rounded-xl mb-2" style={{ background:"rgba(212,168,32,0.15)" }} />
        <div className="h-2.5 w-28 rounded-full mb-1" style={{ background:"rgba(212,168,32,0.12)" }} />
        <div className="h-2 w-20 rounded-full" style={{ background:"rgba(212,168,32,0.10)" }} />
      </div>
      <div className="nt-gold-panel rounded-[22px] p-4 animate-pulse">
        <div className="w-6 h-6 rounded-lg mb-2" style={{ background:`rgba(74,58,34,0.08)` }} />
        <div className="h-9 w-10 rounded-xl mb-2" style={{ background:`rgba(74,58,34,0.08)` }} />
        <div className="h-2.5 w-20 rounded-full mb-1" style={{ background:`rgba(74,58,34,0.07)` }} />
        <div className="h-3 w-28 rounded-full" style={{ background:`rgba(31,26,23,0.05)` }} />
      </div>
      <div className="nt-ivory-card rounded-[22px] p-4 animate-pulse">
        <div className="w-6 h-6 rounded-lg mb-2" style={{ background:"rgba(139,125,101,0.10)" }} />
        <div className="h-9 w-14 rounded-xl mb-2" style={{ background:"rgba(139,125,101,0.10)" }} />
        <div className="h-2.5 w-24 rounded-full mb-1" style={{ background:"rgba(139,125,101,0.08)" }} />
        <div className="h-2 w-20 rounded-full" style={{ background:"rgba(139,125,101,0.06)" }} />
      </div>
    </div>
  );
}

function SkeletonWorkflow({ compact }) {
  if (compact) {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
        {Array.from({ length: 10 }).map((_,i) => (
          <div key={i} className="rounded-[16px] p-3 animate-pulse flex flex-col items-center"
            style={{ background:W.bg2, animationDelay:`${i*60}ms` }}>
            <div className="w-10 h-10 rounded-xl mb-2.5" style={{ background:"rgba(139,125,101,0.14)" }} />
            <div className="h-2.5 w-3/4 rounded-full mb-3" style={{ background:"rgba(139,125,101,0.10)" }} />
            <div className="h-7 w-full rounded-[9px]" style={{ background:"rgba(212,168,32,0.15)" }} />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
      {[0,1,2].map(i => (
        <div key={i} className="rounded-[20px] p-4 animate-pulse"
          style={{ background:"linear-gradient(180deg, #FFF7D6, #F7E7A8)", border:"1px solid #EFD978", animationDelay:`${i*80}ms` }}>
          <div className="flex items-start gap-2.5 mb-3">
            <div className="w-10 h-10 rounded-xl flex-shrink-0" style={{ background:"rgba(212,168,32,0.20)" }} />
            <div className="flex-1 pt-0.5">
              <div className="h-3 w-3/4 rounded-full mb-1.5" style={{ background:"rgba(212,168,32,0.18)" }} />
              <div className="h-2 w-1/2 rounded-full" style={{ background:"rgba(212,168,32,0.12)" }} />
            </div>
          </div>
          <div className="h-9 w-1/2 rounded-xl mb-1" style={{ background:"rgba(212,168,32,0.18)" }} />
          <div className="h-2.5 w-24 rounded-full mb-3" style={{ background:"rgba(212,168,32,0.12)" }} />
          <div className="h-9 w-full rounded-[11px]" style={{ background:"rgba(178,91,69,0.14)" }} />
        </div>
      ))}
    </div>
  );
}

function SkeletonTimeline() {
  return (
    <div>
      {Array.from({ length:5 }).map((_,i) => (
        <div key={i} className="flex items-center gap-3 py-2.5 px-2.5 animate-pulse" style={{ animationDelay:`${i*70}ms` }}>
          <div className="w-12 flex-shrink-0"><div className="h-2.5 w-10 rounded-full ml-auto" style={{ background:"rgba(139,125,101,0.12)" }} /></div>
          <div className="w-8 h-8 rounded-xl flex-shrink-0" style={{ background:"rgba(139,125,101,0.12)" }} />
          <div className="flex-1 min-w-0">
            <div className="h-3 rounded-full w-28 mb-1.5" style={{ background:"rgba(139,125,101,0.12)" }} />
            <div className="h-2.5 rounded-full w-20" style={{ background:"rgba(139,125,101,0.08)" }} />
          </div>
          <div className="w-12 h-5 rounded-full flex-shrink-0" style={{ background:"rgba(139,125,101,0.09)" }} />
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
          style={{ background:"rgba(220,38,38,0.07)", border:"1px solid rgba(220,38,38,0.12)" }}>⚠️</div>
        <p className="text-lg font-bold" style={{ color:W.charcoal1 }}>Connection Error</p>
        <p className="mt-1.5 text-sm max-w-xs leading-relaxed" style={{ color:W.muted1 }}>
          Could not reach the server. Make sure the backend is running on port 5000.
        </p>
        <button onClick={onRetry} className="mt-5 px-6 py-2.5 font-bold text-sm rounded-full transition-all active:scale-95"
          style={{ background:`linear-gradient(135deg, ${W.gold2}, ${W.gold1})`, color:W.charcoal1, boxShadow:`0 2px 8px rgba(224,177,0,0.22)` }}>
          ↺ Retry
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-14 h-14 rounded-3xl flex items-center justify-center text-2xl mb-3 select-none"
        style={{ background:`rgba(244,196,48,0.10)`, border:`1px solid rgba(244,196,48,0.18)` }}>
        {searched ? "🔍" : "🎒"}
      </div>
      <p className="font-bold" style={{ color:W.charcoal1 }}>{searched ? "No Matches" : "No Students Found"}</p>
      <p className="mt-1 text-sm max-w-xs leading-relaxed" style={{ color:W.muted1 }}>
        {searched ? "Try a different name or class filter." : "Add students first, then come back here."}
      </p>
    </div>
  );
}

function EmptyAwake({ sleepingCount, onSwitch }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 rounded-3xl flex items-center justify-center text-3xl mb-4 select-none"
        style={{ background:"linear-gradient(180deg, #FFF7D6, #F7E7A8)", border:`1px solid #EFD978`, animation:"nt-moon-float 4.5s ease-in-out infinite" }}>
        🌙
      </div>
      <p className="text-[15px] font-bold" style={{ color:W.charcoal1 }}>
        {sleepingCount > 0 ? "All students are napping!" : "No students awake"}
      </p>
      <p className="mt-1.5 text-[12px] max-w-[180px] leading-relaxed" style={{ color:W.muted1 }}>
        {sleepingCount > 0
          ? `${sleepingCount} student${sleepingCount > 1 ? "s" : ""} currently sleeping`
          : "No active students right now"}
      </p>
      {sleepingCount > 0 && (
        <button onClick={onSwitch} className="mt-4 px-4 py-2 font-bold text-[12px] rounded-full transition-all active:scale-95"
          style={{ background:"linear-gradient(180deg,#FFE7DF 0%,#F8D2C5 100%)", color:"#B25B45", border:"1px solid rgba(178,91,69,0.18)" }}>
          ☀️ View Sleeping Students
        </button>
      )}
    </div>
  );
}

function EmptyActiveNaps({ onSwitch }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 rounded-3xl flex items-center justify-center text-3xl mb-4 select-none"
        style={{ background:`rgba(255,253,246,0.80)`, border:`1px solid rgba(244,196,48,0.16)`, animation:"nt-moon-float 4.5s ease-in-out infinite" }}>
        🌙
      </div>
      <p className="text-[15px] font-bold" style={{ color:W.charcoal1 }}>No active naps right now</p>
      <p className="mt-1.5 text-[12px]" style={{ color:W.muted1 }}>Tap Start Nap to begin tracking</p>
      <button onClick={onSwitch} className="mt-4 px-4 py-2 font-bold text-[12px] rounded-full transition-all active:scale-95"
        style={{ background:"linear-gradient(180deg,#F6D54A 0%,#F1C933 100%)", color:"#7A5A00", border:"1px solid rgba(212,178,40,0.25)", boxShadow:"0 2px 8px rgba(241,201,51,0.25)" }}>
        😴 Start Nap
      </button>
    </div>
  );
}

function EmptyHistory({ filtered = false }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-14 h-14 rounded-3xl flex items-center justify-center text-2xl mb-3 select-none"
        style={{ background:W.bg2, border:`1px solid rgba(139,125,101,0.10)` }}>
        {filtered ? "🔍" : "📋"}
      </div>
      <p className="font-bold" style={{ color:W.charcoal1 }}>{filtered ? "No Matches" : "No Activity Yet"}</p>
      <p className="mt-1 text-sm max-w-xs leading-relaxed" style={{ color:W.muted1 }}>
        {filtered ? "Try clearing the student filter." : "No naps have been logged for this date yet."}
      </p>
    </div>
  );
}
