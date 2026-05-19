// ─────────────────────────────────────────────────────────────────
// DeleteConfirmModal — premium confirmation dialog for menu deletion
//
// Props:
//   date      string  — the date string being deleted (YYYY-MM-DD)
//   mealCount number  — how many meal rows will be removed
//   onConfirm () => Promise<void>
//   onClose   () => void
// ─────────────────────────────────────────────────────────────────

import { useState } from "react";

function formatDateLabel(dateStr) {
  if (!dateStr) return dateStr;
  const [y, m, d] = dateStr.split("-");
  if (!y || !m || !d) return dateStr;
  return new Date(Number(y), Number(m) - 1, Number(d))
    .toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export default function DeleteConfirmModal({ date, mealCount, onConfirm, onClose }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onConfirm();
    } finally {
      setDeleting(false);
    }
  };

  return (
    /* ── Backdrop ── */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(4,17,75,0.45)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      {/* ── Panel ── */}
      <div
        className="
          w-full max-w-sm
          bg-white rounded-3xl shadow-2xl shadow-[#04114B]/25
          overflow-hidden
        "
        onClick={e => e.stopPropagation()}
      >
        {/* ── Top accent strip ── */}
        <div className="h-1.5 bg-gradient-to-r from-rose-400 to-rose-500" />

        {/* ── Body ── */}
        <div className="px-7 pt-7 pb-6">
          {/* Icon */}
          <div className="w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center mb-5">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className="text-rose-500">
              <path
                d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"
                stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
              />
              <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </div>

          {/* Title */}
          <h2 className="text-xl font-black text-[#04114B] mb-2">Delete Menu?</h2>

          {/* Description */}
          <p className="text-sm text-gray-500 leading-relaxed mb-1">
            You're about to permanently delete the menu for:
          </p>
          <p className="text-sm font-bold text-[#04114B] mb-3">
            {formatDateLabel(date)}
          </p>

          {mealCount > 0 && (
            <div className="flex items-center gap-2 px-3.5 py-2.5 bg-rose-50 border border-rose-100 rounded-2xl mb-1">
              <span className="text-base">🍽️</span>
              <span className="text-xs font-semibold text-rose-600">
                {mealCount} meal item{mealCount !== 1 ? "s" : ""} will be removed
              </span>
            </div>
          )}

          <p className="text-xs text-gray-400 mt-3">
            This action cannot be undone.
          </p>
        </div>

        {/* ── Footer buttons ── */}
        <div className="flex gap-3 px-7 pb-7">
          {/* Cancel */}
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="
              flex-1 py-3 rounded-2xl border border-gray-200 text-sm font-bold text-gray-600
              hover:bg-gray-50 hover:border-gray-300 transition-all duration-150
              disabled:opacity-50
            "
          >
            Cancel
          </button>

          {/* Delete */}
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="
              relative flex-[1.5] overflow-hidden group
              py-3 rounded-2xl text-sm font-black text-white
              bg-gradient-to-r from-rose-500 to-rose-600
              shadow-md shadow-rose-200/60
              hover:shadow-lg hover:shadow-rose-300/50
              disabled:opacity-60 disabled:cursor-not-allowed
              transition-all duration-200
            "
          >
            {/* shimmer */}
            <span
              aria-hidden
              className="
                pointer-events-none absolute inset-0
                bg-gradient-to-r from-transparent via-white/20 to-transparent
                -translate-x-full group-hover:translate-x-full
                transition-transform duration-700
              "
            />
            <span className="relative flex items-center justify-center gap-2">
              {deleting ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Deleting…
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Delete Menu
                </>
              )}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
