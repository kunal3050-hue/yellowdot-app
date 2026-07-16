/**
 * MedicalTab — same API contract as the original (/api/student-medical/:id),
 * rebuilt as clean cards with critical info (allergies, blood group,
 * emergency notes) visually prominent per the Phase 2.2 spec.
 */
import { useState, useEffect, useRef } from "react";
import { TriangleAlert, Droplet, Pill, Phone } from "lucide-react";
import { Card, Field, Input, Select, Button, Skeleton } from "../../../components/ui";
import { get, put } from "../shared";

const BLOOD_GROUPS = ["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"];

export default function MedicalTab({ student, toast }) {
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving,  setSaving ] = useState(false);
  const [form,    setForm   ] = useState({ bloodGroup: "", allergies: "", medications: "", doctorName: "", doctorPhone: "", emergencyNotes: "", notes: "" });
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    get(`/api/student-medical/${encodeURIComponent(student.Student_ID)}`)
      .then(d => {
        if (!mountedRef.current) return;
        const e = d.entry;
        if (e) setForm({ bloodGroup: e.bloodGroup || "", allergies: e.allergies || "", medications: e.medications || "", doctorName: e.doctorName || "", doctorPhone: e.doctorPhone || "", emergencyNotes: e.emergencyNotes || "", notes: e.notes || "" });
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
      if (r.success) { toast.success("Medical info saved."); setEditing(false); }
      else toast.error(r.error || "Failed.");
    } catch { toast.error("Error saving."); }
    finally { if (mountedRef.current) setSaving(false); }
  }

  if (loading) {
    return (
      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={48} />)}
      </div>
    );
  }

  return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ fontSize: 13, fontWeight: 800, color: "var(--yd-charcoal)" }}>Medical Information</h3>
        {!editing ? (
          <Button size="xs" variant="outline" onClick={() => setEditing(true)}>Edit</Button>
        ) : (
          <div style={{ display: "flex", gap: 6 }}>
            <Button size="xs" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            <Button size="xs" variant="success" onClick={save} loading={saving}>Save</Button>
          </div>
        )}
      </div>

      {/* Critical info banner */}
      {form.allergies && !editing && (
        <Card padding="12px 16px" style={{ background: "var(--yd-danger-soft)", border: "1px solid var(--yd-danger-border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <TriangleAlert size={20} strokeWidth={2} color="var(--yd-danger)" />
            <div>
              <p style={{ fontSize: 12, fontWeight: 800, color: "var(--yd-danger)" }}>Allergy Alert</p>
              <p style={{ fontSize: 12, color: "var(--yd-danger)", marginTop: 1 }}>{form.allergies}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Critical fields row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
        <Card padding="12px 14px">
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <Droplet size={13} strokeWidth={2} color="var(--yd-danger)" />
            <span style={{ fontSize: 9, fontWeight: 800, color: "var(--yd-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Blood Group</span>
          </div>
          {editing ? (
            <Select value={form.bloodGroup} onChange={e => sf("bloodGroup", e.target.value)} options={BLOOD_GROUPS.filter(Boolean)} placeholder="Select…" />
          ) : (
            <p style={{ fontSize: 15, fontWeight: 800, color: "var(--yd-charcoal)" }}>{form.bloodGroup || "—"}</p>
          )}
        </Card>
        <Card padding="12px 14px">
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <Pill size={13} strokeWidth={2} color="var(--yd-warning)" />
            <span style={{ fontSize: 9, fontWeight: 800, color: "var(--yd-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Medications</span>
          </div>
          {editing ? (
            <Input value={form.medications} onChange={e => sf("medications", e.target.value)} placeholder="Current medications" />
          ) : (
            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--yd-charcoal)" }}>{form.medications || "—"}</p>
          )}
        </Card>
        <Card padding="12px 14px">
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <Phone size={13} strokeWidth={2} color="var(--yd-info)" />
            <span style={{ fontSize: 9, fontWeight: 800, color: "var(--yd-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Doctor</span>
          </div>
          {editing ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <Input value={form.doctorName} onChange={e => sf("doctorName", e.target.value)} placeholder="Dr. Name" />
              <Input value={form.doctorPhone} onChange={e => sf("doctorPhone", e.target.value)} placeholder="Phone" />
            </div>
          ) : (
            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--yd-charcoal)" }}>{form.doctorName || "—"}{form.doctorPhone ? ` · ${form.doctorPhone}` : ""}</p>
          )}
        </Card>
      </div>

      {editing && (
        <Field label="Allergies">
          <Input value={form.allergies} onChange={e => sf("allergies", e.target.value)} placeholder="e.g. peanuts, dust…" />
        </Field>
      )}

      {[
        { label: "Emergency Notes", key: "emergencyNotes", placeholder: "Important for emergencies…" },
        { label: "Additional Notes", key: "notes", placeholder: "Any other info…" },
      ].map(f => (
        <Card key={f.key} padding="12px 16px">
          <p style={{ fontSize: 9, fontWeight: 800, color: "var(--yd-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{f.label}</p>
          {editing ? (
            <textarea value={form[f.key]} onChange={e => sf(f.key, e.target.value)} rows={2} placeholder={f.placeholder} className="yd-input" style={{ width: "100%", resize: "none" }} />
          ) : (
            <p style={{ fontSize: 12, fontWeight: 500, color: "var(--yd-charcoal)" }}>{form[f.key] || <span style={{ color: "var(--yd-text-muted)", fontStyle: "italic" }}>—</span>}</p>
          )}
        </Card>
      ))}
    </div>
  );
}
