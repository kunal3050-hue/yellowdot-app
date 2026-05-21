// ─────────────────────────────────────────────────────────────────────────────
// FoodConsumption — /food-consumption
//
// Teacher tool to track daily student meal intake.
// One meal category at a time via segment control for reduced cognitive load.
//
// Workflow:
//   1. Teacher selects class + date
//   2. Segment control appears with available meal categories
//   3. Teacher selects a category → only that meal visible for all students
//   4. Teacher taps quantity chips → autosave (debounced 800ms)
//   5. Summary section shows all recorded entries
//
// Quota safety:
//   - Students: 1 fetch on mount, cached in state
//   - Menu: 1 fetch when date changes
//   - Consumption: 1 fetch when date or class changes
//   - Autosave: 1 append per cell change (no reads during save)
//   - No polling, no re-render loops
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import foodMenuService        from "../services/foodMenuService";
import foodConsumptionService from "../services/foodConsumptionService";
import { api } from "../services/authService";

// ── Constants ─────────────────────────────────────────────────────────────

const CLASSES     = ["Playgroup", "Nursery", "Junior K.G.", "Senior K.G.", "Daycare"];
const QTY_OPTIONS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5];

// All warm stone/amber/yellow — no violet/sky/emerald/rose/teal/indigo/fuchsia
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

// All warm gold tonal — no pink/violet/sky/teal
const CLASS_PILLS = {
  "Playgroup":   "bg-[#f5e8b8] text-[#7a5e18] border border-[#e8d49a]",
  "Nursery":     "bg-[#f8f0d4] text-[#8b7228] border border-[#e8daa0]",
  "Junior K.G.": "bg-[#faf5e4] text-[#8b7228] border border-[#ece0b4]",
  "Senior K.G.": "bg-[#f5e8b8] text-[#7a5e18] border border-[#e8d49a]",
  "Daycare":     "bg-[#f8f0d4] text-[#9a8248] border border-[#e8daa0]",
};

// ── Utilities ─────────────────────────────────────────────────────────────

function todayISO() { return new Date().toISOString().split("T")[0]; }

function initials(name = "") {
  return name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase() || "?";
}

function avatarGradient(name) {
  const code = [...(name || "")].reduce((s, c) => s + c.charCodeAt(0), 0);
  return AVATAR_GRADIENTS[code % AVATAR_GRADIENTS.length];
}

function fmtDateDisplay(iso) {
  if (!iso) return "";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "short", day: "2-digit", month: "short", year: "numeric",
  });
}

function timeAgo(ts) {
  if (!ts) return "";
  const diff = Date.now() - ts;
  if (diff < 60_000)    return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

// ── Toast hook ────────────────────────────────────────────────────────────

function useToast() {
  const [toasts, setToasts] = useState([]);
  const dismiss = useCallback(id => setToasts(t => t.filter(x => x.id !== id)), []);
  const add = useCallback((type, message) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, type, message }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4500);
  }, []);
  const success = useCallback(msg => add("success", msg), [add]);
  const error   = useCallback(msg => add("error",   msg), [add]);
  return { toasts, success, error, dismiss };
}

// ── Toast stack ───────────────────────────────────────────────────────────

function ToastStack({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-0 left-0 right-0 sm:bottom-6 sm:left-auto sm:right-6 z-[100]
                    flex flex-col gap-2 sm:gap-3 p-4 sm:p-0 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`
            flex items-center gap-3 px-4 py-3.5 rounded-2xl shadow-xl text-sm font-semibold
            w-full sm:min-w-[280px] sm:max-w-sm pointer-events-auto
            ${t.type === "success" ? "bg-[#2a1c06] text-white" : "bg-[#c0402a] text-white"}
          `}
        >
          <span className="text-xl flex-shrink-0 select-none">
            {t.type === "success" ? "✨" : "⚠️"}
          </span>
          <span className="flex-1 leading-snug">{t.message}</span>
          <button
            onClick={() => onDismiss(t.id)}
            className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full
                       bg-white/15 hover:bg-white/25 transition-all text-white/80 hover:text-white font-bold"
          >×</button>
        </div>
      ))}
    </div>
  );
}

