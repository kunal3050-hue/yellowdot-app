// ─────────────────────────────────────────────────────────────────
// MenuEntryModal — unified "Enter Menu" + "Edit Menu" modal
//
// Props:
//   mode          "enter" | "edit"
//   initialDate   string (YYYY-MM-DD) — pre-selected date
//   initialMeals  { [mealType]: { itemName, unitType } } | null
//   allMenus      flat array of all saved meal rows (for date-change auto-fill)
//   onSave        (date, mealsArray) => Promise<void>
//   onClose       () => void
// ─────────────────────────────────────────────────────────────────

import { useState, useCallback, useEffect } from "react";
import MealRow from "./MealRow";

export const MEAL_TYPES = [
  { type: "Breakfast",   emoji: "🍳", defaultUnit: "plate" },
  { type: "Mid-Morning", emoji: "🥤", defaultUnit: "pcs"   },
  { type: "Roti Sabzi",  emoji: "🫓", defaultUnit: "plate" },
  { type: "Dal Rice",    emoji: "🍛", defaultUnit: "bowl"  },
  { type: "Milk",        emoji: "🥛", defaultUnit: "cup"   },
  { type: "Snacks",      emoji: "🍪", defaultUnit: "pcs"   },
];

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function maxFutureDate() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split("T")[0];
}

