// ─────────────────────────────────────────────────────────────────────────────
// Notices — formal parent communications / circulars
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";
import Sidebar from "../components/Sidebar";
import communicationService from "../services/communicationService";

const NOTICE_TYPES = ["General", "Academic", "Fees", "Transport", "Event", "Safety", "Urgent"];

const TYPE_STYLE = {
  "General":   "bg-[#f8f0d4] text-[#8b7228] border-[#e8daa0]",
  "Academic":  "bg-[#faf5e4] text-[#8b7228] border-[#ece0b4]",
  "Fees":      "bg-[#f5e8b8] text-[#7a5e18] border-[#e8d49a]",
  "Transport": "bg-[#f8f0d4] text-[#7a5e18] border-[#e8daa0]",
  "Event":     "bg-[#faf5e4] text-[#9a8248] border-[#ece0b4]",
  "Safety":    "bg-[#fff4e8] text-[#8b5018] border-[#f0d4a8]",
  "Urgent":    "bg-[#fee8e2] text-[#7a2018] border-[#e0a898]",
};

const ACCENT_LEFT = {
  "General":   "#e8d49a",
  "Academic":  "#c9a830",
  "Fees":      "#c9a830",
  "Transport": "#d4b830",
  "Event":     "#c8a028",
  "Safety":    "#e8a860",
  "Urgent":    "#e0a898",
};

const STATUS_STYLE = {
  draft:     "bg-[#f0ebe0] text-[#8b7d65] border-[#e0d4b8]",
  published: "bg-[#f8f4d8] text-[#5a4d18] border-[#d4bc58]",
  scheduled: "bg-[#f8f0d4] text-[#7a5e18] border-[#e8d49a]",
};

function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function timeAgo(isoStr) {
  if (!isoStr) return "";
  const diff = Date.now() - new Date(isoStr).getTime();
  if (diff < 60_000)    return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000)return `${Math.floor(diff / 3_600_000)}h ago`;
  return fmtDate(isoStr);
}

// ── NoticeCard ────────────────────────────────────────────────────────────────

