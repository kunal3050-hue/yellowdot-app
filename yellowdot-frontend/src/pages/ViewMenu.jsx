// ─────────────────────────────────────────────────────────────────
// ViewMenu — /food-menu/view
// Shows all saved menus grouped by date, newest first.
// Each group has Edit + Delete actions.
// ─────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Sidebar from "../components/Sidebar";
import foodMenuService from "../services/foodMenuService";
import EditMenuModal   from "../components/food/EditMenuModal";
import DeleteConfirmModal from "../components/food/DeleteConfirmModal";

// ── Constants ─────────────────────────────────────────────────────

const MEAL_EMOJI = {
  "Breakfast":   "🍳",
  "Mid-Morning": "🥤",
  "Roti Sabzi":  "🫓",
  "Dal Rice":    "🍛",
  "Milk":        "🥛",
  "Snacks":      "🍪",
};

const MEAL_STYLE = {
  "Breakfast":   "bg-orange-50 text-orange-600 border-orange-100",
  "Mid-Morning": "bg-green-50  text-green-600  border-green-100",
  "Roti Sabzi":  "bg-amber-50  text-amber-600  border-amber-100",
  "Dal Rice":    "bg-yellow-50 text-yellow-700 border-yellow-100",
  "Milk":        "bg-sky-50    text-sky-600    border-sky-100",
  "Snacks":      "bg-violet-50 text-violet-600 border-violet-100",
};

const BRANCHES = ["All", "Main", "Branch A", "Branch B", "Branch C"];

// ── Helpers ───────────────────────────────────────────────────────

