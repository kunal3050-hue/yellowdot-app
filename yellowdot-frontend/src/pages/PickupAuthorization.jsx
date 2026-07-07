/**
 * PickupAuthorization.jsx — Authorized Pickup Persons Management
 * ─────────────────────────────────────────────────────────────────
 *
 * Layout: sidebar (student list) + main content (pickup persons)
 * Features: add, edit, delete authorized pickup persons per student
 * Photo: file upload → compressed 150×150 JPEG base64 (≤15KB)
 * ─────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import pickupAuthorizationService from "../services/pickupAuthorizationService";
import { api } from "../services/authService";
import { useAuth } from "../contexts/AuthContext";
import { PLATFORM_NAME } from "../config/environment";

const RELATIONS = ["Father","Mother","Grandmother","Grandfather","Uncle","Aunt","Driver","Guardian","Other"];

// ── Image compression ─────────────────────────────────────────────
// Compress uploaded photo to 150×150 JPEG at 0.7 quality (≤15KB)
function compressPhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const W = 150, H = 150;
        const canvas = document.createElement("canvas");
        canvas.width  = W;
        canvas.height = H;
        const ctx = canvas.getContext("2d");
        // Cover crop (center)
        const scale = Math.max(W / img.width, H / img.height);
        const sw    = W / scale;
        const sh    = H / scale;
        const sx    = (img.width  - sw) / 2;
        const sy    = (img.height - sh) / 2;
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
        resolve(canvas.toDataURL("image/jpeg", 0.70));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Avatar initials ───────────────────────────────────────────────
function initials(name) {
  return (name || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

// ── useToast ──────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((type, msg) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, type, msg }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4_500);
  }, []);
  return {
    toasts,
    success: useCallback(m => add("success", m), [add]),
    error:   useCallback(m => add("error",   m), [add]),
    info:    useCallback(m => add("info",    m), [add]),
    dismiss: useCallback(id => setToasts(t => t.filter(x => x.id !== id)), []),
  };
}

function ToastStack({ toasts, onDismiss }) {
  const bg   = { success:"bg-emerald-600", error:"bg-rose-600", info:"bg-sky-700" };
  const icon = { success:"✅", error:"❌", info:"ℹ️" };
  return (
    <div className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2 w-80 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl text-sm font-semibold
                      text-white pointer-events-auto ${bg[t.type]}`}>
          <span>{icon[t.type]}</span>
          <span className="flex-1 leading-snug">{t.msg}</span>
          <button onClick={() => onDismiss(t.id)}
            className="w-5 h-5 flex items-center justify-center rounded-full bg-white/20 font-bold shrink-0">×</button>
        </div>
      ))}
    </div>
  );
}

// ── Add / Edit Modal ──────────────────────────────────────────────
function PersonModal({ student, person, onSave, onClose, saving }) {
  const isEdit = !!person?.entryId;
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    pickupName: person?.pickupName || "",
    relation:   person?.relation   || "Father",
    mobile:     person?.mobile     || "",
    photoUrl:   person?.photoUrl   || "",
    emergency:  person?.emergency  || false,
    status:     person?.status     || "Active",
  });
  const [photoPreview,  setPhotoPreview ] = useState(person?.photoUrl || "");
  const [photoLoading,  setPhotoLoading ] = useState(false);
  const [errors,        setErrors       ] = useState({});

  function set(field, val) {
    setForm(f => ({ ...f, [field]: val }));
    setErrors(e => ({ ...e, [field]: "" }));
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrors(er => ({ ...er, photo:"Please select an image file." }));
      return;
    }
    setPhotoLoading(true);
    try {
      const compressed = await compressPhoto(file);
      setPhotoPreview(compressed);
      setForm(f => ({ ...f, photoUrl: compressed }));
      setErrors(er => ({ ...er, photo:"" }));
    } catch {
      setErrors(er => ({ ...er, photo:"Failed to process image." }));
    } finally {
      setPhotoLoading(false);
    }
  }

  function validate() {
    const e = {};
    if (!form.pickupName.trim()) e.pickupName = "Name is required.";
    if (!form.relation)          e.relation   = "Relation is required.";
    if (form.mobile && !/^\d{10}$/.test(form.mobile.replace(/\s/g,"")))
      e.mobile = "Enter a valid 10-digit mobile number.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    onSave({ ...form, pickupName: form.pickupName.trim() });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-black text-gray-900">
              {isEdit ? "Edit Pickup Person" : "Add Pickup Person"}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              For <span className="font-semibold text-yd-navy">{student?.name}</span>
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors font-bold">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Photo upload */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              {photoPreview ? (
                <img src={photoPreview} alt="Photo"
                  className="w-24 h-24 rounded-2xl object-cover border-4 border-yd-navy/20 shadow-lg"/>
              ) : (
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100
                                flex items-center justify-center border-4 border-yd-navy/10 shadow-inner">
                  <span className="text-3xl font-black text-yd-navy/40">
                    {initials(form.pickupName || "?")}
                  </span>
                </div>
              )}
              {photoLoading && (
                <div className="absolute inset-0 rounded-2xl bg-white/80 flex items-center justify-center">
                  <div className="w-6 h-6 border-3 border-yd-navy border-t-transparent rounded-full animate-spin"/>
                </div>
              )}
            </div>
            <button type="button" onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-yd-navy
                         bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors border border-blue-200">
              📷 {photoPreview ? "Change Photo" : "Upload Photo"}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" capture="user"
              className="hidden" onChange={handleFileChange}/>
            {errors.photo && <p className="text-xs text-rose-500 font-medium">{errors.photo}</p>}
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
              Full Name *
            </label>
            <input value={form.pickupName} onChange={e => set("pickupName", e.target.value)}
              placeholder="e.g. Rajesh Sharma"
              className={`w-full border rounded-xl px-4 py-2.5 text-sm font-medium text-gray-800
                         focus:outline-none focus:ring-2 focus:ring-yd-navy/30 focus:border-yd-navy
                         ${errors.pickupName ? "border-rose-400 bg-rose-50" : "border-gray-200"}`}/>
            {errors.pickupName && <p className="text-xs text-rose-500 mt-1">{errors.pickupName}</p>}
          </div>

          {/* Relation */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
              Relation *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {RELATIONS.map(r => (
                <button key={r} type="button" onClick={() => set("relation", r)}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all
                    ${form.relation === r
                      ? "bg-yd-navy text-white border-yd-navy shadow-md"
                      : "bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-400"}`}>
                  {r}
                </button>
              ))}
            </div>
            {errors.relation && <p className="text-xs text-rose-500 mt-1">{errors.relation}</p>}
          </div>

          {/* Mobile */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
              Mobile Number
            </label>
            <input value={form.mobile} onChange={e => set("mobile", e.target.value.replace(/\D/g,"").slice(0,10))}
              placeholder="10-digit mobile number"
              className={`w-full border rounded-xl px-4 py-2.5 text-sm font-medium text-gray-800
                         focus:outline-none focus:ring-2 focus:ring-yd-navy/30 focus:border-yd-navy
                         ${errors.mobile ? "border-rose-400 bg-rose-50" : "border-gray-200"}`}/>
            {errors.mobile && <p className="text-xs text-rose-500 mt-1">{errors.mobile}</p>}
          </div>

          {/* Toggles */}
          <div className="grid grid-cols-2 gap-3">
            {/* Emergency toggle */}
            <button type="button" onClick={() => set("emergency", !form.emergency)}
              className={`flex items-center gap-2 px-3 py-3 rounded-xl border-2 text-sm font-bold transition-all
                ${form.emergency
                  ? "bg-amber-50 border-amber-400 text-amber-700"
                  : "bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300"}`}>
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center
                ${form.emergency ? "bg-amber-400 border-amber-400" : "border-gray-300"}`}>
                {form.emergency && <span className="text-white text-[10px] font-black">✓</span>}
              </div>
              🚨 Emergency
            </button>

            {/* Status toggle */}
            <button type="button" onClick={() => set("status", form.status === "Active" ? "Inactive" : "Active")}
              className={`flex items-center gap-2 px-3 py-3 rounded-xl border-2 text-sm font-bold transition-all
                ${form.status === "Active"
                  ? "bg-emerald-50 border-emerald-400 text-emerald-700"
                  : "bg-gray-50 border-gray-200 text-gray-500"}`}>
              <div className={`w-4 h-4 rounded-full border-2
                ${form.status === "Active" ? "bg-emerald-400 border-emerald-400" : "border-gray-300"}`}/>
              {form.status === "Active" ? "✅ Active" : "⭕ Inactive"}
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-3 rounded-xl bg-yd-navy text-white font-black text-sm
                         hover:bg-blue-900 transition-colors disabled:opacity-60 disabled:cursor-not-allowed
                         shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2">
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"/>
                  Saving…
                </>
              ) : (
                isEdit ? "Update Person" : "Add Person"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Delete Confirm Modal ──────────────────────────────────────────
function DeleteConfirmModal({ person, onConfirm, onClose, deleting }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center">
        <div className="text-5xl mb-4">🗑️</div>
        <h2 className="text-xl font-black text-gray-900 mb-2">Remove Pickup Person?</h2>
        <p className="text-gray-500 text-sm mb-6 leading-relaxed">
          This will remove <span className="font-bold text-gray-800">{person?.pickupName}</span> from the
          authorized pickup list. This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={deleting}
            className="flex-1 py-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-black text-sm
                       transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            {deleting ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"/> : null}
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Pickup Person Card ────────────────────────────────────────────
function PersonCard({ person, onEdit, onDelete }) {
  const statusColor = person.status === "Active"
    ? "bg-emerald-100 text-emerald-700 border-emerald-200"
    : "bg-gray-100 text-gray-500 border-gray-200";

  const isProtected = person.isProtected;
  const isParent    = person.isParent;

  return (
    <div className={`relative bg-white rounded-2xl border-2 shadow-sm hover:shadow-md transition-all p-5
      ${isProtected ? "border-yellow-200" : person.status === "Active" ? "border-gray-100" : "border-gray-200 opacity-70"}
      ${person.emergency ? "ring-2 ring-amber-300 ring-offset-1" : ""}`}>

      {/* Emergency badge */}
      {person.emergency && (
        <div className="absolute -top-2.5 left-4 px-2.5 py-0.5 bg-amber-400 text-amber-900 text-[10px] font-black rounded-full shadow-sm">
          🚨 EMERGENCY
        </div>
      )}

      {/* Protected badge */}
      {isProtected && (
        <div className="absolute -top-2.5 right-4 px-2.5 py-0.5 bg-yellow-400 text-yellow-900 text-[10px] font-black rounded-full shadow-sm">
          🛡️ Protected
        </div>
      )}

      <div className="flex items-start gap-4">
        {/* Photo */}
        <div className="flex-shrink-0">
          {person.photoUrl ? (
            <img src={person.photoUrl} alt={person.pickupName}
              className={`w-16 h-16 rounded-2xl object-cover border-2 shadow-sm ${
                isProtected ? "border-yellow-200" : "border-gray-100"
              }`}/>
          ) : (
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border-2
                            ${isProtected
                              ? "bg-gradient-to-br from-yellow-100 to-amber-200 border-yellow-200"
                              : "bg-gradient-to-br from-blue-100 to-indigo-200 border-gray-100"}`}>
              <span className={`text-xl font-black ${isProtected ? "text-yellow-700" : "text-yd-navy/50"}`}>
                {initials(person.pickupName)}
              </span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-black text-gray-900 text-base leading-tight truncate">{person.pickupName}</h3>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <p className="text-sm text-gray-500 font-medium">{person.relation}</p>
                {isParent && (
                  <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full border border-blue-100">
                    Parent
                  </span>
                )}
              </div>
              {person.mobile && (
                <p className="text-xs text-gray-400 mt-1 font-mono">📞 {person.mobile}</p>
              )}
              {isParent && (
                <div className="flex gap-1 mt-1.5 flex-wrap">
                  <span className="text-[10px] font-bold bg-green-50 text-green-600 px-1.5 py-0.5 rounded-full">✓ Default</span>
                  <span className="text-[10px] font-bold bg-green-50 text-green-600 px-1.5 py-0.5 rounded-full">✓ Verified</span>
                </div>
              )}
            </div>
            {/* Status chip */}
            <span className={`flex-shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full border ${statusColor}`}>
              {person.status}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      {(onEdit || onDelete) && (
        <div className="flex gap-2 mt-4">
          {onEdit && (
            <button onClick={() => onEdit(person)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold
                         text-yd-navy bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors border border-blue-100">
              ✏️ Edit
            </button>
          )}
          {/* Delete blocked for protected (Father/Mother) records */}
          {onDelete && !isProtected && (
            <button onClick={() => onDelete(person)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold
                         text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors border border-rose-100">
              🗑️ Remove
            </button>
          )}
          {onDelete && isProtected && (
            <div className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold
                            text-gray-400 bg-gray-50 rounded-xl border border-gray-100 cursor-not-allowed"
                 title="Father and Mother are protected records. Disable them instead of deleting.">
              🔒 Cannot Delete
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Main — PickupAuthorization Page
// ═══════════════════════════════════════════════════════════════════
export default function PickupAuthorization() {
  const toast     = useToast();
  const { canDo } = useAuth();
  const perm = {
    create:  canDo("pickup_auth", "create"),
    edit:    canDo("pickup_auth", "edit"),
    approve: canDo("pickup_auth", "approve"),
  };
  const mountedRef = useRef(true);

  // Students
  const [students,        setStudents       ] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [studentSearch,   setStudentSearch  ] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);

  // Pickup persons
  const [persons,        setPersons       ] = useState([]);
  const [personsLoading, setPersonsLoading] = useState(false);

  // Modal state
  const [modalOpen,   setModalOpen  ] = useState(false);
  const [editPerson,  setEditPerson ] = useState(null);
  const [deletePerson,setDeletePerson]= useState(null);
  const [saving,      setSaving     ] = useState(false);
  const [deleting,    setDeleting   ] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ── Load students ───────────────────────────────────────────────
  useEffect(() => {
    setStudentsLoading(true);
    api.get("/students")
      .then(r => r.data)
      .then(data => {
        if (!mountedRef.current) return;
        const list = (Array.isArray(data) ? data : []).filter(
          s => (s.Status || s.status || "Active") === "Active"
        );
        setStudents(list);
        if (list.length > 0 && !selectedStudent) {
          const first = list[0];
          setSelectedStudent({
            id:   first.Student_ID || first.id,
            name: first.Student_Name || first.name,
            cls:  first.Class || first.class,
          });
        }
      })
      .catch(() => toast.error("Failed to load students."))
      .finally(() => { if (mountedRef.current) setStudentsLoading(false); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load pickup persons for selected student ────────────────────
  const loadPersons = useCallback(async (studentId) => {
    if (!studentId) { setPersons([]); return; }
    setPersonsLoading(true);
    try {
      const result = await pickupAuthorizationService.getPersons({ studentId });
      if (mountedRef.current) setPersons(result.entries || []);
    } catch (e) {
      if (mountedRef.current) toast.error("Failed to load pickup persons.");
    } finally {
      if (mountedRef.current) setPersonsLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadPersons(selectedStudent?.id);
  }, [selectedStudent, loadPersons]);

  // ── Filtered student list ───────────────────────────────────────
  const filteredStudents = students.filter(s => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return true;
    const name = (s.Student_Name || s.name || "").toLowerCase();
    const id   = (s.Student_ID   || s.id   || "").toLowerCase();
    const cls  = (s.Class        || s.class|| "").toLowerCase();
    return name.includes(q) || id.includes(q) || cls.includes(q);
  });

  // ── Save (add/edit) ─────────────────────────────────────────────
  const handleSave = async (formData) => {
    if (!selectedStudent) return;
    setSaving(true);
    try {
      if (editPerson?.entryId) {
        // Update
        await pickupAuthorizationService.updatePerson(editPerson.entryId, formData);
        toast.success(`${formData.pickupName} updated successfully.`);
      } else {
        // Create
        await pickupAuthorizationService.addPerson({
          studentId:   selectedStudent.id,
          studentName: selectedStudent.name,
          ...formData,
        });
        toast.success(`${formData.pickupName} added as authorized pickup person.`);
      }
      setModalOpen(false);
      setEditPerson(null);
      await loadPersons(selectedStudent.id);
    } catch (e) {
      toast.error(e.message || "Failed to save.");
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deletePerson) return;
    // Guard: protected records cannot be deleted
    if (deletePerson.isProtected) {
      toast.error("Father and Mother are protected records. Disable them instead of deleting.");
      setDeletePerson(null);
      return;
    }
    setDeleting(true);
    try {
      await pickupAuthorizationService.deletePerson(deletePerson.entryId);
      toast.success(`${deletePerson.pickupName} removed.`);
      setDeletePerson(null);
      await loadPersons(selectedStudent?.id);
    } catch (e) {
      const code = e?.response?.data?.code || e?.code;
      if (code === "PROTECTED_RECORD") {
        toast.error("Father and Mother are protected records and cannot be deleted. Disable them instead.");
      } else {
        toast.error(e.message || "Failed to remove.");
      }
    } finally {
      if (mountedRef.current) setDeleting(false);
    }
  };

  // ── Stats ───────────────────────────────────────────────────────
  const activeCount     = persons.filter(p => p.status === "Active").length;
  const emergencyCount  = persons.filter(p => p.emergency).length;
  const inactiveCount   = persons.filter(p => p.status === "Inactive").length;

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <ToastStack toasts={toast.toasts} onDismiss={toast.dismiss}/>

      {/* Modals */}
      {modalOpen && (
        <PersonModal
          student={selectedStudent}
          person={editPerson}
          onSave={handleSave}
          onClose={() => { setModalOpen(false); setEditPerson(null); }}
          saving={saving}
        />
      )}
      {deletePerson && (
        <DeleteConfirmModal
          person={deletePerson}
          onConfirm={handleDelete}
          onClose={() => setDeletePerson(null)}
          deleting={deleting}
        />
      )}

      {/* -- Sidebar ------------------------------------------------- */}
      <div className="w-[240px] flex-shrink-0 bg-white border-r border-gray-100 flex flex-col h-screen">

        {/* Brand */}
        <div className="px-5 py-6 border-b border-gray-100 flex-shrink-0">
          <Link to="/">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-yellow-400 flex items-center justify-center">
                <span className="text-white font-black text-sm">{PLATFORM_NAME.charAt(0)}</span>
              </div>
              <div>
                <div className="text-sm font-black text-gray-900 leading-none">{PLATFORM_NAME}</div>
                <div className="text-[10px] text-gray-400 font-medium mt-0.5">Child Safety</div>
              </div>
            </div>
          </Link>
        </div>

        {/* Nav links */}
        <div className="p-3 border-b border-gray-100 flex-shrink-0 space-y-0.5">
          {[
            { to: "/pickup-authorization", label: "Authorized Persons", active: true,
              icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 1L2 4v4c0 3.3 2.6 6.4 6 7 3.4-.6 6-3.7 6-7V4L8 1z"/></svg> },
            { to: "/pickup-history", label: "Pickup History",
              icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 8a7 7 0 107 7"/><path d="M1 4v4h4"/><path d="M8 5v3.5l2.5 1.5"/></svg> },
            { to: "/attendance", label: "Attendance",
              icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1.5" y="2.5" width="13" height="12" rx="2"/><path d="M5 1v3M11 1v3M1.5 7h13"/><path d="M5 10l2 2 4-3"/></svg> },
          ].map(l => (
            <Link key={l.to} to={l.to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                l.active ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
              }`}>
              <span className={l.active ? "opacity-80" : "opacity-40"}>{l.icon}</span>
              {l.label}
            </Link>
          ))}
        </div>

        {/* Student search */}
        <div className="p-3 border-b border-gray-100 flex-shrink-0">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 mb-2">Students</p>
          <input
            value={studentSearch}
            onChange={e => setStudentSearch(e.target.value)}
            placeholder="🔍 Search students…"
            className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 text-gray-700
                       focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-yd-navy"/>
        </div>

        {/* Student list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {studentsLoading ? (
            [...Array(5)].map((_, i) => (
              <div key={i} className="h-12 rounded-xl bg-gray-100 animate-pulse mx-1 mb-1"/>
            ))
          ) : filteredStudents.length === 0 ? (
            <p className="text-center text-gray-400 text-xs py-8">No students found.</p>
          ) : filteredStudents.map(s => {
            const sid  = s.Student_ID || s.id;
            const name = s.Student_Name || s.name;
            const cls  = s.Class || s.class;
            const sel  = selectedStudent?.id === sid;
            return (
              <button key={sid}
                onClick={() => setSelectedStudent({ id: sid, name, cls })}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all
                  ${sel ? "bg-yd-navy text-white shadow-md" : "text-gray-700 hover:bg-gray-50"}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0
                  ${sel ? "bg-white/20 text-white" : "bg-blue-100 text-yd-navy"}`}>
                  {initials(name)}
                </div>
                <div className="min-w-0">
                  <p className={`text-xs font-bold truncate ${sel ? "text-white" : "text-gray-800"}`}>{name}</p>
                  <p className={`text-[10px] ${sel ? "text-blue-200" : "text-gray-400"}`}>{cls} · {sid}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-8 py-5 flex items-center justify-between flex-shrink-0 shadow-sm">
          <div>
            {selectedStudent ? (
              <>
                <h2 className="text-2xl font-black text-gray-900">
                  {selectedStudent.name}
                </h2>
                <p className="text-gray-500 text-sm mt-0.5">
                  {selectedStudent.cls} · ID: {selectedStudent.id} · Authorized Pickup Persons
                </p>
              </>
            ) : (
              <h2 className="text-2xl font-black text-gray-900">Pickup Authorization</h2>
            )}
          </div>
          {selectedStudent && perm.create && (
            <button
              onClick={() => { setEditPerson(null); setModalOpen(true); }}
              className="flex items-center gap-2 px-5 py-2.5 bg-yd-navy text-white font-bold text-sm
                         rounded-xl hover:bg-blue-900 transition-colors shadow-lg shadow-blue-900/20 active:scale-95">
              + Add Person
            </button>
          )}
        </div>

        {/* Stats bar */}
        {selectedStudent && !personsLoading && (
          <div className="bg-white border-b border-gray-100 px-8 py-3 flex items-center gap-6 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"/>
              <span className="text-sm font-semibold text-gray-600">
                <span className="text-emerald-600 font-black">{activeCount}</span> Active
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400"/>
              <span className="text-sm font-semibold text-gray-600">
                <span className="text-amber-600 font-black">{emergencyCount}</span> Emergency
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-gray-300"/>
              <span className="text-sm font-semibold text-gray-600">
                <span className="text-gray-500 font-black">{inactiveCount}</span> Inactive
              </span>
            </div>
            {persons.length === 0 && (
              <div className="ml-auto flex items-center gap-1.5 text-amber-600 text-sm font-semibold">
                ⚠️ No authorized persons — add one for safe pickup verification
              </div>
            )}
          </div>
        )}

        {/* Persons grid */}
        <div className="flex-1 overflow-y-auto p-8">
          {!selectedStudent ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-6xl mb-4">👈</div>
              <h3 className="text-xl font-black text-gray-700 mb-2">Select a Student</h3>
              <p className="text-gray-400 text-sm max-w-xs leading-relaxed">
                Choose a student from the sidebar to manage their authorized pickup persons.
              </p>
            </div>
          ) : personsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-48 rounded-2xl bg-white border border-gray-100 animate-pulse shadow-sm"/>
              ))}
            </div>
          ) : persons.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-20">
              <div className="w-24 h-24 rounded-3xl bg-blue-50 flex items-center justify-center mb-5 text-4xl">🔐</div>
              <h3 className="text-xl font-black text-gray-700 mb-2">No Authorized Persons</h3>
              <p className="text-gray-400 text-sm max-w-sm leading-relaxed mb-6">
                No pickup persons are authorized for <strong>{selectedStudent.name}</strong> yet.
                Add trusted adults who are allowed to pick up this student.
              </p>
              <button
                onClick={() => { setEditPerson(null); setModalOpen(true); }}
                className="flex items-center gap-2 px-6 py-3 bg-yd-navy text-white font-bold text-sm
                           rounded-xl hover:bg-blue-900 transition-colors shadow-lg shadow-blue-900/20">
                + Add First Pickup Person
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {persons.map(person => (
                <PersonCard
                  key={person.entryId}
                  person={person}
                  onEdit={perm.edit ? p => { setEditPerson(p); setModalOpen(true); } : null}
                  onDelete={perm.approve ? p => setDeletePerson(p) : null}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

