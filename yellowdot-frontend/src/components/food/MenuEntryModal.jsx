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
        {/* ── Header — warm gold gradient, light & airy ── */}
        <div className="flex-shrink-0 px-7 pt-6 pb-5 border-b border-[#e8d898] relative overflow-hidden"
          style={{ background: "linear-gradient(160deg, #fff7d6 0%, #f8ebbf 50%, #f5e4a8 100%)" }}>
          <div className="absolute inset-0 bg-white/25 pointer-events-none" />
          <div className="absolute -top-10 -right-10 w-36 h-36 bg-[#f4c430]/12 rounded-full blur-3xl pointer-events-none" />

          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="text-[#9a7a18] text-[10px] font-semibold tracking-[0.18em] mb-1">
                {isEdit ? "Edit Menu" : "Menu Builder"}
              </p>
              <h2 className="text-[#3a2a08] font-bold text-xl leading-tight">
                {isEdit ? fmtDateLabel(date) : "Enter Daily Menu"}
              </h2>
              {dateHasMenu && (
                <p className="flex items-center gap-1.5 text-[#8b6a18] text-xs font-medium mt-1.5">
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
                rounded-xl bg-[#f0d880]/40 hover:bg-[#f0d880]/80 text-[#8b6a18]
                transition-all duration-[190ms]
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
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9a7a18] text-sm pointer-events-none select-none">📅</span>
              <input
                type="date"
                value={date}
                max={maxFutureDate()}
                onChange={e => setDate(e.target.value)}
                className="
                  bg-white/80 rounded-xl pl-9 pr-4 py-2
                  text-[#3a2a08] text-sm font-medium
                  outline-none border border-[#e8d898] focus:border-[#c9a830] focus:bg-white
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
                relative flex-[2] overflow-hidden
                py-3 rounded-xl text-sm font-semibold text-[#5a4010]
                active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed
                transition-all duration-[190ms]
              "
              style={{
                background: "linear-gradient(160deg, #f9dc5a 0%, #f0c930 100%)",
                boxShadow: "0 4px 14px rgba(212,170,31,0.30), inset 0 1px 0 rgba(255,255,255,0.45)",
              }}
            >
              {/* shimmer */}
              <span
                aria-hidden
                className="
                  pointer-events-none absolute inset-0
                  bg-gradient-to-r from-transparent via-white/25 to-transparent
                  -translate-x-full hover:translate-x-full
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
                  <>{isEdit ? "✓ Save Changes" : "Save Menu"}</>
                )}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
