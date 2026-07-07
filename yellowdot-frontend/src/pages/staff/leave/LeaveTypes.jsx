/**
 * LeaveTypes.jsx — Master CRUD for leave types
 */

import { useCallback, useEffect, useState } from "react";
import leaveService, { GENDER_RESTRICTIONS } from "../../../services/leaveService";
import { T } from "./_shared";

const EMPTY = {
  code: "", name: "",
  annualEntitlement: 0,
  paid: true, carryForward: false, maxCarryForward: 0,
  gender: "any", requiresApproval: true,
  active: true, sortOrder: 0,
};

export default function LeaveTypes() {
  const [rows, setRows]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState("");
  const [modal, setModal]   = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const r = await leaveService.listTypes();
      if (r?.success) setRows(r.leaveTypes || []);
    } catch (err) { setError(err.response?.data?.error || err.message); }
    finally { setLoading(false); }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  function openCreate() { setModal({ mode: "create", data: { ...EMPTY } }); }
  function openEdit(d)  { setModal({ mode: "edit",   data: { ...d } }); }
  function close()      { setModal(null); }

  async function save() {
    setSaving(true);
    try {
      if (modal.mode === "create") await leaveService.createType(modal.data);
      else                         await leaveService.updateType(modal.data.leaveTypeId, modal.data);
      close(); await load();
    } catch (err) { alert(err.response?.data?.error || err.message); }
    finally { setSaving(false); }
  }
  async function toggleActive(d) {
    try { await leaveService.updateType(d.leaveTypeId, { active: !d.active }); await load(); }
    catch (err) { alert(err.response?.data?.error || err.message); }
  }
  async function remove(d) {
    if (!window.confirm(`Delete leave type "${d.name}"?`)) return;
    try { await leaveService.removeType(d.leaveTypeId); await load(); }
    catch (err) { alert(err.response?.data?.error || err.message); }
  }

  return (
    <div style={{ background: T.bg, minHeight: "100%", padding: "24px 28px 48px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: T.goldMid }}>Leave Management</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: T.text, margin: "4px 0 0" }}>Leave Types</h1>
          <div style={{ fontSize: 13, color: T.textSoft, marginTop: 4 }}>Master list of leave categories with annual entitlement, payment, and carry-forward rules.</div>
        </div>
        <button onClick={openCreate} style={btn(T.gold, "#1E1E1E")}>+ Add Leave Type</button>
      </div>

      {error && <div style={errorBox}>{error}</div>}

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, boxShadow: T.shadow, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 980 }}>
            <thead style={{ background: T.surfaceWarm, borderBottom: `1px solid ${T.border}` }}>
              <tr>
                <th style={th}>Code</th><th style={th}>Name</th>
                <th style={th}>Annual</th><th style={th}>Paid</th>
                <th style={th}>Carry-Fwd</th><th style={th}>Max CF</th>
                <th style={th}>Gender</th><th style={th}>Approval</th>
                <th style={th}>Status</th>
                <th style={{ ...th, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={10} style={{ padding: 24, textAlign: "center", color: T.textMuted }}>Loading…</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: "center", color: T.textMuted }}>No leave types — defaults seed on first dashboard visit.</td></tr>}
              {!loading && rows.map(d => (
                <tr key={d.leaveTypeId} style={{ borderBottom: `1px solid ${T.border}` }}>
                  <td style={{ ...td, fontFamily: "ui-monospace, Cascadia Code, monospace", fontSize: 12 }}>{d.code || "—"}</td>
                  <td style={td}>
                    <strong>{d.name}</strong>
                    {d.isSystem && <span style={tag}>system</span>}
                  </td>
                  <td style={td}>{d.annualEntitlement}d</td>
                  <td style={td}>{d.paid ? "Yes" : <span style={{ color: T.red }}>No</span>}</td>
                  <td style={td}>{d.carryForward ? "Yes" : "—"}</td>
                  <td style={td}>{d.carryForward ? `${d.maxCarryForward}d` : "—"}</td>
                  <td style={td}>{(GENDER_RESTRICTIONS.find(g => g.value === d.gender) || {}).label || d.gender}</td>
                  <td style={td}>{d.requiresApproval ? "Required" : "Auto"}</td>
                  <td style={td}><button onClick={() => toggleActive(d)} style={pillBtn(d.active)}>{d.active ? "Active" : "Inactive"}</button></td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <button onClick={() => openEdit(d)} style={mini()}>Edit</button>
                    {!d.isSystem && <button onClick={() => remove(d)} style={{ ...mini(), color: T.red, borderColor: `${T.red}55` }}>Delete</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div onClick={close} style={modalBackdrop}>
          <div onClick={(e) => e.stopPropagation()} style={modalCard}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{modal.mode === "create" ? "Add Leave Type" : "Edit Leave Type"}</h2>
              <button onClick={close} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: T.textMuted }}>×</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
              {fld("Code *",  <input value={modal.data.code} onChange={(e) => set("code", e.target.value)} style={inp} placeholder="CL / SL" />)}
              {fld("Name *",  <input value={modal.data.name} onChange={(e) => set("name", e.target.value)} style={inp} />)}
              {fld("Annual Entitlement (days)", <input type="number" step="0.5" value={modal.data.annualEntitlement} onChange={(e) => set("annualEntitlement", Number(e.target.value) || 0)} style={inp} />)}
              {fld("Max Carry-Forward", <input type="number" value={modal.data.maxCarryForward} onChange={(e) => set("maxCarryForward", Number(e.target.value) || 0)} style={inp} disabled={!modal.data.carryForward} />)}
              {fld("Gender", <select value={modal.data.gender} onChange={(e) => set("gender", e.target.value)} style={inp}>{GENDER_RESTRICTIONS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}</select>)}
              {fld("Sort Order", <input type="number" value={modal.data.sortOrder} onChange={(e) => set("sortOrder", Number(e.target.value) || 0)} style={inp} />)}
              {fld("Paid?",            check("paid"))}
              {fld("Carry-forward?",   check("carryForward"))}
              {fld("Requires approval?", check("requiresApproval"))}
              {fld("Active?",          check("active"))}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18, borderTop: `1px solid ${T.border}`, paddingTop: 14 }}>
              <button onClick={close} style={btn(T.surface, T.text, T.border)}>Cancel</button>
              <button onClick={save} disabled={saving} style={btn(T.gold, "#1E1E1E")}>{saving ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function set(k, v) { setModal(m => ({ ...m, data: { ...m.data, [k]: v } })); }
  function check(k) {
    return <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
      <input type="checkbox" checked={Boolean(modal.data[k])} onChange={(e) => set(k, e.target.checked)} />
      {k.replace(/([A-Z])/g, " $1").trim()}
    </label>;
  }
}

