// ─────────────────────────────────────────────────────────────────────────────
// Incidents — Incident / Accident Report management (Safety & Compliance)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from "react";
import Sidebar from "../components/Sidebar";
import incidentService from "../services/incidentService";
import { uploadIncidentPhotos } from "../services/storageService";
import { api } from "../services/authService";

// ── Constants ─────────────────────────────────────────────────────────────────

const INCIDENT_TYPES = [
  "Minor Fall","Scratch","Bump","Bite Incident","Conflict Between Children",
  "Medical Incident","Allergy Reaction","Injury","Lost Child Protocol","Other",
];

const LOCATIONS = ["Classroom","Playground","Washroom","Dining Area","Corridor","School Bus","Other"];

const SEVERITIES = [
  { value: "low",      label: "Low",      color: "#15803d", bg: "#f0fdf4", border: "#bbf7d0", dot: "#22c55e" },
  { value: "medium",   label: "Medium",   color: "#b45309", bg: "#fffbeb", border: "#fde68a", dot: "#f59e0b" },
  { value: "high",     label: "High",     color: "#c2410c", bg: "#fff7ed", border: "#fed7aa", dot: "#f97316" },
  { value: "critical", label: "Critical", color: "#dc2626", bg: "#fef2f2", border: "#fecaca", dot: "#ef4444" },
];

const STATUSES = [
  { value: "open",         label: "Open",         color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" },
  { value: "under_review", label: "Under Review", color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  { value: "resolved",     label: "Resolved",     color: "#15803d", bg: "#f0fdf4", border: "#bbf7d0" },
  { value: "closed",       label: "Closed",       color: "#6b7280", bg: "#F1F1F1", border: "#e5e7eb" },
];

function severityMeta(v) { return SEVERITIES.find(s => s.value === v) || SEVERITIES[0]; }
function statusMeta(v)   { return STATUSES.find(s => s.value === v) || STATUSES[0]; }

function todayISO() { return new Date().toISOString().split("T")[0]; }
function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function fmtTime(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2,"0")} ${h >= 12 ? "PM" : "AM"}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SeverityBadge({ severity }) {
  const m = severityMeta(severity);
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border"
      style={{ color: m.color, background: m.bg, borderColor: m.border }}>
      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: m.dot }} />
      {m.label}
    </span>
  );
}

function StatusBadge({ status }) {
  const m = statusMeta(status);
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border"
      style={{ color: m.color, background: m.bg, borderColor: m.border }}>
      {m.label.replace("_"," ")}
    </span>
  );
}

function StatCard({ label, value, color, icon }) {
  return (
    <div className="flex-1 min-w-[140px] bg-white rounded-2xl border border-[#F1F1F1] p-4 flex items-center gap-3"
      style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
        style={{ background: color.bg }}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-black tabular-nums" style={{ color: color.text }}>{value}</p>
        <p className="text-[10px] font-semibold text-[#a3957e] uppercase tracking-wide leading-tight">{label}</p>
      </div>
    </div>
  );
}

// ── Student Picker ─────────────────────────────────────────────────────────────