function fmtDateLabel(iso) {
  if (!iso) return "";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

// Build a fresh 6-row meal state from a map of existing data (or null for empty)
function buildMeals(mealMap) {
  return MEAL_TYPES.map(mt => ({
    mealType: mt.type,
    emoji:    mt.emoji,
    itemName: mealMap?.[mt.type]?.itemName || "",
    unitType: mealMap?.[mt.type]?.unitType || mt.defaultUnit,
  }));
}

// Extract a { [mealType]: { itemName, unitType } } map from a flat array for a specific date
function extractMealMap(allMenus, date) {
  if (!allMenus?.length || !date) return null;
  const rows = allMenus.filter(m => m.date === date);
  if (!rows.length) return null;
  const map = {};
  rows.forEach(m => { map[m.mealType] = { itemName: m.itemName, unitType: m.unitType }; });
  return map;
}

export default function MenuEntryModal({ mode, initialDate, initialMeals, allMenus, onSave, onClose }) {
  const [date,      setDate]      = useState(initialDate || todayISO());
  const [meals,     setMeals]     = useState(() => buildMeals(initialMeals));
  const [validated, setValidated] = useState(false);
  const [saving,    setSaving]    = useState(false);

  const isEdit = mode === "edit";

  // In "enter" mode: when the user changes the date, auto-populate from existing saved data
  useEffect(() => {
    if (isEdit) return;  // in edit mode, date is fixed
    const existingMap = extractMealMap(allMenus, date);
    setMeals(buildMeals(existingMap));
    setValidated(false);
  }, [date, isEdit, allMenus]);

  const dateHasMenu = !isEdit && allMenus?.some(m => m.date === date);

  const handleChange = useCallback((index, field, value) => {
    setMeals(prev => prev.map((m, i) => i === index ? { ...m, [field]: value } : m));
  }, []);

  const handleClear = useCallback((index) => {
    setMeals(prev => prev.map((m, i) =>
      i === index
        ? { ...m, itemName: "", unitType: MEAL_TYPES[i].defaultUnit }
        : m
    ));
  }, []);

  const clearAll = () => { setMeals(buildMeals(null)); setValidated(false); };

  const filledCount = meals.filter(m => m.itemName.trim() !== "").length;

  const handleSave = async () => {
    setValidated(true);
    if (filledCount === 0) return;
    setSaving(true);
    try {
      await onSave(date, meals.map(({ mealType, itemName, unitType }) => ({ mealType, itemName, unitType })));
    } finally {
      setSaving(false);
    }
  };

  // Close on backdrop click
  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(31,26,23,0.52)", backdropFilter: "blur(6px)" }}
      onClick={handleBackdrop}
    >
      <div
        className="
          w-full max-w-2xl max-h-[92vh] overflow-hidden
          bg-white rounded-3xl shadow-2xl shadow-[rgba(31,26,23,0.20)]
          flex flex-col
        "
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex-shrink-0 bg-gradient-to-r from-[#1f1a17] via-[#2a221d] to-[#342922] px-7 pt-6 pb-5 relative overflow-hidden">
          {/* ambient glows */}
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-[#f4c430]/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-[#f4c430]/6 rounded-full blur-3xl pointer-events-none" />

          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="text-[#c9a830]/75 text-[10px] font-bold uppercase tracking-[0.2em] mb-1">
                {isEdit ? "Edit Menu" : "Menu Builder"}
              </p>
              <h2 className="text-white font-black text-xl leading-tight">
                {isEdit ? fmtDateLabel(date) : "Enter Daily Menu"}
              </h2>
              {dateHasMenu && (
                <p className="flex items-center gap-1.5 text-[#FFD600]/90 text-xs font-semibold mt-1.5">
                  <span>⚡</span> Menu exists for this date — saving will replace it
                </p>
              )}
            </div>

            {/* Close */}
            <button
              onClick={onClose}
              disabled={saving}
              className="
                flex-shrink-0 w-8 h-8 flex items-center justify-center
                rounded-xl bg-white/10 hover:bg-white/20 text-white/70 hover:text-white
                transition-all duration-150
              "
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M10 3L3 10M3 3L10 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {/* Date picker (only in enter mode) */}
          {!isEdit && (
            <div className="relative mt-4">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a3957e] text-sm pointer-events-none">📅</span>
              <input
                type="date"
                value={date}
                max={maxFutureDate()}
                onChange={e => setDate(e.target.value)}
                className="
                  bg-white rounded-2xl pl-9 pr-4 py-2.5
                  text-[#1f1a17] text-sm font-semibold
                  outline-none border-2 border-transparent focus:border-[#f4c430]/60
                  transition-all cursor-pointer shadow-sm
                "
              />
            </div>
          )}
        </div>

        {/* ── Column labels ── */}
        <div className="flex-shrink-0 hidden sm:grid grid-cols-[auto_1fr_auto_auto] gap-3 px-7 pt-4 pb-1 border-b border-[#f0ebe0]">
          <span className="w-44 text-[10px] font-bold text-[#a3957e] uppercase tracking-widest">Meal Type</span>
          <span className="text-[10px] font-bold text-[#a3957e] uppercase tracking-widest">Food Item</span>
          <span className="w-28 text-[10px] font-bold text-[#a3957e] uppercase tracking-widest">Unit</span>
          <span className="w-8" />
        </div>

        {/* ── Meal rows (scrollable) ── */}
        <div className="flex-1 overflow-y-auto px-7 py-4 space-y-2.5">
          {validated && filledCount === 0 && (
            <div className="flex items-center gap-2.5 p-3.5 bg-[#fee8e2] border border-[#e0a898] rounded-2xl text-sm text-[#7a2018] font-medium">
              <span>⚠️</span> Add at least one food item before saving.
            </div>
          )}

          {meals.map((meal, i) => (
            <MealRow
              key={meal.mealType}
              emoji={meal.emoji}
              mealType={meal.mealType}
              itemName={meal.itemName}
              unitType={meal.unitType}
              hasError={validated && filledCount === 0}
              onChange={(field, value) => handleChange(i, field, value)}
              onClear={() => handleClear(i)}
            />
          ))}
        </div>

        {/* ── Footer ── */}
        <div className="flex-shrink-0 px-7 pb-6 pt-3 border-t border-[#ece7d8]">
          {/* Progress */}
          <div className="flex items-center gap-2 mb-4">
            {meals.map((m, i) => (
              <span
                key={i}
                className={`rounded-full transition-all duration-300 ${
                  m.itemName.trim() !== ""
                    ? "w-2.5 h-2.5 bg-[#f4c430] scale-110"
                    : "w-2 h-2 bg-[#e8dfc8]"
                }`}
              />
            ))}
            <span className="ml-1.5 text-xs text-[#a3957e] font-medium">
              {filledCount} / {MEAL_TYPES.length} meals filled
            </span>
            {filledCount > 0 && (
              <button
                onClick={clearAll}
                className="ml-auto text-xs text-[#a3957e] hover:text-[#c0402a] underline underline-offset-2 transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="flex gap-3">
            {/* Cancel */}
            <button
              onClick={onClose}
              disabled={saving}
              className="
                flex-1 py-3 rounded-2xl border border-[#ece7d8] text-sm font-bold text-[#6f624f]
                hover:bg-[#faf6ea] hover:border-[#d4c8b0] transition-all duration-150
                disabled:opacity-50
              "
            >
              Cancel
            </button>

            {/* Save */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="
                relative flex-[2] overflow-hidden group
                py-3 rounded-2xl text-sm font-black text-[#1f1a17]
                bg-gradient-to-r from-[#FFD600] to-[#FFBE00]
                shadow-md shadow-yellow-200/60
                hover:shadow-lg hover:shadow-yellow-300/50
                active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed
                transition-all duration-200
              "
            >
              {/* shimmer */}
              <span
                aria-hidden
                className="
                  pointer-events-none absolute inset-0
                  bg-gradient-to-r from-transparent via-white/30 to-transparent
                  -translate-x-full group-hover:translate-x-full
                  transition-transform duration-700
                "
              />
              <span className="relative flex items-center justify-center gap-2">
                {saving ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                    </svg>
                    Saving…
                  </>
                ) : (
                  <>{isEdit ? "✓ Save Changes" : "💾 Save Menu"}</>
                )}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
