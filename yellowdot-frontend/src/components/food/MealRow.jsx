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

// Per-meal colour tokens — all warm gold tonal family only
const MEAL_STYLE = {
  "Breakfast":   { pill: "bg-[#f5e8b8] text-[#7a5e18] border-[#e8d49a]", accent: "border-l-[#c9a830]" },
  "Mid-Morning": { pill: "bg-[#f8f0d4] text-[#8b7228] border-[#e8daa0]", accent: "border-l-[#d4aa1f]" },
  "Roti Sabzi":  { pill: "bg-[#f5e8b8] text-[#7a5e18] border-[#e8d49a]", accent: "border-l-[#c9a830]" },
  "Dal Rice":    { pill: "bg-[#faf5e4] text-[#8b7228] border-[#ece0b4]", accent: "border-l-[#d4b830]" },
  "Milk":        { pill: "bg-[#faf5e4] text-[#9a8248] border-[#ece0b4]", accent: "border-l-[#c8a028]" },
  "Snacks":      { pill: "bg-[#f8f0d4] text-[#7a5e18] border-[#e8daa0]", accent: "border-l-[#c9a030]" },
};

export default function MealRow({ emoji, mealType, itemName, unitType, hasError, onChange, onClear }) {
  const style      = MEAL_STYLE[mealType] ?? { pill: "bg-gray-50 text-gray-600 border-gray-100", accent: "border-l-gray-300" };
  const isFilled   = itemName && itemName.trim() !== "";
  const showError  = hasError && !isFilled;

  return (
    <div
      className={`
        group flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3
        p-3.5 sm:p-4 rounded-2xl border-l-[3px] border border-[#ece7d8]
        transition-all duration-200
        ${style.accent}
        ${showError  ? "bg-[#fee8e2]/70 border-[#e0a898]"             : ""}
        ${!showError ? "bg-[#fffdf8] hover:bg-white hover:shadow-sm hover:border-[#e8d898]" : ""}
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
          flex-1 min-w-0 bg-white rounded-xl px-4 py-2.5 text-sm text-[#4a3f2a]
          placeholder-[#c4b090] outline-none border transition-all duration-150
          focus:ring-2 focus:ring-[#f4c430]/35 focus:border-[#c9a830]/60
          ${showError ? "border-[#e0a898] bg-[#fee8e2]/30" : "border-[#ece7d8]"}
        `}
      />

      {/* ── Unit selector ── */}
      <div className="relative flex-shrink-0">
        <select
          value={unitType}
          onChange={e => onChange("unitType", e.target.value)}
          className="sm:w-28 w-full appearance-none bg-white border border-[#ece7d8] rounded-xl
                     pl-3.5 pr-8 py-2.5 text-sm text-[#5a4010] font-medium outline-none
                     focus:ring-2 focus:ring-[#f4c430]/35 focus:border-[#c9a830]/60
                     transition-all cursor-pointer"
        >
          {UNITS.map(u => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
        {/* dropdown chevron */}
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#c9a830] text-[10px]">▼</span>
      </div>

      {/* ── Clear button ── */}
      <button
        type="button"
        onClick={onClear}
        disabled={!isFilled}
        title="Clear this row"
        className="
          flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl
          text-[#d4c8b0] hover:text-[#c0402a] hover:bg-[#fee8e2]
          disabled:opacity-25 disabled:cursor-not-allowed
          transition-all duration-[190ms]
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
