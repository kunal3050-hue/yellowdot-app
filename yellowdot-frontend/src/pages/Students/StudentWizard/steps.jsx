/**
 * steps.jsx — render functions for each Wizard step, shared between
 * add mode (/students/new, /add-student) and edit mode (/edit-student/:id).
 * Field set/validation/API payloads match NewAdmission.jsx exactly (see
 * schema.js) -- this is a presentation rewrite onto the Wizard component,
 * not a behavior change.
 */
import { useState, useRef, useEffect } from "react";
import { Camera, Plus, X, Search } from "lucide-react";
import { Field, Input, Select, Button, Card } from "../../../components/ui";
import { compressImage } from "../shared";
import familyService from "../../../services/familyService";
import financeApi from "../../../services/financeApi";
import { CLASSES, GENDERS, CENTERS, BLOOD_GROUPS, RELATIONS, DOC_ROWS } from "./schema";

const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 };

function PhotoPicker({ value, onChange, label, size = 64 }) {
  const ref = useRef(null);
  const [loading, setLoading] = useState(false);
  async function handleChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try { onChange(await compressImage(file, size >= 96 ? 300 : 200, size >= 96 ? 300 : 200, 0.76)); }
    finally { setLoading(false); }
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div
        onClick={() => ref.current?.click()}
        style={{
          width: size, height: size, borderRadius: 14, flexShrink: 0, cursor: "pointer", overflow: "hidden",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "var(--yd-yellow-light)", border: "2px dashed var(--yd-yellow)",
        }}
      >
        {value ? <img src={value} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Camera size={size >= 96 ? 26 : 18} strokeWidth={1.5} color="var(--yd-yellow-dark)" />}
      </div>
      <div>
        <Button type="button" size="xs" variant="outline" loading={loading} onClick={() => ref.current?.click()}>
          {value ? "Change" : "Upload"} {label}
        </Button>
        <input ref={ref} type="file" accept="image/*" style={{ display: "none" }} onChange={handleChange} />
      </div>
    </div>
  );
}

