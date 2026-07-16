/**
 * StudentModal.jsx — Add / Edit student form
 * Same fields, validation, and submit contract as the original inline
 * modal in Students.jsx — rebuilt on the shared Modal/Input/Select/
 * FormGrid/Tabs primitives instead of ad-hoc Tailwind markup.
 */
import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { Modal, Button, Input, Select, FormGrid, Field } from "../../components/ui";
import { compressImage, initials, CLASSES, GENDERS, CENTERS, STATUSES } from "./shared";

export default function StudentModal({ student, onSave, onClose, saving }) {
  const isEdit = !!student?.Student_ID;
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
    ev?.preventDefault();
    if (!validate()) return;
    onSave({ ...form, student_name: form.student_name.trim(), ...(photoBase64 ? { profile_image: photoBase64 } : {}) });
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={isEdit ? "Edit Student" : "Add New Student"}
      size="wide"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} loading={saving}>
            {isEdit ? "Update Student" : "Add Student"}
          </Button>
        </>
      }
    >
      {isEdit && <p style={{ fontSize: 12, color: "var(--yd-text-muted)", marginTop: -8, marginBottom: 12 }}>ID: {student.Student_ID}</p>}

      {/* Photo + tabs */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, paddingBottom: 16, marginBottom: 16, borderBottom: "1px solid var(--yd-border-light)" }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          {photoPreview
            ? <img src={photoPreview} alt="" style={{ width: 56, height: 56, borderRadius: 12, objectFit: "cover", border: "2px solid var(--yd-border)" }} />
            : <div style={{ width: 56, height: 56, borderRadius: 12, background: "var(--yd-yellow-light)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, color: "var(--yd-charcoal)" }}>
                {initials(form.student_name)}
              </div>
          }
          {photoLoading && (
            <div style={{ position: "absolute", inset: 0, borderRadius: 12, background: "rgba(255,255,255,0.8)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div className="yd-spinner" style={{ width: 16, height: 16 }} />
            </div>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <Button type="button" size="xs" variant="outline" leftIcon={<Camera size={12} strokeWidth={2} />} onClick={() => photoRef.current?.click()} style={{ marginBottom: 8 }}>
            {photoPreview ? "Change Photo" : "Upload Photo"}
          </Button>
          <input ref={photoRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handlePhoto} />
          <div style={{ display: "flex", gap: 4 }}>
            {[{ k: "basic", label: "Basic Info" }, { k: "parents", label: "Parents" }].map(t => (
              <Button key={t.k} type="button" size="xs" variant={tab === t.k ? "primary" : "ghost"} onClick={() => setTab(t.k)}>
                {t.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {tab === "basic" && (
          <FormGrid cols={1} style={{ gap: 12 }}>
            <Field label="Full Name" required error={errors.student_name}>
              <Input value={form.student_name} onChange={e => set("student_name", e.target.value)} placeholder="Student's full name" />
            </Field>
            <FormGrid cols={2}>
              <Field label="Date of Birth">
                <Input type="date" value={form.dob} onChange={e => set("dob", e.target.value)} />
              </Field>
              <Field label="Joining Date">
                <Input type="date" value={form.join_date} onChange={e => set("join_date", e.target.value)} />
              </Field>
            </FormGrid>
            <FormGrid cols={2}>
              <Field label="Class" required error={errors.class}>
                <Select value={form.class} onChange={e => set("class", e.target.value)} placeholder="Select class…" options={CLASSES} />
              </Field>
              <Field label="Gender" required error={errors.gender}>
                <Select value={form.gender} onChange={e => set("gender", e.target.value)} placeholder="Select…" options={GENDERS} />
              </Field>
            </FormGrid>
            <FormGrid cols={2}>
              <Field label="Center">
                <Select value={form.center} onChange={e => set("center", e.target.value)} placeholder="Select center…" options={CENTERS} />
              </Field>
              {isEdit && (
                <Field label="Status">
                  <Select value={form.status} onChange={e => set("status", e.target.value)} options={STATUSES} />
                </Field>
              )}
            </FormGrid>
          </FormGrid>
        )}

        {tab === "parents" && (
          <FormGrid cols={1} style={{ gap: 12 }}>
            {[
              { role: "Father", prefix: "father" },
              { role: "Mother", prefix: "mother" },
            ].map(({ role, prefix }) => (
              <div key={role}>
                <p style={{ fontSize: 10, fontWeight: 800, color: "var(--yd-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{role}</p>
                <Field label="Name">
                  <Input value={form[`${prefix}_name`]} onChange={e => set(`${prefix}_name`, e.target.value)} placeholder={`${role}'s full name`} />
                </Field>
                <FormGrid cols={2} style={{ marginTop: 8 }}>
                  <Field label="WhatsApp" error={errors[`${prefix}_whatsapp`]}>
                    <Input value={form[`${prefix}_whatsapp`]} onChange={e => set(`${prefix}_whatsapp`, e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10 digits" />
                  </Field>
                  <Field label="Email">
                    <Input type="email" value={form[`${prefix}_email`]} onChange={e => set(`${prefix}_email`, e.target.value)} placeholder="email" />
                  </Field>
                </FormGrid>
              </div>
            ))}
          </FormGrid>
        )}
      </form>
    </Modal>
  );
}
