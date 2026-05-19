// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// FoodConsumption â€” /food-consumption
//
// Teacher tool to track daily student meal intake.
//
// Workflow:
//   1. Teacher selects class + date
//   2. Students for that class load; food menu for the date loads
//   3. Teacher taps quantity buttons â†’ autosave (debounced 800ms)
//   4. Consumption summary renders below the tracking area
//
// Quota safety:
//   - Students: 1 fetch on mount, cached in state
//   - Menu: 1 fetch when date changes
//   - Consumption: 1 fetch when date or class changes
//   - Autosave: 1 append per cell change (no reads during save)
//   - No polling, no re-render loops, no toast in useCallback deps
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import foodMenuService        from "../services/foodMenuService";
import foodConsumptionService from "../services/foodConsumptionService";
import { api } from "../services/authService";

// â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const CLASSES     = ["Playgroup", "Nursery", "Junior K.G.", "Senior K.G.", "Daycare"];
const QTY_OPTIONS = [0, 0.5, 1, 1.5, 2];

const MEAL_EMOJIS = {
  "Breakfast":   "ðŸŒ…",
  "Mid-Morning": "ðŸŽ",
  "Roti Sabzi":  "ðŸ«“",
  "Dal Rice":    "ðŸš",
  "Milk":        "ðŸ¥›",
  "Snacks":      "ðŸª",
};

const AVATAR_GRADIENTS = [
  "from-violet-400 to-purple-600",
  "from-sky-400    to-blue-600",
  "from-emerald-400 to-green-600",
  "from-rose-400   to-pink-600",
  "from-amber-400  to-orange-500",
  "from-teal-400   to-cyan-600",
  "from-indigo-400 to-blue-700",
  "from-fuchsia-400 to-pink-600",
];

const CLASS_PILLS = {
  "Playgroup":   "bg-pink-50   text-pink-700   border border-pink-100",
  "Nursery":     "bg-violet-50 text-violet-700 border border-violet-100",
  "Junior K.G.": "bg-sky-50    text-sky-700    border border-sky-100",
  "Senior K.G.": "bg-teal-50   text-teal-700   border border-teal-100",
  "Daycare":     "bg-amber-50  text-amber-700  border border-amber-100",
};

// â”€â”€ Utilities â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
  if (diff < 60_000)   return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

// â”€â”€ Toast hook â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Stable callbacks â€” no references in useCallback deps â†’ no loops.

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

// â”€â”€ Toast stack â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ToastStack({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-0 left-0 right-0 sm:bottom-6 sm:left-auto sm:right-6 z-[100]
                    flex flex-col gap-2 sm:gap-3 p-4 sm:p-0 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`
            flex items-center gap-3 px-4 py-3.5 rounded-2xl shadow-2xl text-sm font-semibold
            w-full sm:min-w-[280px] sm:max-w-sm pointer-events-auto
            ${t.type === "success" ? "bg-yd-navy text-white" : "bg-rose-600 text-white"}
          `}
        >
          <span className="text-xl flex-shrink-0 select-none">
            {t.type === "success" ? "âœ…" : "âŒ"}
          </span>
          <span className="flex-1 leading-snug">{t.message}</span>
          <button
            onClick={() => onDismiss(t.id)}
            className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full
                       bg-white/15 hover:bg-white/25 transition-all text-white/80 hover:text-white font-bold"
          >Ã—</button>
        </div>
      ))}
    </div>
  );
}

// â”€â”€ SaveIndicator â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function SaveIndicator({ saving, saved }) {
  if (saving) {
    return (
      <svg className="w-3.5 h-3.5 text-gray-400 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
      </svg>
    );
  }
  if (saved) {
    return (
      <svg className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24">
        <path stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  return <div className="w-3.5 h-3.5 flex-shrink-0" />;
}

// â”€â”€ QuantitySelector â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function QuantitySelector({ value, onChange, disabled }) {
  return (
    <div className={`flex items-center gap-0.5 bg-gray-50 rounded-xl p-0.5 border border-gray-100
                     transition-opacity ${disabled ? "opacity-40 pointer-events-none" : ""}`}>
      {QTY_OPTIONS.map(q => {
        const isActive = value !== null && value !== undefined && Number(value) === q;
        return (
          <button
            key={q}
            type="button"
            onClick={() => onChange(q)}
            className={`
              w-9 h-7 text-xs font-bold rounded-[8px] transition-all duration-150 select-none
              ${isActive
                ? q === 0
                  ? "bg-rose-100 text-rose-600 shadow-sm"
                  : "bg-yd-navy text-white shadow-sm"
                : "text-gray-400 hover:text-yd-navy hover:bg-white/80"
              }
            `}
          >
            {q}
          </button>
        );
      })}
    </div>
  );
}

