// ─────────────────────────────────────────────────────────────────
// FoodMenu — /food-menu
//
// Layout:
//   • Sticky header (title + stats + Enter Menu button)
//   • Premium table — last 30 days, newest first
//     Columns: Date | 6 meal types | Actions (Edit · Delete)
//     Each row always shows all 6 columns (empty = "—")
//   • MenuEntryModal for enter/edit
//   • DeleteConfirmModal for delete
// ─────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Sidebar           from "../components/Sidebar";
import MenuEntryModal, { MEAL_TYPES } from "../components/food/MenuEntryModal";
import DeleteConfirmModal from "../components/food/DeleteConfirmModal";
import foodMenuService    from "../services/foodMenuService";
import { useAuth }        from "../contexts/AuthContext";

// ── Helpers ───────────────────────────────────────────────────────

function todayISO() { return new Date().toISOString().split("T")[0]; }

function cutoffISO() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split("T")[0];
}

function fmtTableDate(iso) {
  if (!iso) return iso;
  return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "short", day: "2-digit", month: "short",
  });
}

function isToday(iso)     { return iso === todayISO(); }
function isYesterday(iso) {
  const y = new Date(); y.setDate(y.getDate() - 1);
  return iso === y.toISOString().split("T")[0];
}

// ── Toast hook ────────────────────────────────────────────────────

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

// ── Toast stack ───────────────────────────────────────────────────

function ToastStack({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-0 left-0 right-0 sm:bottom-6 sm:left-auto sm:right-6 z-[100] flex flex-col gap-2 sm:gap-3 p-4 sm:p-0 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`
            flex items-center gap-3 px-4 py-3.5 sm:px-5 sm:py-4 rounded-2xl shadow-2xl
            text-sm font-semibold w-full sm:min-w-[280px] sm:max-w-sm
            pointer-events-auto animate-toast-in
            ${t.type === "success" ? "bg-[#1f1a17] text-white" : "bg-[#c0402a] text-white"}
          `}
        >
          <span className="text-xl flex-shrink-0 leading-none select-none">
            {t.type === "success" ? "✨" : "⚠️"}
          </span>
          <span className="flex-1 leading-snug">{t.message}</span>
          <button
            onClick={() => onDismiss(t.id)}
            className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 transition-all text-white/80 hover:text-white font-bold"
          >×</button>
        </div>
      ))}
    </div>
  );
}

// ── Skeleton row ──────────────────────────────────────────────────

