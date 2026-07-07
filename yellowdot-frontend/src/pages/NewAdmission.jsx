/**
 * NewAdmission.jsx — Full-page multi-step student admission workflow
 * ──────────────────────────────────────────────────────────────────
 * Route: /students/new
 *
 * Steps:
 *   1  Student Info        (required)
 *   2  Parent Details      (required)
 *   3  Medical Info        (optional)
 *   4  Pickup Auth         (optional)
 *   5  Fees                (optional)
 *   6  Documents           (optional)
 *
 * Features:
 *   • Sticky header   — Save Draft + Submit Admission
 *   • Left progress sidebar — step status + completion %
 *   • Draft autosave  — localStorage, debounced 1.5 s
 *   • Draft restore   — banner prompt on return visit
 *   • Photo upload    — canvas-compressed base64
 *   • Full Firestore  — /add-student → medical → pickup-authorization
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { PLATFORM_NAME } from "../config/environment";
import { api } from "../services/authService";
import familyService from "../services/familyService";

// ── Constants ─────────────────────────────────────────────────────
const CLASSES  = ["Daycare","Playgroup","Nursery","LKG","UKG","Class 1","Class 2","Class 3","Class 4","Class 5"];
const GENDERS  = ["Male","Female","Other"];
const CENTERS  = ["Seawoods","Vashi","Kharghar","Belapur"];
const BLOOD_GROUPS = ["A+","A−","B+","B−","AB+","AB−","O+","O−","Unknown"];
const RELATIONS    = ["Father","Mother","Guardian","Grandparent","Uncle","Aunt","Sibling","Other"];

const DRAFT_KEY = "yd_admission_draft";

const EMPTY_DRAFT = {
  // Step 1 – Student
  studentName: "", dob: "", gender: "", studentClass: "",
  center: "", joinDate: "", studentPhoto: null,

  // Step 2 – Parents
  fatherName: "", fatherWhatsapp: "", fatherEmail: "", fatherOccupation: "", fatherPhoto: null,
  motherName: "", motherWhatsapp: "", motherEmail: "", motherOccupation: "", motherPhoto: null,
  emergencyName: "", emergencyRelation: "", emergencyPhone: "",

  // Step 3 – Medical
  bloodGroup: "", allergies: "", medications: "",
  doctorName: "", doctorPhone: "", emergencyNotes: "", medicalNotes: "",

  // Step 4 – Pickup
  pickupPersons: [],

  // Step 5 – Fees
  feeTemplate: "", feeNotes: "",

  // Step 6 – Documents
  birthCertUpload: "", addressProofUpload: "", vaccineCardUpload: "",
  previousSchoolUpload: "", otherDocUpload: "",

  // Family (Phase 5)
  familyMode: "none",       // "none" | "new" | "existing"
  selectedFamilyId: "",     // set when familyMode === "existing"
};

const STEPS = [
  { id: "student",  label: "Student Info",    sub: "Name, DOB, class, photo",    icon: IconStudent,  required: true  },
  { id: "parents",  label: "Parent Details",  sub: "Father, mother, emergency",  icon: IconParents,  required: true  },
  { id: "medical",  label: "Medical Info",    sub: "Blood group, allergies",     icon: IconMedical,  required: false },
  { id: "pickup",   label: "Pickup Auth",     sub: "Authorised pickup persons",  icon: IconPickup,   required: false },
  { id: "fees",     label: "Fees",            sub: "Fee template assignment",    icon: IconFees,     required: false },
  { id: "documents","label": "Documents",     sub: "Birth cert, ID proof",       icon: IconDocuments,required: false },
];

// ── Image helpers ─────────────────────────────────────────────────
async function compressImage(file, w = 300, h = 300, q = 0.75) {
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

// ── Validation ────────────────────────────────────────────────────
function validateStep(step, draft) {
  const e = {};
  if (step === 0) {
    if (!draft.studentName.trim())  e.studentName = "Student name is required";
    if (!draft.dob)                 e.dob = "Date of birth is required";
    if (!draft.gender)              e.gender = "Gender is required";
    if (!draft.studentClass)        e.studentClass = "Class is required";
  }
  if (step === 1) {
    if (!draft.fatherName.trim() && !draft.motherName.trim())
      e.fatherName = "At least one parent's name is required";
    if (draft.fatherWhatsapp && !/^\d{10}$/.test(draft.fatherWhatsapp))
      e.fatherWhatsapp = "Must be 10 digits";
    if (draft.motherWhatsapp && !/^\d{10}$/.test(draft.motherWhatsapp))
      e.motherWhatsapp = "Must be 10 digits";
    if (draft.fatherEmail && !/\S+@\S+\.\S+/.test(draft.fatherEmail))
      e.fatherEmail = "Invalid email";
    if (draft.motherEmail && !/\S+@\S+\.\S+/.test(draft.motherEmail))
      e.motherEmail = "Invalid email";
  }
  return e;
}

function isStepComplete(index, draft) {
  const e = validateStep(index, draft);
  if (Object.keys(e).length) return false;
  if (index === 0) return !!(draft.studentName && draft.dob && draft.gender && draft.studentClass);
  if (index === 1) return !!(draft.fatherName || draft.motherName);
  return true; // optional steps always count as "complete" once visited
}

// ═══════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════
export default function NewAdmission() {
  const navigate   = useNavigate();
  const [step,     setStep]     = useState(0);
  const [draft,    setDraft]    = useState(EMPTY_DRAFT);
  const [visited,  setVisited]  = useState(new Set([0]));
  const [errors,   setErrors]   = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftMsg,  setDraftMsg]  = useState("");
  const [hasDraft,  setHasDraft]  = useState(false);
  const [showRestoreBanner, setShowRestoreBanner] = useState(false);
  const debounceRef = useRef(null);

  // ── Load draft on mount ───────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved?.studentName || saved?.fatherName) {
          setHasDraft(true);
          setShowRestoreBanner(true);
        }
      }
    } catch { /* ignore */ }
  }, []);

  // ── Autosave draft ────────────────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch { /* ignore quota errors */ }
    }, 1500);
    return () => clearTimeout(debounceRef.current);
  }, [draft]);

  const set = useCallback((key, val) => {
    setDraft(d => ({ ...d, [key]: val }));
    setErrors(e => { const n = { ...e }; delete n[key]; return n; });
  }, []);

  // ── Draft handlers ────────────────────────────────────────────
  function restoreDraft() {
    try {
      const saved = JSON.parse(localStorage.getItem(DRAFT_KEY));
      if (saved) { setDraft({ ...EMPTY_DRAFT, ...saved }); }
    } catch { /* ignore */ }
    setShowRestoreBanner(false);
  }

  function discardDraft() {
    localStorage.removeItem(DRAFT_KEY);
    setHasDraft(false);
    setShowRestoreBanner(false);
  }

  async function handleSaveDraft() {
    setSavingDraft(true);
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      setDraftMsg("Draft saved");
      setTimeout(() => setDraftMsg(""), 2000);
    } finally {
      setSavingDraft(false);
    }
  }

  // ── Step navigation ───────────────────────────────────────────
  function goToStep(idx) {
    setVisited(v => new Set([...v, idx]));
    setStep(idx);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleNext() {
    const errs = validateStep(step, draft);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    if (step < STEPS.length - 1) goToStep(step + 1);
  }

  function handlePrev() {
    if (step > 0) goToStep(step - 1);
  }

  // ── Submit ────────────────────────────────────────────────────
  async function handleSubmit() {
    // Validate required steps
    const e0 = validateStep(0, draft);
    const e1 = validateStep(1, draft);
    const allErrs = { ...e0, ...e1 };
    if (Object.keys(allErrs).length) {
      setErrors(allErrs);
      goToStep(Object.keys(e0).length ? 0 : 1);
      return;
    }

    setSubmitting(true);
    try {
      // 1. Create student — backend auto-creates Father/Mother as protected pickup persons
      const res = await api.post("/add-student", {
        student_name:    draft.studentName,
        dob:             draft.dob,
        class:           draft.studentClass,
        gender:          draft.gender,
        center:          draft.center,
        join_date:       draft.joinDate || new Date().toISOString().slice(0, 10),
        father_name:     draft.fatherName,
        father_whatsapp: draft.fatherWhatsapp,
        father_email:    draft.fatherEmail,
        father_photo:    draft.fatherPhoto || "",        // ← new: passed for auto-pickup creation
        mother_name:     draft.motherName,
        mother_whatsapp: draft.motherWhatsapp,
        mother_email:    draft.motherEmail,
        mother_photo:    draft.motherPhoto || "",        // ← new: passed for auto-pickup creation
        profile_image:   draft.studentPhoto || "",
      });

      const studentId = res.data?.studentId || res.data?.student?.studentId;

      // 2. Save medical info if any data provided
      const hasMedical = draft.bloodGroup || draft.allergies || draft.medications || draft.doctorName;
      if (studentId && hasMedical) {
        await api.put(`/api/student-medical/${studentId}`, {
          bloodGroup:     draft.bloodGroup,
          allergies:      draft.allergies,
          medications:    draft.medications,
          doctorName:     draft.doctorName,
          doctorPhone:    draft.doctorPhone,
          emergencyNotes: draft.emergencyNotes,
          notes:          draft.medicalNotes,
        }).catch(() => {});  // non-fatal
      }

      // 3. Save additional pickup persons (Father/Mother are already created by backend)
      if (studentId && draft.pickupPersons.length > 0) {
        await Promise.allSettled(
          draft.pickupPersons.map(p =>
            api.post("/api/pickup-authorization", {
              studentId,
              studentName: draft.studentName,
              pickupName:  p.name,
              relation:    p.relation,
              mobile:      p.mobile,
              photoUrl:    p.photoUrl || "",
              emergency:   p.emergency,
              isParent:    false,
              isProtected: false,
            })
          )
        );
      }

      // 4. Link to family (Phase 5)
      if (studentId) {
        if (draft.familyMode === "existing" && draft.selectedFamilyId) {
          await familyService.linkStudent(draft.selectedFamilyId, studentId).catch(() => {});
        } else if (draft.familyMode === "new") {
          const { familyId } = await familyService.create({
            fatherName:     draft.fatherName,
            motherName:     draft.motherName,
            primaryContact: draft.fatherWhatsapp || draft.motherWhatsapp,
            email:          draft.fatherEmail    || draft.motherEmail,
          }).catch(() => ({ familyId: null }));
          if (familyId) await familyService.linkStudent(familyId, studentId).catch(() => {});
        }
      }

      // 5. Clear draft and navigate
      localStorage.removeItem(DRAFT_KEY);
      navigate("/students", { state: { admissionSuccess: draft.studentName } });
    } catch (err) {
      console.error("[NewAdmission] submit error:", err);
      alert(err?.response?.data?.message || "Failed to save admission. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Completion tracking ───────────────────────────────────────
  const completedCount = STEPS.filter((_, i) => visited.has(i) && isStepComplete(i, draft)).length;
  const pct = Math.round((completedCount / STEPS.length) * 100);

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: "var(--yd-bg)" }}>

      {/* ── Sticky Header ──────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b"
              style={{ borderColor: "var(--yd-border)", boxShadow: "var(--yd-shadow-sm)" }}>
        <div className="flex items-center justify-between px-6 h-16">
          {/* Left: back + title */}
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/students")}
                    className="flex items-center gap-2 text-sm font-semibold hover:text-yellow-600 transition-colors"
                    style={{ color: "var(--yd-text-soft)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 5l-7 7 7 7"/>
              </svg>
              Students
            </button>
            <span style={{ color: "var(--yd-border)" }}>·</span>
            <span className="font-black text-base" style={{ color: "var(--yd-text)" }}>New Admission</span>
            {/* Progress pill */}
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full"
                  style={{ background: "var(--yd-yellow-light)", color: "var(--yd-yellow-dark)" }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--yd-yellow)" }} />
              {pct}% complete
            </span>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-3">
            {draftMsg && (
              <span className="hidden sm:block text-xs font-semibold" style={{ color: "var(--yd-success)" }}>
                ✓ {draftMsg}
              </span>
            )}
            <button onClick={handleSaveDraft} disabled={savingDraft}
                    className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border transition-all hover:shadow-sm disabled:opacity-50"
                    style={{ borderColor: "var(--yd-border)", color: "var(--yd-text-soft)", background: "white" }}>
              <IconSave size={14} />
              {savingDraft ? "Saving…" : "Save Draft"}
            </button>
            <button onClick={handleSubmit} disabled={submitting}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-black transition-all hover:scale-[1.02] disabled:opacity-60"
                    style={{ background: "var(--yd-yellow)", color: "#1a1a00", boxShadow: "var(--yd-shadow-yellow)" }}>
              {submitting ? (
                <><Spinner /> Submitting…</>
              ) : (
                <><IconCheck size={14} /> Submit Admission</>
              )}
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-0.5" style={{ background: "var(--yd-border-light)" }}>
          <div className="h-full transition-all duration-700"
               style={{ width: `${pct}%`, background: "var(--yd-yellow)" }} />
        </div>
      </header>

      {/* ── Restore Draft Banner ────────────────────────────────── */}
      {showRestoreBanner && (
        <div className="fixed top-16 left-0 right-0 z-40 flex items-center justify-between px-6 py-3 text-sm font-semibold"
             style={{ background: "var(--yd-warning-soft)", borderBottom: "1px solid var(--yd-warning-border)", color: "var(--yd-warning)" }}>
          <span>📋 You have an unsaved draft. Restore it?</span>
          <div className="flex gap-3">
            <button onClick={restoreDraft}
                    className="px-3 py-1 rounded-lg text-xs font-black bg-yellow-400 text-yellow-900 hover:bg-yellow-500 transition-colors">
              Restore
            </button>
            <button onClick={discardDraft}
                    className="px-3 py-1 rounded-lg text-xs font-semibold hover:bg-yellow-100 transition-colors">
              Discard
            </button>
          </div>
        </div>
      )}

      {/* ── Body: sidebar + main ───────────────────────────────── */}
      <div className="flex min-h-screen" style={{ paddingTop: showRestoreBanner ? 112 : 68 }}>

        {/* ── Left Progress Sidebar ─────────────────────────────── */}
        <aside className="hidden lg:flex flex-col sticky top-16 h-[calc(100vh-64px)] w-64 xl:w-72 border-r overflow-y-auto"
               style={{ background: "var(--yd-sidebar-bg)", borderColor: "var(--yd-border)" }}>
          {/* School label */}
          <div className="px-6 pt-8 pb-6 border-b" style={{ borderColor: "var(--yd-border-light)" }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base font-black"
                   style={{ background: "var(--yd-yellow)", color: "#1a1a00" }}>
                {PLATFORM_NAME.charAt(0)}
              </div>
              <div>
                <p className="text-xs font-bold" style={{ color: "var(--yd-text-muted)" }}>{PLATFORM_NAME}</p>
                <p className="text-sm font-black" style={{ color: "var(--yd-text)" }}>New Admission</p>
              </div>
            </div>
            {/* Circular-ish progress */}
            <div className="bg-white rounded-2xl p-4" style={{ boxShadow: "var(--yd-shadow-xs)", border: "1px solid var(--yd-border-light)" }}>
              <div className="flex items-end justify-between mb-2">
                <p className="text-xs font-bold" style={{ color: "var(--yd-text-muted)" }}>PROGRESS</p>
                <p className="text-2xl font-black" style={{ color: "var(--yd-yellow-dark)" }}>{pct}%</p>
              </div>
              <div className="w-full h-2 rounded-full" style={{ background: "var(--yd-border-light)" }}>
                <div className="h-full rounded-full transition-all duration-700"
                     style={{ width: `${pct}%`, background: "var(--yd-yellow)" }} />
              </div>
              <p className="text-xs mt-2" style={{ color: "var(--yd-text-muted)" }}>
                {completedCount} of {STEPS.length} sections complete
              </p>
            </div>
          </div>

          {/* Steps list */}
          <nav className="flex-1 px-4 py-6 space-y-1">
            {STEPS.map((s, i) => {
              const complete = visited.has(i) && isStepComplete(i, draft);
              const active   = step === i;
              const hasError = i <= 1 && visited.has(i) && Object.keys(validateStep(i, draft)).length > 0;
              return (
                <button key={s.id} onClick={() => goToStep(i)}
                        className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all group"
                        style={{
                          background: active ? "var(--yd-yellow-light)" : "transparent",
                          border: active ? "1px solid var(--yd-yellow)" : "1px solid transparent",
                        }}>
                  {/* Step icon / status */}
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all"
                       style={{
                         background: complete ? "var(--yd-success-soft)"
                                   : hasError ? "var(--yd-danger-soft)"
                                   : active   ? "var(--yd-yellow)"
                                   : "var(--yd-border-light)",
                         color: complete ? "var(--yd-success)"
                              : hasError ? "var(--yd-danger)"
                              : active   ? "#1a1a00"
                              : "var(--yd-text-muted)",
                       }}>
                    {complete ? <IconCheck size={14} /> : hasError ? <IconX size={14} /> : <s.icon size={14} />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold truncate"
                         style={{ color: active ? "var(--yd-yellow-dark)" : "var(--yd-text)" }}>
                        {s.label}
                      </p>
                      {s.required && <span className="text-[9px] font-black text-red-400 uppercase tracking-wide">req</span>}
                    </div>
                    <p className="text-[11px] truncate" style={{ color: "var(--yd-text-muted)" }}>{s.sub}</p>
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Bottom tip */}
          <div className="px-5 py-5 border-t" style={{ borderColor: "var(--yd-border-light)" }}>
            <div className="flex items-start gap-2 text-xs" style={{ color: "var(--yd-text-muted)" }}>
              <span className="mt-0.5">💾</span>
              <span>Draft saves automatically every 1.5 s. Starred fields are required.</span>
            </div>
          </div>
        </aside>

        {/* ── Main Content Area ─────────────────────────────────── */}
        <main className="flex-1 min-w-0 px-6 md:px-10 xl:px-16 py-10">
          {/* Mobile step indicator */}
          <div className="flex lg:hidden items-center gap-2 mb-6 overflow-x-auto pb-2 scrollbar-none">
            {STEPS.map((s, i) => {
              const complete = visited.has(i) && isStepComplete(i, draft);
              const active   = step === i;
              return (
                <button key={s.id} onClick={() => goToStep(i)}
                        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all"
                        style={{
                          background: active ? "var(--yd-yellow)" : complete ? "var(--yd-success-soft)" : "white",
                          color: active ? "#1a1a00" : complete ? "var(--yd-success)" : "var(--yd-text-muted)",
                          border: `1px solid ${active ? "var(--yd-yellow)" : "var(--yd-border)"}`,
                        }}>
                  {complete && !active ? "✓ " : `${i + 1}. `}{s.label}
                </button>
              );
            })}
          </div>

          {/* Step heading */}
          <div className="mb-8">
            <p className="text-xs font-black uppercase tracking-widest mb-1" style={{ color: "var(--yd-yellow-dark)" }}>
              Step {step + 1} of {STEPS.length}
            </p>
            <h1 className="text-3xl font-black" style={{ color: "var(--yd-text)" }}>
              {STEPS[step].label}
            </h1>
            <p className="mt-1 text-sm" style={{ color: "var(--yd-text-soft)" }}>{STEPS[step].sub}</p>
          </div>

          {/* Step content */}
          <div className="max-w-3xl">
            {step === 0 && <StepStudent    draft={draft} set={set} errors={errors} />}
            {step === 1 && <StepParents    draft={draft} set={set} errors={errors} />}
            {step === 2 && <StepMedical    draft={draft} set={set} errors={errors} />}
            {step === 3 && <StepPickup     draft={draft} set={set} errors={errors} />}
            {step === 4 && <StepFees       draft={draft} set={set} errors={errors} />}
            {step === 5 && <StepDocuments  draft={draft} set={set} errors={errors} />}
          </div>

          {/* ── Step navigation footer ──────────────────────────── */}
          <div className="max-w-3xl flex items-center justify-between mt-12 pt-8 border-t"
               style={{ borderColor: "var(--yd-border)" }}>
            <button onClick={handlePrev} disabled={step === 0}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-30 hover:bg-gray-50"
                    style={{ color: "var(--yd-text-soft)", border: "1px solid var(--yd-border)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 5l-7 7 7 7"/>
              </svg>
              Previous
            </button>

            <div className="flex items-center gap-2">
              {/* Dot indicators */}
              {STEPS.map((_, i) => (
                <button key={i} onClick={() => goToStep(i)}
                        className="rounded-full transition-all duration-300"
                        style={{
                          width: step === i ? 24 : 8,
                          height: 8,
                          background: step === i ? "var(--yd-yellow)"
                                    : (visited.has(i) && isStepComplete(i, draft)) ? "var(--yd-success)"
                                    : "var(--yd-border)",
                        }} />
              ))}
            </div>

            {step < STEPS.length - 1 ? (
              <button onClick={handleNext}
                      className="flex items-center gap-2 px-5 py-3 rounded-xl font-black text-sm transition-all hover:scale-105"
                      style={{ background: "var(--yd-yellow)", color: "#1a1a00", boxShadow: "var(--yd-shadow-yellow)" }}>
                Next Step
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={submitting}
                      className="flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm transition-all hover:scale-105 disabled:opacity-60"
                      style={{ background: "var(--yd-yellow)", color: "#1a1a00", boxShadow: "var(--yd-shadow-yellow)" }}>
                {submitting ? <><Spinner /> Submitting…</> : <><IconCheck size={14} /> Submit Admission</>}
              </button>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// STEP 1 — STUDENT INFO
// ═══════════════════════════════════════════════════════════════════
function StepStudent({ draft, set, errors }) {
  const photoRef = useRef(null);
  const [photoLoading, setPhotoLoading] = useState(false);

  async function handlePhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoLoading(true);
    try { set("studentPhoto", await compressImage(file, 300, 300, 0.78)); }
    finally { setPhotoLoading(false); }
  }

  return (
    <div className="space-y-6">
      {/* Photo card */}
      <Card>
        <SectionTitle icon="📸" title="Student Photo" optional />
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0 flex items-center justify-center"
               style={{ background: "var(--yd-yellow-light)", border: "2px dashed var(--yd-yellow)" }}>
            {draft.studentPhoto
              ? <img src={draft.studentPhoto} alt="student" className="w-full h-full object-cover" />
              : <span className="text-3xl">{photoLoading ? "⏳" : "👤"}</span>
            }
          </div>
          <div>
            <button onClick={() => photoRef.current?.click()}
                    className="px-4 py-2 rounded-xl text-sm font-bold transition-all hover:shadow-sm"
                    style={{ background: "var(--yd-yellow)", color: "#1a1a00" }}>
              {draft.studentPhoto ? "Change Photo" : "Upload Photo"}
            </button>
            <p className="text-xs mt-2" style={{ color: "var(--yd-text-muted)" }}>JPEG / PNG · Max 5 MB · Square crop recommended</p>
            <input ref={photoRef} type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
          </div>
        </div>
      </Card>

      {/* Core info card */}
      <Card>
        <SectionTitle icon="🎓" title="Basic Information" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field label="Student Full Name" required error={errors.studentName} className="sm:col-span-2">
            <input className={inp(errors.studentName)} placeholder="e.g. Arya Sharma"
                   value={draft.studentName} onChange={e => set("studentName", e.target.value)} />
          </Field>
          <Field label="Date of Birth" required error={errors.dob}>
            <input type="date" className={inp(errors.dob)} max={new Date().toISOString().slice(0, 10)}
                   value={draft.dob} onChange={e => set("dob", e.target.value)} />
          </Field>
          <Field label="Gender" required error={errors.gender}>
            <select className={inp(errors.gender)} value={draft.gender} onChange={e => set("gender", e.target.value)}>
              <option value="">Select gender</option>
              {GENDERS.map(g => <option key={g}>{g}</option>)}
            </select>
          </Field>
          <Field label="Class / Programme" required error={errors.studentClass}>
            <select className={inp(errors.studentClass)} value={draft.studentClass} onChange={e => set("studentClass", e.target.value)}>
              <option value="">Select class</option>
              {CLASSES.map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Centre / Branch" error={errors.center}>
            <select className={inp(errors.center)} value={draft.center} onChange={e => set("center", e.target.value)}>
              <option value="">Select centre</option>
              {CENTERS.map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Date of Joining" error={errors.joinDate}>
            <input type="date" className={inp(errors.joinDate)}
                   value={draft.joinDate} onChange={e => set("joinDate", e.target.value)} />
          </Field>
        </div>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// STEP 2 — PARENTS
// ═══════════════════════════════════════════════════════════════════
function StepParents({ draft, set, errors }) {
  const fatherPhotoRef = useRef(null);
  const motherPhotoRef = useRef(null);

  async function handleFatherPhoto(e) {
    const f = e.target.files?.[0];
    if (f) set("fatherPhoto", await compressImage(f, 200, 200, 0.75));
  }
  async function handleMotherPhoto(e) {
    const f = e.target.files?.[0];
    if (f) set("motherPhoto", await compressImage(f, 200, 200, 0.75));
  }

  return (
    <div className="space-y-6">
      {errors.fatherName && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold"
             style={{ background: "var(--yd-danger-soft)", color: "var(--yd-danger)", border: "1px solid var(--yd-danger-border)" }}>
          ⚠️ {errors.fatherName}
        </div>
      )}

      {/* Father */}
      <Card>
        <SectionTitle icon="👨" title="Father Details" />
        <div className="flex items-center gap-4 mb-5">
          <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center cursor-pointer"
               style={{ background: "var(--yd-yellow-light)", border: "2px dashed var(--yd-yellow)" }}
               onClick={() => fatherPhotoRef.current?.click()}>
            {draft.fatherPhoto
              ? <img src={draft.fatherPhoto} alt="father" className="w-full h-full object-cover" />
              : <span className="text-xl">👨</span>
            }
          </div>
          <div>
            <button onClick={() => fatherPhotoRef.current?.click()}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                    style={{ background: "var(--yd-yellow-light)", color: "var(--yd-yellow-dark)" }}>
              Upload Photo
            </button>
            <input ref={fatherPhotoRef} type="file" accept="image/*" onChange={handleFatherPhoto} className="hidden" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field label="Guardian 1 Name" error={errors.fatherName} className="sm:col-span-2">
            <input className={inp(errors.fatherName)} placeholder="e.g. Rahul Sharma"
                   value={draft.fatherName} onChange={e => set("fatherName", e.target.value)} />
          </Field>
          <Field label="WhatsApp Number" error={errors.fatherWhatsapp}>
            <input className={inp(errors.fatherWhatsapp)} placeholder="10-digit mobile"
                   maxLength={10} inputMode="numeric"
                   value={draft.fatherWhatsapp} onChange={e => set("fatherWhatsapp", e.target.value.replace(/\D/g, ""))} />
          </Field>
          <Field label="Email Address" error={errors.fatherEmail}>
            <input type="email" className={inp(errors.fatherEmail)} placeholder="rahul@example.com"
                   value={draft.fatherEmail} onChange={e => set("fatherEmail", e.target.value)} />
          </Field>
          <Field label="Occupation" error={errors.fatherOccupation}>
            <input className={inp(errors.fatherOccupation)} placeholder="e.g. Software Engineer"
                   value={draft.fatherOccupation} onChange={e => set("fatherOccupation", e.target.value)} />
          </Field>
        </div>
      </Card>

      {/* Mother */}
      <Card>
        <SectionTitle icon="👩" title="Mother Details" />
        <div className="flex items-center gap-4 mb-5">
          <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center cursor-pointer"
               style={{ background: "var(--yd-yellow-light)", border: "2px dashed var(--yd-yellow)" }}
               onClick={() => motherPhotoRef.current?.click()}>
            {draft.motherPhoto
              ? <img src={draft.motherPhoto} alt="mother" className="w-full h-full object-cover" />
              : <span className="text-xl">👩</span>
            }
          </div>
          <div>
            <button onClick={() => motherPhotoRef.current?.click()}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                    style={{ background: "var(--yd-yellow-light)", color: "var(--yd-yellow-dark)" }}>
              Upload Photo
            </button>
            <input ref={motherPhotoRef} type="file" accept="image/*" onChange={handleMotherPhoto} className="hidden" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field label="Guardian 2 Name" className="sm:col-span-2">
            <input className={inp()} placeholder="e.g. Priya Sharma"
                   value={draft.motherName} onChange={e => set("motherName", e.target.value)} />
          </Field>
          <Field label="WhatsApp Number" error={errors.motherWhatsapp}>
            <input className={inp(errors.motherWhatsapp)} placeholder="10-digit mobile"
                   maxLength={10} inputMode="numeric"
                   value={draft.motherWhatsapp} onChange={e => set("motherWhatsapp", e.target.value.replace(/\D/g, ""))} />
          </Field>
          <Field label="Email Address" error={errors.motherEmail}>
            <input type="email" className={inp(errors.motherEmail)} placeholder="priya@example.com"
                   value={draft.motherEmail} onChange={e => set("motherEmail", e.target.value)} />
          </Field>
          <Field label="Occupation" error={errors.motherOccupation}>
            <input className={inp()} placeholder="e.g. Teacher"
                   value={draft.motherOccupation} onChange={e => set("motherOccupation", e.target.value)} />
          </Field>
        </div>
      </Card>

      {/* Emergency contact */}
      <Card>
        <SectionTitle icon="🚨" title="Emergency Contact" optional />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <Field label="Contact Name">
            <input className={inp()} placeholder="Full name"
                   value={draft.emergencyName} onChange={e => set("emergencyName", e.target.value)} />
          </Field>
          <Field label="Relation">
            <select className={inp()} value={draft.emergencyRelation} onChange={e => set("emergencyRelation", e.target.value)}>
              <option value="">Select</option>
              {RELATIONS.map(r => <option key={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Phone Number">
            <input className={inp()} placeholder="10-digit" maxLength={10} inputMode="numeric"
                   value={draft.emergencyPhone} onChange={e => set("emergencyPhone", e.target.value.replace(/\D/g, ""))} />
          </Field>
        </div>
      </Card>

      {/* ── Family Section (Phase 5) ──────────────────────────────── */}
      <FamilySection draft={draft} set={set} />
    </div>
  );
}

// ── Family section for Step 2 ──────────────────────────────────────────────

function FamilySection({ draft, set }) {
  const [allFamilies,  setAllFamilies]  = useState([]);
  const [famLoading,   setFamLoading]   = useState(false);
  const [searchQuery,  setSearchQuery]  = useState("");

  async function loadFamilies() {
    if (allFamilies.length) return;
    setFamLoading(true);
    try {
      const { families } = await familyService.getAll();
      setAllFamilies(families || []);
    } catch { /* non-fatal */ }
    finally { setFamLoading(false); }
  }

  function handleMode(mode) {
    set("familyMode", mode);
    set("selectedFamilyId", "");
    if (mode === "existing") loadFamilies();
  }

  const filtered = allFamilies.filter(f => {
    const q = searchQuery.toLowerCase();
    return (
      f.familyCode.toLowerCase().includes(q) ||
      f.fatherName.toLowerCase().includes(q) ||
      f.motherName.toLowerCase().includes(q) ||
      f.primaryContact.includes(q)
    );
  });

  const selectedFam = allFamilies.find(f => f.familyId === draft.selectedFamilyId);

  return (
    <Card>
      <SectionTitle icon="👨‍👩‍👧‍👦" title="Family" optional />
      <p className="text-sm text-gray-500 mb-4">
        Link this student to a family unit to share parent details and manage siblings together.
      </p>

      <div className="flex gap-3 mb-4 flex-wrap">
        {[
          { val: "none",     label: "No Family Link" },
          { val: "new",      label: "Create New Family" },
          { val: "existing", label: "Link to Existing Family" },
        ].map(opt => (
          <button
            key={opt.val}
            type="button"
            onClick={() => handleMode(opt.val)}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
            style={{
              background: draft.familyMode === opt.val ? "var(--yd-yellow-light)" : "transparent",
              color:      draft.familyMode === opt.val ? "var(--yd-yellow-dark)"  : "var(--yd-text-muted)",
              border:     draft.familyMode === opt.val ? "1px solid var(--yd-yellow)" : "1px solid var(--yd-border)",
            }}
          >{opt.label}</button>
        ))}
      </div>

      {draft.familyMode === "new" && (
        <div className="px-4 py-3 rounded-xl text-sm"
             style={{ background: "var(--yd-yellow-light)", border: "1px solid var(--yd-yellow)", color: "var(--yd-yellow-dark)" }}>
          ✓ A new family will be created using the father/mother details entered above, and linked to this student automatically on submission.
        </div>
      )}

      {draft.familyMode === "existing" && (
        <div>
          {selectedFam ? (
            <div className="flex items-center justify-between p-3 rounded-xl mb-3"
                 style={{ background: "var(--yd-yellow-light)", border: "1px solid var(--yd-yellow)" }}>
              <div>
                <p className="text-sm font-bold" style={{ color: "var(--yd-yellow-dark)" }}>
                  {selectedFam.fatherName || selectedFam.motherName}
                </p>
                <p className="text-xs text-gray-500">
                  {selectedFam.familyCode} · {selectedFam.studentIds?.length || 0} child(ren) · Parent details will be auto-filled
                </p>
              </div>
              <button type="button" onClick={() => set("selectedFamilyId", "")}
                      className="text-xs text-red-500 hover:text-red-700 font-semibold">Change</button>
            </div>
          ) : (
            <>
              <input
                autoFocus={draft.familyMode === "existing"}
                placeholder="Search by family code, name, or contact…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm mb-3"
                style={{ border: "1px solid var(--yd-border)", background: "var(--yd-bg-warm)", outline: "none" }}
              />
              {famLoading && <p className="text-sm text-gray-400">Loading families…</p>}
              <div className="max-h-44 overflow-y-auto space-y-2">
                {filtered.map(f => (
                  <button
                    key={f.familyId}
                    type="button"
                    onClick={() => set("selectedFamilyId", f.familyId)}
                    className="w-full text-left p-3 rounded-xl transition-colors hover:bg-yellow-50"
                    style={{ border: "1px solid var(--yd-border)", background: "var(--yd-bg-warm)" }}
                  >
                    <p className="text-sm font-semibold">{f.fatherName || f.motherName}</p>
                    <p className="text-xs text-gray-400">{f.familyCode} · {f.studentIds?.length || 0} child(ren)</p>
                  </button>
                ))}
                {!famLoading && searchQuery && filtered.length === 0 && (
                  <p className="text-sm text-gray-400">No families found.</p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════
// STEP 3 — MEDICAL
// ═══════════════════════════════════════════════════════════════════
function StepMedical({ draft, set, errors }) {
  return (
    <div className="space-y-6">
      <OptionalBanner />
      <Card>
        <SectionTitle icon="🩸" title="Health Information" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field label="Blood Group">
            <select className={inp()} value={draft.bloodGroup} onChange={e => set("bloodGroup", e.target.value)}>
              <option value="">Select blood group</option>
              {BLOOD_GROUPS.map(g => <option key={g}>{g}</option>)}
            </select>
          </Field>
          <Field label="Known Allergies">
            <input className={inp()} placeholder="e.g. Peanuts, Dust, Pollen"
                   value={draft.allergies} onChange={e => set("allergies", e.target.value)} />
          </Field>
          <Field label="Current Medications" className="sm:col-span-2">
            <textarea rows={2} className={inp() + " resize-none"} placeholder="List any regular medications…"
                      value={draft.medications} onChange={e => set("medications", e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card>
        <SectionTitle icon="🏥" title="Doctor Details" optional />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field label="Doctor's Name">
            <input className={inp()} placeholder="Dr. Mehta"
                   value={draft.doctorName} onChange={e => set("doctorName", e.target.value)} />
          </Field>
          <Field label="Doctor's Phone">
            <input className={inp()} placeholder="10-digit" maxLength={10} inputMode="numeric"
                   value={draft.doctorPhone} onChange={e => set("doctorPhone", e.target.value.replace(/\D/g, ""))} />
          </Field>
          <Field label="Emergency Medical Notes" className="sm:col-span-2">
            <textarea rows={3} className={inp() + " resize-none"}
                      placeholder="Any important medical notes for staff (e.g. carry EpiPen, no running after meals)…"
                      value={draft.emergencyNotes} onChange={e => set("emergencyNotes", e.target.value)} />
          </Field>
          <Field label="General Health Notes" className="sm:col-span-2">
            <textarea rows={2} className={inp() + " resize-none"} placeholder="Any other health info…"
                      value={draft.medicalNotes} onChange={e => set("medicalNotes", e.target.value)} />
          </Field>
        </div>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// STEP 4 — PICKUP AUTHORIZATION
// ═══════════════════════════════════════════════════════════════════
function StepPickup({ draft, set, errors }) {
  const [form, setForm] = useState({ name: "", relation: "", mobile: "", emergency: false });
  const [formErr, setFormErr] = useState({});

  function addPerson() {
    const e = {};
    if (!form.name.trim())               e.name   = "Name required";
    if (!form.relation)                  e.relation = "Relation required";
    if (!/^\d{10}$/.test(form.mobile))  e.mobile = "10-digit mobile required";
    setFormErr(e);
    if (Object.keys(e).length) return;
    set("pickupPersons", [...draft.pickupPersons, { ...form, id: Date.now() }]);
    setForm({ name: "", relation: "", mobile: "", emergency: false });
    setFormErr({});
  }

  function removePerson(id) {
    set("pickupPersons", draft.pickupPersons.filter(p => p.id !== id));
  }

  function toggleEmergency(id) {
    set("pickupPersons", draft.pickupPersons.map(p => p.id === id ? { ...p, emergency: !p.emergency } : p));
  }

  return (
    <div className="space-y-6">
      <OptionalBanner />

      {/* Existing persons */}
      {draft.pickupPersons.length > 0 && (
        <Card>
          <SectionTitle icon="✅" title={`Authorized Persons (${draft.pickupPersons.length})`} />
          <div className="space-y-3">
            {draft.pickupPersons.map(p => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3 rounded-xl"
                   style={{ background: "var(--yd-soft)", border: "1px solid var(--yd-border)" }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black"
                       style={{ background: p.emergency ? "#FEF2F2" : "var(--yd-yellow-light)", color: p.emergency ? "#DC2626" : "var(--yd-yellow-dark)" }}>
                    {p.name[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: "var(--yd-text)" }}>{p.name}
                      {p.emergency && <span className="ml-2 text-[10px] font-black text-red-500 uppercase bg-red-50 px-1.5 py-0.5 rounded-full">Emergency</span>}
                    </p>
                    <p className="text-xs" style={{ color: "var(--yd-text-muted)" }}>{p.relation} · {p.mobile}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleEmergency(p.id)}
                          className="text-xs px-2 py-1 rounded-lg font-semibold transition-colors"
                          style={{ background: p.emergency ? "#FEF2F2" : "var(--yd-border-light)", color: p.emergency ? "#DC2626" : "var(--yd-text-muted)" }}>
                    {p.emergency ? "🚨 Emergency" : "Set Emergency"}
                  </button>
                  <button onClick={() => removePerson(p.id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold hover:bg-red-50 hover:text-red-500 transition-colors"
                          style={{ color: "var(--yd-text-muted)" }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Add person form */}
      <Card>
        <SectionTitle icon="➕" title="Add Authorised Person" optional={draft.pickupPersons.length > 0} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field label="Full Name" error={formErr.name}>
            <input className={inp(formErr.name)} placeholder="Authorised person's name"
                   value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label="Relation to Student" error={formErr.relation}>
            <select className={inp(formErr.relation)} value={form.relation}
                    onChange={e => setForm(f => ({ ...f, relation: e.target.value }))}>
              <option value="">Select relation</option>
              {RELATIONS.map(r => <option key={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Mobile Number" error={formErr.mobile}>
            <input className={inp(formErr.mobile)} placeholder="10-digit" maxLength={10} inputMode="numeric"
                   value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value.replace(/\D/g, "") }))} />
          </Field>
          <Field label="Emergency Contact?">
            <label className="flex items-center gap-3 h-[46px] cursor-pointer">
              <div onClick={() => setForm(f => ({ ...f, emergency: !f.emergency }))}
                   className="w-11 h-6 rounded-full relative transition-all duration-200 flex-shrink-0"
                   style={{ background: form.emergency ? "var(--yd-yellow)" : "var(--yd-border)" }}>
                <div className="absolute w-5 h-5 bg-white rounded-full top-0.5 shadow-sm transition-all duration-200"
                     style={{ left: form.emergency ? 22 : 2 }} />
              </div>
              <span className="text-sm font-semibold" style={{ color: "var(--yd-text)" }}>
                {form.emergency ? "Yes — Emergency contact" : "No — Regular pickup only"}
              </span>
            </label>
          </Field>
        </div>
        <div className="mt-5">
          <button onClick={addPerson}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all hover:scale-105"
                  style={{ background: "var(--yd-yellow)", color: "#1a1a00", boxShadow: "var(--yd-shadow-yellow)" }}>
            <span>+</span> Add Person
          </button>
        </div>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// STEP 5 — FEES
// ═══════════════════════════════════════════════════════════════════
function StepFees({ draft, set }) {
  const FEE_TEMPLATES = [
    { id: "full-day",    label: "Full Day Programme",     amount: "₹8,500 / month" },
    { id: "half-day",    label: "Half Day Programme",     amount: "₹5,500 / month" },
    { id: "playgroup",   label: "Playgroup Package",      amount: "₹4,000 / month" },
    { id: "daycare",     label: "Daycare (extended)",     amount: "₹10,000 / month" },
    { id: "custom",      label: "Custom / No Template",   amount: "Set manually later" },
  ];

  return (
    <div className="space-y-6">
      <OptionalBanner />
      <Card>
        <SectionTitle icon="💰" title="Fee Template" optional />
        <p className="text-sm mb-4" style={{ color: "var(--yd-text-soft)" }}>
          Select a fee package for this student. You can change or customise this later from the Fees module.
        </p>
        <div className="space-y-3">
          {FEE_TEMPLATES.map(t => (
            <label key={t.id}
                   className="flex items-center gap-4 px-4 py-4 rounded-xl cursor-pointer transition-all"
                   style={{
                     border: `2px solid ${draft.feeTemplate === t.id ? "var(--yd-yellow)" : "var(--yd-border)"}`,
                     background: draft.feeTemplate === t.id ? "var(--yd-yellow-light)" : "white",
                   }}>
              <input type="radio" name="feeTemplate" value={t.id} className="sr-only"
                     checked={draft.feeTemplate === t.id}
                     onChange={() => set("feeTemplate", t.id)} />
              <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                   style={{ borderColor: draft.feeTemplate === t.id ? "var(--yd-yellow)" : "var(--yd-border)" }}>
                {draft.feeTemplate === t.id && (
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--yd-yellow-dark)" }} />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold" style={{ color: "var(--yd-text)" }}>{t.label}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--yd-text-muted)" }}>{t.amount}</p>
              </div>
            </label>
          ))}
        </div>
        <Field label="Fee Notes" className="mt-5">
          <textarea rows={2} className={inp() + " resize-none"}
                    placeholder="Any special fee arrangements, discounts, or notes…"
                    value={draft.feeNotes} onChange={e => set("feeNotes", e.target.value)} />
        </Field>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// STEP 6 — DOCUMENTS
// ═══════════════════════════════════════════════════════════════════
function StepDocuments({ draft, set }) {
  const DOCS = [
    { key: "birthCertUpload",      label: "Birth Certificate",      icon: "📋", hint: "PDF or image accepted" },
    { key: "addressProofUpload",   label: "Address Proof",          icon: "🏠", hint: "Aadhaar, utility bill, etc." },
    { key: "vaccineCardUpload",    label: "Vaccination Card",       icon: "💉", hint: "Immunisation record" },
    { key: "previousSchoolUpload", label: "Previous School Records",icon: "🏫", hint: "Transfer certificate if applicable" },
    { key: "otherDocUpload",       label: "Other Documents",        icon: "📎", hint: "Any additional documents" },
  ];

  return (
    <div className="space-y-6">
      <OptionalBanner />
      <Card>
        <SectionTitle icon="📄" title="Document Upload" optional />
        <p className="text-sm mb-5" style={{ color: "var(--yd-text-soft)" }}>
          Upload scanned copies or photos. Documents can also be added later from the student profile.
        </p>
        <div className="space-y-3">
          {DOCS.map(doc => (
            <DocUploadRow key={doc.key} {...doc}
                          value={draft[doc.key]}
                          onChange={val => set(doc.key, val)} />
          ))}
        </div>
      </Card>
    </div>
  );
}

function DocUploadRow({ icon, label, hint, value, onChange }) {
  const ref = useRef(null);
  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-xl transition-all"
         style={{ border: `1px solid ${value ? "var(--yd-success-border)" : "var(--yd-border)"}`, background: value ? "var(--yd-success-soft)" : "white" }}>
      <span className="text-xl flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold" style={{ color: "var(--yd-text)" }}>{label}</p>
        <p className="text-xs truncate" style={{ color: "var(--yd-text-muted)" }}>{value || hint}</p>
      </div>
      <button onClick={() => ref.current?.click()}
              className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg transition-all hover:shadow-sm"
              style={{ background: value ? "var(--yd-success-soft)" : "var(--yd-yellow-light)", color: value ? "var(--yd-success)" : "var(--yd-yellow-dark)", border: `1px solid ${value ? "var(--yd-success-border)" : "var(--yd-border-light)"}` }}>
        {value ? "✓ Uploaded" : "Upload"}
      </button>
      <input ref={ref} type="file" accept="image/*,.pdf" className="hidden"
             onChange={e => e.target.files?.[0] && onChange(e.target.files[0].name)} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SHARED UI PRIMITIVES
// ═══════════════════════════════════════════════════════════════════
function Card({ children, className = "" }) {
  return (
    <div className={`rounded-2xl p-6 ${className}`}
         style={{ background: "white", border: "1px solid var(--yd-border)", boxShadow: "var(--yd-shadow-sm)" }}>
      {children}
    </div>
  );
}

function SectionTitle({ icon, title, optional }) {
  return (
    <div className="flex items-center gap-2 mb-5">
      <span className="text-lg">{icon}</span>
      <h3 className="text-base font-black" style={{ color: "var(--yd-text)" }}>{title}</h3>
      {optional && (
        <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
              style={{ background: "var(--yd-border-light)", color: "var(--yd-text-muted)" }}>optional</span>
      )}
    </div>
  );
}

function Field({ label, error, required, children, className = "" }) {
  return (
    <div className={className}>
      <label className="block text-[11px] font-black uppercase tracking-widest mb-1.5"
             style={{ color: error ? "var(--yd-danger)" : "var(--yd-text-muted)" }}>
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-[11px] font-semibold mt-1" style={{ color: "var(--yd-danger)" }}>⚠ {error}</p>}
    </div>
  );
}

function OptionalBanner() {
  return (
    <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
         style={{ background: "var(--yd-info-soft)", color: "var(--yd-info)", border: "1px solid var(--yd-info-border)" }}>
      <span>ℹ️</span>
      <span className="font-semibold">This section is optional. You can skip it and fill it in later from the student profile.</span>
    </div>
  );
}

const inp = (err) =>
  `w-full px-4 py-3 rounded-xl text-sm font-medium outline-none transition-all ${
    err
      ? "border-2 border-red-300 bg-red-50 focus:border-red-400"
      : "border border-[var(--yd-border)] bg-[var(--yd-soft)] focus:border-[var(--yd-yellow)] focus:bg-white"
  }`;

function Spinner() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity=".2"/>
      <path d="M12 3a9 9 0 019 9" strokeLinecap="round"/>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ICON COMPONENTS
// ═══════════════════════════════════════════════════════════════════
function IconStudent({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 10-16 0"/>
    </svg>
  );
}
function IconParents({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="7" r="3"/><circle cx="17" cy="9" r="2.5"/>
      <path d="M2 21a7 7 0 0114 0"/><path d="M17 21a4 4 0 00-3.5-4"/>
    </svg>
  );
}
function IconMedical({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3"/>
      <path d="M12 8v8M8 12h8"/>
    </svg>
  );
}
function IconPickup({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="10" width="22" height="8" rx="2"/>
      <path d="M5 10V7a2 2 0 012-2h10a2 2 0 012 2v3"/>
      <circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>
    </svg>
  );
}
function IconFees({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/>
      <path d="M14.5 9a2.5 2.5 0 00-5 0c0 2.5 5 2.5 5 5a2.5 2.5 0 01-5 0"/>
      <line x1="12" y1="6.5" x2="12" y2="7.5"/><line x1="12" y1="16.5" x2="12" y2="17.5"/>
    </svg>
  );
}
function IconDocuments({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>
    </svg>
  );
}
function IconCheck({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}
function IconX({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}
function IconSave({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
      <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
    </svg>
  );
}