// â”€â”€ StatusPill â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function StatusPill({ status }) {
  if (!status) return <span className="text-gray-200 text-xs select-none">â€”</span>;
  if (status === "Ate") {
    return (
      <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-bold
                       border border-emerald-100 whitespace-nowrap">
        âœ“ Ate
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded-lg bg-rose-50 text-rose-600 text-[10px] font-bold
                     border border-rose-100 whitespace-nowrap">
      âœ— Didn't Eat
    </span>
  );
}

// â”€â”€ SkeletonCards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function SkeletonCards() {
  return (
    <div className="space-y-4 animate-pulse">
      {[0, 1, 2].map(i => (
        <div key={i} className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-4"
             style={{ animationDelay: `${i * 80}ms` }}>
          <div className="flex items-center gap-4 pb-4 border-b border-gray-50">
            <div className="w-11 h-11 rounded-2xl bg-gray-100" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-gray-100 rounded-full w-36" />
              <div className="h-2 bg-gray-100 rounded-full w-20" />
            </div>
            <div className="h-5 w-20 bg-gray-100 rounded-xl" />
          </div>
          {[0, 1, 2, 3].map(j => (
            <div key={j} className="flex items-center gap-4 py-1">
              <div className="h-2 bg-gray-100 rounded-full w-28" />
              <div className="h-2 bg-gray-100 rounded-full flex-1" />
              <div className="h-7 bg-gray-100 rounded-xl w-48" />
              <div className="h-2 bg-gray-100 rounded-full w-10" />
              <div className="h-5 bg-gray-100 rounded-lg w-20" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// â”€â”€ Empty states â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function NoMenuState({ date }) {
  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-16 text-center">
      <div className="w-16 h-16 bg-[#FFFBEA] rounded-3xl flex items-center justify-center text-3xl mx-auto mb-5 select-none">
        ðŸ½ï¸
      </div>
      <p className="text-lg font-black text-gray-800">No Menu for {fmtDateDisplay(date)}</p>
      <p className="text-gray-400 mt-2 text-sm max-w-[280px] mx-auto leading-relaxed">
        Add today's food menu before you can track consumption.
      </p>
      <Link
        to="/food-menu"
        className="inline-flex items-center gap-2 mt-5 px-6 py-2.5
                   bg-[var(--yd-yellow-light)] hover:bg-yellow-300 text-yd-navy font-black text-sm
                   rounded-2xl transition-all active:scale-95 shadow-sm"
      >
        Go to Food Menu â†’
      </Link>
    </div>
  );
}

function NoStudentsState({ cls }) {
  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-16 text-center">
      <div className="w-16 h-16 bg-[#F0F4FF] rounded-3xl flex items-center justify-center text-3xl mx-auto mb-5 select-none">
        ðŸŽ“
      </div>
      <p className="text-lg font-black text-gray-800">No Students in {cls}</p>
      <p className="text-gray-400 mt-2 text-sm max-w-[280px] mx-auto leading-relaxed">
        No active students are enrolled in this class yet.
      </p>
    </div>
  );
}

function ErrorState({ onRetry }) {
  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-16 text-center">
      <div className="w-16 h-16 bg-rose-50 rounded-3xl flex items-center justify-center text-3xl mx-auto mb-5 select-none">
        âš ï¸
      </div>
      <p className="text-lg font-black text-gray-800">Connection Error</p>
      <p className="text-gray-400 mt-2 text-sm max-w-[260px] mx-auto leading-relaxed">
        Could not reach the server. Make sure the backend is running on port 5000.
      </p>
      <button
        onClick={onRetry}
        className="mt-5 px-6 py-2.5 bg-[var(--yd-yellow-light)] hover:bg-yellow-300 text-yd-navy
                   font-black text-sm rounded-2xl transition-all active:scale-95 shadow-sm"
      >
        â†º Retry
      </button>
    </div>
  );
}

// â”€â”€ MealRow â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function MealRow({ meal, value, status, saving, saved, onChange }) {
  const hasValue = value !== null && value !== undefined && value !== "";

  return (
    <div className="flex items-center gap-3 py-2.5 border-t border-gray-50 first:border-t-0">
      {/* Meal type */}
      <div className="flex items-center gap-2 w-[130px] flex-shrink-0">
        <span className="text-base leading-none select-none">{MEAL_EMOJIS[meal.mealType] || "ðŸ´"}</span>
        <span className="text-xs font-semibold text-gray-500 truncate">{meal.mealType}</span>
      </div>

      {/* Food item */}
      <div className="flex-1 min-w-0">
        <span className="text-sm font-semibold text-gray-700 truncate block" title={meal.itemName}>
          {meal.itemName || <span className="text-gray-300">â€”</span>}
        </span>
      </div>

      {/* Quantity selector */}
      <div className="flex-shrink-0">
        <QuantitySelector value={value} onChange={onChange} />
      </div>

      {/* Unit */}
      <div className="w-12 flex-shrink-0 text-right">
        {hasValue && (
          <span className="text-xs text-gray-400 font-medium">{meal.unitType || "pcs"}</span>
        )}
      </div>

      {/* Status */}
      <div className="w-[92px] flex-shrink-0">
        <StatusPill status={status} />
      </div>

      {/* Save indicator */}
      <div className="w-5 flex-shrink-0 flex items-center justify-center">
        <SaveIndicator saving={saving} saved={saved} />
      </div>
    </div>
  );
}

// â”€â”€ StudentCard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function StudentCard({ student, menuSlots, consumptionMap, savingCells, savedCells, onQuantityChange }) {
  const grad = avatarGradient(student.Student_Name);
  const cls  = student.Class || "";

  // How many meals recorded for this student
  const recordedMeals = menuSlots.filter(m => {
    const key = `${student.Student_ID}__${m.mealType}`;
    const e   = consumptionMap[key];
    return e && e.quantity !== null && e.quantity !== undefined && e.quantity !== "";
  }).length;

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">

      {/* Card header */}
      <div className="flex items-center gap-4 px-6 py-4 bg-gradient-to-r from-[#F8F9FF] to-white border-b border-gray-50">
        {/* Avatar */}
        <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${grad} flex items-center justify-center flex-shrink-0`}>
          <span className="text-white font-black text-sm select-none">{initials(student.Student_Name)}</span>
        </div>

        {/* Name + ID */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-yd-navy truncate">{student.Student_Name}</p>
          <p className="text-[10px] text-gray-400 font-medium">{student.Student_ID}</p>
        </div>

        {/* Meals progress */}
        <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
          <div className="text-right">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Recorded</p>
            <p className="text-sm font-black text-yd-navy tabular-nums leading-tight">
              {recordedMeals}
              <span className="text-gray-300 font-medium">/{menuSlots.length}</span>
            </p>
          </div>
        </div>

        {/* Class pill */}
        <span className={`px-2.5 py-1 rounded-xl text-[10px] font-bold flex-shrink-0
                          ${CLASS_PILLS[cls] || "bg-gray-100 text-gray-600"}`}>
          {cls}
        </span>
      </div>

      {/* Meal rows */}
      <div className="px-6 py-2 pb-3">
        {menuSlots.map(meal => {
          const key    = `${student.Student_ID}__${meal.mealType}`;
          const entry  = consumptionMap[key];
          const qty    = entry?.quantity ?? null;
          const status = entry?.status   ?? "";
          return (
            <MealRow
              key={meal.mealType}
              meal={meal}
              value={qty}
              status={status}
              saving={savingCells.has(key)}
              saved={savedCells.has(key)}
              onChange={newQty => onQuantityChange(student, meal, newQty)}
            />
          );
        })}
      </div>
    </div>
  );
}

// â”€â”€ RecentSection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function RecentSection({ entries }) {
  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Section header */}
      <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-black text-yd-navy">Consumption Summary</h2>
          <p className="text-[10px] text-gray-400 font-medium mt-0.5">
            All recorded entries for this date Â· class
          </p>
        </div>
        <span className="px-2.5 py-1 rounded-xl bg-yd-bg text-yd-navy text-xs font-black border border-gray-100">
          {entries.length} {entries.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      {/* Entry list */}
      <div className="divide-y divide-gray-50 max-h-80 overflow-auto">
        {entries.map(e => (
          <div
            key={e.key}
            className="flex items-center gap-4 px-6 py-3 hover:bg-[#FAFBFF] transition-colors"
          >
            {/* Student avatar */}
            <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${avatarGradient(e.studentName)}
                             flex items-center justify-center flex-shrink-0`}>
              <span className="text-white text-[10px] font-black select-none">{initials(e.studentName)}</span>
            </div>

            {/* Name + meal */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-700 truncate">{e.studentName}</p>
              <p className="text-[10px] text-gray-400 font-medium">
                {MEAL_EMOJIS[e.mealType] || "ðŸ´"} {e.mealType}
                {e.foodItem ? ` Â· ${e.foodItem}` : ""}
              </p>
            </div>

            {/* Qty + unit */}
            <div className="text-sm font-black text-yd-navy whitespace-nowrap flex-shrink-0">
              {e.quantity}
              {e.quantity !== null && e.quantity !== "" && (
                <span className="text-gray-400 font-medium text-xs ml-1">{e.unit || "pcs"}</span>
              )}
            </div>

            {/* Status */}
            <div className="flex-shrink-0">
              <StatusPill status={e.status} />
            </div>

            {/* Time (only for session changes) */}
            <div className="w-16 flex-shrink-0 text-right">
              {e.lastUpdated && (
                <span className="text-[10px] text-gray-400 font-medium">
                  {timeAgo(e.lastUpdated)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// â”€â”€ Main component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function FoodConsumption() {
  const [selectedDate,  setSelectedDate]  = useState(todayISO);
  const [selectedClass, setSelectedClass] = useState(CLASSES[0]);

  // Students (loaded once on mount â€” class filter is client-side)
  const [students,        setStudents]        = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [bootError,       setBootError]       = useState(false);

  // Food menu for selected date
  const [menuSlots,   setMenuSlots]   = useState([]);
  const [menuLoading, setMenuLoading] = useState(true);

  // Consumption map: { "${studentId}__${mealType}" â†’ { quantity, status, lastUpdated } }
  const [consumptionMap,     setConsumptionMap]     = useState({});
  const [consumptionLoading, setConsumptionLoading] = useState(true);

  // Per-cell save state
  const [savingCells, setSavingCells] = useState(new Set());
  const [savedCells,  setSavedCells]  = useState(new Set());

  const toast        = useToast();
  const mountedRef   = useRef(true);
  const fetchingRef  = useRef(false);    // guards the initial student load
  const debounceRefs = useRef({});       // { cellKey â†’ timeoutId }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Cancel all pending autosaves on unmount
      Object.values(debounceRefs.current).forEach(clearTimeout);
    };
  }, []);

  // â”€â”€ Load students (once, stable [] deps) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
  }, []); // stable â€” no deps

  // â”€â”€ Load food menu for date (stable [] deps, receives date as arg) â”€

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
  }, []); // stable

  // â”€â”€ Load consumption for date + class (stable [] deps) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const loadConsumption = useCallback(async (date, cls) => {
    setConsumptionLoading(true);
    try {
      const data = await foodConsumptionService.getConsumption({ date, class: cls });
      if (!mountedRef.current) return;
      const map = {};
      (Array.isArray(data) ? data : []).forEach(e => {
        const key = `${e.student_id}__${e.meal_type}`;
        map[key]  = {
          quantity:    e.quantity,
          status:      e.status,
          lastUpdated: null, // null = pre-loaded (not a session change)
        };
      });
      setConsumptionMap(map);
    } catch {
      if (!mountedRef.current) return;
      setConsumptionMap({});
    } finally {
      if (mountedRef.current) setConsumptionLoading(false);
    }
  }, []); // stable

  // â”€â”€ Effects â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // Students â€” once on mount
  useEffect(() => { loadStudents(); }, [loadStudents]);

  // Menu â€” whenever date changes; clear old menu while loading
  useEffect(() => {
    setMenuSlots([]);
    setMenuLoading(true);
    loadMenu(selectedDate);
  }, [selectedDate, loadMenu]);

  // Consumption â€” whenever date or class changes
  // Also cancel pending debounced saves (stale date/class)
  useEffect(() => {
    Object.values(debounceRefs.current).forEach(clearTimeout);
    debounceRefs.current = {};
    setConsumptionMap({});
    setConsumptionLoading(true);
    loadConsumption(selectedDate, selectedClass);
  }, [selectedDate, selectedClass, loadConsumption]);

  // â”€â”€ Derived data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const filteredStudents = useMemo(
    () => students.filter(s => s.Class === selectedClass),
    [students, selectedClass]
  );

  // How many filtered students have at least one meal recorded
  const recordedCount = useMemo(() => {
    const sids = new Set(filteredStudents.map(s => s.Student_ID));
    const seen = new Set();
    Object.keys(consumptionMap).forEach(key => {
      const [sid] = key.split("__");
      const entry = consumptionMap[key];
      if (sids.has(sid) && entry.quantity !== null && entry.quantity !== undefined && entry.quantity !== "") {
        seen.add(sid);
      }
    });
    return seen.size;
  }, [consumptionMap, filteredStudents]);

  // Recent entries for the summary section (all recorded, session-changes first)
  const recentEntries = useMemo(() => {
    const studentNameMap = {};
    students.forEach(s => { studentNameMap[s.Student_ID] = s.Student_Name; });

    return Object.entries(consumptionMap)
      .filter(([, v]) => v.quantity !== null && v.quantity !== undefined && v.quantity !== "")
      .map(([key, v]) => {
        const [sid, mealType] = key.split("__");
        const meal = menuSlots.find(m => m.mealType === mealType);
        return {
          key,
          studentId:   sid,
          studentName: studentNameMap[sid] || sid,
          mealType,
          foodItem:    meal?.itemName  || "",
          quantity:    v.quantity,
          unit:        meal?.unitType  || "pcs",
          status:      v.status,
          lastUpdated: v.lastUpdated,
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

  // â”€â”€ Autosave (debounced, append-only) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  function scheduleAutosave(key, payload) {
    // Clear any existing timer for this cell
    if (debounceRefs.current[key]) clearTimeout(debounceRefs.current[key]);

    debounceRefs.current[key] = setTimeout(async () => {
      delete debounceRefs.current[key];
      if (!mountedRef.current) return;

      setSavingCells(prev => { const n = new Set(prev); n.add(key); return n; });

      try {
        await foodConsumptionService.saveConsumption(payload);
        if (!mountedRef.current) return;
        // Show green checkmark briefly
        setSavedCells(prev => { const n = new Set(prev); n.add(key); return n; });
        setTimeout(() => {
          if (!mountedRef.current) return;
          setSavedCells(prev => { const n = new Set(prev); n.delete(key); return n; });
        }, 2000);
      } catch (err) {
        // Silent fail â€” don't toast; teacher UI stays responsive
        console.error("[food-consumption] autosave failed:", err.message);
      } finally {
        if (mountedRef.current) {
          setSavingCells(prev => { const n = new Set(prev); n.delete(key); return n; });
        }
      }
    }, 800);
  }

  function handleQuantityChange(student, meal, newQty) {
    const key    = `${student.Student_ID}__${meal.mealType}`;
    const status = Number(newQty) > 0 ? "Ate" : "Didn't Eat";
    const now    = Date.now();

    // Optimistic update â€” instant UI response
    setConsumptionMap(prev => ({
      ...prev,
      [key]: { quantity: String(newQty), status, lastUpdated: now },
    }));

    // Debounced save (800ms after last tap)
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

  // â”€â”€ Render-state helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // Show full skeleton only on initial load (students not yet fetched)
  const showSkeleton     = studentsLoading;
  // Dim cards while consumption reloads (class/date switch)
  const dimOverlay       = consumptionLoading && !studentsLoading;
  // Show menu skeleton when menu is loading and there's no prior menu data
  const showMenuSkeleton = !studentsLoading && menuLoading && menuSlots.length === 0;

  // â”€â”€ RENDER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  return (
    <div className="flex h-screen bg-gradient-to-br from-[#F8F9FF] via-[#F7F8FC] to-[#FFFDF5] overflow-hidden">
      <Sidebar />

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

        {/* â”€â”€ STICKY HEADER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div className="flex-shrink-0 bg-white/[0.98] backdrop-blur-2xl border-b border-gray-100 shadow-sm z-20">
          <div className="px-6 md:px-10 py-4 md:py-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">

              {/* Title */}
              <div className="flex-shrink-0">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">
                  Yellow Dot Â· Teacher View
                </p>
                <h1 className="text-3xl md:text-4xl font-black text-yd-navy tracking-tight leading-none mt-0.5">
                  Food Consumption
                </h1>
                <p className="text-gray-400 text-sm mt-1 font-medium">
                  Track daily meal intake Â· autosaves instantly
                </p>
              </div>

              {/* Controls */}
              <div className="flex flex-wrap items-center gap-3">

                {/* Recorded stat chip */}
                {!studentsLoading && filteredStudents.length > 0 && (
                  <div className="bg-yd-bg border border-gray-100 rounded-2xl px-4 py-2.5 text-center min-w-[108px]">
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Recorded</p>
                    <p className="text-xl font-black text-yd-navy tabular-nums leading-none mt-0.5">
                      {recordedCount}
                      <span className="text-gray-300 font-medium text-base">
                        /{filteredStudents.length}
                      </span>
                    </p>
                  </div>
                )}

                {/* Date picker */}
                <input
                  type="date"
                  value={selectedDate}
                  max={todayISO()}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="px-4 py-2.5 rounded-2xl border border-gray-200 bg-white
                             text-yd-navy font-semibold text-sm
                             focus:ring-2 focus:ring-[var(--yd-yellow-light)] focus:border-[var(--yd-yellow-light)]
                             outline-none cursor-pointer"
                />

                {/* Class dropdown */}
                <select
                  value={selectedClass}
                  onChange={e => setSelectedClass(e.target.value)}
                  className="px-4 py-2.5 rounded-2xl border border-gray-200 bg-white
                             text-yd-navy font-semibold text-sm min-w-[145px]
                             focus:ring-2 focus:ring-[var(--yd-yellow-light)] focus:border-[var(--yd-yellow-light)]
                             outline-none cursor-pointer"
                >
                  {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* â”€â”€ MAIN SCROLL AREA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div className="flex-1 overflow-auto px-6 md:px-10 py-7 space-y-6">

          {/* â”€â”€ Tracking area â”€â”€ */}
          {showSkeleton || showMenuSkeleton ? (
            <SkeletonCards />
          ) : bootError ? (
            <ErrorState onRetry={loadStudents} />
          ) : menuSlots.length === 0 ? (
            <NoMenuState date={selectedDate} />
          ) : filteredStudents.length === 0 ? (
            <NoStudentsState cls={selectedClass} />
          ) : (
            <div
              className={`space-y-4 transition-opacity duration-200 ${dimOverlay ? "opacity-60 pointer-events-none" : ""}`}
            >
              {filteredStudents.map(student => (
                <StudentCard
                  key={student.Student_ID}
                  student={student}
                  menuSlots={menuSlots}
                  consumptionMap={consumptionMap}
                  savingCells={savingCells}
                  savedCells={savedCells}
                  onQuantityChange={handleQuantityChange}
                />
              ))}
            </div>
          )}

          {/* â”€â”€ Consumption summary section â”€â”€ */}
          {!studentsLoading && !menuLoading && recentEntries.length > 0 && (
            <RecentSection entries={recentEntries} />
          )}

          {/* Bottom spacer for comfortable scrolling */}
          <div className="h-6" />
        </div>
      </div>

      <ToastStack toasts={toast.toasts} onDismiss={toast.dismiss} />
    </div>
  );
}