function fld(label, control) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: T.textSoft }}>{label}</span>
      {control}
    </label>
  );
}

const th = { textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: T.textMuted };
const td = { padding: "10px 14px", fontSize: 13, color: T.text };
const errorBox = { background: T.redLight, color: T.red, border: `1px solid ${T.red}33`, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13 };
const tag = { marginLeft: 6, fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 4, background: "#FFF7E0", border: "1px solid rgba(244,196,0,0.35)", color: T.goldMid, textTransform: "uppercase" };
const modalBackdrop = { position: "fixed", inset: 0, background: "rgba(20,18,12,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 };
const modalCard = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 22, width: "min(680px, calc(100vw - 32px))", maxHeight: "calc(100vh - 64px)", overflow: "auto", boxShadow: "0 24px 80px rgba(0,0,0,0.20)" };
const inp = { border: `1px solid ${T.border}`, borderRadius: 8, padding: "9px 12px", fontSize: 13, background: "#FFFFFF" };
function btn(bg, color, border) {
  return { background: bg, color, border: border ? `1px solid ${border}` : "none", borderRadius: 10, padding: "9px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer" };
}
function mini() { return { background: T.surface, color: T.text, border: `1px solid ${T.border}`, borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", marginLeft: 6 }; }
function pillBtn(active) { return { background: active ? "#f0fdf4" : T.surfaceWarm, color: active ? T.green : T.textMuted, border: `1px solid ${active ? "#bbf7d0" : T.border}`, borderRadius: 999, padding: "3px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }; }
