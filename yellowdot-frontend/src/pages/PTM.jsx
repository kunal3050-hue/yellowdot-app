// ─────────────────────────────────────────────────────────────────────────────
// PTM — Parent-Teacher Meeting management (Communications)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from "react";
import Sidebar from "../components/Sidebar";
import ptmService from "../services/ptmService";
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
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function ptmStatus(meetingDate) {
  if (!meetingDate) return "upcoming";
  const today = todayISO();
  if (meetingDate < today)   return "completed";
  if (meetingDate === today) return "today";
  return "upcoming";
}

const STATUS_STYLE = {
  upcoming:  "bg-[#f8f4d8] text-[#5a4d18] border-[#d4bc58]",
  today:     "bg-[#f9dc5a]/30 text-[#5a4010] border-[#d4b830]",
  completed: "bg-[#F1F1F1] text-[#8b7d65] border-[#e0d4b8]",
};
const STATUS_LABEL = { upcoming: "Upcoming", today: "Today!", completed: "Completed" };

const DURATION_OPTIONS = [
  { label: "10 min", value: 10 },
  { label: "15 min", value: 15 },
  { label: "20 min", value: 20 },
  { label: "30 min", value: 30 },
  { label: "Custom", value: 0 },
];

// ── Shared sub-components ─────────────────────────────────────────────────────

