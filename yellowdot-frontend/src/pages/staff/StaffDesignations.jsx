/**
 * StaffDesignations.jsx — Designations management
 * ─────────────────────────────────────────────────
 * Design System v2 / Platform Layout Standard: PageShell -> PageHeader ->
 * DataTable (search/sort/export/pagination + department column filter
 * supplied for free) -> Modal (create/edit). Same designationService/
 * departmentService calls/payloads.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import designationService from "../../services/designationService";
import departmentService  from "../../services/departmentService";
import { STAFF_ENUMS } from "../../services/staffService";
import { PageShell, PageHeader, DataTable, Badge, Modal, Button, Field, FormGrid, Input, Select } from "../../components/ui";

const EMPTY = {
  name: "", description: "", level: "",
  departmentId: "", departmentName: "",
  category: "non_teaching",
  sortOrder: 0, active: true,
};

function labelForCategory(id) {
  return STAFF_ENUMS.categories.find(c => c.value === id)?.label || "—";
}

export default function StaffDesignations() {
  const [rows, setRows]         = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [modal, setModal]       = useState(null);
  const [saving, setSaving]     = useState(false);

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

  const departmentOptions = useMemo(() => departments.map(d => ({ value: d.deptId, label: d.name })), [departments]);

  const columns = useMemo(() => [
    {
      key: "name", label: "Name", sortable: true, filterable: true, width: 200,
      render: (v, row) => (
        <span style={{ fontWeight: 600 }}>
          {v}
          {row.isSystem && <span style={{ marginLeft: 6 }}><Badge variant="yellow">system</Badge></span>}
        </span>
      ),
    },
    {
      key: "departmentName", label: "Department", sortable: true, filterable: true,
      filterType: "multiselect", filterOptions: departmentOptions, width: 160,
      render: (v) => v || "—",
    },
    {
      key: "category", label: "Category", sortable: true, filterable: true,
      filterType: "select", filterOptions: STAFF_ENUMS.categories, width: 140,
      render: (v) => labelForCategory(v),
    },
    { key: "level", label: "Level", width: 110, render: (v) => v || "—" },
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
  ], [departmentOptions]);

  return (
    <PageShell
      header={
        <PageHeader
          title="Designations"
          tag="Staff Management"
          subtitle="Job titles and levels assignable to staff."
          primaryAction={{ label: "Add Designation", icon: <Plus size={14} strokeWidth={2} />, onClick: openCreate }}
        />
      }
    >
      {error && (
        <div style={{ background: "var(--yd-danger-soft)", color: "var(--yd-danger)", border: "1px solid var(--yd-danger-border)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      <DataTable
        tableId="staff-designations"
        columns={columns}
        data={rows}
        loading={loading}
        entityLabel="designations"
        searchPlaceholder="Search designations…"
        empty={{ title: "No designations found", description: "Adjust filters or add your first designation.", action: { label: "+ Add Designation", onClick: openCreate } }}
      />

      {modal && (
        <Modal
          isOpen
          onClose={closeModal}
          title={modal.mode === "create" ? "Add Designation" : "Edit Designation"}
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
            <Field label="Department">
              <Select value={modal.data.departmentId} onChange={(e) => selectDept(e.target.value)} options={departmentOptions} placeholder="— None —" />
            </Field>
            <Field label="Category" required>
              <Select value={modal.data.category} onChange={(e) => setModal({ ...modal, data: { ...modal.data, category: e.target.value } })} options={STAFF_ENUMS.categories} />
            </Field>
            <Field label="Level">
              <Input value={modal.data.level} onChange={(e) => setModal({ ...modal, data: { ...modal.data, level: e.target.value } })} placeholder="Junior / Senior / Lead" />
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
