/**
 * PerformanceKpis.jsx — KPI master CRUD.
 */

import { useCallback, useEffect, useState } from "react";
import performanceService from "../../../services/performanceService";
import { T } from "./_shared";

const EMPTY = { code: "", name: "", type: "score", target: 0, weight: 0, lowerIsBetter: false, active: true, sortOrder: 0 };

const TYPES = [
  { value: "percent",  label: "Percent" },
  { value: "score",    label: "Score" },
  { value: "count",    label: "Count" },
  { value: "currency", label: "Currency" },
  { value: "boolean",  label: "Boolean" },
];

export default function PerformanceKpis() {
  const [rows, setRows]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState("");
  const [modal, setModal]   = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const r = await performanceService.listKpis();
      if (r?.success) setRows(r.kpis || []);
    } catch (err) { setError(err.response?.data?.error || err.message); }
    finally { setLoading(false); }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  async function save() {
    setSaving(true);
    try {
      if (modal.mode === "create") await performanceService.createKpi(modal.data);
      else                          await performanceService.updateKpi(modal.data.kpiId, modal.data);
      setModal(null); await load();
    } catch (err) { alert(err.response?.data?.error || err.message); }
    finally { setSaving(false); }
  }

  async function remove(k) {
    if (!window.confirm(`Delete KPI "${k.name}"?`)) return;
    try { await performanceService.removeKpi(k.kpiId); await load(); }
    catch (err) { alert(err.response?.data?.error || err.message); }
  }

  return (
    <div style={{ background: T.bg, minHeight: "100%", padding: "24px 28px 48px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: T.goldMid }}>Performance</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: T.text, margin: "4px 0 0" }}>KPIs</h1>
          <div style={{ fontSize: 13, color: T.textSoft, marginTop: 4 }}>Key performance indicators used in review forms.</div>
        </div>
        <button onClick={() => setModal({ mode: "create", data: { ...EMPTY } })} style={btn(T.gold, "#1E1E1E")}>+ Add KPI</button>
      </div>

      {error && <div style={errorBox}>{error}</div>}

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, boxShadow: T.shadow, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 820 }}>
            <thead style={{ background: T.surfaceWarm, borderBottom: `1px solid ${T.border}` }}>
              <tr>
                <th style={th}>Code</th><th style={th}>Name</th>
                <th style={th}>Type</th><th style={th}>Target</th>
                <th style={th}>Weight</th><th style={th}>Direction</th>
                <th style={th}>Status</th>
                <th style={{ ...th, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={8} style={{ padding: 24, textAlign: "center", color: T.textMuted }}>Loading…</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: "center", color: T.textMuted }}>No KPIs — defaults seed on first dashboard visit.</td></tr>}
              {!loading && rows.map(k => (
                <tr key={k.kpiId} style={{ borderBottom: `1px solid ${T.border}` }}>
                  <td style={{ ...td, fontFamily: "ui-monospace, Cascadia Code, monospace", fontSize: 12 }}>{k.code || "—"}</td>
                  <td style={td}>{k.name}{k.isSystem && <span style={tag}>system</span>}</td>
                  <td style={td}>{k.type}</td>
                  <td style={td}>{k.target}</td>
                  <td style={td}>{k.weight}%</td>
                  <td style={td}>{k.lowerIsBetter ? "Lower-is-better" : "Higher-is-better"}</td>
                  <td style={td}>{k.active ? <span style={{ color: T.green }}>Active</span> : <span style={{ color: T.textMuted }}>Inactive</span>}</td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <button onClick={() => setModal({ mode: "edit", data: { ...k } })} style={mini()}>Edit</button>
                    {!k.isSystem && <button onClick={() => remove(k)} style={{ ...mini(), color: T.red, borderColor: `${T.red}55` }}>Delete</button>}
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
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, marginBottom: 14 }}>{modal.mode === "create" ? "Add KPI" : "Edit KPI"}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
              {fld("Code",  <input value={modal.data.code} onChange={(e) => set("code", e.target.value)} style={inp} />)}
              {fld("Name *",<input value={modal.data.name} onChange={(e) => set("name", e.target.value)} style={inp} />)}
              {fld("Type",
                <select value={modal.data.type} onChange={(e) => set("type", e.target.value)} style={inp}>
                  {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>)}
              {fld("Target",       <input type="number" value={modal.data.target} onChange={(e) => set("target", Number(e.target.value) || 0)} style={inp} />)}
              {fld("Weight (%)",   <input type="number" value={modal.data.weight} onChange={(e) => set("weight", Number(e.target.value) || 0)} style={inp} />)}
              {fld("Sort Order",   <input type="number" value={modal.data.sortOrder} onChange={(e) => set("sortOrder", Number(e.target.value) || 0)} style={inp} />)}
              {fld("Lower-is-better?", <label style={ck}><input type="checkbox" checked={modal.data.lowerIsBetter} onChange={(e) => set("lowerIsBetter", e.target.checked)} /> Less is better</label>)}
              {fld("Active?",          <label style={ck}><input type="checkbox" checked={modal.data.active}        onChange={(e) => set("active",        e.target.checked)} /> Active</label>)}
            </div>
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

function fld(label, control) { return <label style={{ display: "flex", flexDirection: "column", gap: 6 }}><span style={{ fontSize: 12, fontWeight: 600, color: T.textSoft }}>{label}</span>{control}</label>; }

const th = { textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: T.textMuted };
const td = { padding: "10px 14px", fontSize: 13, color: T.text };
const errorBox = { background: T.redLight, color: T.red, border: `1px solid ${T.red}33`, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13 };
const inp = { border: `1px solid ${T.border}`, borderRadius: 8, padding: "9px 12px", fontSize: 13, background: "#FFFFFF" };
const ck  = { display: "flex", alignItems: "center", gap: 8, fontSize: 13 };
const tag = { marginLeft: 6, fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 4, background: "#FFF7E0", border: "1px solid rgba(244,196,0,0.35)", color: T.goldMid, textTransform: "uppercase" };
const backdrop = { position: "fixed", inset: 0, background: "rgba(20,18,12,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 };
const card = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 22, width: "min(640px, calc(100vw - 32px))", maxHeight: "calc(100vh - 64px)", overflow: "auto" };
function btn(bg, color, border) { return { background: bg, color, border: border ? `1px solid ${border}` : "none", borderRadius: 10, padding: "9px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer" }; }
function mini() { return { background: T.surface, color: T.text, border: `1px solid ${T.border}`, borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", marginLeft: 6 }; }
