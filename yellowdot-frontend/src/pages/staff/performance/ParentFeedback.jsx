/**
 * ParentFeedback.jsx — Manual feedback entry + log (Parent App push integration is Phase-2+)
 */

import { useCallback, useEffect, useState } from "react";
import performanceService from "../../../services/performanceService";
import staffService from "../../../services/staffService";
import { T } from "./_shared";

const EMPTY = { staffId: "", parentName: "", studentName: "", rating: 5, comment: "", periodKey: new Date().toISOString().slice(0, 7), source: "manual_entry" };

export default function ParentFeedback() {
  const [rows, setRows]       = useState([]);
  const [staff, setStaff]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [modal, setModal]     = useState(null);
  const [saving, setSaving]   = useState(false);
  const [filter, setFilter]   = useState({ staffId: "", periodKey: "" });

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [r, s] = await Promise.all([performanceService.listFeedback(filter), staffService.getAll()]);
      if (r?.success) setRows(r.feedback || []);
      if (s?.success) setStaff(s.staff || []);
    } catch (err) { setError(err.response?.data?.error || err.message); }
    finally { setLoading(false); }
  }, [filter]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  async function save() {
    setSaving(true);
    try { await performanceService.createFeedback(modal.data); setModal(null); await load(); }
    catch (err) { alert(err.response?.data?.error || err.message); }
    finally { setSaving(false); }
  }
  async function remove(f) {
    if (!window.confirm("Delete this feedback entry?")) return;
    try { await performanceService.removeFeedback(f.feedbackId); await load(); }
    catch (err) { alert(err.response?.data?.error || err.message); }
  }

  return (
    <div style={{ background: T.bg, minHeight: "100%", padding: "24px 28px 48px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: T.goldMid }}>Performance</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: T.text, margin: "4px 0 0" }}>Parent Feedback ({rows.length})</h1>
        </div>
        <button onClick={() => setModal({ mode: "create", data: { ...EMPTY } })} style={btn(T.gold, "#1E1E1E")}>+ Add Feedback</button>
      </div>

      {error && <div style={errorBox}>{error}</div>}

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 14, marginBottom: 14, display: "flex", gap: 10, flexWrap: "wrap", boxShadow: T.shadow }}>
        <select value={filter.staffId} onChange={(e) => setFilter(f => ({ ...f, staffId: e.target.value }))} style={inp}>
          <option value="">All staff</option>
          {staff.map(s => <option key={s.staffId} value={s.staffId}>{s.displayName}</option>)}
        </select>
        <input placeholder="Period (YYYY-MM)" value={filter.periodKey} onChange={(e) => setFilter(f => ({ ...f, periodKey: e.target.value }))} style={inp} />
      </div>

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, boxShadow: T.shadow, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 880 }}>
            <thead style={{ background: T.surfaceWarm, borderBottom: `1px solid ${T.border}` }}>
              <tr>
                <th style={th}>Date</th>
                <th style={th}>Employee</th>
                <th style={th}>Parent</th>
                <th style={th}>Student</th>
                <th style={th}>Rating</th>
                <th style={th}>Comment</th>
                <th style={th}>Source</th>
                <th style={{ ...th, textAlign: "right" }}></th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={8} style={{ padding: 24, textAlign: "center", color: T.textMuted }}>Loading…</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: "center", color: T.textMuted }}>No feedback yet.</td></tr>}
              {!loading && rows.map(r => (
                <tr key={r.feedbackId} style={{ borderBottom: `1px solid ${T.border}` }}>
                  <td style={td}>{r.createdAt ? r.createdAt.slice(0, 10) : "—"}</td>
                  <td style={td}>{r.displayName}</td>
                  <td style={td}>{r.parentName || "—"}</td>
                  <td style={td}>{r.studentName || "—"}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</td>
                  <td style={{ ...td, maxWidth: 280, whiteSpace: "normal" }}>{r.comment || <span style={{ color: T.textMuted }}>—</span>}</td>
                  <td style={{ ...td, fontSize: 11, color: T.textMuted, textTransform: "uppercase" }}>{r.source}</td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <button onClick={() => remove(r)} style={{ ...mini(), color: T.red, borderColor: `${T.red}55` }}>Delete</button>
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
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, marginBottom: 14 }}>Record Feedback</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              {fld("Employee *",
                <select value={modal.data.staffId} onChange={(e) => set("staffId", e.target.value)} style={inp}>
                  <option value="">Select…</option>
                  {staff.map(s => <option key={s.staffId} value={s.staffId}>{s.displayName}</option>)}
                </select>)}
              {fld("Parent Name",  <input value={modal.data.parentName}  onChange={(e) => set("parentName", e.target.value)} style={inp} />)}
              {fld("Student Name", <input value={modal.data.studentName} onChange={(e) => set("studentName", e.target.value)} style={inp} />)}
              {fld("Period (YYYY-MM)", <input value={modal.data.periodKey} onChange={(e) => set("periodKey", e.target.value)} style={inp} />)}
              {fld("Rating (1–5) *", <input type="number" min="1" max="5" value={modal.data.rating} onChange={(e) => set("rating", Number(e.target.value) || 0)} style={inp} />)}
            </div>
            <label style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: T.textSoft }}>Comment</span>
              <textarea rows={3} value={modal.data.comment} onChange={(e) => set("comment", e.target.value)} style={{ ...inp, fontFamily: "inherit" }} />
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

const th = { textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: T.textMuted };
const td = { padding: "10px 14px", fontSize: 13, color: T.text };
const errorBox = { background: T.redLight, color: T.red, border: `1px solid ${T.red}33`, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13 };
const inp = { border: `1px solid ${T.border}`, borderRadius: 8, padding: "9px 12px", fontSize: 13, background: "#FFFFFF" };
const backdrop = { position: "fixed", inset: 0, background: "rgba(20,18,12,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 };
const card = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 22, width: "min(620px, calc(100vw - 32px))", maxHeight: "calc(100vh - 64px)", overflow: "auto" };
function btn(bg, color, border) { return { background: bg, color, border: border ? `1px solid ${border}` : "none", borderRadius: 10, padding: "9px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer" }; }
function mini() { return { background: T.surface, color: T.text, border: `1px solid ${T.border}`, borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", marginLeft: 4 }; }