function NoticeCard({ notice, onEdit, onDelete, onPublish }) {
  const typeStyle   = TYPE_STYLE[notice.type]   || TYPE_STYLE["General"];
  const statusStyle = STATUS_STYLE[notice.status]|| STATUS_STYLE["draft"];

  return (
    <div className="group p-5 rounded-3xl border border-[#ece7d8] bg-[#fffdf8] hover:border-[#e0d4a0] hover:shadow-[0_8px_28px_rgba(212,170,31,0.12)] hover:-translate-y-1 transition-all duration-[200ms]"
      style={{ borderLeftWidth: "3px", borderLeftColor: ACCENT_LEFT[notice.type] || "#e8d49a" }}>
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-lg border text-[10px] font-semibold ${typeStyle}`}>
            {notice.type}
          </span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-lg border text-[10px] font-semibold ${statusStyle}`}>
            {notice.status}
          </span>
          {notice.requireAck && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-[#f0ebe0] text-[#8b7d65] text-[10px] font-semibold border border-[#e0d4b8]">
              Ack. required
            </span>
          )}
        </div>
        <span className="text-[10px] text-[#c4b090] font-normal flex-shrink-0">{timeAgo(notice.createdAt)}</span>
      </div>

      {/* Title */}
      <h3 className="mt-2.5 text-[#2a1c06] font-bold text-base leading-snug">{notice.title}</h3>

      {/* Body preview */}
      {notice.body && (
        <p className="text-[#8b7d65] text-sm mt-1.5 leading-relaxed line-clamp-2">{notice.body}</p>
      )}

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-[#f0ebe0] flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          {notice.publishAt && (
            <span className="text-[11px] text-[#a3957e]">
              Publish: {fmtDate(notice.publishAt)}
            </span>
          )}
          {notice.expiresAt && (
            <span className="text-[11px] text-[#a3957e]">
              Expires: {fmtDate(notice.expiresAt)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {notice.status === "draft" && (
            <button onClick={() => onPublish(notice)} title="Publish"
              className="px-3 py-1.5 rounded-xl bg-[#f8f4d8] hover:bg-[#f0e8a0] text-[#5a4010] text-xs font-semibold border border-[#d4bc58] transition-all">
              Publish
            </button>
          )}
          <button onClick={() => onEdit(notice)} title="Edit"
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#f8f0d4] hover:bg-[#f0e4a0] text-[#8b7228] transition-all opacity-0 group-hover:opacity-100">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button onClick={() => onDelete(notice.id)} title="Delete"
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-[#fee8e2] text-[#d4c8b0] hover:text-[#c0402a] transition-all opacity-0 group-hover:opacity-100">
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

const EMPTY = { title: "", body: "", type: "General", status: "draft", publishAt: "", expiresAt: "", requireAck: false };

function NoticeModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial ? {
    ...EMPTY, ...initial,
    publishAt: initial.publishAt ? initial.publishAt.slice(0,16) : "",
    expiresAt: initial.expiresAt ? initial.expiresAt.slice(0,16) : "",
  } : EMPTY);
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
      <div className="w-full max-w-lg max-h-[92vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-7 pt-6 pb-5 border-b border-[#e8d898] flex-shrink-0"
          style={{ background: "linear-gradient(160deg,#fff7d6 0%,#f8ebbf 50%,#f5e4a8 100%)" }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#9a7a18] text-[10px] font-semibold tracking-[0.18em] mb-1">COMMUNICATIONS · NOTICES</p>
              <h2 className="text-[#3a2a08] font-bold text-lg">{initial ? "Edit Notice" : "New Notice"}</h2>
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
          {/* Title */}
          <div>
            <label className="block text-[11px] font-semibold text-[#8b7228] uppercase tracking-wide mb-1.5">Title *</label>
            <input value={form.title} onChange={e => set("title", e.target.value)}
              placeholder="Notice title…"
              className="w-full px-4 py-2.5 rounded-xl border border-[#ece7d8] bg-white text-sm text-[#2a1c06] outline-none focus:ring-2 focus:ring-[#f4c430]/35 focus:border-[#c9a830]/60 transition-all placeholder-[#c4b090]"/>
          </div>

          {/* Body */}
          <div>
            <label className="block text-[11px] font-semibold text-[#8b7228] uppercase tracking-wide mb-1.5">Content</label>
            <textarea value={form.body} onChange={e => set("body", e.target.value)}
              rows={5} placeholder="Write the notice content…"
              className="w-full px-4 py-2.5 rounded-xl border border-[#ece7d8] bg-white text-sm text-[#2a1c06] outline-none focus:ring-2 focus:ring-[#f4c430]/35 focus:border-[#c9a830]/60 transition-all resize-none placeholder-[#c4b090]"/>
          </div>

          {/* Type + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#8b7228] uppercase tracking-wide mb-1.5">Type</label>
              <select value={form.type} onChange={e => set("type", e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-[#ece7d8] bg-white text-sm text-[#2a1c06] outline-none cursor-pointer">
                {NOTICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#8b7228] uppercase tracking-wide mb-1.5">Status</label>
              <select value={form.status} onChange={e => set("status", e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-[#ece7d8] bg-white text-sm text-[#2a1c06] outline-none cursor-pointer">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="scheduled">Scheduled</option>
              </select>
            </div>
          </div>

          {/* Publish / Expiry */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#8b7228] uppercase tracking-wide mb-1.5">Publish At</label>
              <input type="datetime-local" value={form.publishAt} onChange={e => set("publishAt", e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-[#ece7d8] bg-white text-sm text-[#2a1c06] outline-none focus:ring-2 focus:ring-[#f4c430]/35 cursor-pointer"/>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#8b7228] uppercase tracking-wide mb-1.5">Expires At</label>
              <input type="datetime-local" value={form.expiresAt} onChange={e => set("expiresAt", e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-[#ece7d8] bg-white text-sm text-[#2a1c06] outline-none focus:ring-2 focus:ring-[#f4c430]/35 cursor-pointer"/>
            </div>
          </div>

          {/* Require Ack */}
          <button type="button" onClick={() => set("requireAck", !form.requireAck)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all ${
              form.requireAck
                ? "bg-[#f9dc5a]/30 border-[#d4b830] text-[#5a4010]"
                : "bg-white border-[#ece7d8] text-[#a3957e] hover:border-[#d4c8a0]"
            }`}>
            <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
              form.requireAck ? "bg-[#f4c430] border-[#c9a830]" : "border-[#d4c8b0]"
            }`}>
              {form.requireAck && (
                <svg width="9" height="9" viewBox="0 0 10 8" fill="none">
                  <path d="M1 4l3 3 5-6" stroke="#5a4010" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
            Require parent acknowledgement
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
            {saving ? "Saving…" : initial ? "Save Changes" : "Create Notice"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ tab, onAdd }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-5"
        style={{ background: "linear-gradient(160deg,#fff7d6 0%,#f5e4a8 100%)", boxShadow: "0 4px 16px rgba(212,170,31,0.15)" }}>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#c79b12" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8h1a4 4 0 010 8h-1"/>
          <path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/>
          <line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
        </svg>
      </div>
      <p className="text-lg font-bold text-[#2a1c06]">
        {tab === "draft" ? "No drafts" : tab === "published" ? "Nothing published yet" : "No notices yet"}
      </p>
      <p className="text-[#a3957e] text-sm mt-1.5 max-w-[240px] mx-auto leading-relaxed">
        Create formal circulars, fee reminders, and policy updates for parents.
      </p>
      <button onClick={onAdd}
        className="mt-5 px-6 py-2.5 rounded-xl text-[#5a4010] font-semibold text-sm transition-all active:scale-95"
        style={{ background: "linear-gradient(160deg,#f9dc5a 0%,#f0c930 100%)", boxShadow: "0 4px 14px rgba(212,170,31,0.28)" }}>
        Create Notice
      </button>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

const TABS = ["all", "draft", "published"];

export default function Notices() {
  const [notices,    setNotices]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [tab,        setTab]        = useState("all");
  const [typeFilter, setTypeFilter] = useState("All");
  const [modal,      setModal]      = useState(null);
  const [search,     setSearch]     = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try { setNotices(await communicationService.getNotices()); }
    catch { setNotices([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (form) => {
    if (modal.mode === "edit") {
      const updated = await communicationService.updateNotice(modal.data.id, form);
      setNotices(prev => prev.map(n => n.id === updated.id ? updated : n));
    } else {
      const created = await communicationService.createNotice(form);
      setNotices(prev => [created, ...prev]);
    }
    setModal(null);
  };

  const handlePublish = async (notice) => {
    const updated = await communicationService.updateNotice(notice.id, { status: "published", publishAt: new Date().toISOString() });
    setNotices(prev => prev.map(n => n.id === updated.id ? updated : n));
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this notice?")) return;
    await communicationService.deleteNotice(id);
    setNotices(prev => prev.filter(n => n.id !== id));
  };

  const filtered = notices
    .filter(n => tab === "all" || n.status === tab)
    .filter(n => typeFilter === "All" || n.type === typeFilter)
    .filter(n => !search || n.title.toLowerCase().includes(search.toLowerCase()) || (n.body || "").toLowerCase().includes(search.toLowerCase()));

  const counts = { all: notices.length, draft: notices.filter(n => n.status === "draft").length, published: notices.filter(n => n.status === "published").length };

  return (
    <div className="flex h-screen bg-[#fffdf7] overflow-hidden">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex-shrink-0 bg-[#fffef8]/[0.98] backdrop-blur-2xl border-b border-[#ece7d8] shadow-[0_1px_12px_rgba(180,140,0,0.07)] z-20">
          <div className="px-6 md:px-10 py-3 md:py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <p className="text-[#9a7a18] text-[10px] font-semibold tracking-[0.18em] mb-0.5">COMMUNICATIONS</p>
              <h1 className="text-3xl md:text-4xl font-black text-[#2a1c06] tracking-tight leading-none">Notices</h1>
              <p className="text-[#a3957e] text-sm mt-0.5 font-normal">Formal circulars & parent communications</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Search */}
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#c4b090]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search notices…"
                  className="pl-9 pr-4 py-2 rounded-xl border border-[#ece7d8] bg-white text-sm text-[#2a1c06] outline-none focus:ring-2 focus:ring-[#f4c430]/35 w-44 placeholder-[#c4b090]"/>
              </div>
              <button onClick={() => setModal({ mode: "add", data: null })}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[#5a4010] text-sm font-semibold transition-all active:scale-95"
                style={{ background: "linear-gradient(160deg,#f9dc5a 0%,#f0c930 100%)", boxShadow: "0 3px 10px rgba(212,170,31,0.28)" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                New Notice
              </button>
            </div>
          </div>

          {/* Tabs + type filter */}
          <div className="px-6 md:px-10 pb-3 flex items-center justify-between gap-4">
            {/* Status tabs */}
            <div className="flex items-center gap-1 p-1 rounded-xl border border-[#e8d898] bg-[#fdf8e8]">
              {TABS.map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                    tab === t ? "bg-[#f9dc5a] text-[#5a4010] shadow-sm" : "text-[#a3957e] hover:text-[#7a5e18]"
                  }`}>
                  {t}
                  <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold ${
                    tab === t ? "bg-[#5a4010]/15 text-[#5a4010]" : "bg-[#e8dba0] text-[#8b7228]"
                  }`}>{counts[t]}</span>
                </button>
              ))}
            </div>
            {/* Type chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              {["All", ...NOTICE_TYPES].map(t => (
                <button key={t} onClick={() => setTypeFilter(t)}
                  className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                    typeFilter === t ? "bg-[#f9dc5a] text-[#5a4010]" : "bg-[#f8f0d4] text-[#8b7228] hover:bg-[#f0e4a0]"
                  }`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-6 md:px-10 py-5">
          {loading ? (
            <div className="space-y-3 animate-pulse max-w-3xl">
              {[0,1,2].map(i => (
                <div key={i} className="p-5 rounded-3xl bg-[#fffdf8] border border-[#ece7d8] space-y-2.5">
                  <div className="flex gap-2">
                    <div className="h-5 w-16 bg-[#f0e8d4] rounded-lg"/>
                    <div className="h-5 w-20 bg-[#f0e8d4] rounded-lg"/>
                  </div>
                  <div className="h-4 bg-[#f0e8d4] rounded-full w-64"/>
                  <div className="h-3 bg-[#f0e8d4] rounded-full w-full"/>
                  <div className="h-3 bg-[#f0e8d4] rounded-full w-3/4"/>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState tab={tab} onAdd={() => setModal({ mode: "add", data: null })} />
          ) : (
            <div className="max-w-4xl columns-1 md:columns-2" style={{ columnGap: "1.25rem" }}>
              {filtered.map(n => (
                <div key={n.id} className="mb-4 break-inside-avoid">
                  <NoticeCard notice={n}
                    onEdit={n => setModal({ mode: "edit", data: n })}
                    onDelete={handleDelete}
                    onPublish={handlePublish}
                  />
                </div>
              ))}
            </div>
          )}
          <div className="h-6" />
        </div>
      </div>

      {/* Floating compose FAB */}
      <button
        onClick={() => setModal({ mode: "add", data: null })}
        title="Create notice"
        className="fixed bottom-8 right-8 w-14 h-14 flex items-center justify-center rounded-2xl z-30
                   transition-all duration-[200ms] hover:scale-110 active:scale-95"
        style={{ background: "linear-gradient(160deg,#f9dc5a 0%,#f0c930 100%)", boxShadow: "0 8px 28px rgba(212,170,31,0.42), inset 0 1px 0 rgba(255,255,255,0.5)" }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5a4010" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>

      {modal && (
        <NoticeModal
          initial={modal.data}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
