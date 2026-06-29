import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { tenantService } from "../../services/tenantService";

const PLANS = ["trial", "starter", "professional", "enterprise"];

export default function TenantCreate() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);

  const [form, setForm] = useState({
    schoolName:       "",
    tenantId:         "",
    subscriptionPlan: "trial",
    contactEmail:     "",
    contactPhone:     "",
    address:          "",
    city:             "",
    country:          "India",
    timezone:         "Asia/Kolkata",
    currency:         "INR",
    maxStudents:      0,
    maxStaff:         0,
  });

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const tenant = await tenantService.create(form);
      navigate(`/super-admin/tenants/${tenant.tenantId}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: "28px 32px", maxWidth: 700, margin: "0 auto" }}>
      <button
        onClick={() => navigate(-1)}
        style={{ background: "none", border: "none", color: "#78716C", cursor: "pointer", fontSize: 14, marginBottom: 16 }}
      >
        ← Back
      </button>

      <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1C1917", margin: "0 0 6px" }}>New Preschool</h1>
      <p style={{ color: "#78716C", margin: "0 0 28px", fontSize: 14 }}>
        Onboard a new preschool onto the platform.
      </p>

      {error && (
        <div style={{ background: "#FEF2F2", color: "#DC2626", padding: 14, borderRadius: 8, marginBottom: 20, fontSize: 14 }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <Section title="School Details">
          <Field label="School Name *">
            <input required value={form.schoolName} onChange={e => set("schoolName", e.target.value)} {...inputStyle} placeholder="Sunrise Preschool" />
          </Field>
          <Field label="Tenant ID" hint="Auto-generated from name if left blank. Use lowercase letters and hyphens only.">
            <input value={form.tenantId} onChange={e => set("tenantId", e.target.value)} {...inputStyle} placeholder="sunrise-preschool" />
          </Field>
          <Field label="Subscription Plan">
            <select value={form.subscriptionPlan} onChange={e => set("subscriptionPlan", e.target.value)} {...inputStyle}>
              {PLANS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select>
          </Field>
        </Section>

        <Section title="Contact">
          <Field label="Contact Email">
            <input type="email" value={form.contactEmail} onChange={e => set("contactEmail", e.target.value)} {...inputStyle} placeholder="admin@school.com" />
          </Field>
          <Field label="Contact Phone">
            <input value={form.contactPhone} onChange={e => set("contactPhone", e.target.value)} {...inputStyle} placeholder="+91 99999 00000" />
          </Field>
          <Field label="Address">
            <input value={form.address} onChange={e => set("address", e.target.value)} {...inputStyle} placeholder="123 Main Street" />
          </Field>
          <Field label="City">
            <input value={form.city} onChange={e => set("city", e.target.value)} {...inputStyle} placeholder="Mumbai" />
          </Field>
          <Field label="Country">
            <input value={form.country} onChange={e => set("country", e.target.value)} {...inputStyle} />
          </Field>
        </Section>

        <Section title="Limits (0 = unlimited)">
          <Field label="Max Students">
            <input type="number" min={0} value={form.maxStudents} onChange={e => set("maxStudents", parseInt(e.target.value) || 0)} {...inputStyle} />
          </Field>
          <Field label="Max Staff">
            <input type="number" min={0} value={form.maxStaff} onChange={e => set("maxStaff", parseInt(e.target.value) || 0)} {...inputStyle} />
          </Field>
        </Section>

        <div style={{ display: "flex", gap: 12, marginTop: 28 }}>
          <button
            type="submit"
            disabled={saving}
            style={{
              background: saving ? "#D4C5A0" : "#F5C518",
              color: "#1C1917", border: "none", borderRadius: 8,
              padding: "12px 28px", fontWeight: 700,
              cursor: saving ? "not-allowed" : "pointer", fontSize: 15,
            }}
          >
            {saving ? "Creating…" : "Create Preschool"}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              background: "#F5F0E8", color: "#78716C",
              border: "none", borderRadius: 8,
              padding: "12px 20px", fontWeight: 600,
              cursor: "pointer", fontSize: 15,
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: "#A8906A", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 14px" }}>{title}</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#57534E", marginBottom: 5 }}>{label}</label>
      {children}
      {hint && <p style={{ margin: "4px 0 0", fontSize: 12, color: "#A8906A" }}>{hint}</p>}
    </div>
  );
}

const inputStyle = {
  style: {
    width: "100%", padding: "9px 12px",
    border: "1.5px solid #E7E2D9", borderRadius: 8,
    fontSize: 14, outline: "none", boxSizing: "border-box",
    background: "#FAFAF9",
  },
};
