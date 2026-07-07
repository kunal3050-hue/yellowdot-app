/**
 * PerformanceGoals.jsx — SMART goals per staff with quick status toggle.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import performanceService, { GOAL_STATUS_META } from "../../../services/performanceService";
import staffService from "../../../services/staffService";
import { T, pillStyle } from "./_shared";

const EMPTY = { staffId: "", title: "", description: "", period: "", targetDate: "", weight: 0, progress: 0, status: "not_started", notes: "" };

export default function PerformanceGoals() {
  const [goals, setGoals]     = useState([]);
  const [staff, setStaff]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [modal, setModal]     = useState(null);
  const [saving, setSaving]   = useState(false);
  const [filter, setFilter]   = useState({ staffId: "", status: "" });

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [g, s] = await Promise.all([performanceService.listGoals(), staffService.getAll()]);
      if (g?.success) setGoals(g.goals || []);
      if (s?.success) setStaff(s.staff || []);
    } catch (err) { setError(err.response?.data?.error || err.message); }
    finally { setLoading(false); }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => goals.filter(g =>
    (!filter.staffId || g.staffId === filter.staffId) && (!filter.status || g.status === filter.status)
  ), [goals, filter]);

  function openCreate() { setModal({ mode: "create", data: { ...EMPTY } }); }
  function openEdit(g)  { setModal({ mode: "edit",   data: { ...g } }); }

  async function save() {
    setSaving(true);
    try { await performanceService.saveGoal(modal.data); setModal(null); await load(); }
    catch (err) { alert(err.response?.data?.error || err.message); }
    finally { setSaving(false); }
  }
  async function remove(g) {
    if (!window.confirm(`Delete goal "${g.title}"?`)) return;
    try { await performanceService.removeGoal(g.goalId); await load(); }
    catch (err) { alert(err.response?.data?.error || err.message); }
  }
  async function quickStatus(g, status) {
    try { await performanceService.saveGoal({ ...g, status }); await load(); }
    catch (err) { alert(err.response?.data?.error || err.message); }
  }

  return (
    <div style={{ background: T.bg, minHeight: "100%", padding: "24px 28px 48px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: T.goldMid }}>Performance</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: T.text, margin: "4px 0 0" }}>Goals ({filtered.length})</h1>
        </div>
        <button onClick={openCreate} style={btn(T.gold, "#1E1E1E")}>+ Add Goal</button>
      </div>

      {error && <div style={errorBox}>{error}</div>}

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 14, marginBottom: 14, display: "flex", gap: 10, flexWrap: "wrap", boxShadow: T.shadow }}>
        <select value={filter.staffId} onChange={(e) => setFilter(f => ({ ...f, staffId: e.target.value }))} style={inp}>
          <option value="">All staff</option>
          {staff.map(s => <option key={s.staffId} value={s.staffId}>{s.displayName}</option>)}
        </select>
        <select value={filter.status} onChange={(e) => setFilter(f => ({ ...f, status: e.target.value }))} style={inp}>
          <option value="">All statuses</option>
          {Object.entries(GOAL_STATUS_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
        </select>
      </div>

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, boxShadow: T.shadow, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 980 }}>
            <thead style={{ background: T.surfaceWarm, borderBottom: `1px solid ${T.border}` }}>
              <tr>
                <th style={th}>Title</th><th style={th}>Employee</th>
                <th style={th}>Target Date</th><th style={th}>Weight</th>
                <th style={th}>Progress</th><th style={th}>Status</th>
                <th style={{ ...th, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: T.textMuted }}>Loading…</td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: T.textMuted }}>No goals.</td></tr>}
              {!loading && filtered.map(g => {
                const m = GOAL_STATUS_META[g.status] || GOAL_STATUS_META.not_started;
                return (
                  <tr key={g.goalId} style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{g.title}</div>
                      {g.description && <div style={{ fontSize: 12, color: T.textSoft, marginTop: 2 }}>{g.description.slice(0, 120)}</div>}
                    </td>
                    <td style={td}>{g.displayName}</td>
                    <td style={td}>{g.targetDate || "—"}</td>
                    <td style={td}>{g.weight ? `${g.weight}%` : "—"}</td>
                    <td style={td}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 80, height: 6, background: T.surfaceWarm, border: `1px solid ${T.border}`, borderRadius: 999, overflow: "hidden" }}>
                          <div style={{ width: `${g.progress}%`, height: "100%", background: g.progress >= 100 ? T.green : T.gold }} />
                        </div>
                        <span style={{ fontSize: 11, color: T.textSoft }}>{g.progress}%</span>
                      </div>
                    </td>
                    <td style={td}>
                      <select value={g.status} onChange={(e) => quickStatus(g, e.target.value)} style={{ ...inp, padding: "4px 8px", fontSize: 11 }}>
                        {Object.entries(GOAL_STATUS_META).map(([v, mm]) => <option key={v} value={v}>{mm.label}</option>)}
                      </select>
                      <span style={{ display: "block", marginTop: 4 }}>
                        <span style={pillStyle(m.color, m.bg, m.border)}>{m.label}</span>
                      </span>
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>
                      <button onClick={() => openEdit(g)} style={mini()}>Edit</button>
                      <button onClick={() => remove(g)} style={{ ...mini(), color: T.red, borderColor: `${T.red}55` }}>Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div onClick={() => setModal(null)} style={backdrop}>
          <div onClick={(e) => e.stopPropagation()} style={card}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, marginBottom: 14 }}>{modal.mode === "create" ? "New Goal" : "Edit Goal"}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              {fld("Employee *",
                <select value={modal.data.staffId} onChange={(e) => set("staffId", e.target.value)} style={inp}>
                  <option value="">Select…</option>
                  {staff.map(s => <option key={s.staffId} value={s.staffId}>{s.displayName} ({s.employeeCode})</option>)}
                </select>)}
              {fld("Period",       <input value={modal.data.period} onChange={(e) => set("period", e.target.value)} style={inp} placeholder="Q1-2026" />)}
              {fld("Title *",      <input value={modal.data.title}  onChange={(e) => set("title",  e.target.value)} style={inp} />)}
              {fld("Target Date",  <input type="date" value={modal.data.targetDate} onChange={(e) => set("targetDate", e.target.value)} style={inp} />)}
              {fld("Weight (%)",   <input type="number" value={modal.data.weight} onChange={(e) => set("weight", Number(e.target.value) || 0)} style={inp} />)}
              {fld("Progress (%)", <input type="number" value={modal.data.progress} onChange={(e) => set("progress", Number(e.target.value) || 0)} style={inp} />)}
              {fld("Status",
                <select value={modal.data.status} onChange={(e) => set("status", e.target.value)} style={inp}>
                  {Object.entries(GOAL_STATUS_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
                </select>)}
            </div>
            <label style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: T.textSoft }}>Description</span>
              <textarea rows={3} value={modal.data.description} onChange={(e) => set("description", e.target.value)} style={{ ...inp, fontFamily: "inherit" }} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: T.textSoft }}>Notes</span>
              <textarea rows={2} value={modal.data.notes} onChange={(e) => set("notes", e.target.value)} style={{ ...inp, fontFamily: "inherit" }} />
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
const td = { padding: "10px 14px", fontSize: 13, color: T.text, verticalAlign: "top" };
const errorBox = { background: T.redLight, color: T.red, border: `1px solid ${T.red}33`, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13 };
const inp = { border: `1px solid ${T.border}`, borderRadius: 8, padding: "9px 12px", fontSize: 13, background: "#FFFFFF" };
const backdrop = { position: "fixed", inset: 0, background: "rgba(20,18,12,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 };
const card = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 22, width: "min(640px, calc(100vw - 32px))", maxHeight: "calc(100vh - 64px)", overflow: "auto" };
function btn(bg, color, border) { return { background: bg, color, border: border ? `1px solid ${border}` : "none", borderRadius: 10, padding: "9px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer" }; }
function mini() { return { background: T.surface, color: T.text, border: `1px solid ${T.border}`, borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", marginLeft: 6 }; }
