// ─────────────────────────────────────────────────────────────────
// MealRow — single row in the Food Menu builder
// Props:
//   emoji      string   meal emoji for display
//   mealType   string   readonly label
//   itemName   string   controlled food item text
//   unitType   string   controlled unit selection
//   hasError   bool     highlight if form was submitted empty
//   onChange   (field, value) => void
//   onClear    () => void
// ─────────────────────────────────────────────────────────────────

export const UNITS = ["pcs", "bowl", "cup", "glass", "plate", "packet"];

// Per-meal colour tokens — pill label + left accent
const MEAL_STYLE = {
  "Breakfast":   { pill: "bg-orange-50 text-orange-600 border-orange-100", accent: "border-l-orange-300" },
  "Mid-Morning": { pill: "bg-green-50  text-green-600  border-green-100",  accent: "border-l-green-300"  },
  "Roti Sabzi":  { pill: "bg-amber-50  text-amber-600  border-amber-100",  accent: "border-l-amber-300"  },
  "Dal Rice":    { pill: "bg-yellow-50 text-yellow-700 border-yellow-100", accent: "border-l-yellow-300" },
  "Milk":        { pill: "bg-sky-50    text-sky-600    border-sky-100",    accent: "border-l-sky-300"    },
  "Snacks":      { pill: "bg-violet-50 text-violet-600 border-violet-100", accent: "border-l-violet-300" },
};

export default function MealRow({ emoji, mealType, itemName, unitType, hasError, onChange, onClear }) {
  const style      = MEAL_STYLE[mealType] ?? { pill: "bg-gray-50 text-gray-600 border-gray-100", accent: "border-l-gray-300" };
  const isFilled   = itemName && itemName.trim() !== "";
  const showError  = hasError && !isFilled;

  return (
    <div
      className={`
        group flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3
        p-3.5 sm:p-4 rounded-2xl border-l-[3px] border border-gray-100
        transition-all duration-200
        ${style.accent}
        ${showError  ? "bg-rose-50/70  border-rose-200"              : ""}
        ${!showError ? "bg-[#FAFBFF] hover:bg-white hover:shadow-sm hover:border-gray-200" : ""}
      `}
    >
      {/* ── Meal type label ── */}
      <div className="flex items-center gap-2.5 sm:w-44 flex-shrink-0">
        <span className="text-[22px] leading-none select-none">{emoji}</span>
        <span className={`inline-flex items-center px-2.5 py-1 rounded-xl border text-[11px] font-bold tracking-wide whitespace-nowrap ${style.pill}`}>
          {mealType}
        </span>
      </div>

      {/* ── Food item input ── */}
      <input
        type="text"
        value={itemName}
        onChange={e => onChange("itemName", e.target.value)}
        placeholder={`Enter ${mealType.toLowerCase()} item…`}
        className={`
          flex-1 min-w-0 bg-white rounded-xl px-4 py-2.5 text-sm text-gray-700
          placeholder-gray-300 outline-none border transition-all duration-150
          focus:ring-2 focus:ring-[#FFD600]/40 focus:border-[#FFD600]/50
          ${showError ? "border-rose-300 bg-rose-50/40" : "border-gray-200"}
        `}
      />

      {/* ── Unit selector ── */}
      <div className="relative flex-shrink-0">
        <select
          value={unitType}
          onChange={e => onChange("unitType", e.target.value)}
          className="sm:w-28 w-full appearance-none bg-white border border-gray-200 rounded-xl
                     pl-3.5 pr-8 py-2.5 text-sm text-gray-600 font-medium outline-none
                     focus:ring-2 focus:ring-[#FFD600]/40 focus:border-[#FFD600]/50
                     transition-all cursor-pointer"
        >
          {UNITS.map(u => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
        {/* dropdown chevron */}
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]">▼</span>
      </div>

      {/* ── Clear button ── */}
      <button
        type="button"
        onClick={onClear}
        disabled={!isFilled}
        title="Clear this row"
        className="
          flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl
          text-gray-300 hover:text-rose-400 hover:bg-rose-50
          disabled:opacity-25 disabled:cursor-not-allowed
          transition-all duration-150
        "
      >
        {/* × icon */}
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <path d="M10 3L3 10M3 3L10 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
}
