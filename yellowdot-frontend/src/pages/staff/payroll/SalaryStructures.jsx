/**
 * SalaryStructures.jsx — Salary templates that bundle component allocations.
 * Design System v2 / Platform Layout Standard retrofit: PageShell +
 * PageHeader + DataTable + Modal/Button/Badge. The inner component-
 * allocation table (a handful of rows, no search/sort/pagination need)
 * stays a plain table reskinned onto design tokens. Same payrollService
 * calls/payloads.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import payrollService from "../../../services/payrollService";
import { PageShell, PageHeader, DataTable, Badge, Modal, Button, Input } from "../../../components/ui";
import { inr } from "./_shared";

const EMPTY = { name: "", monthlyCtc: 0, componentAmounts: {}, active: true, sortOrder: 0 };

export default function SalaryStructures() {
  const [rows, setRows]           = useState([]);
  const [components, setComponents] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [modal, setModal]         = useState(null);
  const [saving, setSaving]       = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [r, c] = await Promise.all([payrollService.listStructures(), payrollService.listComponents({ active: true })]);
      if (r?.success) setRows(r.structures || []);
      if (c?.success) setComponents(c.components || []);
    } catch (err) { setError(err.response?.data?.error || err.message); }
    finally { setLoading(false); }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  function set(k, v) { setModal(m => ({ ...m, data: { ...m.data, [k]: v } })); }

  async function save() {
    setSaving(true);
    try {
      if (modal.mode === "create") await payrollService.createStructure(modal.data);
      else                          await payrollService.updateStructure(modal.data.structureId, modal.data);
      setModal(null); await load();
    } catch (err) { alert(err.response?.data?.error || err.message); }
    finally { setSaving(false); }
  }

  async function remove(s) {
    if (!window.confirm(`Delete "${s.name}"?`)) return;
    try { await payrollService.removeStructure(s.structureId); await load(); }
    catch (err) { alert(err.response?.data?.error || err.message); }
  }

  const columns = useMemo(() => [
    { key: "name", label: "Name", sortable: true, filterable: true, width: 200, render: (v) => <strong>{v}</strong> },
    { key: "monthlyCtc", label: "Monthly CTC", sortable: true, width: 130, render: (v) => inr(v) },
    { key: "componentAmounts", label: "Components", width: 130, render: (v) => `${Object.keys(v || {}).length} customised` },
    {
      key: "active", label: "Status", width: 110,
      render: (v) => v ? <span style={{ color: "var(--yd-success)" }}>Active</span> : <span style={{ color: "var(--yd-text-muted)" }}>Inactive</span>,
    },
    {
      key: "actions", label: "", type: "actions", width: 130, hideable: false,
      actions: (row) => (
        <div style={{ display: "flex", gap: 4 }}>
          <Button size="xs" variant="ghost" onClick={() => setModal({ mode: "edit", data: { ...row, componentAmounts: { ...(row.componentAmounts || {}) } } })}>Edit</Button>
          <Button size="xs" variant="ghost" onClick={() => remove(row)}>Delete</Button>
        </div>
      ),
    },
  ], []);

  const fixedComponents = components.filter(c => c.type === "fixed");
  const derivedComponents = components.filter(c => c.type !== "fixed");

  return (
    <PageShell
      header={
        <PageHeader
          title="Salary Structures"
          tag="Payroll"
          subtitle='Named templates (e.g. "Teacher CTC") with default component amounts.'
          primaryAction={{ label: "Add Structure", icon: <Plus size={14} strokeWidth={2} />, onClick: () => setModal({ mode: "create", data: { ...EMPTY, componentAmounts: {} } }) }}
        />
      }
    >
      {error && (
        <div style={{ background: "var(--yd-danger-soft)", color: "var(--yd-danger)", border: "1px solid var(--yd-danger-border)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      <DataTable
        tableId="salary-structures"
        columns={columns}
        data={rows}
        loading={loading}
        entityLabel="structures"
        searchPlaceholder="Search structures…"
        empty={{ title: "No structures yet", action: { label: "+ Add Structure", onClick: () => setModal({ mode: "create", data: { ...EMPTY, componentAmounts: {} } }) } }}
      />

      {modal && (
        <Modal
          isOpen
          onClose={() => setModal(null)}
          title={modal.mode === "create" ? "Add Structure" : "Edit Structure"}
          size="wide"
          footer={<><Button variant="outline" onClick={() => setModal(null)} disabled={saving}>Cancel</Button><Button variant="primary" onClick={save} loading={saving}>Save</Button></>}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--yd-text-soft)" }}>Name *</span>
              <Input value={modal.data.name} onChange={(e) => set("name", e.target.value)} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--yd-text-soft)" }}>Monthly CTC (₹)</span>
              <Input type="number" value={modal.data.monthlyCtc} onChange={(e) => set("monthlyCtc", Number(e.target.value) || 0)} />
            </label>
          </div>

          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--yd-text-soft)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "8px 0" }}>Component Allocations (fixed only)</div>
          <div style={{ maxHeight: 260, overflowY: "auto", border: "1px solid var(--yd-border)", borderRadius: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ background: "var(--yd-soft)" }}>
                <tr><th style={th}>Component</th><th style={th}>Kind</th><th style={th}>Type</th><th style={th}>Amount (₹)</th></tr>
              </thead>
              <tbody>
                {fixedComponents.map(c => (
                  <tr key={c.componentId} style={{ borderBottom: "1px solid var(--yd-border-light)" }}>
                    <td style={td}>{c.name}</td>
                    <td style={td}>{c.kind === "earning" ? "Earning" : "Deduction"}</td>
                    <td style={td}>{c.type}</td>
                    <td style={td}>
                      <Input type="number" value={modal.data.componentAmounts[c.componentId] ?? c.amount} onChange={(e) => set("componentAmounts", { ...modal.data.componentAmounts, [c.componentId]: Number(e.target.value) || 0 })} style={{ width: 130 }} />
                    </td>
                  </tr>
                ))}
                {derivedComponents.map(c => (
                  <tr key={c.componentId} style={{ borderBottom: "1px solid var(--yd-border-light)" }}>
                    <td style={td}>{c.name}</td>
                    <td style={td}>{c.kind === "earning" ? "Earning" : "Deduction"}</td>
                    <td style={td}>{c.type}{c.percent ? ` · ${c.percent}%` : ""}</td>
                    <td style={{ ...td, color: "var(--yd-text-muted)", fontStyle: "italic" }}>derived</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginTop: 12 }}>
            <input type="checkbox" checked={modal.data.active} onChange={(e) => set("active", e.target.checked)} /> Active
          </label>
        </Modal>
      )}
    </PageShell>
  );
}

const th = { textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--yd-text-muted)" };
const td = { padding: "10px 14px", fontSize: 13, color: "var(--yd-text)" };
