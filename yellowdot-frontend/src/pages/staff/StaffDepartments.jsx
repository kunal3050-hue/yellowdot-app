/**
 * StaffDepartments.jsx — Departments management
 * ───────────────────────────────────────────────
 * Design System v2 / Platform Layout Standard: PageShell -> PageHeader ->
 * DataTable (search/sort/export/pagination supplied for free) -> Modal
 * (create/edit, replacing the hand-rolled centered-dialog). Same
 * departmentService calls/payloads.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import departmentService from "../../services/departmentService";
import { PageShell, PageHeader, DataTable, Badge, Modal, Button, Field, FormGrid, Input } from "../../components/ui";

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

  const columns = useMemo(() => [
    {
      key: "name", label: "Name", sortable: true, filterable: true, width: 220,
      render: (v, row) => (
        <span style={{ fontWeight: 600 }}>
          {v}
          {row.isSystem && <span style={{ marginLeft: 6 }}><Badge variant="yellow">system</Badge></span>}
        </span>
      ),
    },
    { key: "description", label: "Description", render: (v) => v || "—" },
    { key: "sortOrder", label: "Sort", sortable: true, width: 80 },
    {
      key: "active", label: "Status", width: 120,
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
          {!row.isSystem && <Button size="xs" variant="ghost" onClick={() => handleDelete(row)}>Delete</Button>}
        </div>
      ),
    },
  ], []);

  return (
    <PageShell
      header={
        <PageHeader
          title="Departments"
          tag="Staff Management"
          subtitle="Organisational units used to group staff."
          primaryAction={{ label: "Add Department", icon: <Plus size={14} strokeWidth={2} />, onClick: openCreate }}
        />
      }
    >
      {error && (
        <div style={{ background: "var(--yd-danger-soft)", color: "var(--yd-danger)", border: "1px solid var(--yd-danger-border)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      <DataTable
        tableId="staff-departments"
        columns={columns}
        data={rows}
        loading={loading}
        entityLabel="departments"
        searchPlaceholder="Search departments…"
        empty={{ title: "No departments yet", description: 'Create your first one with "Add Department".', action: { label: "+ Add Department", onClick: openCreate } }}
      />

      {modal && (
        <Modal
          isOpen
          onClose={closeModal}
          title={modal.mode === "create" ? "Add Department" : "Edit Department"}
          footer={
            <>
              <Button variant="outline" onClick={closeModal} disabled={saving}>Cancel</Button>
              <Button variant="primary" onClick={handleSave} loading={saving}>Save</Button>
            </>
          }
        >
          <FormGrid cols={2}>
            <Field label="Name" required>
              <Input value={modal.data.name} onChange={(e) => setModal({ ...modal, data: { ...modal.data, name: e.target.value } })} />
            </Field>
            <Field label="Sort Order">
              <Input type="number" value={modal.data.sortOrder} onChange={(e) => setModal({ ...modal, data: { ...modal.data, sortOrder: Number(e.target.value) || 0 } })} />
            </Field>
          </FormGrid>
          <div style={{ marginTop: 12 }}>
            <Field label="Description">
              <Input value={modal.data.description} onChange={(e) => setModal({ ...modal, data: { ...modal.data, description: e.target.value } })} />
            </Field>
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <input type="checkbox" checked={modal.data.active} onChange={(e) => setModal({ ...modal, data: { ...modal.data, active: e.target.checked } })} />
              Active
            </label>
          </div>
        </Modal>
      )}
    </PageShell>
  );
}
