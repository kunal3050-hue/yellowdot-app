/**
 * LeaveApply.jsx — Self-service leave application form.
 * Managers can also apply on behalf of another staff member.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../contexts/AuthContext";
import leaveService from "../../../services/leaveService";
import staffService from "../../../services/staffService";
import { T } from "./_shared";

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
    staffId: "",       // empty = self
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

  // When staff changes (manager applying on behalf), refresh balances
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

  async function submit(e) {
    e?.preventDefault();
    setError(""); setSuccess("");
    if (!form.leaveTypeId)              { setError("Choose a leave type."); return; }
    if (!form.fromDate || !form.toDate) { setError("Pick from / to dates."); return; }
    if (form.fromDate > form.toDate)    { setError("From date must be on or before to date."); return; }

    setSubmitting(true);
    try {
      const payload = { ...form };
      if (!payload.staffId) delete payload.staffId; // self-apply
      const res = await leaveService.apply(payload);
      if (res?.success) {
        setSuccess(`Leave request submitted (${res.request.status}).`);
        setForm(f => ({ ...f, reason: "" }));
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally { setSubmitting(false); }
  }

  return (
    <div style={{ background: T.bg, minHeight: "100%", padding: "24px 28px 48px" }}>
      <div style={{ marginBottom: 18 }}>
        <button onClick={() => navigate("/staff/leave")} style={{ background: "none", border: "none", color: T.goldMid, fontWeight: 600, fontSize: 12, cursor: "pointer", padding: 0, marginBottom: 4 }}>‹ Back to Dashboard</button>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: T.goldMid }}>Leave Management</div>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: T.text, margin: "4px 0 0" }}>Apply Leave</h1>
      </div>

      {error   && <div style={errorBox}>{error}</div>}
      {success && <div style={successBox}>{success}</div>}

      <form onSubmit={submit} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 22, boxShadow: T.shadow }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          {canApplyForOthers && fld("Apply For",
            <select value={form.staffId} onChange={(e) => set("staffId", e.target.value)} style={inp}>
              <option value="">Myself</option>
              {allStaff.map(s => <option key={s.staffId} value={s.staffId}>{s.displayName} ({s.employeeCode})</option>)}
            </select>
          )}
          {fld("Leave Type *",
            <select value={form.leaveTypeId} onChange={(e) => set("leaveTypeId", e.target.value)} style={inp}>
              <option value="">Select…</option>
              {types.map(t => <option key={t.leaveTypeId} value={t.leaveTypeId}>{t.name} ({t.code})</option>)}
            </select>
          )}
          {fld("From *",
            <input type="date" value={form.fromDate} onChange={(e) => set("fromDate", e.target.value)} style={inp} />
          )}
          {fld("To *",
            <input type="date" value={form.toDate} onChange={(e) => set("toDate", e.target.value)} style={inp} />
          )}
          {fld("Half-day at start",
            <label style={ck}><input type="checkbox" checked={form.halfDayStart} onChange={(e) => set("halfDayStart", e.target.checked)} /> First day is half</label>
          )}
          {fld("Half-day at end",
            <label style={ck}><input type="checkbox" checked={form.halfDayEnd} onChange={(e) => set("halfDayEnd", e.target.checked)} /> Last day is half</label>
          )}
          {fld("Reason",
            <textarea value={form.reason} onChange={(e) => set("reason", e.target.value)} rows={3} style={{ ...inp, fontFamily: "inherit" }} placeholder="Optional context for your approver" />
          )}
          {fld("Attachment URL (optional)",
            <input value={form.attachmentUrl} onChange={(e) => set("attachmentUrl", e.target.value)} style={inp} placeholder="https://…" />
          )}
        </div>

        <div style={{ marginTop: 18, padding: "12px 14px", background: T.surfaceWarm, border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 13, color: T.textSoft, display: "flex", gap: 18, flexWrap: "wrap" }}>
          <span><strong style={{ color: T.text }}>{days}</strong> day(s) requested</span>
          {selectedBalance && (
            <span>Balance: <strong style={{ color: T.text }}>{selectedBalance.remaining}</strong> remaining of {selectedBalance.entitled + selectedBalance.carriedForward}</span>
          )}
          {selectedType && !selectedType.requiresApproval && (
            <span style={{ color: T.green, fontWeight: 600 }}>Auto-approved</span>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
          <button type="button" onClick={() => navigate("/staff/leave")} style={btn(T.surface, T.text, T.border)}>Cancel</button>
          <button type="submit" disabled={submitting} style={btn(T.gold, "#1E1E1E")}>{submitting ? "Submitting…" : "Submit Request"}</button>
        </div>
      </form>
    </div>
  );

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }
}

function fld(label, control) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: T.textSoft }}>{label}</span>
      {control}
    </label>
  );
}

const errorBox   = { background: T.redLight, color: T.red, border: `1px solid ${T.red}33`, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13 };
const successBox = { background: "#f0fdf4", color: T.green, border: "1px solid #bbf7d0", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13 };
const inp = { border: `1px solid ${T.border}`, borderRadius: 8, padding: "9px 12px", fontSize: 13, background: "#FFFFFF" };
const ck  = { display: "flex", alignItems: "center", gap: 8, fontSize: 13 };
function btn(bg, color, border) {
  return { background: bg, color, border: border ? `1px solid ${border}` : "none", borderRadius: 10, padding: "10px 18px", fontWeight: 600, fontSize: 13, cursor: "pointer" };
}