function StudentPicker({ students, value, onChange }) {
  const [query, setQuery]   = useState("");
  const [open,  setOpen]    = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const selected = students.find(s => s.studentId === value);
  const filtered = students.filter(s =>
    !query || s.name?.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 30);

  const inputCls = "w-full px-4 py-3 rounded-2xl border border-[#e5dfc0] bg-white text-[#3a2a06] text-sm focus:outline-none focus:ring-2 focus:ring-[#f4c430]/35 focus:border-[#c9a830]/60 transition-all";

  return (
    <div ref={ref} className="relative">
      <input
        className={inputCls + (selected ? " font-semibold" : " placeholder:text-[#a39070]")}
        placeholder="Search student…"
        value={open ? query : (selected ? `${selected.name}` : "")}
        onFocus={() => { setOpen(true); setQuery(""); }}
        onChange={e => setQuery(e.target.value)}
      />
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-2xl border border-[#e5dfc0] bg-white shadow-lg overflow-hidden">
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-4 py-3 text-sm text-[#9a7a18]">No students found.</p>
            ) : filtered.map(s => (
              <button key={s.studentId} type="button"
                onClick={() => { onChange(s.studentId); setOpen(false); setQuery(""); }}
                className="w-full text-left px-4 py-2.5 hover:bg-[#fff7d6] transition-colors flex items-center justify-between">
                <span className="text-sm text-[#2a1c06] font-medium">{s.name}</span>
                {s.className && <span className="text-[10px] text-[#9a7a18] font-semibold">{s.className}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Photo Uploader ─────────────────────────────────────────────────────────────

function PhotoUploader({ existingUrls = [], onUrlsChange }) {
  const [previews, setPreviews]     = useState([]); // { file, url } — pending files
  const [uploading, setUploading]   = useState(false);
  const [existing, setExisting]     = useState(existingUrls);
  const inputRef = useRef(null);

  const handleFiles = (files) => {
    const newPreviews = Array.from(files).map(f => ({ file: f, url: URL.createObjectURL(f) }));
    setPreviews(p => [...p, ...newPreviews]);
  };

  const removePending = (idx) => {
    setPreviews(p => p.filter((_, i) => i !== idx));
  };

  const removeExisting = (url) => {
    const updated = existing.filter(u => u !== url);
    setExisting(updated);
    onUrlsChange([...updated, ...previews.map(() => null)].filter(Boolean)); // pass back reduced list
  };

  // Called by parent form on submit
  PhotoUploader.upload = async () => {
    if (previews.length === 0) return existing;
    setUploading(true);
    try {
      const newUrls = await uploadIncidentPhotos(previews.map(p => p.file));
      const all = [...existing, ...newUrls];
      setExisting(all);
      setPreviews([]);
      onUrlsChange(all);
      return all;
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        {existing.map(url => (
          <div key={url} className="relative group w-20 h-20 rounded-xl overflow-hidden border border-[#e5dfc0]">
            <img src={url} alt="evidence" className="w-full h-full object-cover" />
            <button type="button" onClick={() => removeExisting(url)}
              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-[10px] hidden group-hover:flex items-center justify-center">
              ×
            </button>
          </div>
        ))}
        {previews.map((p, i) => (
          <div key={i} className="relative group w-20 h-20 rounded-xl overflow-hidden border border-[#d4b830] bg-[#fff7d6]">
            <img src={p.url} alt="preview" className="w-full h-full object-cover" />
            <button type="button" onClick={() => removePending(i)}
              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-[10px] flex items-center justify-center">
              ×
            </button>
          </div>
        ))}
        <button type="button" onClick={() => inputRef.current?.click()}
          className="w-20 h-20 rounded-xl border-2 border-dashed border-[#e5dfc0] flex flex-col items-center justify-center gap-1 hover:border-[#d4b830] hover:bg-[#fff7d6] transition-colors text-[#9a7a18]">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span className="text-[9px] font-semibold uppercase tracking-wide">Add</span>
        </button>
      </div>
      {uploading && <p className="text-[11px] text-[#9a7a18]">Uploading photos…</p>}
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
        onChange={e => handleFiles(e.target.files)} />
    </div>
  );
}

// ── Incident Form Modal ───────────────────────────────────────────────────────

function IncidentModal({ incident, students, staff, onSave, onClose }) {
  const isEdit   = !!incident?.id;
  const uploaderRef = useRef(null);

  const [form, setForm] = useState({
    studentId:              incident?.studentId              || "",
    incidentType:           incident?.incidentType           || "",
    severity:               incident?.severity               || "low",
    incidentDate:           incident?.incidentDate           || todayISO(),
    incidentTime:           incident?.incidentTime           || "",
    location:               incident?.location               || "",
    locationOther:          incident?.locationOther          || "",
    description:            incident?.description            || "",
    actionTaken:            incident?.actionTaken            || "",
    immediateResponse:      incident?.immediateResponse      || "",
    reportedByName:         incident?.reportedByName         || "",
    witnessStaffIds:        incident?.witnessStaffIds        || [],
    witnessStaffNames:      incident?.witnessStaffNames      || [],
    photoUrls:              incident?.photoUrls              || [],
    notifyParent:           incident?.notifyParent           ?? true,
    acknowledgementRequired: incident?.acknowledgementRequired ?? false,
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggleWitness = (uid, name) => {
    const has = form.witnessStaffIds.includes(uid);
    set("witnessStaffIds",   has ? form.witnessStaffIds.filter(x => x !== uid)   : [...form.witnessStaffIds, uid]);
    set("witnessStaffNames", has ? form.witnessStaffNames.filter(x => x !== name) : [...form.witnessStaffNames, name]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.studentId)      return setError("Select a student.");
    if (!form.incidentType)   return setError("Select incident type.");
    if (!form.incidentDate)   return setError("Incident date is required.");
    if (!form.incidentTime)   return setError("Incident time is required.");
    if (!form.location)       return setError("Location is required.");
    if (form.location === "Other" && !form.locationOther.trim()) return setError("Specify the other location.");
    if (!form.description.trim())      return setError("Description is required.");
    if (!form.actionTaken.trim())      return setError("Action taken is required.");
    if (!form.immediateResponse.trim()) return setError("Immediate response is required.");
    if (!form.reportedByName.trim())   return setError("Staff member reporting is required.");

    setSaving(true);
    setError("");
    try {
      // Upload photos first
      let photoUrls = form.photoUrls;
      if (uploaderRef.current?.upload) {
        photoUrls = await uploaderRef.current.upload();
      }
      await onSave({ ...form, photoUrls });
      onClose();
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full px-4 py-3 rounded-2xl border border-[#e5dfc0] bg-white text-[#3a2a06] text-sm placeholder:text-[#a39070] focus:outline-none focus:ring-2 focus:ring-[#f4c430]/35 focus:border-[#c9a830]/60 transition-all";
  const labelCls = "block text-[11px] font-bold text-[#9a7a18] uppercase tracking-[0.1em] mb-1.5";
  const sectionCls = "text-[10px] font-black text-[#9a7a18] tracking-[0.2em] uppercase mb-4 mt-6 first:mt-0 flex items-center gap-2 after:flex-1 after:h-px after:bg-[#F1F1F1]";

  // Expose upload ref
  uploaderRef.current = { upload: null };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white shadow-2xl">

        {/* Header */}
        <div className="sticky top-0 z-10 px-7 pt-6 pb-5 rounded-t-3xl"
          style={{ background: "linear-gradient(160deg,#fff7d6 0%,#f8ebbf 50%,#f5e4a8 100%)" }}>
          <p className="text-[9px] font-black text-[#9a7a18] tracking-[0.22em] uppercase mb-1">SAFETY & COMPLIANCE · INCIDENTS</p>
          <h2 className="text-xl font-black text-[#2a1c06]">{isEdit ? "Edit Incident Report" : "New Incident Report"}</h2>
          <button onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-xl hover:bg-[#f0c930]/30 text-[#9a7a18] transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-7 py-6 flex flex-col gap-4">

          {/* ── Section 1: Incident Details ─────────────────────── */}
          <p className={sectionCls}>Incident Details</p>

          <div>
            <label className={labelCls}>Student *</label>
            <StudentPicker students={students} value={form.studentId} onChange={v => set("studentId", v)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Incident Type *</label>
              <select value={form.incidentType} onChange={e => set("incidentType", e.target.value)} className={inputCls}>
                <option value="">Select type…</option>
                {INCIDENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Location *</label>
              <select value={form.location} onChange={e => set("location", e.target.value)} className={inputCls}>
                <option value="">Select location…</option>
                {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>

          {form.location === "Other" && (
            <div>
              <label className={labelCls}>Specify Location *</label>
              <input className={inputCls} placeholder="e.g. Music Room, Office corridor…"
                value={form.locationOther} onChange={e => set("locationOther", e.target.value)} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Incident Date *</label>
              <input type="date" className={inputCls} value={form.incidentDate} onChange={e => set("incidentDate", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Incident Time *</label>
              <input type="time" className={inputCls} value={form.incidentTime} onChange={e => set("incidentTime", e.target.value)} />
            </div>
          </div>

          {/* Severity */}
          <div>
            <label className={labelCls}>Severity *</label>
            <div className="flex gap-2">
              {SEVERITIES.map(s => (
                <button key={s.value} type="button"
                  onClick={() => set("severity", s.value)}
                  className={`flex-1 py-2.5 rounded-2xl text-xs font-bold border transition-all ${form.severity === s.value ? "ring-2 ring-offset-1" : "opacity-60"}`}
                  style={{
                    color: s.color, background: s.bg, borderColor: s.border,
                    ringColor: s.dot,
                  }}>
                  <span className="flex flex-col items-center gap-0.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: s.dot }} />
                    {s.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Section 2: What Happened ────────────────────────── */}
          <p className={sectionCls}>What Happened</p>

          <div>
            <label className={labelCls}>Description *</label>
            <textarea rows={3} className={inputCls + " resize-none"}
              placeholder="Describe what happened in detail…"
              value={form.description} onChange={e => set("description", e.target.value)} />
          </div>

          <div>
            <label className={labelCls}>Immediate Response *</label>
            <textarea rows={2} className={inputCls + " resize-none"}
              placeholder="What was done immediately after the incident?"
              value={form.immediateResponse} onChange={e => set("immediateResponse", e.target.value)} />
          </div>

          <div>
            <label className={labelCls}>Action Taken *</label>
            <textarea rows={2} className={inputCls + " resize-none"}
              placeholder="What follow-up actions were taken or planned?"
              value={form.actionTaken} onChange={e => set("actionTaken", e.target.value)} />
          </div>

          {/* ── Section 3: Staff ─────────────────────────────────── */}
          <p className={sectionCls}>Staff Information</p>

          <div>
            <label className={labelCls}>Staff Member Reporting *</label>
            <input className={inputCls} placeholder="Full name of the reporting staff member"
              value={form.reportedByName} onChange={e => set("reportedByName", e.target.value)} />
          </div>

          {staff.length > 0 && (
            <div>
              <label className={labelCls}>Witness Staff (optional)</label>
              <div className="flex flex-wrap gap-2">
                {staff.map(s => {
                  const sel = form.witnessStaffIds.includes(s.userId);
                  return (
                    <button key={s.userId} type="button" onClick={() => toggleWitness(s.userId, s.name)}
                      className={`px-3 py-1.5 rounded-xl text-sm font-semibold border transition-all ${
                        sel ? "bg-[#f9dc5a]/30 border-[#d4b830] text-[#5a4010]" : "bg-white border-[#e5dfc0] text-[#9a7a18]"
                      }`}>
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Section 4: Photo Evidence ─────────────────────────── */}
          <p className={sectionCls}>Photo Evidence</p>
          <PhotoUploaderWithRef
            existingUrls={form.photoUrls}
            onUrlsChange={urls => set("photoUrls", urls)}
            uploaderRef={uploaderRef}
          />

          {/* ── Section 5: Options ───────────────────────────────── */}
          <p className={sectionCls}>Options</p>
          <div className="flex flex-col gap-3">
            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-2xl border border-[#e5dfc0] hover:bg-[#fff7d6] transition-colors">
              <input type="checkbox" checked={form.notifyParent}
                onChange={e => set("notifyParent", e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded accent-[#f4c430]" />
              <div>
                <p className="text-sm font-bold text-[#2a1c06]">Notify Parent Immediately</p>
                <p className="text-[11px] text-[#9a7a18]">Send a push notification to the parent when this report is saved.</p>
              </div>
            </label>
            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-2xl border border-[#e5dfc0] hover:bg-[#fff7d6] transition-colors">
              <input type="checkbox" checked={form.acknowledgementRequired}
                onChange={e => set("acknowledgementRequired", e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded accent-[#f4c430]" />
              <div>
                <p className="text-sm font-bold text-[#2a1c06]">Parent Acknowledgement Required</p>
                <p className="text-[11px] text-[#9a7a18]">Parent must acknowledge having read this report in the Parent App.</p>
              </div>
            </label>
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
              {saving ? "Saving…" : isEdit ? "Save Changes" : "File Report"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Wrap PhotoUploader to expose upload fn via ref
function PhotoUploaderWithRef({ existingUrls, onUrlsChange, uploaderRef }) {
  const [previews, setPreviews]   = useState([]);
  const [existing, setExisting]   = useState(existingUrls);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  uploaderRef.current = {
    upload: async () => {
      if (previews.length === 0) return existing;
      setUploading(true);
      try {
        const newUrls = await uploadIncidentPhotos(previews.map(p => p.file));
        const all = [...existing, ...newUrls];
        setExisting(all);
        setPreviews([]);
        onUrlsChange(all);
        return all;
      } finally {
        setUploading(false);
      }
    },
  };

  const addFiles = (files) => {
    const newPreviews = Array.from(files).map(f => ({ file: f, url: URL.createObjectURL(f) }));
    setPreviews(p => [...p, ...newPreviews]);
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {existing.map((url, i) => (
          <div key={url + i} className="relative group w-20 h-20 rounded-xl overflow-hidden border border-[#e5dfc0]">
            <img src={url} alt="" className="w-full h-full object-cover" />
            <button type="button"
              onClick={() => { const u = existing.filter(x => x !== url); setExisting(u); onUrlsChange(u); }}
              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-[10px] hidden group-hover:flex items-center justify-center">×</button>
          </div>
        ))}
        {previews.map((p, i) => (
          <div key={i} className="relative group w-20 h-20 rounded-xl overflow-hidden border border-[#d4b830]">
            <img src={p.url} alt="" className="w-full h-full object-cover" />
            <button type="button" onClick={() => setPreviews(ps => ps.filter((_, j) => j !== i))}
              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-[10px] flex items-center justify-center">×</button>
          </div>
        ))}
        <button type="button" onClick={() => inputRef.current?.click()}
          className="w-20 h-20 rounded-xl border-2 border-dashed border-[#e5dfc0] flex flex-col items-center justify-center gap-1 hover:border-[#d4b830] hover:bg-[#fff7d6] transition-colors text-[#9a7a18]">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span className="text-[9px] font-semibold uppercase tracking-wide">Add</span>
        </button>
      </div>
      {uploading && <p className="text-[11px] text-[#9a7a18] mt-1">Uploading photos…</p>}
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
        onChange={e => addFiles(e.target.files)} />
    </div>
  );
}

// ── Incident Card ─────────────────────────────────────────────────────────────

function IncidentCard({ incident, studentMap, onEdit, onDelete, onStatusChange }) {
  const sv = severityMeta(incident.severity);
  const [statusOpen, setStatusOpen] = useState(false);
  const statusRef = useRef(null);

  useEffect(() => {
    const h = e => { if (statusRef.current && !statusRef.current.contains(e.target)) setStatusOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const student = studentMap[incident.studentId];

  return (
    <div className="bg-white rounded-3xl border border-[#F1F1F1] overflow-hidden flex transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
      style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
      {/* Severity accent bar */}
      <div className="w-1.5 flex-shrink-0" style={{ background: sv.dot }} />

      <div className="flex-1 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Badges row */}
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <SeverityBadge severity={incident.severity} />
              <StatusBadge status={incident.status} />
              {incident.acknowledgementRequired && !incident.acknowledged && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border bg-[#fffbeb] text-[#d97706] border-[#fde68a]">
                  ⏳ Awaiting Ack
                </span>
              )}
              {incident.acknowledged && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border bg-[#f0fdf4] text-[#15803d] border-[#bbf7d0]">
                  ✓ Acknowledged
                </span>
              )}
            </div>

            {/* Title row */}
            <div className="flex items-baseline gap-2 mb-1">
              <h3 className="text-[15px] font-bold text-[#2a1c06]">{incident.incidentType}</h3>
              {student && (
                <span className="text-[12px] text-[#9a7a18] font-semibold">· {student.name}</span>
              )}
            </div>

            {/* Meta */}
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-[#7a6640] mb-2">
              <span>📅 {fmtDate(incident.incidentDate)}</span>
              {incident.incidentTime && <span>🕐 {fmtTime(incident.incidentTime)}</span>}
              <span>📍 {incident.location === "Other" ? incident.locationOther : incident.location}</span>
              {incident.reportedByName && <span>👤 {incident.reportedByName}</span>}
            </div>

            {/* Description preview */}
            <p className="text-[12px] text-[#5a4d40] line-clamp-2">{incident.description}</p>

            {/* Photos indicator */}
            {(incident.photoUrls || []).length > 0 && (
              <div className="flex gap-1.5 mt-2">
                {incident.photoUrls.slice(0, 4).map((url, i) => (
                  <img key={i} src={url} alt="" className="w-8 h-8 rounded-lg object-cover border border-[#e5dfc0]" />
                ))}
                {incident.photoUrls.length > 4 && (
                  <div className="w-8 h-8 rounded-lg bg-[#f8f4d8] border border-[#e5dfc0] flex items-center justify-center text-[9px] font-bold text-[#9a7a18]">
                    +{incident.photoUrls.length - 4}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 items-end flex-shrink-0">
            <div className="flex gap-1">
              <button onClick={() => onEdit(incident)}
                className="p-2 rounded-xl hover:bg-[#fff7d6] text-[#9a7a18] hover:text-[#5a4010] transition-colors" title="Edit">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button onClick={() => onDelete(incident)}
                className="p-2 rounded-xl hover:bg-red-50 text-[#9a7a18] hover:text-red-500 transition-colors" title="Delete">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              </button>
            </div>

            {/* Status change */}
            <div ref={statusRef} className="relative">
              <button onClick={() => setStatusOpen(v => !v)}
                className="px-3 py-1.5 rounded-xl text-[11px] font-semibold border border-[#e5dfc0] bg-white hover:bg-[#fff7d6] text-[#9a7a18] transition-colors whitespace-nowrap flex items-center gap-1">
                Change Status
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              {statusOpen && (
                <div className="absolute right-0 top-full mt-1 z-20 rounded-2xl border border-[#e5dfc0] bg-white shadow-lg overflow-hidden w-40">
                  {STATUSES.map(s => (
                    <button key={s.value} type="button"
                      onClick={() => { onStatusChange(incident.id, s.value); setStatusOpen(false); }}
                      className="w-full text-left px-4 py-2.5 hover:bg-[#fff7d6] transition-colors flex items-center gap-2"
                      disabled={incident.status === s.value}>
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                      <span className="text-sm text-[#2a1c06] font-medium">{s.label}</span>
                      {incident.status === s.value && <span className="ml-auto text-[10px] text-[#9a7a18]">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Incidents() {
  const [incidents,   setIncidents]   = useState([]);
  const [students,    setStudents]    = useState([]);
  const [staff,       setStaff]       = useState([]);
  const [stats,       setStats]       = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [showModal,   setShowModal]   = useState(false);
  const [editInc,     setEditInc]     = useState(null);
  const [deleting,    setDeleting]    = useState(null);

  // Filters
  const [filterSeverity, setFilterSeverity] = useState("all");
  const [filterStatus,   setFilterStatus]   = useState("all");
  const [searchQuery,    setSearchQuery]     = useState("");

  const studentMap = Object.fromEntries(students.map(s => [s.studentId, s]));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [incData, dashData] = await Promise.all([
        incidentService.getIncidents(),
        incidentService.getDashboard(),
      ]);
      setIncidents(incData.incidents || []);
      setStats(dashData.stats || null);
    } catch { /* handled via loading state */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    // Load students and staff lazily (needed for modal)
    Promise.all([
      api.get("/students").then(r => r.data),
      incidentService.getStaff().catch(() => ({ staff: [] })),
    ]).then(([sData, staffData]) => {
      setStudents(Array.isArray(sData) ? sData : sData?.students || []);
      setStaff(staffData.staff || []);
    }).catch(() => {});
  }, []);

  const handleSave = async (form) => {
    if (editInc?.id) {
      const { incident } = await incidentService.updateIncident(editInc.id, form);
      setIncidents(is => is.map(i => i.id === incident.id ? { ...i, ...incident } : i));
    } else {
      const { incident } = await incidentService.createIncident(form);
      setIncidents(is => [incident, ...is]);
    }
    // Refresh dashboard stats
    incidentService.getDashboard().then(d => setStats(d.stats)).catch(() => {});
  };

  const handleDelete = async (incident) => {
    if (!window.confirm(`Delete this ${incident.incidentType} report? This cannot be undone.`)) return;
    setDeleting(incident.id);
    try {
      await incidentService.deleteIncident(incident.id);
      setIncidents(is => is.filter(i => i.id !== incident.id));
    } catch (e) { alert(e?.response?.data?.error || "Delete failed."); }
    finally { setDeleting(null); }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await incidentService.updateStatus(id, status);
      setIncidents(is => is.map(i => i.id === id ? { ...i, status } : i));
    } catch (e) { alert(e?.response?.data?.error || "Status update failed."); }
  };

  // Apply filters
  const filtered = incidents.filter(inc => {
    if (filterSeverity !== "all" && inc.severity !== filterSeverity) return false;
    if (filterStatus   !== "all" && inc.status   !== filterStatus)   return false;
    if (searchQuery) {
      const student = studentMap[inc.studentId];
      const name = student?.name?.toLowerCase() || "";
      const type = inc.incidentType?.toLowerCase() || "";
      const q = searchQuery.toLowerCase();
      if (!name.includes(q) && !type.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="flex-shrink-0 px-8 py-5 border-b border-[#F1F1F1] flex items-center justify-between gap-4"
          style={{ background: "rgba(255,255,255,0.95)", backdropFilter: "blur(18px)", boxShadow: "0 1px 12px rgba(180,140,0,0.07)" }}>
          <div>
            <p className="text-[9px] font-black text-[#9a7a18] tracking-[0.18em] uppercase mb-0.5">SAFETY & COMPLIANCE</p>
            <h1 className="text-3xl font-black text-[#2a1c06] leading-none">Incident Reports</h1>
            <p className="text-sm text-[#a08040] mt-0.5">Track, document, and notify incidents involving students</p>
          </div>
          <button
            onClick={() => { setEditInc(null); setShowModal(true); }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-sm text-[#5a4010] transition-all hover:shadow-md hover:-translate-y-0.5"
            style={{ background: "linear-gradient(160deg,#f9dc5a 0%,#f0c930 100%)", boxShadow: "0 4px 14px rgba(212,170,31,0.35)" }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Report
          </button>
        </header>

        {/* Dashboard stats */}
        {stats && (
          <div className="flex-shrink-0 px-8 py-4 border-b border-[#F1F1F1] flex gap-3 overflow-x-auto">
            <StatCard label="Open Incidents"    value={stats.open}              icon="📋" color={{ bg: "#eff6ff", text: "#1d4ed8" }} />
            <StatCard label="High / Critical"   value={stats.highSeverity}      icon="⚠️" color={{ bg: "#fff7ed", text: "#c2410c" }} />
            <StatCard label="Awaiting Ack"      value={stats.awaitingAck}       icon="⏳" color={{ bg: "#fffbeb", text: "#d97706" }} />
            <StatCard label="Resolved This Month" value={stats.resolvedThisMonth} icon="✅" color={{ bg: "#f0fdf4", text: "#15803d" }} />
          </div>
        )}

        {/* Filters */}
        <div className="flex-shrink-0 px-8 py-3 border-b border-[#F1F1F1] flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9a7a18]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              className="pl-8 pr-4 py-1.5 text-xs rounded-full border border-[#e5dfc0] bg-white text-[#3a2a06] placeholder:text-[#a39070] focus:outline-none focus:ring-2 focus:ring-[#f4c430]/35 w-48"
              placeholder="Search student or type…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Severity filter */}
          <div className="flex gap-1.5">
            {[{ v: "all", l: "All" }, ...SEVERITIES.map(s => ({ v: s.value, l: s.label }))].map(f => (
              <button key={f.v} onClick={() => setFilterSeverity(f.v)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all ${
                  filterSeverity === f.v
                    ? "bg-[#f9dc5a] text-[#5a4010] border-[#d4b830] shadow-sm"
                    : "bg-white text-[#8b7228] border-[#e5dfc0] hover:bg-[#f8f4d8]"
                }`}>{f.l}</button>
            ))}
          </div>

          {/* Status filter */}
          <div className="flex gap-1.5">
            {[{ v: "all", l: "All" }, ...STATUSES.map(s => ({ v: s.value, l: s.label }))].map(f => (
              <button key={f.v} onClick={() => setFilterStatus(f.v)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all ${
                  filterStatus === f.v
                    ? "bg-[#2a1c06] text-[#f9dc5a] border-[#2a1c06] shadow-sm"
                    : "bg-white text-[#8b7228] border-[#e5dfc0] hover:bg-[#f8f4d8]"
                }`}>{f.l}</button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {loading ? (
            <div className="flex flex-col gap-3">
              {[1,2,3].map(i => <div key={i} className="h-32 rounded-3xl bg-[#f8f4e8] animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
                style={{ background: "linear-gradient(160deg,#fff7d6 0%,#f5e4a8 100%)" }}>
                <svg className="w-9 h-9" fill="none" stroke="#c79b12" strokeWidth={1.75} viewBox="0 0 24 24">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <h2 className="text-xl font-black text-[#2a1c06] mb-2">
                {incidents.length === 0 ? "No incidents recorded" : "No results found"}
              </h2>
              <p className="text-[#a39070] text-sm max-w-xs mb-6">
                {incidents.length === 0
                  ? "File your first incident report to start tracking safety events."
                  : "Try adjusting your filters or search query."}
              </p>
              {incidents.length === 0 && (
                <button onClick={() => { setEditInc(null); setShowModal(true); }}
                  className="px-6 py-3 rounded-2xl font-bold text-sm text-[#5a4010]"
                  style={{ background: "linear-gradient(160deg,#f9dc5a 0%,#f0c930 100%)", boxShadow: "0 4px 14px rgba(212,170,31,0.35)" }}>
                  File First Report
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-[11px] font-semibold text-[#a3957e] uppercase tracking-[0.18em] mb-1">
                {filtered.length} Report{filtered.length !== 1 ? "s" : ""}
                {(filterSeverity !== "all" || filterStatus !== "all" || searchQuery) ? " (filtered)" : ""}
              </p>
              {filtered.map(inc => (
                <IncidentCard
                  key={inc.id}
                  incident={inc}
                  studentMap={studentMap}
                  onEdit={i => { setEditInc(i); setShowModal(true); }}
                  onDelete={handleDelete}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {showModal && (
        <IncidentModal
          incident={editInc}
          students={students}
          staff={staff}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditInc(null); }}
        />
      )}
    </div>
  );
}
