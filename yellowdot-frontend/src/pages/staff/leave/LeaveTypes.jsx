/**
 * LeaveTypes.jsx — Master CRUD for leave types
 * Design System v2 / Platform Layout Standard retrofit: PageShell +
 * PageHeader + DataTable + Modal/FormGrid/Field/Input/Select/Button/Badge.
 * Same leaveService calls/payloads.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import leaveService, { GENDER_RESTRICTIONS } from "../../../services/leaveService";
import { PageShell, PageHeader, DataTable, Badge, Modal, Button, Field, FormGrid, Input, Select } from "../../../components/ui";

const EMPTY = {
  code: "", name: "",
  annualEntitlement: 0,
  paid: true, carryForward: false, maxCarryForward: 0,
  gender: "any", requiresApproval: true,
  active: true, sortOrder: 0,
};

export default function LeaveTypes() {
  const [rows, setRows]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState("");
  const [modal, setModal]   = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const r = await leaveService.listTypes();
      if (r?.success) setRows(r.leaveTypes || []);
    } catch (err) { setError(err.response?.data?.error || err.message); }
    finally { setLoading(false); }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  function openCreate() { setModal({ mode: "create", data: { ...EMPTY } }); }
  function openEdit(d)  { setModal({ mode: "edit",   data: { ...d } }); }
  function close()      { setModal(null); }
  function patch(f)     { setModal(m => ({ ...m, data: { ...m.data, ...f } })); }

  async function save() {
    setSaving(true);
    try {
      if (modal.mode === "create") await leaveService.createType(modal.data);
      else                         await leaveService.updateType(modal.data.leaveTypeId, modal.data);
      close(); await load();
    } catch (err) { alert(err.response?.data?.error || err.message); }
    finally { setSaving(false); }
  }
  async function toggleActive(d) {
    try { await leaveService.updateType(d.leaveTypeId, { active: !d.active }); await load(); }
    catch (err) { alert(err.response?.data?.error || err.message); }
  }
  async function remove(d) {
    if (!window.confirm(`Delete leave type "${d.name}"?`)) return;
    try { await leaveService.removeType(d.leaveTypeId); await load(); }
    catch (err) { alert(err.response?.data?.error || err.message); }
  }

  const columns = useMemo(() => [
    { key: "code", label: "Code", width: 80, render: (v) => <span style={{ fontFamily: "ui-monospace, Cascadia Code, monospace", fontSize: 12 }}>{v || "—"}</span> },
    {
      key: "name", label: "Name", sortable: true, filterable: true, width: 180,
      render: (v, row) => <span style={{ fontWeight: 600 }}>{v}{row.isSystem && <span style={{ marginLeft: 6 }}><Badge variant="yellow">system</Badge></span>}</span>,
    },
    { key: "annualEntitlement", label: "Annual", width: 90, render: (v) => `${v}d` },
    { key: "paid", label: "Paid", width: 80, render: (v) => v ? "Yes" : <span style={{ color: "var(--yd-danger)" }}>No</span> },
    { key: "carryForward", label: "Carry-Fwd", width: 100, render: (v) => v ? "Yes" : "—" },
    { key: "maxCarryForward", label: "Max CF", width: 90, render: (v, row) => row.carryForward ? `${v}d` : "—" },
    { key: "gender", label: "Gender", width: 110, render: (v) => (GENDER_RESTRICTIONS.find(g => g.value === v) || {}).label || v },
    { key: "requiresApproval", label: "Approval", width: 100, render: (v) => v ? "Required" : "Auto" },
    {
      key: "active", label: "Status", width: 110,
      render: (v, row) => (
        <button type="button" onClick={() => toggleActive(row)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
          <Badge variant={v ? "success" : "neutral"} dot>{v ? "Active" : "Inactive"}</Badge>
        </button>
      ),
    },
    {
      key: "actions", label: "", type: "actions", width: 130, hideable: false,
      actions: (row) => (
        <div style={{ display: "flex", gap: 4 }}>
          <Button size="xs" variant="ghost" onClick={() => openEdit(row)}>Edit</Button>
          {!row.isSystem && <Button size="xs" variant="ghost" onClick={() => remove(row)}>Delete</Button>}
        </div>
      ),
    },
  ], []);

  return (
    <PageShell
      header={
        <PageHeader
          title="Leave Types"
          tag="Leave Management"
          subtitle="Master list of leave categories with annual entitlement, payment, and carry-forward rules."
          primaryAction={{ label: "Add Leave Type", icon: <Plus size={14} strokeWidth={2} />, onClick: openCreate }}
        />
      }
    >
      {error && (
        <div style={{ background: "var(--yd-danger-soft)", color: "var(--yd-danger)", border: "1px solid var(--yd-danger-border)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      <DataTable
        tableId="leave-types"
        columns={columns}
        data={rows}
        loading={loading}
        entityLabel="leave types"
        searchPlaceholder="Search leave types…"
        empty={{ title: "No leave types", description: "Defaults seed on first dashboard visit.", action: { label: "+ Add Leave Type", onClick: openCreate } }}
      />

      {modal && (
        <Modal
          isOpen
          onClose={close}
          title={modal.mode === "create" ? "Add Leave Type" : "Edit Leave Type"}
          footer={<><Button variant="outline" onClick={close} disabled={saving}>Cancel</Button><Button variant="primary" onClick={save} loading={saving}>Save</Button></>}
        >
          <FormGrid cols={2}>
            <Field label="Code" required><Input value={modal.data.code} onChange={(e) => patch({ code: e.target.value })} placeholder="CL / SL" /></Field>
            <Field label="Name" required><Input value={modal.data.name} onChange={(e) => patch({ name: e.target.value })} /></Field>
            <Field label="Annual Entitlement (days)"><Input type="number" step="0.5" value={modal.data.annualEntitlement} onChange={(e) => patch({ annualEntitlement: Number(e.target.value) || 0 })} /></Field>
            <Field label="Max Carry-Forward"><Input type="number" value={modal.data.maxCarryForward} onChange={(e) => patch({ maxCarryForward: Number(e.target.value) || 0 })} disabled={!modal.data.carryForward} /></Field>
            <Field label="Gender"><Select value={modal.data.gender} onChange={(e) => patch({ gender: e.target.value })} options={GENDER_RESTRICTIONS} /></Field>
            <Field label="Sort Order"><Input type="number" value={modal.data.sortOrder} onChange={(e) => patch({ sortOrder: Number(e.target.value) || 0 })} /></Field>
          </FormGrid>
          <div style={{ marginTop: 12, display: "flex", gap: 16, flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}><input type="checkbox" checked={modal.data.paid} onChange={(e) => patch({ paid: e.target.checked })} /> Paid</label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}><input type="checkbox" checked={modal.data.carryForward} onChange={(e) => patch({ carryForward: e.target.checked })} /> Carry-forward</label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}><input type="checkbox" checked={modal.data.requiresApproval} onChange={(e) => patch({ requiresApproval: e.target.checked })} /> Requires approval</label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}><input type="checkbox" checked={modal.data.active} onChange={(e) => patch({ active: e.target.checked })} /> Active</label>
          </div>
        </Modal>
      )}
    </PageShell>
  );
}
