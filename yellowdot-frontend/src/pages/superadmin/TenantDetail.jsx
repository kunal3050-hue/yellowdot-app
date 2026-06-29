import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { tenantService } from "../../services/tenantService";

const STATUS_COLORS = {
  active:    { bg: "#DCFCE7", text: "#15803D" },
  trial:     { bg: "#FEF9C3", text: "#A16207" },
  suspended: { bg: "#FEE2E2", text: "#DC2626" },
  cancelled: { bg: "#F3F4F6", text: "#6B7280" },
};

export default function TenantDetail() {
  const { tenantId } = useParams();
  const navigate = useNavigate();

  const [tenant, setTenant]   = useState(null);
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState("overview");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState(null);

  // Branch form
  const [newBranch, setNewBranch] = useState({ name: "", address: "", phone: "" });
  const [addingBranch, setAddingBranch] = useState(false);

  // Academic year form
  const [newYear, setNewYear] = useState({ label: "", startDate: "", endDate: "", current: false });
  const [addingYear, setAddingYear] = useState(false);

  useEffect(() => {
    load();
    loadLogs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  async function load() {
    setLoading(true);
    try {
      const t = await tenantService.get(tenantId);
      setTenant(t);
      setEditForm({
        schoolName:       t.schoolName,
        contactEmail:     t.contactEmail,
        contactPhone:     t.contactPhone,
        address:          t.address,
        city:             t.city,
        subscriptionPlan: t.subscriptionPlan,
        maxStudents:      t.maxStudents,
        maxStaff:         t.maxStaff,
        logo:             t.logo,
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadLogs() {
    try {
      const { logs: l } = await tenantService.auditLogs(tenantId, 30);
      setLogs(l || []);
    } catch { /* non-critical */ }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await tenantService.update(tenantId, editForm);
      await load();
      setEditing(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleStatus(status) {
    const reason = status === "suspended" ? window.prompt("Reason (optional):") : undefined;
    try {
      await tenantService.setStatus(tenantId, status, reason);
      await load();
    } catch (e) {
      alert(e.message);
    }
  }

  async function handleImpersonate() {
    if (!window.confirm(`Impersonate admin of "${tenant.schoolName}"? This will be audit-logged.`)) return;
    try {
      const { customToken } = await tenantService.impersonate(tenantId);
      const url = `/impersonate?token=${encodeURIComponent(customToken)}&tenantId=${tenantId}`;
      window.open(url, "_blank");
    } catch (e) {
      alert(e.message);
    }
  }

  async function handleAddBranch(e) {
    e.preventDefault();
    setAddingBranch(true);
    try {
      await tenantService.addBranch(tenantId, newBranch);
      setNewBranch({ name: "", address: "", phone: "" });
      await load();
    } catch (e) {
      alert(e.message);
    } finally {
      setAddingBranch(false);
    }
  }

  async function handleRemoveBranch(branchId) {
    if (!window.confirm("Remove this branch?")) return;
    try {
      await tenantService.removeBranch(tenantId, branchId);
      await load();
    } catch (e) {
      alert(e.message);
    }
  }

  async function handleAddYear(e) {
    e.preventDefault();
    setAddingYear(true);
    try {
      await tenantService.upsertAcademicYear(tenantId, newYear);
      setNewYear({ label: "", startDate: "", endDate: "", current: false });
      await load();
    } catch (e) {
      alert(e.message);
    } finally {
      setAddingYear(false);
    }
  }

  if (loading) return <div style={{ padding: 60, textAlign: "center", color: "#A8906A" }}>Loading…</div>;

  if (error && !tenant) return (
    <div style={{ padding: 40 }}>
      <div style={{ color: "#DC2626" }}>{error}</div>
      <button onClick={() => navigate(-1)} style={{ marginTop: 12, background: "none", border: "none", cursor: "pointer", color: "#78716C" }}>← Back</button>
    </div>
  );

  const statusColors = STATUS_COLORS[tenant.status] || STATUS_COLORS.cancelled;

  return (
    <div style={{ padding: "28px 32px", maxWidth: 900, margin: "0 auto" }}>
      {/* Back */}
      <button onClick={() => navigate("/super-admin/tenants")}
        style={{ background: "none", border: "none", color: "#78716C", cursor: "pointer", fontSize: 14, marginBottom: 18 }}>
        ← All Preschools
      </button>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1C1917", margin: 0 }}>{tenant.schoolName}</h1>
            <span style={{ background: statusColors.bg, color: statusColors.text, padding: "3px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, textTransform: "capitalize" }}>
              {tenant.status}
            </span>
          </div>
          <div style={{ color: "#78716C", fontSize: 13, marginTop: 4, fontFamily: "monospace" }}>{tenant.tenantId}</div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <Btn label="Impersonate" onClick={handleImpersonate} color="#1D4ED8" bg="#DBEAFE" />
          {tenant.status !== "active" && <Btn label="Activate" onClick={() => handleStatus("active")} color="#15803D" bg="#DCFCE7" />}
          {tenant.status === "active" && <Btn label="Suspend" onClick={() => handleStatus("suspended")} color="#DC2626" bg="#FEE2E2" />}
        </div>
      </div>

      {error && (
        <div style={{ background: "#FEF2F2", color: "#DC2626", padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 14 }}>{error}</div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: "2px solid #F5F0E8", marginBottom: 24 }}>
        {["overview", "branches", "academic years", "audit log"].map(t => (
          <button key={t}
            onClick={() => setTab(t)}
            style={{
              background: "none", border: "none", padding: "8px 16px",
              fontWeight: 600, fontSize: 13, cursor: "pointer",
              color: tab === t ? "#1C1917" : "#A8906A",
              borderBottom: tab === t ? "2px solid #F5C518" : "2px solid transparent",
              marginBottom: -2, textTransform: "capitalize",
            }}
          >{t}</button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === "overview" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
            {editing ? (
              <div style={{ display: "flex", gap: 8 }}>
                <Btn label={saving ? "Saving…" : "Save"} onClick={handleSave} color="#15803D" bg="#DCFCE7" />
                <Btn label="Cancel" onClick={() => setEditing(false)} color="#78716C" bg="#F5F0E8" />
              </div>
            ) : (
              <Btn label="Edit" onClick={() => setEditing(true)} color="#78716C" bg="#F5F0E8" />
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <InfoCard label="School Name">
              {editing
                ? <Input value={editForm.schoolName} onChange={v => setEditForm(f => ({ ...f, schoolName: v }))} />
                : tenant.schoolName}
            </InfoCard>
            <InfoCard label="Subscription Plan">
              {editing
                ? (
                  <select value={editForm.subscriptionPlan} onChange={e => setEditForm(f => ({ ...f, subscriptionPlan: e.target.value }))} style={iStyle}>
                    {["trial", "starter", "professional", "enterprise"].map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                )
                : tenant.subscriptionPlan}
            </InfoCard>
            <InfoCard label="Contact Email">
              {editing
                ? <Input value={editForm.contactEmail} onChange={v => setEditForm(f => ({ ...f, contactEmail: v }))} />
                : tenant.contactEmail || "—"}
            </InfoCard>
            <InfoCard label="Contact Phone">
              {editing
                ? <Input value={editForm.contactPhone} onChange={v => setEditForm(f => ({ ...f, contactPhone: v }))} />
                : tenant.contactPhone || "—"}
            </InfoCard>
            <InfoCard label="City">
              {editing
                ? <Input value={editForm.city} onChange={v => setEditForm(f => ({ ...f, city: v }))} />
                : tenant.city || "—"}
            </InfoCard>
            <InfoCard label="Country">{tenant.country}</InfoCard>
            <InfoCard label="Timezone">{tenant.timezone}</InfoCard>
            <InfoCard label="Currency">{tenant.currency}</InfoCard>
            <InfoCard label="Max Students">
              {editing
                ? <Input type="number" value={editForm.maxStudents} onChange={v => setEditForm(f => ({ ...f, maxStudents: parseInt(v) || 0 }))} />
                : tenant.maxStudents === 0 ? "Unlimited" : tenant.maxStudents}
            </InfoCard>
            <InfoCard label="Max Staff">
              {editing
                ? <Input type="number" value={editForm.maxStaff} onChange={v => setEditForm(f => ({ ...f, maxStaff: parseInt(v) || 0 }))} />
                : tenant.maxStaff === 0 ? "Unlimited" : tenant.maxStaff}
            </InfoCard>
            <InfoCard label="Created">{tenant.createdAt ? new Date(tenant.createdAt).toLocaleDateString() : "—"}</InfoCard>
            <InfoCard label="Trial Ends">{tenant.trialEndsAt ? new Date(tenant.trialEndsAt).toLocaleDateString() : "—"}</InfoCard>
          </div>
        </div>
      )}

      {/* Branches tab */}
      {tab === "branches" && (
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#57534E", marginBottom: 16 }}>Branches ({(tenant.branches || []).length})</h3>

          {(tenant.branches || []).length === 0 ? (
            <div style={{ color: "#A8906A", fontSize: 14, marginBottom: 24 }}>No branches yet.</div>
          ) : (
            <div style={{ marginBottom: 24 }}>
              {(tenant.branches || []).map(b => (
                <div key={b.branchId} style={{ border: "1.5px solid #F5F0E8", borderRadius: 8, padding: "12px 16px", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600, color: "#1C1917" }}>{b.name}</div>
                    <div style={{ fontSize: 12, color: "#78716C", marginTop: 2 }}>{b.address || "No address"}</div>
                  </div>
                  <Btn label="Remove" onClick={() => handleRemoveBranch(b.branchId)} color="#DC2626" bg="#FEE2E2" />
                </div>
              ))}
            </div>
          )}

          <h3 style={{ fontSize: 13, fontWeight: 700, color: "#A8906A", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Add Branch</h3>
          <form onSubmit={handleAddBranch} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input required placeholder="Branch name *" value={newBranch.name} onChange={e => setNewBranch(f => ({ ...f, name: e.target.value }))} style={{ ...iStyle, flex: 1, minWidth: 180 }} />
            <input placeholder="Address" value={newBranch.address} onChange={e => setNewBranch(f => ({ ...f, address: e.target.value }))} style={{ ...iStyle, flex: 2, minWidth: 200 }} />
            <button type="submit" disabled={addingBranch} style={{ background: "#F5C518", color: "#1C1917", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
              {addingBranch ? "Adding…" : "Add"}
            </button>
          </form>
        </div>
      )}

      {/* Academic Years tab */}
      {tab === "academic years" && (
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#57534E", marginBottom: 16 }}>Academic Years ({(tenant.academicYears || []).length})</h3>

          {(tenant.academicYears || []).map(y => (
            <div key={y.yearId} style={{ border: "1.5px solid #F5F0E8", borderRadius: 8, padding: "12px 16px", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600, color: "#1C1917", display: "flex", alignItems: "center", gap: 8 }}>
                  {y.label}
                  {y.current && <span style={{ background: "#FEF9C3", color: "#A16207", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10 }}>Current</span>}
                </div>
                <div style={{ fontSize: 12, color: "#78716C", marginTop: 2 }}>{y.startDate} → {y.endDate}</div>
              </div>
            </div>
          ))}

          <h3 style={{ fontSize: 13, fontWeight: 700, color: "#A8906A", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12, marginTop: 24 }}>Add / Update Year</h3>
          <form onSubmit={handleAddYear} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#57534E", display: "block", marginBottom: 4 }}>Label</label>
              <input required placeholder="2025–26" value={newYear.label} onChange={e => setNewYear(f => ({ ...f, label: e.target.value }))} style={{ ...iStyle, width: 120 }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#57534E", display: "block", marginBottom: 4 }}>Start Date</label>
              <input type="date" required value={newYear.startDate} onChange={e => setNewYear(f => ({ ...f, startDate: e.target.value }))} style={iStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#57534E", display: "block", marginBottom: 4 }}>End Date</label>
              <input type="date" required value={newYear.endDate} onChange={e => setNewYear(f => ({ ...f, endDate: e.target.value }))} style={iStyle} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="checkbox" id="current-year" checked={newYear.current} onChange={e => setNewYear(f => ({ ...f, current: e.target.checked }))} />
              <label htmlFor="current-year" style={{ fontSize: 13, fontWeight: 600, color: "#57534E" }}>Current</label>
            </div>
            <button type="submit" disabled={addingYear} style={{ background: "#F5C518", color: "#1C1917", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
              {addingYear ? "Saving…" : "Save Year"}
            </button>
          </form>
        </div>
      )}

      {/* Audit Log tab */}
      {tab === "audit log" && (
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#57534E", marginBottom: 16 }}>Audit Log (last 30)</h3>
          {logs.length === 0 ? (
            <div style={{ color: "#A8906A", fontSize: 14 }}>No audit entries.</div>
          ) : (
            <div style={{ border: "1.5px solid #F5F0E8", borderRadius: 10, overflow: "hidden" }}>
              {logs.map((l, i) => (
                <div key={l.id} style={{
                  padding: "12px 16px",
                  borderBottom: i < logs.length - 1 ? "1px solid #F5F0E8" : "none",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <div>
                    <div style={{ fontWeight: 600, color: "#1C1917", fontSize: 13 }}>{l.action}</div>
                    <div style={{ fontSize: 12, color: "#78716C", marginTop: 2 }}>by {l.actorEmail || l.actorUserId}</div>
                  </div>
                  <div style={{ fontSize: 12, color: "#A8906A" }}>
                    {l.createdAt ? new Date(l.createdAt).toLocaleString() : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InfoCard({ label, children }) {
  return (
    <div style={{ background: "#FAFAF9", border: "1.5px solid #F5F0E8", borderRadius: 8, padding: "14px 16px" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#A8906A", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 14, color: "#1C1917", fontWeight: 500 }}>{children}</div>
    </div>
  );
}

function Btn({ label, onClick, color, bg }) {
  return (
    <button onClick={onClick} style={{ background: bg, color, border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
      {label}
    </button>
  );
}

function Input({ value, onChange, type = "text" }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      style={iStyle}
    />
  );
}

const iStyle = {
  padding: "8px 12px",
  border: "1.5px solid #E7E2D9",
  borderRadius: 8,
  fontSize: 14,
  outline: "none",
  background: "#FFF",
  width: "100%",
  boxSizing: "border-box",
};