// ── SaveIndicator ─────────────────────────────────────────────────────────

function SaveIndicator({ saving, saved }) {
  if (saving) {
    return (
      <svg className="w-3.5 h-3.5 text-[#c9a830] animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
      </svg>
    );
  }
  if (saved) {
    return (
      <svg className="w-3.5 h-3.5 text-[#8b7a28] flex-shrink-0" fill="none" viewBox="0 0 24 24">
        <path stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  return <div className="w-3.5 h-3.5 flex-shrink-0" />;
}

// ── QuantitySelector — premium warm chips ────────────────────────────────

function QuantitySelector({ value, onChange, disabled }) {
  return (
    <div className={`flex items-center gap-1 transition-opacity duration-150
                     ${disabled ? "opacity-35 pointer-events-none" : ""}`}>
      {QTY_OPTIONS.map(q => {
        const isActive = value !== null && value !== undefined && Number(value) === q;
        const isZero   = q === 0;
        return (
          <button
            key={q}
            type="button"
            onClick={() => onChange(q)}
            className={`
              min-w-[30px] h-7 px-2 text-xs font-semibold rounded-lg transition-all duration-[180ms] select-none
              ${isActive ? "scale-[1.06]" : "text-[#c4b090] hover:text-[#7a5e18] hover:bg-[#f5e8b8]"}
            `}
            style={isActive ? {
              background: isZero
                ? "linear-gradient(160deg,#fee8e2 0%,#fdd4c8 100%)"
                : "linear-gradient(160deg,#f9dc5a 0%,#f0c930 100%)",
              color:      isZero ? "#7a2018" : "#5a4010",
              boxShadow:  isZero
                ? "0 2px 6px rgba(192,64,42,0.22)"
                : "0 2px 8px rgba(212,170,31,0.30),inset 0 1px 0 rgba(255,255,255,0.45)",
            } : {}}
          >
            {q}
          </button>
        );
      })}
    </div>
  );
}

// ── StatusPill ────────────────────────────────────────────────────────────

function StatusPill({ status }) {
  if (!status) return <span className="text-[#d4c8b0] text-xs select-none">—</span>;
  if (status === "Ate") {
    return (
      <span className="px-2 py-0.5 rounded-lg bg-[#f8f4d8] text-[#5a4d18] text-[10px] font-semibold
                       border border-[#d4bc58] whitespace-nowrap">
        Ate
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded-lg bg-[#fee8e2] text-[#7a2018] text-[10px] font-semibold
                     border border-[#e0a898] whitespace-nowrap">
      Skipped
    </span>
  );
}

// ── MealSegmentControl — Apple-style pill tabs ────────────────────────────

function MealSegmentControl({ meals, active, onSelect }) {
  return (
    <div
      className="flex items-center gap-1 p-1 rounded-2xl border border-[#e8d898] overflow-x-auto flex-shrink-0"
      style={{
        background:  "linear-gradient(180deg,#fdf8e8 0%,#f8f0d4 100%)",
        boxShadow:   "inset 0 1px 3px rgba(180,140,0,0.10)",
        scrollbarWidth: "none",
      }}
    >
      {meals.map(m => {
        const isActive = active === m.mealType;
        return (
          <button
            key={m.mealType}
            onClick={() => onSelect(m.mealType)}
            className={`
              flex-shrink-0 px-4 py-1.5 rounded-xl text-xs font-semibold
              transition-all duration-[180ms] whitespace-nowrap
              ${isActive ? "scale-[1.01]" : "text-[#a3957e] hover:text-[#7a5e18] hover:bg-[#fff7dc]/70"}
            `}
            style={isActive ? {
              background: "linear-gradient(160deg,#f9dc5a 0%,#f0c930 100%)",
              color:      "#5a4010",
              boxShadow:  "0 2px 10px rgba(212,170,31,0.28),inset 0 1px 0 rgba(255,255,255,0.5)",
            } : {}}
          >
            {m.mealType}
          </button>
        );
      })}
    </div>
  );
}

// ── SkeletonCards ─────────────────────────────────────────────────────────

function SkeletonCards() {
  return (
    <div className="space-y-2 animate-pulse">
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i}
          className="flex items-center gap-4 px-5 py-4 rounded-2xl bg-[#fffdf8] border border-[#f0ebe0]"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <div className="w-9 h-9 rounded-xl bg-[#f0e8d4] flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 bg-[#f0e8d4] rounded-full w-32" />
            <div className="h-2 bg-[#f0e8d4] rounded-full w-20" />
          </div>
          <div className="h-7 w-52 bg-[#f0e8d4] rounded-xl" />
          <div className="h-5 w-12 bg-[#f0e8d4] rounded-lg" />
        </div>
      ))}
    </div>
  );
}

// ── Empty / error states ──────────────────────────────────────────────────

function NoMenuState({ date }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="relative w-20 h-20 flex items-center justify-center mb-5 select-none">
        <div className="absolute inset-0 rounded-full bg-[#fff8e2]" />
        <div className="absolute inset-3 rounded-full bg-[#fff4c2]/70" />
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#c79b12"
          strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="relative z-10">
          <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/>
          <path d="M7 2v20"/>
          <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3z"/>
          <path d="M21 15v7"/>
        </svg>
      </div>
      <p className="text-lg font-bold text-[#2a1c06]">No Menu for {fmtDateDisplay(date)}</p>
      <p className="text-[#8b7d65] mt-2 text-sm max-w-[280px] mx-auto leading-relaxed">
        Add a food menu for this date before tracking consumption.
      </p>
      <Link
        to="/food-menu"
        className="inline-flex items-center gap-2 mt-5 px-6 py-2.5 rounded-xl
                   text-[#5a4010] font-semibold text-sm transition-all active:scale-95"
        style={{ background: "linear-gradient(160deg,#f9dc5a 0%,#f0c930 100%)", boxShadow: "0 4px 14px rgba(212,170,31,0.28)" }}
      >
        Go to Food Menu
      </Link>
    </div>
  );
}

function NoStudentsState({ cls }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 bg-[#faf5e4] border border-[#e8daa0] rounded-3xl flex items-center justify-center mb-5 select-none">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#c79b12"
          strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      </div>
      <p className="text-lg font-bold text-[#2a1c06]">No Students in {cls}</p>
      <p className="text-[#8b7d65] mt-2 text-sm max-w-[280px] mx-auto leading-relaxed">
        No active students are enrolled in this class yet.
      </p>
    </div>
  );
}

function ErrorState({ onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 bg-[#fee8e2] border border-[#e0a898] rounded-3xl flex items-center justify-center mb-5 select-none">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#c0402a"
          strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </div>
      <p className="text-lg font-bold text-[#2a1c06]">Connection Error</p>
      <p className="text-[#8b7d65] mt-2 text-sm max-w-[260px] mx-auto leading-relaxed">
        Could not reach the server. Make sure the backend is running.
      </p>
      <button
        onClick={onRetry}
        className="mt-5 px-6 py-2.5 rounded-xl text-[#5a4010] font-semibold text-sm transition-all active:scale-95"
        style={{ background: "linear-gradient(160deg,#f9dc5a 0%,#f0c930 100%)", boxShadow: "0 4px 14px rgba(212,170,31,0.28)" }}
      >
        Retry
      </button>
    </div>
  );
}

// ── StudentCard — compact floating row, single meal ───────────────────────

function StudentCard({ student, meal, entry, saving, saved, onQuantityChange }) {
  const grad   = avatarGradient(student.Student_Name);
  const qty    = entry?.quantity ?? null;
  const status = entry?.status  ?? "";
  const hasQty = qty !== null && qty !== undefined && qty !== "";
  const hasMeal = !!meal?.itemName;

  return (
    <div className={`
      flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all duration-[190ms]
      hover:shadow-[0_4px_16px_rgba(212,170,31,0.10)] hover:-translate-y-px
      ${hasQty
        ? "bg-[#fffdf0] border-[#e8d89a]"
        : "bg-[#fffdf8] border-transparent hover:bg-[#fffbee] hover:border-[#e8d898]"}
    `}>
      {/* Avatar */}
      <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${grad}
                       flex items-center justify-center flex-shrink-0`}>
        <span className="text-white font-bold text-xs select-none">{initials(student.Student_Name)}</span>
      </div>

      {/* Name only */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-[#2a1c06] truncate leading-tight">{student.Student_Name}</p>
      </div>

      {/* Quantity chips */}
      <QuantitySelector value={qty} onChange={onQuantityChange} disabled={!hasMeal} />

      {/* Unit */}
      {hasQty && meal?.unitType && (
        <span className="text-[10px] text-[#a3957e] font-normal flex-shrink-0 w-8 text-right hidden sm:block">
          {meal.unitType}
        </span>
      )}

      {/* Status */}
      <div className="flex-shrink-0 w-[68px] text-right">
        <StatusPill status={status} />
      </div>

      {/* Save indicator */}
      <div className="w-4 flex-shrink-0 flex items-center justify-center">
        <SaveIndicator saving={saving} saved={saved} />
      </div>
    </div>
  );
}

// ── RecentSection ─────────────────────────────────────────────────────────

function RecentSection({ entries }) {
  return (
    <div className="rounded-3xl border border-[#e8ddb8] overflow-hidden"
      style={{ boxShadow: "0 4px 20px rgba(212,170,31,0.07)", background: "#fffdf8" }}>
      <div className="px-6 py-4 border-b border-[#f0ebe0] flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-[#2a1c06]">Consumption Summary</h2>
          <p className="text-[10px] text-[#a3957e] font-normal mt-0.5">
            All recorded entries for this date · class
          </p>
        </div>
        <span className="px-2.5 py-1 rounded-xl bg-[#f8f0d4] text-[#7a5e18] text-xs font-semibold
                         border border-[#e8d49a]">
          {entries.length} {entries.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      <div className="divide-y divide-[#f0ebe0] max-h-72 overflow-auto">
        {entries.map(e => (
          <div key={e.key}
            className="flex items-center gap-3 px-6 py-2.5 hover:bg-[#fffbee] transition-colors duration-150">
            <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${avatarGradient(e.studentName)}
                             flex items-center justify-center flex-shrink-0`}>
              <span className="text-white text-[9px] font-bold select-none">{initials(e.studentName)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#2a1c06] truncate">{e.studentName}</p>
              <p className="text-[10px] text-[#a3957e] font-normal">
                {e.mealType}{e.foodItem ? ` · ${e.foodItem}` : ""}
              </p>
            </div>
            <div className="text-sm font-bold text-[#2a1c06] whitespace-nowrap flex-shrink-0">
              {e.quantity}
              {e.quantity !== null && e.quantity !== "" && (
                <span className="text-[#a3957e] font-normal text-xs ml-1">{e.unit || "pcs"}</span>
              )}
            </div>
            <div className="flex-shrink-0">
              <StatusPill status={e.status} />
            </div>
            {e.lastUpdated && (
              <span className="text-[10px] text-[#c4b090] font-normal flex-shrink-0 w-14 text-right">
                {timeAgo(e.lastUpdated)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export default function FoodConsumption() {
  const [selectedDate,  setSelectedDate]  = useState(todayISO);
  const [selectedClass, setSelectedClass] = useState(CLASSES[0]);
  const [activeMeal,    setActiveMeal]    = useState(null);

  // Students (loaded once on mount — class filter is client-side)
  const [students,        setStudents]        = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [bootError,       setBootError]       = useState(false);

  // Food menu for selected date
  const [menuSlots,   setMenuSlots]   = useState([]);
  const [menuLoading, setMenuLoading] = useState(true);

  // Consumption map: { "${studentId}__${mealType}" → { quantity, status, lastUpdated } }
  const [consumptionMap,     setConsumptionMap]     = useState({});
  const [consumptionLoading, setConsumptionLoading] = useState(true);

  // Per-cell save state
  const [savingCells, setSavingCells] = useState(new Set());
  const [savedCells,  setSavedCells]  = useState(new Set());

  const toast        = useToast();
  const mountedRef   = useRef(true);
  const fetchingRef  = useRef(false);
  const debounceRefs = useRef({});

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      Object.values(debounceRefs.current).forEach(clearTimeout);
    };
  }, []);

  // ── Load students (once, stable [] deps) ────────────────────────────────

  const loadStudents = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setStudentsLoading(true);
    try {
      const data = await api.get("/students").then(r => r.data);
      if (!mountedRef.current) return;
      const active = Array.isArray(data)
        ? data.filter(s => !s.Status || s.Status === "Active")
        : [];
      setStudents(active);
    } catch {
      if (!mountedRef.current) return;
      setBootError(true);
    } finally {
      if (mountedRef.current) setStudentsLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  // ── Load food menu for date (stable, receives date as arg) ───────────────

  const loadMenu = useCallback(async (date) => {
    setMenuLoading(true);
    try {
      const data = await foodMenuService.getMenus({ date });
      if (!mountedRef.current) return;
      setMenuSlots(Array.isArray(data) ? data : []);
    } catch {
      if (!mountedRef.current) return;
      setMenuSlots([]);
    } finally {
      if (mountedRef.current) setMenuLoading(false);
    }
  }, []);

  // ── Load consumption for date + class (stable) ───────────────────────────

  const loadConsumption = useCallback(async (date, cls) => {
    setConsumptionLoading(true);
    try {
      const data = await foodConsumptionService.getConsumption({ date, class: cls });
      if (!mountedRef.current) return;
      const map = {};
      (Array.isArray(data) ? data : []).forEach(e => {
        const key = `${e.student_id}__${e.meal_type}`;
        map[key]  = { quantity: e.quantity, status: e.status, lastUpdated: null };
      });
      setConsumptionMap(map);
    } catch {
      if (!mountedRef.current) return;
      setConsumptionMap({});
    } finally {
      if (mountedRef.current) setConsumptionLoading(false);
    }
  }, []);

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => { loadStudents(); }, [loadStudents]);

  // Date change: clear menu + reset active meal tab
  useEffect(() => {
    setMenuSlots([]);
    setMenuLoading(true);
    setActiveMeal(null);
    loadMenu(selectedDate);
  }, [selectedDate, loadMenu]);

  // Auto-select first meal when menuSlots loads (or after reset)
  useEffect(() => {
    if (menuSlots.length > 0 && !activeMeal) {
      setActiveMeal(menuSlots[0].mealType);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuSlots]); // intentionally excludes activeMeal — only runs when slots load

  // Consumption — whenever date or class changes
  useEffect(() => {
    Object.values(debounceRefs.current).forEach(clearTimeout);
    debounceRefs.current = {};
    setConsumptionMap({});
    setConsumptionLoading(true);
    loadConsumption(selectedDate, selectedClass);
  }, [selectedDate, selectedClass, loadConsumption]);

  // ── Derived data ──────────────────────────────────────────────────────────

  const filteredStudents = useMemo(
    () => students.filter(s => s.Class === selectedClass),
    [students, selectedClass]
  );

  // Active meal slot object
  const activeMealSlot = useMemo(
    () => menuSlots.find(m => m.mealType === activeMeal) || null,
    [menuSlots, activeMeal]
  );

  // How many students recorded for the active meal
  const activeMealRecordedCount = useMemo(() => {
    if (!activeMeal) return 0;
    return filteredStudents.filter(s => {
      const key = `${s.Student_ID}__${activeMeal}`;
      const e   = consumptionMap[key];
      return e && e.quantity !== null && e.quantity !== undefined && e.quantity !== "";
    }).length;
  }, [consumptionMap, filteredStudents, activeMeal]);

  // Total unique students with at least one meal recorded (header stat)
  const totalRecordedCount = useMemo(() => {
    const sids = new Set(filteredStudents.map(s => s.Student_ID));
    const seen = new Set();
    Object.keys(consumptionMap).forEach(key => {
      const [sid] = key.split("__");
      const e     = consumptionMap[key];
      if (sids.has(sid) && e.quantity !== null && e.quantity !== undefined && e.quantity !== "") {
        seen.add(sid);
      }
    });
    return seen.size;
  }, [consumptionMap, filteredStudents]);

  // Summary entries (all recorded, session-changes first)
  const recentEntries = useMemo(() => {
    const nameMap = {};
    students.forEach(s => { nameMap[s.Student_ID] = s.Student_Name; });
    return Object.entries(consumptionMap)
      .filter(([, v]) => v.quantity !== null && v.quantity !== undefined && v.quantity !== "")
      .map(([key, v]) => {
        const [sid, mealType] = key.split("__");
        const meal = menuSlots.find(m => m.mealType === mealType);
        return {
          key, studentId: sid, studentName: nameMap[sid] || sid,
          mealType, foodItem: meal?.itemName || "",
          quantity: v.quantity, unit: meal?.unitType || "pcs",
          status: v.status, lastUpdated: v.lastUpdated,
        };
      })
      .sort((a, b) => {
        if (a.lastUpdated && b.lastUpdated) return b.lastUpdated - a.lastUpdated;
        if (a.lastUpdated) return -1;
        if (b.lastUpdated) return 1;
        return a.studentName.localeCompare(b.studentName);
      })
      .slice(0, 25);
  }, [consumptionMap, students, menuSlots]);

  // ── Autosave (debounced 800ms, append-only) ───────────────────────────────

  function scheduleAutosave(key, payload) {
    if (debounceRefs.current[key]) clearTimeout(debounceRefs.current[key]);
    debounceRefs.current[key] = setTimeout(async () => {
      delete debounceRefs.current[key];
      if (!mountedRef.current) return;
      setSavingCells(prev => { const n = new Set(prev); n.add(key); return n; });
      try {
        await foodConsumptionService.saveConsumption(payload);
        if (!mountedRef.current) return;
        setSavedCells(prev => { const n = new Set(prev); n.add(key); return n; });
        setTimeout(() => {
          if (!mountedRef.current) return;
          setSavedCells(prev => { const n = new Set(prev); n.delete(key); return n; });
        }, 2000);
      } catch (err) {
        console.error("[food-consumption] autosave failed:", err.message);
      } finally {
        if (mountedRef.current)
          setSavingCells(prev => { const n = new Set(prev); n.delete(key); return n; });
      }
    }, 800);
  }

  function handleQuantityChange(student, meal, newQty) {
    const key    = `${student.Student_ID}__${meal.mealType}`;
    const status = Number(newQty) > 0 ? "Ate" : "Didn't Eat";
    const now    = Date.now();
    setConsumptionMap(prev => ({ ...prev, [key]: { quantity: String(newQty), status, lastUpdated: now } }));
    scheduleAutosave(key, {
      date:         selectedDate,
      student_id:   student.Student_ID,
      student_name: student.Student_Name,
      class:        student.Class,
      meal_type:    meal.mealType,
      food_item:    meal.itemName  || "",
      quantity:     String(newQty),
      unit:         meal.unitType  || "pcs",
      status,
      updated_by:   "Teacher",
    });
  }

  // ── Render-state helpers ──────────────────────────────────────────────────

  const showSkeleton     = studentsLoading;
  const dimOverlay       = consumptionLoading && !studentsLoading;
  const showMenuSkeleton = !studentsLoading && menuLoading && menuSlots.length === 0;

  // ── RENDER ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen bg-[#fffdf7] overflow-hidden">
      <Sidebar />

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

        {/* ── STICKY HEADER ─────────────────────────────────────────────── */}
        <div className="flex-shrink-0 bg-[#fffef8]/[0.98] backdrop-blur-2xl border-b border-[#ece7d8]
                        shadow-[0_1px_12px_rgba(180,140,0,0.07)] z-20">
          <div className="px-6 md:px-10 py-3 md:py-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">

              {/* Title */}
              <div className="flex-shrink-0">
                <h1 className="text-3xl md:text-4xl font-black text-[#2a1c06] tracking-tight leading-none">
                  Food Consumption
                </h1>
                <p className="text-[#a3957e] text-sm mt-0.5 font-normal">
                  Track daily meal intake · autosaves instantly
                </p>
              </div>

              {/* Controls */}
              <div className="flex flex-wrap items-center gap-2.5">

                {/* Recorded stat */}
                {!studentsLoading && filteredStudents.length > 0 && (
                  <div className="bg-[#fffbee] border border-[#ece7d8] rounded-2xl px-4 py-2 text-center
                                  min-w-[96px] shadow-[0_2px_8px_rgba(180,140,0,0.06)]">
                    <p className="text-[9px] font-semibold text-[#a3957e] uppercase tracking-widest">Recorded</p>
                    <p className="text-xl font-black text-[#2a1c06] tabular-nums leading-none mt-0.5">
                      {totalRecordedCount}
                      <span className="text-[#d4c8b0] font-normal text-base">/{filteredStudents.length}</span>
                    </p>
                  </div>
                )}

                {/* Date picker */}
                <input
                  type="date"
                  value={selectedDate}
                  max={todayISO()}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="px-4 py-2.5 rounded-xl border border-[#ece7d8] bg-white
                             text-[#2a1c06] font-medium text-sm
                             focus:ring-2 focus:ring-[#f4c430]/35 focus:border-[#c9a830]/60
                             outline-none cursor-pointer"
                />

                {/* Class selector */}
                <select
                  value={selectedClass}
                  onChange={e => setSelectedClass(e.target.value)}
                  className="px-4 py-2.5 rounded-xl border border-[#ece7d8] bg-white
                             text-[#2a1c06] font-medium text-sm min-w-[140px]
                             focus:ring-2 focus:ring-[#f4c430]/35 focus:border-[#c9a830]/60
                             outline-none cursor-pointer"
                >
                  {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* ── Segment control — sticky below header ────────────────────── */}
          {!studentsLoading && !menuLoading && menuSlots.length > 0 && (
            <div className="px-6 md:px-10 pb-3">
              <div className="flex items-center gap-3">
                <MealSegmentControl
                  meals={menuSlots}
                  active={activeMeal}
                  onSelect={setActiveMeal}
                />
                {activeMeal && (
                  <span className="text-xs text-[#a3957e] font-normal flex-shrink-0">
                    {activeMealRecordedCount}/{filteredStudents.length} recorded
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── MAIN SCROLL AREA ──────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto px-6 md:px-10 py-5 space-y-5">

          {/* Tracking area */}
          {showSkeleton || showMenuSkeleton ? (
            <SkeletonCards />
          ) : bootError ? (
            <ErrorState onRetry={loadStudents} />
          ) : menuSlots.length === 0 ? (
            <NoMenuState date={selectedDate} />
          ) : filteredStudents.length === 0 ? (
            <NoStudentsState cls={selectedClass} />
          ) : (
            <div className={`max-w-[860px] transition-opacity duration-200
                             ${dimOverlay ? "opacity-60 pointer-events-none" : ""}`}>

              {/* Active meal context breadcrumb */}
              {activeMealSlot && (
                <div className="mb-2.5 flex items-center gap-2">
                  <span className="text-xs text-[#a3957e] font-normal">{activeMeal}</span>
                  {activeMealSlot.itemName && (
                    <>
                      <span className="text-[#e0d4a8]">·</span>
                      <span className="text-xs font-medium text-[#7a5e18]">{activeMealSlot.itemName}</span>
                      <span className="text-[#e0d4a8]">·</span>
                      <span className="text-xs text-[#a3957e]">{activeMealSlot.unitType}</span>
                    </>
                  )}
                </div>
              )}

              {/* Student rows */}
              <div className="space-y-1.5">
                {filteredStudents.map(student => {
                  const key   = `${student.Student_ID}__${activeMeal}`;
                  const entry = consumptionMap[key];
                  const fallbackMeal = activeMealSlot || { mealType: activeMeal || "", itemName: "", unitType: "pcs" };
                  return (
                    <StudentCard
                      key={student.Student_ID}
                      student={student}
                      meal={fallbackMeal}
                      entry={entry}
                      saving={savingCells.has(key)}
                      saved={savedCells.has(key)}
                      onQuantityChange={newQty => handleQuantityChange(student, fallbackMeal, newQty)}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Summary section */}
          {!studentsLoading && !menuLoading && recentEntries.length > 0 && (
            <div className="max-w-[860px]">
              <RecentSection entries={recentEntries} />
            </div>
          )}

          <div className="h-6" />
        </div>
      </div>

      <ToastStack toasts={toast.toasts} onDismiss={toast.dismiss} />
    </div>
  );
}
