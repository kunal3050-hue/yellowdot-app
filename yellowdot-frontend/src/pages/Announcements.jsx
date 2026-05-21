// ─────────────────────────────────────────────────────────────────────────────
// Announcements — quick updates, live feed, parent-app posts
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";
import Sidebar from "../components/Sidebar";
import communicationService from "../services/communicationService";

const ANN_TYPES = ["General", "Emergency", "Celebration", "Reminder", "Activity Update", "Achievement"];

const TYPE_STYLE = {
  "General":         "bg-[#f8f0d4] text-[#8b7228] border-[#e8daa0]",
  "Emergency":       "bg-[#fee8e2] text-[#7a2018] border-[#e0a898]",
  "Celebration":     "bg-[#f5e8b8] text-[#7a5e18] border-[#e8d49a]",
  "Reminder":        "bg-[#faf5e4] text-[#9a8248] border-[#ece0b4]",
  "Activity Update": "bg-[#f8f0d4] text-[#7a5e18] border-[#e8daa0]",
  "Achievement":     "bg-[#f5e8b8] text-[#8b7228] border-[#e8d49a]",
};

const TYPE_EMOJI = {
  "General":         "📢",
  "Emergency":       "🚨",
  "Celebration":     "🎉",
  "Reminder":        "⏰",
  "Activity Update": "🌟",
  "Achievement":     "🏆",
};

function timeAgo(isoStr) {
  if (!isoStr) return "";
  const diff = Date.now() - new Date(isoStr).getTime();
  if (diff < 60_000)    return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000)return `${Math.floor(diff / 3_600_000)}h ago`;
  const d = new Date(isoStr);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// ── AnnouncementCard ──────────────────────────────────────────────────────────

