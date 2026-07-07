/**
 * AwardsPromotions.jsx — Combined view of Awards + Promotion history.
 */

import { useCallback, useEffect, useState } from "react";
import performanceService from "../../../services/performanceService";
import staffService from "../../../services/staffService";
import { T } from "./_shared";

export default function AwardsPromotions() {
  const [tab, setTab]         = useState("awards");
  const [awards, setAwards]   = useState([]);
  const [promotions, setProm] = useState([]);
  const [staff, setStaff]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [modal, setModal]     = useState(null);
  const [saving, setSaving]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [a, p, s] = await Promise.all([performanceService.listAwards(), performanceService.listPromotions(), staffService.getAll()]);
      if (a?.success) setAwards(a.awards || []);
      if (p?.success) setProm(p.promotions || []);
      if (s?.success) setStaff(s.staff || []);
    } catch (err) { setError(err.response?.data?.error || err.message); }
    finally { setLoading(false); }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  async function save() {
    setSaving(true);
    try {
      if (modal.type === "award")     await performanceService.createAward(modal.data);
      if (modal.type === "promotion") await performanceService.createPromotion(modal.data);
      setModal(null); await load();
    } catch (err) { alert(err.response?.data?.error || err.message); }
    finally { setSaving(false); }
  }
  async function removeRow(type, id) {
    if (!window.confirm(`Delete ${type}?`)) return;
    try {
      if (type === "award")     await performanceService.removeAward(id);
      if (type === "promotion") await performanceService.removePromotion(id);
      await load();
    } catch (err) { alert(err.response?.data?.error || err.message); }
  }

  return (
    <div style={{ background: T.bg, minHeight: "100%", padding: "24px 28px 48px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: T.goldMid }}>Performance</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: T.text, margin: "4px 0 0" }}>Awards & Promotions</h1>
        </div>
        <button
          onClick={() => setModal(tab === "awards"
            ? { type: "award",     data: { staffId: "", title: "", category: "recognition", awardedOn: new Date().toISOString().slice(0,10), citation: "" } }
            : { type: "promotion", data: { staffId: "", effectiveDate: new Date().toISOString().slice(0,10), toDesignation: "", salaryChange: 0, citation: "" } })}
          style={btn(T.gold, "#1E1E1E")}
        >+ Add {tab === "awards" ? "Award" : "Promotion"}</button>
      </div>

      {error && <div style={errorBox}>{error}</div>}

      <div style={{ display: "flex", gap: 4, marginBottom: 14, borderBottom: `1px solid ${T.border}` }}>
        {[["awards","Awards"],["promotions","Promotions"]].map(([id, label]) => {
          const active = tab === id;
          return (
            <button key={id} onClick={() => setTab(id)} style={{ background: "none", border: "none", padding: "10px 16px", cursor: "pointer", fontSize: 13, fontWeight: active ? 700 : 500, color: active ? T.text : T.textSoft, borderBottom: `2px solid ${active ? T.gold : "transparent"}`, marginBottom: -1 }}>{label}</button>
          );
        })}
      </div>

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, boxShadow: T.shadow, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          {tab === "awards" ? (
            <table style={tbl}>
              <thead style={thead}><tr>
                <th style={th}>Date</th><th style={th}>Title</th><th style={th}>Employee</th><th style={th}>Category</th><th style={th}>Citation</th><th style={{ ...th, textAlign: "right" }}></th>
              </tr></thead>
              <tbody>
                {loading && <tr><td colSpan={6} style={td}>Loading…</td></tr>}
                {!loading && awards.length === 0 && <tr><td colSpan={6} style={{ ...td, textAlign: "center", color: T.textMuted }}>No awards recorded yet.</td></tr>}
                {!loading && awards.map(a => (
                  <tr key={a.awardId} style={tr}>
                    <td style={td}>{a.awardedOn}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{a.title}</td>
                    <td style={td}>{a.displayName}</td>
                    <td style={td}>{a.category}</td>
                    <td style={{ ...td, maxWidth: 320, whiteSpace: "normal" }}>{a.citation || "—"}</td>
                    <td style={{ ...td, textAlign: "right" }}>
                      <button onClick={() => removeRow("award", a.awardId)} style={{ ...mini(), color: T.red, borderColor: `${T.red}55` }}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table style={tbl}>
              <thead style={thead}><tr>
                <th style={th}>Effective</th><th style={th}>Employee</th><th style={th}>From</th><th style={th}>To</th><th style={th}>Salary Δ</th><th style={th}>Citation</th><th style={{ ...th, textAlign: "right" }}></th>
              </tr></thead>
              <tbody>
                {loading && <tr><td colSpan={7} style={td}>Loading…</td></tr>}
                {!loading && promotions.length === 0 && <tr><td colSpan={7} style={{ ...td, textAlign: "center", color: T.textMuted }}>No promotions recorded yet.</td></tr>}
                {!loading && promotions.map(p => (
                  <tr key={p.promotionId} style={tr}>
                    <td style={td}>{p.effectiveDate}</td>
                    <td style={td}>{p.displayName}</td>
                    <td style={td}>{p.fromDesignation || "—"}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{p.toDesignation}</td>
                    <td style={td}>{p.salaryChange ? `₹ ${p.salaryChange.toLocaleString("en-IN")}` : "—"}</td>
                    <td style={{ ...td, maxWidth: 280, whiteSpace: "normal" }}>{p.citation || "—"}</td>
                    <td style={{ ...td, textAlign: "right" }}>
                      <button onClick={() => removeRow("promotion", p.promotionId)} style={{ ...mini(), color: T.red, borderColor: `${T.red}55` }}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modal && (
        <div onClick={() => setModal(null)} style={backdrop}>
          <div onClick={(e) => e.stopPropagation()} style={card}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, marginBottom: 14 }}>{modal.type === "award" ? "New Award" : "New Promotion"}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              {fld("Employee *",
                <select value={modal.data.staffId} onChange={(e) => set("staffId", e.target.value)} style={inp}>
                  <option value="">Select…</option>
                  {staff.map(s => <option key={s.staffId} value={s.staffId}>{s.displayName}</option>)}
                </select>)}
              {modal.type === "award" && fld("Title *",    <input value={modal.data.title}    onChange={(e) => set("title",    e.target.value)} style={inp} />)}
              {modal.type === "award" && fld("Category",   <input value={modal.data.category} onChange={(e) => set("category", e.target.value)} style={inp} placeholder="recognition / award / kudos" />)}
              {modal.type === "award" && fld("Awarded On", <input type="date" value={modal.data.awardedOn} onChange={(e) => set("awardedOn", e.target.value)} style={inp} />)}
              {modal.type === "promotion" && fld("Effective Date *",  <input type="date" value={modal.data.effectiveDate} onChange={(e) => set("effectiveDate", e.target.value)} style={inp} />)}
              {modal.type === "promotion" && fld("From Designation",  <input value={modal.data.fromDesignation || ""} onChange={(e) => set("fromDesignation", e.target.value)} style={inp} />)}
              {modal.type === "promotion" && fld("To Designation *",  <input value={modal.data.toDesignation || ""}   onChange={(e) => set("toDesignation",   e.target.value)} style={inp} />)}
              {modal.type === "promotion" && fld("Salary Change (₹)", <input type="number" value={modal.data.salaryChange} onChange={(e) => set("salaryChange", Number(e.target.value) || 0)} style={inp} />)}
            </div>
            <label style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: T.textSoft }}>Citation</span>
              <textarea rows={3} value={modal.data.citation} onChange={(e) => set("citation", e.target.value)} style={{ ...inp, fontFamily: "inherit" }} />
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

function fld(label, control) { return <label style={{ display: "flex", flexDirection: "column", gap: 6 }}><span style={{ fontSize: 12, fontWeight: 600, color: T.textSoft }}>{label}</span>{control}</label>; }

const tbl = { width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 880 };
const thead = { background: T.surfaceWarm, borderBottom: `1px solid ${T.border}` };
const th = { textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: T.textMuted };
const td = { padding: "10px 14px", fontSize: 13, color: T.text };
const tr = { borderBottom: `1px solid ${T.border}` };
const errorBox = { background: T.redLight, color: T.red, border: `1px solid ${T.red}33`, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13 };
const inp = { border: `1px solid ${T.border}`, borderRadius: 8, padding: "9px 12px", fontSize: 13, background: "#FFFFFF" };
const backdrop = { position: "fixed", inset: 0, background: "rgba(20,18,12,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 };
const card = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 22, width: "min(680px, calc(100vw - 32px))", maxHeight: "calc(100vh - 64px)", overflow: "auto" };
function btn(bg, color, border) { return { background: bg, color, border: border ? `1px solid ${border}` : "none", borderRadius: 10, padding: "9px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer" }; }
function mini() { return { background: T.surface, color: T.text, border: `1px solid ${T.border}`, borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", marginLeft: 4 }; }
