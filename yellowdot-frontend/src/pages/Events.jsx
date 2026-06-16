// ─────────────────────────────────────────────────────────────────────────────
// Events — school event management (Communications)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from "react";
import Sidebar from "../components/Sidebar";
import eventService from "../services/eventService";
import academicsService from "../services/academicsService";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

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
  const h12  = h % 12 || 12;
  return `${h12}:${String(m).padStart(2,"0")} ${ampm}`;
}

function eventStatus(eventDate) {
  if (!eventDate) return "upcoming";
  const today = todayISO();
  if (eventDate < today) return "completed";
  if (eventDate === today) return "ongoing";
  return "upcoming";
}

const STATUS_STYLE = {
  upcoming:  "bg-[#edf4ff] text-[#2563b8] border-[#bfdbfe]",
  ongoing:   "bg-[#f0fdf4] text-[#15803d] border-[#bbf7d0]",
  completed: "bg-[#F1F1F1] text-[#6b7280] border-[#e5e7eb]",
};

// ── ClassBadges ───────────────────────────────────────────────────────────────

function ClassBadges({ event, classMap }) {
  if (event.appliesTo === "selected") {
    const ids = event.classIds || [];
    if (ids.length === 0) return null;
    return (
      <>
        {ids.slice(0, 3).map(id => (
          <span key={id} className="inline-flex items-center px-2 py-0.5 rounded-lg bg-[#edf4ff] text-[#2563b8] text-[10px] font-semibold border border-[#bfdbfe]">
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
  const status   = eventStatus(event.eventDate);
  const dayNum   = event.eventDate ? new Date(event.eventDate + "T00:00:00").getDate() : "—";
  const monthStr = event.eventDate ? MONTHS[new Date(event.eventDate + "T00:00:00").getMonth()] : "";

  return (
    <div className="group flex gap-5 p-6 rounded-3xl border border-[#F1F1F1] bg-white transition-all duration-[200ms] hover:shadow-[0_10px_36px_rgba(99,102,241,0.09)] hover:-translate-y-1 hover:border-[#c7d2fe]">
      {/* Date block */}
      <div className="flex-shrink-0 flex flex-col items-center justify-center w-[68px] h-[68px] rounded-3xl"
        style={{ background: "linear-gradient(160deg,#a5b4fc 0%,#6366f1 100%)", boxShadow: "0 4px 16px rgba(99,102,241,0.28), inset 0 1px 0 rgba(255,255,255,0.35)" }}>
        <span className="text-white/70 text-[10px] font-bold leading-none tracking-widest uppercase">{monthStr}</span>
        <span className="text-white text-[26px] font-black leading-tight tabular-nums">{dayNum}</span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 py-0.5">
        <h3 className="text-[#1e1b4b] font-bold text-base leading-snug">{event.title}</h3>
        <p className="text-[#6b7280] text-[13px] font-normal mt-0.5 mb-2.5">
          {fmtDate(event.eventDate)}
          {event.startTime && ` · ${fmtTime(event.startTime)}${event.endTime ? ` – ${fmtTime(event.endTime)}` : ""}`}
          {event.venue && ` · ${event.venue}`}
        </p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-lg border text-[10px] font-semibold capitalize ${STATUS_STYLE[status]}`}>
            {status}
          </span>
          {event.rsvpRequired && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-[#fef3c7] text-[#92400e] text-[10px] font-semibold border border-[#fde68a]">
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

      {/* Actions */}
      <div className="flex-shrink-0 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => onEdit(event)} title="Edit"
          className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#eef2ff] hover:bg-[#e0e7ff] text-[#6366f1] transition-all">
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
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
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
          ${open ? "ring-2 ring-[#6366f1]/25 border-[#6366f1]/50" : "border-[#F1F1F1]"}
          bg-white text-left`}>
        <span className={selectedIds.length === 0 ? "text-[#c4b090]" : "text-[#1e1b4b] font-medium"}>{label}</span>
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
                    ${checked ? "bg-[#eef2ff]" : "hover:bg-[#f5f5ff]"}`}>
                  <div className={`w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0 transition-all
                    ${checked ? "bg-[#6366f1] border-[#6366f1]" : "border-[#d4c8b0]"}`}>
                    {checked && (
                      <svg width="9" height="9" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4l3 3 5-6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <span className={checked ? "text-[#1e1b4b] font-semibold" : "text-[#4b5563]"}>{cls.name}</span>
                  {cls.ageGroup && <span className="text-[#a3957e] text-[11px] ml-auto">{cls.ageGroup}</span>}
                </button>
              );
            })}
          </div>
          {selectedIds.length > 0 && (
            <div className="px-4 py-2 border-t border-[#F1F1F1]">
              <button type="button" onClick={() => onChange([])}
                className="text-[11px] font-semibold text-[#a3957e] hover:text-[#6366f1] transition-colors">
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
    ...EMPTY, ...initial,
    appliesTo: initial?.appliesTo || "all",
    classIds:  initial?.classIds  || [],
  }));
  const [saving,  setSaving]  = useState(false);
  const [classes, setClasses] = useState([]);

  useEffect(() => {
    academicsService.getClasses().then(setClasses).catch(() => setClasses([]));
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const canSave =
    form.title.trim() &&
    form.eventDate &&
    form.startTime &&
    form.venue.trim() &&
    !(form.appliesTo === "selected" && form.classIds.length === 0);

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  };

  const inputCls = "w-full px-4 py-2.5 rounded-xl border border-[#F1F1F1] bg-white text-[#1e1b4b] text-sm outline-none focus:ring-2 focus:ring-[#6366f1]/25 focus:border-[#6366f1]/50 transition-all placeholder-[#c4b090]";
  const labelCls = "block text-xs font-semibold text-[#6b7280] mb-1.5 uppercase tracking-wide";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        style={{ boxShadow: "0 32px 80px rgba(0,0,0,0.22)" }}>

        <div className="flex items-center justify-between px-7 pt-7 pb-5 border-b border-[#f0eef8]">
          <h2 className="text-xl font-black text-[#1e1b4b]">
            {initial?.id ? "Edit Event" : "New Event"}
          </h2>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-[#f5f5ff] text-[#9ca3af] hover:text-[#6366f1] transition-all">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="px-7 py-6 flex flex-col gap-5">
          {/* Title */}
          <div>
            <label className={labelCls}>Event Title *</label>
            <input className={inputCls} placeholder="e.g. Annual Sports Day" value={form.title}
              onChange={e => set("title", e.target.value)} />
          </div>

          {/* Description */}
          <div>
            <label className={labelCls}>Description</label>
            <textarea className={inputCls + " min-h-[80px] resize-none"} placeholder="Event details…"
              value={form.description} onChange={e => set("description", e.target.value)} />
          </div>

          {/* Date + Times */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Event Date *</label>
              <input type="date" className={inputCls} value={form.eventDate} onChange={e => set("eventDate", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Start Time *</label>
              <input type="time" className={inputCls} value={form.startTime} onChange={e => set("startTime", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>End Time</label>
              <input type="time" className={inputCls} value={form.endTime} onChange={e => set("endTime", e.target.value)} />
            </div>
          </div>

          {/* Venue */}
          <div>
            <label className={labelCls}>Venue / Location *</label>
            <input className={inputCls} placeholder="e.g. School Grounds, Main Hall" value={form.venue}
              onChange={e => set("venue", e.target.value)} />
          </div>

          {/* Affected Classes */}
          <div>
            <label className={labelCls}>Affected Classes *</label>
            <div className="flex gap-3 mb-3">
              {["all", "selected"].map(v => (
                <label key={v} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="appliesTo" value={v} checked={form.appliesTo === v}
                    onChange={() => { set("appliesTo", v); if (v === "all") set("classIds", []); }}
                    className="accent-[#6366f1]" />
                  <span className="text-sm text-[#4b5563] font-medium capitalize">
                    {v === "all" ? "All Classes" : "Selected Classes"}
                  </span>
                </label>
              ))}
            </div>
            {form.appliesTo === "selected" && (
              <ClassMultiSelect classes={classes} selectedIds={form.classIds} onChange={ids => set("classIds", ids)} />
            )}
          </div>

          {/* Toggles */}
          <div className="flex flex-col gap-3 pt-1">
            <Toggle label="Push to Parent App" checked={form.pushToParentApp}
              onChange={v => set("pushToParentApp", v)} />
            <Toggle label="RSVP Required" checked={form.rsvpRequired}
              onChange={v => set("rsvpRequired", v)} />
          </div>
        </div>

        <div className="px-7 pb-7 flex gap-3">
          <button onClick={onClose}
            className="flex-1 px-4 py-3 rounded-2xl border border-[#F1F1F1] text-[#6b7280] text-sm font-semibold hover:bg-[#f9f9f9] transition-all">
            Cancel
          </button>
          <button onClick={handleSave} disabled={!canSave || saving}
            className={`flex-1 px-4 py-3 rounded-2xl text-sm font-bold transition-all
              ${canSave && !saving
                ? "bg-[#6366f1] hover:bg-[#4f46e5] text-white shadow-[0_4px_12px_rgba(99,102,241,0.35)]"
                : "bg-[#F1F1F1] text-[#c4b090] cursor-not-allowed"}`}>
            {saving ? "Saving…" : initial?.id ? "Save Changes" : "Create Event"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer">
      <span className="text-sm text-[#4b5563] font-medium">{label}</span>
      <button type="button" onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors ${checked ? "bg-[#6366f1]" : "bg-[#d1d5db]"}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? "translate-x-5" : ""}`} />
      </button>
    </label>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Events() {
  const [events,    setEvents]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [modal,     setModal]     = useState(null); // null | { initial }
  const [classMap,  setClassMap]  = useState({});
  const [filter,    setFilter]    = useState("all"); // "all" | "upcoming" | "ongoing" | "completed"
  const [deleting,  setDeleting]  = useState(null);

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
      await eventService.updateEvent(form.id, form);
    } else {
      await eventService.createEvent(form);
    }
    setModal(null);
    load();
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this event?")) return;
    setDeleting(id);
    try {
      await eventService.deleteEvent(id);
      setEvents(ev => ev.filter(e => e.id !== id));
    } catch { /* ignore */ } finally { setDeleting(null); }
  };

  const filtered = events.filter(e => {
    if (filter === "all") return true;
    return eventStatus(e.eventDate) === filter;
  });

  const TABS = ["all", "upcoming", "ongoing", "completed"];

  return (
    <div className="flex h-screen overflow-hidden bg-[#FAFAFA]">
      <Sidebar />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-8 py-10">

          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-[28px] font-black text-[#1e1b4b] leading-tight">Events</h1>
              <p className="text-[#9ca3af] text-sm mt-1">School events, activities & parent invitations</p>
            </div>
            <button onClick={() => setModal({ initial: null })}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#6366f1] hover:bg-[#4f46e5] text-white text-sm font-bold transition-all"
              style={{ boxShadow: "0 4px 14px rgba(99,102,241,0.35)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              New Event
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            {TABS.map(t => (
              <button key={t} onClick={() => setFilter(t)}
                className={`px-4 py-1.5 rounded-xl text-sm font-semibold capitalize transition-all
                  ${filter === t
                    ? "bg-[#6366f1] text-white"
                    : "bg-white text-[#6b7280] border border-[#F1F1F1] hover:border-[#c7d2fe] hover:text-[#6366f1]"}`}>
                {t}
              </button>
            ))}
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex flex-col gap-4">
              {[1,2,3].map(i => (
                <div key={i} className="h-28 rounded-3xl bg-white border border-[#F1F1F1] animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="p-5 rounded-2xl bg-[#fee8e2] text-[#c0402a] text-sm font-medium">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-3xl flex items-center justify-center text-3xl mb-4"
                style={{ background: "linear-gradient(160deg,#a5b4fc 0%,#6366f1 100%)", boxShadow: "0 4px 16px rgba(99,102,241,0.28)" }}>
                🎉
              </div>
              <h2 className="text-lg font-bold text-[#1e1b4b] mb-1">
                {filter === "all" ? "No events yet" : `No ${filter} events`}
              </h2>
              <p className="text-[#9ca3af] text-sm">
                {filter === "all" ? "Create your first event to get started." : "Events will appear here."}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {filtered.map(ev => (
                <EventCard key={ev.id} event={ev} classMap={classMap}
                  onEdit={e => setModal({ initial: e })}
                  onDelete={handleDelete} />
              ))}
            </div>
          )}
        </div>
      </div>

      {modal && (
        <EventModal
          initial={modal.initial}
          onSave={handleSave}
          onClose={() => setModal(null)} />
      )}
    </div>
  );
}
