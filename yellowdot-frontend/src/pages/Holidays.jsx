// ─────────────────────────────────────────────────────────────────────────────
// Holidays — school calendar & closure management
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from "react";
import Sidebar from "../components/Sidebar";
import communicationService from "../services/communicationService";
import academicsService from "../services/academicsService";

const HOLIDAY_TYPES = [
  "National Holiday", "Festival", "School Holiday",
  "Vacation", "Emergency Closure", "Event Day", "Half Day",
];

const TYPE_STYLE = {
  "National Holiday":   "bg-[#f5e8b8] text-[#7a5e18] border-[#e8d49a]",
  "Festival":           "bg-[#f8f0d4] text-[#8b7228] border-[#e8daa0]",
  "School Holiday":     "bg-[#faf5e4] text-[#8b7228] border-[#ece0b4]",
  "Vacation":           "bg-[#f5e8b8] text-[#7a5e18] border-[#e8d49a]",
  "Emergency Closure":  "bg-[#fee8e2] text-[#7a2018] border-[#e0a898]",
  "Event Day":          "bg-[#f8f0d4] text-[#7a5e18] border-[#e8daa0]",
  "Half Day":           "bg-[#faf5e4] text-[#9a8248] border-[#ece0b4]",
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function dayNum(iso) {
  if (!iso) return "";
  return new Date(iso + "T00:00:00").getDate();
}

function todayISO() { return new Date().toISOString().split("T")[0]; }

// ── ClassBadges ───────────────────────────────────────────────────────────────

function ClassBadges({ holiday, classMap }) {
  if (holiday.appliesTo === "selected") {
    const ids = holiday.classIds || [];
    if (ids.length === 0) return null;
    return (
      <>
        {ids.slice(0, 3).map(id => (
          <span key={id}
            className="inline-flex items-center px-2 py-0.5 rounded-lg bg-[#edf4ff] text-[#2563b8] text-[10px] font-semibold border border-[#bfdbfe]">
            {classMap[id] || id}
          </span>
        ))}
        {ids.length > 3 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-[#F1F1F1] text-[#6b7280] text-[10px] font-semibold border border-[#e5e7eb]">
            +{ids.length - 3} more
          </span>
        )}
      </>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-[#f0fdf4] text-[#15803d] text-[10px] font-semibold border border-[#bbf7d0]">
      All Classes
    </span>
  );
}

// ── HolidayCard ───────────────────────────────────────────────────────────────

function HolidayCard({ holiday, onEdit, onDelete, classMap }) {
  const isSingle  = holiday.startDate === holiday.endDate;
  const typeStyle = TYPE_STYLE[holiday.type] || "bg-[#f8f0d4] text-[#8b7228] border-[#e8daa0]";
  const isToday   = holiday.startDate <= todayISO() && todayISO() <= (holiday.endDate || holiday.startDate);

  return (
    <div className={`
      group flex gap-5 p-6 rounded-3xl border transition-all duration-[200ms]
      hover:shadow-[0_10px_36px_rgba(212,170,31,0.13)] hover:-translate-y-1
      ${isToday ? "bg-[#fffdf0] border-[#e8d89a]" : "bg-white border-[#F1F1F1] hover:border-[#e0d4a0] hover:bg-white"}
    `}>
      {/* Date block */}
      <div className="flex-shrink-0 flex flex-col items-center justify-center w-[68px] h-[68px] rounded-3xl"
        style={{ background: "linear-gradient(160deg,#f9dc5a 0%,#f0c930 100%)", boxShadow: "0 4px 16px rgba(212,170,31,0.32), inset 0 1px 0 rgba(255,255,255,0.55)" }}>
        <span className="text-[#7a5010] text-[10px] font-bold leading-none tracking-widest uppercase">
          {holiday.startDate ? MONTHS[new Date(holiday.startDate + "T00:00:00").getMonth()] : ""}
        </span>
        <span className="text-[#3a2a06] text-[26px] font-black leading-tight tabular-nums">{dayNum(holiday.startDate)}</span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 py-0.5">
        <h3 className="text-[#2a1c06] font-bold text-base leading-snug">{holiday.title}</h3>
        <p className="text-[#a3957e] text-[13px] font-normal mt-1 mb-2.5">
          {isSingle ? fmtDate(holiday.startDate) : `${fmtDate(holiday.startDate)} — ${fmtDate(holiday.endDate)}`}
        </p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-lg border text-[10px] font-semibold ${typeStyle}`}>
            {holiday.type}
          </span>
          {holiday.recurring && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-[#F1F1F1] text-[#8b7228] text-[10px] font-semibold border border-[#e0d4a8]">
              Recurring
            </span>
          )}
          {holiday.pushToParents && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-[#f8f0d4] text-[#7a5e18] text-[10px] font-semibold border border-[#e8d49a]">
              Parent App
            </span>
          )}
          <ClassBadges holiday={holiday} classMap={classMap} />
        </div>
        {holiday.description && (
          <p className="text-[#8b7d65] text-[13px] mt-2 leading-relaxed line-clamp-2">{holiday.description}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => onEdit(holiday)} title="Edit"
          className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#f8f0d4] hover:bg-[#f0e4a0] text-[#8b7228] transition-all">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button onClick={() => onDelete(holiday.id)} title="Delete"
          className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-[#fee8e2] text-[#d4c8b0] hover:text-[#c0402a] transition-all">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Calendar mini-grid ────────────────────────────────────────────────────────

function CalendarGrid({ holidays }) {
  const today = new Date();
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const firstDay   = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, i) => i < firstDay ? null : i - firstDay + 1);

  function getHolidayForDay(day) {
    const iso = `${viewYear}-${String(viewMonth + 1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    return holidays.find(h => iso >= h.startDate && iso <= (h.endDate || h.startDate));
  }

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); };

  const todayD = today.getDate(), todayM = today.getMonth(), todayY = today.getFullYear();
  const isCurrentMonth = viewYear === todayY && viewMonth === todayM;

  return (
    <div className="bg-white rounded-3xl border border-[#F1F1F1] overflow-hidden"
      style={{ boxShadow: "0 4px 20px rgba(212,170,31,0.07)" }}>
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0ebe0]">
        <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-[#f8f0d4] text-[#8b7228] transition-all">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span className="text-[#2a1c06] font-bold text-sm">{MONTHS[viewMonth]} {viewYear}</span>
        <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-[#f8f0d4] text-[#8b7228] transition-all">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
      <div className="grid grid-cols-7 px-4 pt-3">
        {DAYS.map(d => <div key={d} className="text-center text-[10px] font-semibold text-[#c4b090] py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 px-4 pb-5 gap-y-1">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const h = getHolidayForDay(day);
          const isToday = isCurrentMonth && day === todayD;
          return (
            <div key={i} title={h?.title || ""}
              className={`flex flex-col items-center justify-center h-9 rounded-xl text-sm transition-all cursor-default
                ${isToday ? "ring-2 ring-[#f4c430]/50" : ""}
                ${h ? "bg-[#f9dc5a]/20 font-bold text-[#5a4010]" : "text-[#8b7d65]"}`}>
              <span className="text-xs leading-none">{day}</span>
              {h && <span className="w-1.5 h-1.5 bg-[#c9a830] rounded-full mt-0.5" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── ClassMultiSelect ──────────────────────────────────────────────────────────

function ClassMultiSelect({ classes, selectedIds, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const toggle = (id) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter(x => x !== id)
        : [...selectedIds, id]
    );
  };

  const label = selectedIds.length === 0
    ? "Select classes…"
    : selectedIds.length === 1
      ? (classes.find(c => c.id === selectedIds[0])?.name || selectedIds[0])
      : `${selectedIds.length} classes selected`;

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border text-sm transition-all
          ${open ? "ring-2 ring-[#f4c430]/35 border-[#c9a830]/60" : "border-[#F1F1F1]"}
          bg-white text-left`}>
        <span className={selectedIds.length === 0 ? "text-[#c4b090]" : "text-[#2a1c06] font-medium"}>
          {label}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#c4b090" strokeWidth="2.5" strokeLinecap="round"
          className={`flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1.5 bg-white border border-[#F1F1F1] rounded-2xl shadow-xl overflow-hidden"
          style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.10)" }}>
          <div className="max-h-48 overflow-y-auto py-1.5">
            {classes.length === 0 ? (
              <div className="px-4 py-3 text-[#a3957e] text-sm text-center">No active classes found</div>
            ) : classes.map(cls => {
              const checked = selectedIds.includes(cls.id);
              return (
                <button key={cls.id} type="button" onClick={() => toggle(cls.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left
                    ${checked ? "bg-[#fffdf0]" : "hover:bg-[#faf8f0]"}`}>
                  <div className={`w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0 transition-all
                    ${checked ? "bg-[#f4c430] border-[#c9a830]" : "border-[#d4c8b0]"}`}>
                    {checked && (
                      <svg width="9" height="9" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4l3 3 5-6" stroke="#5a4010" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <span className={checked ? "text-[#2a1c06] font-semibold" : "text-[#5a4010]"}>{cls.name}</span>
                  {cls.ageGroup && (
                    <span className="text-[#a3957e] text-[11px] ml-auto">{cls.ageGroup}</span>
                  )}
                </button>
              );
            })}
          </div>
          {selectedIds.length > 0 && (
            <div className="px-4 py-2 border-t border-[#F1F1F1]">
              <button type="button" onClick={() => onChange([])}
                className="text-[11px] font-semibold text-[#a3957e] hover:text-[#7a5e18] transition-colors">
                Clear selection
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

const EMPTY = {
  title: "", startDate: "", endDate: "", type: "School Holiday",
  description: "", recurring: false, pushToParents: true,
  appliesTo: "all", classIds: [],
};

function HolidayModal({ initial, onSave, onClose }) {
  const [form,    setForm]    = useState(() => ({
    ...EMPTY,
    ...initial,
    appliesTo: initial?.appliesTo || "all",
    classIds:  initial?.classIds  || [],
  }));
  const [saving,  setSaving]  = useState(false);
  const [classes, setClasses] = useState([]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    academicsService.getClasses()
      .then(setClasses)
      .catch(() => setClasses([]));
  }, []);

  const handleSave = async () => {
    if (!form.title.trim() || !form.startDate) return;
    setSaving(true);
    const payload = {
      ...form,
      classIds: form.appliesTo === "all" ? [] : form.classIds,
    };
    try { await onSave(payload); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(31,26,23,0.52)", backdropFilter: "blur(6px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: "90vh" }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-7 pt-6 pb-5 border-b border-[#F1F1F1] flex-shrink-0"
          style={{ background: "linear-gradient(160deg,#fff7d6 0%,#f8ebbf 50%,#f5e4a8 100%)" }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#9a7a18] text-[10px] font-semibold tracking-[0.18em] mb-1">COMMUNICATIONS · HOLIDAYS</p>
              <h2 className="text-[#3a2a08] font-bold text-lg">{initial ? "Edit Holiday" : "Add Holiday"}</h2>
            </div>
            <button onClick={onClose} disabled={saving}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#f0d880]/40 hover:bg-[#f0d880]/80 text-[#8b6a18] transition-all">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M10 3L3 10M3 3L10 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-7 py-5 space-y-4 bg-white">
          {/* Title */}
          <div>
            <label className="block text-[11px] font-semibold text-[#8b7228] uppercase tracking-wide mb-1.5">Title *</label>
            <input value={form.title} onChange={e => set("title", e.target.value)}
              placeholder="e.g. Ram Navami"
              className="w-full px-4 py-2.5 rounded-xl border border-[#F1F1F1] bg-white text-sm text-[#2a1c06] outline-none focus:ring-2 focus:ring-[#f4c430]/35 focus:border-[#c9a830]/60 transition-all placeholder-[#c4b090]"/>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#8b7228] uppercase tracking-wide mb-1.5">Start Date *</label>
              <input type="date" value={form.startDate} onChange={e => set("startDate", e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-[#F1F1F1] bg-white text-sm text-[#2a1c06] outline-none focus:ring-2 focus:ring-[#f4c430]/35 focus:border-[#c9a830]/60 transition-all cursor-pointer"/>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#8b7228] uppercase tracking-wide mb-1.5">End Date</label>
              <input type="date" value={form.endDate} min={form.startDate} onChange={e => set("endDate", e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-[#F1F1F1] bg-white text-sm text-[#2a1c06] outline-none focus:ring-2 focus:ring-[#f4c430]/35 focus:border-[#c9a830]/60 transition-all cursor-pointer"/>
            </div>
          </div>

          {/* Type */}
          <div>
            <label className="block text-[11px] font-semibold text-[#8b7228] uppercase tracking-wide mb-1.5">Type</label>
            <select value={form.type} onChange={e => set("type", e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-[#F1F1F1] bg-white text-sm text-[#2a1c06] outline-none focus:ring-2 focus:ring-[#f4c430]/35 cursor-pointer">
              {HOLIDAY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Affected Classes */}
          <div>
            <label className="block text-[11px] font-semibold text-[#8b7228] uppercase tracking-wide mb-2">
              Affected Classes *
            </label>
            <div className="flex gap-3 mb-3">
              {[
                { value: "all",      label: "All Classes" },
                { value: "selected", label: "Selected Classes" },
              ].map(({ value, label }) => (
                <button key={value} type="button"
                  onClick={() => set("appliesTo", value)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold transition-all flex-1 justify-center
                    ${form.appliesTo === value
                      ? "bg-[#f9dc5a]/30 border-[#d4b830] text-[#5a4010]"
                      : "bg-white border-[#F1F1F1] text-[#a3957e] hover:border-[#d4c8a0]"
                    }`}>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all
                    ${form.appliesTo === value ? "border-[#c9a830]" : "border-[#d4c8b0]"}`}>
                    {form.appliesTo === value && (
                      <div className="w-2 h-2 rounded-full bg-[#c9a830]" />
                    )}
                  </div>
                  {label}
                </button>
              ))}
            </div>

            {form.appliesTo === "selected" && (
              <ClassMultiSelect
                classes={classes}
                selectedIds={form.classIds}
                onChange={ids => set("classIds", ids)}
              />
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-[11px] font-semibold text-[#8b7228] uppercase tracking-wide mb-1.5">Description</label>
            <textarea value={form.description} onChange={e => set("description", e.target.value)}
              rows={2} placeholder="Optional note for staff or parents…"
              className="w-full px-4 py-2.5 rounded-xl border border-[#F1F1F1] bg-white text-sm text-[#2a1c06] outline-none focus:ring-2 focus:ring-[#f4c430]/35 focus:border-[#c9a830]/60 transition-all resize-none placeholder-[#c4b090]"/>
          </div>

          {/* Toggles */}
          <div className="flex items-center gap-4">
            {[
              { key: "recurring",     label: "Repeats yearly" },
              { key: "pushToParents", label: "Push to parent app" },
            ].map(({ key, label }) => (
              <button key={key} type="button" onClick={() => set(key, !form[key])}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all ${
                  form[key]
                    ? "bg-[#f9dc5a]/30 border-[#d4b830] text-[#5a4010]"
                    : "bg-white border-[#F1F1F1] text-[#a3957e] hover:border-[#d4c8a0]"
                }`}>
                <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                  form[key] ? "bg-[#f4c430] border-[#c9a830]" : "border-[#d4c8b0]"
                }`}>
                  {form[key] && (
                    <svg width="9" height="9" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4l3 3 5-6" stroke="#5a4010" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-7 py-4 border-t border-[#F1F1F1] flex gap-3 bg-white flex-shrink-0">
          <button onClick={onClose} disabled={saving}
            className="flex-1 py-2.5 rounded-2xl border border-[#F1F1F1] text-sm font-bold text-[#6f624f] hover:bg-[#faf6ea] transition-all disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleSave}
            disabled={saving || !form.title.trim() || !form.startDate || (form.appliesTo === "selected" && form.classIds.length === 0)}
            className="flex-[2] py-2.5 rounded-xl text-sm font-semibold text-[#5a4010] disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
            style={{ background: "linear-gradient(160deg,#f9dc5a 0%,#f0c930 100%)", boxShadow: "0 4px 14px rgba(212,170,31,0.28)" }}>
            {saving ? "Saving…" : initial ? "Save Changes" : "Add Holiday"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onAdd }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-5"
        style={{ background: "linear-gradient(160deg,#fff7d6 0%,#f5e4a8 100%)", boxShadow: "0 4px 16px rgba(212,170,31,0.15)" }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#c79b12" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/>
        </svg>
      </div>
      <p className="text-lg font-bold text-[#2a1c06]">No holidays this year</p>
      <p className="text-[#a3957e] text-sm mt-1.5 max-w-[240px] mx-auto leading-relaxed">
        Add school closures, festivals, and events to the calendar.
      </p>
      <button onClick={onAdd}
        className="mt-5 px-6 py-2.5 rounded-xl text-[#5a4010] font-semibold text-sm transition-all active:scale-95"
        style={{ background: "linear-gradient(160deg,#f9dc5a 0%,#f0c930 100%)", boxShadow: "0 4px 14px rgba(212,170,31,0.28)" }}>
        Add First Holiday
      </button>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Holidays() {
  const currentYear = String(new Date().getFullYear());
  const [holidays,   setHolidays]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [year,       setYear]       = useState(currentYear);
  const [view,       setView]       = useState("list");
  const [typeFilter, setTypeFilter] = useState("All");
  const [modal,      setModal]      = useState(null);
  const [search,     setSearch]     = useState("");
  const [classMap,   setClassMap]   = useState({});

  const load = useCallback(async (y) => {
    setLoading(true);
    try { setHolidays(await communicationService.getHolidays(y)); }
    catch { setHolidays([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(year); }, [year, load]);

  // Fetch classes once to build a classId → name map for display
  useEffect(() => {
    academicsService.getClasses()
      .then(list => {
        const map = {};
        list.forEach(c => { map[c.id] = c.name; });
        setClassMap(map);
      })
      .catch(() => {});
  }, []);

  const handleSave = async (form) => {
    if (modal.mode === "edit") {
      const updated = await communicationService.updateHoliday(modal.data.id, form);
      setHolidays(prev => prev.map(h => h.id === updated.id ? updated : h));
    } else {
      const created = await communicationService.createHoliday(form);
      setHolidays(prev => [created, ...prev]);
    }
    setModal(null);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this holiday?")) return;
    await communicationService.deleteHoliday(id);
    setHolidays(prev => prev.filter(h => h.id !== id));
  };

  const years    = [currentYear, String(Number(currentYear) + 1), String(Number(currentYear) - 1)];
  const filtered = holidays
    .filter(h => typeFilter === "All" || h.type === typeFilter)
    .filter(h => !search || h.title.toLowerCase().includes(search.toLowerCase()));
  const todayStr = todayISO();
  const upcoming = filtered.filter(h => (h.endDate || h.startDate) >= todayStr);
  const past     = filtered.filter(h => (h.endDate || h.startDate) <  todayStr);

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex-shrink-0 bg-white/95 backdrop-blur-2xl border-b border-[#F1F1F1] shadow-[0_1px_12px_rgba(180,140,0,0.07)] z-20">
          <div className="px-6 md:px-10 py-3 md:py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <p className="text-[#9a7a18] text-[10px] font-semibold tracking-[0.18em] mb-0.5">COMMUNICATIONS</p>
              <h1 className="text-3xl md:text-4xl font-black text-[#2a1c06] tracking-tight leading-none">Holidays</h1>
              <p className="text-[#a3957e] text-sm mt-0.5 font-normal">School calendar & closures</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Search */}
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#c4b090]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search holidays…"
                  className="pl-9 pr-4 py-2 rounded-xl border border-[#F1F1F1] bg-white text-sm text-[#2a1c06] outline-none focus:ring-2 focus:ring-[#f4c430]/35 w-44 placeholder-[#c4b090]"/>
              </div>
              {/* Year */}
              <select value={year} onChange={e => setYear(e.target.value)}
                className="px-3 py-2 rounded-xl border border-[#F1F1F1] bg-white text-sm text-[#2a1c06] outline-none cursor-pointer">
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              {/* View toggle */}
              <div className="flex items-center rounded-xl border border-[#F1F1F1] overflow-hidden bg-white">
                {[["list","List"],["calendar","Cal"]].map(([v, label]) => (
                  <button key={v} onClick={() => setView(v)}
                    className={`px-3 py-2 text-xs font-semibold transition-all ${view === v ? "bg-[#f9dc5a] text-[#5a4010]" : "text-[#a3957e] hover:text-[#7a5e18]"}`}>
                    {label}
                  </button>
                ))}
              </div>
              {/* Add */}
              <button onClick={() => setModal({ mode: "add", data: null })}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[#5a4010] text-sm font-semibold transition-all active:scale-95"
                style={{ background: "linear-gradient(160deg,#f9dc5a 0%,#f0c930 100%)", boxShadow: "0 3px 10px rgba(212,170,31,0.28)" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Add Holiday
              </button>
            </div>
          </div>

          {/* Type filter chips */}
          <div className="px-6 md:px-10 pb-3 flex items-center gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {["All", ...HOLIDAY_TYPES].map(t => (
              <button key={t} onClick={() => setTypeFilter(t)}
                className={`flex-shrink-0 px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
                  typeFilter === t
                    ? "bg-[#f9dc5a] text-[#5a4010] shadow-sm"
                    : "bg-[#f8f0d4] text-[#8b7228] hover:bg-[#f0e4a0]"
                }`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-6 md:px-10 py-5">
          {loading ? (
            <div className="space-y-3 animate-pulse max-w-3xl">
              {[0,1,2].map(i => (
                <div key={i} className="flex gap-4 p-5 rounded-3xl bg-white border border-[#F1F1F1]">
                  <div className="w-14 h-14 rounded-2xl bg-[#F1F1F1] flex-shrink-0"/>
                  <div className="flex-1 space-y-2 pt-1">
                    <div className="h-3 bg-[#F1F1F1] rounded-full w-20"/>
                    <div className="h-4 bg-[#F1F1F1] rounded-full w-48"/>
                    <div className="h-2.5 bg-[#F1F1F1] rounded-full w-32"/>
                  </div>
                </div>
              ))}
            </div>
          ) : view === "calendar" ? (
            <div className="max-w-sm"><CalendarGrid holidays={holidays} /></div>
          ) : filtered.length === 0 ? (
            <EmptyState onAdd={() => setModal({ mode: "add", data: null })} />
          ) : (
            <div className="max-w-3xl space-y-10">
              {upcoming.length > 0 && (
                <section>
                  <p className="text-[11px] font-semibold text-[#a3957e] uppercase tracking-[0.18em] mb-4">
                    Upcoming · {upcoming.length}
                  </p>
                  <div className="space-y-3">
                    {upcoming.map(h => (
                      <HolidayCard key={h.id} holiday={h} classMap={classMap}
                        onEdit={h => setModal({ mode: "edit", data: h })}
                        onDelete={handleDelete} />
                    ))}
                  </div>
                </section>
              )}
              {past.length > 0 && (
                <section className="opacity-55">
                  <p className="text-[11px] font-semibold text-[#c4b090] uppercase tracking-[0.18em] mb-4">
                    Past · {past.length}
                  </p>
                  <div className="space-y-3">
                    {past.map(h => (
                      <HolidayCard key={h.id} holiday={h} classMap={classMap}
                        onEdit={h => setModal({ mode: "edit", data: h })}
                        onDelete={handleDelete} />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
          <div className="h-6" />
        </div>
      </div>

      {modal && (
        <HolidayModal
          initial={modal.data}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
