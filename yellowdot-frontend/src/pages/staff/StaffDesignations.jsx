/**
 * StaffDesignations.jsx — Designations management
 * ─────────────────────────────────────────────────
 * Simple CRUD list keyed to optional department.
 */

import { useCallback, useEffect, useState } from "react";
import designationService from "../../services/designationService";
import departmentService  from "../../services/departmentService";
import { STAFF_ENUMS } from "../../services/staffService";

const T = {
  bg:          "#FFFDF7",
  surface:     "#FFFFFF",
  surfaceWarm: "#FDFAF5",
  border:      "rgba(0,0,0,0.08)",
  borderGold:  "rgba(244,196,0,0.35)",
  shadow:      "0 1px 4px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)",
  text:        "#2A2A2A",
  textMuted:   "#8C8880",
  textSoft:    "#6A6560",
  gold:        "#F4C400",
  goldMid:     "#B45309",
  green:       "#059669",
  red:         "#DC2626",
  redLight:    "rgba(220,38,38,0.09)",
};

const EMPTY = {
  name: "", description: "", level: "",
  departmentId: "", departmentName: "",
  category: "non_teaching",
  sortOrder: 0, active: true,
};

export default function StaffDesignations() {
  const [rows, setRows]         = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [modal, setModal]       = useState(null);
  const [saving, setSaving]     = useState(false);
  const [deptFilter, setDeptFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [g, d] = await Promise.all([
        designationService.getAll(),
        departmentService.getAll(),
      ]);
      if (g?.success) setRows(g.designations || []);
      if (d?.success) setDepartments(d.departments || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to load.");
    } finally { setLoading(false); }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const filtered = deptFilter ? rows.filter(r => r.departmentId === deptFilter) : rows;

  function openCreate() { setModal({ mode: "create", data: { ...EMPTY } }); }
  function openEdit(d)  { setModal({ mode: "edit",   data: { ...d } }); }
  function closeModal() { setModal(null); }

  function selectDept(deptId) {
    const d = departments.find(x => x.deptId === deptId);
    setModal(m => ({ ...m, data: { ...m.data, departmentId: deptId, departmentName: d?.name || "" } }));
  }

  async function handleSave() {
    setSaving(true); setError("");
    try {
      if (modal.mode === "create") await designationService.create(modal.data);
      else                         await designationService.update(modal.data.designationId, modal.data);
      closeModal();
      await load();
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Save failed.");
    } finally { setSaving(false); }
  }

  async function handleDelete(d) {
    if (!window.confirm(`Delete designation "${d.name}"?`)) return;
    try {
      await designationService.remove(d.designationId);
      await load();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  }

  async function toggleActive(d) {
    try {
      await designationService.update(d.designationId, { active: !d.active });
      await load();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  }

  return (
    <div style={{ background: T.bg, minHeight: "100%", padding: "24px 28px 48px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: T.goldMid }}>
            Staff Management
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: T.text, margin: "4px 0 0", letterSpacing: "-0.02em" }}>Designations</h1>
          <div style={{ fontSize: 13, color: T.textSoft, marginTop: 4 }}>Job titles and levels assignable to staff.</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} style={{
            border: `1px solid ${T.border}`, borderRadius: 10,
            padding: "9px 12px", fontSize: 13, background: "#FDFAF5",
          }}>
            <option value="">All departments</option>
            {departments.map(d => <option key={d.deptId} value={d.deptId}>{d.name}</option>)}
          </select>
          <button onClick={openCreate} style={{ background: T.gold, color: "#1E1E1E", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 600, fontSize: 13, cursor: "pointer", boxShadow: T.shadow }}>
            + Add Designation
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: T.redLight, color: T.red, border: `1px solid ${T.red}33`, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, boxShadow: T.shadow, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 760 }}>
            <thead style={{ background: T.surfaceWarm, borderBottom: `1px solid ${T.border}` }}>
              <tr>
                <Th>Name</Th>
                <Th>Department</Th>
                <Th>Category</Th>
                <Th>Level</Th>
                <Th>Sort</Th>
                <Th>Status</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} style={{ padding: 28, textAlign: "center", color: T.textMuted }}>Loading…</td></tr>}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 28, textAlign: "center", color: T.textMuted }}>
                  No designations match this filter.
                </td></tr>
              )}
              {!loading && filtered.map(d => (
                <tr key={d.designationId} style={{ borderBottom: `1px solid ${T.border}` }}>
                  <Td weight={600}>
                    {d.name}
                    {d.isSystem && <span style={systemTagStyle}>system</span>}
                  </Td>
                  <Td color={T.textSoft}>{d.departmentName || "—"}</Td>
                  <Td color={T.textSoft}>{labelForCategory(d.category)}</Td>
                  <Td color={T.textSoft}>{d.level || "—"}</Td>
                  <Td>{d.sortOrder}</Td>
                  <Td>
                    <button onClick={() => toggleActive(d)} style={pillStyle(d.active)}>
                      {d.active ? "Active" : "Inactive"}
                    </button>
                  </Td>
                  <Td align="right">
                    <button onClick={() => openEdit(d)} style={miniBtn()}>Edit</button>
                    {!d.isSystem && (
                      <button onClick={() => handleDelete(d)} style={{ ...miniBtn(), color: T.red, borderColor: `${T.red}55` }}>Delete</button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <Modal title={modal.mode === "create" ? "Add Designation" : "Edit Designation"} onClose={closeModal}>
          <FormGrid>
            <Field label="Name *">
              <Input value={modal.data.name} onChange={(v) => setModal({ ...modal, data: { ...modal.data, name: v } })} />
            </Field>
            <Field label="Department">
              <select
                value={modal.data.departmentId}
                onChange={(e) => selectDept(e.target.value)}
                style={selectStyle}
              >
                <option value="">— None —</option>
                {departments.map(d => <option key={d.deptId} value={d.deptId}>{d.name}</option>)}
              </select>
            </Field>
            <Field label="Category *">
              <select
                value={modal.data.category}
                onChange={(e) => setModal({ ...modal, data: { ...modal.data, category: e.target.value } })}
                style={selectStyle}
              >
                {STAFF_ENUMS.categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </Field>
            <Field label="Level">
              <Input value={modal.data.level} onChange={(v) => setModal({ ...modal, data: { ...modal.data, level: v } })} placeholder="Junior / Senior / Lead" />
            </Field>
            <Field label="Sort Order">
              <Input type="number" value={modal.data.sortOrder} onChange={(v) => setModal({ ...modal, data: { ...modal.data, sortOrder: Number(v) || 0 } })} />
            </Field>
            <Field label="Description" span={2}>
              <Input value={modal.data.description} onChange={(v) => setModal({ ...modal, data: { ...modal.data, description: v } })} />
            </Field>
            <Field label="Status">
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={modal.data.active} onChange={(e) => setModal({ ...modal, data: { ...modal.data, active: e.target.checked } })} />
                Active
              </label>
            </Field>
          </FormGrid>
          <ModalActions onCancel={closeModal} onSave={handleSave} saving={saving} />
        </Modal>
      )}
    </div>
  );
}

// ── Shared atoms ──────────────────────────────────────────────────

function Th({ children, align }) {
  return <th style={{ textAlign: align || "left", padding: "10px 14px", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: T.textMuted }}>{children}</th>;
}
function labelForCategory(id) {
  return STAFF_ENUMS.categories.find(c => c.value === id)?.label || "—";
}
const systemTagStyle = {
  marginLeft: 6, fontSize: 10, fontWeight: 600,
  padding: "1px 6px", borderRadius: 4,
  background: "#FFF7E0", border: "1px solid rgba(244,196,0,0.35)",
  color: "#B45309", textTransform: "uppercase", letterSpacing: "0.05em",
};
function Td({ children, align, weight, color }) {
  return <td style={{ textAlign: align || "left", padding: "12px 14px", fontSize: 13, fontWeight: weight, color: color || T.text }}>{children}</td>;
}
function pillStyle(active) {
  return {
    background:  active ? "#f0fdf4" : T.surfaceWarm,
    color:       active ? T.green   : T.textMuted,
    border:      `1px solid ${active ? "#bbf7d0" : T.border}`,
    borderRadius:999,
    padding:     "3px 10px",
    fontSize:    11,
    fontWeight:  600,
    cursor:      "pointer",
  };
}
function miniBtn() {
  return {
    background: T.surface,
    color: T.text,
    border: `1px solid ${T.border}`,
    borderRadius: 8,
    padding: "5px 12px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    marginLeft: 6,
  };
}
const selectStyle = {
  border: `1px solid ${T.border}`,
  borderRadius: 8,
  padding: "9px 12px",
  fontSize: 13,
  background: "#FFFFFF",
  outline: "none",
  cursor: "pointer",
};

function Modal({ title, children, onClose }) {
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0,
      background: "rgba(20, 18, 12, 0.45)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 200,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: 16, boxShadow: "0 24px 80px rgba(0,0,0,0.20)",
        width: "min(560px, calc(100vw - 32px))",
        maxHeight: "calc(100vh - 64px)",
        overflow: "auto", padding: 24,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: T.text }}>{title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: T.textMuted, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
function FormGrid({ children }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>{children}</div>;
}
function Field({ label, span = 1, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: `span ${span}` }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: T.textSoft }}>{label}</span>
      {children}
    </label>
  );
}
function Input({ type = "text", value, onChange, placeholder }) {
  return (
    <input
      type={type}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        border: `1px solid ${T.border}`, borderRadius: 8,
        padding: "9px 12px", fontSize: 13, background: "#FFFFFF", outline: "none",
      }}
    />
  );
}
function ModalActions({ onCancel, onSave, saving }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
      <button onClick={onCancel} disabled={saving} style={{ background: T.surface, color: T.text, border: `1px solid ${T.border}`, borderRadius: 10, padding: "9px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
      <button onClick={onSave} disabled={saving} style={{ background: T.gold, color: "#1E1E1E", border: "none", borderRadius: 10, padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}>
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
