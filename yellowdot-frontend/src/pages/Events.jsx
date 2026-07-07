// ─────────────────────────────────────────────────────────────────────────────
// Events — school event management (Communications)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from "react";
import Sidebar from "../components/Sidebar";
import eventService from "../services/eventService";
import academicsService from "../services/academicsService";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function todayISO() { return new Date().toISOString().split("T")[0]; }

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function fmtTime(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function dayNum(iso) {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").getDate();
}

function eventStatus(eventDate) {
  if (!eventDate) return "upcoming";
  const today = todayISO();
  if (eventDate < today)  return "completed";
  if (eventDate === today) return "ongoing";
  return "upcoming";
}

// Status badge styles — warm Yellow Dot palette throughout
const STATUS_STYLE = {
  upcoming:  "bg-[#f8f4d8] text-[#5a4d18] border-[#d4bc58]",
  ongoing:   "bg-[#f9dc5a]/30 text-[#5a4010] border-[#d4b830]",
  completed: "bg-[#F1F1F1] text-[#8b7d65] border-[#e0d4b8]",
};

// ── ClassBadges ───────────────────────────────────────────────────────────────

function ClassBadges({ event, classMap }) {
  if (event.appliesTo === "selected") {
    const ids = event.classIds || [];
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

// ── EventCard ─────────────────────────────────────────────────────────────────

function EventCard({ event, onEdit, onDelete, classMap }) {
  const status  = eventStatus(event.eventDate);
  const isToday = status === "ongoing";

  return (
    <div className={`
      group flex gap-5 p-6 rounded-3xl border transition-all duration-[200ms]
      hover:shadow-[0_10px_36px_rgba(212,170,31,0.13)] hover:-translate-y-1
      ${isToday
        ? "bg-[#fffdf0] border-[#e8d89a]"
        : "bg-white border-[#F1F1F1] hover:border-[#e0d4a0] hover:bg-white"}
    `}>
      {/* Date block — KUE BOXS Care brand gradient */}
      <div className="flex-shrink-0 flex flex-col items-center justify-center w-[68px] h-[68px] rounded-3xl"
        style={{
          background: "linear-gradient(160deg,#f9dc5a 0%,#f0c930 100%)",
          boxShadow: "0 4px 16px rgba(212,170,31,0.32), inset 0 1px 0 rgba(255,255,255,0.55)",
        }}>
        <span className="text-[#7a5010] text-[10px] font-bold leading-none tracking-widest uppercase">
          {event.eventDate ? MONTHS[new Date(event.eventDate + "T00:00:00").getMonth()] : ""}
        </span>
        <span className="text-[#3a2a06] text-[26px] font-black leading-tight tabular-nums">
          {dayNum(event.eventDate)}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 py-0.5">
        <h3 className="text-[#2a1c06] font-bold text-base leading-snug">{event.title}</h3>
        <p className="text-[#a3957e] text-[13px] font-normal mt-1 mb-2.5">
          {fmtDate(event.eventDate)}
          {event.startTime && (
            <> · {fmtTime(event.startTime)}{event.endTime ? ` – ${fmtTime(event.endTime)}` : ""}</>
          )}
          {event.venue && <> · {event.venue}</>}
        </p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-lg border text-[10px] font-semibold capitalize ${STATUS_STYLE[status]}`}>
            {status === "ongoing" ? "Today" : status}
          </span>
          {event.rsvpRequired && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-[#f8f0d4] text-[#7a5e18] text-[10px] font-semibold border border-[#e8d49a]">
              RSVP · {event.rsvpCount ?? 0} attending
            </span>
          )}
          {event.pushToParentApp && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-[#f8f0d4] text-[#7a5e18] text-[10px] font-semibold border border-[#e8d49a]">
              Parent App
            </span>
          )}
          <ClassBadges event={event} classMap={classMap} />
        </div>
        {event.description && (
          <p className="text-[#8b7d65] text-[13px] mt-2 leading-relaxed line-clamp-2">{event.description}</p>
        )}
      </div>

      {/* Actions — reveal on hover */}
      <div className="flex-shrink-0 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => onEdit(event)} title="Edit"
          className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#f8f0d4] hover:bg-[#f0e4a0] text-[#8b7228] transition-all">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button onClick={() => onDelete(event.id)} title="Delete"
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
  title: "", description: "", eventDate: "", startTime: "", endTime: "",
  venue: "", appliesTo: "all", classIds: [],
  rsvpRequired: false, pushToParentApp: true,
};

function EventModal({ initial, onSave, onClose }) {
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

  const canSave =
    form.title.trim() &&
    form.eventDate &&
    form.startTime &&
    form.venue.trim() &&
    !(form.appliesTo === "selected" && form.classIds.length === 0);

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave({
        ...form,
        classIds: form.appliesTo === "all" ? [] : form.classIds,
      });
    } finally { setSaving(false); }
  };

  const inputCls = "w-full px-4 py-2.5 rounded-xl border border-[#F1F1F1] bg-white text-sm text-[#2a1c06] outline-none focus:ring-2 focus:ring-[#f4c430]/35 focus:border-[#c9a830]/60 transition-all placeholder-[#c4b090]";
  const labelCls = "block text-[11px] font-semibold text-[#8b7228] uppercase tracking-wide mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(31,26,23,0.52)", backdropFilter: "blur(6px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}>

      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: "90vh" }}
        onClick={e => e.stopPropagation()}>

        {/* Header — yellow gradient, identical to Holidays/Notices */}
        <div className="px-7 pt-6 pb-5 border-b border-[#F1F1F1] flex-shrink-0"
          style={{ background: "linear-gradient(160deg,#fff7d6 0%,#f8ebbf 50%,#f5e4a8 100%)" }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#9a7a18] text-[10px] font-semibold tracking-[0.18em] mb-1">
                COMMUNICATIONS · EVENTS
              </p>
              <h2 className="text-[#3a2a08] font-bold text-lg">
                {initial?.id ? "Edit Event" : "Add Event"}
              </h2>
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
            <label className={labelCls}>Event Title *</label>
            <input className={inputCls} placeholder="e.g. Annual Sports Day"
              value={form.title} onChange={e => set("title", e.target.value)} />
          </div>

          {/* Description */}
          <div>
            <label className={labelCls}>Description</label>
            <textarea className={inputCls + " min-h-[72px] resize-none"} rows={2}
              placeholder="Optional details for parents and staff…"
              value={form.description} onChange={e => set("description", e.target.value)} />
          </div>

          {/* Date + Times */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Event Date *</label>
              <input type="date" className={inputCls}
                value={form.eventDate} onChange={e => set("eventDate", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Start Time *</label>
              <input type="time" className={inputCls}
                value={form.startTime} onChange={e => set("startTime", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>End Time</label>
              <input type="time" className={inputCls}
                value={form.endTime} onChange={e => set("endTime", e.target.value)} />
            </div>
          </div>

          {/* Venue */}
          <div>
            <label className={labelCls}>Venue / Location *</label>
            <input className={inputCls} placeholder="e.g. School Grounds, Main Hall"
              value={form.venue} onChange={e => set("venue", e.target.value)} />
          </div>

          {/* Affected Classes */}
          <div>
            <label className={labelCls}>Affected Classes *</label>
            <div className="flex gap-3 mb-3">
              {[
                { value: "all",      label: "All Classes" },
                { value: "selected", label: "Selected Classes" },
              ].map(({ value, label }) => (
                <button key={value} type="button"
                  onClick={() => { set("appliesTo", value); if (value === "all") set("classIds", []); }}
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

          {/* Toggles */}
          <div className="flex items-center gap-3 flex-wrap">
            {[
              { key: "pushToParentApp", label: "Push to parent app" },
              { key: "rsvpRequired",    label: "RSVP required" },
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
          <button onClick={handleSave} disabled={saving || !canSave}
            className="flex-[2] py-2.5 rounded-xl text-sm font-semibold text-[#5a4010] disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
            style={{
              background: canSave && !saving
                ? "linear-gradient(160deg,#f9dc5a 0%,#f0c930 100%)"
                : "#F1F1F1",
              boxShadow: canSave && !saving
                ? "0 4px 14px rgba(212,170,31,0.28)"
                : "none",
              color: canSave && !saving ? "#5a4010" : "#a3957e",
            }}>
            {saving ? "Saving…" : initial?.id ? "Save Changes" : "Add Event"}
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
        style={{
          background: "linear-gradient(160deg,#fff7d6 0%,#f5e4a8 100%)",
          boxShadow: "0 4px 16px rgba(212,170,31,0.15)",
        }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#c79b12" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
          <polyline points="9 16 11 18 15 14"/>
        </svg>
      </div>
      <p className="text-lg font-bold text-[#2a1c06]">No events yet</p>
      <p className="text-[#a3957e] text-sm mt-1.5 max-w-[240px] mx-auto leading-relaxed">
        Add school events, trips, and celebrations for parents to see.
      </p>
      <button onClick={onAdd}
        className="mt-5 px-6 py-2.5 rounded-xl text-[#5a4010] font-semibold text-sm transition-all active:scale-95"
        style={{
          background: "linear-gradient(160deg,#f9dc5a 0%,#f0c930 100%)",
          boxShadow: "0 4px 14px rgba(212,170,31,0.28)",
        }}>
        Add First Event
      </button>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

const STATUS_FILTERS = ["All", "Upcoming", "Ongoing", "Completed"];

export default function Events() {
  const [events,   setEvents]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [filter,   setFilter]   = useState("All");
  const [search,   setSearch]   = useState("");
  const [modal,    setModal]    = useState(null);   // null | { initial }
  const [classMap, setClassMap] = useState({});

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [evData, classes] = await Promise.all([
        eventService.getEvents(),
        academicsService.getClasses().catch(() => []),
      ]);
      setEvents(evData.events || []);
      const map = {};
      (classes || []).forEach(c => { map[c.id] = c.name; });
      setClassMap(map);
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to load events.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (form) => {
    if (form.id) {
      const updated = await eventService.updateEvent(form.id, form);
      setEvents(prev => prev.map(e => e.id === updated.event?.id ? updated.event : e));
    } else {
      const created = await eventService.createEvent(form);
      setEvents(prev => [created.event, ...prev]);
    }
    setModal(null);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this event?")) return;
    await eventService.deleteEvent(id);
    setEvents(prev => prev.filter(e => e.id !== id));
  };

  // Filter + search
  const filtered = events.filter(ev => {
    const matchStatus = filter === "All" || eventStatus(ev.eventDate) === filter.toLowerCase();
    const matchSearch = !search || ev.title.toLowerCase().includes(search.toLowerCase())
      || (ev.venue || "").toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const today     = todayISO();
  const upcoming  = filtered.filter(ev => (ev.eventDate || "") >= today);
  const completed = filtered.filter(ev => ev.eventDate && ev.eventDate < today);

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

        {/* ── Sticky header ── */}
        <div className="flex-shrink-0 bg-white/95 backdrop-blur-2xl border-b border-[#F1F1F1] shadow-[0_1px_12px_rgba(180,140,0,0.07)] z-20">
          <div className="px-6 md:px-10 py-3 md:py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <p className="text-[#9a7a18] text-[10px] font-semibold tracking-[0.18em] mb-0.5">COMMUNICATIONS</p>
              <h1 className="text-3xl md:text-4xl font-black text-[#2a1c06] tracking-tight leading-none">Events</h1>
              <p className="text-[#a3957e] text-sm mt-0.5 font-normal">School events, trips & celebrations</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Search */}
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#c4b090]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search events…"
                  className="pl-9 pr-4 py-2 rounded-xl border border-[#F1F1F1] bg-white text-sm text-[#2a1c06] outline-none focus:ring-2 focus:ring-[#f4c430]/35 w-44 placeholder-[#c4b090]"/>
              </div>
              {/* Add button */}
              <button onClick={() => setModal({ initial: null })}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[#5a4010] text-sm font-semibold transition-all active:scale-95"
                style={{
                  background: "linear-gradient(160deg,#f9dc5a 0%,#f0c930 100%)",
                  boxShadow: "0 3px 10px rgba(212,170,31,0.28)",
                }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Add Event
              </button>
            </div>
          </div>

          {/* Status filter chips */}
          <div className="px-6 md:px-10 pb-3 flex items-center gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {STATUS_FILTERS.map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`flex-shrink-0 px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
                  filter === f
                    ? "bg-[#f9dc5a] text-[#5a4010] shadow-sm"
                    : "bg-[#f8f0d4] text-[#8b7228] hover:bg-[#f0e4a0]"
                }`}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-auto px-6 md:px-10 py-5">
          {loading ? (
            <div className="space-y-3 animate-pulse max-w-3xl">
              {[0,1,2].map(i => (
                <div key={i} className="flex gap-4 p-5 rounded-3xl bg-white border border-[#F1F1F1]">
                  <div className="w-[68px] h-[68px] rounded-3xl bg-[#F1F1F1] flex-shrink-0"/>
                  <div className="flex-1 space-y-2 pt-2">
                    <div className="h-4 bg-[#F1F1F1] rounded-full w-48"/>
                    <div className="h-3 bg-[#F1F1F1] rounded-full w-64"/>
                    <div className="h-2.5 bg-[#F1F1F1] rounded-full w-32"/>
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="max-w-3xl p-5 rounded-2xl bg-[#fee8e2] border border-[#e0a898] text-[#7a2018] text-sm font-medium">
              {error}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState onAdd={() => setModal({ initial: null })} />
          ) : (
            <div className="max-w-3xl space-y-10">
              {upcoming.length > 0 && (
                <section>
                  <p className="text-[11px] font-semibold text-[#a3957e] uppercase tracking-[0.18em] mb-4">
                    Upcoming · {upcoming.length}
                  </p>
                  <div className="space-y-3">
                    {upcoming.map(ev => (
                      <EventCard key={ev.id} event={ev} classMap={classMap}
                        onEdit={ev => setModal({ initial: ev })}
                        onDelete={handleDelete} />
                    ))}
                  </div>
                </section>
              )}
              {completed.length > 0 && (
                <section className="opacity-55">
                  <p className="text-[11px] font-semibold text-[#c4b090] uppercase tracking-[0.18em] mb-4">
                    Past · {completed.length}
                  </p>
                  <div className="space-y-3">
                    {completed.map(ev => (
                      <EventCard key={ev.id} event={ev} classMap={classMap}
                        onEdit={ev => setModal({ initial: ev })}
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
        <EventModal
          initial={modal.initial}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
