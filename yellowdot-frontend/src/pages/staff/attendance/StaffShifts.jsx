/**
 * StaffShifts.jsx — Shift definitions CRUD
 * Design System v2 / Platform Layout Standard retrofit: PageShell +
 * PageHeader + DataTable + Modal/FormGrid/Field/Input/Button/Badge. Same
 * staffAttendanceService shift calls/payloads.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import staffAttendanceService from "../../../services/staffAttendanceService";
import { PageShell, PageHeader, DataTable, Badge, Modal, Button, Field, FormGrid, Input } from "../../../components/ui";

const EMPTY = {
  name: "", code: "", startTime: "09:00", endTime: "17:00",
  graceMinutes: 10, halfDayMinHours: 4, fullDayMinHours: 7,
  overtimeAfterMinutes: 480, isDefault: false, sortOrder: 0, active: true,
};

export default function StaffShifts() {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [modal, setModal]     = useState(null);
  const [saving, setSaving]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const r = await staffAttendanceService.listShifts();
      if (r?.success) setRows(r.shifts || []);
    } catch (err) { setError(err.response?.data?.error || err.message); }
    finally { setLoading(false); }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  function openCreate() { setModal({ mode: "create", data: { ...EMPTY } }); }
  function openEdit(s)  { setModal({ mode: "edit",   data: { ...s } }); }
  function close() { setModal(null); }

  async function save() {
    setSaving(true);
    try {
      if (modal.mode === "create") await staffAttendanceService.createShift(modal.data);
      else                         await staffAttendanceService.updateShift(modal.data.shiftId, modal.data);
      close(); await load();
    } catch (err) { alert(err.response?.data?.error || err.message); }
    finally { setSaving(false); }
  }

  async function remove(s) {
    if (!window.confirm(`Delete shift "${s.name}"?`)) return;
    try {
      await staffAttendanceService.removeShift(s.shiftId);
      await load();
    } catch (err) { alert(err.response?.data?.error || err.message); }
  }

  async function toggleActive(s) {
    try { await staffAttendanceService.updateShift(s.shiftId, { active: !s.active }); await load(); }
    catch (err) { alert(err.response?.data?.error || err.message); }
  }

  function patch(fields) {
    setModal(m => ({ ...m, data: { ...m.data, ...fields } }));
  }

  const columns = useMemo(() => [
    {
      key: "name", label: "Name", sortable: true, filterable: true, width: 180,
      render: (v, row) => (
        <span style={{ fontWeight: 600 }}>
          {v}
          {row.isSystem && <span style={{ marginLeft: 6 }}><Badge variant="yellow">system</Badge></span>}
          {row.isDefault && <span style={{ marginLeft: 6 }}><Badge variant="success">default</Badge></span>}
        </span>
      ),
    },
    { key: "code", label: "Code", width: 90, render: (v) => v || "—" },
    { key: "startTime", label: "Window", width: 130, render: (v, row) => `${row.startTime} – ${row.endTime}` },
    { key: "graceMinutes", label: "Grace", width: 90, render: (v) => `${v}m` },
    { key: "halfDayMinHours", label: "Half-Day ≥", width: 100, render: (v) => `${v}h` },
    { key: "fullDayMinHours", label: "Full-Day ≥", width: 100, render: (v) => `${v}h` },
    { key: "overtimeAfterMinutes", label: "OT after", width: 100, render: (v) => `${Math.floor(v / 60)}h${v % 60 ? ` ${v % 60}m` : ""}` },
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
          title="Shifts"
          tag="Staff Attendance"
          subtitle="Working windows that drive late/early/half-day/overtime calculations."
          primaryAction={{ label: "Add Shift", icon: <Plus size={14} strokeWidth={2} />, onClick: openCreate }}
        />
      }
    >
      {error && (
        <div style={{ background: "var(--yd-danger-soft)", color: "var(--yd-danger)", border: "1px solid var(--yd-danger-border)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      <DataTable
        tableId="staff-shifts"
        columns={columns}
        data={rows}
        loading={loading}
        entityLabel="shifts"
        searchPlaceholder="Search shifts…"
        empty={{ title: "No shifts yet", description: "Defaults seed on first dashboard visit.", action: { label: "+ Add Shift", onClick: openCreate } }}
      />

      {modal && (
        <Modal
          isOpen
          onClose={close}
          title={modal.mode === "create" ? "Add Shift" : "Edit Shift"}
          footer={
            <>
              <Button variant="outline" onClick={close} disabled={saving}>Cancel</Button>
              <Button variant="primary" onClick={save} loading={saving}>Save</Button>
            </>
          }
        >
          <FormGrid cols={2}>
            <Field label="Name" required>
              <Input value={modal.data.name} onChange={(e) => patch({ name: e.target.value })} />
            </Field>
            <Field label="Code">
              <Input value={modal.data.code} onChange={(e) => patch({ code: e.target.value })} />
            </Field>
            <Field label="Start">
              <Input type="time" value={modal.data.startTime} onChange={(e) => patch({ startTime: e.target.value })} />
            </Field>
            <Field label="End">
              <Input type="time" value={modal.data.endTime} onChange={(e) => patch({ endTime: e.target.value })} />
            </Field>
            <Field label="Grace (min)">
              <Input type="number" value={modal.data.graceMinutes} onChange={(e) => patch({ graceMinutes: Number(e.target.value) || 0 })} />
            </Field>
            <Field label="Half-Day (h)">
              <Input type="number" step="0.5" value={modal.data.halfDayMinHours} onChange={(e) => patch({ halfDayMinHours: Number(e.target.value) || 0 })} />
            </Field>
            <Field label="Full-Day (h)">
              <Input type="number" step="0.5" value={modal.data.fullDayMinHours} onChange={(e) => patch({ fullDayMinHours: Number(e.target.value) || 0 })} />
            </Field>
            <Field label="OT after (min)">
              <Input type="number" value={modal.data.overtimeAfterMinutes} onChange={(e) => patch({ overtimeAfterMinutes: Number(e.target.value) || 0 })} />
            </Field>
            <Field label="Sort Order">
              <Input type="number" value={modal.data.sortOrder} onChange={(e) => patch({ sortOrder: Number(e.target.value) || 0 })} />
            </Field>
          </FormGrid>
          <div style={{ marginTop: 12, display: "flex", gap: 16 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <input type="checkbox" checked={modal.data.isDefault} onChange={(e) => patch({ isDefault: e.target.checked })} /> School default
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <input type="checkbox" checked={modal.data.active} onChange={(e) => patch({ active: e.target.checked })} /> Active
            </label>
          </div>
        </Modal>
      )}
    </PageShell>
  );
}
