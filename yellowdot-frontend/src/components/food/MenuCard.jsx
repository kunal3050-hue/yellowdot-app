// ─────────────────────────────────────────────────────────────────
// MenuCard — displays a saved menu for one date
// Props:
//   date    string   ISO date (YYYY-MM-DD)
//   meals   array    [{ mealType, itemName, unitType, branch }]
//   branch  string
// ─────────────────────────────────────────────────────────────────

const MEAL_EMOJI = {
  "Breakfast":   "🍳",
  "Mid-Morning": "🍎",
  "Roti Sabzi":  "🫓",
  "Dal Rice":    "🍲",
  "Milk":        "🥛",
  "Snacks":      "🍿",
};

const MEAL_PILL = {
  "Breakfast":   "bg-orange-50 text-orange-600",
  "Mid-Morning": "bg-green-50  text-green-600",
  "Roti Sabzi":  "bg-amber-50  text-amber-600",
  "Dal Rice":    "bg-yellow-50 text-yellow-700",
  "Milk":        "bg-sky-50    text-sky-600",
  "Snacks":      "bg-violet-50 text-violet-600",
};

// ── Date helpers ──────────────────────────────────────────────────

function todayISO() { return new Date().toISOString().split("T")[0]; }
function yesterdayISO() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}
function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "long", day: "2-digit", month: "short", year: "numeric",
  });
}
function shortDate(iso) {
  if (!iso) return "";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", {
    day: "2-digit", month: "short",
  });
}

export default function MenuCard({ date, meals, branch }) {
  const isToday     = date === todayISO();
  const isYesterday = date === yesterdayISO();
  const badge       = isToday ? "Today" : isYesterday ? "Yesterday" : null;

  return (
    <div
      className={`
        rounded-[24px] overflow-hidden border transition-all duration-300
        hover:-translate-y-0.5 hover:shadow-lg
        ${isToday
          ? "bg-gradient-to-br from-[#04114B] to-[#0d2580] border-[#0d2580]/50 shadow-xl shadow-blue-900/25"
          : "bg-white border-gray-100 shadow-sm"
        }
      `}
    >
      {/* ── Card header ── */}
      <div className={`px-5 pt-4 pb-3.5 border-b ${isToday ? "border-white/10" : "border-gray-50"}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {badge && (
              <span className={`
                inline-block text-[9px] font-black uppercase tracking-[0.2em]
                px-2.5 py-0.5 rounded-full mb-1.5
                ${isToday ? "bg-[#FFD600] text-[#04114B]" : "bg-white text-gray-500"}
              `}>
                {badge}
              </span>
            )}
            <p className={`font-black text-sm leading-snug truncate ${isToday ? "text-white" : "text-[#04114B]"}`}>
              {fmtDate(date)}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-xl ${
              isToday ? "bg-white/10 text-blue-200" : "bg-white text-gray-500 border border-gray-100"
            }`}>
              {branch || "Main"}
            </span>
            <span className={`text-[10px] font-bold tabular-nums px-2 py-1 rounded-xl ${
              isToday ? "bg-white/10 text-blue-300" : "bg-white text-gray-400"
            }`}>
              {meals.length} meal{meals.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* ── Meal rows ── */}
      <div className="px-5 py-2">
        {meals.length === 0 ? (
          <p className={`text-sm py-4 ${isToday ? "text-white/30" : "text-gray-300"}`}>
            No meals recorded
          </p>
        ) : (
          meals.map((meal, i) => (
            <div
              key={i}
              className={`
                flex items-center gap-3 py-2.5
                ${i < meals.length - 1
                  ? (isToday ? "border-b border-white/[0.06]" : "border-b border-gray-50")
                  : ""}
              `}
            >
              {/* emoji */}
              <span className="text-[18px] leading-none select-none flex-shrink-0 w-6 text-center">
                {MEAL_EMOJI[meal.mealType] || "🍽️"}
              </span>

              {/* type label */}
              <span className={`text-[10px] font-bold w-[88px] flex-shrink-0 truncate ${
                isToday ? "text-blue-300/70" : "text-gray-400"
              }`}>
                {meal.mealType}
              </span>

              {/* item name */}
              <span className={`flex-1 text-sm font-semibold truncate ${
                isToday ? "text-white" : "text-[#04114B]"
              }`}>
                {meal.itemName}
              </span>

              {/* unit badge */}
              <span className={`
                text-[10px] font-bold px-2 py-0.5 rounded-lg flex-shrink-0
                ${isToday
                  ? "bg-white/10 text-blue-200"
                  : (MEAL_PILL[meal.mealType] ?? "bg-gray-50 text-gray-500")
                }
              `}>
                {meal.unitType}
              </span>
            </div>
          ))
        )}
      </div>

      {/* ── Footer ── */}
      <div className={`px-5 py-2.5 border-t ${isToday ? "border-white/[0.06]" : "border-gray-50"}`}>
        <p className={`text-[10px] font-medium ${isToday ? "text-blue-400/50" : "text-gray-300"}`}>
          {shortDate(date)} · {meals[0]?.createdAt || ""}
        </p>
      </div>
    </div>
  );
}
