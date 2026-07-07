/**
 * StaffSalary.jsx — Per-staff salary assignment + overrides.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import payrollService from "../../../services/payrollService";
import staffService from "../../../services/staffService";
import { T, inr } from "./_shared";

export default function StaffSalary() {
  const [staff, setStaff]         = useState([]);
  const [salaries, setSalaries]   = useState({});
  const [structures, setStructures] = useState([]);
  const [components, setComponents] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [search, setSearch]       = useState("");
  const [selected, setSelected]   = useState(null); // staff being edited
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

  const filtered = useMemo(() => {
    if (!search) return staff;
    const q = search.toLowerCase();
    return staff.filter(s =>
      (s.displayName || "").toLowerCase().includes(q) ||
      (s.employeeCode || "").toLowerCase().includes(q));
  }, [staff, search]);

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

  return (
    <div style={{ background: T.bg, minHeight: "100%", padding: "24px 28px 48px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: T.goldMid }}>Payroll</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: T.text, margin: "4px 0 0" }}>Staff Salaries</h1>
        </div>
        <input
          placeholder="Search employees…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: "9px 12px", fontSize: 13, background: T.surfaceWarm, minWidth: 240 }}
        />
      </div>

      {error && <div style={errorBox}>{error}</div>}

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, boxShadow: T.shadow, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 880 }}>
            <thead style={{ background: T.surfaceWarm, borderBottom: `1px solid ${T.border}` }}>
              <tr>
                <th style={th}>Employee</th>
                <th style={th}>Structure</th>
                <th style={th}>Monthly CTC</th>
                <th style={th}>Payment Mode</th>
                <th style={th}>Bank A/C</th>
                <th style={{ ...th, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: T.textMuted }}>Loading…</td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: T.textMuted }}>No staff records.</td></tr>}
              {!loading && filtered.map(s => {
                const sal = salaries[s.staffId];
                const st  = sal ? structures.find(x => x.structureId === sal.structureId) : null;
                return (
                  <tr key={s.staffId} style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{s.displayName}</div>
                      <div style={{ fontSize: 11, color: T.textMuted, fontFamily: "ui-monospace, Cascadia Code, monospace" }}>{s.employeeCode}</div>
                    </td>
                    <td style={td}>{st ? st.name : (sal ? <span style={{ color: T.textMuted }}>(custom)</span> : <span style={{ color: T.textMuted }}>—</span>)}</td>
                    <td style={td}>{sal ? inr(sal.monthlyCtc) : <span style={{ color: T.textMuted }}>—</span>}</td>
                    <td style={td}>{sal?.paymentMode || "—"}</td>
                    <td style={td}>{sal?.bankAccountLast4 ? `XXXX${sal.bankAccountLast4}` : "—"}</td>
                    <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                      <button onClick={() => openEdit(s)} style={mini()}>{sal ? "Edit" : "Set Salary"}</button>
                      {sal && <button onClick={() => remove(s.staffId)} style={{ ...mini(), color: T.red, borderColor: `${T.red}55` }}>Clear</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selected && draft && (
        <div onClick={() => { setSelected(null); setDraft(null); }} style={backdrop}>
          <div onClick={(e) => e.stopPropagation()} style={card}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{selected.displayName}</h2>
            <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 16, fontFamily: "ui-monospace, Cascadia Code, monospace" }}>{selected.employeeCode}</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {fld("Structure",
                <select value={draft.structureId} onChange={(e) => selectStructure(e.target.value)} style={inp}>
                  <option value="">(custom — no template)</option>
                  {structures.map(s => <option key={s.structureId} value={s.structureId}>{s.name} · {inr(s.monthlyCtc)}</option>)}
                </select>)}
              {fld("Monthly CTC (₹)", <input type="number" value={draft.monthlyCtc} onChange={(e) => set("monthlyCtc", Number(e.target.value) || 0)} style={inp} />)}
              {fld("Payment Mode",   <input value={draft.paymentMode} onChange={(e) => set("paymentMode", e.target.value)} style={inp} placeholder="Bank Transfer / UPI / Cheque" />)}
              {fld("Bank Name",      <input value={draft.bankName}    onChange={(e) => set("bankName", e.target.value)} style={inp} />)}
              {fld("IFSC",           <input value={draft.ifsc}        onChange={(e) => set("ifsc", e.target.value)} style={inp} />)}
              {fld("A/C (last 4)",   <input value={draft.bankAccountLast4} maxLength={4} onChange={(e) => set("bankAccountLast4", e.target.value)} style={inp} />)}
              {fld("Effective From", <input type="date" value={draft.effectiveFrom} onChange={(e) => set("effectiveFrom", e.target.value)} style={inp} />)}
            </div>

            <div style={{ fontSize: 12, fontWeight: 700, color: T.textSoft, textTransform: "uppercase", letterSpacing: "0.06em", margin: "16px 0 8px" }}>Component Overrides</div>
            <div style={{ maxHeight: 260, overflowY: "auto", border: `1px solid ${T.border}`, borderRadius: 10 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead style={{ background: T.surfaceWarm }}>
                  <tr><th style={th}>Component</th><th style={th}>Kind</th><th style={th}>Type</th><th style={th}>Amount (₹)</th></tr>
                </thead>
                <tbody>
                  {components.filter(c => c.type === "fixed").map(c => (
                    <tr key={c.componentId} style={{ borderBottom: `1px solid ${T.border}` }}>
                      <td style={td}>{c.name}</td>
                      <td style={td}>{c.kind === "earning" ? "Earning" : "Deduction"}</td>
                      <td style={td}>fixed</td>
                      <td style={td}>
                        <input type="number" value={draft.overrides[c.componentId] ?? c.amount} onChange={(e) => set("overrides", { ...draft.overrides, [c.componentId]: Number(e.target.value) || 0 })} style={{ ...inp, width: 130 }} />
                      </td>
                    </tr>
                  ))}
                  {components.filter(c => c.type === "percent_basic").map(c => (
                    <tr key={c.componentId} style={{ borderBottom: `1px solid ${T.border}` }}>
                      <td style={td}>{c.name}</td>
                      <td style={td}>{c.kind === "earning" ? "Earning" : "Deduction"}</td>
                      <td style={td}>% of Basic</td>
                      <td style={td}>
                        <input type="number" placeholder={`${c.percent}%`} value={draft.overrides[`${c.componentId}__percent`] ?? ""} onChange={(e) => set("overrides", { ...draft.overrides, [`${c.componentId}__percent`]: Number(e.target.value) || 0 })} style={{ ...inp, width: 130 }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18, borderTop: `1px solid ${T.border}`, paddingTop: 14 }}>
              <button onClick={() => { setSelected(null); setDraft(null); }} style={btn(T.surface, T.text, T.border)}>Cancel</button>
              <button onClick={save} disabled={saving} style={btn(T.gold, "#1E1E1E")}>{saving ? "Saving…" : "Save Salary"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function set(k, v) { setDraft(d => ({ ...d, [k]: v })); }
}

function fld(label, control) {
  return <label style={{ display: "flex", flexDirection: "column", gap: 6 }}><span style={{ fontSize: 12, fontWeight: 600, color: T.textSoft }}>{label}</span>{control}</label>;
}

const th = { textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: T.textMuted };
const td = { padding: "10px 14px", fontSize: 13, color: T.text };
const errorBox = { background: T.redLight, color: T.red, border: `1px solid ${T.red}33`, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13 };
const inp = { border: `1px solid ${T.border}`, borderRadius: 8, padding: "9px 12px", fontSize: 13, background: "#FFFFFF" };
const backdrop = { position: "fixed", inset: 0, background: "rgba(20,18,12,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 };
const card = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 22, width: "min(820px, calc(100vw - 32px))", maxHeight: "calc(100vh - 64px)", overflow: "auto" };
function btn(bg, color, border) { return { background: bg, color, border: border ? `1px solid ${border}` : "none", borderRadius: 10, padding: "9px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer" }; }
function mini() { return { background: T.surface, color: T.text, border: `1px solid ${T.border}`, borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", marginLeft: 6 }; }
