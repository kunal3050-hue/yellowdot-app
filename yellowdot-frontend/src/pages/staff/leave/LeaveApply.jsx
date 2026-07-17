/**
 * LeaveApply.jsx — Self-service leave application form.
 * Managers can also apply on behalf of another staff member.
 * Design System v2 / Platform Layout Standard retrofit: PageShell +
 * PageHeader + FormSection/FormGrid/Field/Input/Select/Button. Same
 * leaveService/staffService calls and day-count/balance logic.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../contexts/AuthContext";
import leaveService from "../../../services/leaveService";
import staffService from "../../../services/staffService";
import { PageShell, PageHeader, FormSection, Field, FormGrid, Input, Select, Button } from "../../../components/ui";

function dayCount(from, to, halfStart, halfEnd) {
  if (!from || !to) return 0;
  const a = new Date(from), b = new Date(to);
  let raw = Math.round((b - a) / 86400000) + 1;
  if (raw < 1) return 0;
  if (halfStart) raw -= 0.5;
  if (halfEnd)   raw -= 0.5;
  return Math.max(0.5, raw);
}

export default function LeaveApply() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const canApplyForOthers = ["developer","super_admin","admin","center_owner","center_admin"].includes(role);

  const [types, setTypes]       = useState([]);
  const [allStaff, setAllStaff] = useState([]);
  const [balances, setBalances] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState("");

  const [form, setForm] = useState({
    staffId: "",
    leaveTypeId: "",
    fromDate: new Date().toISOString().slice(0, 10),
    toDate:   new Date().toISOString().slice(0, 10),
    halfDayStart: false,
    halfDayEnd:   false,
    reason: "",
    attachmentUrl: "",
  });

  const load = useCallback(async () => {
    try {
      const [t, s, b] = await Promise.all([
        leaveService.listTypes({ active: true }),
        canApplyForOthers ? staffService.getAll({ includeDeleted: undefined }) : Promise.resolve({ staff: [] }),
        leaveService.myBalances().catch(() => ({ balances: [] })),
      ]);
      if (t?.success) setTypes(t.leaveTypes || []);
      if (s?.success) setAllStaff(s.staff || []);
      setBalances(b?.balances || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  }, [canApplyForOthers]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!form.staffId) {
      leaveService.myBalances().then(r => setBalances(r?.balances || [])).catch(() => {});
    } else {
      leaveService.balancesForStaff(form.staffId).then(r => setBalances(r?.balances || [])).catch(() => {});
    }
  }, [form.staffId]);

  const days = useMemo(() => dayCount(form.fromDate, form.toDate, form.halfDayStart, form.halfDayEnd), [form]);
  const selectedBalance = balances.find(b => b.leaveTypeId === form.leaveTypeId);
  const selectedType    = types.find(t => t.leaveTypeId === form.leaveTypeId);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function submit(e) {
    e?.preventDefault();
    setError(""); setSuccess("");
    if (!form.leaveTypeId)              { setError("Choose a leave type."); return; }
    if (!form.fromDate || !form.toDate) { setError("Pick from / to dates."); return; }
    if (form.fromDate > form.toDate)    { setError("From date must be on or before to date."); return; }

    setSubmitting(true);
    try {
      const payload = { ...form };
      if (!payload.staffId) delete payload.staffId;
      const res = await leaveService.apply(payload);
      if (res?.success) {
        setSuccess(`Leave request submitted (${res.request.status}).`);
        setForm(f => ({ ...f, reason: "" }));
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally { setSubmitting(false); }
  }

  const staffOptions = allStaff.map(s => ({ value: s.staffId, label: `${s.displayName} (${s.employeeCode})` }));
  const typeOptions = types.map(t => ({ value: t.leaveTypeId, label: `${t.name} (${t.code})` }));

  return (
    <PageShell
      header={
        <PageHeader
          title="Apply Leave"
          tag="Leave Management"
          backLabel="Back to Dashboard"
          onBack={() => navigate("/staff/leave")}
        />
      }
    >
      {error && (
        <div style={{ background: "var(--yd-danger-soft)", color: "var(--yd-danger)", border: "1px solid var(--yd-danger-border)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13 }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ background: "var(--yd-success-soft)", color: "var(--yd-success)", border: "1px solid var(--yd-success-border)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13 }}>
          {success}
        </div>
      )}

      <form onSubmit={submit}>
        <FormSection title="Request Details">
          <FormGrid cols={2}>
            {canApplyForOthers && (
              <Field label="Apply For">
                <Select value={form.staffId} onChange={(e) => set("staffId", e.target.value)} options={staffOptions} placeholder="Myself" />
              </Field>
            )}
            <Field label="Leave Type" required>
              <Select value={form.leaveTypeId} onChange={(e) => set("leaveTypeId", e.target.value)} options={typeOptions} placeholder="Select…" />
            </Field>
            <Field label="From" required>
              <Input type="date" value={form.fromDate} onChange={(e) => set("fromDate", e.target.value)} />
            </Field>
            <Field label="To" required>
              <Input type="date" value={form.toDate} onChange={(e) => set("toDate", e.target.value)} />
            </Field>
            <Field label="Half-day at start">
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={form.halfDayStart} onChange={(e) => set("halfDayStart", e.target.checked)} /> First day is half
              </label>
            </Field>
            <Field label="Half-day at end">
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={form.halfDayEnd} onChange={(e) => set("halfDayEnd", e.target.checked)} /> Last day is half
              </label>
            </Field>
          </FormGrid>
          <div style={{ marginTop: 14 }}>
            <Field label="Reason" hint="Optional context for your approver">
              <textarea value={form.reason} onChange={(e) => set("reason", e.target.value)} rows={3} className="yd-input" style={{ fontFamily: "inherit" }} />
            </Field>
          </div>
          <div style={{ marginTop: 14 }}>
            <Field label="Attachment URL (optional)">
              <Input value={form.attachmentUrl} onChange={(e) => set("attachmentUrl", e.target.value)} placeholder="https://…" />
            </Field>
          </div>

          <div style={{ marginTop: 18, padding: "12px 14px", background: "var(--yd-bg-sunken)", border: "1px solid var(--yd-border)", borderRadius: 10, fontSize: 13, color: "var(--yd-text-soft)", display: "flex", gap: 18, flexWrap: "wrap" }}>
            <span><strong style={{ color: "var(--yd-charcoal)" }}>{days}</strong> day(s) requested</span>
            {selectedBalance && (
              <span>Balance: <strong style={{ color: "var(--yd-charcoal)" }}>{selectedBalance.remaining}</strong> remaining of {selectedBalance.entitled + selectedBalance.carriedForward}</span>
            )}
            {selectedType && !selectedType.requiresApproval && (
              <span style={{ color: "var(--yd-success)", fontWeight: 600 }}>Auto-approved</span>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
            <Button type="button" variant="outline" onClick={() => navigate("/staff/leave")}>Cancel</Button>
            <Button type="submit" variant="primary" loading={submitting}>Submit Request</Button>
          </div>
        </FormSection>
      </form>
    </PageShell>
  );
}