function ClassBadges({ item, classMap }) {
  if (item.appliesTo === "selected") {
    const ids = item.classIds || [];
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

function ClassMultiSelect({ classes, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = id => onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);

  const label = selected.length === 0
    ? "Select classes"
    : selected.length === classes.length
      ? "All classes selected"
      : `${selected.length} class${selected.length > 1 ? "es" : ""} selected`;

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border border-[#e5dfc0] bg-white text-sm text-[#3a2a06] hover:border-[#c9a830]/60 focus:outline-none focus:ring-2 focus:ring-[#f4c430]/35 transition-all">
        <span className={selected.length === 0 ? "text-[#a39070]" : ""}>{label}</span>
        <svg className={`w-4 h-4 text-[#9a7a18] transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-2xl border border-[#e5dfc0] bg-white shadow-lg overflow-hidden">
          <div className="max-h-56 overflow-y-auto py-1">
            {classes.map(cls => (
              <label key={cls.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[#fff7d6] transition-colors">
                <input type="checkbox" checked={selected.includes(cls.id)} onChange={() => toggle(cls.id)}
                  className="w-4 h-4 rounded accent-[#f4c430] cursor-pointer" />
                <span className="text-sm text-[#3a2a06]">{cls.name}</span>
              </label>
            ))}
            {classes.length === 0 && <p className="px-4 py-3 text-sm text-[#9a7a18]">No classes available.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── PTM Card ──────────────────────────────────────────────────────────────────

function PtmCard({ ptm, onEdit, onDelete, onSlots, onBookings, classMap, teacherMap }) {
  const status  = ptmStatus(ptm.meetingDate);
  const isToday = status === "today";
  const stats   = ptm.stats || {};

  return (
    <div className={`
      group flex gap-5 p-6 rounded-3xl border transition-all duration-[200ms]
      hover:shadow-[0_10px_36px_rgba(212,170,31,0.13)] hover:-translate-y-1
      ${isToday ? "bg-[#fffdf0] border-[#e8d89a]" : "bg-white border-[#F1F1F1] hover:border-[#e0d4a0] hover:bg-white"}
    `}>
      {/* Date block */}
      <div className="flex-shrink-0 flex flex-col items-center justify-center w-[68px] h-[68px] rounded-3xl"
        style={{
          background: "linear-gradient(160deg,#f9dc5a 0%,#f0c930 100%)",
          boxShadow: "0 4px 16px rgba(212,170,31,0.32), inset 0 1px 0 rgba(255,255,255,0.55)",
        }}>
        <span className="text-[#7a5010] text-[10px] font-bold leading-none tracking-widest uppercase">
          {ptm.meetingDate ? MONTHS[new Date(ptm.meetingDate + "T00:00:00").getMonth()] : ""}
        </span>
        <span className="text-[#3a2a06] text-[26px] font-black leading-tight tabular-nums">
          {ptm.meetingDate ? new Date(ptm.meetingDate + "T00:00:00").getDate() : "—"}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_STYLE[status]}`}>
            {STATUS_LABEL[status]}
          </span>
          <ClassBadges item={ptm} classMap={classMap} />
        </div>

        <h3 className="text-[15px] font-bold text-[#2a1c06] mb-1 leading-snug">{ptm.title}</h3>

        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-[#7a6640] mb-2">
          <span>📅 {fmtDate(ptm.meetingDate)}</span>
          {ptm.startTime && <span>🕐 {fmtTime(ptm.startTime)}{ptm.endTime ? ` – ${fmtTime(ptm.endTime)}` : ""}</span>}
          {ptm.venue && <span>📍 {ptm.venue}</span>}
        </div>

        {/* Teachers */}
        {(ptm.teacherIds || []).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {ptm.teacherIds.map(tid => (
              <span key={tid}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#f8f4d8] text-[#5a4d18] text-[10px] font-semibold border border-[#d4bc58]">
                👤 {teacherMap[tid] || tid}
              </span>
            ))}
          </div>
        )}

        {/* Stats */}
        {(stats.total > 0) && (
          <div className="flex gap-3 mb-3">
            {[
              { label: "Total", value: stats.total,    color: "text-[#5a4d18]",  bg: "bg-[#f8f4d8]" },
              { label: "Booked", value: stats.booked,  color: "text-[#1d4ed8]",  bg: "bg-[#eff6ff]" },
              { label: "Free",   value: stats.available, color: "text-[#15803d]", bg: "bg-[#f0fdf4]" },
              { label: "Attended", value: stats.attended, color: "text-[#0f766e]", bg: "bg-[#f0fdfa]" },
            ].map(s => (
              <div key={s.label} className={`flex flex-col items-center px-3 py-1.5 rounded-xl ${s.bg}`}>
                <span className={`text-[16px] font-black tabular-nums ${s.color}`}>{s.value}</span>
                <span className="text-[9px] font-semibold text-[#8b7228] uppercase tracking-wide">{s.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 items-end justify-between flex-shrink-0">
        <div className="flex gap-1.5">
          <button onClick={() => onEdit(ptm)}
            className="p-2 rounded-xl hover:bg-[#fff7d6] text-[#9a7a18] hover:text-[#5a4010] transition-colors" title="Edit">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button onClick={() => onDelete(ptm)}
            className="p-2 rounded-xl hover:bg-red-50 text-[#9a7a18] hover:text-red-500 transition-colors" title="Delete">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
        <div className="flex flex-col gap-1.5 items-end">
          <button onClick={() => onSlots(ptm)}
            className="px-3 py-1.5 rounded-xl text-[11px] font-semibold text-[#5a4010] bg-[#f9dc5a]/30 border border-[#d4b830] hover:bg-[#f9dc5a]/50 transition-colors whitespace-nowrap">
            Manage Slots
          </button>
          <button onClick={() => onBookings(ptm)}
            className="px-3 py-1.5 rounded-xl text-[11px] font-semibold text-[#1d4ed8] bg-[#eff6ff] border border-[#bfdbfe] hover:bg-[#dbeafe] transition-colors whitespace-nowrap">
            View Bookings
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PTM Form Modal ────────────────────────────────────────────────────────────

function PtmModal({ ptm, classes, teachers, onSave, onClose }) {
  const isEdit = !!ptm?.id;
  const [form, setForm] = useState({
    title:        ptm?.title        || "",
    description:  ptm?.description  || "",
    meetingDate:  ptm?.meetingDate  || "",
    startTime:    ptm?.startTime    || "",
    endTime:      ptm?.endTime      || "",
    venue:        ptm?.venue        || "",
    appliesTo:    ptm?.appliesTo    || "all",
    classIds:     ptm?.classIds     || [],
    teacherIds:   ptm?.teacherIds   || [],
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggleTeacher = (tid) => {
    set("teacherIds", form.teacherIds.includes(tid)
      ? form.teacherIds.filter(x => x !== tid)
      : [...form.teacherIds, tid]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim())    return setError("PTM title is required.");
    if (!form.meetingDate)     return setError("Meeting date is required.");
    if (!form.startTime)       return setError("Start time is required.");
    if (!form.endTime)         return setError("End time is required.");
    if (!form.venue.trim())    return setError("Venue is required.");
    if (form.teacherIds.length === 0) return setError("Select at least one teacher.");
    setSaving(true);
    setError("");
    try {
      await onSave({ ...form });
      onClose();
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full px-4 py-3 rounded-2xl border border-[#e5dfc0] bg-white text-[#3a2a06] text-sm placeholder:text-[#a39070] focus:outline-none focus:ring-2 focus:ring-[#f4c430]/35 focus:border-[#c9a830]/60 transition-all";
  const labelCls = "block text-[11px] font-bold text-[#9a7a18] uppercase tracking-[0.1em] mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 px-7 pt-6 pb-5 rounded-t-3xl"
          style={{ background: "linear-gradient(160deg,#fff7d6 0%,#f8ebbf 50%,#f5e4a8 100%)" }}>
          <p className="text-[9px] font-black text-[#9a7a18] tracking-[0.22em] uppercase mb-1">COMMUNICATIONS · PTM</p>
          <h2 className="text-xl font-black text-[#2a1c06]">{isEdit ? "Edit PTM" : "New Parent-Teacher Meeting"}</h2>
          <button onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-xl hover:bg-[#f0c930]/30 text-[#9a7a18] transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-7 py-6 flex flex-col gap-4">
          <div>
            <label className={labelCls}>PTM Title *</label>
            <input className={inputCls} placeholder="e.g. Term 1 Parent-Teacher Meeting" value={form.title} onChange={e => set("title", e.target.value)} />
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <textarea rows={2} className={inputCls + " resize-none"} placeholder="Optional details about this PTM…" value={form.description} onChange={e => set("description", e.target.value)} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Meeting Date *</label>
              <input type="date" className={inputCls} value={form.meetingDate} onChange={e => set("meetingDate", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Start Time *</label>
              <input type="time" className={inputCls} value={form.startTime} onChange={e => set("startTime", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>End Time *</label>
              <input type="time" className={inputCls} value={form.endTime} onChange={e => set("endTime", e.target.value)} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Venue / Location *</label>
            <input className={inputCls} placeholder="e.g. School Auditorium, Individual Classrooms" value={form.venue} onChange={e => set("venue", e.target.value)} />
          </div>

          {/* Affected Classes */}
          <div>
            <label className={labelCls}>Affected Classes *</label>
            <div className="flex gap-3 mb-2">
              {["all","selected"].map(v => (
                <button key={v} type="button" onClick={() => set("appliesTo", v)}
                  className={`flex-1 py-2.5 rounded-2xl text-sm font-semibold border transition-all ${
                    form.appliesTo === v
                      ? "bg-[#f9dc5a]/30 border-[#d4b830] text-[#5a4010]"
                      : "bg-[#f8f4d8]/50 border-[#e5dfc0] text-[#9a7228]"
                  }`}>
                  {v === "all" ? "All Classes" : "Selected Classes"}
                </button>
              ))}
            </div>
            {form.appliesTo === "selected" && (
              <ClassMultiSelect classes={classes} selected={form.classIds} onChange={v => set("classIds", v)} />
            )}
          </div>

          {/* Teachers */}
          <div>
            <label className={labelCls}>Teachers *</label>
            <div className="flex flex-wrap gap-2">
              {teachers.map(t => {
                const sel = form.teacherIds.includes(t.userId);
                return (
                  <button key={t.userId} type="button" onClick={() => toggleTeacher(t.userId)}
                    className={`px-3 py-1.5 rounded-xl text-sm font-semibold border transition-all ${
                      sel
                        ? "bg-[#f9dc5a]/30 border-[#d4b830] text-[#5a4010]"
                        : "bg-white border-[#e5dfc0] text-[#9a7a18]"
                    }`}>
                    {t.name}
                  </button>
                );
              })}
              {teachers.length === 0 && (
                <p className="text-sm text-[#a39070]">No teachers found. Make sure teachers are added in User Management.</p>
              )}
            </div>
          </div>

          {error && <p className="text-red-500 text-sm bg-red-50 rounded-xl px-4 py-2.5">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-3 rounded-2xl border border-[#e5dfc0] text-[#9a7228] font-semibold text-sm hover:bg-[#f8f4d8] transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-3 rounded-2xl font-bold text-sm text-[#5a4010] disabled:opacity-50 transition-all"
              style={{ background: "linear-gradient(160deg,#f9dc5a 0%,#f0c930 100%)", boxShadow: "0 4px 14px rgba(212,170,31,0.35)" }}>
              {saving ? "Saving…" : isEdit ? "Save Changes" : "Create PTM"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Slots Manager Modal ───────────────────────────────────────────────────────

function SlotsModal({ ptm, teachers, onClose }) {
  const [slots,       setSlots]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [selTeacher,  setSelTeacher]  = useState(ptm.teacherIds?.[0] || "");
  const [duration,    setDuration]    = useState(15);
  const [customDur,   setCustomDur]   = useState("");
  const [generating,  setGenerating]  = useState(false);
  const [error,       setError]       = useState("");

  const teachersInPtm = teachers.filter(t => (ptm.teacherIds || []).includes(t.userId));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { slots: s } = await ptmService.getSlots(ptm.id);
      setSlots(s || []);
    } catch { setError("Failed to load slots."); }
    finally { setLoading(false); }
  }, [ptm.id]);

  useEffect(() => { load(); }, [load]);

  const handleGenerate = async () => {
    const dur = duration === 0 ? parseInt(customDur, 10) : duration;
    if (!selTeacher) return setError("Select a teacher.");
    if (!dur || dur < 5) return setError("Duration must be at least 5 minutes.");
    const teacher = teachersInPtm.find(t => t.userId === selTeacher);
    setGenerating(true);
    setError("");
    try {
      await ptmService.generateSlots(ptm.id, {
        teacherId:       selTeacher,
        teacherName:     teacher?.name || "",
        startTime:       ptm.startTime,
        endTime:         ptm.endTime,
        durationMinutes: dur,
      });
      await load();
    } catch (e) { setError(e?.response?.data?.error || e.message || "Failed to generate slots."); }
    finally { setGenerating(false); }
  };

  const handleDeleteSlot = async (slotId) => {
    try {
      await ptmService.deleteSlot(ptm.id, slotId);
      setSlots(s => s.filter(x => x.id !== slotId));
    } catch (e) { setError(e?.response?.data?.error || e.message); }
  };

  const slotsByTeacher = {};
  for (const slot of slots) {
    if (!slotsByTeacher[slot.teacherId]) slotsByTeacher[slot.teacherId] = [];
    slotsByTeacher[slot.teacherId].push(slot);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl bg-white shadow-2xl">
        {/* Header */}
        <div className="px-7 pt-6 pb-5 rounded-t-3xl flex-shrink-0"
          style={{ background: "linear-gradient(160deg,#fff7d6 0%,#f8ebbf 50%,#f5e4a8 100%)" }}>
          <p className="text-[9px] font-black text-[#9a7a18] tracking-[0.22em] uppercase mb-1">MANAGE SLOTS</p>
          <h2 className="text-xl font-black text-[#2a1c06]">{ptm.title}</h2>
          <p className="text-[12px] text-[#9a7a18] mt-0.5">{fmtDate(ptm.meetingDate)} · {fmtTime(ptm.startTime)} – {fmtTime(ptm.endTime)}</p>
          <button onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-xl hover:bg-[#f0c930]/30 text-[#9a7a18] transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Generate controls */}
        <div className="px-7 py-4 border-b border-[#F1F1F1] flex-shrink-0 bg-[#fafaf8]">
          <p className="text-[11px] font-bold text-[#9a7a18] uppercase tracking-wide mb-3">Auto-Generate Slots</p>
          <div className="flex flex-wrap gap-3 items-end">
            {/* Teacher selector */}
            <div className="flex-1 min-w-[160px]">
              <label className="block text-[10px] font-bold text-[#9a7a18] mb-1">Teacher</label>
              <select value={selTeacher} onChange={e => setSelTeacher(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#e5dfc0] bg-white text-sm text-[#3a2a06] focus:outline-none focus:ring-2 focus:ring-[#f4c430]/35">
                <option value="">Select teacher…</option>
                {teachersInPtm.map(t => (
                  <option key={t.userId} value={t.userId}>{t.name}</option>
                ))}
              </select>
            </div>
            {/* Duration */}
            <div>
              <label className="block text-[10px] font-bold text-[#9a7a18] mb-1">Slot Duration</label>
              <div className="flex gap-1.5">
                {DURATION_OPTIONS.map(opt => (
                  <button key={opt.value} type="button" onClick={() => setDuration(opt.value)}
                    className={`px-3 py-2 rounded-xl text-[11px] font-semibold border transition-all ${
                      duration === opt.value
                        ? "bg-[#f9dc5a]/30 border-[#d4b830] text-[#5a4010]"
                        : "bg-white border-[#e5dfc0] text-[#9a7a18]"
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
              {duration === 0 && (
                <input type="number" min={5} max={120} placeholder="Min" value={customDur} onChange={e => setCustomDur(e.target.value)}
                  className="mt-1.5 w-20 px-3 py-2 rounded-xl border border-[#e5dfc0] bg-white text-sm text-[#3a2a06] focus:outline-none focus:ring-2 focus:ring-[#f4c430]/35" />
              )}
            </div>
            <button onClick={handleGenerate} disabled={generating}
              className="px-5 py-2 rounded-xl text-sm font-bold text-[#5a4010] disabled:opacity-50 transition-all"
              style={{ background: "linear-gradient(160deg,#f9dc5a 0%,#f0c930 100%)" }}>
              {generating ? "Generating…" : "Generate"}
            </button>
          </div>
          {error && <p className="mt-2 text-red-500 text-sm">{error}</p>}
        </div>

        {/* Slots list */}
        <div className="flex-1 overflow-y-auto px-7 py-4">
          {loading ? (
            <p className="text-sm text-[#9a7a18] text-center py-8">Loading slots…</p>
          ) : slots.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-[#a39070] text-sm">No slots yet. Use the generator above to create appointment slots.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {Object.entries(slotsByTeacher).map(([tid, tSlots]) => {
                const teacher = teachersInPtm.find(t => t.userId === tid);
                return (
                  <div key={tid}>
                    <p className="text-[10px] font-bold text-[#9a7a18] uppercase tracking-wide mb-2">
                      👤 {teacher?.name || tSlots[0]?.teacherName || tid}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {tSlots.map(slot => (
                        <div key={slot.id}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[11px] font-semibold ${
                            slot.status === "booked"
                              ? "bg-[#eff6ff] border-[#bfdbfe] text-[#1d4ed8]"
                              : "bg-white border-[#e5dfc0] text-[#5a4d18]"
                          }`}>
                          <span>{fmtTime(slot.startTime)} – {fmtTime(slot.endTime)}</span>
                          {slot.status === "booked"
                            ? <span className="text-[#1d4ed8]">● Booked</span>
                            : <button onClick={() => handleDeleteSlot(slot.id)}
                                className="text-[#c0392b] hover:text-red-600 ml-0.5" title="Delete slot">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                              </button>
                          }
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-7 py-4 border-t border-[#F1F1F1] flex-shrink-0">
          <button onClick={onClose}
            className="w-full py-3 rounded-2xl border border-[#e5dfc0] text-[#9a7228] font-semibold text-sm hover:bg-[#f8f4d8] transition-colors">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Bookings Modal ────────────────────────────────────────────────────────────

function BookingsModal({ ptm, teachers, onClose }) {
  const [bookings, setBookings] = useState([]);
  const [slots,    setSlots]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [notes,    setNotes]    = useState({});   // { bookingId: { ...notesForm, open } }
  const [error,    setError]    = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ bookings: b }, { slots: s }] = await Promise.all([
        ptmService.getBookings(ptm.id),
        ptmService.getSlots(ptm.id),
      ]);
      setBookings(b || []);
      setSlots(s || []);
    } catch { setError("Failed to load bookings."); }
    finally { setLoading(false); }
  }, [ptm.id]);

  useEffect(() => { load(); }, [load]);

  const slotMap = Object.fromEntries(slots.map(s => [s.id, s]));
  const teachersInPtm = teachers.filter(t => (ptm.teacherIds || []).includes(t.userId));
  const teacherMap = Object.fromEntries(teachersInPtm.map(t => [t.userId, t.name]));

  const handleStatus = async (bookingId, status) => {
    try {
      await ptmService.updateBookingStatus(bookingId, status);
      setBookings(bs => bs.map(b => b.id === bookingId ? { ...b, status } : b));
    } catch (e) { setError(e?.response?.data?.error || e.message); }
  };

  const openNotes = async (booking) => {
    const slot = slotMap[booking.slotId];
    let existing = {};
    try {
      const { notes: n } = await ptmService.getNotes(ptm.id, booking.studentId);
      if (n) existing = n;
    } catch { /* notes may not exist yet */ }
    setNotes(n => ({
      ...n,
      [booking.id]: {
        open: true,
        studentId:       booking.studentId,
        teacherId:       slot?.teacherId || "",
        summary:         existing.summary        || "",
        strengths:       existing.strengths       || "",
        improvements:    existing.improvements    || "",
        actionItems:     existing.actionItems     || "",
        sharedWithParent: existing.sharedWithParent || false,
        saving: false,
        saved:  false,
      }
    }));
  };

  const saveNotes = async (bookingId) => {
    const n = notes[bookingId];
    setNotes(prev => ({ ...prev, [bookingId]: { ...prev[bookingId], saving: true } }));
    try {
      await ptmService.saveNotes(ptm.id, n.studentId, {
        teacherId: n.teacherId,
        summary:   n.summary,
        strengths: n.strengths,
        improvements: n.improvements,
        actionItems: n.actionItems,
        sharedWithParent: n.sharedWithParent,
      });
      setNotes(prev => ({ ...prev, [bookingId]: { ...prev[bookingId], saving: false, saved: true } }));
    } catch (e) {
      setNotes(prev => ({ ...prev, [bookingId]: { ...prev[bookingId], saving: false } }));
      setError(e?.response?.data?.error || e.message);
    }
  };

  const updateNote = (bookingId, key, val) => {
    setNotes(prev => ({ ...prev, [bookingId]: { ...prev[bookingId], [key]: val, saved: false } }));
  };

  const bookedSlots = slots.filter(s => s.status === "booked");
  const availableSlots = slots.filter(s => s.status === "available");

  const STATUS_BADGE = {
    confirmed: "bg-[#eff6ff] text-[#1d4ed8] border-[#bfdbfe]",
    attended:  "bg-[#f0fdf4] text-[#15803d] border-[#bbf7d0]",
    missed:    "bg-red-50 text-red-600 border-red-200",
    cancelled: "bg-[#F1F1F1] text-[#6b7280] border-[#e5e7eb]",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl bg-white shadow-2xl">
        {/* Header */}
        <div className="px-7 pt-6 pb-5 rounded-t-3xl flex-shrink-0"
          style={{ background: "linear-gradient(160deg,#fff7d6 0%,#f8ebbf 50%,#f5e4a8 100%)" }}>
          <p className="text-[9px] font-black text-[#9a7a18] tracking-[0.22em] uppercase mb-1">BOOKINGS</p>
          <h2 className="text-xl font-black text-[#2a1c06]">{ptm.title}</h2>
          <p className="text-[12px] text-[#9a7a18] mt-0.5">{bookedSlots.length} booked · {availableSlots.length} available</p>
          <button onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-xl hover:bg-[#f0c930]/30 text-[#9a7a18] transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-7 py-4">
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          {loading ? (
            <p className="text-center text-sm text-[#9a7a18] py-8">Loading…</p>
          ) : bookings.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-[#a39070] text-sm">No bookings yet for this PTM.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {bookings.map(b => {
                const slot    = slotMap[b.slotId] || {};
                const noteState = notes[b.id];
                const inputCls = "w-full px-3 py-2 rounded-xl border border-[#e5dfc0] bg-white text-sm text-[#3a2a06] placeholder:text-[#c0a878] focus:outline-none focus:ring-2 focus:ring-[#f4c430]/35 transition-all";
                return (
                  <div key={b.id} className="border border-[#F1F1F1] rounded-2xl p-4 bg-white">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-sm font-bold text-[#2a1c06]">Student: {b.studentId}</p>
                        <p className="text-[11px] text-[#9a7a18]">
                          👤 {teacherMap[slot.teacherId] || slot.teacherName || "—"}
                          {" · "}
                          🕐 {fmtTime(slot.startTime)} – {fmtTime(slot.endTime)}
                        </p>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_BADGE[b.status] || STATUS_BADGE.confirmed}`}>
                        {b.status?.replace("_", " ")?.replace(/\b\w/g, c => c.toUpperCase())}
                      </span>
                    </div>

                    {/* Attendance actions */}
                    {b.status !== "cancelled" && (
                      <div className="flex gap-2 mb-2">
                        {b.status !== "attended" && (
                          <button onClick={() => handleStatus(b.id, "attended")}
                            className="flex-1 py-1.5 rounded-xl text-[11px] font-semibold bg-[#f0fdf4] text-[#15803d] border border-[#bbf7d0] hover:bg-green-100 transition-colors">
                            Mark Attended
                          </button>
                        )}
                        {b.status !== "missed" && (
                          <button onClick={() => handleStatus(b.id, "missed")}
                            className="flex-1 py-1.5 rounded-xl text-[11px] font-semibold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors">
                            Mark Missed
                          </button>
                        )}
                      </div>
                    )}

                    {/* Notes */}
                    {!noteState?.open ? (
                      <button onClick={() => openNotes(b)}
                        className="text-[11px] font-semibold text-[#9a7a18] underline underline-offset-2">
                        {b.status === "attended" ? "Add / Edit Notes" : "View Notes"}
                      </button>
                    ) : (
                      <div className="mt-2 pt-3 border-t border-[#F1F1F1] flex flex-col gap-2">
                        <p className="text-[10px] font-bold text-[#9a7a18] uppercase tracking-wide">Meeting Notes</p>
                        <textarea rows={2} className={inputCls} placeholder="Discussion summary…"
                          value={noteState.summary} onChange={e => updateNote(b.id, "summary", e.target.value)} />
                        <div className="grid grid-cols-2 gap-2">
                          <textarea rows={2} className={inputCls} placeholder="Strengths…"
                            value={noteState.strengths} onChange={e => updateNote(b.id, "strengths", e.target.value)} />
                          <textarea rows={2} className={inputCls} placeholder="Areas of improvement…"
                            value={noteState.improvements} onChange={e => updateNote(b.id, "improvements", e.target.value)} />
                        </div>
                        <textarea rows={2} className={inputCls} placeholder="Action items…"
                          value={noteState.actionItems} onChange={e => updateNote(b.id, "actionItems", e.target.value)} />
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={noteState.sharedWithParent}
                              onChange={e => updateNote(b.id, "sharedWithParent", e.target.checked)}
                              className="w-4 h-4 rounded accent-[#f4c430]" />
                            <span className="text-[11px] font-semibold text-[#5a4010]">Share with Parent</span>
                          </label>
                          <button onClick={() => saveNotes(b.id)} disabled={noteState.saving}
                            className="px-4 py-1.5 rounded-xl text-[11px] font-bold text-[#5a4010] disabled:opacity-50"
                            style={{ background: "linear-gradient(160deg,#f9dc5a 0%,#f0c930 100%)" }}>
                            {noteState.saving ? "Saving…" : noteState.saved ? "Saved ✓" : "Save Notes"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-7 py-4 border-t border-[#F1F1F1] flex-shrink-0">
          <button onClick={onClose}
            className="w-full py-3 rounded-2xl border border-[#e5dfc0] text-[#9a7228] font-semibold text-sm hover:bg-[#f8f4d8] transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main PTM Page ─────────────────────────────────────────────────────────────

export default function PTM() {
  const [ptms,      setPtms]      = useState([]);
  const [teachers,  setTeachers]  = useState([]);
  const [classes,   setClasses]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editPtm,   setEditPtm]   = useState(null);
  const [slotsFor,  setSlotsFor]  = useState(null);
  const [bookingsFor, setBookingsFor] = useState(null);
  const [deleting,  setDeleting]  = useState(null);

  const classMap   = Object.fromEntries(classes.map(c => [c.id, c.name]));
  const teacherMap = Object.fromEntries(teachers.map(t => [t.userId, t.name]));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ ptms: p }, { teachers: t }, classData] = await Promise.all([
        ptmService.getPtms(),
        ptmService.getTeachers().catch(() => ({ teachers: [] })),
        academicsService.getClasses().catch(() => []),
      ]);
      setPtms(p || []);
      setTeachers(t || []);
      setClasses(Array.isArray(classData) ? classData : classData?.classes || []);
    } catch { /* handled via loading state */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (form) => {
    if (editPtm?.id) {
      const { ptm } = await ptmService.updatePtm(editPtm.id, form);
      setPtms(ps => ps.map(p => p.id === ptm.id ? { ...p, ...ptm } : p));
    } else {
      const { ptm } = await ptmService.createPtm(form);
      setPtms(ps => [ptm, ...ps]);
    }
  };

  const handleDelete = async (ptm) => {
    if (!window.confirm(`Delete "${ptm.title}"? This will also remove all slots and bookings.`)) return;
    setDeleting(ptm.id);
    try {
      await ptmService.deletePtm(ptm.id);
      setPtms(ps => ps.filter(p => p.id !== ptm.id));
    } catch (e) { alert(e?.response?.data?.error || "Delete failed."); }
    finally { setDeleting(null); }
  };

  const filtered = ptms.filter(p => {
    const s = ptmStatus(p.meetingDate);
    if (filter === "all")       return true;
    if (filter === "upcoming")  return s === "upcoming" || s === "today";
    if (filter === "completed") return s === "completed";
    return true;
  });

  const upcoming  = filtered.filter(p => ptmStatus(p.meetingDate) !== "completed");
  const completed = filtered.filter(p => ptmStatus(p.meetingDate) === "completed");

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="flex-shrink-0 px-8 py-5 border-b border-[#F1F1F1] flex items-center justify-between gap-4"
          style={{ background: "rgba(255,255,255,0.95)", backdropFilter: "blur(18px)", boxShadow: "0 1px 12px rgba(180,140,0,0.07)" }}>
          <div>
            <p className="text-[9px] font-black text-[#9a7a18] tracking-[0.18em] uppercase mb-0.5">COMMUNICATIONS</p>
            <h1 className="text-3xl font-black text-[#2a1c06] leading-none">PTM</h1>
            <p className="text-sm text-[#a08040] mt-0.5">Parent-Teacher Meetings — schedule, manage slots &amp; track bookings</p>
          </div>
          <button
            onClick={() => { setEditPtm(null); setShowModal(true); }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-sm text-[#5a4010] shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
            style={{ background: "linear-gradient(160deg,#f9dc5a 0%,#f0c930 100%)", boxShadow: "0 4px 14px rgba(212,170,31,0.35)" }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New PTM
          </button>
        </header>

        {/* Filter chips */}
        <div className="flex-shrink-0 px-8 py-3 border-b border-[#F1F1F1] flex gap-2">
          {[
            { key: "all",       label: "All" },
            { key: "upcoming",  label: "Upcoming" },
            { key: "completed", label: "Completed" },
          ].map(chip => (
            <button key={chip.key} onClick={() => setFilter(chip.key)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                filter === chip.key
                  ? "bg-[#f9dc5a] text-[#5a4010] border-[#d4b830] shadow-sm"
                  : "bg-[#f8f0d4] text-[#8b7228] border-[#e5dfc0] hover:bg-[#f5e8b0]"
              }`}>
              {chip.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {loading ? (
            <div className="flex flex-col gap-4">
              {[1,2,3].map(i => (
                <div key={i} className="h-40 rounded-3xl bg-[#f8f4e8] animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
                style={{ background: "linear-gradient(160deg,#fff7d6 0%,#f5e4a8 100%)" }}>
                <svg className="w-9 h-9" fill="none" stroke="#c79b12" strokeWidth={1.75} viewBox="0 0 24 24">
                  <path d="M18 21a8 8 0 0 0-16 0" />
                  <circle cx="10" cy="8" r="5" />
                  <path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3" />
                </svg>
              </div>
              <h2 className="text-xl font-black text-[#2a1c06] mb-2">No PTMs yet</h2>
              <p className="text-[#a39070] text-sm max-w-xs mb-6">Schedule your first Parent-Teacher Meeting and manage appointment slots for teachers.</p>
              <button onClick={() => { setEditPtm(null); setShowModal(true); }}
                className="px-6 py-3 rounded-2xl font-bold text-sm text-[#5a4010]"
                style={{ background: "linear-gradient(160deg,#f9dc5a 0%,#f0c930 100%)", boxShadow: "0 4px 14px rgba(212,170,31,0.35)" }}>
                Schedule First PTM
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {upcoming.length > 0 && (
                <section>
                  <p className="text-[11px] font-semibold text-[#a3957e] uppercase tracking-[0.18em] mb-3">Upcoming Meetings</p>
                  <div className="flex flex-col gap-3">
                    {upcoming.map(p => (
                      <PtmCard key={p.id} ptm={p} classMap={classMap} teacherMap={teacherMap}
                        onEdit={ptm => { setEditPtm(ptm); setShowModal(true); }}
                        onDelete={handleDelete}
                        onSlots={setSlotsFor}
                        onBookings={setBookingsFor} />
                    ))}
                  </div>
                </section>
              )}

              {completed.length > 0 && (
                <section className="opacity-60">
                  <p className="text-[11px] font-semibold text-[#a3957e] uppercase tracking-[0.18em] mb-3">Past Meetings</p>
                  <div className="flex flex-col gap-3">
                    {completed.map(p => (
                      <PtmCard key={p.id} ptm={p} classMap={classMap} teacherMap={teacherMap}
                        onEdit={ptm => { setEditPtm(ptm); setShowModal(true); }}
                        onDelete={handleDelete}
                        onSlots={setSlotsFor}
                        onBookings={setBookingsFor} />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      {showModal && (
        <PtmModal
          ptm={editPtm}
          classes={classes}
          teachers={teachers}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditPtm(null); }}
        />
      )}
      {slotsFor && (
        <SlotsModal
          ptm={slotsFor}
          teachers={teachers}
          onClose={() => setSlotsFor(null)}
        />
      )}
      {bookingsFor && (
        <BookingsModal
          ptm={bookingsFor}
          teachers={teachers}
          onClose={() => { setBookingsFor(null); load(); }}
        />
      )}
    </div>
  );
}