function AnnouncementCard({ ann, onEdit, onDelete }) {
  const typeStyle = TYPE_STYLE[ann.type] || TYPE_STYLE["General"];
  const emoji     = TYPE_EMOJI[ann.type] || "📢";

  return (
    <div className="group p-5 rounded-3xl border border-[#ece7d8] bg-[#fffdf8] hover:border-[#e0d080] hover:shadow-[0_6px_24px_rgba(212,170,31,0.10)] hover:-translate-y-0.5 transition-all duration-[190ms]">
      {/* Top row */}
      <div className="flex items-start gap-3">
        {/* Emoji orb */}
        <div className="flex-shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center text-xl select-none"
          style={{ background: "linear-gradient(160deg,#fdf8e8 0%,#f5e4a8 100%)", boxShadow: "0 2px 8px rgba(212,170,31,0.18)" }}>
          {emoji}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-lg border text-[10px] font-semibold ${typeStyle}`}>
              {ann.type}
            </span>
            <span className="text-[10px] text-[#c4b090] font-normal flex-shrink-0">{timeAgo(ann.createdAt)}</span>
          </div>
          <h3 className="mt-1.5 text-[#2a1c06] font-bold text-[15px] leading-snug">{ann.title}</h3>
        </div>
      </div>

      {/* Body */}
      {ann.body && (
        <p className="mt-3 text-[#8b7d65] text-sm leading-relaxed pl-14 line-clamp-3">{ann.body}</p>
      )}

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-[#f0ebe0] flex items-center justify-between">
        {/* Stats */}
        <div className="flex items-center gap-4 pl-14">
          {ann.seenCount > 0 && (
            <div className="flex items-center gap-1.5 text-[#a3957e] text-xs">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
              </svg>
              {ann.seenCount} seen
            </div>
          )}
          {ann.commentsEnabled && (
            <div className="flex items-center gap-1 text-[#a3957e] text-xs">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
              </svg>
              Comments on
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(ann)} title="Edit"
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#f8f0d4] hover:bg-[#f0e4a0] text-[#8b7228] transition-all">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button onClick={() => onDelete(ann.id)} title="Delete"
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-[#fee8e2] text-[#d4c8b0] hover:text-[#c0402a] transition-all">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
              <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

const EMPTY = { title: "", body: "", type: "General", commentsEnabled: false };

function AnnouncementModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial ? { ...EMPTY, ...initial } : EMPTY);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try { await onSave(form); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(31,26,23,0.52)", backdropFilter: "blur(6px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-7 pt-6 pb-5 border-b border-[#e8d898] flex-shrink-0"
          style={{ background: "linear-gradient(160deg,#fff7d6 0%,#f8ebbf 50%,#f5e4a8 100%)" }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#9a7a18] text-[10px] font-semibold tracking-[0.18em] mb-1">COMMUNICATIONS · ANNOUNCEMENTS</p>
              <h2 className="text-[#3a2a08] font-bold text-lg">{initial ? "Edit Announcement" : "New Announcement"}</h2>
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
        <div className="flex-1 overflow-y-auto px-7 py-5 space-y-4 bg-[#fffdf8]">
          {/* Type selector — visual chips */}
          <div>
            <label className="block text-[11px] font-semibold text-[#8b7228] uppercase tracking-wide mb-2">Type</label>
            <div className="flex flex-wrap gap-2">
              {ANN_TYPES.map(t => (
                <button key={t} type="button" onClick={() => set("type", t)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                    form.type === t
                      ? "bg-[#f9dc5a]/40 border-[#d4b830] text-[#5a4010]"
                      : "bg-white border-[#ece7d8] text-[#a3957e] hover:border-[#d4c8a0]"
                  }`}>
                  <span>{TYPE_EMOJI[t]}</span>{t}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-[11px] font-semibold text-[#8b7228] uppercase tracking-wide mb-1.5">Title *</label>
            <input value={form.title} onChange={e => set("title", e.target.value)}
              placeholder="What's happening?"
              className="w-full px-4 py-2.5 rounded-xl border border-[#ece7d8] bg-white text-sm text-[#2a1c06] outline-none focus:ring-2 focus:ring-[#f4c430]/35 focus:border-[#c9a830]/60 transition-all placeholder-[#c4b090]"/>
          </div>

          {/* Body */}
          <div>
            <label className="block text-[11px] font-semibold text-[#8b7228] uppercase tracking-wide mb-1.5">Message</label>
            <textarea value={form.body} onChange={e => set("body", e.target.value)}
              rows={4} placeholder="Add details, emoji, anything the parents need to know…"
              className="w-full px-4 py-2.5 rounded-xl border border-[#ece7d8] bg-white text-sm text-[#2a1c06] outline-none focus:ring-2 focus:ring-[#f4c430]/35 focus:border-[#c9a830]/60 transition-all resize-none placeholder-[#c4b090]"/>
          </div>

          {/* Comments toggle */}
          <button type="button" onClick={() => set("commentsEnabled", !form.commentsEnabled)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all ${
              form.commentsEnabled
                ? "bg-[#f9dc5a]/30 border-[#d4b830] text-[#5a4010]"
                : "bg-white border-[#ece7d8] text-[#a3957e] hover:border-[#d4c8a0]"
            }`}>
            <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
              form.commentsEnabled ? "bg-[#f4c430] border-[#c9a830]" : "border-[#d4c8b0]"
            }`}>
              {form.commentsEnabled && (
                <svg width="9" height="9" viewBox="0 0 10 8" fill="none">
                  <path d="M1 4l3 3 5-6" stroke="#5a4010" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
            Allow parent comments
          </button>
        </div>

        {/* Footer */}
        <div className="px-7 py-4 border-t border-[#ece7d8] flex gap-3 bg-white flex-shrink-0">
          <button onClick={onClose} disabled={saving}
            className="flex-1 py-2.5 rounded-2xl border border-[#ece7d8] text-sm font-bold text-[#6f624f] hover:bg-[#faf6ea] transition-all disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !form.title.trim()}
            className="flex-[2] py-2.5 rounded-xl text-sm font-semibold text-[#5a4010] disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
            style={{ background: "linear-gradient(160deg,#f9dc5a 0%,#f0c930 100%)", boxShadow: "0 4px 14px rgba(212,170,31,0.28)" }}>
            {saving ? "Posting…" : initial ? "Save Changes" : "Post Announcement"}
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
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#c79b12" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 11l19-9-9 19-2-8-8-2z"/>
        </svg>
      </div>
      <p className="text-lg font-bold text-[#2a1c06]">No announcements yet</p>
      <p className="text-[#a3957e] text-sm mt-1.5 max-w-[240px] mx-auto leading-relaxed">
        Post quick updates, celebrations, and live news to the parent feed.
      </p>
      <button onClick={onAdd}
        className="mt-5 px-6 py-2.5 rounded-xl text-[#5a4010] font-semibold text-sm transition-all active:scale-95"
        style={{ background: "linear-gradient(160deg,#f9dc5a 0%,#f0c930 100%)", boxShadow: "0 4px 14px rgba(212,170,31,0.28)" }}>
        Post First Announcement
      </button>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Announcements() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [typeFilter,    setTypeFilter]    = useState("All");
  const [modal,         setModal]         = useState(null);
  const [search,        setSearch]        = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try { setAnnouncements(await communicationService.getAnnouncements()); }
    catch { setAnnouncements([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (form) => {
    if (modal.mode === "edit") {
      const updated = await communicationService.updateAnnouncement(modal.data.id, form);
      setAnnouncements(prev => prev.map(a => a.id === updated.id ? updated : a));
    } else {
      const created = await communicationService.createAnnouncement(form);
      setAnnouncements(prev => [created, ...prev]);
    }
    setModal(null);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this announcement?")) return;
    await communicationService.deleteAnnouncement(id);
    setAnnouncements(prev => prev.filter(a => a.id !== id));
  };

  const filtered = announcements
    .filter(a => typeFilter === "All" || a.type === typeFilter)
    .filter(a => !search || a.title.toLowerCase().includes(search.toLowerCase()) || (a.body || "").toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex h-screen bg-[#fffdf7] overflow-hidden">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex-shrink-0 bg-[#fffef8]/[0.98] backdrop-blur-2xl border-b border-[#ece7d8] shadow-[0_1px_12px_rgba(180,140,0,0.07)] z-20">
          <div className="px-6 md:px-10 py-3 md:py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <p className="text-[#9a7a18] text-[10px] font-semibold tracking-[0.18em] mb-0.5">COMMUNICATIONS</p>
              <h1 className="text-3xl md:text-4xl font-black text-[#2a1c06] tracking-tight leading-none">Announcements</h1>
              <p className="text-[#a3957e] text-sm mt-0.5 font-normal">Quick updates & live parent feed</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Search */}
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#c4b090]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search…"
                  className="pl-9 pr-4 py-2 rounded-xl border border-[#ece7d8] bg-white text-sm text-[#2a1c06] outline-none focus:ring-2 focus:ring-[#f4c430]/35 w-40 placeholder-[#c4b090]"/>
              </div>
              <button onClick={() => setModal({ mode: "add", data: null })}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[#5a4010] text-sm font-semibold transition-all active:scale-95"
                style={{ background: "linear-gradient(160deg,#f9dc5a 0%,#f0c930 100%)", boxShadow: "0 3px 10px rgba(212,170,31,0.28)" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Post
              </button>
            </div>
          </div>

          {/* Type filter pills */}
          <div className="px-6 md:px-10 pb-3 flex items-center gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {["All", ...ANN_TYPES].map(t => (
              <button key={t} onClick={() => setTypeFilter(t)}
                className={`flex-shrink-0 flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
                  typeFilter === t ? "bg-[#f9dc5a] text-[#5a4010] shadow-sm" : "bg-[#f8f0d4] text-[#8b7228] hover:bg-[#f0e4a0]"
                }`}>
                {t !== "All" && <span className="text-[11px]">{TYPE_EMOJI[t]}</span>}
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Feed */}
        <div className="flex-1 overflow-auto px-6 md:px-10 py-5">
          {loading ? (
            <div className="space-y-3 animate-pulse max-w-2xl">
              {[0,1,2].map(i => (
                <div key={i} className="p-5 rounded-3xl bg-[#fffdf8] border border-[#ece7d8] flex gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-[#f0e8d4] flex-shrink-0"/>
                  <div className="flex-1 space-y-2 pt-1">
                    <div className="h-3 bg-[#f0e8d4] rounded-full w-16"/>
                    <div className="h-4 bg-[#f0e8d4] rounded-full w-56"/>
                    <div className="h-3 bg-[#f0e8d4] rounded-full w-full"/>
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState onAdd={() => setModal({ mode: "add", data: null })} />
          ) : (
            <div className="max-w-2xl space-y-3">
              {filtered.map(a => (
                <AnnouncementCard key={a.id} ann={a}
                  onEdit={a => setModal({ mode: "edit", data: a })}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
          <div className="h-6" />
        </div>
      </div>

      {modal && (
        <AnnouncementModal
          initial={modal.data}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
