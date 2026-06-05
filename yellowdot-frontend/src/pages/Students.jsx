/**
 * Students.jsx — Premium Student Management System
 * ─────────────────────────────────────────────────────────────────
 * Dense, space-efficient two-panel ERP layout:
 *   Left   — Compact searchable directory (280px)
 *   Right  — Sticky header + quick actions + 11 tabs
 *
 * Tabs: Overview · Parents · Attendance · Food · Naps ·
 *       Pickup · Medical · Billing · Documents · Notes · Timeline
 * ─────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { api } from "../services/authService";
import { useAuth } from "../contexts/AuthContext";

// ── HTTP helpers ──────────────────────────────────────────────────
const get  = url       => api.get(url).then(r => r.data);
const post = (url, d)  => api.post(url, d).then(r => r.data);
const put  = (url, d)  => api.put(url, d).then(r => r.data);
const del  = url       => api.delete(url).then(r => r.data);

// ── Utility helpers ───────────────────────────────────────────────
function calcAge(dob) {
  if (!dob) return "—";
  const raw = dob.includes("/") ? dob.split("/").reverse().join("-") : dob;
  // handle dd-Mon-yyyy format
  const d = new Date(raw.replace(/-([A-Za-z]+)-/, (_, m) => {
    const mo = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };
    return `-${String(mo[m] !== undefined ? mo[m] + 1 : 1).padStart(2,"0")}-`;
  }));
  if (isNaN(d)) return "—";
  const diff = Date.now() - d.getTime();
  const y = Math.floor(diff / (365.25 * 864e5));
  const mo = Math.floor((diff % (365.25 * 864e5)) / (30.44 * 864e5));
  return y >= 1 ? `${y}y ${mo}m` : `${mo} mo`;
}

function initials(name = "") {
  return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase() || "?";
}

function compressImage(file, w = 200, h = 200, q = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        const scale = Math.max(w / img.width, h / img.height);
        const sw = w / scale, sh = h / scale;
        ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", q));
      };
      img.onerror = reject;
      img.src = ev.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Toast system ──────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((type, msg) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, type, msg }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }, []);
  return {
    toasts,
    success: useCallback(m => add("success", m), [add]),
    error:   useCallback(m => add("error",   m), [add]),
    info:    useCallback(m => add("info",    m), [add]),
    dismiss: useCallback(id => setToasts(t => t.filter(x => x.id !== id)), []),
  };
}

function Toasts({ toasts, dismiss }) {
  return (
    <div className="fixed bottom-5 right-5 z-[300] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`yd-toast pointer-events-auto ${
          t.type === "success" ? "yd-toast-success" : t.type === "error" ? "yd-toast-error" : "yd-toast-info"
        }`}>
          <span>{t.type === "success" ? "✅" : t.type === "error" ? "❌" : "ℹ️"}</span>
          <span className="flex-1">{t.msg}</span>
          <button onClick={() => dismiss(t.id)} className="w-4 h-4 flex items-center justify-center rounded-full bg-white/20 text-xs font-bold">×</button>
        </div>
      ))}
    </div>
  );
}

// ── Responsive hook ───────────────────────────────────────────────
function useIsMobile(bp = 768) {
  const [mob, setMob] = useState(() => window.innerWidth < bp);
  useEffect(() => {
    const fn = () => setMob(window.innerWidth < bp);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, [bp]);
  return mob;
}

// ── Shared form primitives ────────────────────────────────────────
const inp = (err) =>
  `yd-input text-sm ${err ? "border-yd-danger bg-yd-danger-soft" : ""}`;

function Field({ label, error, children, half }) {
  return (
    <div className={half ? "" : ""}>
      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">{label}</label>
      {children}
      {error && <p className="text-[10px] text-rose-500 mt-0.5">{error}</p>}
    </div>
  );
}

// ── Constants ─────────────────────────────────────────────────────
const CLASSES  = ["Daycare","Playgroup","Nursery","LKG","UKG","Class 1","Class 2","Class 3","Class 4","Class 5"];
const GENDERS  = ["Male","Female","Other"];
const CENTERS  = ["Seawoods","Vashi","Kharghar","Belapur"];
const STATUSES = ["Active","Inactive","Alumni"];

// ════════════════════════════════════════════════════════════════════
// ADD / EDIT STUDENT MODAL
// ════════════════════════════════════════════════════════════════════
function StudentModal({ student, onSave, onClose, saving }) {
  const isEdit  = !!student?.Student_ID;
  const photoRef = useRef(null);
  const [tab, setTab] = useState("basic");

  const [form, setForm] = useState({
    student_name:    student?.Student_Name    || "",
    dob:             student?.DOB             || "",
    class:           student?.Class           || "",
    gender:          student?.Gender          || "",
    center:          student?.Center          || "",
    join_date:       student?.Admission_Date  || "",
    status:          student?.Status          || "Active",
    father_name:     student?.Father_Name     || "",
    father_whatsapp: student?.Father_WhatsApp || "",
    father_email:    student?.Father_Email    || "",
    mother_name:     student?.Mother_Name     || "",
    mother_whatsapp: student?.Mother_WhatsApp || "",
    mother_email:    student?.Mother_Email    || "",
  });
  const [photoPreview, setPhotoPreview] = useState(student?.Profile_Image || "");
  const [photoBase64,  setPhotoBase64 ] = useState(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [errors,       setErrors      ] = useState({});

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: "" })); };

  async function handlePhoto(e) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setPhotoLoading(true);
    try {
      const b64 = await compressImage(file, 200, 200, 0.72);
      setPhotoPreview(b64);
      setPhotoBase64(b64);
    } finally { setPhotoLoading(false); }
  }

  function validate() {
    const e = {};
    if (!form.student_name.trim()) e.student_name = "Name required.";
    if (!form.class)               e.class = "Class required.";
    if (!form.gender)              e.gender = "Gender required.";
    if (form.father_whatsapp && !/^\d{10}$/.test(form.father_whatsapp)) e.father_whatsapp = "10 digits.";
    if (form.mother_whatsapp && !/^\d{10}$/.test(form.mother_whatsapp)) e.mother_whatsapp = "10 digits.";
    setErrors(e);
    return !Object.keys(e).length;
  }

  function handleSubmit(ev) {
    ev.preventDefault();
    if (!validate()) return;
    onSave({ ...form, student_name: form.student_name.trim(), ...(photoBase64 ? { profile_image: photoBase64 } : {}) });
  }

  return (
    <div className="yd-overlay">
      <div className="yd-modal w-full max-w-lg flex flex-col">
        {/* Header */}
        <div className="yd-modal-header flex-shrink-0">
          <div>
            <h2 className="yd-title-card text-lg">{isEdit ? "Edit Student" : "Add New Student"}</h2>
            {isEdit && <p className="text-xs text-yd-text-3">ID: {student.Student_ID}</p>}
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-yd-sm bg-yd-bg flex items-center justify-center text-yd-text-2 hover:bg-yd-border font-bold text-sm">✕</button>
        </div>

        {/* Photo + tabs */}
        <div className="flex items-center gap-4 px-5 pt-4 pb-3 border-b border-gray-100 bg-yd-bg flex-shrink-0">
          <div className="relative flex-shrink-0">
            {photoPreview
              ? <img src={photoPreview} alt="" className="w-14 h-14 rounded-xl object-cover border-2 border-yd-navy/10 shadow"/>
              : <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-yellow-200 to-yellow-400 flex items-center justify-center text-xl font-black text-yd-navy/60">{initials(form.student_name)}</div>
            }
            {photoLoading && <div className="absolute inset-0 rounded-xl bg-white/80 flex items-center justify-center"><div className="w-4 h-4 border-2 border-yd-yellow border-t-transparent rounded-full animate-spin"/></div>}
          </div>
          <div className="flex-1">
            <button type="button" onClick={() => photoRef.current?.click()}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-[#1f1f1f] bg-white hover:bg-yd-yellow-pale rounded-lg border border-gray-200 mb-2">
              📷 {photoPreview ? "Change Photo" : "Upload Photo"}
            </button>
            <input ref={photoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto}/>
            <div className="flex gap-1">
              {[{ k:"basic", label:"Basic Info" },{ k:"parents", label:"Parents" }].map(t => (
                <button key={t.k} type="button" onClick={() => setTab(t.k)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${tab === t.k ? "bg-yd-yellow text-[#1f1f1f] shadow-sm" : "text-gray-500 hover:bg-gray-200"}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-3">
          {tab === "basic" && (<>
            <Field label="Full Name *" error={errors.student_name}>
              <input value={form.student_name} onChange={e => set("student_name", e.target.value)} placeholder="Student's full name" className={inp(errors.student_name)}/>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date of Birth">
                <input type="date" value={form.dob} onChange={e => set("dob", e.target.value)} className={inp()}/>
              </Field>
              <Field label="Joining Date">
                <input type="date" value={form.join_date} onChange={e => set("join_date", e.target.value)} className={inp()}/>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Class *" error={errors.class}>
                <select value={form.class} onChange={e => set("class", e.target.value)} className={inp(errors.class)}>
                  <option value="">Select class…</option>
                  {CLASSES.map(c => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Gender *" error={errors.gender}>
                <select value={form.gender} onChange={e => set("gender", e.target.value)} className={inp(errors.gender)}>
                  <option value="">Select…</option>
                  {GENDERS.map(g => <option key={g}>{g}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Center">
                <select value={form.center} onChange={e => set("center", e.target.value)} className={inp()}>
                  <option value="">Select center…</option>
                  {CENTERS.map(c => <option key={c}>{c}</option>)}
                </select>
              </Field>
              {isEdit && (
                <Field label="Status">
                  <select value={form.status} onChange={e => set("status", e.target.value)} className={inp()}>
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </Field>
              )}
            </div>
          </>)}

          {tab === "parents" && (<>
            <p className="text-[10px] font-black text-yd-text-3 uppercase tracking-widest">Father</p>
            <Field label="Name">
              <input value={form.father_name} onChange={e => set("father_name", e.target.value)} placeholder="Father's full name" className={inp()}/>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="WhatsApp" error={errors.father_whatsapp}>
                <input value={form.father_whatsapp} onChange={e => set("father_whatsapp", e.target.value.replace(/\D/g,"").slice(0,10))} placeholder="10 digits" className={inp(errors.father_whatsapp)}/>
              </Field>
              <Field label="Email">
                <input type="email" value={form.father_email} onChange={e => set("father_email", e.target.value)} placeholder="email" className={inp()}/>
              </Field>
            </div>
            <div className="h-px bg-gray-100 my-1"/>
            <p className="text-[10px] font-black text-yd-text-3 uppercase tracking-widest">Mother</p>
            <Field label="Name">
              <input value={form.mother_name} onChange={e => set("mother_name", e.target.value)} placeholder="Mother's full name" className={inp()}/>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="WhatsApp" error={errors.mother_whatsapp}>
                <input value={form.mother_whatsapp} onChange={e => set("mother_whatsapp", e.target.value.replace(/\D/g,"").slice(0,10))} placeholder="10 digits" className={inp(errors.mother_whatsapp)}/>
              </Field>
              <Field label="Email">
                <input type="email" value={form.mother_email} onChange={e => set("mother_email", e.target.value)} placeholder="email" className={inp()}/>
              </Field>
            </div>
          </>)}
        </form>

        {/* Footer */}
        <div className="yd-modal-footer flex-shrink-0">
          <button type="button" onClick={onClose} className="btn btn-ghost flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            className="btn btn-dark flex-1 disabled:opacity-60">
            {saving ? <><div className="yd-spinner w-3.5 h-3.5"/> Saving…</> : (isEdit ? "Update Student" : "Add Student")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// STUDENT DIRECTORY — Left Panel (compact, dense)
// ════════════════════════════════════════════════════════════════════
function StudentDirectory({ students, loading, selectedId, onSelect, onAdd, canAdd = true, isMobile = false }) {
  const [search,       setSearch      ] = useState("");
  const [classFilter,  setClassFilter ] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const classes = useMemo(() => {
    const s = new Set(students.map(x => x.Class || "").filter(Boolean));
    return ["All", ...Array.from(s).sort()];
  }, [students]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter(s => {
      const name = (s.Student_Name || "").toLowerCase();
      const id   = (s.Student_ID   || "").toLowerCase();
      const cls  = (s.Class        || "").toLowerCase();
      const matchSearch = !q || name.includes(q) || id.includes(q) || cls.includes(q);
      const matchClass  = classFilter  === "All" || s.Class  === classFilter;
      const matchStatus = statusFilter === "All" || (s.Status || "Active") === statusFilter;
      return matchSearch && matchClass && matchStatus;
    });
  }, [students, search, classFilter, statusFilter]);

  return (
    <div className="stu-dir">
      {/* ── Header ── */}
      <div className="stu-dir-header">
        <div className="flex items-center justify-between mb-2.5">
          <div>
            <h2 className="text-sm font-black text-gray-900">Students</h2>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {filtered.length} of {students.length} students
            </p>
          </div>
          {canAdd && (
            <button onClick={onAdd}
              className="stu-add-btn flex items-center gap-1 px-3 py-2 bg-yd-yellow text-[#1f1f1f]
                         rounded-xl text-[12px] font-black hover:bg-yd-yellow-dark shadow-sm active:scale-95 transition-all">
              + Add Student
            </button>
          )}
        </div>

        {/* Search */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search name, ID, class…"
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 text-gray-700
                     focus:outline-none focus:ring-2 focus:ring-yd-yellow/20 focus:border-yd-yellow
                     bg-gray-50 placeholder-gray-400"
        />

        {/* Filters */}
        <div className="flex gap-2 mt-2">
          <select value={classFilter} onChange={e => setClassFilter(e.target.value)}
            className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600
                       focus:outline-none focus:border-yd-yellow bg-white">
            {classes.map(c => <option key={c}>{c}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600
                       focus:outline-none focus:border-yd-yellow bg-white">
            {["All","Active","Inactive","Alumni"].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* ── List ── */}
      <div className="stu-dir-list">
        {loading ? (
          /* Skeleton — desktop: narrow rows, mobile: taller cards */
          <div className={`p-3 ${isMobile ? "grid grid-cols-1 gap-2" : "space-y-1"}`}>
            {[...Array(isMobile ? 6 : 8)].map((_, i) => (
              <div key={i}
                className={`rounded-2xl bg-gray-100 animate-pulse ${isMobile ? "h-20" : "h-12"}`}
                style={{ animationDelay: `${i * 50}ms` }}
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center px-4">
            <div className="text-4xl mb-2 opacity-40">🔍</div>
            <p className="text-gray-500 text-sm font-semibold">No students found</p>
            <p className="text-gray-400 text-xs mt-0.5">Adjust filters or search</p>
          </div>
        ) : isMobile ? (
          /* ── Mobile: full-width card grid ── */
          <div className="p-3 grid grid-cols-1 gap-2">
            {filtered.map(s => {
              const sid  = s.Student_ID || s.id;
              const name = s.Student_Name || s.name;
              const cls  = s.Class || s.class;
              const st   = s.Status || "Active";
              const age  = calcAge(s.DOB || s.dob);
              return (
                <button
                  key={sid}
                  onClick={() => onSelect(sid)}
                  className="w-full flex items-center gap-3 p-3.5 bg-white rounded-2xl border border-gray-100
                             text-left transition-all hover:border-yd-yellow hover:shadow-md
                             active:scale-[0.98] shadow-sm"
                >
                  {/* Avatar */}
                  {s.Profile_Image ? (
                    <img src={s.Profile_Image} alt={name}
                      className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-gray-100 shadow-sm"/>
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yd-yellow-soft to-yd-yellow-light
                                    flex items-center justify-center text-base font-black text-yd-navy flex-shrink-0 shadow-sm">
                      {initials(name)}
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold text-gray-900 leading-tight">{name}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">{cls} · {sid}</p>
                    {age !== "—" && (
                      <p className="text-[10px] text-gray-400 mt-0.5">Age {age}</p>
                    )}
                  </div>

                  {/* Status + chevron */}
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold
                      ${st === "Active"
                        ? "bg-yd-success-soft text-yd-success border border-yd-success-border"
                        : "bg-gray-100 text-gray-500 border border-gray-200"}`}>
                      <span className={`w-1 h-1 rounded-full ${st === "Active" ? "bg-yd-success" : "bg-gray-400"}`}/>
                      {st}
                    </span>
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5"
                      viewBox="0 0 24 24" className="text-gray-300">
                      <path d="M9 18l6-6-6-6"/>
                    </svg>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          /* ── Desktop: compact list rows ── */
          <div className="p-1.5 space-y-0.5">
            {filtered.map(s => {
              const sid  = s.Student_ID || s.id;
              const name = s.Student_Name || s.name;
              const cls  = s.Class || s.class;
              const st   = s.Status || "Active";
              const sel  = selectedId === sid;
              return (
                <button key={sid} onClick={() => onSelect(sid)}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left transition-all
                    ${sel ? "shadow-sm" : "hover:bg-gray-50"}`}
                  style={sel ? {
                    background: "linear-gradient(135deg, #fffbeb 0%, #fef9e7 100%)",
                    boxShadow: "inset 3px 0 0 #eab308, 0 2px 8px rgba(234,179,8,0.12)",
                  } : {}}>
                  {s.Profile_Image ? (
                    <img src={s.Profile_Image} alt={name}
                      className={`w-8 h-8 rounded-lg object-cover flex-shrink-0 border ${sel ? "border-amber-200" : "border-gray-100"}`}/>
                  ) : (
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-black flex-shrink-0
                      ${sel ? "bg-amber-100 text-amber-800" : "bg-yellow-100 text-[#1f1f1f]"}`}>
                      {initials(name)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold truncate leading-tight text-gray-900">{name}</p>
                    <p className={`text-[10px] font-mono ${sel ? "text-amber-600" : "text-gray-400"}`}>{cls} · {sid}</p>
                  </div>
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${st === "Active" ? "bg-yd-success" : "bg-gray-300"}`}/>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// QUICK ACTION MODALS
// ════════════════════════════════════════════════════════════════════
function EmergencyCallModal({ student, onClose }) {
  const contacts = [
    { role: "Father", name: student.Father_Name, phone: student.Father_WhatsApp },
    { role: "Mother", name: student.Mother_Name, phone: student.Mother_WhatsApp },
  ].filter(c => c.phone);

  return (
    <div className="yd-overlay">
      <div className="yd-modal w-full max-w-xs">
        <div className="yd-modal-header">
          <h3 className="yd-title-card">🚨 Emergency Contacts</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-yd-sm bg-yd-bg flex items-center justify-center text-yd-text-2 text-sm font-bold">✕</button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-gray-500 font-semibold">{student.Student_Name}</p>
          {contacts.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No contact numbers saved.</p>
          ) : contacts.map(c => (
            <div key={c.role} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-900">{c.name || c.role}</p>
                <p className="text-xs text-gray-500">{c.role} · {c.phone}</p>
              </div>
              <a href={`tel:${c.phone}`}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-yd-yellow text-[#1f1f1f] rounded-lg text-xs font-bold hover:bg-yd-yellow-dark shadow-sm">
                📞 Call
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function QRModal({ student, onClose }) {
  const qrData = JSON.stringify({ id: student.Student_ID, name: student.Student_Name, class: student.Class });
  return (
    <div className="yd-overlay">
      <div className="yd-modal w-full max-w-xs">
        <div className="yd-modal-header">
          <h3 className="yd-title-card">📱 Student QR Code</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-yd-sm bg-yd-bg flex items-center justify-center text-yd-text-2 text-sm font-bold">✕</button>
        </div>
        <div className="p-5 flex flex-col items-center gap-4">
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
            <div className="w-36 h-36 bg-white flex items-center justify-center rounded-lg border border-gray-200">
              <div className="text-center">
                <p className="text-4xl">📱</p>
                <p className="text-[10px] text-gray-400 mt-1">QR Display</p>
              </div>
            </div>
          </div>
          <div className="text-center">
            <p className="font-black text-gray-900 text-sm">{student.Student_Name}</p>
            <p className="text-xs text-gray-500 font-mono mt-0.5">{student.Student_ID} · {student.Class}</p>
          </div>
          <div className="bg-gray-50 rounded-xl px-3 py-2 w-full">
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">QR Data</p>
            <p className="text-[10px] font-mono text-gray-600 break-all">{qrData}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// PROFILE TABS
// ════════════════════════════════════════════════════════════════════

// ── Overview Tab ─────────────────────────────────────────────────
function OverviewTab({ student, onEdit, canEdit = true }) {
  const fields = [
    { label:"Class",       val: student.Class },
    { label:"Gender",      val: student.Gender },
    { label:"DOB",         val: student.DOB },
    { label:"Age",         val: calcAge(student.DOB) },
    { label:"Joining",     val: student.Admission_Date },
    { label:"Center",      val: student.Center },
    { label:"Status",      val: student.Status || "Active" },
    { label:"ID",          val: student.Student_ID },
  ];
  const parents = [
    { role:"Father", name: student.Father_Name, phone: student.Father_WhatsApp, email: student.Father_Email },
    { role:"Mother", name: student.Mother_Name, phone: student.Mother_WhatsApp, email: student.Mother_Email },
  ].filter(p => p.name);

  return (
    <div className="p-4 space-y-4">
      {/* Profile card */}
      <div className="flex items-start gap-4 bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
        {student.Profile_Image ? (
          <img src={student.Profile_Image} alt="" className="w-16 h-16 rounded-xl object-cover border-2 border-gray-100 shadow flex-shrink-0"/>
        ) : (
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-yellow-200 to-yellow-400 flex items-center justify-center text-2xl font-black text-yd-navy/60 flex-shrink-0 shadow">
            {initials(student.Student_Name)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="yd-title-card text-lg leading-tight truncate">{student.Student_Name}</h2>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs font-mono text-gray-400">{student.Student_ID}</span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border
              ${(student.Status || "Active") === "Active" ? "bg-yd-success-soft text-yd-success border-yd-success-border" : "bg-gray-100 text-gray-600 border-gray-200"}`}>
              <div className={`w-1 h-1 rounded-full ${(student.Status || "Active") === "Active" ? "bg-yd-success" : "bg-gray-400"}`}/>
              {student.Status || "Active"}
            </span>
          </div>
          {canEdit && (
            <button onClick={onEdit}
              className="mt-2 flex items-center gap-1 px-3 py-1 bg-yd-yellow text-[#1f1f1f] rounded-lg text-[11px] font-bold hover:bg-yd-yellow-dark shadow-sm">
              ✏️ Edit Profile
            </button>
          )}
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {fields.map(({ label, val }) => (
          <div key={label} className="bg-white rounded-xl px-3 py-2.5 border border-gray-100">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider">{label}</p>
            <p className="text-xs font-bold text-gray-900 mt-0.5 truncate">{val || "—"}</p>
          </div>
        ))}
      </div>

      {/* Parents */}
      {parents.length > 0 && (
        <div>
          <h3 className="text-[10px] font-black text-yd-text-3 uppercase tracking-widest mb-2">Parent Contacts</h3>
          <div className="grid grid-cols-2 gap-2">
            {parents.map(p => (
              <div key={p.role} className="flex items-start gap-3 bg-yd-yellow-pale rounded-xl p-3 border border-yd-border">
                <div className="w-8 h-8 rounded-lg bg-yd-yellow flex items-center justify-center text-sm flex-shrink-0">
                  {p.role === "Father" ? "👨" : "👩"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 text-xs truncate">{p.name}</p>
                  <p className="text-[10px] text-gray-500">{p.role}</p>
                  {p.phone && <p className="text-[10px] font-mono text-gray-600">{p.phone}</p>}
                  {p.phone && (
                    <a href={`tel:${p.phone}`}
                      className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-[#1f1f1f] bg-white px-2 py-0.5 rounded-md border border-yd-border hover:bg-yd-yellow-pale">
                      📞 Call
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Parents Tab ───────────────────────────────────────────────────
function ParentsTab({ student, onSaved, toast }) {
  const [editing, setEditing] = useState(false);
  const [saving,  setSaving ] = useState(false);
  const [form,    setForm   ] = useState({
    father_name:     student.Father_Name     || "",
    father_whatsapp: student.Father_WhatsApp || "",
    father_email:    student.Father_Email    || "",
    mother_name:     student.Mother_Name     || "",
    mother_whatsapp: student.Mother_WhatsApp || "",
    mother_email:    student.Mother_Email    || "",
  });
  const sf = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function save() {
    setSaving(true);
    try {
      const r = await put(`/update-student/${student.Student_ID}`, form);
      if (r.success) { toast.success("Parent info updated."); setEditing(false); onSaved(); }
      else toast.error(r.message || "Failed to save.");
    } catch { toast.error("Error saving."); }
    finally { setSaving(false); }
  }

  const sections = [
    { role:"Father", icon:"👨", fields:[
      { label:"Name",     key:"father_name",     placeholder:"Father's name" },
      { label:"WhatsApp", key:"father_whatsapp", placeholder:"10 digits", type:"tel" },
      { label:"Email",    key:"father_email",    placeholder:"email", type:"email" },
    ]},
    { role:"Mother", icon:"👩", fields:[
      { label:"Name",     key:"mother_name",     placeholder:"Mother's name" },
      { label:"WhatsApp", key:"mother_whatsapp", placeholder:"10 digits", type:"tel" },
      { label:"Email",    key:"mother_email",    placeholder:"email", type:"email" },
    ]},
  ];

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-gray-900">Parent & Guardian Details</h3>
        {!editing
          ? <button onClick={() => setEditing(true)} className="px-3 py-1.5 bg-yd-yellow text-[#1f1f1f] rounded-lg text-[11px] font-bold hover:bg-yd-yellow-dark shadow-sm">✏️ Edit</button>
          : <div className="flex gap-1.5">
              <button onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-[11px] font-bold hover:bg-gray-50">Cancel</button>
              <button onClick={save} disabled={saving} className="btn btn-success btn-xs">
                {saving && <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin"/>} Save
              </button>
            </div>
        }
      </div>
      <div className="grid grid-cols-2 gap-3">
        {sections.map(({ role, icon, fields }) => (
          <div key={role} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-yd-yellow flex items-center justify-center text-sm">{icon}</div>
              <h4 className="font-black text-gray-800 text-sm">{role}</h4>
            </div>
            <div className="space-y-2">
              {fields.map(f => (
                <div key={f.key}>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">{f.label}</label>
                  {editing
                    ? <input type={f.type||"text"} value={form[f.key]} onChange={e => sf(f.key, e.target.value)}
                        placeholder={f.placeholder}
                        className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-yd-yellow/30 focus:border-yd-yellow"/>
                    : <span className="text-xs text-gray-800 font-medium">{form[f.key] || <span className="text-gray-300 italic">—</span>}</span>
                  }
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Attendance Tab ─────────────────────────────────────────────────
function AttendanceTab({ student }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    get(`/api/attendance?studentId=${encodeURIComponent(student.Student_ID)}&date=`)
      .then(d => { if (mountedRef.current) setEntries(d.entries || []); })
      .catch(() => {})
      .finally(() => { if (mountedRef.current) setLoading(false); });
    return () => { mountedRef.current = false; };
  }, [student.Student_ID]);

  const total   = entries.length;
  const present = entries.filter(e => e.status === "Present").length;
  const absent  = entries.filter(e => e.status === "Absent").length;
  const late    = entries.filter(e => e.status === "Late").length;
  const pct     = total ? Math.round((present / total) * 100) : 0;

  // Avg check-in time
  const checkIns = entries.filter(e => e.checkIn).map(e => e.checkIn);
  const avgCheckIn = checkIns.length
    ? (() => {
        const mins = checkIns.map(t => { const [h,m] = t.split(":").map(Number); return h * 60 + (m||0); });
        const avg = Math.round(mins.reduce((a,b) => a+b, 0) / mins.length);
        return `${String(Math.floor(avg/60)).padStart(2,"0")}:${String(avg%60).padStart(2,"0")}`;
      })()
    : "—";

  const statusCls = { Present:"bg-yd-success-soft text-yd-success border-yd-success-border", Absent:"bg-yd-danger-soft text-yd-danger border-yd-danger-border", Late:"bg-amber-100 text-amber-700 border-amber-200" };

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-sm font-black text-gray-900">Attendance</h3>

      {loading ? <div className="space-y-2">{[...Array(4)].map((_,i) => <div key={i} className="h-10 rounded-xl bg-gray-100 animate-pulse"/>)}</div> : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[
              { label:"Present", val:present, bg:"bg-yd-success-soft", col:"text-yd-success", border:"border-yd-success-border" },
              { label:"Absent",  val:absent,  bg:"bg-yd-danger-soft", col:"text-yd-danger", border:"border-yd-danger-border" },
              { label:"Late",    val:late,     bg:"bg-amber-50",   col:"text-amber-700",   border:"border-amber-200" },
              { label:"Rate",    val:`${pct}%`,bg:"bg-amber-50",   col:"text-amber-700",   border:"border-amber-200" },
              { label:"Avg In",  val:avgCheckIn, bg:"bg-purple-50", col:"text-purple-700", border:"border-purple-200" },
            ].map(s => (
              <div key={s.label} className={`${s.bg} rounded-xl p-2.5 border ${s.border} text-center`}>
                <p className={`text-lg font-black ${s.col} leading-tight`}>{s.val}</p>
                <p className={`text-[9px] font-bold ${s.col} mt-0.5`}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Records list */}
          {entries.length === 0
            ? <div className="text-center py-8 text-gray-400"><div className="text-3xl mb-2">📅</div><p className="text-xs font-semibold">No attendance records</p></div>
            : <div className="space-y-1 max-h-64 overflow-y-auto">
                {entries.slice(0, 60).map((e, i) => (
                  <div key={i} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-gray-100">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${statusCls[e.status] || "bg-gray-100 text-gray-600 border-gray-200"}`}>{e.status}</span>
                    <span className="text-xs font-semibold text-gray-700 flex-1">{e.date}</span>
                    <span className="text-[10px] text-gray-400">{e.checkIn && `↓ ${e.checkIn}`}{e.checkOut && ` ↑ ${e.checkOut}`}</span>
                    <span className="text-[10px] text-gray-300">{e.attendanceMethod}</span>
                  </div>
                ))}
              </div>
          }
        </>
      )}
    </div>
  );
}

// ── Food Tab ──────────────────────────────────────────────────────
function FoodTab({ student }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    get(`/api/food-consumption?studentId=${encodeURIComponent(student.Student_ID)}`)
      .then(d => { if (mountedRef.current) setRecords(d.entries || d || []); })
      .catch(() => {})
      .finally(() => { if (mountedRef.current) setLoading(false); });
    return () => { mountedRef.current = false; };
  }, [student.Student_ID]);

  const mealBadge = {
    Breakfast: "bg-amber-100 text-amber-700",
    Lunch:     "bg-emerald-100 text-emerald-700",
    Snack:     "bg-amber-100 text-amber-700",
    Dinner:    "bg-purple-100 text-purple-700",
  };

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-gray-900">Food Consumption</h3>
        <Link to="/food-consumption" className="px-2.5 py-1 bg-yd-yellow text-[#1f1f1f] rounded-lg text-[11px] font-bold hover:bg-yd-yellow-dark">+ Log Food</Link>
      </div>
      {loading
        ? <div className="space-y-1">{[...Array(4)].map((_,i) => <div key={i} className="h-10 rounded-xl bg-gray-100 animate-pulse"/>)}</div>
        : records.length === 0
        ? <div className="text-center py-8 text-gray-400"><div className="text-3xl mb-2">🍽️</div><p className="text-xs font-semibold">No food records</p></div>
        : <div className="space-y-1 max-h-80 overflow-y-auto">
            {records.slice(0, 40).map((r, i) => {
              const mealType  = r.mealType || r.Meal_Type || "";
              const foodItem  = r.foodItem || r.Food_Item || "";
              const qty       = parseFloat(r.quantity || r.Quantity || 0);
              const didntEat  = qty === 0 || (r.status || r.Status) === "Didn't Eat";
              return (
                <div key={i} className={`flex items-center gap-2 rounded-xl px-3 py-2 border ${didntEat ? "bg-rose-50 border-rose-100" : "bg-white border-gray-100"}`}>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${mealBadge[mealType] || "bg-gray-100 text-gray-600"}`}>{mealType}</span>
                  <span className={`text-xs font-semibold flex-1 ${didntEat ? "text-rose-600" : "text-gray-700"}`}>{foodItem || "—"}</span>
                  {didntEat
                    ? <span className="text-[10px] font-black text-rose-500">⚠ Didn't Eat</span>
                    : <span className="text-[10px] text-gray-400">{r.quantity || r.Quantity} {r.unit || r.Unit}</span>
                  }
                  <span className="text-[10px] text-gray-300">{r.date || r.Date}</span>
                </div>
              );
            })}
          </div>
      }
    </div>
  );
}

// ── Nap Tab ───────────────────────────────────────────────────────
function NapTab({ student }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    get(`/api/nap-sessions?studentId=${encodeURIComponent(student.Student_ID)}`)
      .then(d => { if (mountedRef.current) setRecords(d.sessions || d.entries || []); })
      .catch(() => {})
      .finally(() => { if (mountedRef.current) setLoading(false); });
    return () => { mountedRef.current = false; };
  }, [student.Student_ID]);

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-gray-900">Nap Records</h3>
        <Link to="/nap-tracker" className="px-2.5 py-1 bg-yd-yellow text-[#1f1f1f] rounded-lg text-[11px] font-bold hover:bg-yd-yellow-dark">+ Log Nap</Link>
      </div>
      {loading
        ? <div className="space-y-1">{[...Array(4)].map((_,i) => <div key={i} className="h-10 rounded-xl bg-gray-100 animate-pulse"/>)}</div>
        : records.length === 0
        ? <div className="text-center py-8 text-gray-400"><div className="text-3xl mb-2">😴</div><p className="text-xs font-semibold">No nap records</p></div>
        : <div className="space-y-1 max-h-80 overflow-y-auto">
            {records.slice(0, 40).map((r, i) => (
              <div key={i} className="flex items-center gap-2 bg-purple-50 rounded-xl px-3 py-2 border border-purple-100">
                <span className="text-base">😴</span>
                <span className="text-xs font-semibold text-gray-700 flex-1">{r.date || r.Date}</span>
                <span className="text-xs text-gray-500">{r.startTime || r.Start_Time} – {r.endTime || r.End_Time}</span>
                {(r.duration || r.Duration) && <span className="text-[10px] font-bold text-purple-600">{r.duration || r.Duration}</span>}
              </div>
            ))}
          </div>
      }
    </div>
  );
}

// ── Pickup Auth Tab ────────────────────────────────────────────────
function PickupAuthTab({ student, toast }) {
  const [persons, setPersons] = useState([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const load = useCallback(() => {
    setLoading(true);
    get(`/api/pickup-authorization?studentId=${encodeURIComponent(student.Student_ID)}`)
      .then(d => { if (mountedRef.current) setPersons(d.entries || []); })
      .catch(() => {})
      .finally(() => { if (mountedRef.current) setLoading(false); });
  }, [student.Student_ID]);

  useEffect(() => { mountedRef.current = true; load(); return () => { mountedRef.current = false; }; }, [load]);

  async function remove(id, name) {
    if (!window.confirm(`Remove ${name}?`)) return;
    try {
      const r = await del(`/api/pickup-authorization/${id}`);
      if (r.success) { toast.success(`${name} removed.`); load(); }
      else toast.error(r.error || "Failed.");
    } catch { toast.error("Error removing."); }
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-gray-900">Authorized Pickup</h3>
        <Link to="/pickup-authorization"
          className="px-2.5 py-1 bg-yd-yellow text-[#1f1f1f] rounded-lg text-[11px] font-bold hover:bg-yd-yellow-dark shadow-sm">
          🔐 Manage
        </Link>
      </div>
      {loading
        ? <div className="space-y-2">{[...Array(3)].map((_,i) => <div key={i} className="h-12 rounded-xl bg-gray-100 animate-pulse"/>)}</div>
        : persons.length === 0
        ? <div className="text-center py-8 text-gray-400">
            <div className="text-3xl mb-2">🔐</div>
            <p className="text-xs font-semibold">No authorized persons</p>
            <Link to="/pickup-authorization" className="text-[#7a5c00] text-[11px] font-bold underline mt-1 block">Add persons →</Link>
          </div>
        : <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {persons.map(p => (
              <div key={p.entryId} className={`flex items-center gap-3 rounded-xl px-3 py-2 border ${p.emergency ? "bg-yd-warn-soft border-yd-warn-border" : "bg-white border-gray-100"}`}>
                {p.photoUrl
                  ? <img src={p.photoUrl} alt="" className="w-9 h-9 rounded-lg object-cover border border-gray-200 flex-shrink-0"/>
                  : <div className="w-9 h-9 rounded-lg bg-yd-yellow-light flex items-center justify-center text-[10px] font-black text-[#1f1f1f] flex-shrink-0">{initials(p.pickupName)}</div>
                }
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-bold text-xs text-gray-900 truncate">{p.pickupName}</p>
                    {p.emergency && <span className="text-[9px] font-black text-amber-700 bg-amber-200 px-1 py-0.5 rounded-full">🚨</span>}
                  </div>
                  <p className="text-[10px] text-gray-500">{p.relation} · {p.mobile || "—"}</p>
                </div>
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full border
                  ${p.status === "Active" ? "bg-yd-success-soft text-yd-success border-yd-success-border" : "bg-gray-100 text-gray-500 border-gray-200"}`}>{p.status}</span>
                <button onClick={() => remove(p.entryId, p.pickupName)}
                  className="text-rose-400 hover:text-rose-600 text-xs px-1.5 py-1 rounded-lg hover:bg-rose-50">✕</button>
              </div>
            ))}
          </div>
      }
    </div>
  );
}

// ── Medical Tab ───────────────────────────────────────────────────
const BLOOD_GROUPS = ["","A+","A-","B+","B-","AB+","AB-","O+","O-","Unknown"];

function MedicalTab({ student, toast }) {
  const [data,    setData   ] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving,  setSaving ] = useState(false);
  const [form,    setForm   ] = useState({ bloodGroup:"", allergies:"", medications:"", doctorName:"", doctorPhone:"", emergencyNotes:"", notes:"" });
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    get(`/api/student-medical/${encodeURIComponent(student.Student_ID)}`)
      .then(d => {
        if (!mountedRef.current) return;
        const e = d.entry;
        if (e) { setData(e); setForm({ bloodGroup:e.bloodGroup||"", allergies:e.allergies||"", medications:e.medications||"", doctorName:e.doctorName||"", doctorPhone:e.doctorPhone||"", emergencyNotes:e.emergencyNotes||"", notes:e.notes||"" }); }
      })
      .catch(() => {})
      .finally(() => { if (mountedRef.current) setLoading(false); });
    return () => { mountedRef.current = false; };
  }, [student.Student_ID]);

  const sf = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function save() {
    setSaving(true);
    try {
      const r = await put(`/api/student-medical/${student.Student_ID}`, form);
      if (r.success) { toast.success("Medical info saved."); setData({ ...form }); setEditing(false); }
      else toast.error(r.error || "Failed.");
    } catch { toast.error("Error saving."); }
    finally { if (mountedRef.current) setSaving(false); }
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-gray-900">Medical Information</h3>
        {!editing
          ? <button onClick={() => setEditing(true)} className="px-3 py-1.5 bg-yd-yellow text-[#1f1f1f] rounded-lg text-[11px] font-bold hover:bg-yd-yellow-dark shadow-sm">✏️ Edit</button>
          : <div className="flex gap-1.5">
              <button onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-[11px] font-bold hover:bg-gray-50">Cancel</button>
              <button onClick={save} disabled={saving} className="btn btn-success btn-xs">
                {saving && <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin"/>} Save
              </button>
            </div>
        }
      </div>

      {form.allergies && !editing && (
        <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
          <span className="text-base">⚠️</span>
          <span className="text-xs font-bold text-rose-700">Allergic to: {form.allergies}</span>
        </div>
      )}

      {loading
        ? <div className="space-y-2">{[...Array(5)].map((_,i) => <div key={i} className="h-10 rounded-xl bg-gray-100 animate-pulse"/>)}</div>
        : (
          <div className="grid grid-cols-2 gap-3">
            {/* Left column */}
            <div className="space-y-3">
              {[
                { label:"Blood Group", key:"bloodGroup", type:"select" },
                { label:"Doctor Name",  key:"doctorName",  placeholder:"Dr. Name" },
                { label:"Doctor Phone", key:"doctorPhone", placeholder:"Number", type:"tel" },
              ].map(f => (
                <div key={f.key} className="bg-white rounded-xl px-3 py-2.5 border border-gray-100">
                  <label className="block text-[9px] font-black text-gray-400 uppercase tracking-wider mb-1">{f.label}</label>
                  {editing
                    ? f.type === "select"
                      ? <select value={form[f.key]} onChange={e => sf(f.key, e.target.value)} className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-yd-yellow">
                          {BLOOD_GROUPS.map(o => <option key={o} value={o}>{o || "Select…"}</option>)}
                        </select>
                      : <input type={f.type||"text"} value={form[f.key]} onChange={e => sf(f.key, e.target.value)} placeholder={f.placeholder} className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-yd-yellow"/>
                    : <p className="text-xs font-bold text-gray-900">{form[f.key] || <span className="text-gray-300 italic">—</span>}</p>
                  }
                </div>
              ))}
            </div>
            {/* Right column */}
            <div className="space-y-3">
              {[
                { label:"Allergies",       key:"allergies",      type:"textarea", placeholder:"e.g. peanuts, dust…" },
                { label:"Medications",     key:"medications",    type:"textarea", placeholder:"Current medications…" },
              ].map(f => (
                <div key={f.key} className="bg-white rounded-xl px-3 py-2.5 border border-gray-100">
                  <label className="block text-[9px] font-black text-gray-400 uppercase tracking-wider mb-1">{f.label}</label>
                  {editing
                    ? <textarea value={form[f.key]} onChange={e => sf(f.key, e.target.value)} rows={2} placeholder={f.placeholder} className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-yd-yellow resize-none"/>
                    : <p className="text-xs font-medium text-gray-900">{form[f.key] || <span className="text-gray-300 italic">—</span>}</p>
                  }
                </div>
              ))}
            </div>
            {/* Full width fields */}
            <div className="col-span-2 space-y-3">
              {[
                { label:"Emergency Notes", key:"emergencyNotes", type:"textarea", placeholder:"Important for emergencies…" },
                { label:"Additional Notes", key:"notes",         type:"textarea", placeholder:"Any other info…" },
              ].map(f => (
                <div key={f.key} className="bg-white rounded-xl px-3 py-2.5 border border-gray-100">
                  <label className="block text-[9px] font-black text-gray-400 uppercase tracking-wider mb-1">{f.label}</label>
                  {editing
                    ? <textarea value={form[f.key]} onChange={e => sf(f.key, e.target.value)} rows={2} placeholder={f.placeholder} className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-yd-yellow resize-none"/>
                    : <p className="text-xs font-medium text-gray-900">{form[f.key] || <span className="text-gray-300 italic">—</span>}</p>
                  }
                </div>
              ))}
            </div>
          </div>
        )
      }
    </div>
  );
}

// ── Billing Tab ───────────────────────────────────────────────────
function BillingTab({ student }) {
  const [invoices, setInvoices] = useState([]);
  const [loading,  setLoading ] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    get("/api/invoices")
      .then(res => {
        if (!mountedRef.current) return;
        const allInv = res.success ? (res.invoices || []) : (Array.isArray(res) ? res : []);
        const filtered = allInv.filter(inv => (inv.studentId || inv.Student_ID || "") === student.Student_ID);
        setInvoices(filtered);
      })
      .catch(() => {})
      .finally(() => { if (mountedRef.current) setLoading(false); });
    return () => { mountedRef.current = false; };
  }, [student.Student_ID]);

  const totalPaid = invoices.reduce((s, i) => s + (Number(i.paidAmount || i.Paid_Amount) || 0), 0);
  const totalDue  = invoices.reduce((s, i) => s + (Number(i.balance    || i.Balance)     || 0), 0);

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-gray-900">Billing & Invoices</h3>
        <Link to="/generate-invoice" className="px-2.5 py-1 bg-yd-yellow text-[#1f1f1f] rounded-lg text-[11px] font-bold hover:bg-yd-yellow-dark shadow-sm">+ Invoice</Link>
      </div>
      {loading
        ? <div className="space-y-1">{[...Array(3)].map((_,i) => <div key={i} className="h-10 rounded-xl bg-gray-100 animate-pulse"/>)}</div>
        : (<>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
              <p className="text-xl font-black text-emerald-700">₹{totalPaid.toFixed(0)}</p>
              <p className="text-[10px] font-bold text-emerald-600 mt-0.5">Total Paid</p>
            </div>
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-center">
              <p className="text-xl font-black text-rose-700">₹{totalDue.toFixed(0)}</p>
              <p className="text-[10px] font-bold text-rose-600 mt-0.5">Outstanding</p>
            </div>
          </div>
          {invoices.length === 0
            ? <div className="text-center py-8 text-gray-400"><div className="text-3xl mb-2">📄</div><p className="text-xs font-semibold">No invoices yet</p></div>
            : <div className="space-y-1 max-h-64 overflow-y-auto">
                {invoices.slice(0, 20).map((inv, i) => {
                  const status = inv.status || inv.Payment_Status || "Pending";
                  const paid   = status === "Paid";
                  const num    = inv.invoiceNumber || inv.Invoice_Number || "";
                  const fee    = inv.feeType       || inv.Fees_Type     || "";
                  const total  = Number(inv.totalAmount || inv.Total_Amount) || 0;
                  return (
                    <div key={i} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-gray-100">
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full border
                        ${paid ? "bg-yd-success-soft text-yd-success border-yd-success-border"
                        : status === "Overdue" ? "bg-yd-danger-soft text-yd-danger border-yd-danger-border"
                        : status === "Partial" ? "bg-yd-info-soft text-yd-info border-yd-info-border"
                        : "bg-amber-100 text-amber-700 border-amber-200"}`}>{status}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-700 truncate">{num}</p>
                        <p className="text-[10px] text-gray-400">{fee}</p>
                      </div>
                      <span className="text-xs font-black text-gray-900">₹{total.toLocaleString("en-IN")}</span>
                    </div>
                  );
                })}
              </div>
          }
        </>)
      }
    </div>
  );
}

// ── Documents Tab ─────────────────────────────────────────────────
const DOC_TYPES = ["Birth Certificate","Aadhaar Card","Passport Photo","Medical Record","Transfer Certificate","Other"];

function DocumentsTab({ student, toast }) {
  const [docs,    setDocs   ] = useState([]);
  const [docType, setDocType] = useState(DOC_TYPES[0]);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    try { setDocs(JSON.parse(localStorage.getItem(`yd_docs_${student.Student_ID}`) || "[]")); } catch {}
  }, [student.Student_ID]);

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const dataUrl = file.type.startsWith("image/") ? await compressImage(file, 400, 400, 0.8) : "";
      const doc = { id:`doc-${Date.now()}`, type:docType, name:file.name, size:`${(file.size/1024).toFixed(1)} KB`, mimeType:file.type, dataUrl, uploadedAt:new Date().toLocaleDateString("en-IN") };
      const updated = [doc, ...docs];
      setDocs(updated);
      localStorage.setItem(`yd_docs_${student.Student_ID}`, JSON.stringify(updated));
      toast.success(`${docType} uploaded.`);
      if (fileRef.current) fileRef.current.value = "";
    } catch { toast.error("Upload failed."); }
    finally { setLoading(false); }
  }

  function remove(id) {
    const updated = docs.filter(d => d.id !== id);
    setDocs(updated);
    localStorage.setItem(`yd_docs_${student.Student_ID}`, JSON.stringify(updated));
  }

  return (
    <div className="p-4 space-y-3">
      <h3 className="text-sm font-black text-gray-900">Documents</h3>
      <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-3 flex items-center gap-3">
        <select value={docType} onChange={e => setDocType(e.target.value)}
          className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700 focus:outline-none focus:border-yd-yellow">
          {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
        <button type="button" onClick={() => fileRef.current?.click()} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-yd-yellow text-[#1f1f1f] rounded-lg text-[11px] font-bold hover:bg-yd-yellow-dark disabled:opacity-60">
          {loading ? <div className="w-3 h-3 border-2 border-[#1f1f1f]/40 border-t-[#1f1f1f] rounded-full animate-spin"/> : "📎"} Upload
        </button>
        <input ref={fileRef} type="file" accept="image/*,.pdf,.doc,.docx" className="hidden" onChange={handleUpload}/>
      </div>
      {docs.length === 0
        ? <div className="text-center py-8 text-gray-400"><div className="text-3xl mb-2">📁</div><p className="text-xs font-semibold">No documents uploaded</p></div>
        : <div className="space-y-1 max-h-64 overflow-y-auto">
            {docs.map(doc => (
              <div key={doc.id} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-gray-100">
                {doc.dataUrl
                  ? <img src={doc.dataUrl} alt="" className="w-8 h-8 rounded-lg object-cover border border-gray-200 flex-shrink-0"/>
                  : <div className="w-8 h-8 rounded-lg bg-yd-yellow-light flex items-center justify-center text-base flex-shrink-0">📄</div>
                }
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gray-900 truncate">{doc.type}</p>
                  <p className="text-[10px] text-gray-400">{doc.name} · {doc.size} · {doc.uploadedAt}</p>
                </div>
                <button onClick={() => remove(doc.id)} className="text-rose-400 hover:text-rose-600 text-xs px-1.5 py-1 rounded-lg hover:bg-rose-50">✕</button>
              </div>
            ))}
          </div>
      }
    </div>
  );
}

// ── Staff Notes Tab ───────────────────────────────────────────────
function NotesTab({ student, toast }) {
  const [notes,    setNotes   ] = useState([]);
  const [loading,  setLoading ] = useState(true);
  const [newNote,  setNewNote ] = useState("");
  const [saving,   setSaving  ] = useState(false);
  const mountedRef = useRef(true);

  const load = useCallback(() => {
    get(`/api/student-notes/${encodeURIComponent(student.Student_ID)}`)
      .then(d => { if (mountedRef.current) setNotes(d.notes || []); })
      .catch(() => {})
      .finally(() => { if (mountedRef.current) setLoading(false); });
  }, [student.Student_ID]);

  useEffect(() => { mountedRef.current = true; load(); return () => { mountedRef.current = false; }; }, [load]);

  async function addNote() {
    if (!newNote.trim()) return;
    setSaving(true);
    try {
      const r = await post(`/api/student-notes/${student.Student_ID}`, { note: newNote.trim(), createdBy: "Staff" });
      if (r.success) { toast.success("Note saved."); setNewNote(""); load(); }
      else toast.error(r.error || "Failed.");
    } catch { toast.error("Error saving note."); }
    finally { setSaving(false); }
  }

  async function deleteNote(noteId) {
    try {
      const r = await del(`/api/student-notes/${noteId}`);
      if (r.success) { toast.success("Note deleted."); load(); }
      else toast.error(r.error || "Failed.");
    } catch { toast.error("Error deleting."); }
  }

  const suggestions = ["Cries during nap", "Picky eater", "Shy initially", "Hydration reminder", "Needs extra attention", "Allergic reaction risk", "Separation anxiety"];

  return (
    <div className="p-4 space-y-3">
      <h3 className="text-sm font-black text-gray-900">Staff Notes <span className="text-[10px] font-normal text-gray-400 ml-1">private · internal only</span></h3>

      {/* Quick suggestions */}
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map(s => (
          <button key={s} onClick={() => setNewNote(n => n ? `${n}, ${s}` : s)}
            className="px-2 py-0.5 text-[10px] font-semibold bg-gray-100 hover:bg-yd-yellow-light hover:text-[#1f1f1f] text-gray-600 rounded-full transition-colors">
            {s}
          </button>
        ))}
      </div>

      {/* Add note */}
      <div className="flex gap-2">
        <textarea value={newNote} onChange={e => setNewNote(e.target.value)}
          placeholder="Add internal staff note…"
          rows={2}
          className="flex-1 text-xs border border-gray-200 rounded-xl px-3 py-2 text-gray-800 focus:outline-none focus:ring-1 focus:ring-yd-yellow/30 focus:border-yd-yellow resize-none"
          onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) addNote(); }}
        />
        <button onClick={addNote} disabled={saving || !newNote.trim()}
          className="px-3 py-2 bg-yd-yellow text-[#1f1f1f] rounded-xl text-[11px] font-bold hover:bg-yd-yellow-dark disabled:opacity-40 shadow-sm self-end">
          {saving ? <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"/> : "Add"}
        </button>
      </div>

      {/* Notes list */}
      {loading
        ? <div className="space-y-1">{[...Array(3)].map((_,i) => <div key={i} className="h-12 rounded-xl bg-gray-100 animate-pulse"/>)}</div>
        : notes.length === 0
        ? <div className="text-center py-8 text-gray-400"><div className="text-3xl mb-2">📝</div><p className="text-xs font-semibold">No notes yet</p><p className="text-[10px] mt-0.5">Add internal staff observations</p></div>
        : <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {notes.map(n => (
              <div key={n.noteId} className="flex items-start gap-2 bg-yellow-50 rounded-xl px-3 py-2.5 border border-yellow-100">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-800 font-medium leading-snug">{n.note}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{n.createdBy} · {n.createdAt}</p>
                </div>
                <button onClick={() => deleteNote(n.noteId)} className="text-rose-300 hover:text-rose-500 text-xs px-1 py-0.5 rounded hover:bg-rose-50 flex-shrink-0">✕</button>
              </div>
            ))}
          </div>
      }
    </div>
  );
}

// ── Timeline Tab ──────────────────────────────────────────────────
function TimelineTab({ student }) {
  const [events,  setEvents ] = useState([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const sid = student.Student_ID;
    Promise.allSettled([
      get(`/api/attendance?studentId=${encodeURIComponent(sid)}`),
      get(`/api/pickup-history?studentId=${encodeURIComponent(sid)}`),
    ]).then(([att, pickup]) => {
      if (!mountedRef.current) return;
      const attEvents = (att.value?.entries || []).map(e => ({
        icon: e.status === "Present" ? "✅" : e.status === "Absent" ? "❌" : "⏰",
        title: e.status === "Present" ? "Checked In" : e.status === "Absent" ? "Absent" : "Late Arrival",
        sub:   `${e.checkIn ? `In: ${e.checkIn}` : ""}${e.checkOut ? ` · Out: ${e.checkOut}` : ""} ${e.attendanceMethod ? `(${e.attendanceMethod})` : ""}`.trim(),
        date: e.date, ts: e.timestamp,
        color: e.status === "Present" ? "bg-yd-success-soft border-yd-success-border" : e.status === "Absent" ? "bg-yd-danger-soft border-yd-danger-border" : "bg-yd-warn-soft border-yd-warn-border",
        dot:   e.status === "Present" ? "bg-yd-success" : e.status === "Absent" ? "bg-yd-danger" : "bg-yd-warn",
      }));
      const pickupEvents = (pickup.value?.entries || []).map(e => ({
        icon:  e.approvalStatus === "Authorized" ? "🔐" : e.approvalStatus === "Emergency_Authorized" ? "🚨" : "🚫",
        title: `Pickup ${(e.approvalStatus || "").replace("_"," ")}`,
        sub:   `${e.pickupName || "Unknown"} · ${e.relation || ""}`.trim(),
        date:  e.date, ts: e.timestamp,
        color: e.approvalStatus === "Unauthorized" ? "bg-yd-danger-soft border-yd-danger-border" : "bg-yd-info-soft border-yd-info-border",
        dot:   e.approvalStatus === "Unauthorized" ? "bg-yd-danger" : "bg-yd-info",
      }));
      const all = [...attEvents, ...pickupEvents].sort((a,b) => {
        try { return new Date(b.ts||0) - new Date(a.ts||0); } catch { return 0; }
      });
      setEvents(all);
    }).finally(() => { if (mountedRef.current) setLoading(false); });
    return () => { mountedRef.current = false; };
  }, [student.Student_ID]);

  return (
    <div className="p-4 space-y-3">
      <h3 className="text-sm font-black text-gray-900">Activity Timeline</h3>
      {loading
        ? <div className="space-y-2">{[...Array(5)].map((_,i) => <div key={i} className="h-12 rounded-xl bg-gray-100 animate-pulse"/>)}</div>
        : events.length === 0
        ? <div className="text-center py-8 text-gray-400"><div className="text-3xl mb-2">📋</div><p className="text-xs font-semibold">No activity yet</p></div>
        : <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-100"/>
            <div className="space-y-2 max-h-[500px] overflow-y-auto pl-1">
              {events.slice(0, 60).map((e, i) => (
                <div key={i} className="flex gap-3 relative">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0 z-10 border ${e.color}`}>{e.icon}</div>
                  <div className={`flex-1 rounded-xl px-3 py-2 border ${e.color}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-gray-900">{e.title}</p>
                      <p className="text-[9px] text-gray-400 font-mono flex-shrink-0">{e.date}</p>
                    </div>
                    {e.sub && <p className="text-[10px] text-gray-500 mt-0.5">{e.sub}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
      }
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// STUDENT PROFILE PANEL — Right Panel
// ════════════════════════════════════════════════════════════════════
const TABS = [
  { id:"overview",   label:"Overview",  icon:"👤" },
  { id:"parents",    label:"Parents",   icon:"👨‍👩‍👧" },
  { id:"attendance", label:"Attendance",icon:"📅" },
  { id:"food",       label:"Food",      icon:"🍽️" },
  { id:"naps",       label:"Naps",      icon:"😴" },
  { id:"pickup",     label:"Pickup",    icon:"🔐" },
  { id:"medical",    label:"Medical",   icon:"🏥" },
  { id:"billing",    label:"Billing",   icon:"💳" },
  { id:"documents",  label:"Docs",      icon:"📁" },
  { id:"notes",      label:"Notes",     icon:"📝" },
  { id:"timeline",   label:"Timeline",  icon:"📋" },
];

function StudentProfilePanel({ studentId, students, onEdit, onDelete, onRefresh, toast, canEdit = true, canDelete = true, onBack = null }) {
  const navigate   = useNavigate();
  const student    = students.find(s => (s.Student_ID || s.id) === studentId);
  const [activeTab,    setActiveTab   ] = useState("overview");
  const [showCallModal, setShowCallModal] = useState(false);
  const [showQRModal,   setShowQRModal  ] = useState(false);
  const [allergies,     setAllergies   ] = useState("");

  useEffect(() => { setActiveTab("overview"); }, [studentId]);

  // Lazy-load allergy for banner
  useEffect(() => {
    if (!studentId) return;
    get(`/api/student-medical/${encodeURIComponent(studentId)}`)
      .then(d => { setAllergies(d.entry?.allergies || ""); })
      .catch(() => {});
  }, [studentId]);

  if (!student) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-6xl mb-4">👈</div>
          <h3 className="text-lg font-black text-gray-700 mb-1">Select a Student</h3>
          <p className="text-gray-400 text-xs max-w-xs">Choose a student from the directory to view their full profile.</p>
        </div>
      </div>
    );
  }

  const status = student.Status || "Active";

  // Quick action buttons
  const quickActions = [
    { label:"Attendance", icon:"📋", action: () => navigate("/attendance"), color:"bg-amber-100 text-amber-700 hover:bg-amber-200" },
    { label:"Food",       icon:"🍽️", action: () => navigate("/food-consumption"), color:"bg-amber-100 text-amber-700 hover:bg-amber-200" },
    { label:"Nap",        icon:"😴", action: () => navigate("/nap-tracker"), color:"bg-purple-100 text-purple-700 hover:bg-purple-200" },
    { label:"QR Code",    icon:"📱", action: () => setShowQRModal(true), color:"bg-purple-100 text-purple-700 hover:bg-purple-200" },
    { label:"Call",       icon:"📞", action: () => setShowCallModal(true), color:"bg-yd-danger-soft text-yd-danger hover:bg-yd-danger-border" },
    { label:"Parent App", icon:"👨‍👩‍👧", action: () => setActiveTab("parents"), color:"bg-yd-success-soft text-yd-success hover:bg-yd-success-border" },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-w-0">
      {/* Modals */}
      {showCallModal && <EmergencyCallModal student={student} onClose={() => setShowCallModal(false)}/>}
      {showQRModal   && <QRModal            student={student} onClose={() => setShowQRModal(false)}/>}

      {/* ── Sticky header ── */}
      <div className="bg-white border-b border-gray-100 shadow-sm flex-shrink-0">

        {/* Mobile back bar */}
        {onBack && (
          <div className="flex items-center gap-2 px-3 pt-3 pb-1">
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-[12px] font-bold text-gray-500 hover:text-gray-800
                         px-2.5 py-1.5 rounded-xl hover:bg-gray-100 transition-colors active:scale-95"
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              Students
            </button>
          </div>
        )}

        {/* Profile strip */}
        <div className="flex items-center gap-3 px-4 py-3">
          {student.Profile_Image ? (
            <img src={student.Profile_Image} alt="" className="w-12 h-12 rounded-xl object-cover border-2 border-gray-100 shadow flex-shrink-0"/>
          ) : (
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-200 to-yellow-400 flex items-center justify-center text-lg font-black text-yd-navy/60 flex-shrink-0 shadow">
              {initials(student.Student_Name)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-black text-gray-900 leading-tight truncate">{student.Student_Name}</h2>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border flex-shrink-0
                ${status === "Active" ? "bg-yd-success-soft text-yd-success border-yd-success-border" : "bg-gray-100 text-gray-600 border-gray-200"}`}>
                <div className={`w-1 h-1 rounded-full ${status === "Active" ? "bg-yd-success" : "bg-gray-400"}`}/>
                {status}
              </span>
            </div>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {student.Class} <span className="mx-1">·</span>
              <span className="font-mono">{student.Student_ID}</span>
              {student.Center && <><span className="mx-1">·</span>{student.Center}</>}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {canEdit && (
              <button onClick={onEdit}
                className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-[#1f1f1f] bg-yd-yellow-pale hover:bg-yd-yellow-light rounded-lg border border-yd-border">
                ✏️ Edit
              </button>
            )}
            {canDelete && (
              <button onClick={onDelete}
                className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-100">
                🗑️
              </button>
            )}
          </div>
        </div>

        {/* Quick action row */}
        <div className="flex items-center gap-1.5 px-4 pb-2.5 overflow-x-auto scrollbar-none">
          {quickActions.map(a => (
            <button key={a.label} onClick={a.action}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap flex-shrink-0 transition-colors ${a.color}`}>
              <span className="text-sm">{a.icon}</span> {a.label}
            </button>
          ))}
        </div>

        {/* Allergy banner */}
        {allergies && (
          <div className="mx-4 mb-2.5 flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-lg px-3 py-1.5">
            <span className="text-sm">⚠️</span>
            <span className="text-[11px] font-bold text-rose-700">Allergy: {allergies}</span>
          </div>
        )}

        {/* Tab bar */}
        <div className="flex overflow-x-auto border-t border-gray-100 scrollbar-none">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1 px-3 py-2 text-[11px] font-bold whitespace-nowrap border-b-2 transition-colors flex-shrink-0
                ${activeTab === tab.id ? "border-yd-yellow text-[#7a5c00] bg-yd-yellow-light/60" : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}>
              <span className="text-xs">{tab.icon}</span> {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content — scrollable ── */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-gray-50">
        {activeTab === "overview"   && <OverviewTab    student={student} onEdit={onEdit} canEdit={canEdit}/>}
        {activeTab === "parents"    && <ParentsTab     student={student} onSaved={onRefresh} toast={toast}/>}
        {activeTab === "attendance" && <AttendanceTab  student={student}/>}
        {activeTab === "food"       && <FoodTab        student={student}/>}
        {activeTab === "naps"       && <NapTab         student={student}/>}
        {activeTab === "pickup"     && <PickupAuthTab  student={student} toast={toast}/>}
        {activeTab === "medical"    && <MedicalTab     student={student} toast={toast}/>}
        {activeTab === "billing"    && <BillingTab     student={student}/>}
        {activeTab === "documents"  && <DocumentsTab   student={student} toast={toast}/>}
        {activeTab === "notes"      && <NotesTab       student={student} toast={toast}/>}
        {activeTab === "timeline"   && <TimelineTab    student={student}/>}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════
export default function Students() {
  const toast      = useToast();
  const navigate   = useNavigate();
  const location   = useLocation();
  const mountedRef = useRef(true);
  const { canDo }  = useAuth();
  const isMobile   = useIsMobile(768);

  // Action-level permission flags
  const perm = {
    create: canDo("students", "create"),
    edit:   canDo("students", "edit"),
    delete: canDo("students", "delete"),
    export: canDo("students", "export"),
  };

  const [students,         setStudents        ] = useState([]);
  const [loading,          setLoading         ] = useState(true);
  const [selectedId,       setSelectedId      ] = useState(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  const [editStudent,   setEditStudent  ] = useState(null);
  const [deleteStudent, setDeleteStudent] = useState(null);
  const [saving,        setSaving       ] = useState(false);
  const [deleting,      setDeleting     ] = useState(false);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  // Show success toast when returning from /students/new
  useEffect(() => {
    if (location.state?.admissionSuccess) {
      toast.success(`${location.state.admissionSuccess} admitted successfully!`);
      // Clear the state so toast doesn't refire on re-render
      window.history.replaceState({}, "", location.pathname);
    }
  }, []); // eslint-disable-line

  const loadStudents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await get("/students");
      if (!mountedRef.current) return;
      const list = Array.isArray(data) ? data : [];
      setStudents(list);
      // Only auto-select on desktop — mobile starts at the list view
      if (!selectedId && list.length > 0 && window.innerWidth >= 768) {
        setSelectedId(list[0].Student_ID);
      }
    } catch { toast.error("Failed to load students."); }
    finally { if (mountedRef.current) setLoading(false); }
  }, [selectedId]); // eslint-disable-line

  useEffect(() => { loadStudents(); }, []); // eslint-disable-line

  const activeCount = students.filter(s => (s.Status || "Active") === "Active").length;
  const classCount  = new Set(students.map(s => s.Class).filter(Boolean)).size;

  const handleAdd = async (formData) => {
    setSaving(true);
    try {
      const res = await post("/add-student", formData);
      if (res.success) { toast.success(`Added! ID: ${res.student_id}`); setAddModalOpen(false); await loadStudents(); setSelectedId(res.student_id); }
      else toast.error(res.message || "Failed to add.");
    } catch (e) { toast.error(e.message || "Error."); }
    finally { if (mountedRef.current) setSaving(false); }
  };

  const handleEdit = async (formData) => {
    if (!editStudent) return;
    setSaving(true);
    try {
      const res = await put(`/update-student/${editStudent.Student_ID}`, formData);
      if (res.success) { toast.success("Updated!"); setEditStudent(null); await loadStudents(); }
      else toast.error(res.message || "Failed.");
    } catch (e) { toast.error(e.message || "Error."); }
    finally { if (mountedRef.current) setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteStudent) return;
    setDeleting(true);
    try {
      const res = await del(`/delete-student/${deleteStudent.Student_ID}`);
      if (res.success) { toast.success(`${deleteStudent.Student_Name} removed.`); setDeleteStudent(null); if (selectedId === deleteStudent.Student_ID) setSelectedId(null); await loadStudents(); }
      else toast.error(res.message || "Failed.");
    } catch (e) { toast.error(e.message || "Error."); }
    finally { if (mountedRef.current) setDeleting(false); }
  };

  const selectedStudentObj = students.find(s => (s.Student_ID || s.id) === selectedId);

  // Open drawer when a student is selected on mobile
  function handleMobileSelect(sid) {
    setSelectedId(sid);
    if (isMobile) setMobileDetailOpen(true);
  }

  function closeMobileDetail() {
    setMobileDetailOpen(false);
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Toasts toasts={toast.toasts} dismiss={toast.dismiss}/>

      {/* Global Sidebar */}
      <Sidebar/>

      {/* Modals */}
      {editStudent  && <StudentModal student={editStudent} onSave={handleEdit} onClose={() => setEditStudent(null)} saving={saving}/>}

      {/* Delete confirm */}
      {deleteStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <div className="text-center mb-5">
              <div className="w-14 h-14 rounded-full bg-rose-100 flex items-center justify-center text-2xl mx-auto mb-3">🗑️</div>
              <h3 className="yd-title-card text-lg">Remove Student?</h3>
              <p className="text-sm text-gray-500 mt-1">{deleteStudent.Student_Name}</p>
              <p className="text-xs text-gray-400 mt-0.5">{deleteStudent.Student_ID}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDeleteStudent(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="btn btn-danger flex-1">
                {deleting ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"/> Removing…</> : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Stats strip */}
        <div className="bg-white border-b border-gray-100 px-4 py-2.5 flex items-center gap-4 flex-shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Total</span>
              <span className="text-sm font-black text-gray-900">{students.length}</span>
            </div>
            <div className="w-px h-4 bg-gray-200"/>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Active</span>
              <span className="text-sm font-black text-emerald-600">{activeCount}</span>
            </div>
            <div className="w-px h-4 bg-gray-200"/>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Classes</span>
              <span className="text-sm font-black text-gray-900">{classCount}</span>
            </div>
          </div>
          <button onClick={loadStudents}
            className="ml-auto text-[11px] font-bold text-gray-500 hover:text-gray-700
                       flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-gray-100">
            🔄 Refresh
          </button>
        </div>

        {/* ── Layout: desktop = two-panel, mobile = list only ── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Student Directory */}
          <StudentDirectory
            students={students}
            loading={loading}
            selectedId={selectedId}
            onSelect={handleMobileSelect}
            onAdd={() => navigate("/students/new")}
            canAdd={perm.create}
            isMobile={isMobile}
          />

          {/* Desktop detail panel (hidden on mobile via CSS) */}
          <div className="stu-desktop-panel">
            <StudentProfilePanel
              studentId={selectedId}
              students={students}
              onEdit={() => setEditStudent(selectedStudentObj)}
              onDelete={() => setDeleteStudent(selectedStudentObj)}
              onRefresh={loadStudents}
              toast={toast}
              canEdit={perm.edit}
              canDelete={perm.delete}
            />
          </div>
        </div>
      </div>

      {/* ── Mobile slide-over drawer ── */}
      <div className={`stu-drawer ${mobileDetailOpen ? "stu-drawer--open" : ""}`}>
        {/* Scrim */}
        <div
          className="stu-drawer-scrim"
          onClick={closeMobileDetail}
          aria-hidden="true"
        />
        {/* Panel */}
        <div className="stu-drawer-panel">
          <StudentProfilePanel
            studentId={selectedId}
            students={students}
            onEdit={() => { setEditStudent(selectedStudentObj); }}
            onDelete={() => { setDeleteStudent(selectedStudentObj); }}
            onRefresh={loadStudents}
            toast={toast}
            canEdit={perm.edit}
            canDelete={perm.delete}
            onBack={closeMobileDetail}
          />
        </div>
      </div>
    </div>
  );
}

