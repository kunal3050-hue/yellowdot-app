// ─────────────────────────────────────────────────────────────────
// EditMenuModal — pre-filled editable modal for a saved menu date
//
// Props:
//   menu     { date, branch, meals: [{ mealType, itemName, unitType }] }
//   onSave   (updatedData) => Promise<void>
//   onClose  () => void
// ─────────────────────────────────────────────────────────────────

import { useState, useCallback } from "react";
import MealRow, { UNITS } from "./MealRow";

const MEAL_TYPES = [
  { mealType: "Breakfast",   emoji: "🍳", defaultUnit: "pcs"  },
  { mealType: "Mid-Morning", emoji: "🥤", defaultUnit: "pcs"  },
  { mealType: "Roti Sabzi",  emoji: "🫓", defaultUnit: "pcs"  },
  { mealType: "Dal Rice",    emoji: "🍛", defaultUnit: "bowl" },
  { mealType: "Milk",        emoji: "🥛", defaultUnit: "cup"  },
  { mealType: "Snacks",      emoji: "🍪", defaultUnit: "pcs"  },
];

const BRANCHES = ["Main", "Branch A", "Branch B", "Branch C"];

function buildInitialMeals(savedMeals) {
  return MEAL_TYPES.map(mt => {
    const saved = (savedMeals || []).find(m => m.mealType === mt.mealType);
    return {
      mealType: mt.mealType,
      emoji:    mt.emoji,
      itemName: saved?.itemName || "",
      unitType: saved?.unitType || mt.defaultUnit,
    };
  });
}

function formatDateLabel(dateStr) {
  if (!dateStr) return dateStr;
  const [y, m, d] = dateStr.split("-");
  if (!y || !m || !d) return dateStr;
  return new Date(Number(y), Number(m) - 1, Number(d))
    .toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export default function EditMenuModal({ menu, onSave, onClose }) {
  const [branch, setBranch]   = useState(menu?.branch || "Main");
  const [meals,  setMeals]    = useState(() => buildInitialMeals(menu?.meals));
  const [saving, setSaving]   = useState(false);
  const [validated, setValidated] = useState(false);

  const handleChange = useCallback((index, field, value) => {
    setMeals(prev => prev.map((m, i) => i === index ? { ...m, [field]: value } : m));
  }, []);

  const handleClear = useCallback((index) => {
    setMeals(prev => prev.map((m, i) =>
      i === index ? { ...m, itemName: "", unitType: MEAL_TYPES[i].defaultUnit } : m
    ));
  }, []);

  const handleSave = async () => {
    setValidated(true);
    const valid = meals.filter(m => m.itemName.trim() !== "");
    if (valid.length === 0) return;

    setSaving(true);
    try {
      await onSave({
        branch,
        meals: valid.map(({ mealType, itemName, unitType }) => ({ mealType, itemName, unitType })),
      });
    } finally {
      setSaving(false);
    }
  };

  const filledCount = meals.filter(m => m.itemName.trim() !== "").length;

  return (
    /* ── Backdrop ── */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(4,17,75,0.45)", backdropFilter: "blur(6px)" }}
    >
      {/* ── Panel ── */}
      <div
        className="
          relative w-full max-w-2xl max-h-[92vh] overflow-y-auto
          bg-white rounded-3xl shadow-2xl shadow-[#04114B]/20
          flex flex-col
        "
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm px-7 pt-7 pb-5 border-b border-gray-100 rounded-t-3xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <span className="text-2xl">✏️</span>
                <h2 className="text-xl font-black text-[#04114B]">Edit Menu</h2>
              </div>
              <p className="text-sm text-gray-500 font-medium pl-9">
                {formatDateLabel(menu?.date)}
              </p>
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              disabled={saving}
              className="
                flex-shrink-0 w-9 h-9 flex items-center justify-center
                rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100
                transition-all duration-150
              "
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M12 3L3 12M3 3L12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {/* Branch selector */}
          <div className="mt-4 flex items-center gap-3">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Branch</span>
            <div className="flex gap-2 flex-wrap">
              {BRANCHES.map(b => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBranch(b)}
                  className={`
                    px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all duration-150
                    ${branch === b
                      ? "bg-[#FFD600] text-[#04114B] border-[#FFD600] shadow-sm"
                      : "bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300 hover:bg-gray-100"
                    }
                  `}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Meal rows ── */}
        <div className="px-7 py-5 space-y-2.5 flex-1">
          {validated && filledCount === 0 && (
            <div className="flex items-center gap-2.5 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-sm text-rose-600 font-medium mb-1">
              <span>⚠️</span> At least one meal must have a food item.
            </div>
          )}

          {meals.map((meal, i) => (
            <MealRow
              key={meal.mealType}
              emoji={meal.emoji}
              mealType={meal.mealType}
              itemName={meal.itemName}
              unitType={meal.unitType}
              hasError={validated}
              onChange={(field, value) => handleChange(i, field, value)}
              onClear={() => handleClear(i)}
            />
          ))}
        </div>

        {/* ── Footer ── */}
        <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm px-7 pb-7 pt-4 border-t border-gray-100 rounded-b-3xl">
          {/* Progress dots */}
          <div className="flex items-center gap-1.5 mb-4">
            {meals.map((m, i) => (
              <div
                key={i}
                className={`
                  rounded-full transition-all duration-300
                  ${m.itemName.trim() !== ""
                    ? "w-2.5 h-2.5 bg-[#FFD600] scale-110"
                    : "w-2 h-2 bg-gray-200"
                  }
                `}
              />
            ))}
            <span className="ml-2 text-xs text-gray-400 font-medium">
              {filledCount} / {meals.length} meals filled
            </span>
          </div>

          <div className="flex gap-3">
            {/* Cancel */}
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="
                flex-1 py-3 rounded-2xl border border-gray-200 text-sm font-bold text-gray-600
                hover:bg-gray-50 hover:border-gray-300 transition-all duration-150
                disabled:opacity-50
              "
            >
              Cancel
            </button>

            {/* Save */}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="
                relative flex-[2] overflow-hidden group
                py-3 rounded-2xl text-sm font-black text-[#04114B]
                bg-gradient-to-r from-[#FFD600] to-[#FFEB47]
                shadow-md shadow-yellow-200/60
                hover:shadow-lg hover:shadow-yellow-300/50
                disabled:opacity-60 disabled:cursor-not-allowed
                transition-all duration-200
              "
            >
              {/* shimmer */}
              <span
                aria-hidden
                className="
                  pointer-events-none absolute inset-0
                  bg-gradient-to-r from-transparent via-white/40 to-transparent
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
                  <>✓ Save Changes</>
                )}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
