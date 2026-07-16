/**
 * ParentsTab — same edit/save contract as the original (PUT /update-student/:id),
 * rebuilt on Card/Field/Input for visual consistency.
 */
import { useState } from "react";
import { Card, Field, Input, Button } from "../../../components/ui";
import { put } from "../shared";

export default function ParentsTab({ student, onSaved, toast }) {
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
    { role: "Father", fields: [
      { label: "Name",     key: "father_name" },
      { label: "WhatsApp", key: "father_whatsapp", type: "tel" },
      { label: "Email",    key: "father_email",    type: "email" },
    ]},
    { role: "Mother", fields: [
      { label: "Name",     key: "mother_name" },
      { label: "WhatsApp", key: "mother_whatsapp", type: "tel" },
      { label: "Email",    key: "mother_email",    type: "email" },
    ]},
  ];

  return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ fontSize: 13, fontWeight: 800, color: "var(--yd-charcoal)" }}>Parent &amp; Guardian Details</h3>
        {!editing ? (
          <Button size="xs" variant="outline" onClick={() => setEditing(true)}>Edit</Button>
        ) : (
          <div style={{ display: "flex", gap: 6 }}>
            <Button size="xs" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            <Button size="xs" variant="success" onClick={save} loading={saving}>Save</Button>
          </div>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
        {sections.map(({ role, fields }) => (
          <Card key={role} padding="14px 16px">
            <h4 style={{ fontSize: 12, fontWeight: 800, color: "var(--yd-charcoal)", marginBottom: 10 }}>{role}</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {fields.map(f => (
                <Field key={f.key} label={f.label}>
                  {editing ? (
                    <Input type={f.type || "text"} value={form[f.key]} onChange={e => sf(f.key, e.target.value)} placeholder={f.label} />
                  ) : (
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--yd-charcoal)" }}>
                      {form[f.key] || <span style={{ color: "var(--yd-text-muted)", fontStyle: "italic" }}>—</span>}
                    </span>
                  )}
                </Field>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