/* ── Step: Student Info ─────────────────────────────────────────── */
export function StepStudentInfo(form) {
  const { register, watch, setValue, formState: { errors } } = form;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <p style={{ fontSize: 10, fontWeight: 800, color: "var(--yd-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Student Photo</p>
        <PhotoPicker value={watch("studentPhoto")} onChange={v => setValue("studentPhoto", v)} label="Photo" size={96} />
      </Card>
      <Card>
        <div style={grid}>
          <Field label="Student Full Name" required error={errors.studentName?.message} style={{ gridColumn: "1 / -1" }}>
            <Input {...register("studentName")} placeholder="e.g. Arya Sharma" />
          </Field>
          <Field label="Date of Birth" required error={errors.dob?.message}>
            <Input type="date" max={new Date().toISOString().slice(0, 10)} {...register("dob")} />
          </Field>
          <Field label="Gender" required error={errors.gender?.message}>
            <Select {...register("gender")} placeholder="Select gender" options={GENDERS} />
          </Field>
          <Field label="Class / Programme" required error={errors.studentClass?.message}>
            <Select {...register("studentClass")} placeholder="Select class" options={CLASSES} />
          </Field>
          <Field label="Centre / Branch">
            <Select {...register("center")} placeholder="Select centre" options={CENTERS} />
          </Field>
          <Field label="Date of Joining">
            <Input type="date" {...register("joinDate")} />
          </Field>
        </div>
      </Card>
    </div>
  );
}
StepStudentInfo.fields = ["studentName", "dob", "gender", "studentClass"];

/* ── Family linking section (Phase 5) ───────────────────────────── */
function FamilySection({ watch, setValue }) {
  const familyMode = watch("familyMode");
  const selectedFamilyId = watch("selectedFamilyId");
  const [allFamilies, setAllFamilies] = useState([]);
  const [famLoading, setFamLoading] = useState(false);
  const [query, setQuery] = useState("");

  async function loadFamilies() {
    if (allFamilies.length) return;
    setFamLoading(true);
    try { const { families } = await familyService.getAll(); setAllFamilies(families || []); }
    catch { /* non-fatal */ }
    finally { setFamLoading(false); }
  }

  function handleMode(mode) {
    setValue("familyMode", mode);
    setValue("selectedFamilyId", "");
    if (mode === "existing") loadFamilies();
  }

  const filtered = allFamilies.filter(f => {
    const q = query.toLowerCase();
    return !q || (f.familyCode || "").toLowerCase().includes(q) || (f.fatherName || "").toLowerCase().includes(q) || (f.motherName || "").toLowerCase().includes(q);
  });
  const selectedFam = allFamilies.find(f => f.familyId === selectedFamilyId);

  return (
    <Card>
      <p style={{ fontSize: 12, fontWeight: 800, color: "var(--yd-charcoal)", marginBottom: 10 }}>Family Link (optional)</p>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {[{ val: "none", label: "None" }, { val: "new", label: "New Family" }, { val: "existing", label: "Existing Family" }].map(opt => (
          <button key={opt.val} type="button" onClick={() => handleMode(opt.val)}
            style={{
              padding: "5px 12px", fontSize: 11, fontWeight: 700, borderRadius: 999, cursor: "pointer",
              background: familyMode === opt.val ? "var(--yd-yellow-light)" : "transparent",
              color: familyMode === opt.val ? "var(--yd-yellow-dark)" : "var(--yd-text-muted)",
              border: familyMode === opt.val ? "1px solid var(--yd-yellow)" : "1px solid var(--yd-border)",
            }}>
            {opt.label}
          </button>
        ))}
      </div>
      {familyMode === "new" && (
        <p style={{ fontSize: 12, color: "var(--yd-text-soft)" }}>A new family record will be created from the parent details above.</p>
      )}
      {familyMode === "existing" && (
        <div>
          {selectedFam ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--yd-soft)", borderRadius: 10, padding: "8px 12px" }}>
              <span style={{ fontSize: 12, fontWeight: 700 }}>{selectedFam.familyCode} — {selectedFam.fatherName || selectedFam.motherName}</span>
              <Button type="button" size="xs" variant="ghost" onClick={() => setValue("selectedFamilyId", "")}>Change</Button>
            </div>
          ) : (
            <>
              <div style={{ position: "relative", marginBottom: 8 }}>
                <Search size={12} strokeWidth={2} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--yd-text-muted)" }} />
                <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by family code or parent name…" style={{ paddingLeft: 28 }} />
              </div>
              {famLoading ? (
                <p style={{ fontSize: 12, color: "var(--yd-text-muted)" }}>Loading families…</p>
              ) : (
                <div style={{ maxHeight: 160, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                  {filtered.slice(0, 20).map(f => (
                    <button key={f.familyId} type="button" onClick={() => setValue("selectedFamilyId", f.familyId)}
                      style={{ textAlign: "left", padding: "6px 10px", borderRadius: 8, border: "1px solid var(--yd-border-light)", background: "var(--yd-surface)", cursor: "pointer" }}>
                      <span style={{ fontSize: 12, fontWeight: 700 }}>{f.familyCode}</span>
                      <span style={{ fontSize: 11, color: "var(--yd-text-muted)", marginLeft: 6 }}>{f.fatherName || f.motherName}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Card>
  );
}

/* ── Step: Parent Details ───────────────────────────────────────── */
export function StepParentDetails(form) {
  const { register, watch, setValue, formState: { errors } } = form;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <p style={{ fontSize: 12, fontWeight: 800, color: "var(--yd-charcoal)", marginBottom: 10 }}>Father Details</p>
        <PhotoPicker value={watch("fatherPhoto")} onChange={v => setValue("fatherPhoto", v)} label="Photo" />
        <div style={{ ...grid, marginTop: 14 }}>
          <Field label="Guardian 1 Name" error={errors.fatherName?.message} style={{ gridColumn: "1 / -1" }}>
            <Input {...register("fatherName")} placeholder="e.g. Rahul Sharma" />
          </Field>
          <Field label="WhatsApp" error={errors.fatherWhatsapp?.message}>
            <Input maxLength={10} inputMode="numeric" {...register("fatherWhatsapp")} placeholder="10-digit mobile" />
          </Field>
          <Field label="Email" error={errors.fatherEmail?.message}>
            <Input type="email" {...register("fatherEmail")} placeholder="rahul@example.com" />
          </Field>
          <Field label="Occupation">
            <Input {...register("fatherOccupation")} placeholder="e.g. Software Engineer" />
          </Field>
        </div>
      </Card>

      <Card>
        <p style={{ fontSize: 12, fontWeight: 800, color: "var(--yd-charcoal)", marginBottom: 10 }}>Mother Details</p>
        <PhotoPicker value={watch("motherPhoto")} onChange={v => setValue("motherPhoto", v)} label="Photo" />
        <div style={{ ...grid, marginTop: 14 }}>
          <Field label="Guardian 2 Name" style={{ gridColumn: "1 / -1" }}>
            <Input {...register("motherName")} placeholder="e.g. Priya Sharma" />
          </Field>
          <Field label="WhatsApp" error={errors.motherWhatsapp?.message}>
            <Input maxLength={10} inputMode="numeric" {...register("motherWhatsapp")} placeholder="10-digit mobile" />
          </Field>
          <Field label="Email" error={errors.motherEmail?.message}>
            <Input type="email" {...register("motherEmail")} placeholder="priya@example.com" />
          </Field>
          <Field label="Occupation">
            <Input {...register("motherOccupation")} placeholder="e.g. Teacher" />
          </Field>
        </div>
      </Card>

      <Card>
        <p style={{ fontSize: 12, fontWeight: 800, color: "var(--yd-charcoal)", marginBottom: 10 }}>Emergency Contact (optional)</p>
        <div style={grid}>
          <Field label="Contact Name"><Input {...register("emergencyName")} placeholder="Full name" /></Field>
          <Field label="Relation"><Select {...register("emergencyRelation")} placeholder="Select" options={RELATIONS} /></Field>
          <Field label="Phone"><Input maxLength={10} inputMode="numeric" {...register("emergencyPhone")} placeholder="10-digit" /></Field>
        </div>
      </Card>

      <FamilySection watch={watch} setValue={setValue} />
    </div>
  );
}
StepParentDetails.fields = ["fatherName", "fatherWhatsapp", "fatherEmail", "motherWhatsapp", "motherEmail"];

/* ── Step: Medical Info (optional) ──────────────────────────────── */
export function StepMedical({ register }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <div style={grid}>
          <Field label="Blood Group"><Select {...register("bloodGroup")} placeholder="Select…" options={BLOOD_GROUPS} /></Field>
          <Field label="Doctor Name"><Input {...register("doctorName")} placeholder="Dr. Name" /></Field>
          <Field label="Doctor Phone"><Input {...register("doctorPhone")} placeholder="10-digit" /></Field>
        </div>
      </Card>
      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Field label="Allergies"><Input {...register("allergies")} placeholder="e.g. peanuts, dust…" /></Field>
          <Field label="Medications"><Input {...register("medications")} placeholder="Current medications…" /></Field>
          <Field label="Emergency Notes">
            <textarea {...register("emergencyNotes")} rows={2} className="yd-input" style={{ resize: "none" }} placeholder="Important for emergencies…" />
          </Field>
          <Field label="Additional Notes">
            <textarea {...register("medicalNotes")} rows={2} className="yd-input" style={{ resize: "none" }} placeholder="Any other info…" />
          </Field>
        </div>
      </Card>
    </div>
  );
}
StepMedical.fields = [];

/* ── Step: Pickup Authorization (optional) ──────────────────────── */
export function StepPickup({ watch, setValue }) {
  const persons = watch("pickupPersons") || [];
  const [form, setForm] = useState({ name: "", relation: "", mobile: "", emergency: false });
  const [err, setErr] = useState({});

  function addPerson() {
    const e = {};
    if (!form.name.trim()) e.name = "Name required";
    if (!form.relation) e.relation = "Relation required";
    if (!/^\d{10}$/.test(form.mobile)) e.mobile = "10-digit mobile required";
    setErr(e);
    if (Object.keys(e).length) return;
    setValue("pickupPersons", [...persons, { ...form, id: Date.now() }]);
    setForm({ name: "", relation: "", mobile: "", emergency: false });
    setErr({});
  }
  function removePerson(id) { setValue("pickupPersons", persons.filter(p => p.id !== id)); }
  function toggleEmergency(id) { setValue("pickupPersons", persons.map(p => p.id === id ? { ...p, emergency: !p.emergency } : p)); }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {persons.length > 0 && (
        <Card>
          <p style={{ fontSize: 12, fontWeight: 800, marginBottom: 10 }}>Authorized Persons ({persons.length})</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {persons.map(p => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--yd-soft)", borderRadius: 10, padding: "8px 12px" }}>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>{p.name}</span>
                  {p.emergency && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 800, color: "var(--yd-danger)", background: "var(--yd-danger-soft)", padding: "1px 6px", borderRadius: 999 }}>EMERGENCY</span>}
                  <p style={{ fontSize: 11, color: "var(--yd-text-muted)" }}>{p.relation} · {p.mobile}</p>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <Button type="button" size="xs" variant="ghost" onClick={() => toggleEmergency(p.id)}>{p.emergency ? "Unset" : "Set"} Emergency</Button>
                  <Button type="button" size="xs" variant="ghost" onClick={() => removePerson(p.id)}><X size={12} strokeWidth={2.5} /></Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
      <Card>
        <p style={{ fontSize: 12, fontWeight: 800, marginBottom: 10 }}>Add Authorised Person</p>
        <div style={grid}>
          <Field label="Full Name" error={err.name}><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Name" /></Field>
          <Field label="Relation" error={err.relation}><Select value={form.relation} onChange={e => setForm(f => ({ ...f, relation: e.target.value }))} placeholder="Select relation" options={RELATIONS} /></Field>
          <Field label="Mobile" error={err.mobile}><Input maxLength={10} value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value.replace(/\D/g, "") }))} placeholder="10-digit" /></Field>
        </div>
        <Button type="button" size="sm" variant="primary" leftIcon={<Plus size={12} strokeWidth={2.5} />} onClick={addPerson} style={{ marginTop: 12 }}>Add Person</Button>
      </Card>
    </div>
  );
}
StepPickup.fields = [];

/* ── Step: Fees ────────────────────────────────────────────────────────
 * Real Fee Templates (financeApi.feeTemplates.list — the same
 * Finance Settings collection Billing Plans reference), not a hardcoded
 * placeholder list. Selecting one here and completing admission
 * automatically creates AND activates a Billing Plan for the student —
 * no separate visit to the Billing Plans screen needed (M3.6). Leaving
 * "No Fee Template" selected admits the student normally, with no
 * Billing Plan created — staff can still add one manually later. */
export function StepFees({ watch, setValue, register }) {
  const feeTemplate = watch("feeTemplate");
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    financeApi.feeTemplates.list()
      .then(res => {
        if (cancelled) return;
        const active = (res?.templates || []).filter(t => t.active !== false);
        setTemplates(active);
      })
      .catch(() => { if (!cancelled) setError("Couldn't load fee templates — you can still admit the student and set up billing later from Finance Settings."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <Card>
      <p style={{ fontSize: 12, fontWeight: 800, marginBottom: 4 }}>Fee Template</p>
      <p style={{ fontSize: 12, color: "var(--yd-text-muted)", marginBottom: 12 }}>
        Select a fee package to automatically set up recurring billing for this student. You can change this later from Finance Settings.
      </p>

      {loading && <p style={{ fontSize: 12, color: "var(--yd-text-muted)" }}>Loading fee templates…</p>}
      {error && <p style={{ fontSize: 12, color: "var(--yd-danger)" }}>{error}</p>}

      {!loading && !error && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label style={{
            display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 12, cursor: "pointer",
            border: `2px solid ${!feeTemplate ? "var(--yd-yellow)" : "var(--yd-border)"}`,
            background: !feeTemplate ? "var(--yd-yellow-light)" : "var(--yd-surface)",
          }}>
            <input type="radio" name="feeTemplate" checked={!feeTemplate} onChange={() => setValue("feeTemplate", "")} style={{ accentColor: "var(--yd-yellow-dark)" }} />
            <div>
              <p style={{ fontSize: 12, fontWeight: 700 }}>No Fee Template</p>
              <p style={{ fontSize: 11, color: "var(--yd-text-muted)" }}>Set up billing manually later</p>
            </div>
          </label>
          {templates.map(t => (
            <label key={t.templateId} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 12, cursor: "pointer",
              border: `2px solid ${feeTemplate === t.templateId ? "var(--yd-yellow)" : "var(--yd-border)"}`,
              background: feeTemplate === t.templateId ? "var(--yd-yellow-light)" : "var(--yd-surface)",
            }}>
              <input type="radio" name="feeTemplate" checked={feeTemplate === t.templateId} onChange={() => setValue("feeTemplate", t.templateId)} style={{ accentColor: "var(--yd-yellow-dark)" }} />
              <div>
                <p style={{ fontSize: 12, fontWeight: 700 }}>{t.templateName}</p>
                <p style={{ fontSize: 11, color: "var(--yd-text-muted)" }}>₹{Number(t.amount || 0).toLocaleString("en-IN")} / {(t.billingCycle || "Monthly").toLowerCase()}</p>
              </div>
            </label>
          ))}
          {templates.length === 0 && (
            <p style={{ fontSize: 12, color: "var(--yd-text-muted)" }}>
              No fee templates set up yet — create one from Finance Settings, or admit this student and add billing later.
            </p>
          )}
        </div>
      )}

      <Field label="Fee Notes" style={{ marginTop: 12 }}>
        <textarea {...register("feeNotes")} rows={2} className="yd-input" style={{ resize: "none" }} placeholder="Any special fee arrangements, discounts, or notes…" />
      </Field>
    </Card>
  );
}
StepFees.fields = [];

/* ── Step: Documents (optional, UI-only — matches original: filename
   stored, never uploaded — no backend document API exists) ────────── */
function DocUploadRow({ doc, value, onChange }) {
  const ref = useRef(null);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 12, border: `1px solid ${value ? "var(--yd-success-border)" : "var(--yd-border)"}`, background: value ? "var(--yd-success-soft)" : "var(--yd-surface)" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 700 }}>{doc.label}</p>
        <p style={{ fontSize: 11, color: "var(--yd-text-muted)" }}>{value || doc.hint}</p>
      </div>
      <Button type="button" size="xs" variant={value ? "success" : "outline"} onClick={() => ref.current?.click()}>{value ? "Uploaded" : "Upload"}</Button>
      <input ref={ref} type="file" accept="image/*,.pdf" style={{ display: "none" }} onChange={e => e.target.files?.[0] && onChange(e.target.files[0].name)} />
    </div>
  );
}

export function StepDocuments({ watch, setValue }) {
  return (
    <Card>
      <p style={{ fontSize: 12, fontWeight: 800, marginBottom: 4 }}>Document Upload</p>
      <p style={{ fontSize: 12, color: "var(--yd-text-muted)", marginBottom: 12 }}>Documents can also be added later from the student profile.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {DOC_ROWS.map(doc => (
          <DocUploadRow key={doc.key} doc={doc} value={watch(doc.key)} onChange={(v) => setValue(doc.key, v)} />
        ))}
      </div>
    </Card>
  );
}
StepDocuments.fields = [];