function formatDateLabel(dateStr) {
  if (!dateStr) return dateStr;
  const [y, m, d] = dateStr.split("-");
  if (!y || !m || !d) return dateStr;
  return new Date(Number(y), Number(m) - 1, Number(d))
    .toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function isToday(dateStr) {
  return dateStr === new Date().toISOString().slice(0, 10);
}

function isYesterday(dateStr) {
  const y = new Date(); y.setDate(y.getDate() - 1);
  return dateStr === y.toISOString().slice(0, 10);
}

// ── Toast ─────────────────────────────────────────────────────────

function useToast() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((msg, type = "success") => {
    const id = Date.now();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);
  return { toasts, add };
}

function ToastStack({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2.5 items-end">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`
            flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-sm font-semibold
            animate-toast-in
            ${t.type === "error"
              ? "bg-rose-600 text-white shadow-rose-200/60"
              : "bg-yd-navy text-white shadow-yd-navy/20"
            }
          `}
        >
          <span>{t.type === "error" ? "⚠️" : "✅"}</span>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

// ── Menu group card ───────────────────────────────────────────────

function MenuGroup({ group, onEdit, onDelete }) {
  const today     = isToday(group.date);
  const yesterday = isYesterday(group.date);
  const badge     = today ? "TODAY" : yesterday ? "Yesterday" : null;

  return (
    <div
      className={`
        rounded-3xl border overflow-hidden transition-all duration-200
        hover:shadow-lg group
        ${today
          ? "bg-gradient-to-br from-yd-navy to-yd-navy-2 border-yd-navy/40 shadow-md shadow-yd-navy/20"
          : "bg-white border-gray-100 shadow-sm hover:border-gray-200"
        }
      `}
    >
      {/* ── Card header ── */}
      <div className={`px-6 py-4 flex items-center justify-between gap-4 border-b ${today ? "border-white/10" : "border-gray-100"}`}>
        <div className="flex items-center gap-3 min-w-0">
          {badge && (
            <span className={`
              px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest flex-shrink-0
              ${today ? "bg-yd-yellow text-yd-navy" : "bg-gray-100 text-gray-500"}
            `}>
              {badge}
            </span>
          )}
          <div className="min-w-0">
            <p className={`font-black text-base leading-tight truncate ${today ? "text-white" : "text-yd-navy"}`}>
              {formatDateLabel(group.date)}
            </p>
            <p className={`text-xs font-medium mt-0.5 ${today ? "text-white/50" : "text-gray-400"}`}>
              {group.meals.length} meal item{group.meals.length !== 1 ? "s" : ""}
              {group.branch && group.branch !== "Main" && (
                <span className="ml-2 px-2 py-0.5 rounded-lg bg-white/10 text-white/60 text-[10px] font-bold">
                  {group.branch}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => onEdit(group)}
            className={`
              flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold
              transition-all duration-150
              ${today
                ? "bg-white/10 text-white/80 hover:bg-yd-yellow hover:text-yd-navy"
                : "bg-gray-50 text-gray-600 hover:bg-yd-yellow hover:text-yd-navy border border-gray-200 hover:border-yd-yellow"
              }
            `}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Edit
          </button>

          <button
            onClick={() => onDelete(group)}
            className={`
              flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold
              transition-all duration-150
              ${today
                ? "bg-white/10 text-white/80 hover:bg-rose-500 hover:text-white"
                : "bg-gray-50 text-gray-500 hover:bg-rose-50 hover:text-rose-600 border border-gray-200 hover:border-rose-200"
              }
            `}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Delete
          </button>
        </div>
      </div>

      {/* ── Meal list ── */}
      <div className={`px-6 py-4 grid sm:grid-cols-2 gap-2 ${today ? "" : ""}`}>
        {group.meals.map((meal, i) => (
          <div
            key={i}
            className={`
              flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl
              ${today ? "bg-white/8 border border-white/10" : "bg-[#FAFBFF] border border-gray-100"}
            `}
          >
            <span className="text-lg leading-none flex-shrink-0">
              {MEAL_EMOJI[meal.mealType] || "🍽️"}
            </span>
            <div className="min-w-0 flex-1">
              <span className={`
                inline-block px-2 py-0.5 rounded-lg border text-[10px] font-bold mb-0.5
                ${today
                  ? "bg-white/10 text-white/60 border-white/10"
                  : (MEAL_STYLE[meal.mealType] || "bg-gray-50 text-gray-500 border-gray-100")
                }
              `}>
                {meal.mealType}
              </span>
              <p className={`text-sm font-semibold truncate ${today ? "text-white/90" : "text-gray-700"}`}>
                {meal.itemName}
              </p>
            </div>
            <span className={`text-[10px] font-bold flex-shrink-0 px-2 py-1 rounded-lg ${today ? "bg-white/10 text-white/50" : "bg-gray-100 text-gray-400"}`}>
              {meal.unitType}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-white rounded-3xl border border-gray-100 overflow-hidden animate-pulse">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-4 w-40 bg-gray-100 rounded-xl" />
              <div className="h-3 w-24 bg-gray-100 rounded-xl" />
            </div>
            <div className="flex gap-2">
              <div className="h-8 w-16 bg-gray-100 rounded-xl" />
              <div className="h-8 w-16 bg-gray-100 rounded-xl" />
            </div>
          </div>
          <div className="px-6 py-4 grid sm:grid-cols-2 gap-2">
            {[1, 2, 3, 4].map(j => (
              <div key={j} className="h-14 bg-gray-50 rounded-2xl" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────

function EmptyState({ branch, onEnterMenu }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-20 h-20 rounded-3xl bg-[#FFF7CC] flex items-center justify-center text-4xl mb-6 shadow-sm">
        🍽️
      </div>
      <h3 className="text-xl font-black text-yd-navy mb-2">
        {branch && branch !== "All" ? `No menus for ${branch}` : "No menus yet"}
      </h3>
      <p className="text-sm text-gray-400 mb-6 max-w-xs">
        Start adding daily menus and they'll appear here.
      </p>
      <button
        onClick={onEnterMenu}
        className="
          px-6 py-3 rounded-2xl text-sm font-bold text-yd-navy
          bg-yd-yellow hover:bg-yd-yellow-hover shadow-md shadow-yellow-200/60
          hover:shadow-lg transition-all duration-150
        "
      >
        ✏️ Enter a Menu
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────

export default function ViewMenu() {
  const [menus,    setMenus]   = useState([]);
  const [loading,  setLoading] = useState(true);
  const [branch,   setBranch]  = useState("All");

  const [editTarget,   setEditTarget]   = useState(null);   // group being edited
  const [deleteTarget, setDeleteTarget] = useState(null);   // group being deleted

  const { toasts, add: addToast } = useToast();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const loadMenus = useCallback(async () => {
    setLoading(true);
    try {
      const data = await foodMenuService.getMenus();
      if (!mountedRef.current) return;
      setMenus(data || []);
    } catch (err) {
      if (!mountedRef.current) return;
      addToast("Failed to load menus: " + err.message, "error");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { loadMenus(); }, [loadMenus]);

  // Group flat meals by date → newest first
  const groupedMenus = useMemo(() => {
    const filtered = branch === "All" ? menus : menus.filter(m => m.branch === branch);

    const map = {};
    filtered.forEach(meal => {
      if (!map[meal.date]) {
        map[meal.date] = { date: meal.date, branch: meal.branch, meals: [] };
      }
      map[meal.date].meals.push(meal);
    });

    return Object.values(map).sort((a, b) => b.date.localeCompare(a.date));
  }, [menus, branch]);

  // ── Edit handler ──

  const handleEdit = useCallback((group) => setEditTarget(group), []);

  const handleEditSave = useCallback(async (updatedData) => {
    try {
      await foodMenuService.updateMenu(editTarget.date, updatedData);
      addToast(`Menu for ${editTarget.date} updated ✓`);
      setEditTarget(null);
      await loadMenus();
    } catch (err) {
      addToast("Update failed: " + err.message, "error");
      throw err; // keep modal open
    }
  }, [editTarget, addToast, loadMenus]);

  // ── Delete handler ──

  const handleDelete = useCallback((group) => setDeleteTarget(group), []);

  const handleDeleteConfirm = useCallback(async () => {
    try {
      await foodMenuService.deleteMenu(deleteTarget.date);
      addToast(`Menu for ${deleteTarget.date} deleted`);
      setDeleteTarget(null);
      await loadMenus();
    } catch (err) {
      addToast("Delete failed: " + err.message, "error");
      throw err; // keep modal open
    }
  }, [deleteTarget, addToast, loadMenus]);

  // ── Navigate to Enter Menu ──

  const handleEnterMenu = () => { window.location.href = "/food-menu"; };

  return (
    <div className="flex h-screen bg-gradient-to-br from-[#F7F8FC] to-[#EEF0F8] overflow-hidden">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">

          {/* ── Page header ── */}
          <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-black text-yd-navy leading-tight">View Menus</h1>
              <p className="text-gray-400 font-medium mt-1.5">
                All saved menus · newest first
              </p>
            </div>

            <button
              onClick={handleEnterMenu}
              className="
                flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold
                text-yd-navy bg-yd-yellow shadow-md shadow-yellow-200/60
                hover:bg-yd-yellow-hover hover:shadow-lg transition-all duration-150
              "
            >
              ✏️ Enter Menu
            </button>
          </div>

          {/* ── Branch filter ── */}
          <div className="flex gap-2 flex-wrap mb-6">
            {BRANCHES.map(b => (
              <button
                key={b}
                onClick={() => setBranch(b)}
                className={`
                  px-4 py-2 rounded-2xl text-xs font-bold border transition-all duration-150
                  ${branch === b
                    ? "bg-yd-navy text-white border-yd-navy shadow-sm"
                    : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }
                `}
              >
                {b}
              </button>
            ))}
          </div>

          {/* ── Stats row ── */}
          {!loading && groupedMenus.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
              {[
                { label: "Total Days",  value: groupedMenus.length,                            icon: "📅" },
                { label: "Total Meals", value: groupedMenus.reduce((s, g) => s + g.meals.length, 0), icon: "🍽️" },
                { label: "This Week",   value: groupedMenus.filter(g => {
                    const d = new Date(g.date), now = new Date();
                    const diff = (now - d) / 86400000;
                    return diff >= 0 && diff < 7;
                  }).length, icon: "📆" },
              ].map(stat => (
                <div key={stat.label} className="bg-white rounded-2xl border border-gray-100 px-4 py-3 text-center shadow-sm">
                  <div className="text-xl mb-0.5">{stat.icon}</div>
                  <div className="text-2xl font-black text-yd-navy">{stat.value}</div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{stat.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* ── Content ── */}
          {loading ? (
            <Skeleton />
          ) : groupedMenus.length === 0 ? (
            <EmptyState branch={branch} onEnterMenu={handleEnterMenu} />
          ) : (
            <div className="space-y-4">
              {groupedMenus.map(group => (
                <MenuGroup
                  key={group.date}
                  group={group}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ── Modals ── */}
      {editTarget && (
        <EditMenuModal
          menu={editTarget}
          onSave={handleEditSave}
          onClose={() => setEditTarget(null)}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          date={deleteTarget.date}
          mealCount={deleteTarget.meals.length}
          onConfirm={handleDeleteConfirm}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      <ToastStack toasts={toasts} />
    </div>
  );
}
