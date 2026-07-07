/**
 * SalaryStructures.jsx — Salary templates that bundle component allocations.
 */

import { useCallback, useEffect, useState } from "react";
import payrollService from "../../../services/payrollService";
import { T, inr } from "./_shared";

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

  return (
    <div style={{ background: T.bg, minHeight: "100%", padding: "24px 28px 48px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: T.goldMid }}>Payroll</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: T.text, margin: "4px 0 0" }}>Salary Structures</h1>
          <div style={{ fontSize: 13, color: T.textSoft, marginTop: 4 }}>Named templates (e.g. "Teacher CTC") with default component amounts.</div>
        </div>
        <button onClick={() => setModal({ mode: "create", data: { ...EMPTY, componentAmounts: {} } })} style={btn(T.gold, "#1E1E1E")}>+ Add Structure</button>
      </div>

      {error && <div style={errorBox}>{error}</div>}

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, boxShadow: T.shadow, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 720 }}>
            <thead style={{ background: T.surfaceWarm, borderBottom: `1px solid ${T.border}` }}>
              <tr>
                <th style={th}>Name</th>
                <th style={th}>Monthly CTC</th>
                <th style={th}>Components</th>
                <th style={th}>Status</th>
                <th style={{ ...th, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", color: T.textMuted }}>Loading…</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", color: T.textMuted }}>No structures yet.</td></tr>}
              {!loading && rows.map(s => (
                <tr key={s.structureId} style={{ borderBottom: `1px solid ${T.border}` }}>
                  <td style={td}><strong>{s.name}</strong></td>
                  <td style={td}>{inr(s.monthlyCtc)}</td>
                  <td style={td}>{Object.keys(s.componentAmounts || {}).length} customised</td>
                  <td style={td}>{s.active ? <span style={{ color: T.green }}>Active</span> : <span style={{ color: T.textMuted }}>Inactive</span>}</td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <button onClick={() => setModal({ mode: "edit", data: { ...s, componentAmounts: { ...(s.componentAmounts || {}) } } })} style={mini()}>Edit</button>
                    <button onClick={() => remove(s)} style={{ ...mini(), color: T.red, borderColor: `${T.red}55` }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div onClick={() => setModal(null)} style={backdrop}>
          <div onClick={(e) => e.stopPropagation()} style={card}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, marginBottom: 14 }}>{modal.mode === "create" ? "Add Structure" : "Edit Structure"}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: T.textSoft }}>Name *</span>
                <input value={modal.data.name} onChange={(e) => set("name", e.target.value)} style={inp} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: T.textSoft }}>Monthly CTC (₹)</span>
                <input type="number" value={modal.data.monthlyCtc} onChange={(e) => set("monthlyCtc", Number(e.target.value) || 0)} style={inp} />
              </label>
            </div>

            <div style={{ fontSize: 12, fontWeight: 700, color: T.textSoft, textTransform: "uppercase", letterSpacing: "0.06em", margin: "8px 0" }}>Component Allocations (fixed only)</div>
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
                      <td style={td}>{c.type}</td>
                      <td style={td}>
                        <input
                          type="number"
                          value={modal.data.componentAmounts[c.componentId] ?? c.amount}
                          onChange={(e) => set("componentAmounts", { ...modal.data.componentAmounts, [c.componentId]: Number(e.target.value) || 0 })}
                          style={{ ...inp, width: 130 }}
                        />
                      </td>
                    </tr>
                  ))}
                  {components.filter(c => c.type !== "fixed").map(c => (
                    <tr key={c.componentId} style={{ borderBottom: `1px solid ${T.border}` }}>
                      <td style={td}>{c.name}</td>
                      <td style={td}>{c.kind === "earning" ? "Earning" : "Deduction"}</td>
                      <td style={td}>{c.type}{c.percent ? ` · ${c.percent}%` : ""}</td>
                      <td style={{ ...td, color: T.textMuted, fontStyle: "italic" }}>derived</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginTop: 12 }}>
              <input type="checkbox" checked={modal.data.active} onChange={(e) => set("active", e.target.checked)} /> Active
            </label>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18, borderTop: `1px solid ${T.border}`, paddingTop: 14 }}>
              <button onClick={() => setModal(null)} style={btn(T.surface, T.text, T.border)}>Cancel</button>
              <button onClick={save} disabled={saving} style={btn(T.gold, "#1E1E1E")}>{saving ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function set(k, v) { setModal(m => ({ ...m, data: { ...m.data, [k]: v } })); }
}

const th = { textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: T.textMuted };
const td = { padding: "10px 14px", fontSize: 13, color: T.text };
const errorBox = { background: T.redLight, color: T.red, border: `1px solid ${T.red}33`, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13 };
const inp = { border: `1px solid ${T.border}`, borderRadius: 8, padding: "9px 12px", fontSize: 13, background: "#FFFFFF" };
const backdrop = { position: "fixed", inset: 0, background: "rgba(20,18,12,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 };
const card = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 22, width: "min(780px, calc(100vw - 32px))", maxHeight: "calc(100vh - 64px)", overflow: "auto" };
function btn(bg, color, border) { return { background: bg, color, border: border ? `1px solid ${border}` : "none", borderRadius: 10, padding: "9px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer" }; }
function mini() { return { background: T.surface, color: T.text, border: `1px solid ${T.border}`, borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", marginLeft: 6 }; }