function SkeletonTable() {
  return (
    <div className="animate-pulse">
      {[0, 1, 2, 3].map(i => (
        <div
          key={i}
          className="flex items-center gap-4 px-6 py-4 border-b border-[#f0ebe0]"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <div className="w-28 h-3 bg-[#f0e8d4] rounded-full" />
          {MEAL_TYPES.map(mt => (
            <div key={mt.type} className="flex-1 h-3 bg-[#f0e8d4] rounded-full" />
          ))}
          <div className="w-20 h-7 bg-[#f0e8d4] rounded-xl" />
        </div>
      ))}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────

function EmptyState({ onEnter }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="relative w-20 h-20 flex items-center justify-center mb-5 select-none">
        <div className="absolute inset-0 rounded-full bg-[#fff8e2]" />
        <div className="absolute inset-3 rounded-full bg-[#fff4c2]/70" />
        <span className="text-3xl relative z-10">🍽️</span>
      </div>
      <p className="text-lg font-bold text-[#2a221d]">No Menus Yet</p>
      <p className="text-[#8b7d65] mt-1.5 text-sm max-w-[260px] leading-relaxed">
        Start adding daily menus — they'll appear here.
      </p>
      <button
        onClick={onEnter}
        className="mt-5 px-6 py-2.5 bg-[#fff4c2] hover:bg-[#ffeea0] text-[#1f1a17] font-bold text-sm rounded-2xl transition-all active:scale-95 shadow-[0_2px_8px_rgba(180,140,0,0.15)]"
      >
        ✏️ Enter First Menu
      </button>
    </div>
  );
}

// ── Error state ───────────────────────────────────────────────────

function ErrorState({ onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 bg-[#fee8e2] rounded-3xl flex items-center justify-center text-3xl mb-4 shadow-sm select-none">⚠️</div>
      <p className="text-lg font-bold text-[#2a221d]">Connection Error</p>
      <p className="text-[#8b7d65] mt-1.5 text-sm max-w-[260px] leading-relaxed">
        Could not reach the server. Make sure the backend is running on port 5000.
      </p>
      <button
        onClick={onRetry}
        className="mt-5 px-6 py-2.5 bg-[#fff4c2] hover:bg-[#ffeea0] text-[#1f1a17] font-bold text-sm rounded-2xl transition-all active:scale-95 shadow-[0_2px_8px_rgba(180,140,0,0.15)]"
      >
        ↺ Retry
      </button>
    </div>
  );
}

// ── Monochrome warm-gold column icons ────────────────────────────
const COL_ICONS = {
  "Date":        "M3 4h18v18H3V4zM16 2v4M8 2v4M3 10h18",
  "Breakfast":   "M18 8h1a4 4 0 0 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z",
  "Mid-Morning": "M12 3v1.5M16.2 5.8l-1.1 1M18 10h-1.5M16.2 14.2l-1.1-1M12 16.5V15M7.8 14.2l1.1-1M6 10h1.5M7.8 5.8l1.1 1M12 7a3 3 0 0 1 0 6 3 3 0 0 1 0-6z",
  "Roti Sabzi":  "M4 7h16M4 12h16M4 17h10",
  "Dal Rice":    "M3 11h18M5 11c0 4.4 3.1 8 7 8s7-3.6 7-8M8 11V9a4 4 0 0 1 8 0v2",
  "Milk":        "M9 3h6l2 6H7L9 3zM7 9h10v11a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V9z",
  "Snacks":      "M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zM8 12c0-2.2 1.8-4 4-4s4 1.8 4 4-1.8 4-4 4-4-1.8-4-4z",
  "Actions":     "M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z",
};
function ColIcon({ name }) {
  const d = COL_ICONS[name];
  if (!d) return null;
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
      stroke="rgba(199,155,18,0.9)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"
      className="flex-shrink-0">
      <path d={d} />
    </svg>
  );
}

// ── Meal cell content ─────────────────────────────────────────────

// All pills: same warm gold family — only opacity/depth varies
const MEAL_PILL = {
  "Breakfast":   "bg-[#f5e8b8] text-[#7a5e18]",
  "Mid-Morning": "bg-[#f8f0d4] text-[#8b7228]",
  "Roti Sabzi":  "bg-[#f5e8b8] text-[#7a5e18]",
  "Dal Rice":    "bg-[#f8f0d4] text-[#8b7228]",
  "Milk":        "bg-[#faf5e4] text-[#9a8248]",
  "Snacks":      "bg-[#f5e8b8] text-[#7a5e18]",
};

function MealCell({ mealType, itemName, unitType }) {
  if (!itemName) {
    return <span className="text-[#d4c8b0] text-xs select-none">—</span>;
  }
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[13px] font-medium text-[#4a3f2a] truncate leading-tight" title={itemName}>
        {itemName}
      </span>
      <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-md w-fit ${MEAL_PILL[mealType] || "bg-gray-50 text-gray-500"}`}>
        {unitType}
      </span>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────

export default function FoodMenu() {
  const { canDo } = useAuth();
  const perm = {
    create: canDo("food_menu", "create"),
    edit:   canDo("food_menu", "edit"),
    delete: canDo("food_menu", "delete"),
  };
  const [menus,     setMenus]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [bootError, setBootError] = useState(false);

  // Modal state
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editTarget,     setEditTarget]     = useState(null);  // { date, mealMap }
  const [deleteTarget,   setDeleteTarget]   = useState(null);  // { date, count }

  const toast        = useToast();
  const mountedRef   = useRef(true);
  const fetchingRef  = useRef(false);   // guard: prevent concurrent/loop fetches

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ── Load menus ──────────────────────────────────────────────────
  // Stable callback ([] deps) — never gets a new reference between renders,
  // so the useEffect below fires exactly once on mount (not on every render).
  // fetchingRef prevents a second in-flight request if React StrictMode
  // double-fires the effect in development.

  const loadMenus = useCallback(async () => {
    if (fetchingRef.current) return;      // already in flight — skip
    if (!mountedRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    setBootError(false);
    try {
      const data = await foodMenuService.getMenus();
      if (!mountedRef.current) return;
      setMenus(Array.isArray(data) ? data : []);
    } catch {
      if (!mountedRef.current) return;
      setBootError(true);
      // No toast here — toast.error() changes toast state → triggers re-render
      // → new toast ref → new loadMenus ref → useEffect fires again → loop.
      // ErrorState component handles the UI for connection failures instead.
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        fetchingRef.current = false;
      }
    }
  }, []); // ← empty deps: stable reference, zero re-subscription loop risk

  useEffect(() => { loadMenus(); }, [loadMenus]);

  // ── Derived: table rows ─────────────────────────────────────────
  // Groups flat meal rows by date, keeps only last 30 days,
  // and reconstructs all 6 meal slots (even if empty) per date.

  const tableRows = useMemo(() => {
    const cutoff = cutoffISO();

    // Build { date → { mealType → { itemName, unitType } } }
    const byDate = {};
    menus.forEach(m => {
      if (m.date < cutoff) return;
      if (!byDate[m.date]) byDate[m.date] = {};
      byDate[m.date][m.mealType] = { itemName: m.itemName, unitType: m.unitType };
    });

    return Object.entries(byDate)
      .sort(([a], [b]) => b.localeCompare(a))  // newest first
      .map(([date, mealMap]) => ({ date, mealMap }));
  }, [menus]);

  // ── Stats ───────────────────────────────────────────────────────
  const totalMenus   = tableRows.length;
  const thisWeekCount = useMemo(() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const cutoff = weekAgo.toISOString().split("T")[0];
    return tableRows.filter(r => r.date >= cutoff).length;
  }, [tableRows]);

  // ── Enter Menu ──────────────────────────────────────────────────

  const openEnterModal = () => {
    setEditTarget(null);
    setShowEntryModal(true);
  };

  const handleEnterSave = async (date, mealsArray) => {
    try {
      const result = await foodMenuService.saveMenu({ date, meals: mealsArray });
      toast.success(result.message || "Menu saved! 🍽️");
      setShowEntryModal(false);
      await loadMenus();
    } catch (err) {
      toast.error(err.message || "Could not save menu.");
      throw err;  // keep modal open
    }
  };

  // ── Edit ────────────────────────────────────────────────────────

  const openEditModal = useCallback((row) => {
    setShowEntryModal(false);
    setEditTarget(row);   // { date, mealMap }
  }, []);

  const handleEditSave = async (date, mealsArray) => {
    try {
      const result = await foodMenuService.updateMenu(date, { meals: mealsArray });
      toast.success(result.message || "Menu updated! ✓");
      setEditTarget(null);
      await loadMenus();
    } catch (err) {
      toast.error(err.message || "Could not update menu.");
      throw err;
    }
  };

  // ── Delete ──────────────────────────────────────────────────────

  const openDeleteModal = useCallback((row) => {
    const count = Object.values(row.mealMap).filter(m => m.itemName).length;
    setDeleteTarget({ date: row.date, count });
  }, []);

  const handleDeleteConfirm = async () => {
    try {
      await foodMenuService.deleteMenu(deleteTarget.date);
      toast.success(`Menu for ${deleteTarget.date} deleted.`);
      setDeleteTarget(null);
      await loadMenus();
    } catch (err) {
      toast.error(err.message || "Could not delete menu.");
      throw err;
    }
  };

  // ────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen overflow-hidden bg-[#fffdf7]">
      <Sidebar />

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

        {/* ── STICKY HEADER ──────────────────────────────────────── */}
        <div className="flex-shrink-0 bg-[#fffef8]/[0.98] backdrop-blur-2xl border-b border-[#ece7d8] shadow-[0_1px_12px_rgba(180,140,0,0.07)] z-20">
          <div className="px-6 md:px-10 py-3 md:py-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">

              {/* Left: title */}
              <div className="flex-shrink-0">
                <div className="flex items-center gap-2.5">
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none"
                    stroke="#c79b12" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/>
                    <path d="M7 2v20"/>
                    <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3z"/>
                    <path d="M21 15v7"/>
                  </svg>
                  <h1 className="text-3xl md:text-4xl font-black text-[#2a1c06] tracking-tight leading-none">
                    Food Menu
                  </h1>
                </div>
                <p className="text-[#a3957e] text-sm mt-1 font-normal">
                  Manage daily meal plans · last 30 days
                </p>
              </div>

              {/* Right: stats + CTA */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="hidden sm:flex items-center gap-3">
                  <div className="bg-[#fffbee] border border-[#ece7d8] rounded-2xl px-4 py-2.5 text-center min-w-[80px] shadow-[0_2px_8px_rgba(180,140,0,0.06)]">
                    <p className="text-[9px] font-bold text-[#a3957e] uppercase tracking-widest">This Week</p>
                    <p className="text-2xl font-black text-[#1f1a17] tabular-nums leading-none mt-0.5">
                      {loading ? "—" : thisWeekCount}
                    </p>
                  </div>
                  <div className="bg-[#fffbee] border border-[#ece7d8] rounded-2xl px-4 py-2.5 text-center min-w-[80px] shadow-[0_2px_8px_rgba(180,140,0,0.06)]">
                    <p className="text-[9px] font-bold text-[#a3957e] uppercase tracking-widest">Total</p>
                    <p className="text-2xl font-black text-[#1f1a17] tabular-nums leading-none mt-0.5">
                      {loading ? "—" : totalMenus}
                    </p>
                  </div>
                </div>

                {/* Enter Menu CTA */}
                {perm.create && (
                  <button
                    onClick={openEnterModal}
                    className="
                      group relative overflow-hidden
                      flex items-center gap-2 px-5 py-2.5 rounded-xl
                      text-[#5a4010] text-sm font-semibold
                      active:scale-[0.97] transition-all duration-200
                    "
                    style={{
                      background: "linear-gradient(160deg, #f9dc5a 0%, #f0c930 100%)",
                      boxShadow: "0 4px 16px rgba(212,170,31,0.28), inset 0 1px 0 rgba(255,255,255,0.4)",
                    }}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = "0 6px 24px rgba(212,170,31,0.40), inset 0 1px 0 rgba(255,255,255,0.4)"}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = "0 4px 16px rgba(212,170,31,0.28), inset 0 1px 0 rgba(255,255,255,0.4)"}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
                    </svg>
                    Enter Menu
                  </button>
                )}
              </div>

            </div>
          </div>
        </div>

        {/* ── TABLE SECTION ───────────────────────────────────────── */}
        <div className="flex-1 overflow-auto px-6 md:px-10 py-7">
          <div className="max-w-[1400px] mx-auto">
          <div className="bg-[#fffdf8] rounded-3xl border border-[#e8ddb8] overflow-hidden min-w-[900px]"
            style={{ boxShadow: "0 10px 30px rgba(212,170,31,0.08), 0 2px 8px rgba(212,170,31,0.05)" }}>

            {/* ── Table header — soft warm gold ── */}
            <div className="px-6 py-3.5 border-b border-[#e8d898] relative overflow-hidden"
              style={{ background: "linear-gradient(180deg, #fff7d6 0%, #f8ebbf 100%)" }}>
              <div className="absolute inset-0 bg-white/30 pointer-events-none" />
              <div className="relative grid gap-3" style={{ gridTemplateColumns: "160px repeat(6,1fr) 88px" }}>
                <span className="text-[10px] font-semibold text-[#9a7a18] tracking-wide flex items-center gap-[7px]">
                  <ColIcon name="Date" />Date
                </span>
                {MEAL_TYPES.map(mt => (
                  <span key={mt.type} className="text-[10px] font-semibold text-[#9a7a18] tracking-wide flex items-center gap-[7px]">
                    <ColIcon name={mt.type} />
                    {mt.type}
                  </span>
                ))}
                <span className="text-[10px] font-semibold text-[#9a7a18] tracking-wide flex items-center justify-end gap-[7px]">
                  <ColIcon name="Actions" />
                </span>
              </div>
            </div>

            {/* ── Table body ── */}
            {loading ? (
              <SkeletonTable />
            ) : bootError ? (
              <ErrorState onRetry={loadMenus} />
            ) : tableRows.length === 0 ? (
              <EmptyState onEnter={openEnterModal} />
            ) : (
              <div className="p-3 space-y-1.5">
                {tableRows.map((row, rowIdx) => {
                  const today     = isToday(row.date);
                  const yesterday = isYesterday(row.date);
                  return (
                    <div
                      key={row.date}
                      className={`
                        group grid gap-3 px-5 py-3.5 rounded-2xl transition-all duration-[190ms]
                        border hover:shadow-[0_4px_20px_rgba(212,170,31,0.12)] hover:-translate-y-px
                        ${today
                          ? "bg-[#fffdf0] border-[#f0e4a0]"
                          : "bg-[#fffdf8] border-transparent hover:bg-[#fffbee] hover:border-[#e8d898]"}
                      `}
                      style={{ gridTemplateColumns: "160px repeat(6,1fr) 88px" }}
                    >
                      {/* Date column */}
                      <div className="flex flex-col justify-center min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-sm font-bold leading-tight ${today ? "text-[#1f1a17]" : "text-[#4a3f2a]"}`}>
                            {fmtTableDate(row.date)}
                          </span>
                          {today && (
                            <span className="px-1.5 py-0.5 rounded-lg bg-[#fff4c2] text-[#8b6a18] text-[9px] font-black uppercase tracking-wide">
                              Today
                            </span>
                          )}
                          {yesterday && (
                            <span className="px-1.5 py-0.5 rounded-lg bg-[#f5f0e2] text-[#8b7d65] text-[9px] font-black uppercase tracking-wide">
                              Yesterday
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-[#a3957e] font-medium mt-0.5">
                          {row.date}
                        </span>
                      </div>

                      {/* 6 meal columns — always all 6, empty = "—" */}
                      {MEAL_TYPES.map(mt => (
                        <div key={mt.type} className="flex items-center min-w-0">
                          <MealCell
                            mealType={mt.type}
                            itemName={row.mealMap[mt.type]?.itemName || ""}
                            unitType={row.mealMap[mt.type]?.unitType || ""}
                          />
                        </div>
                      ))}

                      {/* Actions column */}
                      <div className="flex items-center justify-end gap-1.5">
                        {perm.edit && (
                          <button
                            onClick={() => openEditModal(row)}
                            title="Edit menu"
                            className="
                              w-8 h-8 flex items-center justify-center rounded-xl
                              text-[#c4b090] hover:text-[#7a5e18] hover:bg-[#f5e8b8]
                              transition-all duration-[190ms]
                            "
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"
                                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
                                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        )}

                        {perm.delete && (
                          <button
                            onClick={() => openDeleteModal(row)}
                            title="Delete menu"
                            className="
                              w-8 h-8 flex items-center justify-center rounded-xl
                              text-[#d4c8b0] hover:text-[#c0402a] hover:bg-[#fee8e2]
                              transition-all duration-[190ms]
                            "
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"
                                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Table footer ── */}
            {!loading && !bootError && tableRows.length > 0 && (
              <div className="px-6 py-3 border-t border-[#e8d898] bg-[#fffbee]/60 flex items-center justify-between">
                <p className="text-xs text-[#a3957e] font-normal">
                  Showing {tableRows.length} menu{tableRows.length !== 1 ? "s" : ""} · last 30 days
                </p>
                <button
                  onClick={openEnterModal}
                  className="text-xs font-medium text-[#b09830] hover:text-[#8b6a18] transition-colors duration-150"
                >
                  + Add menu
                </button>
              </div>
            )}
          </div>
          </div>
        </div>
      </div>

      {/* ── MODALS ─────────────────────────────────────────────────── */}

      {/* Enter Menu modal */}
      {showEntryModal && (
        <MenuEntryModal
          mode="enter"
          initialDate={todayISO()}
          initialMeals={null}
          allMenus={menus}
          onSave={handleEnterSave}
          onClose={() => setShowEntryModal(false)}
        />
      )}

      {/* Edit modal */}
      {editTarget && (
        <MenuEntryModal
          mode="edit"
          initialDate={editTarget.date}
          initialMeals={editTarget.mealMap}
          allMenus={menus}
          onSave={handleEditSave}
          onClose={() => setEditTarget(null)}
        />
      )}

      {/* Delete confirm modal */}
      {deleteTarget && (
        <DeleteConfirmModal
          date={deleteTarget.date}
          mealCount={deleteTarget.count}
          onConfirm={handleDeleteConfirm}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      {/* Toast notifications */}
      <ToastStack toasts={toast.toasts} onDismiss={toast.dismiss} />
    </div>
  );
}

