/**
 * StaffShifts.jsx — Shift definitions CRUD
 */

import { useCallback, useEffect, useState } from "react";
import staffAttendanceService from "../../../services/staffAttendanceService";
import { T } from "./_shared";

const EMPTY = {
  name: "", code: "", startTime: "09:00", endTime: "17:00",
  graceMinutes: 10, halfDayMinHours: 4, fullDayMinHours: 7,
  overtimeAfterMinutes: 480, isDefault: false, sortOrder: 0, active: true,
};

export default function StaffShifts() {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [modal, setModal]     = useState(null);
  const [saving, setSaving]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const r = await staffAttendanceService.listShifts();
      if (r?.success) setRows(r.shifts || []);
    } catch (err) { setError(err.response?.data?.error || err.message); }
    finally { setLoading(false); }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  function openCreate() { setModal({ mode: "create", data: { ...EMPTY } }); }
  function openEdit(s)  { setModal({ mode: "edit",   data: { ...s } }); }
  function close() { setModal(null); }

  async function save() {
    setSaving(true);
    try {
      if (modal.mode === "create") await staffAttendanceService.createShift(modal.data);
      else                         await staffAttendanceService.updateShift(modal.data.shiftId, modal.data);
      close(); await load();
    } catch (err) { alert(err.response?.data?.error || err.message); }
    finally { setSaving(false); }
  }

  async function remove(s) {
    if (!window.confirm(`Delete shift "${s.name}"?`)) return;
    try {
      await staffAttendanceService.removeShift(s.shiftId);
      await load();
    } catch (err) { alert(err.response?.data?.error || err.message); }
  }

  async function toggleActive(s) {
    try { await staffAttendanceService.updateShift(s.shiftId, { active: !s.active }); await load(); }
    catch (err) { alert(err.response?.data?.error || err.message); }
  }

  return (
    <div style={{ background: T.bg, minHeight: "100%", padding: "24px 28px 48px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: T.goldMid }}>Staff Attendance</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: T.text, margin: "4px 0 0" }}>Shifts</h1>
          <div style={{ fontSize: 13, color: T.textSoft, marginTop: 4 }}>Working windows that drive late/early/half-day/overtime calculations.</div>
        </div>
        <button onClick={openCreate} style={btn(T.gold, "#1E1E1E")}>+ Add Shift</button>
      </div>

      {error && <div style={errorBox}>{error}</div>}

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, boxShadow: T.shadow, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 880 }}>
            <thead style={{ background: T.surfaceWarm, borderBottom: `1px solid ${T.border}` }}>
              <tr>
                <th style={th}>Name</th>
                <th style={th}>Code</th>
                <th style={th}>Window</th>
                <th style={th}>Grace</th>
                <th style={th}>Half-Day ≥</th>
                <th style={th}>Full-Day ≥</th>
                <th style={th}>OT after</th>
                <th style={th}>Status</th>
                <th style={{ ...th, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={9} style={{ padding: 24, textAlign: "center", color: T.textMuted }}>Loading…</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: "center", color: T.textMuted }}>No shifts yet. Defaults seed on first dashboard visit.</td></tr>}
              {!loading && rows.map(s => (
                <tr key={s.shiftId} style={{ borderBottom: `1px solid ${T.border}` }}>
                  <td style={td}>
                    <strong>{s.name}</strong>
                    {s.isSystem && <span style={tag}>system</span>}
                    {s.isDefault && <span style={{ ...tag, background: "#f0fdf4", color: T.green, borderColor: "#bbf7d0" }}>default</span>}
                  </td>
                  <td style={td}>{s.code || "—"}</td>
                  <td style={td}>{s.startTime} – {s.endTime}</td>
                  <td style={td}>{s.graceMinutes}m</td>
                  <td style={td}>{s.halfDayMinHours}h</td>
                  <td style={td}>{s.fullDayMinHours}h</td>
                  <td style={td}>{Math.floor(s.overtimeAfterMinutes / 60)}h{s.overtimeAfterMinutes % 60 ? ` ${s.overtimeAfterMinutes % 60}m` : ""}</td>
                  <td style={td}><button onClick={() => toggleActive(s)} style={pillBtn(s.active)}>{s.active ? "Active" : "Inactive"}</button></td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <button onClick={() => openEdit(s)} style={mini()}>Edit</button>
                    {!s.isSystem && <button onClick={() => remove(s)} style={{ ...mini(), color: T.red, borderColor: `${T.red}55` }}>Delete</button>}
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
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{modal.mode === "create" ? "Add Shift" : "Edit Shift"}</h2>
              <button onClick={close} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: T.textMuted }}>×</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
              {field("Name *",       <input value={modal.data.name} onChange={(e) => setModal({ ...modal, data: { ...modal.data, name: e.target.value } })} style={inp} />)}
              {field("Code",         <input value={modal.data.code} onChange={(e) => setModal({ ...modal, data: { ...modal.data, code: e.target.value } })} style={inp} />)}
              {field("Start",        <input type="time" value={modal.data.startTime} onChange={(e) => setModal({ ...modal, data: { ...modal.data, startTime: e.target.value } })} style={inp} />)}
              {field("End",          <input type="time" value={modal.data.endTime}   onChange={(e) => setModal({ ...modal, data: { ...modal.data, endTime: e.target.value } })}   style={inp} />)}
              {field("Grace (min)",  <input type="number" value={modal.data.graceMinutes}        onChange={(e) => setModal({ ...modal, data: { ...modal.data, graceMinutes: Number(e.target.value) || 0 } })} style={inp} />)}
              {field("Half-Day (h)", <input type="number" step="0.5" value={modal.data.halfDayMinHours} onChange={(e) => setModal({ ...modal, data: { ...modal.data, halfDayMinHours: Number(e.target.value) || 0 } })} style={inp} />)}
              {field("Full-Day (h)", <input type="number" step="0.5" value={modal.data.fullDayMinHours} onChange={(e) => setModal({ ...modal, data: { ...modal.data, fullDayMinHours: Number(e.target.value) || 0 } })} style={inp} />)}
              {field("OT after (min)", <input type="number" value={modal.data.overtimeAfterMinutes} onChange={(e) => setModal({ ...modal, data: { ...modal.data, overtimeAfterMinutes: Number(e.target.value) || 0 } })} style={inp} />)}
              {field("Sort Order",   <input type="number" value={modal.data.sortOrder} onChange={(e) => setModal({ ...modal, data: { ...modal.data, sortOrder: Number(e.target.value) || 0 } })} style={inp} />)}
              {field("Default?", <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}><input type="checkbox" checked={modal.data.isDefault} onChange={(e) => setModal({ ...modal, data: { ...modal.data, isDefault: e.target.checked } })} /> School default</label>)}
              {field("Active?",  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}><input type="checkbox" checked={modal.data.active}    onChange={(e) => setModal({ ...modal, data: { ...modal.data, active: e.target.checked } })} /> Active</label>)}
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
}

function field(label, control) {
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
const tag = { marginLeft: 6, fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 4, background: "#FFF7E0", border: "1px solid rgba(244,196,0,0.35)", color: T.goldMid, textTransform: "uppercase", letterSpacing: "0.05em" };
const modalBackdrop = { position: "fixed", inset: 0, background: "rgba(20,18,12,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 };
const modalCard = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 22, width: "min(640px, calc(100vw - 32px))", maxHeight: "calc(100vh - 64px)", overflow: "auto", boxShadow: "0 24px 80px rgba(0,0,0,0.20)" };
const inp = { border: `1px solid ${T.border}`, borderRadius: 8, padding: "9px 12px", fontSize: 13, background: "#FFFFFF" };
function btn(bg, color, border) {
  return { background: bg, color, border: border ? `1px solid ${border}` : "none", borderRadius: 10, padding: "9px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer" };
}
function mini() { return { background: T.surface, color: T.text, border: `1px solid ${T.border}`, borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", marginLeft: 6 }; }
function pillBtn(active) { return { background: active ? "#f0fdf4" : T.surfaceWarm, color: active ? T.green : T.textMuted, border: `1px solid ${active ? "#bbf7d0" : T.border}`, borderRadius: 999, padding: "3px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }; }
