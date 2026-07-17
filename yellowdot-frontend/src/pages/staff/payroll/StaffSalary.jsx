/**
 * StaffSalary.jsx — Per-staff salary assignment + overrides.
 * Design System v2 / Platform Layout Standard retrofit: PageShell +
 * PageHeader + DataTable + Modal/Button. Same payrollService/staffService
 * calls/payloads.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import payrollService from "../../../services/payrollService";
import staffService from "../../../services/staffService";
import { PageShell, PageHeader, DataTable, Modal, Button, Input, Select } from "../../../components/ui";
import { inr } from "./_shared";

export default function StaffSalary() {
  const [staff, setStaff]         = useState([]);
  const [salaries, setSalaries]   = useState({});
  const [structures, setStructures] = useState([]);
  const [components, setComponents] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [selected, setSelected]   = useState(null);
  const [draft, setDraft]         = useState(null);
  const [saving, setSaving]       = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [s, sa, st, c] = await Promise.all([
        staffService.getAll(),
        payrollService.listStaffSalary(),
        payrollService.listStructures(),
        payrollService.listComponents({ active: true }),
      ]);
      if (s?.success)  setStaff(s.staff || []);
      if (sa?.success) setSalaries(Object.fromEntries((sa.staffSalary || []).map(r => [r.staffId, r])));
      if (st?.success) setStructures(st.structures || []);
      if (c?.success)  setComponents(c.components || []);
    } catch (err) { setError(err.response?.data?.error || err.message); }
    finally { setLoading(false); }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  function openEdit(s) {
    const existing = salaries[s.staffId];
    setSelected(s);
    setDraft({
      structureId: existing?.structureId || "",
      monthlyCtc:  existing?.monthlyCtc  || 0,
      overrides:   existing?.overrides   || {},
      paymentMode: existing?.paymentMode || "Bank Transfer",
      bankName:    existing?.bankName    || "",
      ifsc:        existing?.ifsc        || "",
      bankAccountLast4: existing?.bankAccountLast4 || "",
      effectiveFrom: existing?.effectiveFrom || new Date().toISOString().slice(0, 10),
      active: true,
    });
  }

  function set(k, v) { setDraft(d => ({ ...d, [k]: v })); }

  function selectStructure(id) {
    const st = structures.find(s => s.structureId === id);
    setDraft(d => ({ ...d, structureId: id, monthlyCtc: st?.monthlyCtc || d.monthlyCtc, overrides: { ...(st?.componentAmounts || {}) } }));
  }

  async function save() {
    if (!selected) return;
    setSaving(true);
    try {
      await payrollService.upsertStaffSalary(selected.staffId, { ...draft, centerId: selected.centerId });
      setSelected(null); setDraft(null);
      await load();
    } catch (err) { alert(err.response?.data?.error || err.message); }
    finally { setSaving(false); }
  }

  async function remove(staffId) {
    if (!window.confirm("Remove salary record? (Soft delete.)")) return;
    try { await payrollService.removeStaffSalary(staffId); await load(); }
    catch (err) { alert(err.response?.data?.error || err.message); }
  }

  const structureOptions = [{ value: "", label: "(custom — no template)" }, ...structures.map(s => ({ value: s.structureId, label: `${s.name} · ${inr(s.monthlyCtc)}` }))];

  const columns = useMemo(() => [
    {
      key: "displayName", label: "Employee", sortable: true, filterable: true, width: 180,
      render: (v, row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{v}</div>
          <div style={{ fontSize: 11, color: "var(--yd-text-muted)", fontFamily: "ui-monospace, Cascadia Code, monospace" }}>{row.employeeCode}</div>
        </div>
      ),
    },
    {
      key: "staffId", label: "Structure", width: 160,
      render: (_v, row) => {
        const sal = salaries[row.staffId];
        const st = sal ? structures.find(x => x.structureId === sal.structureId) : null;
        return st ? st.name : (sal ? <span style={{ color: "var(--yd-text-muted)" }}>(custom)</span> : <span style={{ color: "var(--yd-text-muted)" }}>—</span>);
      },
    },
    {
      key: "monthlyCtc", label: "Monthly CTC", width: 130,
      render: (_v, row) => { const sal = salaries[row.staffId]; return sal ? inr(sal.monthlyCtc) : <span style={{ color: "var(--yd-text-muted)" }}>—</span>; },
    },
    { key: "paymentMode", label: "Payment Mode", width: 140, render: (_v, row) => salaries[row.staffId]?.paymentMode || "—" },
    { key: "bankAccountLast4", label: "Bank A/C", width: 110, render: (_v, row) => salaries[row.staffId]?.bankAccountLast4 ? `XXXX${salaries[row.staffId].bankAccountLast4}` : "—" },
    {
      key: "actions", label: "", type: "actions", width: 150, hideable: false,
      actions: (row) => {
        const sal = salaries[row.staffId];
        return (
          <div style={{ display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
            <Button size="xs" variant="ghost" onClick={() => openEdit(row)}>{sal ? "Edit" : "Set Salary"}</Button>
            {sal && <Button size="xs" variant="ghost" onClick={() => remove(row.staffId)}>Clear</Button>}
          </div>
        );
      },
    },
  ], [salaries, structures]);

  const fixedComponents = components.filter(c => c.type === "fixed");
  const percentComponents = components.filter(c => c.type === "percent_basic");

  return (
    <PageShell
      header={<PageHeader title="Staff Salaries" tag="Payroll" />}
    >
      {error && (
        <div style={{ background: "var(--yd-danger-soft)", color: "var(--yd-danger)", border: "1px solid var(--yd-danger-border)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      <DataTable
        tableId="staff-salary"
        columns={columns}
        data={staff}
        loading={loading}
        entityLabel="employees"
        searchPlaceholder="Search employees…"
        empty={{ title: "No staff records" }}
      />

      {selected && draft && (
        <Modal
          isOpen
          onClose={() => { setSelected(null); setDraft(null); }}
          title={selected.displayName}
          size="wide"
          footer={<><Button variant="outline" onClick={() => { setSelected(null); setDraft(null); }} disabled={saving}>Cancel</Button><Button variant="primary" onClick={save} loading={saving}>Save Salary</Button></>}
        >
          <div style={{ fontSize: 12, color: "var(--yd-text-muted)", marginBottom: 16, fontFamily: "ui-monospace, Cascadia Code, monospace" }}>{selected.employeeCode}</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--yd-text-soft)" }}>Structure</span>
              <Select value={draft.structureId} onChange={(e) => selectStructure(e.target.value)} options={structureOptions} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--yd-text-soft)" }}>Monthly CTC (₹)</span>
              <Input type="number" value={draft.monthlyCtc} onChange={(e) => set("monthlyCtc", Number(e.target.value) || 0)} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--yd-text-soft)" }}>Payment Mode</span>
              <Input value={draft.paymentMode} onChange={(e) => set("paymentMode", e.target.value)} placeholder="Bank Transfer / UPI / Cheque" />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--yd-text-soft)" }}>Bank Name</span>
              <Input value={draft.bankName} onChange={(e) => set("bankName", e.target.value)} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--yd-text-soft)" }}>IFSC</span>
              <Input value={draft.ifsc} onChange={(e) => set("ifsc", e.target.value)} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--yd-text-soft)" }}>A/C (last 4)</span>
              <Input value={draft.bankAccountLast4} maxLength={4} onChange={(e) => set("bankAccountLast4", e.target.value)} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--yd-text-soft)" }}>Effective From</span>
              <Input type="date" value={draft.effectiveFrom} onChange={(e) => set("effectiveFrom", e.target.value)} />
            </label>
          </div>

          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--yd-text-soft)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "16px 0 8px" }}>Component Overrides</div>
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
                    <td style={td}>fixed</td>
                    <td style={td}><Input type="number" value={draft.overrides[c.componentId] ?? c.amount} onChange={(e) => set("overrides", { ...draft.overrides, [c.componentId]: Number(e.target.value) || 0 })} style={{ width: 130 }} /></td>
                  </tr>
                ))}
                {percentComponents.map(c => (
                  <tr key={c.componentId} style={{ borderBottom: "1px solid var(--yd-border-light)" }}>
                    <td style={td}>{c.name}</td>
                    <td style={td}>{c.kind === "earning" ? "Earning" : "Deduction"}</td>
                    <td style={td}>% of Basic</td>
                    <td style={td}><Input type="number" placeholder={`${c.percent}%`} value={draft.overrides[`${c.componentId}__percent`] ?? ""} onChange={(e) => set("overrides", { ...draft.overrides, [`${c.componentId}__percent`]: Number(e.target.value) || 0 })} style={{ width: 130 }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </PageShell>
  );
}

const th = { textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--yd-text-muted)" };
const td = { padding: "10px 14px", fontSize: 13, color: "var(--yd-text)" };
