/**
 * StaffDepartments.jsx — Departments management
 * ───────────────────────────────────────────────
 * Simple CRUD list. Each row: name · description · sort · active toggle · actions.
 * Create / edit happens in a slide-in modal.
 */

import { useCallback, useEffect, useState } from "react";
import departmentService from "../../services/departmentService";

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
  goldLight:   "rgba(244,196,0,0.10)",
  green:       "#059669",
  red:         "#DC2626",
  redLight:    "rgba(220,38,38,0.09)",
};

const EMPTY = { name: "", description: "", sortOrder: 0, active: true };

export default function StaffDepartments() {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [modal, setModal]     = useState(null); // null | { mode: "create"|"edit", data }
  const [saving, setSaving]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await departmentService.getAll();
      if (res?.success) setRows(res.departments || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to load.");
    } finally { setLoading(false); }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  function openCreate() { setModal({ mode: "create", data: { ...EMPTY } }); }
  function openEdit(d)  { setModal({ mode: "edit",   data: { ...d } }); }
  function closeModal() { setModal(null); }

  async function handleSave() {
    setSaving(true); setError("");
    try {
      if (modal.mode === "create") await departmentService.create(modal.data);
      else                         await departmentService.update(modal.data.deptId, modal.data);
      closeModal();
      await load();
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Save failed.");
    } finally { setSaving(false); }
  }

  async function handleDelete(d) {
    if (!window.confirm(`Delete the "${d.name}" department?`)) return;
    try {
      await departmentService.remove(d.deptId);
      await load();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  }

  async function toggleActive(d) {
    try {
      await departmentService.update(d.deptId, { active: !d.active });
      await load();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  }

  return (
    <div style={{ background: T.bg, minHeight: "100%", padding: "24px 28px 48px" }}>
      <Header
        title="Departments"
        subtitle="Organisational units used to group staff."
        actionLabel="+ Add Department"
        onAction={openCreate}
      />

      {error && (
        <div style={{ background: T.redLight, color: T.red, border: `1px solid ${T.red}33`, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, boxShadow: T.shadow, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 720 }}>
            <thead style={{ background: T.surfaceWarm, borderBottom: `1px solid ${T.border}` }}>
              <tr>
                <Th>Name</Th>
                <Th>Description</Th>
                <Th>Sort</Th>
                <Th>Status</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} style={{ padding: 28, textAlign: "center", color: T.textMuted }}>Loading…</td></tr>}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 28, textAlign: "center", color: T.textMuted }}>
                  No departments yet. Create your first one with “Add Department”.
                </td></tr>
              )}
              {!loading && rows.map(d => (
                <tr key={d.deptId} style={{ borderBottom: `1px solid ${T.border}` }}>
                  <Td weight={600}>
                    {d.name}
                    {d.isSystem && (
                      <span style={{
                        marginLeft: 6, fontSize: 10, fontWeight: 600,
                        padding: "1px 6px", borderRadius: 4,
                        background: "#FFF7E0", border: "1px solid rgba(244,196,0,0.35)",
                        color: "#B45309", textTransform: "uppercase", letterSpacing: "0.05em",
                      }}>system</span>
                    )}
                  </Td>
                  <Td color={T.textSoft}>{d.description || "—"}</Td>
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
        <Modal title={modal.mode === "create" ? "Add Department" : "Edit Department"} onClose={closeModal}>
          <FormGrid>
            <Field label="Name *">
              <Input value={modal.data.name} onChange={(v) => setModal({ ...modal, data: { ...modal.data, name: v } })} />
            </Field>
            <Field label="Description" span={2}>
              <Input value={modal.data.description} onChange={(v) => setModal({ ...modal, data: { ...modal.data, description: v } })} />
            </Field>
            <Field label="Sort Order">
              <Input type="number" value={modal.data.sortOrder} onChange={(v) => setModal({ ...modal, data: { ...modal.data, sortOrder: Number(v) || 0 } })} />
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

// ── Shared atoms (mirrored in StaffDesignations) ───────────────────

function Header({ title, subtitle, actionLabel, onAction }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: T.goldMid }}>
          Staff Management
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: T.text, margin: "4px 0 0", letterSpacing: "-0.02em" }}>{title}</h1>
        {subtitle && <div style={{ fontSize: 13, color: T.textSoft, marginTop: 4 }}>{subtitle}</div>}
      </div>
      {actionLabel && (
        <button onClick={onAction} style={{ background: T.gold, color: "#1E1E1E", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 600, fontSize: 13, cursor: "pointer", boxShadow: T.shadow }}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function Th({ children, align }) {
  return <th style={{ textAlign: align || "left", padding: "10px 14px", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: T.textMuted }}>{children}</th>;
}
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

function Modal({ title, children, onClose }) {
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0,
      background: "rgba(20, 18, 12, 0.45)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 200,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 16,
        boxShadow: "0 24px 80px rgba(0,0,0,0.20)",
        width: "min(560px, calc(100vw - 32px))",
        maxHeight: "calc(100vh - 64px)",
        overflow: "auto",
        padding: 24,
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
        border: `1px solid ${T.border}`,
        borderRadius: 8,
        padding: "9px 12px",
        fontSize: 13,
        background: "#FFFFFF",
        outline: "none",
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
