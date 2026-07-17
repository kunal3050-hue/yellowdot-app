/**
 * SalaryComponents.jsx — CRUD master for salary components
 * Design System v2 / Platform Layout Standard retrofit: PageShell +
 * PageHeader + DataTable + Modal/FormGrid/Field/Input/Select/Button/Badge.
 * Same payrollService component calls/payloads.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import payrollService from "../../../services/payrollService";
import { PageShell, PageHeader, DataTable, Badge, Modal, Button, Field, FormGrid, Input, Select } from "../../../components/ui";

const EMPTY = { code: "", name: "", kind: "earning", type: "fixed", percent: 0, amount: 0, taxable: false, active: true, sortOrder: 0 };

const KIND_OPTIONS = [{ value: "earning", label: "Earning" }, { value: "deduction", label: "Deduction" }];
const TYPE_OPTIONS = [
  { value: "fixed", label: "Fixed amount" },
  { value: "percent_basic", label: "% of Basic" },
  { value: "lop_proration", label: "LOP proration (auto)" },
];

export default function SalaryComponents() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const r = await payrollService.listComponents();
      if (r?.success) setRows(r.components || []);
    } catch (err) { setError(err.response?.data?.error || err.message); }
    finally { setLoading(false); }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  function patch(f) { setModal(m => ({ ...m, data: { ...m.data, ...f } })); }

  async function save() {
    setSaving(true);
    try {
      if (modal.mode === "create") await payrollService.createComponent(modal.data);
      else                         await payrollService.updateComponent(modal.data.componentId, modal.data);
      setModal(null); await load();
    } catch (err) { alert(err.response?.data?.error || err.message); }
    finally { setSaving(false); }
  }

  async function remove(c) {
    if (!window.confirm(`Delete "${c.name}"?`)) return;
    try { await payrollService.removeComponent(c.componentId); await load(); }
    catch (err) { alert(err.response?.data?.error || err.message); }
  }

  const columns = useMemo(() => [
    { key: "code", label: "Code", width: 80, render: (v) => <span style={{ fontFamily: "ui-monospace, Cascadia Code, monospace", fontSize: 12 }}>{v || "—"}</span> },
    {
      key: "name", label: "Name", sortable: true, filterable: true, width: 160,
      render: (v, row) => <span>{v}{row.isSystem && <span style={{ marginLeft: 6 }}><Badge variant="yellow">system</Badge></span>}</span>,
    },
    { key: "kind", label: "Kind", sortable: true, filterable: true, filterType: "select", filterOptions: KIND_OPTIONS, width: 110, render: (v) => v === "earning" ? <span style={{ color: "var(--yd-success)", fontWeight: 600 }}>Earning</span> : <span style={{ color: "var(--yd-danger)", fontWeight: 600 }}>Deduction</span> },
    { key: "type", label: "Type", width: 130, render: (v) => (TYPE_OPTIONS.find(t => t.value === v) || {}).label || v },
    { key: "percent", label: "Default %", width: 100, render: (v, row) => row.type === "percent_basic" ? `${v}%` : "—" },
    { key: "amount", label: "Default ₹", width: 110, render: (v, row) => row.type === "fixed" ? `₹ ${(v || 0).toLocaleString("en-IN")}` : "—" },
    { key: "taxable", label: "Taxable", width: 90, render: (v) => v ? "Yes" : "—" },
    {
      key: "active", label: "Status", width: 110,
      render: (v, row) => v ? <span style={{ color: "var(--yd-success)" }}>Active</span> : <span style={{ color: "var(--yd-text-muted)" }}>Inactive</span>,
    },
    {
      key: "actions", label: "", type: "actions", width: 130, hideable: false,
      actions: (row) => (
        <div style={{ display: "flex", gap: 4 }}>
          <Button size="xs" variant="ghost" onClick={() => setModal({ mode: "edit", data: { ...row } })}>Edit</Button>
          {!row.isSystem && <Button size="xs" variant="ghost" onClick={() => remove(row)}>Delete</Button>}
        </div>
      ),
    },
  ], []);

  return (
    <PageShell
      header={
        <PageHeader
          title="Salary Components"
          tag="Payroll"
          subtitle="Master list of earnings and deductions used by salary structures and payroll runs."
          primaryAction={{ label: "Add Component", icon: <Plus size={14} strokeWidth={2} />, onClick: () => setModal({ mode: "create", data: { ...EMPTY } }) }}
        />
      }
    >
      {error && (
        <div style={{ background: "var(--yd-danger-soft)", color: "var(--yd-danger)", border: "1px solid var(--yd-danger-border)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      <DataTable
        tableId="salary-components"
        columns={columns}
        data={rows}
        loading={loading}
        entityLabel="components"
        searchPlaceholder="Search components…"
        empty={{ title: "No components yet", description: "Defaults seed on first dashboard visit.", action: { label: "+ Add Component", onClick: () => setModal({ mode: "create", data: { ...EMPTY } }) } }}
      />

      {modal && (
        <Modal
          isOpen
          onClose={() => setModal(null)}
          title={modal.mode === "create" ? "Add Component" : "Edit Component"}
          footer={<><Button variant="outline" onClick={() => setModal(null)} disabled={saving}>Cancel</Button><Button variant="primary" onClick={save} loading={saving}>Save</Button></>}
        >
          <FormGrid cols={2}>
            <Field label="Code" required><Input value={modal.data.code} onChange={(e) => patch({ code: e.target.value })} /></Field>
            <Field label="Name" required><Input value={modal.data.name} onChange={(e) => patch({ name: e.target.value })} /></Field>
            <Field label="Kind"><Select value={modal.data.kind} onChange={(e) => patch({ kind: e.target.value })} options={KIND_OPTIONS} /></Field>
            <Field label="Type"><Select value={modal.data.type} onChange={(e) => patch({ type: e.target.value })} options={TYPE_OPTIONS} /></Field>
            {modal.data.type === "percent_basic" && (
              <Field label="Default %"><Input type="number" value={modal.data.percent} onChange={(e) => patch({ percent: Number(e.target.value) || 0 })} /></Field>
            )}
            {modal.data.type === "fixed" && (
              <Field label="Default ₹"><Input type="number" value={modal.data.amount} onChange={(e) => patch({ amount: Number(e.target.value) || 0 })} /></Field>
            )}
            <Field label="Sort Order"><Input type="number" value={modal.data.sortOrder} onChange={(e) => patch({ sortOrder: Number(e.target.value) || 0 })} /></Field>
          </FormGrid>
          <div style={{ marginTop: 12, display: "flex", gap: 16 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}><input type="checkbox" checked={modal.data.taxable} onChange={(e) => patch({ taxable: e.target.checked })} /> Tax-affected</label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}><input type="checkbox" checked={modal.data.active} onChange={(e) => patch({ active: e.target.checked })} /> Active</label>
          </div>
        </Modal>
      )}
    </PageShell>
  );
}
